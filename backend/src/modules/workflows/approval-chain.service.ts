import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import {
  WorkflowInstance,
  WorkflowStatus,
} from './entities/workflow-instance.entity';
import {
  ApprovalStep,
  ApprovalStepStatus,
  StepType,
} from './entities/approval-step.entity';
import { User } from '../users/entities/user.entity';
import { ApprovalRulesService } from './approval-rules.service';
import { WorkflowContext } from './workflow-engine.service';

export interface ChainProgressInfo {
  currentStep: number;
  totalSteps: number;
  completedSteps: ApprovalStep[];
  pendingSteps: ApprovalStep[];
  nextStep?: ApprovalStep;
  percentComplete: number;
  estimatedCompletionTime?: Date;
}

export interface ParallelApprovalStatus {
  required: number;
  completed: number;
  pending: number;
  isComplete: boolean;
  completedApprovers: User[];
  pendingApprovers: User[];
}

@Injectable()
export class ApprovalChainService {
  private readonly logger = new Logger(ApprovalChainService.name);

  constructor(
    @InjectRepository(WorkflowInstance)
    private workflowInstanceRepository: Repository<WorkflowInstance>,
    @InjectRepository(ApprovalStep)
    private approvalStepRepository: Repository<ApprovalStep>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private approvalRulesService: ApprovalRulesService,
  ) {}

  /**
   * Creates a multi-level approval chain based on workflow template
   */
  async createApprovalChain(
    workflowInstance: WorkflowInstance,
    context: WorkflowContext,
  ): Promise<ApprovalStep[]> {
    this.logger.log(`Creating approval chain for workflow ${workflowInstance.id}`);

    const template = workflowInstance.template;
    const steps: ApprovalStep[] = [];

    for (const stepDef of template.stepDefinitions) {
      // Skip steps that don't meet conditional requirements
      if (!this.shouldIncludeStep(stepDef, context)) {
        this.logger.debug(`Skipping step ${stepDef.stepName} due to conditional logic`);
        continue;
      }

      // Check for auto-approval rules
      if (stepDef.autoApprovalRules) {
        const autoResult = await this.approvalRulesService.evaluateAutoApprovalRules(
          stepDef.autoApprovalRules,
          context,
        );

        if (autoResult.shouldAutoApprove) {
          const autoApprovedStep = await this.createAutoApprovedStep(
            workflowInstance.id,
            stepDef,
            autoResult.reason || 'Auto-approved by system rules',
          );
          steps.push(autoApprovedStep);
          continue;
        }
      }

      // Resolve approvers for this step
      const approvers = await this.approvalRulesService.resolveApprovers(
        stepDef.approverSelectionRule,
        context,
        stepDef.specificUserIds,
      );

      if (approvers.length === 0) {
        if (stepDef.isRequired) {
          throw new Error(
            `No approvers found for required step: ${stepDef.stepName}. ` +
            `Selection rule: ${stepDef.approverSelectionRule}`
          );
        } else {
          this.logger.warn(`No approvers found for optional step: ${stepDef.stepName}`);
          continue;
        }
      }

      // Create approval step based on type
      const step = await this.createApprovalStep(
        workflowInstance.id,
        stepDef,
        approvers,
      );

      steps.push(step);
    }

    if (steps.length === 0) {
      throw new Error('No approval steps were created for the workflow');
    }

    // Save all steps
    return await this.approvalStepRepository.save(steps);
  }

  /**
   * Gets comprehensive progress information for an approval chain
   */
  async getChainProgress(workflowInstanceId: string): Promise<ChainProgressInfo> {
    const workflowInstance = await this.workflowInstanceRepository.findOne({
      where: { id: workflowInstanceId },
      relations: [
        'approvalSteps',
        'approvalSteps.assignedUser',
        'approvalSteps.decidedBy',
      ],
      order: {
        approvalSteps: {
          stepOrder: 'ASC',
        },
      },
    });

    if (!workflowInstance) {
      throw new Error(`Workflow instance ${workflowInstanceId} not found`);
    }

    const steps = workflowInstance.approvalSteps;
    const completedSteps = steps.filter(step => step.isApproved());
    const pendingSteps = steps.filter(step => step.isPending());
    const currentStep = steps.find(step => step.stepOrder === workflowInstance.currentStepOrder);

    const progress: ChainProgressInfo = {
      currentStep: workflowInstance.currentStepOrder,
      totalSteps: steps.length,
      completedSteps,
      pendingSteps,
      nextStep: pendingSteps[0],
      percentComplete: Math.round((completedSteps.length / steps.length) * 100),
    };

    // Calculate estimated completion time based on remaining steps and their timeouts
    if (pendingSteps.length > 0) {
      progress.estimatedCompletionTime = this.calculateEstimatedCompletion(pendingSteps);
    }

    return progress;
  }

  /**
   * Advances the approval chain to the next step
   */
  async advanceToNextStep(
    workflowInstanceId: string,
    manager?: EntityManager,
  ): Promise<ApprovalStep | null> {
    const em = manager || this.workflowInstanceRepository.manager;

    const workflowInstance = await em.findOne(WorkflowInstance, {
      where: { id: workflowInstanceId },
      relations: ['approvalSteps'],
    });

    if (!workflowInstance) {
      throw new Error(`Workflow instance ${workflowInstanceId} not found`);
    }

    const currentStep = workflowInstance.getCurrentStep();
    if (currentStep && currentStep.isPending()) {
      throw new Error(
        `Cannot advance to next step while current step ${currentStep.id} is still pending`
      );
    }

    // Find the next step in sequence
    const nextStep = workflowInstance.approvalSteps.find(
      step =>
        step.stepOrder > workflowInstance.currentStepOrder &&
        step.status === ApprovalStepStatus.PENDING,
    );

    if (!nextStep) {
      // No more steps - workflow should be completed
      this.logger.log(`No next step found for workflow ${workflowInstanceId} - should be completed`);
      return null;
    }

    // Update workflow to point to next step
    workflowInstance.currentStepOrder = nextStep.stepOrder;
    await em.save(WorkflowInstance, workflowInstance);

    this.logger.log(
      `Advanced workflow ${workflowInstanceId} to step ${nextStep.stepOrder}: ${nextStep.stepName}`
    );

    return nextStep;
  }

  /**
   * Handles sequential approval chain progression
   */
  async processSequentialApproval(
    stepId: string,
    decision: 'approve' | 'reject',
    approverId: string,
    comments?: string,
  ): Promise<{ nextStep?: ApprovalStep; workflowCompleted: boolean }> {
    return await this.workflowInstanceRepository.manager.transaction(async (manager) => {
      const step = await manager.findOne(ApprovalStep, {
        where: { id: stepId },
        relations: ['workflowInstance', 'workflowInstance.approvalSteps'],
      });

      if (!step) {
        throw new Error(`Approval step ${stepId} not found`);
      }

      // Update step status
      const newStatus = decision === 'approve'
        ? ApprovalStepStatus.APPROVED
        : ApprovalStepStatus.REJECTED;

      step.status = newStatus;
      step.decidedAt = new Date();
      step.decidedById = approverId;
      step.comments = comments;

      await manager.save(ApprovalStep, step);

      if (decision === 'reject') {
        // Rejection terminates the workflow
        step.workflowInstance.status = WorkflowStatus.CANCELLED;
        step.workflowInstance.cancelledAt = new Date();
        step.workflowInstance.cancellationReason = comments || 'Rejected by approver';
        await manager.save(WorkflowInstance, step.workflowInstance);

        return { workflowCompleted: true };
      }

      // Approval - advance to next step
      const nextStep = await this.advanceToNextStep(step.workflowInstanceId, manager);

      if (!nextStep) {
        // Workflow completed successfully
        step.workflowInstance.status = WorkflowStatus.COMPLETED;
        step.workflowInstance.completedAt = new Date();
        await manager.save(WorkflowInstance, step.workflowInstance);

        return { workflowCompleted: true };
      }

      return {
        nextStep,
        workflowCompleted: false,
      };
    });
  }

  /**
   * Handles conditional routing based on dynamic business rules
   */
  async handleConditionalRouting(
    workflowInstanceId: string,
    routingData: Record<string, any>,
  ): Promise<ApprovalStep[]> {
    this.logger.log(`Handling conditional routing for workflow ${workflowInstanceId}`);

    const workflowInstance = await this.workflowInstanceRepository.findOne({
      where: { id: workflowInstanceId },
      relations: ['approvalSteps', 'template'],
    });

    if (!workflowInstance) {
      throw new Error(`Workflow instance ${workflowInstanceId} not found`);
    }

    const conditionalSteps: ApprovalStep[] = [];
    const template = workflowInstance.template;

    // Find conditional step definitions
    const conditionalStepDefs = template.stepDefinitions.filter(
      stepDef => stepDef.conditionalLogic
    );

    for (const stepDef of conditionalStepDefs) {
      const shouldInclude = this.evaluateConditionalLogic(stepDef.conditionalLogic, routingData);

      if (shouldInclude) {
        // Check if this conditional step already exists
        const existingStep = workflowInstance.approvalSteps.find(
          step => step.stepName === stepDef.stepName
        );

        if (!existingStep) {
          // Create new conditional step
          const approvers = await this.approvalRulesService.resolveApprovers(
            stepDef.approverSelectionRule,
            {
              entityType: workflowInstance.entityType,
              entityId: workflowInstance.entityId,
              entityData: routingData,
              requestorId: routingData.requestorId || '',
            },
            stepDef.specificUserIds,
          );

          if (approvers.length > 0) {
            const newStep = await this.createApprovalStep(
              workflowInstanceId,
              stepDef,
              approvers,
            );
            conditionalSteps.push(newStep);
          }
        }
      }
    }

    if (conditionalSteps.length > 0) {
      await this.approvalStepRepository.save(conditionalSteps);
      this.logger.log(`Created ${conditionalSteps.length} conditional steps`);
    }

    return conditionalSteps;
  }

  /**
   * Skips optional steps that cannot be completed
   */
  async skipOptionalSteps(
    workflowInstanceId: string,
    stepIds: string[],
    reason: string,
  ): Promise<void> {
    this.logger.log(`Skipping optional steps for workflow ${workflowInstanceId}: ${stepIds}`);

    const steps = await this.approvalStepRepository.find({
      where: { id: In(stepIds), isRequired: false },
    });

    for (const step of steps) {
      if (step.isPending()) {
        step.status = ApprovalStepStatus.SKIPPED;
        step.comments = reason;
      }
    }

    await this.approvalStepRepository.save(steps);
  }

  /**
   * Reorders steps in an active workflow (for dynamic adjustments)
   */
  async reorderSteps(
    workflowInstanceId: string,
    newStepOrder: { stepId: string; newOrder: number }[],
  ): Promise<void> {
    this.logger.log(`Reordering steps for workflow ${workflowInstanceId}`);

    return await this.workflowInstanceRepository.manager.transaction(async (manager) => {
      for (const reorder of newStepOrder) {
        await manager.update(
          ApprovalStep,
          { id: reorder.stepId },
          { stepOrder: reorder.newOrder }
        );
      }

      // Find the new current step (lowest order pending step)
      const steps = await manager.find(ApprovalStep, {
        where: { workflowInstanceId },
        order: { stepOrder: 'ASC' },
      });

      const newCurrentStep = steps.find(step => step.isPending());
      if (newCurrentStep) {
        await manager.update(
          WorkflowInstance,
          { id: workflowInstanceId },
          { currentStepOrder: newCurrentStep.stepOrder }
        );
      }
    });
  }

  // Private helper methods

  private shouldIncludeStep(stepDef: any, context: WorkflowContext): boolean {
    if (!stepDef.conditionalLogic) return true;

    return this.evaluateConditionalLogic(stepDef.conditionalLogic, context.entityData);
  }

  private evaluateConditionalLogic(
    conditionalLogic: any,
    data: Record<string, any>,
  ): boolean {
    const fieldValue = data[conditionalLogic.field];

    switch (conditionalLogic.operator) {
      case 'eq':
        return fieldValue === conditionalLogic.value;
      case 'gt':
        return fieldValue > conditionalLogic.value;
      case 'lt':
        return fieldValue < conditionalLogic.value;
      case 'gte':
        return fieldValue >= conditionalLogic.value;
      case 'lte':
        return fieldValue <= conditionalLogic.value;
      case 'in':
        return Array.isArray(conditionalLogic.value) &&
               conditionalLogic.value.includes(fieldValue);
      default:
        this.logger.warn(`Unknown conditional operator: ${conditionalLogic.operator}`);
        return false;
    }
  }

  private async createApprovalStep(
    workflowInstanceId: string,
    stepDef: any,
    approvers: User[],
  ): Promise<ApprovalStep> {
    const step = this.approvalStepRepository.create({
      workflowInstanceId,
      stepOrder: stepDef.stepOrder,
      stepName: stepDef.stepName,
      stepType: stepDef.stepType as StepType,
      status: ApprovalStepStatus.PENDING,
      assignedUserId: approvers[0].id,
      requiredApproverIds: approvers.map(u => u.id),
      isRequired: stepDef.isRequired,
      timeoutHours: stepDef.timeoutHours,
      dueAt: stepDef.timeoutHours
        ? new Date(Date.now() + stepDef.timeoutHours * 60 * 60 * 1000)
        : null,
    });

    return step;
  }

  private async createAutoApprovedStep(
    workflowInstanceId: string,
    stepDef: any,
    autoApprovalReason: string,
  ): Promise<ApprovalStep> {
    const step = this.approvalStepRepository.create({
      workflowInstanceId,
      stepOrder: stepDef.stepOrder,
      stepName: stepDef.stepName,
      stepType: stepDef.stepType as StepType,
      status: ApprovalStepStatus.APPROVED,
      isRequired: stepDef.isRequired,
      wasAutoApproved: true,
      autoApprovalReason,
      decidedAt: new Date(),
      comments: autoApprovalReason,
    });

    return step;
  }

  private calculateEstimatedCompletion(pendingSteps: ApprovalStep[]): Date {
    let totalHours = 0;

    for (const step of pendingSteps) {
      // Use timeout hours if available, otherwise default to 24 hours
      totalHours += step.timeoutHours || 24;
    }

    return new Date(Date.now() + totalHours * 60 * 60 * 1000);
  }
}

// Import for the skipOptionalSteps method
import { In } from 'typeorm';