import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApprovalStep } from '../../workflows/entities/approval-step.entity';
import { User } from '../../users/entities/user.entity';

export enum AuditAction {
  STEP_CREATED = 'STEP_CREATED',
  STEP_ASSIGNED = 'STEP_ASSIGNED',
  STEP_APPROVED = 'STEP_APPROVED',
  STEP_REJECTED = 'STEP_REJECTED',
  STEP_DELEGATED = 'STEP_DELEGATED',
  STEP_ESCALATED = 'STEP_ESCALATED',
  STEP_TIMEOUT = 'STEP_TIMEOUT',
  STEP_AUTO_APPROVED = 'STEP_AUTO_APPROVED',
  STEP_SKIPPED = 'STEP_SKIPPED',
  DECISION_REVERSED = 'DECISION_REVERSED',
  COMMENT_ADDED = 'COMMENT_ADDED',
  REMINDER_SENT = 'REMINDER_SENT',
  SLA_BREACH = 'SLA_BREACH',
}

export enum AuditSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

@Entity('approval_history')
@Index(['approvalStepId', 'timestamp'])
@Index(['performedById', 'timestamp'])
@Index(['action', 'timestamp'])
@Index(['entityType', 'entityId', 'timestamp'])
export class ApprovalHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ApprovalStep, (step) => step.history)
  @JoinColumn({ name: 'approval_step_id' })
  approvalStep: ApprovalStep;

  @Column({ name: 'approval_step_id' })
  approvalStepId: string;

  @Column({
    type: 'enum',
    enum: AuditAction,
  })
  action: AuditAction;

  @Column({
    type: 'enum',
    enum: AuditSeverity,
    default: AuditSeverity.INFO,
  })
  severity: AuditSeverity;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  comments: string;

  // User who performed the action
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'performed_by_id' })
  performedBy: User;

  @Column({ name: 'performed_by_id', nullable: true })
  performedById: string;

  // User affected by the action (e.g., delegate in delegation action)
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'affected_user_id' })
  affectedUser: User;

  @Column({ name: 'affected_user_id', nullable: true })
  affectedUserId: string;

  // Entity context (e.g., leave_request)
  @Column()
  entityType: string;

  @Column({ name: 'entity_id' })
  entityId: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;

  // Previous state (for rollback capability)
  @Column({ type: 'jsonb', nullable: true })
  previousState: Record<string, any>;

  // New state after action
  @Column({ type: 'jsonb', nullable: true })
  newState: Record<string, any>;

  // Additional metadata
  @Column({ type: 'jsonb', default: {} })
  metadata: {
    // IP address and user agent for security tracking
    ipAddress?: string;
    userAgent?: string;

    // System information
    systemTriggered?: boolean;
    automationRule?: string;

    // Timing information
    processingTimeMs?: number;
    slaTimeRemainingMs?: number;

    // Delegation context
    delegationId?: string;
    originalAssigneeId?: string;

    // Escalation context
    escalationLevel?: number;
    escalationReason?: string;

    // Rollback context
    rollbackReason?: string;
    rollbackAuthorizedBy?: string;

    // Business context
    leaveType?: string;
    leaveDuration?: number;
    teamImpact?: string;
    urgencyLevel?: string;

    // Compliance tracking
    regulatoryRequirement?: string;
    complianceNotes?: string;
  };

  // Immutability hash for tamper detection
  @Column({ nullable: true })
  integrityhash: string;

  @CreateDateColumn()
  createdAt: Date;

  // Helper methods
  static createStepCreated(
    stepId: string,
    entityType: string,
    entityId: string,
    assignedUserId?: string,
    metadata?: any
  ): Partial<ApprovalHistory> {
    return {
      approvalStepId: stepId,
      action: AuditAction.STEP_CREATED,
      severity: AuditSeverity.INFO,
      description: 'Approval step created and assigned',
      affectedUserId: assignedUserId,
      entityType,
      entityId,
      metadata: metadata || {},
    };
  }

  static createStepApproved(
    stepId: string,
    approvedById: string,
    entityType: string,
    entityId: string,
    comments?: string,
    metadata?: any
  ): Partial<ApprovalHistory> {
    return {
      approvalStepId: stepId,
      action: AuditAction.STEP_APPROVED,
      severity: AuditSeverity.INFO,
      description: 'Approval step approved',
      comments,
      performedById: approvedById,
      entityType,
      entityId,
      metadata: metadata || {},
    };
  }

  static createStepRejected(
    stepId: string,
    rejectedById: string,
    entityType: string,
    entityId: string,
    reason: string,
    metadata?: any
  ): Partial<ApprovalHistory> {
    return {
      approvalStepId: stepId,
      action: AuditAction.STEP_REJECTED,
      severity: AuditSeverity.WARNING,
      description: 'Approval step rejected',
      comments: reason,
      performedById: rejectedById,
      entityType,
      entityId,
      metadata: metadata || {},
    };
  }

  static createStepDelegated(
    stepId: string,
    delegatedById: string,
    delegatedToId: string,
    entityType: string,
    entityId: string,
    delegationId: string,
    metadata?: any
  ): Partial<ApprovalHistory> {
    return {
      approvalStepId: stepId,
      action: AuditAction.STEP_DELEGATED,
      severity: AuditSeverity.INFO,
      description: 'Approval step delegated to another user',
      performedById: delegatedById,
      affectedUserId: delegatedToId,
      entityType,
      entityId,
      metadata: {
        ...metadata,
        delegationId,
        originalAssigneeId: delegatedById,
      },
    };
  }

  static createStepEscalated(
    stepId: string,
    escalatedToId: string,
    entityType: string,
    entityId: string,
    escalationReason: string,
    escalationLevel: number,
    metadata?: any
  ): Partial<ApprovalHistory> {
    return {
      approvalStepId: stepId,
      action: AuditAction.STEP_ESCALATED,
      severity: AuditSeverity.WARNING,
      description: 'Approval step escalated due to timeout or other reason',
      affectedUserId: escalatedToId,
      entityType,
      entityId,
      metadata: {
        ...metadata,
        escalationLevel,
        escalationReason,
        systemTriggered: true,
      },
    };
  }

  static createAutoApproved(
    stepId: string,
    entityType: string,
    entityId: string,
    automationRule: string,
    metadata?: any
  ): Partial<ApprovalHistory> {
    return {
      approvalStepId: stepId,
      action: AuditAction.STEP_AUTO_APPROVED,
      severity: AuditSeverity.INFO,
      description: 'Step automatically approved by system rule',
      entityType,
      entityId,
      metadata: {
        ...metadata,
        systemTriggered: true,
        automationRule,
      },
    };
  }

  isSystemGenerated(): boolean {
    return this.metadata?.systemTriggered === true;
  }

  isUserAction(): boolean {
    return !this.isSystemGenerated() && this.performedById != null;
  }

  getDuration(): number | null {
    return this.metadata?.processingTimeMs || null;
  }

  isEscalation(): boolean {
    return this.action === AuditAction.STEP_ESCALATED;
  }

  isDelegation(): boolean {
    return this.action === AuditAction.STEP_DELEGATED;
  }

  isDecisionAction(): boolean {
    return [AuditAction.STEP_APPROVED, AuditAction.STEP_REJECTED].includes(this.action);
  }
}