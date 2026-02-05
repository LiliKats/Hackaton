import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DelegationService, CreateDelegationDto } from '../delegation.service';
import { ManagerDelegation, DelegationStatus, DelegationType } from '../entities/manager-delegation.entity';
import { User, UserRole } from '../../users/entities/user.entity';
import { ApprovalStep } from '../../workflows/entities/approval-step.entity';
import { ApprovalHistory } from '../../audit/entities/approval-history.entity';

describe('DelegationService', () => {
  let service: DelegationService;
  let delegationRepo: Repository<ManagerDelegation>;
  let userRepo: Repository<User>;
  let approvalStepRepo: Repository<ApprovalStep>;
  let auditRepo: Repository<ApprovalHistory>;

  const mockUser = {
    id: 'user-1',
    email: 'user@example.com',
    firstName: 'John',
    lastName: 'Doe',
    role: UserRole.MANAGER,
    isActive: true,
    hasApprovalAuthority: jest.fn().mockReturnValue(true),
    fullName: 'John Doe',
  };

  const mockDelegate = {
    id: 'delegate-1',
    email: 'delegate@example.com',
    firstName: 'Jane',
    lastName: 'Smith',
    role: UserRole.MANAGER,
    isActive: true,
    hasApprovalAuthority: jest.fn().mockReturnValue(true),
    fullName: 'Jane Smith',
  };

  const mockDelegation: Partial<ManagerDelegation> = {
    id: 'delegation-1',
    delegatedFromId: 'user-1',
    delegatedToId: 'delegate-1',
    delegationType: DelegationType.FULL_AUTHORITY,
    status: DelegationStatus.ACTIVE,
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: new Date('2024-01-31'),
    reason: 'Vacation coverage',
    permissions: {},
    shouldTransferPendingApprovals: true,
    transferredApprovalIds: [],
    isActive: jest.fn().mockReturnValue(true),
    canApproveForUser: jest.fn().mockReturnValue(true),
    canApproveLeaveType: jest.fn().mockReturnValue(true),
    canApproveAmount: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DelegationService,
        {
          provide: getRepositoryToken(ManagerDelegation),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            manager: {
              transaction: jest.fn(),
              save: jest.fn(),
              find: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ApprovalStep),
          useValue: {
            find: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ApprovalHistory),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DelegationService>(DelegationService);
    delegationRepo = module.get<Repository<ManagerDelegation>>(getRepositoryToken(ManagerDelegation));
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
    approvalStepRepo = module.get<Repository<ApprovalStep>>(getRepositoryToken(ApprovalStep));
    auditRepo = module.get<Repository<ApprovalHistory>>(getRepositoryToken(ApprovalHistory));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createDelegation', () => {
    it('should create a new delegation successfully', async () => {
      const createDto: CreateDelegationDto = {
        delegatedFromId: 'user-1',
        delegatedToId: 'delegate-1',
        delegationType: DelegationType.FULL_AUTHORITY,
        effectiveFrom: new Date('2024-01-01'),
        effectiveTo: new Date('2024-01-31'),
        reason: 'Vacation coverage',
        shouldTransferPendingApprovals: true,
      };

      // Mock validation success
      jest.spyOn(service as any, 'validateDelegationRequest').mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
      });

      // Mock transaction
      jest.spyOn(delegationRepo.manager, 'transaction').mockImplementation(async (fn: any) => {
        return await fn({
          save: jest.fn().mockResolvedValue(mockDelegation),
        });
      });

      // Mock other methods
      jest.spyOn(service as any, 'resolveOverlappingDelegations').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'transferPendingApprovals').mockResolvedValue({
        transferredCount: 2,
        transferredApprovalIds: ['step-1', 'step-2'],
        failedTransfers: [],
      });
      jest.spyOn(service as any, 'updateUserDelegationStatus').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'createDelegationAuditEntry').mockResolvedValue(undefined);

      jest.spyOn(delegationRepo, 'create').mockReturnValue(mockDelegation as ManagerDelegation);

      const result = await service.createDelegation(createDto);

      expect(result).toBeDefined();
      expect(delegationRepo.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException if validation fails', async () => {
      const createDto: CreateDelegationDto = {
        delegatedFromId: 'user-1',
        delegatedToId: 'user-1', // Self-delegation
        delegationType: DelegationType.FULL_AUTHORITY,
        effectiveFrom: new Date('2024-01-01'),
        effectiveTo: new Date('2024-01-31'),
        reason: 'Invalid delegation',
      };

      jest.spyOn(service as any, 'validateDelegationRequest').mockResolvedValue({
        isValid: false,
        errors: ['Cannot delegate to yourself'],
        warnings: [],
      });

      await expect(service.createDelegation(createDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('revokeDelegation', () => {
    it('should revoke active delegation successfully', async () => {
      const delegationId = 'delegation-1';
      const revokedById = 'user-1';
      const reason = 'No longer needed';

      const activeDelegation = {
        ...mockDelegation,
        status: DelegationStatus.ACTIVE,
        delegatedFrom: mockUser,
        delegatedTo: mockDelegate,
        transferredApprovalIds: ['step-1', 'step-2'],
      };

      jest.spyOn(delegationRepo, 'findOne').mockResolvedValue(activeDelegation as unknown as ManagerDelegation);
      jest.spyOn(service as any, 'validateRevocationPermissions').mockResolvedValue(undefined);

      jest.spyOn(delegationRepo.manager, 'transaction').mockImplementation(async (fn: any) => {
        return await fn({
          save: jest.fn().mockResolvedValue({
            ...activeDelegation,
            status: DelegationStatus.REVOKED,
            revokedAt: new Date(),
            revokedById,
            revocationReason: reason,
          }),
        });
      });

      jest.spyOn(service as any, 'transferApprovalsBack').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'updateUserDelegationStatus').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'createDelegationAuditEntry').mockResolvedValue(undefined);

      const result = await service.revokeDelegation(delegationId, revokedById, reason);

      expect(result).toBeDefined();
      expect(result.status).toBe(DelegationStatus.REVOKED);
    });

    it('should throw NotFoundException if delegation not found', async () => {
      const delegationId = 'non-existent';
      const revokedById = 'user-1';
      const reason = 'Test';

      jest.spyOn(delegationRepo, 'findOne').mockResolvedValue(null);

      await expect(service.revokeDelegation(delegationId, revokedById, reason))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if delegation not active', async () => {
      const delegationId = 'delegation-1';
      const revokedById = 'user-1';
      const reason = 'Test';

      const inactiveDelegation = {
        ...mockDelegation,
        status: DelegationStatus.EXPIRED,
      };

      jest.spyOn(delegationRepo, 'findOne').mockResolvedValue(inactiveDelegation as ManagerDelegation);

      await expect(service.revokeDelegation(delegationId, revokedById, reason))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('getUserDelegations', () => {
    it('should return user delegations', async () => {
      const userId = 'user-1';
      const delegatedFrom = [mockDelegation];
      const delegatedTo = [mockDelegation];

      jest.spyOn(delegationRepo, 'find')
        .mockResolvedValueOnce(delegatedFrom as ManagerDelegation[])
        .mockResolvedValueOnce(delegatedTo as ManagerDelegation[]);

      const result = await service.getUserDelegations(userId);

      expect(result).toBeDefined();
      expect(result.delegatedFrom).toEqual(delegatedFrom);
      expect(result.delegatedTo).toEqual(delegatedTo);
    });
  });

  describe('getEffectiveApprover', () => {
    it('should return delegate if active delegation exists', async () => {
      const originalApproverId = 'user-1';

      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser as unknown as User);
      jest.spyOn(service as any, 'getActiveDelegationsFrom').mockResolvedValue([
        { ...mockDelegation, delegatedTo: mockDelegate }
      ]);

      const result = await service.getEffectiveApprover(originalApproverId);

      expect(result).toBeDefined();
      expect(result!.id).toBe('delegate-1');
    });

    it('should return original user if no active delegations', async () => {
      const originalApproverId = 'user-1';

      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser as unknown as User);
      jest.spyOn(service as any, 'getActiveDelegationsFrom').mockResolvedValue([]);

      const result = await service.getEffectiveApprover(originalApproverId);

      expect(result).toBeDefined();
      expect(result!.id).toBe('user-1');
    });

    it('should return null if user not found', async () => {
      const originalApproverId = 'non-existent';

      jest.spyOn(userRepo, 'findOne').mockResolvedValue(null);

      const result = await service.getEffectiveApprover(originalApproverId);

      expect(result).toBeNull();
    });
  });

  describe('validateDelegateApproval', () => {
    it('should validate successful delegate approval', async () => {
      const delegationId = 'delegation-1';
      const approverId = 'delegate-1';
      const leaveRequestData = {
        userId: 'employee-1',
        leaveType: 'annual',
        totalDays: 5,
        department: 'engineering',
      };

      const delegation = {
        ...mockDelegation,
        delegatedToId: approverId,
        isActive: jest.fn().mockReturnValue(true),
        canApproveForUser: jest.fn().mockReturnValue(true),
        canApproveLeaveType: jest.fn().mockReturnValue(true),
        canApproveAmount: jest.fn().mockReturnValue(true),
        getRemainingDuration: jest.fn().mockReturnValue(7 * 24 * 60 * 60 * 1000), // 7 days
      };

      jest.spyOn(delegationRepo, 'findOne').mockResolvedValue(delegation as ManagerDelegation);

      const result = await service.validateDelegateApproval(
        delegationId,
        approverId,
        leaveRequestData
      );

      expect(result).toBeDefined();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return validation errors for invalid delegation', async () => {
      const delegationId = 'delegation-1';
      const approverId = 'wrong-delegate';
      const leaveRequestData = {
        userId: 'employee-1',
        leaveType: 'annual',
        totalDays: 5,
      };

      const delegation = {
        ...mockDelegation,
        delegatedToId: 'delegate-1', // Different from approverId
        isActive: jest.fn().mockReturnValue(true),
      };

      jest.spyOn(delegationRepo, 'findOne').mockResolvedValue(delegation as ManagerDelegation);

      const result = await service.validateDelegateApproval(
        delegationId,
        approverId,
        leaveRequestData
      );

      expect(result).toBeDefined();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('User is not the delegate for this delegation');
    });
  });

  describe('expireDelegations', () => {
    it('should expire outdated delegations', async () => {
      const expiredDelegations = [
        {
          ...mockDelegation,
          effectiveTo: new Date('2023-12-31'), // Past date
          status: DelegationStatus.ACTIVE,
          transferredApprovalIds: [],
        },
      ];

      jest.spyOn(delegationRepo, 'find').mockResolvedValue(expiredDelegations as ManagerDelegation[]);

      jest.spyOn(delegationRepo.manager, 'transaction').mockImplementation(async (fn: any) => {
        return await fn({
          save: jest.fn().mockResolvedValue({
            ...expiredDelegations[0],
            status: DelegationStatus.EXPIRED,
          }),
        });
      });

      jest.spyOn(service as any, 'updateUserDelegationStatus').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'transferApprovalsBack').mockResolvedValue(undefined);

      const result = await service.expireDelegations();

      expect(result).toBe(1);
    });

    it('should handle errors gracefully during expiration', async () => {
      const expiredDelegations = [
        {
          ...mockDelegation,
          effectiveTo: new Date('2023-12-31'),
          status: DelegationStatus.ACTIVE,
        },
      ];

      jest.spyOn(delegationRepo, 'find').mockResolvedValue(expiredDelegations as ManagerDelegation[]);
      jest.spyOn(delegationRepo.manager, 'transaction').mockRejectedValue(new Error('Transaction failed'));

      const result = await service.expireDelegations();

      expect(result).toBe(0); // No delegations successfully expired due to error
    });
  });
});