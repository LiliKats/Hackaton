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
import { WorkflowTemplate } from './entities/workflow-template.entity';
import { ApprovalHistory, AuditAction } from '../audit/entities/approval-history.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { LeaveRequest } from '../leave-requests/entities/leave-request.entity';
import { WorkflowTemplateService } from './workflow-template.service';
import { ApprovalRulesService } from './approval-rules.service';

export interface WorkflowContext {
  entityType: string;
  entityId: string;
  entityData: Record<string, any>;
  requestorId: string;
  triggeredBy?: string;
  urgencyLevel?: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

export interface StepExecutionResult {
  success: boolean;
  stepId: string;
  status: ApprovalStepStatus;
  nextStepId?: string;
  workflowCompleted: boolean;
  errors?: string[];
  warnings?: string[];
}

@Injectable()
export class WorkflowEngineService {
  private readonly logger = new Logger(WorkflowEngineService.name);

  constructor(
    @InjectRepository(WorkflowInstance)
    private workflowInstanceRepository: Repository<WorkflowInstance>,
    @InjectRepository(ApprovalStep)
    private approvalStepRepository: Repository<ApprovalStep>,
    @InjectRepository(ApprovalHistory)
    private auditRepository: Repository<ApprovalHistory>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private workflowTemplateService: WorkflowTemplateService,
    private approvalRulesService: ApprovalRulesService,
  ) {}

  /**
   * Initiates a new workflow for the given entity
   */
  async initiateWorkflow(context: WorkflowContext): Promise<WorkflowInstance> {
    this.logger.log(`Initiating workflow for ${context.entityType}:${context.entityId}`);

    // Step 1: Select appropriate workflow template
    const template = await this.workflowTemplateService.selectTemplate(context);
    if (!template) {
      throw new Error(
        `No suitable workflow template found for ${context.entityType} with given criteria`
      );
    }

    // Step 2: Create workflow instance
    const workflowInstance = await this.createWorkflowInstance(template, context);

    // Step 3: Create approval steps based on template
    await this.createApprovalSteps(workflowInstance, template, context);

    // Step 4: Start the first step
    await this.startNextStep(workflowInstance.id);

    this.logger.log(`Workflow ${workflowInstance.id} initiated successfully`);
    return workflowInstance;
  }

  /**
   * Processes an approval decision for a workflow step
   */
  async processApprovalDecision(
    stepId: string,
    approverId: string,
    decision: 'approve' | 'reject',
    comments?: string,
    metadata?: Record<string, any>,
  ): Promise<StepExecutionResult> {
    this.logger.log(`Processing ${decision} decision for step ${stepId} by user ${approverId}`);

    return await this.workflowInstanceRepository.manager.transaction(async (manager) => {
      const step = await manager.findOne(ApprovalStep, {
        where: { id: stepId },
        relations: ['workflowInstance', 'assignedUser', 'workflowInstance.template'],
      });

      if (!step) {
        throw new Error(`Approval step ${stepId} not found`);
      }

      // Validate the approver has permission
      if (!step.canBeApprovedBy(approverId)) {
        throw new Error(`User ${approverId} is not authorized to approve step ${stepId}`);
      }

      // Update step status
      const newStatus = decision === 'approve'
        ? ApprovalStepStatus.APPROVED
        : ApprovalStepStatus.REJECTED;

      await this.updateStepStatus(manager, step, newStatus, approverId, comments, metadata);

      // Create audit entry
      await this.createAuditEntry(manager, step, decision === 'approve' ? AuditAction.STEP_APPROVED : AuditAction.STEP_REJECTED, {
        performedById: approverId,
        comments,
        metadata,
      });

      // Handle step completion logic
      if (decision === 'reject') {
        // Rejection ends the workflow
        return await this.handleWorkflowRejection(manager, step.workflowInstance, step, comments);
      }

      // For approvals, check if step is fully completed
      if (this.isStepFullyCompleted(step)) {
        return await this.handleStepCompletion(manager, step);
      }

      return {
        success: true,
        stepId: step.id,
        status: newStatus,
        workflowCompleted: false,
      };
    });
  }

  /**
   * Escalates a workflow step to the next level
   */
  async escalateStep(
    stepId: string,
    reason: string,
    escalatedById?: string,
  ): Promise<StepExecutionResult> {
    this.logger.log(`Escalating step ${stepId}, reason: ${reason}`);

    return await this.workflowInstanceRepository.manager.transaction(async (manager) => {
      const step = await manager.findOne(ApprovalStep, {
        where: { id: stepId },
        relations: ['workflowInstance', 'assignedUser'],
      });

      if (!step) {
        throw new Error(`Approval step ${stepId} not found`);
      }

      // Find escalation target
      const escalationTarget = await this.findEscalationTarget(step.assignedUser);
      if (!escalationTarget) {
        throw new Error(`No escalation target found for step ${stepId}`);
      }

      // Update step with escalation
      step.status = ApprovalStepStatus.ESCALATED;
      step.escalationCount += 1;
      step.assignedUserId = escalationTarget.id;
      step.assignedUser = escalationTarget;

      await manager.save(ApprovalStep, step);

      // Create audit entry
      await this.createAuditEntry(manager, step, AuditAction.STEP_ESCALATED, {
        performedById: escalatedById,
        affectedUserId: escalationTarget.id,
        metadata: {
          escalationReason: reason,
          escalationLevel: step.escalationCount,
          originalAssigneeId: step.originalAssigneeId || step.assignedUserId,
        },
      });

      return {
        success: true,
        stepId: step.id,
        status: ApprovalStepStatus.ESCALATED,
        workflowCompleted: false,
      };
    });
  }

  /**
   * Cancels an active workflow
   */
  async cancelWorkflow(
    workflowInstanceId: string,
    reason: string,
    cancelledById: string,
  ): Promise<void> {
    this.logger.log(`Cancelling workflow ${workflowInstanceId}, reason: ${reason}`);

    await this.workflowInstanceRepository.manager.transaction(async (manager) => {
      const workflowInstance = await manager.findOne(WorkflowInstance, {
        where: { id: workflowInstanceId },
        relations: ['approvalSteps'],
      });

      if (!workflowInstance) {
        throw new Error(`Workflow instance ${workflowInstanceId} not found`);
      }

      // Update workflow status
      workflowInstance.status = WorkflowStatus.CANCELLED;
      workflowInstance.cancelledAt = new Date();
      workflowInstance.cancellationReason = reason || 'No reason provided';

      await manager.save(WorkflowInstance, workflowInstance);

      // Cancel all pending steps
      for (const step of workflowInstance.approvalSteps) {
        if (step.isPending()) {
          step.status = ApprovalStepStatus.SKIPPED;
          await manager.save(ApprovalStep, step);
        }
      }
    });
  }

  /**
   * Gets the current status of a workflow instance
   */
  async getWorkflowStatus(workflowInstanceId: string): Promise<WorkflowInstance | null> {
    return await this.workflowInstanceRepository.findOne({
      where: { id: workflowInstanceId },
      relations: [
        'template',
        'approvalSteps',
        'approvalSteps.assignedUser',
        'approvalSteps.decidedBy',
        'approvalSteps.history',
      ],
    });
  }

  /**
   * Gets all active workflows for a user (where they are an approver)
   */
  async getActiveWorkflowsForUser(userId: string): Promise<ApprovalStep[]> {
    return await this.approvalStepRepository.find({
      where: {
        assignedUserId: userId,
        status: ApprovalStepStatus.PENDING,
      },
      relations: [
        'workflowInstance',
        'workflowInstance.template',
        'workflowInstance.leaveRequest',
        'workflowInstance.leaveRequest.user',
      ],
      order: {
        dueAt: 'ASC',
        createdAt: 'ASC',
      },
    });
  }

  // Private helper methods

  private async createWorkflowInstance(
    template: WorkflowTemplate,
    context: WorkflowContext,
  ): Promise<WorkflowInstance> {
    const workflowInstance = this.workflowInstanceRepository.create({
      templateId: template.id,
      template,
      entityType: context.entityType,
      entityId: context.entityId,
      status: WorkflowStatus.ACTIVE,
      currentStepOrder: 1,
      context: {
        ...context.entityData,
        requestorId: context.requestorId,
        triggeredBy: context.triggeredBy,
        urgencyLevel: context.urgencyLevel,
        ...context.metadata,
      },
    });

    return await this.workflowInstanceRepository.save(workflowInstance);
  }

  private async createApprovalSteps(
    workflowInstance: WorkflowInstance,
    template: WorkflowTemplate,
    context: WorkflowContext,
  ): Promise<void> {
    const steps: ApprovalStep[] = [];

    for (const stepDef of template.stepDefinitions) {
      // Check if step should be included based on conditional logic
      if (!this.shouldIncludeStep(stepDef, context)) {
        continue;
      }

      // Resolve approvers for this step
      const approvers = await this.resolveApprovers(stepDef, context);
      if (approvers.length === 0 && stepDef.isRequired) {
        throw new Error(`No approvers found for required step: ${stepDef.stepName}`);
      }

      // Create approval step
      const step = this.approvalStepRepository.create({
        workflowInstance: workflowInstance,
        stepOrder: stepDef.stepOrder,
        stepName: stepDef.stepName,
        stepType: stepDef.stepType,
        status: ApprovalStepStatus.PENDING,
        assignedUserId: approvers[0]?.id,
        requiredApproverIds: approvers.map(u => u.id),
        isRequired: stepDef.isRequired,
        timeoutHours: stepDef.timeoutHours,
        dueAt: stepDef.timeoutHours
          ? new Date(Date.now() + stepDef.timeoutHours * 60 * 60 * 1000)
          : undefined,
      });

      steps.push(step);
    }

    await this.approvalStepRepository.save(steps);
  }

  private shouldIncludeStep(stepDef: any, context: WorkflowContext): boolean {
    if (!stepDef.conditionalLogic) return true;

    const condition = stepDef.conditionalLogic;
    const fieldValue = context.entityData[condition.field];

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
        return true;
    }
  }

  private async resolveApprovers(stepDef: any, context: WorkflowContext): Promise<User[]> {
    return await this.approvalRulesService.resolveApprovers(
      stepDef.approverSelectionRule,
      context,
      stepDef.specificUserIds
    );
  }

  private async startNextStep(workflowInstanceId: string): Promise<void> {
    const workflowInstance = await this.getWorkflowStatus(workflowInstanceId);
    if (!workflowInstance) return;

    const currentStep = workflowInstance.getCurrentStep();
    if (currentStep) {
      // Create audit entry for step creation
      await this.createAuditEntry(
        this.workflowInstanceRepository.manager,
        currentStep,
        AuditAction.STEP_CREATED,
        {
          affectedUserId: currentStep.assignedUserId,
        }
      );
    }
  }

  private async handleStepCompletion(
    manager: EntityManager,
    completedStep: ApprovalStep,
  ): Promise<StepExecutionResult> {
    const workflowInstance = completedStep.workflowInstance;

    // Find next step
    const nextStep = await manager.findOne(ApprovalStep, {
      where: {
        workflowInstanceId: workflowInstance.id,
        stepOrder: completedStep.stepOrder + 1,
        status: ApprovalStepStatus.PENDING,
      },
    });

    if (nextStep) {
      // Continue to next step
      workflowInstance.currentStepOrder = nextStep.stepOrder;
      await manager.save(WorkflowInstance, workflowInstance);

      return {
        success: true,
        stepId: completedStep.id,
        status: ApprovalStepStatus.APPROVED,
        nextStepId: nextStep.id,
        workflowCompleted: false,
      };
    } else {
      // Workflow completed successfully
      workflowInstance.status = WorkflowStatus.COMPLETED;
      workflowInstance.completedAt = new Date();
      await manager.save(WorkflowInstance, workflowInstance);

      // Update the underlying entity (e.g., approve the leave request)
      await this.updateEntityAfterWorkflowCompletion(manager, workflowInstance);

      return {
        success: true,
        stepId: completedStep.id,
        status: ApprovalStepStatus.APPROVED,
        workflowCompleted: true,
      };
    }
  }

  private async handleWorkflowRejection(
    manager: EntityManager,
    workflowInstance: WorkflowInstance,
    rejectedStep: ApprovalStep,
    reason: string | undefined,
  ): Promise<StepExecutionResult> {
    // Mark workflow as cancelled
    workflowInstance.status = WorkflowStatus.CANCELLED;
    workflowInstance.cancelledAt = new Date();
    workflowInstance.cancellationReason = reason || 'No reason provided';
    await manager.save(WorkflowInstance, workflowInstance);

    // Update the underlying entity (e.g., reject the leave request)
    await this.updateEntityAfterWorkflowRejection(manager, workflowInstance, reason);

    return {
      success: true,
      stepId: rejectedStep.id,
      status: ApprovalStepStatus.REJECTED,
      workflowCompleted: true,
    };
  }

  private isStepFullyCompleted(step: ApprovalStep): boolean {
    switch (step.stepType) {
      case StepType.SINGLE_APPROVER:
        return step.status === ApprovalStepStatus.APPROVED;
      case StepType.ANY_OF_MULTIPLE:
        return step.completedApproverIds.length > 0;
      case StepType.ALL_OF_MULTIPLE:
        return step.completedApproverIds.length === step.requiredApproverIds.length;
      default:
        return step.status === ApprovalStepStatus.APPROVED;
    }
  }

  private async updateStepStatus(
    manager: EntityManager,
    step: ApprovalStep,
    status: ApprovalStepStatus,
    decidedById: string,
    comments?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    step.status = status;
    step.decidedAt = new Date();
    step.decidedById = decidedById;
    step.comments = comments || null;

    // For multi-approver steps, track individual approvals
    if (step.stepType === StepType.ALL_OF_MULTIPLE || step.stepType === StepType.ANY_OF_MULTIPLE) {
      if (!step.completedApproverIds.includes(decidedById)) {
        step.completedApproverIds.push(decidedById);
      }
    }

    await manager.save(ApprovalStep, step);
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

  private async findEscalationTarget(currentAssignee: User): Promise<User | null> {
    // Simple escalation: go to the current assignee's manager
    if (currentAssignee.manager) {
      return currentAssignee.manager;
    }

    // If no manager, escalate to HR role
    return await this.userRepository.findOne({
      where: { role: UserRole.HR, isActive: true },
    });
  }

  private async updateEntityAfterWorkflowCompletion(
    manager: EntityManager,
    workflowInstance: WorkflowInstance,
  ): Promise<void> {
    if (workflowInstance.entityType === 'leave_request') {
      const leaveRequest = await manager.findOne(LeaveRequest, {
        where: { id: workflowInstance.entityId },
      });

      if (leaveRequest) {
        leaveRequest.status = 'approved' as any;
        leaveRequest.approvedAt = new Date();
        await manager.save(LeaveRequest, leaveRequest);
      }
    }
  }

  private async updateEntityAfterWorkflowRejection(
    manager: EntityManager,
    workflowInstance: WorkflowInstance,
    reason: string | undefined,
  ): Promise<void> {
    if (workflowInstance.entityType === 'leave_request') {
      const leaveRequest = await manager.findOne(LeaveRequest, {
        where: { id: workflowInstance.entityId },
      });

      if (leaveRequest) {
        leaveRequest.status = 'rejected' as any;
        leaveRequest.rejectionReason = reason || null;
        await manager.save(LeaveRequest, leaveRequest);
      }
    }
  }
}