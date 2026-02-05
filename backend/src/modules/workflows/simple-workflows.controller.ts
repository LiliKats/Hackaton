import { Controller, Get, Post, Body, Param, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LeaveRequest } from '../leave-requests/entities/leave-request.entity';
import { User } from '../users/entities/user.entity';

// Simple DTOs for basic functionality
interface PendingApprovalResponse {
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

interface ApprovalDecisionDto {
  decision: 'approve' | 'reject';
  comments: string;
  metadata?: Record<string, any>;
}

// Mock data for development
const mockPendingApprovals: PendingApprovalResponse[] = [
  {
    stepId: 'step-001',
    workflowInstanceId: 'wf-001',
    requestorName: 'John Doe',
    requestorEmail: 'john.doe@company.com',
    leaveType: 'ANNUAL',
    startDate: '2024-03-15T00:00:00.000Z',
    endDate: '2024-03-22T00:00:00.000Z',
    totalDays: 8,
    reason: 'Family vacation to Italy. Planning this trip for months.',
    submittedAt: '2024-02-01T10:30:00.000Z',
    priority: 'high',
    currentStep: 'Manager Approval',
  },
  {
    stepId: 'step-002',
    workflowInstanceId: 'wf-002',
    requestorName: 'Jane Smith',
    requestorEmail: 'jane.smith@company.com',
    leaveType: 'SICK',
    startDate: '2024-02-10T00:00:00.000Z',
    endDate: '2024-02-10T00:00:00.000Z',
    totalDays: 1,
    reason: 'Medical appointment - routine checkup',
    submittedAt: '2024-02-09T14:15:00.000Z',
    priority: 'urgent',
    currentStep: 'Manager Approval',
  },
  {
    stepId: 'step-003',
    workflowInstanceId: 'wf-003',
    requestorName: 'Mike Johnson',
    requestorEmail: 'mike.johnson@company.com',
    leaveType: 'PERSONAL',
    startDate: '2024-03-01T00:00:00.000Z',
    endDate: '2024-03-03T00:00:00.000Z',
    totalDays: 3,
    reason: 'Personal matters requiring immediate attention',
    submittedAt: '2024-02-20T09:00:00.000Z',
    priority: 'medium',
    currentStep: 'Manager Approval',
  },
  {
    stepId: 'step-004',
    workflowInstanceId: 'wf-004',
    requestorName: 'Sarah Wilson',
    requestorEmail: 'sarah.wilson@company.com',
    leaveType: 'UNPAID',
    startDate: '2024-04-01T00:00:00.000Z',
    endDate: '2024-04-30T00:00:00.000Z',
    totalDays: 30,
    reason: 'Extended unpaid leave for personal sabbatical and travel',
    submittedAt: '2024-01-15T16:45:00.000Z',
    priority: 'low',
    currentStep: 'HR Approval',
  },
];

// Keep track of processed approvals (in memory for demo)
let processedApprovals = new Set<string>();

@ApiTags('Simple Workflows')
@Controller('workflows')
export class SimpleWorkflowsController {
  @Get('my-pending-approvals')
  @ApiOperation({ summary: 'Get pending approvals for current user' })
  @ApiResponse({ status: 200, description: 'Pending approvals retrieved successfully' })
  async getMyPendingApprovals(): Promise<PendingApprovalResponse[]> {
    // Filter out processed approvals
    return mockPendingApprovals.filter(approval => !processedApprovals.has(approval.stepId));
  }

  @Post('steps/:stepId/approve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Process approval decision for a workflow step' })
  @ApiResponse({ status: 200, description: 'Approval processed successfully' })
  async processApproval(
    @Param('stepId') stepId: string,
    @Body() decision: ApprovalDecisionDto,
  ) {
    console.log(`Processing approval for step ${stepId}:`, decision);

    // Mark as processed
    processedApprovals.add(stepId);

    // Return success response
    return {
      success: true,
      message: `Request ${decision.decision === 'approve' ? 'approved' : 'rejected'} successfully`,
      stepId,
      decision: decision.decision,
      comments: decision.comments,
      processedAt: new Date().toISOString(),
    };
  }

  @Get('instances/:instanceId')
  @ApiOperation({ summary: 'Get workflow instance status' })
  @ApiResponse({ status: 200, description: 'Workflow status retrieved successfully' })
  async getWorkflowStatus(@Param('instanceId') instanceId: string) {
    return {
      id: instanceId,
      status: 'active',
      message: 'Workflow is active and being processed',
    };
  }
}