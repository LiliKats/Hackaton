import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, LessThanOrEqual, MoreThanOrEqual, In, Not, IsNull } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import { ApprovalStep, ApprovalStepStatus } from '../workflows/entities/approval-step.entity';
import { ApprovalHistory, AuditAction } from '../audit/entities/approval-history.entity';
import { Team } from '../teams/entities/team.entity';

export interface ActingManagerAssignment {
  managerId: string;
  actingManagerId: string;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  reason: string;
  scope: 'full' | 'approval_only' | 'specific_users' | 'specific_teams';
  scopeDetails?: {
    userIds?: string[];
    teamIds?: string[];
    departmentIds?: string[];
    maxApprovalValue?: number;
  };
}

export interface ActingManagerValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  conflictingAssignments?: ActingManagerAssignment[];
}

export interface AssignmentTransferResult {
  transferredApprovals: number;
  transferredSubordinates: number;
  notificationsCreated: number;
  errors: string[];
}

@Injectable()
export class ActingManagerService {
  private readonly logger = new Logger(ActingManagerService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Team)
    private teamRepository: Repository<Team>,
    @InjectRepository(ApprovalStep)
    private approvalStepRepository: Repository<ApprovalStep>,
    @InjectRepository(ApprovalHistory)
    private auditRepository: Repository<ApprovalHistory>,
  ) {}

  /**
   * Assigns an acting manager to cover for an absent manager
   */
  async assignActingManager(assignment: ActingManagerAssignment): Promise<User> {
    this.logger.log(
      `Assigning acting manager ${assignment.actingManagerId} for manager ${assignment.managerId}`
    );

    // Validate the assignment
    const validation = await this.validateActingManagerAssignment(assignment);
    if (!validation.isValid) {
      throw new BadRequestException(`Acting manager assignment validation failed: ${validation.errors.join(', ')}`);
    }

    return await this.userRepository.manager.transaction(async (manager) => {
      // Get the manager and acting manager
      const [managerUser, actingManager] = await Promise.all([
        manager.findOne(User, {
          where: { id: assignment.managerId },
          relations: ['subordinates', 'team']
        }),
        manager.findOne(User, {
          where: { id: assignment.actingManagerId },
          relations: ['subordinates']
        }),
      ]);

      if (!managerUser || !actingManager) {
        throw new NotFoundException('Manager or acting manager not found');
      }

      // Handle conflicting assignments
      await this.resolveConflictingAssignments(manager, assignment, validation.conflictingAssignments || []);

      // Update manager to indicate they have an acting manager
      managerUser.actingManager = actingManager;
      managerUser.actingManagerFrom = assignment.effectiveFrom;
      managerUser.actingManagerTo = assignment.effectiveTo;

      await manager.save(User, managerUser);

      // Transfer responsibilities
      const transferResult = await this.transferManagerResponsibilities(
        manager,
        managerUser,
        actingManager,
        assignment
      );

      // Create audit entry
      await this.createActingManagerAuditEntry(manager, assignment, 'assigned', transferResult);

      this.logger.log(
        `Successfully assigned acting manager ${actingManager.fullName} for ${managerUser.fullName}. ` +
        `Transferred ${transferResult.transferredApprovals} approvals and ${transferResult.transferredSubordinates} subordinates.`
      );

      return actingManager;
    });
  }

  /**
   * Removes an acting manager assignment and restores original responsibilities
   */
  async removeActingManager(
    managerId: string,
    removedById: string,
    reason: string,
  ): Promise<void> {
    this.logger.log(`Removing acting manager for manager ${managerId}`);

    const manager = await this.userRepository.findOne({
      where: { id: managerId },
      relations: ['actingManager', 'subordinates'],
    });

    if (!manager) {
      throw new NotFoundException(`Manager ${managerId} not found`);
    }

    if (!manager.hasActingManager()) {
      throw new BadRequestException(`Manager ${manager.fullName} does not have an acting manager assigned`);
    }

    await this.userRepository.manager.transaction(async (entityManager) => {
      // Store the acting manager info before clearing
      const actingManagerInfo = {
        actingManagerId: manager.actingManager?.id || '',
        effectiveFrom: manager.actingManagerFrom || new Date(),
        effectiveTo: manager.actingManagerTo || new Date(),
      };

      // Restore original responsibilities
      let restoreResult = { transferredApprovals: 0, transferredSubordinates: 0, notificationsCreated: 0, errors: [] as string[] };
      if (manager.actingManager) {
        restoreResult = await this.restoreManagerResponsibilities(
          entityManager,
          manager,
          manager.actingManager,
        );
      }

      // Clear acting manager assignment
      manager.actingManager = null;
      manager.actingManagerFrom = null;
      manager.actingManagerTo = null;

      await entityManager.save(User, manager);

      // Create audit entry
      await this.createActingManagerAuditEntry(
        entityManager,
        {
          managerId,
          actingManagerId: actingManagerInfo.actingManagerId,
          effectiveFrom: actingManagerInfo.effectiveFrom,
          effectiveTo: actingManagerInfo.effectiveTo,
          reason,
          scope: 'full',
        },
        'removed',
        restoreResult,
        removedById
      );

      this.logger.log(
        `Successfully removed acting manager for ${manager.fullName}. ` +
        `Restored ${restoreResult.transferredApprovals} approvals and ${restoreResult.transferredSubordinates} subordinates.`
      );
    });
  }

  /**
   * Gets all active acting manager assignments
   */
  async getActiveActingManagers(): Promise<User[]> {
    const now = new Date();

    return await this.userRepository.find({
      where: {
        actingManagerFrom: LessThanOrEqual(now),
        actingManagerTo: MoreThanOrEqual(now),
        isActive: true,
      },
      relations: ['actingManager', 'subordinates'],
    });
  }

  /**
   * Gets users who are currently acting as managers for others
   */
  async getCurrentActingManagers(): Promise<User[]> {
    const now = new Date();

    // Find users who are assigned as acting managers
    const actingManagerIds = await this.userRepository
      .createQueryBuilder('user')
      .select('user.acting_manager_id')
      .where('user.acting_manager_from <= :now', { now })
      .andWhere('user.acting_manager_to >= :now', { now })
      .andWhere('user.acting_manager_id IS NOT NULL')
      .getRawMany();

    const ids = actingManagerIds
      .map(row => row.acting_manager_id)
      .filter(id => id);

    if (ids.length === 0) {
      return [];
    }

    return await this.userRepository.find({
      where: { id: In(ids) },
      relations: ['subordinates'],
    });
  }

  /**
   * Finds suitable acting manager candidates for a given manager
   */
  async findActingManagerCandidates(
    managerId: string,
    excludeUserIds: string[] = [],
  ): Promise<User[]> {
    const manager = await this.userRepository.findOne({
      where: { id: managerId },
      relations: ['manager', 'team', 'subordinates'],
    });

    if (!manager) {
      throw new NotFoundException(`Manager ${managerId} not found`);
    }

    const candidates: User[] = [];
    const excludeIds = new Set([...excludeUserIds, managerId]);

    // 1. Manager's manager (if they have one)
    if (manager.manager && !excludeIds.has(manager.manager.id)) {
      candidates.push(manager.manager);
      excludeIds.add(manager.manager.id);
    }

    // 2. Peer managers in the same department
    if (manager.department) {
      const peerManagers = await this.userRepository.find({
        where: {
          department: manager.department,
          role: UserRole.MANAGER,
          isActive: true,
        },
      });

      for (const peer of peerManagers) {
        if (!excludeIds.has(peer.id)) {
          candidates.push(peer);
          excludeIds.add(peer.id);
        }
      }
    }

    // 3. Team leads if the manager is part of a team
    if (manager.team) {
      const teamLead = manager.team.lead;
      if (teamLead && !excludeIds.has(teamLead.id)) {
        candidates.push(teamLead);
        excludeIds.add(teamLead.id);
      }
    }

    // 4. Senior team members who have approval authority
    const seniorTeamMembers = await this.userRepository.find({
      where: {
        department: manager.department,
        isActive: true,
      },
    });

    for (const member of seniorTeamMembers) {
      if (!excludeIds.has(member.id) &&
          member.hasApprovalAuthority() &&
          candidates.length < 10) { // Limit to 10 candidates
        candidates.push(member);
        excludeIds.add(member.id);
      }
    }

    // Sort candidates by suitability score
    return this.rankActingManagerCandidates(candidates, manager);
  }

  /**
   * Validates an acting manager assignment
   */
  async validateActingManagerAssignment(
    assignment: ActingManagerAssignment,
  ): Promise<ActingManagerValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate users exist
    const [manager, actingManager] = await Promise.all([
      this.userRepository.findOne({ where: { id: assignment.managerId } }),
      this.userRepository.findOne({ where: { id: assignment.actingManagerId } }),
    ]);

    if (!manager) {
      errors.push(`Manager ${assignment.managerId} not found`);
    } else if (!manager.isActive) {
      errors.push(`Manager ${manager.fullName} is not active`);
    } else if (!manager.hasApprovalAuthority()) {
      warnings.push(`Manager ${manager.fullName} does not have approval authority`);
    }

    if (!actingManager) {
      errors.push(`Acting manager ${assignment.actingManagerId} not found`);
    } else if (!actingManager.isActive) {
      errors.push(`Acting manager ${actingManager.fullName} is not active`);
    }

    // Prevent self-assignment
    if (assignment.managerId === assignment.actingManagerId) {
      errors.push('Cannot assign a user as their own acting manager');
    }

    // Validate date range
    if (assignment.effectiveFrom && assignment.effectiveTo && assignment.effectiveFrom >= assignment.effectiveTo) {
      errors.push('Effective from date must be before effective to date');
    }

    if (assignment.effectiveFrom && assignment.effectiveFrom < new Date()) {
      warnings.push('Acting manager assignment effective from date is in the past');
    }

    // Check for conflicting assignments
    const conflictingAssignments = await this.findConflictingAssignments(assignment);
    if (conflictingAssignments.length > 0) {
      warnings.push(`Found ${conflictingAssignments.length} conflicting acting manager assignments`);
    }

    // Check if acting manager is already overloaded
    if (actingManager) {
      const currentAssignments = await this.getActingManagerLoad(assignment.actingManagerId);
      if (currentAssignments >= 3) {
        warnings.push(`${actingManager.fullName} is already acting manager for ${currentAssignments} others`);
      }
    }

    // Validate scope
    if (assignment.scope === 'specific_users' || assignment.scope === 'specific_teams') {
      if (!assignment.scopeDetails?.userIds?.length && !assignment.scopeDetails?.teamIds?.length) {
        errors.push('Scope details must be provided for specific user or team assignments');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      conflictingAssignments,
    };
  }

  /**
   * Gets the workload of an acting manager (how many people they're acting for)
   */
  async getActingManagerLoad(actingManagerId: string): Promise<number> {
    const now = new Date();

    const count = await this.userRepository.count({
      where: {
        actingManager: { id: actingManagerId },
        actingManagerFrom: LessThanOrEqual(now),
        actingManagerTo: MoreThanOrEqual(now),
      },
    });

    return count;
  }

  /**
   * Automatically expires acting manager assignments that have ended
   */
  async expireActingManagerAssignments(): Promise<number> {
    const now = new Date();
    const expiredAssignments = await this.userRepository.find({
      where: {
        actingManagerTo: LessThanOrEqual(now),
        actingManager: Not(IsNull()),
      },
      relations: ['actingManager'],
    });

    let expiredCount = 0;

    for (const manager of expiredAssignments) {
      try {
        await this.removeActingManager(manager.id, 'system', 'Assignment period expired');
        expiredCount++;
      } catch (error) {
        this.logger.error(`Failed to expire acting manager assignment for ${manager.id}: ${error.message}`);
      }
    }

    if (expiredCount > 0) {
      this.logger.log(`Expired ${expiredCount} acting manager assignments`);
    }

    return expiredCount;
  }

  // Private helper methods

  private async findConflictingAssignments(
    assignment: ActingManagerAssignment,
  ): Promise<ActingManagerAssignment[]> {
    // For simplicity, we'll check if the acting manager is already assigned to someone else in the same period
    if (!assignment.effectiveFrom || !assignment.effectiveTo) {
      return [];
    }

    const conflicting = await this.userRepository.find({
      where: {
        actingManager: { id: assignment.actingManagerId },
        actingManagerFrom: LessThanOrEqual(assignment.effectiveTo),
        actingManagerTo: MoreThanOrEqual(assignment.effectiveFrom),
      },
      relations: ['actingManager'],
    });

    return conflicting.map(user => ({
      managerId: user.id,
      actingManagerId: assignment.actingManagerId,
      effectiveFrom: user.actingManagerFrom,
      effectiveTo: user.actingManagerTo,
      reason: 'Existing assignment',
      scope: 'full' as const,
    }));
  }

  private async resolveConflictingAssignments(
    manager: EntityManager,
    assignment: ActingManagerAssignment,
    conflictingAssignments: ActingManagerAssignment[],
  ): Promise<void> {
    for (const conflict of conflictingAssignments) {
      // For now, we'll shorten or end the conflicting assignment
      // In a real system, you might want more sophisticated conflict resolution
      const conflictingUser = await manager.findOne(User, {
        where: { id: conflict.managerId },
      });

      if (conflictingUser) {
        if (conflictingUser.actingManagerFrom && assignment.effectiveFrom &&
            conflictingUser.actingManagerFrom < assignment.effectiveFrom) {
          // Shorten the existing assignment
          conflictingUser.actingManagerTo = assignment.effectiveFrom;
          await manager.save(User, conflictingUser);
          this.logger.log(`Shortened conflicting acting manager assignment for user ${conflict.managerId}`);
        } else {
          // Remove the conflicting assignment
          conflictingUser.actingManager = null;
          conflictingUser.actingManagerFrom = null;
          conflictingUser.actingManagerTo = null;
          await manager.save(User, conflictingUser);
          this.logger.log(`Removed conflicting acting manager assignment for user ${conflict.managerId}`);
        }
      }
    }
  }

  private async transferManagerResponsibilities(
    manager: EntityManager,
    originalManager: User,
    actingManager: User,
    assignment: ActingManagerAssignment,
  ): Promise<AssignmentTransferResult> {
    let transferredApprovals = 0;
    let transferredSubordinates = 0;
    const errors: string[] = [];

    try {
      // Transfer pending approvals
      const pendingApprovals = await manager.find(ApprovalStep, {
        where: {
          assignedUserId: originalManager.id,
          status: ApprovalStepStatus.PENDING,
        },
      });

      for (const approval of pendingApprovals) {
        try {
          approval.originalAssigneeId = originalManager.id;
          approval.assignedUserId = actingManager.id;
          await manager.save(ApprovalStep, approval);

          // Create audit entry for the transfer
          const auditEntry = this.auditRepository.create({
            approvalStepId: approval.id,
            action: AuditAction.STEP_DELEGATED,
            description: 'Approval transferred to acting manager',
            performedById: originalManager.id,
            affectedUserId: actingManager.id,
            entityType: approval.workflowInstance?.entityType || 'approval',
            entityId: approval.workflowInstance?.entityId || approval.id,
            metadata: {
              originalAssigneeId: originalManager.id,
            },
          });

          await manager.save(ApprovalHistory, auditEntry);
          transferredApprovals++;
        } catch (error) {
          errors.push(`Failed to transfer approval ${approval.id}: ${error.message}`);
        }
      }

      // Note: We don't actually change the manager field for subordinates
      // as that would affect organizational hierarchy. The acting manager
      // just gets temporary approval authority over them.
      transferredSubordinates = originalManager.subordinates?.length || 0;

    } catch (error) {
      errors.push(`Failed to transfer responsibilities: ${error.message}`);
    }

    return {
      transferredApprovals,
      transferredSubordinates,
      notificationsCreated: 0, // TODO: Implement notification system
      errors,
    };
  }

  private async restoreManagerResponsibilities(
    manager: EntityManager,
    originalManager: User,
    actingManager: User,
  ): Promise<AssignmentTransferResult> {
    let transferredApprovals = 0;
    const errors: string[] = [];

    try {
      // Transfer approvals back to original manager
      const actingApprovals = await manager.find(ApprovalStep, {
        where: {
          assignedUserId: actingManager.id,
          originalAssigneeId: originalManager.id,
          status: ApprovalStepStatus.PENDING,
        },
      });

      for (const approval of actingApprovals) {
        try {
          approval.assignedUserId = originalManager.id;
          approval.originalAssigneeId = null;
          await manager.save(ApprovalStep, approval);

          // Create audit entry for the restoration
          const auditEntry = this.auditRepository.create({
            approvalStepId: approval.id,
            action: AuditAction.STEP_DELEGATED,
            description: 'Approval restored from acting manager',
            performedById: actingManager.id,
            affectedUserId: originalManager.id,
            entityType: approval.workflowInstance?.entityType || 'approval',
            entityId: approval.workflowInstance?.entityId || approval.id,
            metadata: {
              originalAssigneeId: originalManager.id,
            },
          });

          await manager.save(ApprovalHistory, auditEntry);
          transferredApprovals++;
        } catch (error) {
          errors.push(`Failed to restore approval ${approval.id}: ${error.message}`);
        }
      }

    } catch (error) {
      errors.push(`Failed to restore responsibilities: ${error.message}`);
    }

    return {
      transferredApprovals,
      transferredSubordinates: 0,
      notificationsCreated: 0,
      errors,
    };
  }

  private rankActingManagerCandidates(candidates: User[], manager: User): User[] {
    return candidates.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      // Same department gets higher score
      if (a.department === manager.department) scoreA += 10;
      if (b.department === manager.department) scoreB += 10;

      // Higher role gets higher score
      const roleScore: Record<UserRole, number> = {
        [UserRole.ADMIN]: 40,
        [UserRole.HR]: 35,
        [UserRole.MANAGER]: 30,
        [UserRole.EMPLOYEE]: 10,
      };
      scoreA += roleScore[a.role] || 0;
      scoreB += roleScore[b.role] || 0;

      // More approval authority gets higher score
      if (a.maxApprovalDays && a.maxApprovalDays > 0) scoreA += Math.min(a.maxApprovalDays, 20);
      if (b.maxApprovalDays && b.maxApprovalDays > 0) scoreB += Math.min(b.maxApprovalDays, 20);

      // Same team gets bonus
      if (a.team?.id === manager.team?.id) scoreA += 5;
      if (b.team?.id === manager.team?.id) scoreB += 5;

      return scoreB - scoreA;
    });
  }

  private async createActingManagerAuditEntry(
    manager: EntityManager,
    assignment: ActingManagerAssignment,
    action: 'assigned' | 'removed',
    transferResult: AssignmentTransferResult,
    performedById?: string,
  ): Promise<void> {
    const auditEntry = this.auditRepository.create({
      action: action === 'assigned' ? AuditAction.STEP_DELEGATED : AuditAction.STEP_ESCALATED,
      description: `Acting manager ${action}`,
      performedById: performedById || assignment.managerId,
      affectedUserId: assignment.actingManagerId,
      entityType: 'acting_manager_assignment',
      entityId: assignment.managerId,
      metadata: {
        systemTriggered: true,
      },
    });

    await manager.save(ApprovalHistory, auditEntry);
  }
}

// Import for TypeORM operations
