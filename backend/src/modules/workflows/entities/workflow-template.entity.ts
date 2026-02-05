import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { WorkflowInstance } from './workflow-instance.entity';

export enum WorkflowTrigger {
  LEAVE_REQUEST_CREATED = 'LEAVE_REQUEST_CREATED',
  LEAVE_REQUEST_UPDATED = 'LEAVE_REQUEST_UPDATED',
  ESCALATION_TIMEOUT = 'ESCALATION_TIMEOUT',
}

export enum ApprovalStepType {
  SINGLE_APPROVER = 'SINGLE_APPROVER',
  ANY_OF_MULTIPLE = 'ANY_OF_MULTIPLE',
  ALL_OF_MULTIPLE = 'ALL_OF_MULTIPLE',
  CONDITIONAL = 'CONDITIONAL',
}

export enum ApproverSelectionRule {
  DIRECT_MANAGER = 'DIRECT_MANAGER',
  DEPARTMENT_HEAD = 'DEPARTMENT_HEAD',
  HR_TEAM = 'HR_TEAM',
  SPECIFIC_USER = 'SPECIFIC_USER',
  TEAM_LEAD = 'TEAM_LEAD',
  ANY_MANAGER_IN_DEPARTMENT = 'ANY_MANAGER_IN_DEPARTMENT',
}

@Entity('workflow_templates')
export class WorkflowTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: WorkflowTrigger,
    default: WorkflowTrigger.LEAVE_REQUEST_CREATED,
  })
  trigger: WorkflowTrigger;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 1 })
  version: number;

  // Workflow configuration stored as JSON
  @Column({ type: 'jsonb' })
  stepDefinitions: {
    stepOrder: number;
    stepName: string;
    stepType: ApprovalStepType;
    approverSelectionRule: ApproverSelectionRule;
    specificUserIds?: string[];
    isRequired: boolean;
    timeoutHours?: number;
    escalationRule?: ApproverSelectionRule;
    conditionalLogic?: {
      field: string;
      operator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in';
      value: any;
    };
    autoApprovalRules?: {
      conditions: Array<{
        field: string;
        operator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in';
        value: any;
      }>;
    };
  }[];

  // Business rules for when this template should be used
  @Column({ type: 'jsonb' })
  applicabilityRules: {
    leaveTypes?: string[];
    userRoles?: string[];
    departments?: string[];
    minDuration?: number;
    maxDuration?: number;
    minAdvanceNotice?: number;
    userLevels?: string[];
    teamSizes?: { min?: number; max?: number };
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => WorkflowInstance, (instance) => instance.template)
  instances: WorkflowInstance[];
}