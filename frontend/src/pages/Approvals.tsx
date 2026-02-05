import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ApprovalRequestCard from '@/components/ApprovalRequestCard';
import { UserRole } from '@/types';
import { approvalsService, type PendingApproval } from '@/services/approvals.service';

// Using PendingApproval interface from approvals.service.ts

const Approvals: React.FC = () => {
  const { user } = useAuth();
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'urgent' | 'high' | 'medium' | 'low'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'type'>('date');

  // Sample data - current month February 2026 (not used since we're using real backend API)
  /*
  const samplePendingApprovals: PendingApproval[] = [
    {
      stepId: 'step-001',
      workflowInstanceId: 'wf-001',
      requestorName: 'John Doe',
      requestorEmail: 'john.doe@company.com',
      leaveType: LeaveType.SICK,
      startDate: '2026-02-07',
      endDate: '2026-02-07',
      totalDays: 1,
      reason: 'Feeling unwell, need to recover at home',
      submittedAt: '2026-02-06T08:30:00Z',
      priority: 'urgent',
      currentStep: 'Manager Approval',
    },
    {
      stepId: 'step-002',
      workflowInstanceId: 'wf-002',
      requestorName: 'Jane Smith',
      requestorEmail: 'jane.smith@company.com',
      leaveType: LeaveType.PERSONAL,
      startDate: '2026-02-14',
      endDate: '2026-02-14',
      totalDays: 1,
      reason: 'Valentine\'s Day - personal appointment',
      submittedAt: '2026-02-10T14:15:00Z',
      priority: 'medium',
      currentStep: 'Manager Approval',
    },
    {
      stepId: 'step-003',
      workflowInstanceId: 'wf-003',
      requestorName: 'Mike Johnson',
      requestorEmail: 'mike.johnson@company.com',
      leaveType: LeaveType.ANNUAL,
      startDate: '2026-02-17',
      endDate: '2026-02-21',
      totalDays: 5,
      reason: 'President\'s Day week vacation with family',
      submittedAt: '2026-02-03T09:00:00Z',
      priority: 'high',
      currentStep: 'Manager Approval',
    },
    {
      stepId: 'step-004',
      workflowInstanceId: 'wf-004',
      requestorName: 'Sarah Wilson',
      requestorEmail: 'sarah.wilson@company.com',
      leaveType: LeaveType.SICK,
      startDate: '2026-02-12',
      endDate: '2026-02-13',
      totalDays: 2,
      reason: 'Doctor recommended rest after medical procedure',
      submittedAt: '2026-02-11T16:45:00Z',
      priority: 'urgent',
      currentStep: 'Manager Approval',
    },
  ];
  */

  useEffect(() => {
    // Fetch pending approvals from API
    const fetchPendingApprovals = async () => {
      setLoading(true);
      try {
        // Use real API call
        const approvals = await approvalsService.getPendingApprovals();
        setPendingApprovals(approvals);
      } catch (error) {
        console.error('Error fetching pending approvals:', error);
        // Set empty array on error
        setPendingApprovals([]);
        // TODO: Add proper error notification
      } finally {
        setLoading(false);
      }
    };

    fetchPendingApprovals();
  }, []);

  const handleApprove = async (stepId: string, comment: string) => {
    try {
      // Use real API call
      await approvalsService.processApproval(stepId, {
        decision: 'approve',
        comments: comment
      });

      console.log('Approved:', { stepId, comment });

      // Remove from pending list and refresh data
      setPendingApprovals(prev => prev.filter(approval => approval.stepId !== stepId));

      // Refresh the list to get updated data from server
      setTimeout(() => {
        const fetchUpdated = async () => {
          try {
            const approvals = await approvalsService.getPendingApprovals();
            setPendingApprovals(approvals);
          } catch (error) {
            console.error('Error refreshing approvals:', error);
          }
        };
        fetchUpdated();
      }, 1000);

      // TODO: Add success notification
      alert('Request approved successfully!');
    } catch (error) {
      console.error('Error approving request:', error);
      // TODO: Add error notification
      alert('Failed to approve request. Please try again.');
    }
  };

  const handleReject = async (stepId: string, comment: string) => {
    try {
      // Use real API call
      await approvalsService.processApproval(stepId, {
        decision: 'reject',
        comments: comment
      });

      console.log('Rejected:', { stepId, comment });

      // Remove from pending list and refresh data
      setPendingApprovals(prev => prev.filter(approval => approval.stepId !== stepId));

      // Refresh the list to get updated data from server
      setTimeout(() => {
        const fetchUpdated = async () => {
          try {
            const approvals = await approvalsService.getPendingApprovals();
            setPendingApprovals(approvals);
          } catch (error) {
            console.error('Error refreshing approvals:', error);
          }
        };
        fetchUpdated();
      }, 1000);

      // TODO: Add success notification
      alert('Request rejected successfully!');
    } catch (error) {
      console.error('Error rejecting request:', error);
      // TODO: Add error notification
      alert('Failed to reject request. Please try again.');
    }
  };

  const filteredApprovals = pendingApprovals.filter(approval => {
    if (filterStatus === 'all') return true;
    return approval.priority === filterStatus;
  });

  const sortedApprovals = [...filteredApprovals].sort((a, b) => {
    switch (sortBy) {
      case 'priority':
        const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      case 'type':
        return a.leaveType.localeCompare(b.leaveType);
      case 'date':
      default:
        return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
    }
  });

  // Check if user has approval permissions
  const canApprove = user?.role === UserRole.MANAGER || user?.role === UserRole.HR || user?.role === UserRole.ADMIN;

  if (!canApprove) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="w-24 h-24 mx-auto mb-4 text-6xl">🔒</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
          <p className="text-gray-600">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pending Approvals</h1>
            <p className="text-gray-600">Review and process leave requests requiring your approval</p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
              {pendingApprovals.length} pending
            </span>
          </div>
        </div>
      </div>

      {/* Filters and Sorting */}
      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Priority</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort by</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="date">Submission Date</option>
              <option value="priority">Priority</option>
              <option value="type">Leave Type</option>
            </select>
          </div>
        </div>
      </div>

      {/* Approvals List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading pending approvals...</p>
        </div>
      ) : sortedApprovals.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-24 h-24 mx-auto mb-4 text-6xl">🎉</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No pending approvals!</h3>
          <p className="text-gray-600">
            {pendingApprovals.length === 0
              ? "All caught up! No requests require your approval right now."
              : "No requests match your current filters."
            }
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedApprovals.map((approval) => (
            <ApprovalRequestCard
              key={approval.stepId}
              request={approval}
              onApprove={handleApprove}
              onReject={handleReject}
              loading={loading}
            />
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {pendingApprovals.length > 0 && (
        <div className="mt-8 bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {pendingApprovals.filter(a => a.priority === 'urgent').length}
              </div>
              <div className="text-sm text-gray-500">Urgent</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {pendingApprovals.filter(a => a.priority === 'high').length}
              </div>
              <div className="text-sm text-gray-500">High Priority</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {pendingApprovals.filter(a => a.priority === 'medium').length}
              </div>
              <div className="text-sm text-gray-500">Medium Priority</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {pendingApprovals.filter(a => a.priority === 'low').length}
              </div>
              <div className="text-sm text-gray-500">Low Priority</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Approvals;