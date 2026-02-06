import api from './api';
import { LeaveType } from '@/types';

export interface PendingApproval {
  stepId: string;
  workflowInstanceId: string;
  requestorName: string;
  requestorEmail: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  submittedAt: string;
  currentStep: string;
  metadata?: Record<string, any>;
}

export interface LeaveRequestWithUser {
  id: string;
  userId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  managerNotes?: string;
  createdAt: string;
  updatedAt: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
}

export interface ApprovalDecision {
  decision: 'approve' | 'reject';
  comments: string;
  metadata?: Record<string, any>;
}

export interface WorkflowStep {
  id: string;
  workflowInstanceId: string;
  stepType: string;
  assigneeId: string;
  status: 'pending' | 'completed' | 'skipped' | 'escalated';
  completedAt?: string;
  comments?: string;
  metadata?: Record<string, any>;
}

export interface WorkflowInstance {
  id: string;
  templateId: string;
  entityType: string;
  entityId: string;
  status: 'active' | 'completed' | 'cancelled' | 'failed';
  currentStepIndex: number;
  context: Record<string, any>;
  createdAt: string;
  completedAt?: string;
  steps: WorkflowStep[];
}

export const approvalsService = {
  /**
   * Get all pending approvals for the current user
   */
  async getPendingApprovals(): Promise<PendingApproval[]> {
    try {
      const response = await api.get<PendingApproval[]>('/workflows/my-pending-approvals');
      return response.data;
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
      // Return empty array on error instead of throwing
      return [];
    }
  },

  /**
   * Get all leave requests with user details, optionally filtered by status
   */
  async getAllLeaveRequests(status?: 'pending' | 'approved' | 'rejected' | 'cancelled'): Promise<LeaveRequestWithUser[]> {
    try {
      const url = status ? `/leave-requests/all?status=${status}` : '/leave-requests/all';
      const response = await api.get<LeaveRequestWithUser[]>(url);
      return response.data;
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      return [];
    }
  },

  /**
   * Process approval decision for a workflow step
   */
  async processApproval(stepId: string, decision: ApprovalDecision): Promise<WorkflowInstance> {
    try {
      const response = await api.post<WorkflowInstance>(`/workflows/steps/${stepId}/approve`, decision);
      return response.data;
    } catch (error) {
      console.error('Error processing approval:', error);
      throw new Error('Failed to process approval decision. Please try again.');
    }
  },

  /**
   * Get workflow instance details
   */
  async getWorkflowInstance(instanceId: string): Promise<WorkflowInstance> {
    const response = await api.get<WorkflowInstance>(`/workflows/instances/${instanceId}`);
    return response.data;
  },

  /**
   * Get workflow step details
   */
  async getWorkflowStep(stepId: string): Promise<WorkflowStep> {
    const response = await api.get<WorkflowStep>(`/workflows/steps/${stepId}`);
    return response.data;
  },

  /**
   * Escalate a workflow step
   */
  async escalateStep(stepId: string, reason: string): Promise<WorkflowInstance> {
    const response = await api.post<WorkflowInstance>(`/workflows/steps/${stepId}/escalate`, {
      reason
    });
    return response.data;
  },

  /**
   * Get parallel approval status
   */
  async getParallelApprovalStatus(stepId: string): Promise<any> {
    const response = await api.get(`/workflows/parallel-approvals/${stepId}/status`);
    return response.data;
  },

  /**
   * Get pending parallel approvals for current user
   */
  async getPendingParallelApprovals(): Promise<any[]> {
    const response = await api.get('/workflows/my-parallel-approvals');
    return response.data;
  },

  /**
   * Get workflow analytics
   */
  async getWorkflowAnalytics(): Promise<any> {
    const response = await api.get('/workflows/analytics/performance');
    return response.data;
  },

  /**
   * Cancel a workflow instance
   */
  async cancelWorkflow(instanceId: string, reason: string): Promise<WorkflowInstance> {
    const response = await api.post<WorkflowInstance>(`/workflows/instances/${instanceId}/cancel`, {
      reason
    });
    return response.data;
  }
};

export default approvalsService;