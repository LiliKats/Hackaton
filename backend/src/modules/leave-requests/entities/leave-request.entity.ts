import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { WorkflowInstance } from '../../workflows/entities/workflow-instance.entity';

export enum LeaveType {
  ANNUAL = 'annual',
  SICK = 'sick',
  PERSONAL = 'personal',
  UNPAID = 'unpaid',
  MATERNITY = 'maternity',
  PATERNITY = 'paternity',
  OTHER = 'other',
}

export enum LeaveStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

@Entity('leave_requests')
@Index(['status', 'startDate'])
@Index(['user', 'status'])
export class LeaveRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.leaveRequests)
  user: User;

  @Column({
    type: 'enum',
    enum: LeaveType,
  })
  type: LeaveType;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  @Column({ type: 'float' })
  totalDays: number;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({
    type: 'enum',
    enum: LeaveStatus,
    default: LeaveStatus.PENDING,
  })
  status: LeaveStatus;

  @ManyToOne(() => User, { nullable: true })
  approvedBy: User;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  // Workflow integration
  @OneToOne(() => WorkflowInstance, { nullable: true, cascade: true })
  @JoinColumn({ name: 'workflow_instance_id' })
  workflowInstance: WorkflowInstance;

  @Column({ name: 'workflow_instance_id', nullable: true })
  workflowInstanceId: string;

  // Legacy approval system support (for backward compatibility)
  @Column({ default: false })
  useWorkflowApproval: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods for workflow integration
  hasActiveWorkflow(): boolean {
    return this.workflowInstance && this.workflowInstance.status === 'ACTIVE';
  }

  isWorkflowCompleted(): boolean {
    return this.workflowInstance && this.workflowInstance.status === 'COMPLETED';
  }

  getCurrentApprovalStep(): any {
    return this.workflowInstance?.getCurrentStep();
  }
}
