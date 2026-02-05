import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, In } from 'typeorm';
import {
  ApprovalStep,
  ApprovalStepStatus,
  StepType,
} from './entities/approval-step.entity';
import { User } from '../users/entities/user.entity';
import { ApprovalHistory, AuditAction } from '../audit/entities/approval-history.entity';

export interface ParallelApprovalConfig {
  requiredApprovals: number; // How many approvals needed (for ANY_OF_MULTIPLE)
  approvers: User[];
  allowSelfApproval?: boolean;
  requireUnanimous?: boolean; // For ALL_OF_MULTIPLE
  timeoutHours?: number;
  escalationRule?: string;
}

export interface ParallelApprovalResult {
  stepCompleted: boolean;
  approvalCount: number;
  requiredCount: number;
  remainingApprovers: string[];
  completedApprovers: string[];
  canProceed: boolean;
  nextAction: 'continue' | 'complete' | 'wait';
}

export interface ApproverNotification {
  approverId: string;
  stepId: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: Date;
  context: {
    requestorName: string;
    leaveType: string;
    duration: string;
    reason: string;
  };
}

@Injectable()
export class ParallelApprovalService {
  private readonly logger = new Logger(ParallelApprovalService.name);

  constructor(
    @InjectRepository(ApprovalStep)
    private approvalStepRepository: Repository<ApprovalStep>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(ApprovalHistory)
    private auditRepository: Repository<ApprovalHistory>,
  ) {}

  /**
   * Creates a parallel approval step with multiple approvers
   */
  async createParallelApprovalStep(
    workflowInstanceId: string,
    stepDef: any,
    config: ParallelApprovalConfig,
  ): Promise<ApprovalStep> {
    this.logger.log(
      `Creating parallel approval step for workflow ${workflowInstanceId} ` +
      `with ${config.approvers.length} approvers`
    );

    // Validate configuration
    this.validateParallelConfig(config);

    const stepType = config.requireUnanimous || stepDef.stepType === 'ALL_OF_MULTIPLE'
      ? StepType.ALL_OF_MULTIPLE
      : StepType.ANY_OF_MULTIPLE;

    const step = this.approvalStepRepository.create({
      workflowInstanceId,
      stepOrder: stepDef.stepOrder,
      stepName: stepDef.stepName,
      stepType,
      status: ApprovalStepStatus.PENDING,
      assignedUserId: config.approvers[0]?.id, // Primary approver for notifications
      requiredApproverIds: config.approvers.map(u => u.id),
      completedApproverIds: [],
      isRequired: stepDef.isRequired,
      timeoutHours: config.timeoutHours || stepDef.timeoutHours,
      dueAt: config.timeoutHours
        ? new Date(Date.now() + config.timeoutHours * 60 * 60 * 1000)
        : null,
    });

    const savedStep = await this.approvalStepRepository.save(step);

    // Create individual audit entries for each approver
    await this.createApprovalNotifications(savedStep, config.approvers);

    this.logger.log(`Created parallel approval step ${savedStep.id} with ${config.approvers.length} approvers`);

    return savedStep;
  }

  /**
   * Processes an individual approval within a parallel step
   */
  async processParallelApproval(
    stepId: string,
    approverId: string,
    decision: 'approve' | 'reject',
    comments?: string,
    metadata?: Record<string, any>,
  ): Promise<ParallelApprovalResult> {
    this.logger.log(
      `Processing ${decision} from approver ${approverId} for parallel step ${stepId}`
    );

    return await this.approvalStepRepository.manager.transaction(async (manager) => {
      const step = await manager.findOne(ApprovalStep, {
        where: { id: stepId },
        relations: ['workflowInstance'],
      });

      if (!step) {
        throw new Error(`Approval step ${stepId} not found`);
      }

      // Validate approver is authorized
      if (!this.canApproveStep(step, approverId)) {
        throw new Error(`User ${approverId} is not authorized to approve step ${stepId}`);
      }

      // Check if approver has already provided a decision
      if (step.completedApproverIds.includes(approverId)) {
        throw new Error(`User ${approverId} has already approved step ${stepId}`);
      }

      // Handle rejection - in parallel approval, any rejection can end the step
      if (decision === 'reject') {
        return await this.handleParallelRejection(manager, step, approverId, comments, metadata);
      }

      // Handle approval
      return await this.handleParallelApproval(manager, step, approverId, comments, metadata);
    });
  }

  /**
   * Gets the current status of a parallel approval step
   */
  async getParallelApprovalStatus(stepId: string): Promise<ParallelApprovalResult> {
    const step = await this.approvalStepRepository.findOne({
      where: { id: stepId },
      relations: ['assignedUser'],
    });

    if (!step) {
      throw new Error(`Approval step ${stepId} not found`);
    }

    const requiredCount = this.getRequiredApprovalCount(step);
    const approvalCount = step.completedApproverIds.length;
    const remainingApprovers = step.requiredApproverIds.filter(
      id => !step.completedApproverIds.includes(id)
    );

    const stepCompleted = this.isParallelStepCompleted(step);
    const canProceed = stepCompleted || approvalCount >= requiredCount;

    let nextAction: 'continue' | 'complete' | 'wait' = 'wait';
    if (stepCompleted) {
      nextAction = 'complete';
    } else if (canProceed && step.stepType === StepType.ANY_OF_MULTIPLE) {
      nextAction = 'continue';
    }

    return {
      stepCompleted,
      approvalCount,
      requiredCount,
      remainingApprovers,
      completedApprovers: step.completedApproverIds,
      canProceed,
      nextAction,
    };
  }

  /**
   * Handles timeout scenarios for parallel approvals
   */
  async handleParallelTimeout(
    stepId: string,
    timeoutAction: 'escalate' | 'auto_approve' | 'auto_reject' | 'extend',
    additionalHours?: number,
  ): Promise<ParallelApprovalResult> {
    this.logger.log(`Handling timeout for parallel step ${stepId} with action: ${timeoutAction}`);

    const step = await this.approvalStepRepository.findOne({
      where: { id: stepId },
      relations: ['workflowInstance'],
    });

    if (!step) {
      throw new Error(`Approval step ${stepId} not found`);
    }

    switch (timeoutAction) {
      case 'escalate':
        return await this.escalateParallelStep(step);

      case 'auto_approve':
        return await this.autoApproveParallelStep(step, 'Timeout - Auto approved');

      case 'auto_reject':
        return await this.autoRejectParallelStep(step, 'Timeout - Auto rejected');

      case 'extend':
        return await this.extendParallelStepTimeout(step, additionalHours || 24);

      default:
        throw new Error(`Unknown timeout action: ${timeoutAction}`);
    }
  }

  /**
   * Gets pending parallel approvals for a user
   */
  async getPendingParallelApprovals(userId: string): Promise<ApprovalStep[]> {
    // Find all pending steps where the user is a required approver but hasn't completed yet
    const steps = await this.approvalStepRepository
      .createQueryBuilder('step')
      .leftJoinAndSelect('step.workflowInstance', 'workflow')
      .leftJoinAndSelect('workflow.leaveRequest', 'leaveRequest')
      .leftJoinAndSelect('leaveRequest.user', 'requestor')
      .where('step.status = :status', { status: ApprovalStepStatus.PENDING })
      .andWhere(':userId = ANY(step.required_approver_ids)', { userId })
      .andWhere('NOT :userId = ANY(step.completed_approver_ids)', { userId })
      .andWhere('step.step_type IN (:...parallelTypes)', {
        parallelTypes: [StepType.ANY_OF_MULTIPLE, StepType.ALL_OF_MULTIPLE],
      })
      .orderBy('step.dueAt', 'ASC')
      .addOrderBy('step.createdAt', 'ASC')
      .getMany();

    return steps;
  }

  /**
   * Synchronizes parallel approval states after external changes
   */
  async synchronizeParallelStep(stepId: string): Promise<ParallelApprovalResult> {
    const step = await this.approvalStepRepository.findOne({
      where: { id: stepId },
    });

    if (!step) {
      throw new Error(`Approval step ${stepId} not found`);
    }

    // Check if step should be completed based on current approvals
    if (this.isParallelStepCompleted(step) && step.status === ApprovalStepStatus.PENDING) {
      step.status = ApprovalStepStatus.APPROVED;
      step.decidedAt = new Date();
      await this.approvalStepRepository.save(step);

      this.logger.log(`Synchronized parallel step ${stepId} - marked as completed`);
    }

    return await this.getParallelApprovalStatus(stepId);
  }

  /**
   * Removes an approver from a parallel step (e.g., when user becomes unavailable)
   */
  async removeApproverFromParallelStep(
    stepId: string,
    approverId: string,
    reason: string,
  ): Promise<void> {
    const step = await this.approvalStepRepository.findOne({
      where: { id: stepId },
    });

    if (!step) {
      throw new Error(`Approval step ${stepId} not found`);
    }

    // Remove from required approvers
    step.requiredApproverIds = step.requiredApproverIds.filter(id => id !== approverId);

    // Remove from completed approvers if present
    step.completedApproverIds = step.completedApproverIds.filter(id => id !== approverId);

    await this.approvalStepRepository.save(step);

    // Create audit entry
    const auditEntry = this.auditRepository.create({
      approvalStepId: stepId,
      action: AuditAction.STEP_DELEGATED, // Using delegation as closest match
      description: `Approver removed from parallel step: ${reason}`,
      affectedUserId: approverId,
      entityType: step.workflowInstance.entityType,
      entityId: step.workflowInstance.entityId,
      metadata: { reason, removedApprover: true },
    });

    await this.auditRepository.save(auditEntry);

    this.logger.log(`Removed approver ${approverId} from parallel step ${stepId}: ${reason}`);
  }

  // Private helper methods

  private validateParallelConfig(config: ParallelApprovalConfig): void {
    if (!config.approvers || config.approvers.length === 0) {
      throw new Error('Parallel approval must have at least one approver');
    }

    if (config.requiredApprovals && config.requiredApprovals > config.approvers.length) {
      throw new Error('Required approvals cannot exceed total number of approvers');
    }

    if (config.requiredApprovals && config.requiredApprovals < 1) {
      throw new Error('Required approvals must be at least 1');
    }
  }

  private canApproveStep(step: ApprovalStep, approverId: string): boolean {
    return step.requiredApproverIds.includes(approverId);
  }

  private async handleParallelRejection(
    manager: EntityManager,
    step: ApprovalStep,
    approverId: string,
    comments?: string,
    metadata?: Record<string, any>,
  ): Promise<ParallelApprovalResult> {
    // In parallel approval, any rejection typically ends the step
    step.status = ApprovalStepStatus.REJECTED;
    step.decidedAt = new Date();
    step.decidedById = approverId;
    step.comments = comments;

    await manager.save(ApprovalStep, step);

    // Create audit entry
    await this.createAuditEntry(manager, step, AuditAction.STEP_REJECTED, {
      performedById: approverId,
      comments,
      metadata,
    });

    return {
      stepCompleted: true,
      approvalCount: 0,
      requiredCount: this.getRequiredApprovalCount(step),
      remainingApprovers: [],
      completedApprovers: [],
      canProceed: false,
      nextAction: 'complete',
    };
  }

  private async handleParallelApproval(
    manager: EntityManager,
    step: ApprovalStep,
    approverId: string,
    comments?: string,
    metadata?: Record<string, any>,
  ): Promise<ParallelApprovalResult> {
    // Add approver to completed list
    step.completedApproverIds.push(approverId);

    // Check if step is now completed
    const isCompleted = this.isParallelStepCompleted(step);
    if (isCompleted) {
      step.status = ApprovalStepStatus.APPROVED;
      step.decidedAt = new Date();
      step.decidedById = approverId; // Last approver gets credit
      step.comments = comments;
    }

    await manager.save(ApprovalStep, step);

    // Create audit entry
    await this.createAuditEntry(manager, step, AuditAction.STEP_APPROVED, {
      performedById: approverId,
      comments,
      metadata: {
        ...metadata,
        parallelApproval: true,
        approvalCount: step.completedApproverIds.length,
        requiredCount: this.getRequiredApprovalCount(step),
      },
    });

    return await this.getParallelApprovalStatus(step.id);
  }

  private isParallelStepCompleted(step: ApprovalStep): boolean {
    const requiredCount = this.getRequiredApprovalCount(step);
    const approvalCount = step.completedApproverIds.length;

    switch (step.stepType) {
      case StepType.ALL_OF_MULTIPLE:
        return approvalCount >= step.requiredApproverIds.length;
      case StepType.ANY_OF_MULTIPLE:
        return approvalCount >= requiredCount;
      default:
        return approvalCount > 0;
    }
  }

  private getRequiredApprovalCount(step: ApprovalStep): number {
    switch (step.stepType) {
      case StepType.ALL_OF_MULTIPLE:
        return step.requiredApproverIds.length;
      case StepType.ANY_OF_MULTIPLE:
        // For ANY_OF_MULTIPLE, we need at least 1, but could be configured for more
        // For now, we'll default to 1
        return 1;
      default:
        return 1;
    }
  }

  private async escalateParallelStep(step: ApprovalStep): Promise<ParallelApprovalResult> {
    // Find escalation targets for all remaining approvers
    const remainingApproverIds = step.requiredApproverIds.filter(
      id => !step.completedApproverIds.includes(id)
    );

    // For simplicity, we'll escalate to their managers
    // In a real implementation, you might have more sophisticated escalation rules
    const escalationTargets: string[] = [];

    for (const approverId of remainingApproverIds) {
      const approver = await this.userRepository.findOne({
        where: { id: approverId },
        relations: ['manager'],
      });

      if (approver?.manager) {
        escalationTargets.push(approver.manager.id);
      }
    }

    // Update step with new approvers
    step.requiredApproverIds = [...new Set([...step.requiredApproverIds, ...escalationTargets])];
    step.escalationCount += 1;
    step.dueAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // Extend by 48 hours

    await this.approvalStepRepository.save(step);

    this.logger.log(`Escalated parallel step ${step.id} to ${escalationTargets.length} additional approvers`);

    return await this.getParallelApprovalStatus(step.id);
  }

  private async autoApproveParallelStep(
    step: ApprovalStep,
    reason: string,
  ): Promise<ParallelApprovalResult> {
    step.status = ApprovalStepStatus.APPROVED;
    step.decidedAt = new Date();
    step.wasAutoApproved = true;
    step.autoApprovalReason = reason;
    step.comments = reason;

    await this.approvalStepRepository.save(step);

    return await this.getParallelApprovalStatus(step.id);
  }

  private async autoRejectParallelStep(
    step: ApprovalStep,
    reason: string,
  ): Promise<ParallelApprovalResult> {
    step.status = ApprovalStepStatus.REJECTED;
    step.decidedAt = new Date();
    step.comments = reason;

    await this.approvalStepRepository.save(step);

    return await this.getParallelApprovalStatus(step.id);
  }

  private async extendParallelStepTimeout(
    step: ApprovalStep,
    additionalHours: number,
  ): Promise<ParallelApprovalResult> {
    if (step.dueAt) {
      step.dueAt = new Date(step.dueAt.getTime() + additionalHours * 60 * 60 * 1000);
    } else {
      step.dueAt = new Date(Date.now() + additionalHours * 60 * 60 * 1000);
    }

    await this.approvalStepRepository.save(step);

    return await this.getParallelApprovalStatus(step.id);
  }

  private async createApprovalNotifications(
    step: ApprovalStep,
    approvers: User[],
  ): Promise<void> {
    // This would integrate with your notification service
    // For now, we'll just log the notifications that would be sent
    for (const approver of approvers) {
      this.logger.log(
        `Notification would be sent to ${approver.fullName} for parallel approval step ${step.id}`
      );
    }
  }

  private async createAuditEntry(
    manager: EntityManager,
    step: ApprovalStep,
    action: AuditAction,
    data: Partial<ApprovalHistory>,
  ): Promise<void> {
    const auditEntry = this.auditRepository.create({
      approvalStepId: step.id,
      action,
      entityType: step.workflowInstance.entityType,
      entityId: step.workflowInstance.entityId,
      timestamp: new Date(),
      ...data,
    });

    await manager.save(ApprovalHistory, auditEntry);
  }
}