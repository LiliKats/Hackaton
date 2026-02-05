import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkflowInstance } from './entities/workflow-instance.entity';
import { ApprovalStep, StepType } from './entities/approval-step.entity';
import { WorkflowTemplate } from './entities/workflow-template.entity';
import { User } from '../users/entities/user.entity';
import { ApprovalRulesService } from './approval-rules.service';
import { WorkflowContext } from './workflow-engine.service';

export interface RoutingRule {
  id: string;
  name: string;
  priority: number;
  conditions: RoutingCondition[];
  actions: RoutingAction[];
  isActive: boolean;
}

export interface RoutingCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains' | 'regex';
  value: any;
  logicalOperator?: 'AND' | 'OR'; // How to combine with the next condition
}

export interface RoutingAction {
  type: 'add_step' | 'skip_step' | 'modify_step' | 'escalate' | 'auto_approve' | 'notify' | 'branch';
  parameters: Record<string, any>;
}

export interface RoutingDecision {
  shouldRoute: boolean;
  targetSteps: string[];
  skipSteps: string[];
  modifications: StepModification[];
  notifications: NotificationInstruction[];
  branchWorkflows: BranchInstruction[];
}

export interface StepModification {
  stepId: string;
  changes: {
    approvers?: string[];
    timeoutHours?: number;
    isRequired?: boolean;
    stepType?: StepType;
  };
}

export interface NotificationInstruction {
  recipients: string[];
  templateId: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  data: Record<string, any>;
}

export interface BranchInstruction {
  templateId: string;
  context: WorkflowContext;
  triggerCondition: string;
}

@Injectable()
export class ConditionalRoutingService {
  private readonly logger = new Logger(ConditionalRoutingService.name);

  // Built-in routing rules
  private readonly defaultRoutingRules: RoutingRule[] = [
    {
      id: 'extended-leave-hr-review',
      name: 'Extended Leave HR Review',
      priority: 100,
      conditions: [
        { field: 'totalDays', operator: 'gt', value: 10 },
        { field: 'type', operator: 'in', value: ['annual', 'personal'], logicalOperator: 'AND' },
      ],
      actions: [
        {
          type: 'add_step',
          parameters: {
            stepName: 'HR Extended Leave Review',
            stepOrder: 99,
            approverSelectionRule: 'HR_TEAM',
            isRequired: true,
            timeoutHours: 72,
          },
        },
      ],
      isActive: true,
    },
    {
      id: 'senior-management-approval',
      name: 'Senior Management Approval',
      priority: 90,
      conditions: [
        { field: 'userRole', operator: 'in', value: ['manager', 'hr'] },
        { field: 'totalDays', operator: 'gt', value: 5, logicalOperator: 'AND' },
      ],
      actions: [
        {
          type: 'add_step',
          parameters: {
            stepName: 'Senior Management Approval',
            stepOrder: 98,
            approverSelectionRule: 'DEPARTMENT_HEAD',
            isRequired: true,
            timeoutHours: 96,
          },
        },
      ],
      isActive: true,
    },
    {
      id: 'emergency-leave-fast-track',
      name: 'Emergency Leave Fast Track',
      priority: 110,
      conditions: [
        { field: 'urgencyLevel', operator: 'eq', value: 'critical' },
        { field: 'type', operator: 'eq', value: 'sick', logicalOperator: 'OR' },
        { field: 'advanceNotice', operator: 'lt', value: 1, logicalOperator: 'OR' },
      ],
      actions: [
        {
          type: 'modify_step',
          parameters: {
            targetStep: 'all',
            timeoutHours: 4,
          },
        },
        {
          type: 'notify',
          parameters: {
            templateId: 'emergency-leave-notification',
            recipients: 'all_approvers',
            priority: 'urgent',
          },
        },
      ],
      isActive: true,
    },
    {
      id: 'team-capacity-check',
      name: 'Team Capacity Check',
      priority: 80,
      conditions: [
        { field: 'teamLeavePercentage', operator: 'gt', value: 30 },
      ],
      actions: [
        {
          type: 'add_step',
          parameters: {
            stepName: 'Team Capacity Review',
            stepOrder: 1.5, // Insert between existing steps
            approverSelectionRule: 'TEAM_LEAD',
            isRequired: true,
            timeoutHours: 48,
            conditionalLogic: {
              field: 'teamLeavePercentage',
              operator: 'gt',
              value: 30,
            },
          },
        },
        {
          type: 'notify',
          parameters: {
            templateId: 'team-capacity-warning',
            recipients: 'hr_team',
            priority: 'high',
          },
        },
      ],
      isActive: true,
    },
    {
      id: 'auto-approve-short-sick',
      name: 'Auto Approve Short Sick Leave',
      priority: 120,
      conditions: [
        { field: 'type', operator: 'eq', value: 'sick' },
        { field: 'totalDays', operator: 'lte', value: 2, logicalOperator: 'AND' },
        { field: 'userRole', operator: 'eq', value: 'employee', logicalOperator: 'AND' },
      ],
      actions: [
        {
          type: 'auto_approve',
          parameters: {
            reason: 'Auto-approved short sick leave',
            notifyManager: true,
          },
        },
      ],
      isActive: true,
    },
  ];

  constructor(
    @InjectRepository(WorkflowInstance)
    private workflowInstanceRepository: Repository<WorkflowInstance>,
    @InjectRepository(ApprovalStep)
    private approvalStepRepository: Repository<ApprovalStep>,
    @InjectRepository(WorkflowTemplate)
    private workflowTemplateRepository: Repository<WorkflowTemplate>,
    private approvalRulesService: ApprovalRulesService,
  ) {}

  /**
   * Evaluates routing rules and makes routing decisions for a workflow
   */
  async evaluateRouting(
    workflowInstanceId: string,
    context: WorkflowContext,
    triggerEvent: 'workflow_start' | 'step_completed' | 'step_timeout' | 'external_event',
  ): Promise<RoutingDecision> {
    this.logger.log(
      `Evaluating conditional routing for workflow ${workflowInstanceId}, trigger: ${triggerEvent}`
    );

    const workflowInstance = await this.workflowInstanceRepository.findOne({
      where: { id: workflowInstanceId },
      relations: ['template', 'approvalSteps'],
    });

    if (!workflowInstance) {
      throw new Error(`Workflow instance ${workflowInstanceId} not found`);
    }

    // Get all applicable routing rules
    const applicableRules = this.getApplicableRules(context, triggerEvent);

    // Sort rules by priority (higher priority first)
    const sortedRules = applicableRules.sort((a, b) => b.priority - a.priority);

    const decision: RoutingDecision = {
      shouldRoute: false,
      targetSteps: [],
      skipSteps: [],
      modifications: [],
      notifications: [],
      branchWorkflows: [],
    };

    // Evaluate each rule
    for (const rule of sortedRules) {
      if (this.evaluateRuleConditions(rule.conditions, context)) {
        this.logger.log(`Routing rule matched: ${rule.name}`);

        // Process rule actions
        await this.processRuleActions(
          rule.actions,
          workflowInstance,
          context,
          decision
        );

        decision.shouldRoute = true;
      }
    }

    if (decision.shouldRoute) {
      this.logger.log(
        `Routing decision made: ${decision.targetSteps.length} target steps, ` +
        `${decision.modifications.length} modifications, ` +
        `${decision.notifications.length} notifications`
      );
    }

    return decision;
  }

  /**
   * Applies a routing decision to modify the workflow
   */
  async applyRoutingDecision(
    workflowInstanceId: string,
    decision: RoutingDecision,
    context: WorkflowContext,
  ): Promise<void> {
    if (!decision.shouldRoute) {
      return;
    }

    this.logger.log(`Applying routing decision for workflow ${workflowInstanceId}`);

    await this.workflowInstanceRepository.manager.transaction(async (manager) => {
      // 1. Add new steps
      if (decision.targetSteps.length > 0) {
        await this.addConditionalSteps(manager, workflowInstanceId, decision.targetSteps, context);
      }

      // 2. Skip steps
      if (decision.skipSteps.length > 0) {
        await this.skipSteps(manager, workflowInstanceId, decision.skipSteps);
      }

      // 3. Apply step modifications
      if (decision.modifications.length > 0) {
        await this.applyStepModifications(manager, workflowInstanceId, decision.modifications);
      }

      // 4. Send notifications
      if (decision.notifications.length > 0) {
        await this.sendRoutingNotifications(decision.notifications, context);
      }

      // 5. Create branch workflows
      if (decision.branchWorkflows.length > 0) {
        await this.createBranchWorkflows(decision.branchWorkflows);
      }
    });

    this.logger.log(`Successfully applied routing decision for workflow ${workflowInstanceId}`);
  }

  /**
   * Dynamically routes workflow based on real-time conditions
   */
  async dynamicRouting(
    workflowInstanceId: string,
    routingTrigger: string,
    dynamicData: Record<string, any>,
  ): Promise<void> {
    this.logger.log(
      `Performing dynamic routing for workflow ${workflowInstanceId}, trigger: ${routingTrigger}`
    );

    const workflowInstance = await this.workflowInstanceRepository.findOne({
      where: { id: workflowInstanceId },
      relations: ['template'],
    });

    if (!workflowInstance) {
      throw new Error(`Workflow instance ${workflowInstanceId} not found`);
    }

    // Create enhanced context with dynamic data
    const enhancedContext: WorkflowContext = {
      entityType: workflowInstance.entityType,
      entityId: workflowInstance.entityId,
      entityData: {
        ...workflowInstance.context,
        ...dynamicData,
      },
      requestorId: workflowInstance.context.requestorId,
      triggeredBy: 'dynamic_routing',
      metadata: {
        ...workflowInstance.context,
        routingTrigger,
        dynamicData,
      },
    };

    // Evaluate and apply routing
    const decision = await this.evaluateRouting(
      workflowInstanceId,
      enhancedContext,
      'external_event'
    );

    if (decision.shouldRoute) {
      await this.applyRoutingDecision(workflowInstanceId, decision, enhancedContext);
    }
  }

  /**
   * Creates a custom routing rule
   */
  async createCustomRoutingRule(rule: Omit<RoutingRule, 'id'>): Promise<RoutingRule> {
    const customRule: RoutingRule = {
      ...rule,
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    // Validate rule
    this.validateRoutingRule(customRule);

    // In a real implementation, you would save this to the database
    this.logger.log(`Created custom routing rule: ${customRule.name}`);

    return customRule;
  }

  /**
   * Gets routing rules applicable to a workflow context
   */
  getApplicableRules(
    context: WorkflowContext,
    triggerEvent: string,
  ): RoutingRule[] {
    // For now, return default rules
    // In a real implementation, you might filter based on entity type, user role, etc.
    return this.defaultRoutingRules.filter(rule => rule.isActive);
  }

  // Private helper methods

  private evaluateRuleConditions(
    conditions: RoutingCondition[],
    context: WorkflowContext,
  ): boolean {
    if (conditions.length === 0) return true;

    let result = true;
    let currentResult = true;

    for (let i = 0; i < conditions.length; i++) {
      const condition = conditions[i];
      const conditionResult = this.evaluateCondition(condition, context.entityData);

      if (i === 0) {
        result = conditionResult;
        currentResult = conditionResult;
      } else {
        const previousCondition = conditions[i - 1];
        const operator = previousCondition.logicalOperator || 'AND';

        if (operator === 'AND') {
          result = result && conditionResult;
        } else { // OR
          result = result || conditionResult;
        }
      }
    }

    return result;
  }

  private evaluateCondition(
    condition: RoutingCondition,
    data: Record<string, any>,
  ): boolean {
    const fieldValue = this.getNestedValue(data, condition.field);

    switch (condition.operator) {
      case 'eq':
        return fieldValue === condition.value;
      case 'ne':
        return fieldValue !== condition.value;
      case 'gt':
        return fieldValue > condition.value;
      case 'gte':
        return fieldValue >= condition.value;
      case 'lt':
        return fieldValue < condition.value;
      case 'lte':
        return fieldValue <= condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);
      case 'nin':
        return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
      case 'contains':
        return typeof fieldValue === 'string' &&
               typeof condition.value === 'string' &&
               fieldValue.toLowerCase().includes(condition.value.toLowerCase());
      case 'regex':
        if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
          const regex = new RegExp(condition.value, 'i');
          return regex.test(fieldValue);
        }
        return false;
      default:
        this.logger.warn(`Unknown condition operator: ${condition.operator}`);
        return false;
    }
  }

  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private async processRuleActions(
    actions: RoutingAction[],
    workflowInstance: WorkflowInstance,
    context: WorkflowContext,
    decision: RoutingDecision,
  ): Promise<void> {
    for (const action of actions) {
      switch (action.type) {
        case 'add_step':
          decision.targetSteps.push(action.parameters.stepName);
          break;

        case 'skip_step':
          decision.skipSteps.push(action.parameters.stepId || action.parameters.stepName);
          break;

        case 'modify_step':
          const modification: StepModification = {
            stepId: action.parameters.stepId || 'current',
            changes: action.parameters,
          };
          decision.modifications.push(modification);
          break;

        case 'notify':
          const notification: NotificationInstruction = {
            recipients: await this.resolveNotificationRecipients(
              action.parameters.recipients,
              workflowInstance,
              context
            ),
            templateId: action.parameters.templateId,
            priority: action.parameters.priority || 'medium',
            data: action.parameters.data || {},
          };
          decision.notifications.push(notification);
          break;

        case 'auto_approve':
          // Mark current step for auto-approval
          const currentStep = workflowInstance.getCurrentStep();
          if (currentStep) {
            const autoApprovalMod: StepModification = {
              stepId: currentStep.id,
              changes: {
                // Use stepType to indicate auto-approval
                stepType: StepType.AUTO_APPROVAL,
              },
            };
            decision.modifications.push(autoApprovalMod);
          }
          break;

        case 'escalate':
          // Add escalation modification
          const escalationMod: StepModification = {
            stepId: action.parameters.stepId || 'current',
            changes: {
              // For escalation, we can change timeout to force immediate escalation
              timeoutHours: 0,
            },
          };
          decision.modifications.push(escalationMod);
          break;

        case 'branch':
          const branchInstruction: BranchInstruction = {
            templateId: action.parameters.templateId,
            context: {
              ...context,
              entityData: {
                ...context.entityData,
                ...action.parameters.additionalData,
              },
            },
            triggerCondition: action.parameters.triggerCondition,
          };
          decision.branchWorkflows.push(branchInstruction);
          break;

        default:
          this.logger.warn(`Unknown routing action type: ${action.type}`);
      }
    }
  }

  private async addConditionalSteps(
    manager: any,
    workflowInstanceId: string,
    stepNames: string[],
    context: WorkflowContext,
  ): Promise<void> {
    // Implementation would create new approval steps based on step definitions
    this.logger.log(`Adding ${stepNames.length} conditional steps to workflow ${workflowInstanceId}`);
  }

  private async skipSteps(
    manager: any,
    workflowInstanceId: string,
    stepIds: string[],
  ): Promise<void> {
    // Mark steps as skipped
    await manager.update(
      ApprovalStep,
      { workflowInstanceId, id: In(stepIds) },
      { status: 'SKIPPED', comments: 'Skipped by conditional routing' }
    );
  }

  private async applyStepModifications(
    manager: any,
    workflowInstanceId: string,
    modifications: StepModification[],
  ): Promise<void> {
    for (const mod of modifications) {
      const updateData: any = {};

      if (mod.changes.timeoutHours) {
        updateData.timeoutHours = mod.changes.timeoutHours;
        updateData.dueAt = new Date(Date.now() + mod.changes.timeoutHours * 60 * 60 * 1000);
      }

      if (mod.changes.isRequired !== undefined) {
        updateData.isRequired = mod.changes.isRequired;
      }

      if (Object.keys(updateData).length > 0) {
        await manager.update(ApprovalStep, { id: mod.stepId }, updateData);
      }
    }
  }

  private async sendRoutingNotifications(
    notifications: NotificationInstruction[],
    context: WorkflowContext,
  ): Promise<void> {
    for (const notification of notifications) {
      this.logger.log(
        `Sending ${notification.priority} notification to ${notification.recipients.length} recipients ` +
        `using template ${notification.templateId}`
      );
      // Integration with notification service would go here
    }
  }

  private async createBranchWorkflows(
    branchInstructions: BranchInstruction[],
  ): Promise<void> {
    for (const instruction of branchInstructions) {
      this.logger.log(`Creating branch workflow with template ${instruction.templateId}`);
      // Integration with workflow engine to create branch workflows would go here
    }
  }

  private async resolveNotificationRecipients(
    recipients: string | string[],
    workflowInstance: WorkflowInstance,
    context: WorkflowContext,
  ): Promise<string[]> {
    if (Array.isArray(recipients)) {
      return recipients;
    }

    switch (recipients) {
      case 'all_approvers':
        const steps = await this.approvalStepRepository.find({
          where: { workflowInstanceId: workflowInstance.id },
        });
        return steps.flatMap(step => step.requiredApproverIds);

      case 'hr_team':
        const hrUsers = await this.approvalRulesService.resolveApprovers(
          'HR_TEAM' as any,
          context,
        );
        return hrUsers.map(u => u.id);

      case 'requestor':
        return [context.requestorId];

      default:
        return [recipients];
    }
  }

  private validateRoutingRule(rule: RoutingRule): void {
    if (!rule.name || !rule.conditions || !rule.actions) {
      throw new Error('Invalid routing rule: name, conditions, and actions are required');
    }

    if (rule.priority < 0 || rule.priority > 1000) {
      throw new Error('Routing rule priority must be between 0 and 1000');
    }

    // Validate conditions
    for (const condition of rule.conditions) {
      if (!condition.field || !condition.operator) {
        throw new Error('Invalid condition: field and operator are required');
      }
    }

    // Validate actions
    for (const action of rule.actions) {
      if (!action.type || !action.parameters) {
        throw new Error('Invalid action: type and parameters are required');
      }
    }
  }
}

// Import for the skipSteps method
import { In } from 'typeorm';