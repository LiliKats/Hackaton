import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne } from 'typeorm';
import { Exclude } from 'class-transformer';
import { LeaveRequest } from '../../leave-requests/entities/leave-request.entity';
import { Team } from '../../teams/entities/team.entity';

export enum UserRole {
  EMPLOYEE = 'employee',
  MANAGER = 'manager',
  HR = 'hr',
  ADMIN = 'admin',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude()
  password: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.EMPLOYEE,
  })
  role: UserRole;

  @Column({ nullable: true })
  position: string;

  @Column({ nullable: true })
  department: string;

  @Column({ type: 'date', nullable: true })
  hireDate: Date;

  @Column({ type: 'int', default: 20 })
  annualLeaveDays: number;

  @Column({ type: 'float', default: 0 })
  usedLeaveDays: number;

  @Column({ default: true })
  isActive: boolean;

  // Approval authority and delegation fields
  @Column({ type: 'int', nullable: true })
  maxApprovalDays: number; // Maximum leave days this user can approve

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  maxApprovalValue: number; // Maximum financial value for approval

  @Column({ type: 'jsonb', default: {} })
  approvalPermissions: {
    canApproveLeaveTypes?: string[];
    canApproveDepartments?: string[];
    canApproveUserLevels?: string[];
    requiresManagerApproval?: boolean;
    emergencyApprovalOnly?: boolean;
  };

  // Current delegation status
  @Column({ default: false })
  isDelegatingAuthority: boolean;

  @Column({ type: 'timestamp', nullable: true })
  delegationStartDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  delegationEndDate: Date;

  @Column({ type: 'text', nullable: true })
  delegationReason: string;

  // Acting manager assignment
  @ManyToOne(() => User, { nullable: true })
  actingManager: User | null;

  @Column({ type: 'timestamp', nullable: true })
  actingManagerFrom: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  actingManagerTo: Date | null;

  @ManyToOne(() => Team, (team) => team.members, { nullable: true })
  team: Team;

  @ManyToOne(() => User, (user) => user.subordinates, { nullable: true })
  manager: User;

  @OneToMany(() => User, (user) => user.manager)
  subordinates: User[];

  @OneToMany(() => LeaveRequest, (leaveRequest) => leaveRequest.user)
  leaveRequests: LeaveRequest[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods for delegation and approval
  hasApprovalAuthority(): boolean {
    return this.role === UserRole.MANAGER ||
           this.role === UserRole.HR ||
           this.role === UserRole.ADMIN ||
           this.maxApprovalDays > 0;
  }

  isCurrentlyDelegating(): boolean {
    if (!this.isDelegatingAuthority) return false;
    const now = new Date();
    return this.delegationStartDate <= now && this.delegationEndDate >= now;
  }

  hasActingManager(): boolean {
    if (!this.actingManager || !this.actingManagerFrom || !this.actingManagerTo) return false;
    const now = new Date();
    return this.actingManagerFrom <= now && this.actingManagerTo >= now;
  }

  getEffectiveManager(): User | null {
    if (this.hasActingManager() && this.actingManager) {
      return this.actingManager;
    }
    return this.manager;
  }

  canApproveLeaveRequest(leaveType: string, days: number, userDepartment?: string): boolean {
    if (!this.hasApprovalAuthority()) return false;

    // Check maximum days limit
    if (this.maxApprovalDays && days > this.maxApprovalDays) return false;

    // Check leave type permissions
    const permissions = this.approvalPermissions;
    if (permissions.canApproveLeaveTypes &&
        !permissions.canApproveLeaveTypes.includes(leaveType)) {
      return false;
    }

    // Check department permissions
    if (permissions.canApproveDepartments && userDepartment &&
        !permissions.canApproveDepartments.includes(userDepartment)) {
      return false;
    }

    return true;
  }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}
