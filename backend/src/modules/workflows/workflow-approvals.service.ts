import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApprovalStep, ApprovalStepStatus } from './entities/approval-step.entity';
import { WorkflowInstance, WorkflowStatus } from './entities/workflow-instance.entity';
import { LeaveRequest } from '../leave-requests/entities/leave-request.entity';
import { User } from '../users/entities/user.entity';

export interface PendingApprovalDto {
  stepId: string;
  workflowInstanceId: string;
  requestorName: string;
  requestorEmail: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  submittedAt: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  currentStep: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class WorkflowApprovalsService {
  constructor(
    @InjectRepository(ApprovalStep)
    private approvalStepRepository: Repository<ApprovalStep>,
    @InjectRepository(WorkflowInstance)
    private workflowInstanceRepository: Repository<WorkflowInstance>,
    @InjectRepository(LeaveRequest)
    private leaveRequestRepository: Repository<LeaveRequest>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async getPendingApprovalsForUser(userId: string): Promise<PendingApprovalDto[]> {
    // Get all pending approval steps assigned to this user
    const pendingSteps = await this.approvalStepRepository
      .createQueryBuilder('step')
      .leftJoinAndSelect('step.workflowInstance', 'workflow')
      .where('step.assigneeId = :userId', { userId })
      .andWhere('step.status = :status', { status: 'pending' })
      .getMany();

    const approvals: PendingApprovalDto[] = [];

    for (const step of pendingSteps) {
      // Get the workflow instance
      const workflowInstance = await this.workflowInstanceRepository
        .createQueryBuilder('workflow')
        .where('workflow.id = :id', { id: step.workflowInstanceId })
        .getOne();

      if (!workflowInstance) continue;

      // If it's a leave request workflow, get the leave request details
      if (workflowInstance.entityType === 'leave_request') {
        const leaveRequest = await this.leaveRequestRepository
          .createQueryBuilder('request')
          .leftJoinAndSelect('request.user', 'user')
          .where('request.id = :id', { id: workflowInstance.entityId })
          .getOne();

        if (leaveRequest) {
          const approval: PendingApprovalDto = {
            stepId: step.id,
            workflowInstanceId: workflowInstance.id,
            requestorName: `${leaveRequest.user.firstName} ${leaveRequest.user.lastName}`,
            requestorEmail: leaveRequest.user.email,
            leaveType: leaveRequest.type,
            startDate: leaveRequest.startDate.toISOString(),
            endDate: leaveRequest.endDate.toISOString(),
            totalDays: leaveRequest.totalDays,
            reason: leaveRequest.reason || '',
            submittedAt: leaveRequest.createdAt.toISOString(),
            priority: (workflowInstance.context?.priority as any) || 'medium',
            currentStep: step.stepName || 'Manager Approval',
            metadata: {
              stepOrder: step.stepOrder,
              stepType: step.stepType,
              ...workflowInstance.context,
            },
          };
          approvals.push(approval);
        }
      }
    }

    // Sort by priority and submission date
    return approvals.sort((a, b) => {
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      const aPriority = priorityOrder[a.priority] || 2;
      const bPriority = priorityOrder[b.priority] || 2;

      if (aPriority !== bPriority) {
        return bPriority - aPriority; // Higher priority first
      }

      // If same priority, sort by submission date (oldest first)
      return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
    });
  }

  async processApprovalDecision(
    stepId: string,
    userId: string,
    decision: 'approve' | 'reject',
    comments: string,
    metadata?: Record<string, any>,
  ): Promise<{ success: boolean; workflowInstance?: WorkflowInstance }> {
    // Get the approval step
    const step = await this.approvalStepRepository.findOne({
      where: { id: stepId, assignedUserId: userId, status: ApprovalStepStatus.PENDING },
    });

    if (!step) {
      throw new Error('Approval step not found or not assigned to user');
    }

    // Update the step
    step.status = decision === 'approve' ? ApprovalStepStatus.APPROVED : ApprovalStepStatus.REJECTED;
    step.decidedAt = new Date();
    step.comments = comments;
    step.decidedById = userId;
    // Store additional metadata in conditionalData if needed
    if (metadata) {
      step.conditionalData = {
        ...step.conditionalData,
        decision,
        processedBy: userId,
        processedAt: new Date().toISOString(),
        ...metadata,
      };
    }

    await this.approvalStepRepository.save(step);

    // Get and update the workflow instance
    const workflowInstance = await this.workflowInstanceRepository.findOne({
      where: { id: step.workflowInstanceId },
    });

    if (!workflowInstance) {
      throw new Error('Workflow instance not found');
    }

    // Update the leave request status based on decision
    if (workflowInstance.entityType === 'leave_request') {
      const leaveRequest = await this.leaveRequestRepository.findOne({
        where: { id: workflowInstance.entityId },
      });

      if (leaveRequest) {
        if (decision === 'approve') {
          leaveRequest.status = 'approved' as any;
          const approver = await this.userRepository.findOne({ where: { id: userId } });
          if (approver) {
            leaveRequest.approvedBy = approver;
          }
          leaveRequest.approvedAt = new Date();
        } else {
          leaveRequest.status = 'rejected' as any;
          leaveRequest.rejectionReason = comments;
        }

        // Store comments in rejection reason or could add managerNotes field to entity later
        if (decision !== 'approve') {
          leaveRequest.rejectionReason = comments;
        }
        await this.leaveRequestRepository.save(leaveRequest);
      }
    }

    // Complete the workflow
    workflowInstance.status = WorkflowStatus.COMPLETED;
    workflowInstance.completedAt = new Date();
    workflowInstance.context = {
      ...workflowInstance.context,
      finalDecision: decision,
      finalComments: comments,
      completedBy: userId,
    };

    await this.workflowInstanceRepository.save(workflowInstance);

    return {
      success: true,
      workflowInstance,
    };
  }

  async getApprovalStepDetails(stepId: string): Promise<ApprovalStep | null> {
    return await this.approvalStepRepository
      .createQueryBuilder('step')
      .leftJoinAndSelect('step.workflowInstance', 'workflow')
      .where('step.id = :stepId', { stepId })
      .getOne();
  }

  async getWorkflowInstanceDetails(instanceId: string): Promise<WorkflowInstance | null> {
    return await this.workflowInstanceRepository
      .createQueryBuilder('workflow')
      .where('workflow.id = :instanceId', { instanceId })
      .getOne();
  }
}