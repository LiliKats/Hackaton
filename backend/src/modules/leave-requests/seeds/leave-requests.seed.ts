import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeaveRequest, LeaveType, LeaveStatus } from '../entities/leave-request.entity';
import { User, UserRole } from '../../users/entities/user.entity';
import { WorkflowInstance, WorkflowStatus } from '../../workflows/entities/workflow-instance.entity';
import { ApprovalStep, ApprovalStepStatus, StepType } from '../../workflows/entities/approval-step.entity';

@Injectable()
export class LeaveRequestsSeedService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(LeaveRequest)
    private leaveRequestsRepository: Repository<LeaveRequest>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(WorkflowInstance)
    private workflowInstanceRepository: Repository<WorkflowInstance>,
    @InjectRepository(ApprovalStep)
    private approvalStepRepository: Repository<ApprovalStep>,
  ) {}

  async onApplicationBootstrap() {
    // Only seed in development
    if (process.env.NODE_ENV === 'production') return;

    const hasData = await this.leaveRequestsRepository.count();
    if (hasData > 0) return; // Data already exists

    console.log('🌱 Seeding leave requests and approval data...');
    await this.seedData();
  }

  private async seedData() {
    // Create or get users
    const adminUser = await this.createUserIfNotExists({
      id: 'admin-001',
      email: 'admin@dev.local',
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
      position: 'System Administrator',
      department: 'IT',
      isActive: true,
      annualLeaveDays: 25,
      usedLeaveDays: 0,
    });

    const managerUser = await this.createUserIfNotExists({
      id: 'manager-001',
      email: 'manager@company.com',
      firstName: 'Sarah',
      lastName: 'Manager',
      role: UserRole.MANAGER,
      position: 'Engineering Manager',
      department: 'Engineering',
      isActive: true,
      annualLeaveDays: 28,
      usedLeaveDays: 5,
    });

    const employees = await this.createEmployees();

    // Create sample leave requests with workflows (updated for 2026)
    const sampleRequests = [
      {
        user: employees[0], // John Doe
        type: LeaveType.ANNUAL,
        startDate: new Date('2026-05-15'),
        endDate: new Date('2026-05-22'),
        totalDays: 8,
        reason: 'Family vacation to Italy. Planning this trip for months.',
        status: LeaveStatus.PENDING,
        priority: 'high' as const,
        managerNotes: null,
      },
      {
        user: employees[1], // Jane Smith
        type: LeaveType.SICK,
        startDate: new Date('2026-03-12'),
        endDate: new Date('2026-03-12'),
        totalDays: 1,
        reason: 'Medical appointment - routine checkup',
        status: LeaveStatus.PENDING,
        priority: 'urgent' as const,
        managerNotes: null,
      },
      {
        user: employees[2], // Mike Johnson
        type: LeaveType.PERSONAL,
        startDate: new Date('2026-04-14'),
        endDate: new Date('2026-04-16'),
        totalDays: 3,
        reason: 'Personal matters requiring immediate attention',
        status: LeaveStatus.PENDING,
        priority: 'medium' as const,
        managerNotes: null,
      },
      {
        user: employees[3], // Sarah Wilson
        type: LeaveType.UNPAID,
        startDate: new Date('2026-07-01'),
        endDate: new Date('2026-07-31'),
        totalDays: 31,
        reason: 'Extended unpaid leave for personal sabbatical and travel',
        status: LeaveStatus.PENDING,
        priority: 'low' as const,
        managerNotes: null,
      },
      {
        user: employees[0], // John Doe (additional request)
        type: LeaveType.ANNUAL,
        startDate: new Date('2026-08-05'),
        endDate: new Date('2026-08-09'),
        totalDays: 5,
        reason: 'Summer vacation with family',
        status: LeaveStatus.PENDING,
        priority: 'medium' as const,
        managerNotes: null,
      },
    ];

    // Create leave requests with workflow instances
    for (let i = 0; i < sampleRequests.length; i++) {
      const requestData = sampleRequests[i];

      // Create leave request
      const leaveRequest = this.leaveRequestsRepository.create(requestData);
      const savedRequest = await this.leaveRequestsRepository.save(leaveRequest);

      // Create workflow instance for this request
      const workflowInstance = this.workflowInstanceRepository.create({
        templateId: 'template-standard-approval',
        entityType: 'leave_request',
        entityId: savedRequest.id,
        status: WorkflowStatus.ACTIVE,
        currentStepOrder: 1,
        context: {
          requestorId: requestData.user.id,
          requestorName: `${requestData.user.firstName} ${requestData.user.lastName}`,
          requestorEmail: requestData.user.email,
          leaveType: requestData.type,
          startDate: requestData.startDate.toISOString(),
          endDate: requestData.endDate.toISOString(),
          totalDays: requestData.totalDays,
          reason: requestData.reason,
          priority: requestData.priority,
        },
      });
      const savedWorkflow = await this.workflowInstanceRepository.save(workflowInstance);

      // Create approval step
      const approvalStep = this.approvalStepRepository.create({
        workflowInstanceId: savedWorkflow.id,
        stepOrder: 1,
        stepName: 'Manager Approval',
        stepType: StepType.SINGLE_APPROVER,
        assignedUserId: managerUser.id, // All assigned to manager for demo
        status: ApprovalStepStatus.PENDING,
        isRequired: true,
        timeoutHours: 48,
      });
      await this.approvalStepRepository.save(approvalStep);
    }

    console.log('✅ Successfully seeded leave requests and approval workflows');
  }

  private async createUserIfNotExists(userData: Partial<User>): Promise<User> {
    let user = await this.usersRepository.findOne({ where: { email: userData.email } });

    if (!user) {
      user = this.usersRepository.create(userData);
      user = await this.usersRepository.save(user);
    }

    return user;
  }

  private async createEmployees(): Promise<User[]> {
    const employeesData = [
      {
        id: 'emp-001',
        email: 'john.doe@company.com',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.EMPLOYEE,
        position: 'Software Engineer',
        department: 'Engineering',
        isActive: true,
        annualLeaveDays: 25,
        usedLeaveDays: 7,
      },
      {
        id: 'emp-002',
        email: 'jane.smith@company.com',
        firstName: 'Jane',
        lastName: 'Smith',
        role: UserRole.EMPLOYEE,
        position: 'Product Manager',
        department: 'Product',
        isActive: true,
        annualLeaveDays: 25,
        usedLeaveDays: 3,
      },
      {
        id: 'emp-003',
        email: 'mike.johnson@company.com',
        firstName: 'Mike',
        lastName: 'Johnson',
        role: UserRole.EMPLOYEE,
        position: 'Designer',
        department: 'Design',
        isActive: true,
        annualLeaveDays: 25,
        usedLeaveDays: 12,
      },
      {
        id: 'emp-004',
        email: 'sarah.wilson@company.com',
        firstName: 'Sarah',
        lastName: 'Wilson',
        role: UserRole.EMPLOYEE,
        position: 'QA Engineer',
        department: 'Engineering',
        isActive: true,
        annualLeaveDays: 25,
        usedLeaveDays: 8,
      },
    ];

    const employees: User[] = [];
    for (const empData of employeesData) {
      const employee = await this.createUserIfNotExists(empData);
      employees.push(employee);
    }

    return employees;
  }
}