import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum DelegationStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
  PENDING = 'PENDING',
}

export enum DelegationType {
  FULL_AUTHORITY = 'FULL_AUTHORITY',
  LIMITED_APPROVAL = 'LIMITED_APPROVAL',
  EMERGENCY_ONLY = 'EMERGENCY_ONLY',
  SPECIFIC_DEPARTMENTS = 'SPECIFIC_DEPARTMENTS',
  SPECIFIC_LEAVE_TYPES = 'SPECIFIC_LEAVE_TYPES',
}

@Entity('manager_delegations')
@Index(['delegatedFromId', 'status', 'effectiveFrom', 'effectiveTo'])
@Index(['delegatedToId', 'status', 'effectiveFrom', 'effectiveTo'])
@Index(['status', 'effectiveTo'])
@Check(`"effective_from" <= "effective_to"`)
export class ManagerDelegation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // The manager delegating their authority
  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'delegated_from_id' })
  delegatedFrom: User;

  @Column({ name: 'delegated_from_id' })
  delegatedFromId: string;

  // The person receiving the delegated authority
  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'delegated_to_id' })
  delegatedTo: User;

  @Column({ name: 'delegated_to_id' })
  delegatedToId: string;

  @Column({
    type: 'enum',
    enum: DelegationType,
    default: DelegationType.FULL_AUTHORITY,
  })
  delegationType: DelegationType;

  @Column({
    type: 'enum',
    enum: DelegationStatus,
    default: DelegationStatus.ACTIVE,
  })
  status: DelegationStatus;

  @Column({ type: 'timestamp' })
  effectiveFrom: Date;

  @Column({ type: 'timestamp' })
  effectiveTo: Date;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'text', nullable: true })
  comments: string;

  // Permission scope configuration
  @Column({ type: 'jsonb', default: {} })
  permissions: {
    // Approval limits
    maxLeaveRequestValue?: number;
    maxConsecutiveDays?: number;

    // Allowed leave types
    allowedLeaveTypes?: string[];

    // Department restrictions
    allowedDepartments?: string[];

    // User level restrictions
    allowedUserLevels?: string[];

    // Emergency only flag
    emergencyOnly?: boolean;

    // Specific user restrictions
    allowedUserIds?: string[];
    excludedUserIds?: string[];

    // Team restrictions
    allowedTeamIds?: string[];
  };

  // Auto-transfer settings
  @Column({ default: true })
  shouldTransferPendingApprovals: boolean;

  @Column({ type: 'jsonb', default: [] })
  transferredApprovalIds: string[];

  // Revocation tracking
  @Column({ type: 'timestamp', nullable: true })
  revokedAt: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'revoked_by_id' })
  revokedBy: User;

  @Column({ name: 'revoked_by_id', nullable: true })
  revokedById: string;

  @Column({ type: 'text', nullable: true })
  revocationReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  isActive(): boolean {
    const now = new Date();
    return (
      this.status === DelegationStatus.ACTIVE &&
      this.effectiveFrom <= now &&
      this.effectiveTo >= now
    );
  }

  isExpired(): boolean {
    return this.effectiveTo < new Date() || this.status === DelegationStatus.EXPIRED;
  }

  isRevoked(): boolean {
    return this.status === DelegationStatus.REVOKED;
  }

  canApproveForUser(userId: string): boolean {
    if (!this.isActive()) return false;

    const permissions = this.permissions;

    // Check specific user restrictions
    if (permissions.allowedUserIds && !permissions.allowedUserIds.includes(userId)) {
      return false;
    }

    if (permissions.excludedUserIds && permissions.excludedUserIds.includes(userId)) {
      return false;
    }

    return true;
  }

  canApproveLeaveType(leaveType: string): boolean {
    if (!this.isActive()) return false;

    const permissions = this.permissions;

    // Check leave type restrictions
    if (permissions.allowedLeaveTypes && !permissions.allowedLeaveTypes.includes(leaveType)) {
      return false;
    }

    return true;
  }

  canApproveAmount(days: number): boolean {
    if (!this.isActive()) return false;

    const permissions = this.permissions;

    // Check day limits
    if (permissions.maxConsecutiveDays && days > permissions.maxConsecutiveDays) {
      return false;
    }

    return true;
  }

  getRemainingDuration(): number {
    if (!this.isActive()) return 0;
    return Math.max(0, this.effectiveTo.getTime() - new Date().getTime());
  }

  getRemainingDays(): number {
    return Math.ceil(this.getRemainingDuration() / (1000 * 60 * 60 * 24));
  }
}