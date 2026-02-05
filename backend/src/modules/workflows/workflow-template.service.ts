import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkflowTemplate, WorkflowTrigger } from './entities/workflow-template.entity';
import { WorkflowContext } from './workflow-engine.service';

export interface CreateWorkflowTemplateDto {
  name: string;
  description?: string;
  trigger: WorkflowTrigger;
  stepDefinitions: any[];
  applicabilityRules: any;
  isActive?: boolean;
}

export interface TemplateSelectionCriteria {
  leaveType?: string;
  userRole?: string;
  department?: string;
  duration?: number;
  advanceNotice?: number;
  userLevel?: string;
  teamSize?: number;
}

@Injectable()
export class WorkflowTemplateService {
  private readonly logger = new Logger(WorkflowTemplateService.name);

  constructor(
    @InjectRepository(WorkflowTemplate)
    private templateRepository: Repository<WorkflowTemplate>,
  ) {}

  /**
   * Creates a new workflow template
   */
  async createTemplate(dto: CreateWorkflowTemplateDto): Promise<WorkflowTemplate> {
    this.logger.log(`Creating new workflow template: ${dto.name}`);

    // Validate step definitions
    this.validateStepDefinitions(dto.stepDefinitions);

    const template = this.templateRepository.create({
      ...dto,
      isActive: dto.isActive ?? true,
      version: 1,
    });

    return await this.templateRepository.save(template);
  }

  /**
   * Selects the most appropriate workflow template for the given context
   */
  async selectTemplate(context: WorkflowContext): Promise<WorkflowTemplate | null> {
    this.logger.log(`Selecting template for ${context.entityType}:${context.entityId}`);

    const criteria = this.extractCriteriaFromContext(context);
    const candidates = await this.findCandidateTemplates(criteria);

    if (candidates.length === 0) {
      this.logger.warn(`No workflow templates found for criteria: ${JSON.stringify(criteria)}`);
      return null;
    }

    // Score and rank templates by specificity
    const rankedTemplates = this.rankTemplatesBySpecificity(candidates, criteria);

    const selectedTemplate = rankedTemplates[0];
    this.logger.log(`Selected template: ${selectedTemplate.name} for ${context.entityType}`);

    return selectedTemplate;
  }

  /**
   * Gets all active workflow templates
   */
  async getActiveTemplates(): Promise<WorkflowTemplate[]> {
    return await this.templateRepository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Gets a workflow template by ID
   */
  async getTemplate(id: string): Promise<WorkflowTemplate | null> {
    return await this.templateRepository.findOne({ where: { id } });
  }

  /**
   * Updates an existing workflow template
   */
  async updateTemplate(
    id: string,
    updates: Partial<CreateWorkflowTemplateDto>,
  ): Promise<WorkflowTemplate> {
    const template = await this.getTemplate(id);
    if (!template) {
      throw new Error(`Workflow template ${id} not found`);
    }

    if (updates.stepDefinitions) {
      this.validateStepDefinitions(updates.stepDefinitions);
    }

    // Create new version if template is already in use
    const hasActiveInstances = await this.hasActiveInstances(id);
    if (hasActiveInstances) {
      const newTemplate = await this.createNewVersion(template, updates);
      this.logger.log(`Created new version ${newTemplate.version} of template ${template.name}`);
      return newTemplate;
    } else {
      // Safe to update existing template
      Object.assign(template, updates);
      return await this.templateRepository.save(template);
    }
  }

  /**
   * Deactivates a workflow template
   */
  async deactivateTemplate(id: string): Promise<void> {
    await this.templateRepository.update({ id }, { isActive: false });
    this.logger.log(`Deactivated workflow template ${id}`);
  }

  /**
   * Creates default workflow templates for the system
   */
  async createDefaultTemplates(): Promise<WorkflowTemplate[]> {
    const defaultTemplates = this.getDefaultTemplateDefinitions();
    const createdTemplates: WorkflowTemplate[] = [];

    for (const templateDef of defaultTemplates) {
      // Check if template already exists
      const existing = await this.templateRepository.findOne({
        where: { name: templateDef.name },
      });

      if (!existing) {
        const template = await this.createTemplate(templateDef);
        createdTemplates.push(template);
        this.logger.log(`Created default template: ${template.name}`);
      }
    }

    return createdTemplates;
  }

  // Private helper methods

  private validateStepDefinitions(stepDefinitions: any[]): void {
    if (!Array.isArray(stepDefinitions) || stepDefinitions.length === 0) {
      throw new Error('Step definitions must be a non-empty array');
    }

    const stepOrders = stepDefinitions.map(step => step.stepOrder);
    if (new Set(stepOrders).size !== stepOrders.length) {
      throw new Error('Step order values must be unique');
    }

    for (const step of stepDefinitions) {
      if (!step.stepName || !step.stepType || !step.approverSelectionRule) {
        throw new Error('Each step must have stepName, stepType, and approverSelectionRule');
      }

      if (typeof step.stepOrder !== 'number' || step.stepOrder < 1) {
        throw new Error('Step order must be a positive number');
      }

      if (typeof step.isRequired !== 'boolean') {
        throw new Error('isRequired must be a boolean value');
      }
    }
  }

  private extractCriteriaFromContext(context: WorkflowContext): TemplateSelectionCriteria {
    const entityData = context.entityData;

    return {
      leaveType: entityData.type || entityData.leaveType,
      userRole: entityData.userRole,
      department: entityData.department,
      duration: entityData.totalDays || entityData.duration,
      advanceNotice: entityData.advanceNotice,
      userLevel: entityData.userLevel,
      teamSize: entityData.teamSize,
    };
  }

  private async findCandidateTemplates(
    criteria: TemplateSelectionCriteria,
  ): Promise<WorkflowTemplate[]> {
    const allTemplates = await this.getActiveTemplates();

    return allTemplates.filter(template =>
      this.templateMatchesCriteria(template, criteria)
    );
  }

  private templateMatchesCriteria(
    template: WorkflowTemplate,
    criteria: TemplateSelectionCriteria,
  ): boolean {
    const rules = template.applicabilityRules;

    // Check leave types
    if (rules.leaveTypes && criteria.leaveType) {
      if (!rules.leaveTypes.includes(criteria.leaveType)) {
        return false;
      }
    }

    // Check user roles
    if (rules.userRoles && criteria.userRole) {
      if (!rules.userRoles.includes(criteria.userRole)) {
        return false;
      }
    }

    // Check departments
    if (rules.departments && criteria.department) {
      if (!rules.departments.includes(criteria.department)) {
        return false;
      }
    }

    // Check duration limits
    if (criteria.duration !== undefined) {
      if (rules.minDuration && criteria.duration < rules.minDuration) {
        return false;
      }
      if (rules.maxDuration && criteria.duration > rules.maxDuration) {
        return false;
      }
    }

    // Check advance notice
    if (rules.minAdvanceNotice && criteria.advanceNotice !== undefined) {
      if (criteria.advanceNotice < rules.minAdvanceNotice) {
        return false;
      }
    }

    // Check user levels
    if (rules.userLevels && criteria.userLevel) {
      if (!rules.userLevels.includes(criteria.userLevel)) {
        return false;
      }
    }

    // Check team size constraints
    if (rules.teamSizes && criteria.teamSize !== undefined) {
      const { min, max } = rules.teamSizes;
      if (min && criteria.teamSize < min) return false;
      if (max && criteria.teamSize > max) return false;
    }

    return true;
  }

  private rankTemplatesBySpecificity(
    templates: WorkflowTemplate[],
    criteria: TemplateSelectionCriteria,
  ): WorkflowTemplate[] {
    const scored = templates.map(template => ({
      template,
      score: this.calculateSpecificityScore(template, criteria),
    }));

    // Sort by score descending (higher score = more specific)
    scored.sort((a, b) => b.score - a.score);

    return scored.map(item => item.template);
  }

  private calculateSpecificityScore(
    template: WorkflowTemplate,
    criteria: TemplateSelectionCriteria,
  ): number {
    let score = 0;
    const rules = template.applicabilityRules;

    // More specific criteria = higher score
    if (rules.leaveTypes) score += rules.leaveTypes.length * 10;
    if (rules.userRoles) score += rules.userRoles.length * 8;
    if (rules.departments) score += rules.departments.length * 6;
    if (rules.userLevels) score += rules.userLevels.length * 4;
    if (rules.minDuration || rules.maxDuration) score += 5;
    if (rules.minAdvanceNotice) score += 3;
    if (rules.teamSizes) score += 2;

    // Exact matches get bonus points
    if (rules.leaveTypes && criteria.leaveType && rules.leaveTypes.includes(criteria.leaveType)) {
      score += 50;
    }
    if (rules.userRoles && criteria.userRole && rules.userRoles.includes(criteria.userRole)) {
      score += 30;
    }
    if (rules.departments && criteria.department && rules.departments.includes(criteria.department)) {
      score += 20;
    }

    return score;
  }

  private async hasActiveInstances(templateId: string): Promise<boolean> {
    // This would check if there are any active workflow instances using this template
    // For now, we'll return false to allow direct updates
    // In a real implementation, you'd query the workflow_instances table
    return false;
  }

  private async createNewVersion(
    originalTemplate: WorkflowTemplate,
    updates: Partial<CreateWorkflowTemplateDto>,
  ): Promise<WorkflowTemplate> {
    // Deactivate the original template
    originalTemplate.isActive = false;
    await this.templateRepository.save(originalTemplate);

    // Create new version
    const newTemplate = this.templateRepository.create({
      ...originalTemplate,
      id: undefined, // Let TypeORM generate new ID
      version: originalTemplate.version + 1,
      isActive: true,
      ...updates,
    });

    return await this.templateRepository.save(newTemplate);
  }

  private getDefaultTemplateDefinitions(): CreateWorkflowTemplateDto[] {
    return [
      {
        name: 'Standard Leave Approval',
        description: 'Standard single-manager approval for regular leave requests',
        trigger: WorkflowTrigger.LEAVE_REQUEST_CREATED,
        applicabilityRules: {
          leaveTypes: ['annual', 'personal'],
          maxDuration: 5,
        },
        stepDefinitions: [
          {
            stepOrder: 1,
            stepName: 'Manager Approval',
            stepType: 'SINGLE_APPROVER',
            approverSelectionRule: 'DIRECT_MANAGER',
            isRequired: true,
            timeoutHours: 72,
          },
        ],
      },
      {
        name: 'Extended Leave Approval',
        description: 'Multi-level approval for extended leave requests',
        trigger: WorkflowTrigger.LEAVE_REQUEST_CREATED,
        applicabilityRules: {
          leaveTypes: ['annual', 'personal'],
          minDuration: 6,
          maxDuration: 21,
        },
        stepDefinitions: [
          {
            stepOrder: 1,
            stepName: 'Manager Approval',
            stepType: 'SINGLE_APPROVER',
            approverSelectionRule: 'DIRECT_MANAGER',
            isRequired: true,
            timeoutHours: 48,
          },
          {
            stepOrder: 2,
            stepName: 'HR Review',
            stepType: 'SINGLE_APPROVER',
            approverSelectionRule: 'HR_TEAM',
            isRequired: true,
            timeoutHours: 72,
          },
        ],
      },
      {
        name: 'Sick Leave Approval',
        description: 'Fast-track approval for sick leave',
        trigger: WorkflowTrigger.LEAVE_REQUEST_CREATED,
        applicabilityRules: {
          leaveTypes: ['sick'],
          maxDuration: 3,
        },
        stepDefinitions: [
          {
            stepOrder: 1,
            stepName: 'Manager Notification',
            stepType: 'SINGLE_APPROVER',
            approverSelectionRule: 'DIRECT_MANAGER',
            isRequired: false,
            timeoutHours: 24,
            autoApprovalRules: {
              conditions: [
                { field: 'totalDays', operator: 'lte', value: 3 },
              ],
            },
          },
        ],
      },
      {
        name: 'Executive Leave Approval',
        description: 'Special approval process for executives and managers',
        trigger: WorkflowTrigger.LEAVE_REQUEST_CREATED,
        applicabilityRules: {
          userRoles: ['manager', 'hr'],
          leaveTypes: ['annual', 'personal'],
        },
        stepDefinitions: [
          {
            stepOrder: 1,
            stepName: 'Department Head Approval',
            stepType: 'SINGLE_APPROVER',
            approverSelectionRule: 'DEPARTMENT_HEAD',
            isRequired: true,
            timeoutHours: 72,
          },
          {
            stepOrder: 2,
            stepName: 'HR Director Review',
            stepType: 'SINGLE_APPROVER',
            approverSelectionRule: 'HR_TEAM',
            isRequired: true,
            timeoutHours: 96,
            conditionalLogic: {
              field: 'totalDays',
              operator: 'gt',
              value: 10,
            },
          },
        ],
      },
      {
        name: 'Maternity/Paternity Leave',
        description: 'Approval process for parental leave',
        trigger: WorkflowTrigger.LEAVE_REQUEST_CREATED,
        applicabilityRules: {
          leaveTypes: ['maternity', 'paternity'],
        },
        stepDefinitions: [
          {
            stepOrder: 1,
            stepName: 'Manager Approval',
            stepType: 'SINGLE_APPROVER',
            approverSelectionRule: 'DIRECT_MANAGER',
            isRequired: true,
            timeoutHours: 48,
          },
          {
            stepOrder: 2,
            stepName: 'HR Legal Review',
            stepType: 'SINGLE_APPROVER',
            approverSelectionRule: 'HR_TEAM',
            isRequired: true,
            timeoutHours: 120,
          },
        ],
      },
    ];
  }
}