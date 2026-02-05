import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import { Team } from '../teams/entities/team.entity';
import { ManagerDelegation, DelegationStatus } from '../delegations/entities/manager-delegation.entity';
import { ApproverSelectionRule } from './entities/workflow-template.entity';
import { WorkflowContext } from './workflow-engine.service';

export interface AutoApprovalResult {
  shouldAutoApprove: boolean;
  reason?: string;
  ruleName?: string;
}

export interface ApprovalValidationResult {
  isValid: boolean;
  reason?: string;
  warnings?: string[];
}

@Injectable()
export class ApprovalRulesService {
  private readonly logger = new Logger(ApprovalRulesService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Team)
    private teamRepository: Repository<Team>,
    @InjectRepository(ManagerDelegation)
    private delegationRepository: Repository<ManagerDelegation>,
  ) {}

  /**
   * Resolves approvers based on the selection rule and context
   */
  async resolveApprovers(
    selectionRule: ApproverSelectionRule,
    context: WorkflowContext,
    specificUserIds?: string[],
  ): Promise<User[]> {
    this.logger.log(`Resolving approvers using rule: ${selectionRule}`);

    switch (selectionRule) {
      case ApproverSelectionRule.DIRECT_MANAGER:
        return await this.resolveDirectManager(context.requestorId);

      case ApproverSelectionRule.DEPARTMENT_HEAD:
        return await this.resolveDepartmentHead(context);

      case ApproverSelectionRule.HR_TEAM:
        return await this.resolveHRTeam();

      case ApproverSelectionRule.TEAM_LEAD:
        return await this.resolveTeamLead(context.requestorId);

      case ApproverSelectionRule.SPECIFIC_USER:
        return await this.resolveSpecificUsers(specificUserIds || []);

      case ApproverSelectionRule.ANY_MANAGER_IN_DEPARTMENT:
        return await this.resolveAnyManagerInDepartment(context);

      default:
        this.logger.warn(`Unknown approver selection rule: ${selectionRule}`);
        return [];
    }
  }

  /**
   * Evaluates auto-approval rules for a given context
   */
  async evaluateAutoApprovalRules(
    autoApprovalRules: any,
    context: WorkflowContext,
  ): Promise<AutoApprovalResult> {
    if (!autoApprovalRules || !autoApprovalRules.conditions) {
      return { shouldAutoApprove: false };
    }

    const conditions = autoApprovalRules.conditions;
    const entityData = context.entityData;

    // Check if all conditions are met
    for (const condition of conditions) {
      if (!this.evaluateCondition(condition, entityData)) {
        return {
          shouldAutoApprove: false,
          reason: `Condition not met: ${condition.field} ${condition.operator} ${condition.value}`,
        };
      }
    }

    return {
      shouldAutoApprove: true,
      reason: 'All auto-approval conditions satisfied',
      ruleName: 'System Auto-Approval',
    };
  }

  /**
   * Validates if a user can approve a specific request
   */
  async validateApprovalPermission(
    userId: string,
    context: WorkflowContext,
  ): Promise<ApprovalValidationResult> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['manager', 'team', 'subordinates'],
    });

    if (!user) {
      return {
        isValid: false,
        reason: `User ${userId} not found`,
      };
    }

    if (!user.isActive) {
      return {
        isValid: false,
        reason: `User ${user.fullName} is inactive`,
      };
    }

    // Check if user has any approval authority
    if (!user.hasApprovalAuthority()) {
      return {
        isValid: false,
        reason: `User ${user.fullName} does not have approval authority`,
      };
    }

    const entityData = context.entityData;
    const requestor = await this.userRepository.findOne({
      where: { id: context.requestorId },
    });

    if (!requestor) {
      return {
        isValid: false,
        reason: 'Requestor not found',
      };
    }

    // Check specific permissions based on the request
    const warnings: string[] = [];

    // Check if user can approve this leave type and duration
    const canApprove = user.canApproveLeaveRequest(
      entityData.type,
      entityData.totalDays,
      requestor.department,
    );

    if (!canApprove) {
      return {
        isValid: false,
        reason: `User ${user.fullName} cannot approve this type/duration of leave`,
      };
    }

    // Check for delegation - if user is delegating authority
    if (user.isCurrentlyDelegating()) {
      warnings.push(`${user.fullName} is currently delegating authority`);
    }

    // Check relationship-based permissions
    const relationshipValidation = await this.validateRelationshipPermission(user, requestor);
    if (!relationshipValidation.isValid) {
      return relationshipValidation;
    }

    if (relationshipValidation.warnings) {
      warnings.push(...relationshipValidation.warnings);
    }

    return {
      isValid: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Gets effective approvers considering delegations and acting managers
   */
  async getEffectiveApprovers(originalApproverIds: string[]): Promise<User[]> {
    const effectiveApprovers: User[] = [];

    for (const approverId of originalApproverIds) {
      const effective = await this.getEffectiveApprover(approverId);
      if (effective) {
        effectiveApprovers.push(effective);
      }
    }

    return effectiveApprovers;
  }

  /**
   * Finds substitute approvers when the primary approver is unavailable
   */
  async findSubstituteApprovers(
    unavailableUserId: string,
    context: WorkflowContext,
  ): Promise<User[]> {
    this.logger.log(`Finding substitute approvers for unavailable user: ${unavailableUserId}`);

    const user = await this.userRepository.findOne({
      where: { id: unavailableUserId },
      relations: ['manager', 'team'],
    });

    if (!user) {
      return [];
    }

    const substitutes: User[] = [];

    // 1. Check for active delegations
    const activeDelegations = await this.getActiveDelegations(unavailableUserId);
    for (const delegation of activeDelegations) {
      if (delegation.canApproveForUser(context.requestorId) &&
          delegation.canApproveLeaveType(context.entityData.type) &&
          delegation.canApproveAmount(context.entityData.totalDays)) {
        substitutes.push(delegation.delegatedTo);
      }
    }

    // 2. Check for acting manager
    if (user.hasActingManager() && user.actingManager) {
      const actingManager = user.actingManager;
      const validation = await this.validateApprovalPermission(actingManager.id, context);
      if (validation.isValid) {
        substitutes.push(actingManager);
      }
    }

    // 3. Escalate to their manager
    if (user.manager && !substitutes.some(s => s.id === user.manager.id)) {
      const validation = await this.validateApprovalPermission(user.manager.id, context);
      if (validation.isValid) {
        substitutes.push(user.manager);
      }
    }

    // 4. Find peer managers in the same department
    if (user.department && substitutes.length === 0) {
      const peerManagers = await this.userRepository.find({
        where: {
          department: user.department,
          role: UserRole.MANAGER,
          isActive: true,
        },
      });

      for (const manager of peerManagers) {
        if (manager.id !== unavailableUserId) {
          const validation = await this.validateApprovalPermission(manager.id, context);
          if (validation.isValid) {
            substitutes.push(manager);
            break; // Take the first available peer manager
          }
        }
      }
    }

    return substitutes;
  }

  // Private helper methods

  private async resolveDirectManager(requestorId: string): Promise<User[]> {
    const requestor = await this.userRepository.findOne({
      where: { id: requestorId },
      relations: ['manager'],
    });

    if (!requestor?.manager) {
      this.logger.warn(`No direct manager found for user ${requestorId}`);
      return [];
    }

    // Get effective manager (considering acting manager assignments)
    const effectiveManager = await this.getEffectiveApprover(requestor.manager.id);
    return effectiveManager ? [effectiveManager] : [];
  }

  private async resolveDepartmentHead(context: WorkflowContext): Promise<User[]> {
    const requestor = await this.userRepository.findOne({
      where: { id: context.requestorId },
    });

    if (!requestor?.department) {
      this.logger.warn(`No department found for user ${context.requestorId}`);
      return [];
    }

    // Find managers in the same department
    const departmentManagers = await this.userRepository.find({
      where: {
        department: requestor.department,
        role: UserRole.MANAGER,
        isActive: true,
      },
    });

    // Find the most senior manager (could be based on hire date, level, etc.)
    // For now, we'll take the first one found
    return departmentManagers.slice(0, 1);
  }

  private async resolveHRTeam(): Promise<User[]> {
    return await this.userRepository.find({
      where: {
        role: UserRole.HR,
        isActive: true,
      },
      take: 3, // Limit to top 3 HR members
    });
  }

  private async resolveTeamLead(requestorId: string): Promise<User[]> {
    const requestor = await this.userRepository.findOne({
      where: { id: requestorId },
      relations: ['team', 'team.lead'],
    });

    if (!requestor?.team?.lead) {
      this.logger.warn(`No team lead found for user ${requestorId}`);
      return [];
    }

    return [requestor.team.lead];
  }

  private async resolveSpecificUsers(userIds: string[]): Promise<User[]> {
    if (userIds.length === 0) {
      return [];
    }

    return await this.userRepository.find({
      where: { id: In(userIds), isActive: true },
    });
  }

  private async resolveAnyManagerInDepartment(context: WorkflowContext): Promise<User[]> {
    const requestor = await this.userRepository.findOne({
      where: { id: context.requestorId },
    });

    if (!requestor?.department) {
      return [];
    }

    return await this.userRepository.find({
      where: {
        department: requestor.department,
        role: UserRole.MANAGER,
        isActive: true,
      },
    });
  }

  private async getEffectiveApprover(originalApproverId: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { id: originalApproverId },
      relations: ['actingManager'],
    });

    if (!user) {
      return null;
    }

    // Check if user is currently delegating authority
    if (user.isCurrentlyDelegating()) {
      const activeDelegations = await this.getActiveDelegations(originalApproverId);
      if (activeDelegations.length > 0) {
        // Return the first active delegate
        return activeDelegations[0].delegatedTo;
      }
    }

    // Check if user has an acting manager assigned
    if (user.hasActingManager()) {
      return user.actingManager;
    }

    return user;
  }

  private async getActiveDelegations(userId: string): Promise<ManagerDelegation[]> {
    const now = new Date();
    return await this.delegationRepository.find({
      where: {
        delegatedFromId: userId,
        status: DelegationStatus.ACTIVE,
        effectiveFrom: LessThanOrEqual(now),
        effectiveTo: MoreThanOrEqual(now),
      },
      relations: ['delegatedTo'],
    });
  }

  private evaluateCondition(condition: any, entityData: any): boolean {
    const fieldValue = entityData[condition.field];

    switch (condition.operator) {
      case 'eq':
        return fieldValue === condition.value;
      case 'gt':
        return fieldValue > condition.value;
      case 'lt':
        return fieldValue < condition.value;
      case 'gte':
        return fieldValue >= condition.value;
      case 'lte':
        return fieldValue <= condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);
      default:
        this.logger.warn(`Unknown condition operator: ${condition.operator}`);
        return false;
    }
  }

  private async validateRelationshipPermission(
    approver: User,
    requestor: User,
  ): Promise<ApprovalValidationResult> {
    const warnings: string[] = [];

    // Admins and HR can approve anything
    if (approver.role === UserRole.ADMIN || approver.role === UserRole.HR) {
      return { isValid: true };
    }

    // Managers can approve for their subordinates
    if (approver.role === UserRole.MANAGER) {
      const subordinateIds = approver.subordinates?.map(s => s.id) || [];
      const isDirectSubordinate = subordinateIds.includes(requestor.id);

      if (isDirectSubordinate) {
        return { isValid: true };
      }

      // Check if it's a valid department manager scenario
      if (approver.department === requestor.department) {
        warnings.push(`${approver.fullName} is approving for someone in the same department but not a direct subordinate`);
        return {
          isValid: true,
          warnings,
        };
      }

      return {
        isValid: false,
        reason: `${approver.fullName} is not authorized to approve leave for ${requestor.fullName}`,
      };
    }

    return {
      isValid: false,
      reason: `${approver.fullName} does not have sufficient role permissions`,
    };
  }
}

// These are already imported at the top
import { In } from 'typeorm';