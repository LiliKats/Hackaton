import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkflowEngineService, WorkflowContext } from '../workflow-engine.service';
import { WorkflowInstance, WorkflowStatus } from '../entities/workflow-instance.entity';
import { ApprovalStep, ApprovalStepStatus } from '../entities/approval-step.entity';
import { ApprovalHistory } from '../../audit/entities/approval-history.entity';
import { User } from '../../users/entities/user.entity';
import { WorkflowTemplateService } from '../workflow-template.service';
import { ApprovalRulesService } from '../approval-rules.service';

describe('WorkflowEngineService', () => {
  let service: WorkflowEngineService;
  let workflowInstanceRepo: Repository<WorkflowInstance>;
  let approvalStepRepo: Repository<ApprovalStep>;
  let auditRepo: Repository<ApprovalHistory>;
  let userRepo: Repository<User>;
  let workflowTemplateService: WorkflowTemplateService;
  let approvalRulesService: ApprovalRulesService;

  const mockWorkflowInstance = {
    id: 'workflow-1',
    templateId: 'template-1',
    entityType: 'leave_request',
    entityId: 'leave-1',
    status: WorkflowStatus.ACTIVE,
    currentStepOrder: 1,
    context: { requestorId: 'user-1' },
    createdAt: new Date(),
    updatedAt: new Date(),
    approvalSteps: [],
    getCurrentStep: jest.fn(),
    getCompletedSteps: jest.fn(),
    getPendingSteps: jest.fn(),
  };

  const mockApprovalStep = {
    id: 'step-1',
    workflowInstanceId: 'workflow-1',
    stepOrder: 1,
    stepName: 'Manager Approval',
    status: ApprovalStepStatus.PENDING,
    assignedUserId: 'manager-1',
    isRequired: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    canBeApprovedBy: jest.fn(),
    isApproved: jest.fn(),
    isRejected: jest.fn(),
    isPending: jest.fn(),
  };

  const mockTemplate = {
    id: 'template-1',
    name: 'Standard Approval',
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
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowEngineService,
        {
          provide: getRepositoryToken(WorkflowInstance),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            manager: {
              transaction: jest.fn(),
              findOne: jest.fn(),
              save: jest.fn(),
            },
          },
        },
        {
          provide: getRepositoryToken(ApprovalStep),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ApprovalHistory),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: WorkflowTemplateService,
          useValue: {
            selectTemplate: jest.fn(),
          },
        },
        {
          provide: ApprovalRulesService,
          useValue: {
            resolveApprovers: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WorkflowEngineService>(WorkflowEngineService);
    workflowInstanceRepo = module.get<Repository<WorkflowInstance>>(getRepositoryToken(WorkflowInstance));
    approvalStepRepo = module.get<Repository<ApprovalStep>>(getRepositoryToken(ApprovalStep));
    auditRepo = module.get<Repository<ApprovalHistory>>(getRepositoryToken(ApprovalHistory));
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
    workflowTemplateService = module.get<WorkflowTemplateService>(WorkflowTemplateService);
    approvalRulesService = module.get<ApprovalRulesService>(ApprovalRulesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initiateWorkflow', () => {
    it('should initiate a new workflow successfully', async () => {
      const context: WorkflowContext = {
        entityType: 'leave_request',
        entityId: 'leave-1',
        entityData: { type: 'annual', totalDays: 5 },
        requestorId: 'user-1',
      };

      const mockUser = { id: 'manager-1', fullName: 'Manager User' };

      jest.spyOn(workflowTemplateService, 'selectTemplate').mockResolvedValue(mockTemplate as any);
      jest.spyOn(workflowInstanceRepo, 'create').mockReturnValue(mockWorkflowInstance as any);
      jest.spyOn(workflowInstanceRepo, 'save').mockResolvedValue(mockWorkflowInstance as any);
      jest.spyOn(approvalRulesService, 'resolveApprovers').mockResolvedValue([mockUser as any]);
      jest.spyOn(approvalStepRepo, 'create').mockReturnValue(mockApprovalStep as any);
      jest.spyOn(approvalStepRepo, 'save').mockResolvedValue([mockApprovalStep] as any);

      const result = await service.initiateWorkflow(context);

      expect(result).toBeDefined();
      expect(workflowTemplateService.selectTemplate).toHaveBeenCalledWith(context);
      expect(workflowInstanceRepo.create).toHaveBeenCalled();
      expect(workflowInstanceRepo.save).toHaveBeenCalled();
    });

    it('should throw error if no template found', async () => {
      const context: WorkflowContext = {
        entityType: 'leave_request',
        entityId: 'leave-1',
        entityData: {},
        requestorId: 'user-1',
      };

      jest.spyOn(workflowTemplateService, 'selectTemplate').mockResolvedValue(null);

      await expect(service.initiateWorkflow(context)).rejects.toThrow(
        'No suitable workflow template found'
      );
    });
  });

  describe('processApprovalDecision', () => {
    it('should process approval decision successfully', async () => {
      const stepId = 'step-1';
      const approverId = 'manager-1';
      const decision = 'approve';
      const comments = 'Approved for vacation';

      const mockStepWithWorkflow = {
        ...mockApprovalStep,
        workflowInstance: mockWorkflowInstance,
        assignedUser: { id: 'manager-1', fullName: 'Manager User' },
        canBeApprovedBy: jest.fn().mockReturnValue(true),
      };

      jest.spyOn(workflowInstanceRepo.manager, 'transaction').mockImplementation(async (fn) => {
        return await fn({
          findOne: jest.fn().mockResolvedValue(mockStepWithWorkflow),
          save: jest.fn().mockResolvedValue(mockStepWithWorkflow),
        });
      });

      const result = await service.processApprovalDecision(
        stepId,
        approverId,
        decision,
        comments
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.stepId).toBe(stepId);
    });

    it('should throw error if user not authorized', async () => {
      const stepId = 'step-1';
      const approverId = 'unauthorized-user';
      const decision = 'approve';

      const mockStepWithWorkflow = {
        ...mockApprovalStep,
        workflowInstance: mockWorkflowInstance,
        canBeApprovedBy: jest.fn().mockReturnValue(false),
      };

      jest.spyOn(workflowInstanceRepo.manager, 'transaction').mockImplementation(async (fn) => {
        return await fn({
          findOne: jest.fn().mockResolvedValue(mockStepWithWorkflow),
        });
      });

      await expect(service.processApprovalDecision(
        stepId,
        approverId,
        decision
      )).rejects.toThrow('not authorized to approve');
    });
  });

  describe('escalateStep', () => {
    it('should escalate step successfully', async () => {
      const stepId = 'step-1';
      const reason = 'Timeout exceeded';
      const escalatedById = 'system';

      const mockManager = { id: 'senior-manager-1', fullName: 'Senior Manager' };
      const mockStepWithUser = {
        ...mockApprovalStep,
        assignedUser: { id: 'manager-1', manager: mockManager },
      };

      jest.spyOn(workflowInstanceRepo.manager, 'transaction').mockImplementation(async (fn) => {
        return await fn({
          findOne: jest.fn().mockResolvedValue(mockStepWithUser),
          save: jest.fn().mockResolvedValue({
            ...mockStepWithUser,
            status: ApprovalStepStatus.ESCALATED,
            assignedUserId: mockManager.id,
          }),
        });
      });

      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockManager as any);

      const result = await service.escalateStep(stepId, reason, escalatedById);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.status).toBe(ApprovalStepStatus.ESCALATED);
    });
  });

  describe('getActiveWorkflowsForUser', () => {
    it('should return active workflows for user', async () => {
      const userId = 'manager-1';
      const mockSteps = [
        {
          ...mockApprovalStep,
          workflowInstance: {
            ...mockWorkflowInstance,
            leaveRequest: {
              user: { fullName: 'Employee User' },
            },
          },
        },
      ];

      jest.spyOn(approvalStepRepo, 'find').mockResolvedValue(mockSteps as any);

      const result = await service.getActiveWorkflowsForUser(userId);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(approvalStepRepo.find).toHaveBeenCalledWith({
        where: {
          assignedUserId: userId,
          status: ApprovalStepStatus.PENDING,
        },
        relations: expect.any(Array),
        order: expect.any(Object),
      });
    });
  });

  describe('getWorkflowStatus', () => {
    it('should return workflow status', async () => {
      const workflowInstanceId = 'workflow-1';
      const mockInstanceWithSteps = {
        ...mockWorkflowInstance,
        approvalSteps: [mockApprovalStep],
      };

      jest.spyOn(workflowInstanceRepo, 'findOne').mockResolvedValue(mockInstanceWithSteps as any);

      const result = await service.getWorkflowStatus(workflowInstanceId);

      expect(result).toBeDefined();
      expect(result.id).toBe(workflowInstanceId);
      expect(workflowInstanceRepo.findOne).toHaveBeenCalledWith({
        where: { id: workflowInstanceId },
        relations: expect.any(Array),
      });
    });

    it('should return null if workflow not found', async () => {
      const workflowInstanceId = 'non-existent';

      jest.spyOn(workflowInstanceRepo, 'findOne').mockResolvedValue(null);

      const result = await service.getWorkflowStatus(workflowInstanceId);

      expect(result).toBeNull();
    });
  });

  describe('cancelWorkflow', () => {
    it('should cancel workflow successfully', async () => {
      const workflowInstanceId = 'workflow-1';
      const reason = 'User requested cancellation';
      const cancelledById = 'user-1';

      const mockInstanceWithSteps = {
        ...mockWorkflowInstance,
        approvalSteps: [{ ...mockApprovalStep, isPending: jest.fn().mockReturnValue(true) }],
      };

      jest.spyOn(workflowInstanceRepo.manager, 'transaction').mockImplementation(async (fn) => {
        return await fn({
          findOne: jest.fn().mockResolvedValue(mockInstanceWithSteps),
          save: jest.fn().mockResolvedValue({
            ...mockInstanceWithSteps,
            status: WorkflowStatus.CANCELLED,
            cancellationReason: reason,
          }),
        });
      });

      await expect(service.cancelWorkflow(
        workflowInstanceId,
        reason,
        cancelledById
      )).resolves.not.toThrow();
    });

    it('should throw error if workflow not found', async () => {
      const workflowInstanceId = 'non-existent';
      const reason = 'Test';
      const cancelledById = 'user-1';

      jest.spyOn(workflowInstanceRepo.manager, 'transaction').mockImplementation(async (fn) => {
        return await fn({
          findOne: jest.fn().mockResolvedValue(null),
        });
      });

      await expect(service.cancelWorkflow(
        workflowInstanceId,
        reason,
        cancelledById
      )).rejects.toThrow('Workflow instance');
    });
  });
});