import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkflowTemplateService, CreateWorkflowTemplateDto } from '../workflow-template.service';
import { WorkflowTemplate, WorkflowTrigger, ApproverSelectionRule } from '../entities/workflow-template.entity';
import { StepType } from '../entities/approval-step.entity';
import { WorkflowContext } from '../workflow-engine.service';

describe('WorkflowTemplateService', () => {
  let service: WorkflowTemplateService;
  let templateRepo: Repository<WorkflowTemplate>;

  const mockTemplate: Partial<WorkflowTemplate> = {
    id: 'template-1',
    name: 'Standard Leave Approval',
    description: 'Standard single-manager approval',
    trigger: WorkflowTrigger.LEAVE_REQUEST_CREATED,
    isActive: true,
    version: 1,
    stepDefinitions: [
      {
        stepOrder: 1,
        stepName: 'Manager Approval',
        stepType: StepType.SINGLE_APPROVER,
        approverSelectionRule: ApproverSelectionRule.DIRECT_MANAGER,
        isRequired: true,
        timeoutHours: 72,
      },
    ],
    applicabilityRules: {
      leaveTypes: ['annual', 'personal'],
      maxDuration: 5,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowTemplateService,
        {
          provide: getRepositoryToken(WorkflowTemplate),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WorkflowTemplateService>(WorkflowTemplateService);
    templateRepo = module.get<Repository<WorkflowTemplate>>(getRepositoryToken(WorkflowTemplate));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTemplate', () => {
    it('should create a new workflow template', async () => {
      const createDto: CreateWorkflowTemplateDto = {
        name: 'Test Template',
        description: 'Test description',
        trigger: WorkflowTrigger.LEAVE_REQUEST_CREATED,
        stepDefinitions: [
          {
            stepOrder: 1,
            stepName: 'Manager Approval',
            stepType: 'SINGLE_APPROVER',
            approverSelectionRule: 'DIRECT_MANAGER',
            isRequired: true,
            timeoutHours: 48,
          },
        ],
        applicabilityRules: {
          leaveTypes: ['annual'],
        },
      };

      jest.spyOn(templateRepo, 'create').mockReturnValue(mockTemplate as WorkflowTemplate);
      jest.spyOn(templateRepo, 'save').mockResolvedValue(mockTemplate as WorkflowTemplate);

      const result = await service.createTemplate(createDto);

      expect(result).toBeDefined();
      expect(templateRepo.create).toHaveBeenCalledWith({
        ...createDto,
        isActive: true,
        version: 1,
      });
      expect(templateRepo.save).toHaveBeenCalled();
    });

    it('should validate step definitions before creating', async () => {
      const invalidDto: CreateWorkflowTemplateDto = {
        name: 'Invalid Template',
        description: 'Test description',
        trigger: WorkflowTrigger.LEAVE_REQUEST_CREATED,
        stepDefinitions: [], // Invalid - empty array
        applicabilityRules: {},
      };

      await expect(service.createTemplate(invalidDto)).rejects.toThrow(
        'Step definitions must be a non-empty array'
      );
    });

    it('should validate unique step orders', async () => {
      const invalidDto: CreateWorkflowTemplateDto = {
        name: 'Invalid Template',
        description: 'Test description',
        trigger: WorkflowTrigger.LEAVE_REQUEST_CREATED,
        stepDefinitions: [
          {
            stepOrder: 1,
            stepName: 'Step 1',
            stepType: 'SINGLE_APPROVER',
            approverSelectionRule: 'DIRECT_MANAGER',
            isRequired: true,
          },
          {
            stepOrder: 1, // Duplicate order
            stepName: 'Step 2',
            stepType: 'SINGLE_APPROVER',
            approverSelectionRule: 'HR_TEAM',
            isRequired: true,
          },
        ],
        applicabilityRules: {},
      };

      await expect(service.createTemplate(invalidDto)).rejects.toThrow(
        'Step order values must be unique'
      );
    });
  });

  describe('selectTemplate', () => {
    it('should select the most appropriate template for context', async () => {
      const context: WorkflowContext = {
        entityType: 'leave_request',
        entityId: 'leave-1',
        entityData: {
          type: 'annual',
          totalDays: 3,
          userRole: 'employee',
          department: 'engineering',
        },
        requestorId: 'user-1',
      };

      const templates = [
        {
          ...mockTemplate,
          applicabilityRules: {
            leaveTypes: ['annual'],
            maxDuration: 5,
          },
        },
        {
          ...mockTemplate,
          id: 'template-2',
          name: 'Extended Leave Approval',
          applicabilityRules: {
            leaveTypes: ['annual'],
            minDuration: 6,
          },
        },
      ];

      jest.spyOn(templateRepo, 'find').mockResolvedValue(templates as WorkflowTemplate[]);

      const result = await service.selectTemplate(context);

      expect(result).toBeDefined();
      expect(result!.id).toBe('template-1'); // First template should match
    });

    it('should return null if no templates match', async () => {
      const context: WorkflowContext = {
        entityType: 'leave_request',
        entityId: 'leave-1',
        entityData: {
          type: 'sick',
          totalDays: 1,
        },
        requestorId: 'user-1',
      };

      const templates = [
        {
          ...mockTemplate,
          applicabilityRules: {
            leaveTypes: ['annual'], // Doesn't match 'sick'
          },
        },
      ];

      jest.spyOn(templateRepo, 'find').mockResolvedValue(templates as WorkflowTemplate[]);

      const result = await service.selectTemplate(context);

      expect(result).toBeNull();
    });

    it('should rank templates by specificity', async () => {
      const context: WorkflowContext = {
        entityType: 'leave_request',
        entityId: 'leave-1',
        entityData: {
          type: 'annual',
          totalDays: 3,
          userRole: 'employee',
        },
        requestorId: 'user-1',
      };

      const templates = [
        {
          ...mockTemplate,
          id: 'template-generic',
          applicabilityRules: {
            leaveTypes: ['annual', 'personal'], // Less specific
          },
        },
        {
          ...mockTemplate,
          id: 'template-specific',
          applicabilityRules: {
            leaveTypes: ['annual'], // More specific
            userRoles: ['employee'],
            maxDuration: 5,
          },
        },
      ];

      jest.spyOn(templateRepo, 'find').mockResolvedValue(templates as WorkflowTemplate[]);

      const result = await service.selectTemplate(context);

      expect(result).toBeDefined();
      expect(result!.id).toBe('template-specific'); // More specific template should be selected
    });
  });

  describe('getActiveTemplates', () => {
    it('should return all active templates', async () => {
      const templates = [
        { ...mockTemplate, isActive: true },
        { ...mockTemplate, id: 'template-2', isActive: false },
        { ...mockTemplate, id: 'template-3', isActive: true },
      ];

      jest.spyOn(templateRepo, 'find').mockResolvedValue(templates.filter(t => t.isActive) as WorkflowTemplate[]);

      const result = await service.getActiveTemplates();

      expect(result).toBeDefined();
      expect(result.length).toBe(2);
      expect(templateRepo.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('updateTemplate', () => {
    it('should update existing template when no active instances', async () => {
      const templateId = 'template-1';
      const updates = {
        name: 'Updated Template Name',
        description: 'Updated description',
      };

      jest.spyOn(service, 'getTemplate').mockResolvedValue(mockTemplate as WorkflowTemplate);
      jest.spyOn(service as any, 'hasActiveInstances').mockResolvedValue(false);
      jest.spyOn(templateRepo, 'save').mockResolvedValue({
        ...mockTemplate,
        ...updates,
      } as WorkflowTemplate);

      const result = await service.updateTemplate(templateId, updates);

      expect(result).toBeDefined();
      expect(result.name).toBe(updates.name);
      expect(templateRepo.save).toHaveBeenCalled();
    });

    it('should throw error if template not found', async () => {
      const templateId = 'non-existent';
      const updates = { name: 'Updated Name' };

      jest.spyOn(service, 'getTemplate').mockResolvedValue(null);

      await expect(service.updateTemplate(templateId, updates)).rejects.toThrow(
        'Workflow template non-existent not found'
      );
    });
  });

  describe('createDefaultTemplates', () => {
    it('should create default templates if they do not exist', async () => {
      jest.spyOn(templateRepo, 'findOne').mockResolvedValue(null); // Template doesn't exist
      jest.spyOn(service, 'createTemplate').mockResolvedValue(mockTemplate as WorkflowTemplate);

      const result = await service.createDefaultTemplates();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(service.createTemplate).toHaveBeenCalled();
    });

    it('should skip creating templates that already exist', async () => {
      jest.spyOn(templateRepo, 'findOne').mockResolvedValue(mockTemplate as WorkflowTemplate);
      jest.spyOn(service, 'createTemplate').mockResolvedValue(mockTemplate as WorkflowTemplate);

      const result = await service.createDefaultTemplates();

      expect(result).toBeDefined();
      expect(result.length).toBe(0); // No templates created
    });
  });

  describe('deactivateTemplate', () => {
    it('should deactivate template', async () => {
      const templateId = 'template-1';

      jest.spyOn(templateRepo, 'update').mockResolvedValue({ affected: 1 } as any);

      await service.deactivateTemplate(templateId);

      expect(templateRepo.update).toHaveBeenCalledWith(
        { id: templateId },
        { isActive: false }
      );
    });
  });
});