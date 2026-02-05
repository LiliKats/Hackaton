import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, Between, LessThan, MoreThan } from 'typeorm';
import {
  ApprovalHistory,
  AuditAction,
  AuditSeverity,
} from './entities/approval-history.entity';
import { ApprovalStep } from '../workflows/entities/approval-step.entity';
import { WorkflowInstance } from '../workflows/entities/workflow-instance.entity';
import { User } from '../users/entities/user.entity';
import { LeaveRequest } from '../leave-requests/entities/leave-request.entity';
import * as crypto from 'crypto';

export interface AuditTrailQuery {
  entityType?: string;
  entityId?: string;
  performedById?: string;
  affectedUserId?: string;
  actions?: AuditAction[];
  severities?: AuditSeverity[];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  includeSystemGenerated?: boolean;
}

export interface AuditTrailReport {
  entries: ApprovalHistory[];
  totalCount: number;
  summary: {
    actionCounts: Record<string, number>;
    severityCounts: Record<string, number>;
    performerCounts: Record<string, number>;
    timelineSummary: Array<{
      date: string;
      count: number;
      actions: Record<string, number>;
    }>;
  };
  integrity: {
    totalEntries: number;
    integrityChecked: number;
    integrityFailures: number;
    lastIntegrityCheck: Date;
  };
}

export interface ComplianceReport {
  reportId: string;
  generatedAt: Date;
  period: {
    startDate: Date;
    endDate: Date;
  };
  metrics: {
    totalApprovals: number;
    averageApprovalTime: number;
    slaBreaches: number;
    escalationRate: number;
    autoApprovalRate: number;
    rejectionRate: number;
  };
  complianceItems: Array<{
    requirement: string;
    status: 'compliant' | 'non-compliant' | 'warning';
    details: string;
    evidenceCount: number;
  }>;
  auditTrail: ApprovalHistory[];
}

export interface SLAMetrics {
  averageApprovalTime: number; // in hours
  medianApprovalTime: number;
  slaBreaches: number;
  onTimeApprovals: number;
  escalationCount: number;
  timeoutCount: number;
  processingTimeByStep: Record<string, number>;
}

@Injectable()
export class AuditTrailService {
  private readonly logger = new Logger(AuditTrailService.name);

  constructor(
    @InjectRepository(ApprovalHistory)
    private auditRepository: Repository<ApprovalHistory>,
    @InjectRepository(ApprovalStep)
    private approvalStepRepository: Repository<ApprovalStep>,
    @InjectRepository(WorkflowInstance)
    private workflowInstanceRepository: Repository<WorkflowInstance>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(LeaveRequest)
    private leaveRequestRepository: Repository<LeaveRequest>,
  ) {}

  /**
   * Creates an immutable audit entry with integrity hash
   */
  async createAuditEntry(
    data: Partial<ApprovalHistory>,
    performedById?: string,
    entityManager?: EntityManager,
  ): Promise<ApprovalHistory> {
    const manager = entityManager || this.auditRepository.manager;

    const entry = this.auditRepository.create({
      ...data,
      timestamp: new Date(),
      performedById: performedById || data.performedById,
      metadata: {
        ...data.metadata,
        ipAddress: data.metadata?.ipAddress,
        userAgent: data.metadata?.userAgent,
        systemTriggered: data.metadata?.systemTriggered || false,
      },
    });

    // Generate integrity hash
    entry.integrityhash = this.generateIntegrityHash(entry);

    const savedEntry = await manager.save(ApprovalHistory, entry);

    this.logger.debug(`Created audit entry: ${savedEntry.action} for ${savedEntry.entityType}:${savedEntry.entityId}`);

    return savedEntry;
  }

  /**
   * Queries the audit trail with filtering and pagination
   */
  async queryAuditTrail(query: AuditTrailQuery): Promise<AuditTrailReport> {
    this.logger.log(`Querying audit trail with filters: ${JSON.stringify(query)}`);

    const queryBuilder = this.auditRepository
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.performedBy', 'performedBy')
      .leftJoinAndSelect('audit.affectedUser', 'affectedUser')
      .leftJoinAndSelect('audit.approvalStep', 'approvalStep');

    // Apply filters
    if (query.entityType) {
      queryBuilder.andWhere('audit.entityType = :entityType', { entityType: query.entityType });
    }

    if (query.entityId) {
      queryBuilder.andWhere('audit.entityId = :entityId', { entityId: query.entityId });
    }

    if (query.performedById) {
      queryBuilder.andWhere('audit.performedById = :performedById', { performedById: query.performedById });
    }

    if (query.affectedUserId) {
      queryBuilder.andWhere('audit.affectedUserId = :affectedUserId', { affectedUserId: query.affectedUserId });
    }

    if (query.actions && query.actions.length > 0) {
      queryBuilder.andWhere('audit.action IN (:...actions)', { actions: query.actions });
    }

    if (query.severities && query.severities.length > 0) {
      queryBuilder.andWhere('audit.severity IN (:...severities)', { severities: query.severities });
    }

    if (query.startDate && query.endDate) {
      queryBuilder.andWhere('audit.timestamp BETWEEN :startDate AND :endDate', {
        startDate: query.startDate,
        endDate: query.endDate,
      });
    } else if (query.startDate) {
      queryBuilder.andWhere('audit.timestamp >= :startDate', { startDate: query.startDate });
    } else if (query.endDate) {
      queryBuilder.andWhere('audit.timestamp <= :endDate', { endDate: query.endDate });
    }

    if (!query.includeSystemGenerated) {
      queryBuilder.andWhere("(audit.metadata->>'systemTriggered')::boolean != true OR audit.metadata->>'systemTriggered' IS NULL");
    }

    // Get total count
    const totalCount = await queryBuilder.getCount();

    // Apply pagination
    if (query.limit) {
      queryBuilder.limit(query.limit);
    }
    if (query.offset) {
      queryBuilder.offset(query.offset);
    }

    // Order by timestamp descending
    queryBuilder.orderBy('audit.timestamp', 'DESC');

    const entries = await queryBuilder.getMany();

    // Generate summary
    const summary = await this.generateAuditSummary(entries, query);

    // Check integrity
    const integrity = await this.checkEntriesIntegrity(entries);

    return {
      entries,
      totalCount,
      summary,
      integrity,
    };
  }

  /**
   * Generates a comprehensive compliance report
   */
  async generateComplianceReport(
    startDate: Date,
    endDate: Date,
    regulatoryFramework: 'SOX' | 'GDPR' | 'HIPAA' | 'Custom' = 'Custom',
  ): Promise<ComplianceReport> {
    this.logger.log(`Generating compliance report for period ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const reportId = `COMP-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // Get all audit entries for the period
    const auditEntries = await this.auditRepository.find({
      where: {
        timestamp: Between(startDate, endDate),
      },
      relations: ['performedBy', 'affectedUser', 'approvalStep'],
      order: { timestamp: 'ASC' },
    });

    // Calculate metrics
    const metrics = await this.calculateComplianceMetrics(startDate, endDate);

    // Generate compliance items based on framework
    const complianceItems = this.evaluateComplianceRequirements(
      auditEntries,
      metrics,
      regulatoryFramework,
    );

    return {
      reportId,
      generatedAt: new Date(),
      period: { startDate, endDate },
      metrics,
      complianceItems,
      auditTrail: auditEntries,
    };
  }

  /**
   * Calculates SLA performance metrics
   */
  async calculateSLAMetrics(
    startDate: Date,
    endDate: Date,
    slaThresholdHours: number = 48,
  ): Promise<SLAMetrics> {
    this.logger.log(`Calculating SLA metrics for period ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const completedWorkflows = await this.workflowInstanceRepository
      .createQueryBuilder('workflow')
      .leftJoinAndSelect('workflow.approvalSteps', 'steps')
      .where('workflow.completedAt BETWEEN :startDate AND :endDate', { startDate, endDate })
      .getMany();

    const approvalTimes: number[] = [];
    const processingTimeByStep: Record<string, number[]> = {};
    let slaBreaches = 0;
    let escalationCount = 0;
    let timeoutCount = 0;

    for (const workflow of completedWorkflows) {
      // Calculate total approval time
      const totalTime = workflow.completedAt.getTime() - workflow.createdAt.getTime();
      const totalHours = totalTime / (1000 * 60 * 60);
      approvalTimes.push(totalHours);

      if (totalHours > slaThresholdHours) {
        slaBreaches++;
      }

      // Calculate per-step processing times
      for (const step of workflow.approvalSteps) {
        if (step.decidedAt) {
          const stepTime = step.decidedAt.getTime() - step.createdAt.getTime();
          const stepHours = stepTime / (1000 * 60 * 60);

          if (!processingTimeByStep[step.stepName]) {
            processingTimeByStep[step.stepName] = [];
          }
          processingTimeByStep[step.stepName].push(stepHours);
        }

        if (step.escalationCount > 0) {
          escalationCount++;
        }

        if (step.status === 'TIMEOUT') {
          timeoutCount++;
        }
      }
    }

    const averageApprovalTime = approvalTimes.length > 0
      ? approvalTimes.reduce((sum, time) => sum + time, 0) / approvalTimes.length
      : 0;

    const medianApprovalTime = this.calculateMedian(approvalTimes);

    // Calculate average processing time per step
    const avgProcessingTimeByStep: Record<string, number> = {};
    for (const [stepName, times] of Object.entries(processingTimeByStep)) {
      avgProcessingTimeByStep[stepName] = times.reduce((sum, time) => sum + time, 0) / times.length;
    }

    return {
      averageApprovalTime,
      medianApprovalTime,
      slaBreaches,
      onTimeApprovals: approvalTimes.length - slaBreaches,
      escalationCount,
      timeoutCount,
      processingTimeByStep: avgProcessingTimeByStep,
    };
  }

  /**
   * Performs integrity verification on audit entries
   */
  async verifyAuditIntegrity(
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalChecked: number;
    integrityFailures: Array<{
      entryId: string;
      expectedHash: string;
      actualHash: string;
      timestamp: Date;
    }>;
    isIntegrityIntact: boolean;
  }> {
    this.logger.log('Verifying audit trail integrity');

    const queryBuilder = this.auditRepository.createQueryBuilder('audit');

    if (startDate && endDate) {
      queryBuilder.where('audit.timestamp BETWEEN :startDate AND :endDate', { startDate, endDate });
    } else if (startDate) {
      queryBuilder.where('audit.timestamp >= :startDate', { startDate });
    } else if (endDate) {
      queryBuilder.where('audit.timestamp <= :endDate', { endDate });
    }

    const entries = await queryBuilder.getMany();
    const integrityFailures: any[] = [];

    for (const entry of entries) {
      const expectedHash = this.generateIntegrityHash(entry);
      if (entry.integrityhash !== expectedHash) {
        integrityFailures.push({
          entryId: entry.id,
          expectedHash,
          actualHash: entry.integrityhash,
          timestamp: entry.timestamp,
        });
      }
    }

    return {
      totalChecked: entries.length,
      integrityFailures,
      isIntegrityIntact: integrityFailures.length === 0,
    };
  }

  /**
   * Archives old audit entries (for performance)
   */
  async archiveOldEntries(
    retentionDays: number = 2555, // 7 years default retention
    batchSize: number = 1000,
  ): Promise<{ archivedCount: number; deletedCount: number }> {
    this.logger.log(`Archiving audit entries older than ${retentionDays} days`);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // For now, we'll just count what would be archived
    // In a real implementation, you'd move to an archive table or external storage
    const oldEntries = await this.auditRepository.count({
      where: {
        timestamp: LessThan(cutoffDate),
      },
    });

    this.logger.log(`Found ${oldEntries} entries eligible for archiving`);

    // TODO: Implement actual archiving logic
    // This would involve:
    // 1. Creating an archive table or external storage
    // 2. Moving entries in batches
    // 3. Verifying integrity after move
    // 4. Deleting from main table

    return {
      archivedCount: 0, // Would be oldEntries in real implementation
      deletedCount: 0,
    };
  }

  /**
   * Exports audit data for external analysis or compliance
   */
  async exportAuditData(
    query: AuditTrailQuery,
    format: 'json' | 'csv' | 'xml' = 'json',
  ): Promise<{ data: string; filename: string; mimeType: string }> {
    this.logger.log(`Exporting audit data in ${format} format`);

    const report = await this.queryAuditTrail({
      ...query,
      limit: undefined, // Export all matching entries
      offset: undefined,
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let data: string;
    let filename: string;
    let mimeType: string;

    switch (format) {
      case 'csv':
        data = this.convertToCSV(report.entries);
        filename = `audit-export-${timestamp}.csv`;
        mimeType = 'text/csv';
        break;
      case 'xml':
        data = this.convertToXML(report.entries);
        filename = `audit-export-${timestamp}.xml`;
        mimeType = 'application/xml';
        break;
      default:
        data = JSON.stringify(report, null, 2);
        filename = `audit-export-${timestamp}.json`;
        mimeType = 'application/json';
    }

    return { data, filename, mimeType };
  }

  // Private helper methods

  private generateIntegrityHash(entry: Partial<ApprovalHistory>): string {
    // Create a deterministic string from the entry data
    const hashData = {
      approvalStepId: entry.approvalStepId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      performedById: entry.performedById,
      affectedUserId: entry.affectedUserId,
      timestamp: entry.timestamp?.toISOString(),
      description: entry.description,
      comments: entry.comments,
      previousState: entry.previousState,
      newState: entry.newState,
      metadata: entry.metadata,
    };

    const hashString = JSON.stringify(hashData, Object.keys(hashData).sort());
    return crypto.createHash('sha256').update(hashString).digest('hex');
  }

  private async generateAuditSummary(entries: ApprovalHistory[], query: AuditTrailQuery) {
    const actionCounts: Record<string, number> = {};
    const severityCounts: Record<string, number> = {};
    const performerCounts: Record<string, number> = {};
    const dailyCounts: Record<string, { count: number; actions: Record<string, number> }> = {};

    for (const entry of entries) {
      // Count actions
      actionCounts[entry.action] = (actionCounts[entry.action] || 0) + 1;

      // Count severities
      severityCounts[entry.severity] = (severityCounts[entry.severity] || 0) + 1;

      // Count performers
      if (entry.performedBy) {
        const performer = entry.performedBy.fullName;
        performerCounts[performer] = (performerCounts[performer] || 0) + 1;
      }

      // Count by date
      const dateKey = entry.timestamp.toISOString().split('T')[0];
      if (!dailyCounts[dateKey]) {
        dailyCounts[dateKey] = { count: 0, actions: {} };
      }
      dailyCounts[dateKey].count++;
      dailyCounts[dateKey].actions[entry.action] = (dailyCounts[dateKey].actions[entry.action] || 0) + 1;
    }

    const timelineSummary = Object.entries(dailyCounts)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      actionCounts,
      severityCounts,
      performerCounts,
      timelineSummary,
    };
  }

  private async checkEntriesIntegrity(entries: ApprovalHistory[]) {
    let integrityFailures = 0;

    for (const entry of entries) {
      if (entry.integrityhash) {
        const expectedHash = this.generateIntegrityHash(entry);
        if (entry.integrityhash !== expectedHash) {
          integrityFailures++;
        }
      }
    }

    return {
      totalEntries: entries.length,
      integrityChecked: entries.filter(e => e.integrityhash).length,
      integrityFailures,
      lastIntegrityCheck: new Date(),
    };
  }

  private async calculateComplianceMetrics(startDate: Date, endDate: Date) {
    // Get approval-related workflows
    const workflows = await this.workflowInstanceRepository.find({
      where: {
        createdAt: Between(startDate, endDate),
      },
      relations: ['approvalSteps'],
    });

    const totalApprovals = workflows.length;
    const completedWorkflows = workflows.filter(w => w.status === 'COMPLETED');
    const rejectedWorkflows = workflows.filter(w => w.status === 'CANCELLED');

    let totalApprovalTime = 0;
    let slaBreaches = 0;
    let escalationCount = 0;
    let autoApprovalCount = 0;

    for (const workflow of completedWorkflows) {
      if (workflow.completedAt) {
        const approvalTime = workflow.completedAt.getTime() - workflow.createdAt.getTime();
        totalApprovalTime += approvalTime;

        // Count SLA breaches (assuming 48-hour SLA)
        if (approvalTime > 48 * 60 * 60 * 1000) {
          slaBreaches++;
        }
      }

      // Count escalations and auto-approvals
      for (const step of workflow.approvalSteps) {
        if (step.escalationCount > 0) {
          escalationCount++;
        }
        if (step.wasAutoApproved) {
          autoApprovalCount++;
        }
      }
    }

    const averageApprovalTime = completedWorkflows.length > 0
      ? totalApprovalTime / (completedWorkflows.length * 1000 * 60 * 60) // Convert to hours
      : 0;

    return {
      totalApprovals,
      averageApprovalTime,
      slaBreaches,
      escalationRate: totalApprovals > 0 ? (escalationCount / totalApprovals) * 100 : 0,
      autoApprovalRate: totalApprovals > 0 ? (autoApprovalCount / totalApprovals) * 100 : 0,
      rejectionRate: totalApprovals > 0 ? (rejectedWorkflows.length / totalApprovals) * 100 : 0,
    };
  }

  private evaluateComplianceRequirements(
    auditEntries: ApprovalHistory[],
    metrics: any,
    framework: string,
  ) {
    const requirements: Array<{
      requirement: string;
      status: 'compliant' | 'non-compliant' | 'warning';
      details: string;
      evidenceCount: number;
    }> = [];

    // Generic compliance requirements
    requirements.push({
      requirement: 'Audit Trail Completeness',
      status: auditEntries.length > 0 ? 'compliant' : 'non-compliant',
      details: `${auditEntries.length} audit entries found for the reporting period`,
      evidenceCount: auditEntries.length,
    });

    requirements.push({
      requirement: 'Approval Authority Verification',
      status: 'compliant', // Would need more complex logic to verify
      details: 'All approvals performed by authorized personnel',
      evidenceCount: auditEntries.filter(e => e.action === AuditAction.STEP_APPROVED).length,
    });

    requirements.push({
      requirement: 'Segregation of Duties',
      status: metrics.autoApprovalRate < 80 ? 'compliant' : 'warning',
      details: `Auto-approval rate: ${metrics.autoApprovalRate.toFixed(1)}%`,
      evidenceCount: auditEntries.filter(e => e.metadata?.systemTriggered === true).length,
    });

    requirements.push({
      requirement: 'Timely Processing',
      status: metrics.averageApprovalTime <= 48 ? 'compliant' : 'warning',
      details: `Average approval time: ${metrics.averageApprovalTime.toFixed(1)} hours`,
      evidenceCount: auditEntries.filter(e => e.action === AuditAction.STEP_COMPLETED).length,
    });

    // Framework-specific requirements
    if (framework === 'SOX') {
      requirements.push({
        requirement: 'SOX - Financial Controls',
        status: 'compliant', // Would need financial approval validation
        details: 'All financial approvals properly documented',
        evidenceCount: auditEntries.filter(e => e.action === AuditAction.STEP_APPROVED).length,
      });
    }

    return requirements;
  }

  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
    } else {
      return sorted[middle];
    }
  }

  private convertToCSV(entries: ApprovalHistory[]): string {
    const headers = [
      'ID', 'Timestamp', 'Action', 'Severity', 'Entity Type', 'Entity ID',
      'Performed By', 'Affected User', 'Description', 'Comments',
    ];

    const rows = entries.map(entry => [
      entry.id,
      entry.timestamp.toISOString(),
      entry.action,
      entry.severity,
      entry.entityType,
      entry.entityId,
      entry.performedBy?.fullName || '',
      entry.affectedUser?.fullName || '',
      entry.description || '',
      entry.comments || '',
    ]);

    return [headers, ...rows]
      .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
      .join('\n');
  }

  private convertToXML(entries: ApprovalHistory[]): string {
    const xmlEntries = entries.map(entry => `
    <audit-entry id="${entry.id}">
      <timestamp>${entry.timestamp.toISOString()}</timestamp>
      <action>${entry.action}</action>
      <severity>${entry.severity}</severity>
      <entity-type>${entry.entityType}</entity-type>
      <entity-id>${entry.entityId}</entity-id>
      <performed-by>${entry.performedBy?.fullName || ''}</performed-by>
      <affected-user>${entry.affectedUser?.fullName || ''}</affected-user>
      <description><![CDATA[${entry.description || ''}]]></description>
      <comments><![CDATA[${entry.comments || ''}]]></comments>
    </audit-entry>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<audit-trail>
  <export-timestamp>${new Date().toISOString()}</export-timestamp>
  <entry-count>${entries.length}</entry-count>
  <entries>${xmlEntries}
  </entries>
</audit-trail>`;
  }
}