import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import {
  ManagerDelegation,
  DelegationStatus,
  DelegationType,
} from './entities/manager-delegation.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { ApprovalStep, ApprovalStepStatus } from '../workflows/entities/approval-step.entity';
import { ApprovalHistory, AuditAction } from '../audit/entities/approval-history.entity';

export interface CreateDelegationDto {
  delegatedFromId: string;
  delegatedToId: string;
  delegationType: DelegationType;
  effectiveFrom: Date;
  effectiveTo: Date;
  reason?: string;
  comments?: string;
  permissions?: {
    maxLeaveRequestValue?: number;
    maxConsecutiveDays?: number;
    allowedLeaveTypes?: string[];
    allowedDepartments?: string[];
    allowedUserLevels?: string[];
    emergencyOnly?: boolean;
    allowedUserIds?: string[];
    excludedUserIds?: string[];
    allowedTeamIds?: string[];
  };
  shouldTransferPendingApprovals?: boolean;
}

export interface DelegationValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface DelegationTransferResult {
  transferredCount: number;
  transferredApprovalIds: string[];
  failedTransfers: Array<{
    approvalId: string;
    reason: string;
  }>;
}

@Injectable()
export class DelegationService {
  private readonly logger = new Logger(DelegationService.name);

  constructor(
    @InjectRepository(ManagerDelegation)
    private delegationRepository: Repository<ManagerDelegation>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(ApprovalStep)
    private approvalStepRepository: Repository<ApprovalStep>,
    @InjectRepository(ApprovalHistory)
    private auditRepository: Repository<ApprovalHistory>,
  ) {}

  /**
   * Creates a new manager delegation
   */
  async createDelegation(dto: CreateDelegationDto): Promise<ManagerDelegation> {
    this.logger.log(`Creating delegation from ${dto.delegatedFromId} to ${dto.delegatedToId}`);

    // Validate the delegation request
    const validation = await this.validateDelegationRequest(dto);
    if (!validation.isValid) {
      throw new BadRequestException(`Delegation validation failed: ${validation.errors.join(', ')}`);
    }

    // Log warnings if any
    if (validation.warnings.length > 0) {
      this.logger.warn(`Delegation warnings: ${validation.warnings.join(', ')}`);
    }

    return await this.delegationRepository.manager.transaction(async (manager) => {
      // Check for overlapping delegations and resolve conflicts
      await this.resolveOverlappingDelegations(manager, dto);

      // Create the delegation
      const delegation = this.delegationRepository.create({
        ...dto,
        status: DelegationStatus.ACTIVE,
        permissions: dto.permissions || {},
        shouldTransferPendingApprovals: dto.shouldTransferPendingApprovals ?? true,
      });

      const savedDelegation = await manager.save(ManagerDelegation, delegation);

      // Transfer pending approvals if requested
      if (dto.shouldTransferPendingApprovals) {
        const transferResult = await this.transferPendingApprovals(
          manager,
          dto.delegatedFromId,
          dto.delegatedToId,
          savedDelegation.id,
        );

        savedDelegation.transferredApprovalIds = transferResult.transferredApprovalIds;
        await manager.save(ManagerDelegation, savedDelegation);

        this.logger.log(
          `Transferred ${transferResult.transferredCount} pending approvals from ${dto.delegatedFromId} to ${dto.delegatedToId}`
        );
      }

      // Update user delegation status
      await this.updateUserDelegationStatus(manager, dto.delegatedFromId, true, dto.effectiveFrom, dto.effectiveTo, dto.reason);

      // Create audit entry
      await this.createDelegationAuditEntry(manager, savedDelegation, AuditAction.STEP_DELEGATED);

      this.logger.log(`Successfully created delegation ${savedDelegation.id}`);
      return savedDelegation;
    });
  }

  /**
   * Revokes an active delegation
   */
  async revokeDelegation(
    delegationId: string,
    revokedById: string,
    reason: string,
  ): Promise<ManagerDelegation> {
    this.logger.log(`Revoking delegation ${delegationId} by user ${revokedById}`);

    const delegation = await this.delegationRepository.findOne({
      where: { id: delegationId },
      relations: ['delegatedFrom', 'delegatedTo'],
    });

    if (!delegation) {
      throw new NotFoundException(`Delegation ${delegationId} not found`);
    }

    if (delegation.status !== DelegationStatus.ACTIVE) {
      throw new BadRequestException(`Cannot revoke delegation with status: ${delegation.status}`);
    }

    // Validate revocation permissions
    await this.validateRevocationPermissions(delegation, revokedById);

    return await this.delegationRepository.manager.transaction(async (manager) => {
      // Update delegation status
      delegation.status = DelegationStatus.REVOKED;
      delegation.revokedAt = new Date();
      delegation.revokedById = revokedById;
      delegation.revocationReason = reason;

      await manager.save(ManagerDelegation, delegation);

      // Transfer approvals back to original delegator (if still valid)
      if (delegation.transferredApprovalIds.length > 0) {
        await this.transferApprovalsBack(
          manager,
          delegation.delegatedToId,
          delegation.delegatedFromId,
          delegation.transferredApprovalIds,
          delegationId,
        );
      }

      // Update user delegation status
      await this.updateUserDelegationStatus(
        manager,
        delegation.delegatedFromId,
        false,
      );

      // Create audit entry
      await this.createDelegationAuditEntry(manager, delegation, AuditAction.STEP_ESCALATED, {
        performedById: revokedById,
        comments: reason,
      });

      this.logger.log(`Successfully revoked delegation ${delegationId}`);
      return delegation;
    });
  }

  /**
   * Gets all active delegations for a user (both delegated from and to)
   */
  async getUserDelegations(userId: string): Promise<{
    delegatedFrom: ManagerDelegation[];
    delegatedTo: ManagerDelegation[];
  }> {
    const now = new Date();

    const [delegatedFrom, delegatedTo] = await Promise.all([
      this.delegationRepository.find({
        where: {
          delegatedFromId: userId,
          status: DelegationStatus.ACTIVE,
          effectiveFrom: LessThanOrEqual(now),
          effectiveTo: MoreThanOrEqual(now),
        },
        relations: ['delegatedTo'],
        order: { effectiveFrom: 'DESC' },
      }),
      this.delegationRepository.find({
        where: {
          delegatedToId: userId,
          status: DelegationStatus.ACTIVE,
          effectiveFrom: LessThanOrEqual(now),
          effectiveTo: MoreThanOrEqual(now),
        },
        relations: ['delegatedFrom'],
        order: { effectiveFrom: 'DESC' },
      }),
    ]);

    return { delegatedFrom, delegatedTo };
  }

  /**
   * Gets all active delegations for a date range
   */
  async getDelegationsInRange(startDate: Date, endDate: Date): Promise<ManagerDelegation[]> {
    return await this.delegationRepository.find({
      where: {
        status: DelegationStatus.ACTIVE,
        effectiveFrom: LessThanOrEqual(endDate),
        effectiveTo: MoreThanOrEqual(startDate),
      },
      relations: ['delegatedFrom', 'delegatedTo'],
      order: { effectiveFrom: 'ASC' },
    });
  }

  /**
   * Finds the effective approver considering active delegations
   */
  async getEffectiveApprover(originalApproverId: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { id: originalApproverId },
    });

    if (!user) {
      return null;
    }

    // Check if user has active delegations
    const activeDelegations = await this.getActiveDelegationsFrom(originalApproverId);

    if (activeDelegations.length > 0) {
      // Return the most recent delegate
      const mostRecentDelegation = activeDelegations[0];
      return mostRecentDelegation.delegatedTo;
    }

    return user;
  }

  /**
   * Validates if a delegate can approve a specific request
   */
  async validateDelegateApproval(
    delegationId: string,
    approverId: string,
    leaveRequestData: {
      userId: string;
      leaveType: string;
      totalDays: number;
      department?: string;
    },
  ): Promise<DelegationValidationResult> {
    const delegation = await this.delegationRepository.findOne({
      where: { id: delegationId },
      relations: ['delegatedTo'],
    });

    if (!delegation) {
      return {
        isValid: false,
        errors: ['Delegation not found'],
        warnings: [],
      };
    }

    if (!delegation.isActive()) {
      return {
        isValid: false,
        errors: ['Delegation is not active'],
        warnings: [],
      };
    }

    if (delegation.delegatedToId !== approverId) {
      return {
        isValid: false,
        errors: ['User is not the delegate for this delegation'],
        warnings: [],
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if delegation can approve for this user
    if (!delegation.canApproveForUser(leaveRequestData.userId)) {
      errors.push('Delegation does not allow approval for this user');
    }

    // Check leave type permissions
    if (!delegation.canApproveLeaveType(leaveRequestData.leaveType)) {
      errors.push(`Delegation does not allow approval for leave type: ${leaveRequestData.leaveType}`);
    }

    // Check amount limits
    if (!delegation.canApproveAmount(leaveRequestData.totalDays)) {
      errors.push(`Delegation does not allow approval for ${leaveRequestData.totalDays} days`);
    }

    // Check if delegation is nearing expiration
    const hoursRemaining = delegation.getRemainingDuration() / (1000 * 60 * 60);
    if (hoursRemaining < 24) {
      warnings.push(`Delegation expires in ${Math.round(hoursRemaining)} hours`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Automatically expires delegations that have passed their end date
   */
  async expireDelegations(): Promise<number> {
    const now = new Date();
    const expiredDelegations = await this.delegationRepository.find({
      where: {
        status: DelegationStatus.ACTIVE,
        effectiveTo: LessThanOrEqual(now),
      },
    });

    let expiredCount = 0;

    for (const delegation of expiredDelegations) {
      try {
        await this.delegationRepository.manager.transaction(async (manager) => {
          delegation.status = DelegationStatus.EXPIRED;
          await manager.save(ManagerDelegation, delegation);

          // Update user delegation status
          await this.updateUserDelegationStatus(
            manager,
            delegation.delegatedFromId,
            false,
          );

          // Transfer approvals back if necessary
          if (delegation.transferredApprovalIds.length > 0) {
            await this.transferApprovalsBack(
              manager,
              delegation.delegatedToId,
              delegation.delegatedFromId,
              delegation.transferredApprovalIds,
              delegation.id,
            );
          }

          expiredCount++;
        });

        this.logger.log(`Expired delegation ${delegation.id}`);
      } catch (error) {
        this.logger.error(`Failed to expire delegation ${delegation.id}: ${error.message}`);
      }
    }

    if (expiredCount > 0) {
      this.logger.log(`Expired ${expiredCount} delegations`);
    }

    return expiredCount;
  }

  // Private helper methods

  private async validateDelegationRequest(dto: CreateDelegationDto): Promise<DelegationValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate users exist
    const [delegatedFrom, delegatedTo] = await Promise.all([
      this.userRepository.findOne({ where: { id: dto.delegatedFromId } }),
      this.userRepository.findOne({ where: { id: dto.delegatedToId } }),
    ]);

    if (!delegatedFrom) {
      errors.push(`Delegating user ${dto.delegatedFromId} not found`);
    } else if (!delegatedFrom.isActive) {
      errors.push(`Delegating user ${delegatedFrom.fullName} is not active`);
    }

    if (!delegatedTo) {
      errors.push(`Delegate user ${dto.delegatedToId} not found`);
    } else if (!delegatedTo.isActive) {
      errors.push(`Delegate user ${delegatedTo.fullName} is not active`);
    }

    // Prevent self-delegation
    if (dto.delegatedFromId === dto.delegatedToId) {
      errors.push('Cannot delegate to yourself');
    }

    // Validate date range
    if (dto.effectiveFrom >= dto.effectiveTo) {
      errors.push('Effective from date must be before effective to date');
    }

    if (dto.effectiveFrom < new Date()) {
      warnings.push('Delegation effective from date is in the past');
    }

    // Validate delegation period (max 1 year)
    const maxDuration = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
    if (dto.effectiveTo.getTime() - dto.effectiveFrom.getTime() > maxDuration) {
      warnings.push('Delegation period exceeds 1 year');
    }

    // Check if delegated user has approval authority
    if (delegatedFrom && !delegatedFrom.hasApprovalAuthority()) {
      warnings.push(`${delegatedFrom.fullName} does not have approval authority to delegate`);
    }

    // Check if delegate has sufficient authority
    if (delegatedTo && delegatedFrom) {
      if (delegatedTo.role === UserRole.EMPLOYEE && dto.delegationType === DelegationType.FULL_AUTHORITY) {
        warnings.push(`Delegating full authority to an employee (${delegatedTo.fullName})`);
      }
    }

    // Check for circular delegations
    if (await this.hasCircularDelegation(dto.delegatedFromId, dto.delegatedToId, dto.effectiveFrom, dto.effectiveTo)) {
      errors.push('This would create a circular delegation chain');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private async hasCircularDelegation(
    delegatedFromId: string,
    delegatedToId: string,
    effectiveFrom: Date,
    effectiveTo: Date,
  ): Promise<boolean> {
    // Check if delegatedTo has any active delegations back to delegatedFrom or their chain
    const checkChain = async (currentUserId: string, visited: Set<string>): Promise<boolean> => {
      if (visited.has(currentUserId)) {
        return currentUserId === delegatedFromId;
      }

      visited.add(currentUserId);

      const delegations = await this.delegationRepository.find({
        where: {
          delegatedFromId: currentUserId,
          status: DelegationStatus.ACTIVE,
          effectiveFrom: LessThanOrEqual(effectiveTo),
          effectiveTo: MoreThanOrEqual(effectiveFrom),
        },
      });

      for (const delegation of delegations) {
        if (await checkChain(delegation.delegatedToId, new Set(visited))) {
          return true;
        }
      }

      return false;
    };

    return await checkChain(delegatedToId, new Set());
  }

  private async resolveOverlappingDelegations(
    manager: EntityManager,
    dto: CreateDelegationDto,
  ): Promise<void> {
    // Find overlapping delegations from the same user
    const overlappingDelegations = await manager.find(ManagerDelegation, {
      where: {
        delegatedFromId: dto.delegatedFromId,
        status: DelegationStatus.ACTIVE,
        effectiveFrom: LessThanOrEqual(dto.effectiveTo),
        effectiveTo: MoreThanOrEqual(dto.effectiveFrom),
      },
    });

    // For now, we'll end overlapping delegations early
    // In a more sophisticated system, you might handle partial overlaps differently
    for (const overlapping of overlappingDelegations) {
      if (overlapping.effectiveFrom < dto.effectiveFrom) {
        // Shorten the existing delegation
        overlapping.effectiveTo = dto.effectiveFrom;
        await manager.save(ManagerDelegation, overlapping);
        this.logger.log(`Shortened overlapping delegation ${overlapping.id}`);
      } else {
        // Cancel the overlapping delegation
        overlapping.status = DelegationStatus.REVOKED;
        overlapping.revokedAt = new Date();
        overlapping.revocationReason = 'Superseded by new delegation';
        await manager.save(ManagerDelegation, overlapping);
        this.logger.log(`Revoked overlapping delegation ${overlapping.id}`);
      }
    }
  }

  private async transferPendingApprovals(
    manager: EntityManager,
    fromUserId: string,
    toUserId: string,
    delegationId: string,
  ): Promise<DelegationTransferResult> {
    const pendingSteps = await manager.find(ApprovalStep, {
      where: {
        assignedUserId: fromUserId,
        status: ApprovalStepStatus.PENDING,
      },
      relations: ['workflowInstance'],
    });

    const transferredApprovalIds: string[] = [];
    const failedTransfers: Array<{ approvalId: string; reason: string }> = [];

    for (const step of pendingSteps) {
      try {
        // Update the assigned user
        step.originalAssigneeId = fromUserId;
        step.assignedUserId = toUserId;
        step.delegationId = delegationId;

        await manager.save(ApprovalStep, step);

        // Create audit entry
        const auditEntry = this.auditRepository.create({
          approvalStepId: step.id,
          action: AuditAction.STEP_DELEGATED,
          description: 'Approval transferred due to delegation',
          affectedUserId: toUserId,
          entityType: step.workflowInstance.entityType,
          entityId: step.workflowInstance.entityId,
          metadata: {
            delegationId,
            originalAssigneeId: fromUserId,
            transferReason: 'delegation_created',
          },
        });

        await manager.save(ApprovalHistory, auditEntry);

        transferredApprovalIds.push(step.id);
      } catch (error) {
        this.logger.error(`Failed to transfer approval ${step.id}: ${error.message}`);
        failedTransfers.push({
          approvalId: step.id,
          reason: error.message,
        });
      }
    }

    return {
      transferredCount: transferredApprovalIds.length,
      transferredApprovalIds,
      failedTransfers,
    };
  }

  private async transferApprovalsBack(
    manager: EntityManager,
    fromUserId: string,
    toUserId: string,
    approvalIds: string[],
    delegationId: string,
  ): Promise<void> {
    const steps = await manager.find(ApprovalStep, {
      where: {
        id: In(approvalIds),
        status: ApprovalStepStatus.PENDING,
      },
      relations: ['workflowInstance'],
    });

    for (const step of steps) {
      try {
        step.assignedUserId = toUserId;
        step.delegationId = null;

        await manager.save(ApprovalStep, step);

        // Create audit entry
        const auditEntry = this.auditRepository.create({
          approvalStepId: step.id,
          action: AuditAction.STEP_DELEGATED,
          description: 'Approval transferred back from delegation',
          affectedUserId: toUserId,
          entityType: step.workflowInstance.entityType,
          entityId: step.workflowInstance.entityId,
          metadata: {
            delegationId,
            transferBackReason: 'delegation_ended',
          },
        });

        await manager.save(ApprovalHistory, auditEntry);
      } catch (error) {
        this.logger.error(`Failed to transfer approval ${step.id} back: ${error.message}`);
      }
    }
  }

  private async updateUserDelegationStatus(
    manager: EntityManager,
    userId: string,
    isDelegating: boolean,
    startDate?: Date,
    endDate?: Date,
    reason?: string,
  ): Promise<void> {
    const updateData: Partial<User> = {
      isDelegatingAuthority: isDelegating,
      delegationStartDate: startDate,
      delegationEndDate: endDate,
      delegationReason: reason,
    };

    await manager.update(User, { id: userId }, updateData);
  }

  private async validateRevocationPermissions(
    delegation: ManagerDelegation,
    revokedById: string,
  ): Promise<void> {
    const revoker = await this.userRepository.findOne({
      where: { id: revokedById },
    });

    if (!revoker) {
      throw new NotFoundException(`User ${revokedById} not found`);
    }

    // Only the delegator, delegate, or an admin/HR can revoke
    const canRevoke =
      delegation.delegatedFromId === revokedById ||
      delegation.delegatedToId === revokedById ||
      revoker.role === UserRole.ADMIN ||
      revoker.role === UserRole.HR;

    if (!canRevoke) {
      throw new BadRequestException(
        `User ${revoker.fullName} does not have permission to revoke this delegation`
      );
    }
  }

  private async getActiveDelegationsFrom(userId: string): Promise<ManagerDelegation[]> {
    const now = new Date();
    return await this.delegationRepository.find({
      where: {
        delegatedFromId: userId,
        status: DelegationStatus.ACTIVE,
        effectiveFrom: LessThanOrEqual(now),
        effectiveTo: MoreThanOrEqual(now),
      },
      relations: ['delegatedTo'],
      order: { effectiveFrom: 'DESC' },
    });
  }

  private async createDelegationAuditEntry(
    manager: EntityManager,
    delegation: ManagerDelegation,
    action: AuditAction,
    additionalData?: Partial<ApprovalHistory>,
  ): Promise<void> {
    const auditEntry = this.auditRepository.create({
      action,
      description: `Manager delegation ${action.toLowerCase()}`,
      performedById: delegation.delegatedFromId,
      affectedUserId: delegation.delegatedToId,
      entityType: 'manager_delegation',
      entityId: delegation.id,
      metadata: {
        delegationType: delegation.delegationType,
        effectiveFrom: delegation.effectiveFrom,
        effectiveTo: delegation.effectiveTo,
        reason: delegation.reason,
      },
      ...additionalData,
    });

    await manager.save(ApprovalHistory, auditEntry);
  }
}

// Import for array operations
import { In } from 'typeorm';