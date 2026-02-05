import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { WorkflowInstance } from './workflow-instance.entity';
import { User } from '../../users/entities/user.entity';
import { ApprovalHistory } from '../../audit/entities/approval-history.entity';

export enum ApprovalStepStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  ESCALATED = 'ESCALATED',
  DELEGATED = 'DELEGATED',
  SKIPPED = 'SKIPPED',
  TIMEOUT = 'TIMEOUT',
}

export enum StepType {
  SINGLE_APPROVER = 'SINGLE_APPROVER',
  ANY_OF_MULTIPLE = 'ANY_OF_MULTIPLE',
  ALL_OF_MULTIPLE = 'ALL_OF_MULTIPLE',
  CONDITIONAL = 'CONDITIONAL',
  AUTO_APPROVAL = 'AUTO_APPROVAL',
}

// Re-export for backward compatibility
export { StepType as ApprovalStepType };

@Entity('approval_steps')
@Index(['workflowInstanceId', 'stepOrder'])
@Index(['assignedUserId', 'status', 'dueAt'])
@Index(['status', 'dueAt'])
export class ApprovalStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => WorkflowInstance, (instance) => instance.approvalSteps)
  @JoinColumn({ name: 'workflow_instance_id' })
  workflowInstance: WorkflowInstance;

  @Column({ name: 'workflow_instance_id' })
  workflowInstanceId: string;

  @Column({ type: 'int' })
  stepOrder: number;

  @Column()
  stepName: string;

  @Column({
    type: 'enum',
    enum: StepType,
  })
  stepType: StepType;

  @Column({
    type: 'enum',
    enum: ApprovalStepStatus,
    default: ApprovalStepStatus.PENDING,
  })
  status: ApprovalStepStatus;

  // Primary assigned user for this step
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_user_id' })
  assignedUser: User;

  @Column({ name: 'assigned_user_id', nullable: true })
  assignedUserId: string;

  // For steps that require multiple approvers
  @Column({ type: 'jsonb', default: [] })
  requiredApproverIds: string[];

  @Column({ type: 'jsonb', default: [] })
  completedApproverIds: string[];

  @Column({ default: true })
  isRequired: boolean;

  // Timeout and escalation
  @Column({ type: 'int', nullable: true })
  timeoutHours: number;

  @Column({ type: 'timestamp', nullable: true })
  dueAt: Date;

  @Column({ type: 'int', default: 0 })
  escalationCount: number;

  // Decision tracking
  @Column({ type: 'text', nullable: true })
  comments: string;

  @Column({ type: 'timestamp', nullable: true })
  decidedAt: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'decided_by_id' })
  decidedBy: User;

  @Column({ name: 'decided_by_id', nullable: true })
  decidedById: string;

  // Delegation tracking
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'original_assignee_id' })
  originalAssignee: User;

  @Column({ name: 'original_assignee_id', nullable: true })
  originalAssigneeId: string;

  @Column({ name: 'delegation_id', nullable: true })
  delegationId: string;

  // Auto-approval tracking
  @Column({ default: false })
  wasAutoApproved: boolean;

  @Column({ type: 'text', nullable: true })
  autoApprovalReason: string;

  // Conditional logic data
  @Column({ type: 'jsonb', nullable: true })
  conditionalData: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => ApprovalHistory, (history) => history.approvalStep, {
    cascade: true,
  })
  history: ApprovalHistory[];

  // Helper methods
  isApproved(): boolean {
    return this.status === ApprovalStepStatus.APPROVED;
  }

  isRejected(): boolean {
    return this.status === ApprovalStepStatus.REJECTED;
  }

  isPending(): boolean {
    return this.status === ApprovalStepStatus.PENDING;
  }

  isOverdue(): boolean {
    return this.dueAt && new Date() > this.dueAt;
  }

  canBeApprovedBy(userId: string): boolean {
    if (this.assignedUserId === userId) return true;
    return this.requiredApproverIds.includes(userId) &&
           !this.completedApproverIds.includes(userId);
  }

  needsMoreApprovals(): boolean {
    if (this.stepType === StepType.ALL_OF_MULTIPLE) {
      return this.completedApproverIds.length < this.requiredApproverIds.length;
    }
    return false;
  }
}