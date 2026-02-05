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
import { WorkflowTemplate } from './workflow-template.entity';
import { ApprovalStep } from './approval-step.entity';
import { LeaveRequest } from '../../leave-requests/entities/leave-request.entity';

export enum WorkflowStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  ESCALATED = 'ESCALATED',
  ERROR = 'ERROR',
}

@Entity('workflow_instances')
@Index(['status', 'createdAt'])
@Index(['entityType', 'entityId'])
export class WorkflowInstance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => WorkflowTemplate, (template) => template.instances, {
    eager: true,
  })
  @JoinColumn({ name: 'template_id' })
  template: WorkflowTemplate;

  @Column({ name: 'template_id' })
  templateId: string;

  // The entity this workflow is processing (e.g., 'leave_request')
  @Column()
  entityType: string;

  // The ID of the entity being processed
  @Column({ name: 'entity_id' })
  entityId: string;

  @Column({
    type: 'enum',
    enum: WorkflowStatus,
    default: WorkflowStatus.ACTIVE,
  })
  status: WorkflowStatus;

  @Column({ type: 'int', default: 1 })
  currentStepOrder: number;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt: Date;

  @Column({ type: 'text', nullable: true })
  cancellationReason: string;

  // Workflow context data (e.g., original leave request data, calculations)
  @Column({ type: 'jsonb', default: {} })
  context: Record<string, any>;

  // SLA tracking
  @Column({ type: 'timestamp', nullable: true })
  dueAt: Date;

  @Column({ type: 'int', default: 0 })
  escalationCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => ApprovalStep, (step) => step.workflowInstance, {
    cascade: true,
  })
  approvalSteps: ApprovalStep[];

  // Virtual relationship to leave request (if entity type is leave_request)
  @ManyToOne(() => LeaveRequest, { nullable: true })
  @JoinColumn({ name: 'entity_id' })
  leaveRequest?: LeaveRequest;

  // Helper methods
  getCurrentStep(): ApprovalStep | undefined {
    return this.approvalSteps?.find(
      step => step.stepOrder === this.currentStepOrder && step.status === 'PENDING'
    );
  }

  getCompletedSteps(): ApprovalStep[] {
    return this.approvalSteps?.filter(step => step.status === 'APPROVED') || [];
  }

  getPendingSteps(): ApprovalStep[] {
    return this.approvalSteps?.filter(step => step.status === 'PENDING') || [];
  }

  isCompleted(): boolean {
    return this.status === WorkflowStatus.COMPLETED;
  }

  isCancelled(): boolean {
    return this.status === WorkflowStatus.CANCELLED;
  }
}