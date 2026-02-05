import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApprovalStep, ApprovalStepStatus } from '../workflows/entities/approval-step.entity';
import { WorkflowInstance } from '../workflows/entities/workflow-instance.entity';
import { LeaveRequest, LeaveType } from '../leave-requests/entities/leave-request.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { ApprovalHistory, AuditAction } from '../audit/entities/approval-history.entity';

export interface AutoApprovalRule {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  priority: number;
  conditions: AutoApprovalCondition[];
  actions: AutoApprovalAction[];
  applicableLeaveTypes: LeaveType[];
  applicableUserRoles: UserRole[];
  maxDuration?: number;
  requiresManagerNotification: boolean;
}

export interface AutoApprovalCondition {
  field: string;
  operator: 'eq' | 'lt' | 'lte' | 'gt' | 'gte' | 'in' | 'between';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export interface AutoApprovalAction {
  type: 'approve' | 'escalate' | 'notify' | 'require_additional_approval';
  parameters: Record<string, any>;
}

export interface AutoApprovalResult {
  shouldAutoApprove: boolean;
  ruleName?: string;
  reason: string;
  additionalActions: string[];
  notificationRequired: boolean;
}

@Injectable()
export class AutoApprovalService {
  private readonly logger = new Logger(AutoApprovalService.name);

  // Built-in auto-approval rules
  private readonly defaultRules: AutoApprovalRule[] = [
    {
      id: 'short-sick-leave',
      name: 'Short Sick Leave Auto-Approval',
      description: 'Automatically approve sick leave of 2 days or less for employees',
      isActive: true,
      priority: 100,
      conditions: [
        { field: 'leaveType', operator: 'eq', value: LeaveType.SICK },
        { field: 'totalDays', operator: 'lte', value: 2, logicalOperator: 'AND' },
        { field: 'userRole', operator: 'eq', value: UserRole.EMPLOYEE, logicalOperator: 'AND' },
      ],
      actions: [
        { type: 'approve', parameters: { reason: 'Auto-approved: Short sick leave' } },
        { type: 'notify', parameters: { notifyManager: true, priority: 'medium' } },
      ],
      applicableLeaveTypes: [LeaveType.SICK],
      applicableUserRoles: [UserRole.EMPLOYEE],
      maxDuration: 2,
      requiresManagerNotification: true,
    },
    {
      id: 'single-day-personal',
      name: 'Single Day Personal Leave',
      description: 'Auto-approve single day personal leave with sufficient advance notice',
      isActive: true,
      priority: 90,
      conditions: [
        { field: 'leaveType', operator: 'eq', value: LeaveType.PERSONAL },
        { field: 'totalDays', operator: 'eq', value: 1, logicalOperator: 'AND' },
        { field: 'advanceNotice', operator: 'gte', value: 3, logicalOperator: 'AND' },
        { field: 'remainingLeaveBalance', operator: 'gte', value: 5, logicalOperator: 'AND' },
      ],
      actions: [
        { type: 'approve', parameters: { reason: 'Auto-approved: Single day personal leave with adequate notice' } },
        { type: 'notify', parameters: { notifyManager: true, priority: 'low' } },
      ],
      applicableLeaveTypes: [LeaveType.PERSONAL],
      applicableUserRoles: [UserRole.EMPLOYEE],
      maxDuration: 1,
      requiresManagerNotification: true,
    },
    {
      id: 'weekend-adjacent-leave',
      name: 'Weekend Adjacent Leave',
      description: 'Auto-approve Friday or Monday leave that creates long weekends',
      isActive: false, // Disabled by default, requires business approval
      priority: 80,
      conditions: [
        { field: 'leaveType', operator: 'in', value: [LeaveType.ANNUAL, LeaveType.PERSONAL] },
        { field: 'totalDays', operator: 'eq', value: 1, logicalOperator: 'AND' },
        { field: 'isWeekendAdjacent', operator: 'eq', value: true, logicalOperator: 'AND' },
        { field: 'advanceNotice', operator: 'gte', value: 7, logicalOperator: 'AND' },
      ],
      actions: [
        { type: 'approve', parameters: { reason: 'Auto-approved: Weekend adjacent leave with advance notice' } },
      ],
      applicableLeaveTypes: [LeaveType.ANNUAL, LeaveType.PERSONAL],
      applicableUserRoles: [UserRole.EMPLOYEE],
      maxDuration: 1,
      requiresManagerNotification: true,
    },
    {
      id: 'emergency-sick-immediate',
      name: 'Emergency Sick Leave',
      description: 'Auto-approve same-day sick leave up to 1 day',
      isActive: true,
      priority: 110,
      conditions: [
        { field: 'leaveType', operator: 'eq', value: LeaveType.SICK },
        { field: 'totalDays', operator: 'eq', value: 1, logicalOperator: 'AND' },
        { field: 'advanceNotice', operator: 'eq', value: 0, logicalOperator: 'AND' },
        { field: 'isEmergency', operator: 'eq', value: true, logicalOperator: 'AND' },
      ],
      actions: [
        { type: 'approve', parameters: { reason: 'Auto-approved: Emergency sick leave' } },
        { type: 'notify', parameters: { notifyManager: true, notifyHR: true, priority: 'high' } },
      ],
      applicableLeaveTypes: [LeaveType.SICK],
      applicableUserRoles: [UserRole.EMPLOYEE, UserRole.MANAGER],
      maxDuration: 1,
      requiresManagerNotification: true,
    },
  ];

  constructor(
    @InjectRepository(ApprovalStep)
    private approvalStepRepository: Repository<ApprovalStep>,
    @InjectRepository(WorkflowInstance)
    private workflowInstanceRepository: Repository<WorkflowInstance>,
    @InjectRepository(LeaveRequest)
    private leaveRequestRepository: Repository<LeaveRequest>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(ApprovalHistory)
    private auditRepository: Repository<ApprovalHistory>,
  ) {}

  /**
   * Evaluates if a workflow step should be auto-approved
   */
  async evaluateAutoApproval(
    stepId: string,
    workflowContext: Record<string, any>,
  ): Promise<AutoApprovalResult> {
    this.logger.log(`Evaluating auto-approval for step ${stepId}`);

    const step = await this.approvalStepRepository.findOne({
      where: { id: stepId },
      relations: ['workflowInstance', 'workflowInstance.leaveRequest', 'workflowInstance.leaveRequest.user'],
    });

    if (!step) {
      return {
        shouldAutoApprove: false,
        reason: 'Approval step not found',
        additionalActions: [],
        notificationRequired: false,
      };
    }

    const leaveRequest = step.workflowInstance.leaveRequest;
    if (!leaveRequest) {
      return {
        shouldAutoApprove: false,
        reason: 'No associated leave request found',
        additionalActions: [],
        notificationRequired: false,
      };
    }

    // Prepare context for rule evaluation
    const evaluationContext = await this.prepareEvaluationContext(leaveRequest, workflowContext);

    // Find applicable rules
    const applicableRules = this.getApplicableRules(leaveRequest);

    // Evaluate rules in priority order
    for (const rule of applicableRules) {
      const ruleResult = this.evaluateRule(rule, evaluationContext);
      if (ruleResult.shouldAutoApprove) {
        this.logger.log(`Auto-approval rule matched: ${rule.name} for step ${stepId}`);
        return ruleResult;
      }
    }

    return {
      shouldAutoApprove: false,
      reason: 'No auto-approval rules matched',
      additionalActions: [],
      notificationRequired: false,
    };
  }

  /**
   * Processes auto-approval for a step
   */
  async processAutoApproval(
    stepId: string,
    autoApprovalResult: AutoApprovalResult,
  ): Promise<void> {
    this.logger.log(`Processing auto-approval for step ${stepId} using rule: ${autoApprovalResult.ruleName}`);

    const step = await this.approvalStepRepository.findOne({
      where: { id: stepId },
      relations: ['workflowInstance', 'workflowInstance.leaveRequest'],
    });

    if (!step) {
      throw new Error(`Approval step ${stepId} not found`);
    }

    await this.approvalStepRepository.manager.transaction(async (manager) => {
      // Update step status
      step.status = ApprovalStepStatus.APPROVED;
      step.decidedAt = new Date();
      step.wasAutoApproved = true;
      step.autoApprovalReason = autoApprovalResult.reason;
      step.comments = `Auto-approved: ${autoApprovalResult.reason}`;

      await manager.save(ApprovalStep, step);

      // Create audit entry
      const auditEntry = this.auditRepository.create({
        approvalStepId: stepId,
        action: AuditAction.STEP_AUTO_APPROVED,
        description: 'Step automatically approved by system rule',
        entityType: step.workflowInstance.entityType,
        entityId: step.workflowInstance.entityId,
        comments: `Auto-approved: ${autoApprovalResult.reason}`,
        metadata: {
          systemTriggered: true,
          automationRule: autoApprovalResult.ruleName,
        },
      });

      await manager.save(ApprovalHistory, auditEntry);

      // Process additional actions
      await this.processAdditionalActions(manager, step, autoApprovalResult.additionalActions);
    });

    this.logger.log(`Successfully auto-approved step ${stepId}`);
  }

  /**
   * Gets all active auto-approval rules
   */
  getActiveRules(): AutoApprovalRule[] {
    return this.defaultRules.filter(rule => rule.isActive);
  }

  /**
   * Gets statistics about auto-approval usage
   */
  async getAutoApprovalStatistics(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalAutoApprovals: number;
    autoApprovalRate: number;
    ruleUsageStats: Record<string, number>;
    averageProcessingTime: number;
    topAutoApprovalReasons: Array<{ reason: string; count: number }>;
  }> {
    const auditEntries = await this.auditRepository.find({
      where: {
        action: AuditAction.STEP_AUTO_APPROVED,
        timestamp: Between(startDate, endDate),
      },
    });

    const totalAutoApprovals = auditEntries.length;

    // Get total approvals for rate calculation
    const totalApprovals = await this.auditRepository.count({
      where: {
        action: In([AuditAction.STEP_APPROVED, AuditAction.STEP_AUTO_APPROVED]),
        timestamp: Between(startDate, endDate),
      },
    });

    const autoApprovalRate = totalApprovals > 0 ? (totalAutoApprovals / totalApprovals) * 100 : 0;

    // Calculate rule usage statistics
    const ruleUsageStats: Record<string, number> = {};
    const reasonCounts: Record<string, number> = {};

    for (const entry of auditEntries) {
      const ruleName = entry.metadata?.automationRule;
      if (ruleName) {
        ruleUsageStats[ruleName] = (ruleUsageStats[ruleName] || 0) + 1;
      }

      const reason = entry.comments;
      if (reason) {
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      }
    }

    // Calculate average processing time (simplified)
    const averageProcessingTime = 0.1; // Auto-approvals are near-instantaneous

    // Top reasons
    const topAutoApprovalReasons = Object.entries(reasonCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([reason, count]) => ({ reason, count }));

    return {
      totalAutoApprovals,
      autoApprovalRate,
      ruleUsageStats,
      averageProcessingTime,
      topAutoApprovalReasons,
    };
  }

  /**
   * Creates a custom auto-approval rule
   */
  async createCustomRule(rule: Omit<AutoApprovalRule, 'id'>): Promise<AutoApprovalRule> {
    const customRule: AutoApprovalRule = {
      ...rule,
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    // Validate rule
    this.validateRule(customRule);

    // In a real implementation, you would save this to the database
    this.logger.log(`Created custom auto-approval rule: ${customRule.name}`);

    return customRule;
  }

  // Private helper methods

  private async prepareEvaluationContext(
    leaveRequest: LeaveRequest,
    additionalContext: Record<string, any>,
  ): Promise<Record<string, any>> {
    const user = await this.userRepository.findOne({
      where: { id: leaveRequest.user.id },
      relations: ['team', 'manager'],
    });

    const today = new Date();
    const startDate = new Date(leaveRequest.startDate);
    const advanceNotice = Math.ceil(
      (startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate remaining leave balance
    const remainingLeaveBalance = user ? user.annualLeaveDays - user.usedLeaveDays : 0;

    // Check if it's weekend adjacent (simplified)
    const startDayOfWeek = startDate.getDay();
    const isWeekendAdjacent = startDayOfWeek === 1 || startDayOfWeek === 5; // Monday or Friday

    return {
      leaveType: leaveRequest.type,
      totalDays: leaveRequest.totalDays,
      userRole: user?.role,
      userId: user?.id,
      department: user?.department,
      advanceNotice,
      remainingLeaveBalance,
      isWeekendAdjacent,
      isEmergency: additionalContext.isEmergency || false,
      teamSize: user?.team?.members?.length || 1,
      ...additionalContext,
    };
  }

  private getApplicableRules(leaveRequest: LeaveRequest): AutoApprovalRule[] {
    return this.defaultRules
      .filter(rule =>
        rule.isActive &&
        rule.applicableLeaveTypes.includes(leaveRequest.type as LeaveType)
      )
      .sort((a, b) => b.priority - a.priority);
  }

  private evaluateRule(rule: AutoApprovalRule, context: Record<string, any>): AutoApprovalResult {
    // Evaluate all conditions
    let conditionResult = true;

    for (let i = 0; i < rule.conditions.length; i++) {
      const condition = rule.conditions[i];
      const fieldResult = this.evaluateCondition(condition, context);

      if (i === 0) {
        conditionResult = fieldResult;
      } else {
        const logicalOp = rule.conditions[i - 1].logicalOperator || 'AND';
        if (logicalOp === 'AND') {
          conditionResult = conditionResult && fieldResult;
        } else {
          conditionResult = conditionResult || fieldResult;
        }
      }
    }

    if (!conditionResult) {
      return {
        shouldAutoApprove: false,
        reason: `Conditions not met for rule: ${rule.name}`,
        additionalActions: [],
        notificationRequired: false,
      };
    }

    // Extract approval action
    const approvalAction = rule.actions.find(action => action.type === 'approve');
    if (!approvalAction) {
      return {
        shouldAutoApprove: false,
        reason: `No approval action found in rule: ${rule.name}`,
        additionalActions: [],
        notificationRequired: false,
      };
    }

    // Extract additional actions
    const additionalActions = rule.actions
      .filter(action => action.type !== 'approve')
      .map(action => action.type);

    return {
      shouldAutoApprove: true,
      ruleName: rule.name,
      reason: approvalAction.parameters.reason || `Auto-approved by rule: ${rule.name}`,
      additionalActions,
      notificationRequired: rule.requiresManagerNotification,
    };
  }

  private evaluateCondition(condition: AutoApprovalCondition, context: Record<string, any>): boolean {
    const fieldValue = context[condition.field];

    switch (condition.operator) {
      case 'eq':
        return fieldValue === condition.value;
      case 'lt':
        return fieldValue < condition.value;
      case 'lte':
        return fieldValue <= condition.value;
      case 'gt':
        return fieldValue > condition.value;
      case 'gte':
        return fieldValue >= condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);
      case 'between':
        return Array.isArray(condition.value) &&
               condition.value.length === 2 &&
               fieldValue >= condition.value[0] &&
               fieldValue <= condition.value[1];
      default:
        this.logger.warn(`Unknown condition operator: ${condition.operator}`);
        return false;
    }
  }

  private async processAdditionalActions(
    manager: any,
    step: ApprovalStep,
    additionalActions: string[],
  ): Promise<void> {
    for (const action of additionalActions) {
      switch (action) {
        case 'notify':
          // Create notification entries (would integrate with notification service)
          this.logger.log(`Would send notification for auto-approved step ${step.id}`);
          break;

        case 'escalate':
          // Create escalation entry
          this.logger.log(`Would escalate step ${step.id} after auto-approval`);
          break;

        case 'require_additional_approval':
          // Create additional approval step
          this.logger.log(`Would require additional approval for step ${step.id}`);
          break;

        default:
          this.logger.warn(`Unknown additional action: ${action}`);
      }
    }
  }

  private validateRule(rule: AutoApprovalRule): void {
    if (!rule.name || !rule.conditions || rule.conditions.length === 0) {
      throw new Error('Rule must have a name and at least one condition');
    }

    if (!rule.actions || rule.actions.length === 0) {
      throw new Error('Rule must have at least one action');
    }

    // Check that there's an approve action
    const hasApproveAction = rule.actions.some(action => action.type === 'approve');
    if (!hasApproveAction) {
      throw new Error('Auto-approval rule must have an approve action');
    }

    // Validate conditions
    for (const condition of rule.conditions) {
      if (!condition.field || !condition.operator || condition.value === undefined) {
        throw new Error('Invalid condition: field, operator, and value are required');
      }
    }
  }
}

// Import for TypeORM operations
import { Between, In } from 'typeorm';