import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import ApprovalRequestCard from '@/components/ApprovalRequestCard';
import { UserRole } from '@/types';
import { approvalsService, type PendingApproval, type LeaveRequestWithUser } from '@/services/approvals.service';

// Using PendingApproval interface from approvals.service.ts

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  position: string;
  department: string;
  isActive: boolean;
}

// Helper functions for date filtering
const getCurrentMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start, end };
};

const getPreviousMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return { start, end };
};

const getNextMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  return { start, end };
};

const isDateInRange = (dateStr: string, start: Date, end: Date) => {
  const date = new Date(dateStr);
  return date >= start && date <= end;
};

const Approvals: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [allLeaveRequests, setAllLeaveRequests] = useState<LeaveRequestWithUser[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'date' | 'type'>('date');
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
  const [bulkApproving, setBulkApproving] = useState(false);

  // Get initial filter from URL parameters, default to 'pending'
  const initialFilter = searchParams.get('filter') as 'all' | 'pending' | 'approved' | 'rejected' | 'cancelled' || 'pending';
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'cancelled'>(initialFilter);

  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'details'>('table');
  const [dateFilter, setDateFilter] = useState<'all' | 'current' | 'previous' | 'next' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

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
    // Fetch both pending approvals and all leave requests
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch pending approvals for approval workflow
        const approvals = await approvalsService.getPendingApprovals();
        setPendingApprovals(approvals);

        // Fetch all leave requests for filtering view
        const allRequests = await approvalsService.getAllLeaveRequests();
        setAllLeaveRequests(allRequests);

        // Fetch all users for user selection dropdown
        const usersResponse = await fetch('http://localhost:3001/api/users');
        if (usersResponse.ok) {
          const allUsers = await usersResponse.json();
          setUsers(allUsers.filter((user: User) => user.isActive));
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setPendingApprovals([]);
        setAllLeaveRequests([]);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
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

  const handleSelectionChange = (stepId: string, selected: boolean) => {
    setSelectedRequests(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(stepId);
      } else {
        newSet.delete(stepId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRequests(new Set(filteredApprovals.map(approval => approval.stepId)));
    } else {
      setSelectedRequests(new Set());
    }
  };

  const handleBulkApprove = async () => {
    if (selectedRequests.size === 0) return;

    setBulkApproving(true);
    const comment = prompt('Enter approval comment for all selected requests:');
    if (!comment) {
      setBulkApproving(false);
      return;
    }

    try {
      // Process all selected approvals
      const approvalPromises = Array.from(selectedRequests).map(stepId =>
        approvalsService.processApproval(stepId, {
          decision: 'approve',
          comments: comment
        })
      );

      await Promise.all(approvalPromises);

      // Remove approved requests from pending list
      setPendingApprovals(prev => prev.filter(approval => !selectedRequests.has(approval.stepId)));
      setSelectedRequests(new Set());

      // Refresh the list
      setTimeout(async () => {
        try {
          const approvals = await approvalsService.getPendingApprovals();
          setPendingApprovals(approvals);
        } catch (error) {
          console.error('Error refreshing approvals:', error);
        }
      }, 1000);

      alert(`Successfully approved ${selectedRequests.size} request(s)!`);
    } catch (error) {
      console.error('Error bulk approving requests:', error);
      alert('Failed to approve some requests. Please try again.');
    } finally {
      setBulkApproving(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedRequests.size === 0) return;

    setBulkApproving(true);
    const comment = prompt('Enter rejection reason for all selected requests:');
    if (!comment) {
      setBulkApproving(false);
      return;
    }

    try {
      // Process all selected rejections
      const rejectionPromises = Array.from(selectedRequests).map(stepId =>
        approvalsService.processApproval(stepId, {
          decision: 'reject',
          comments: comment
        })
      );

      await Promise.all(rejectionPromises);

      // Remove rejected requests from pending list
      setPendingApprovals(prev => prev.filter(approval => !selectedRequests.has(approval.stepId)));
      setSelectedRequests(new Set());

      // Refresh the list
      setTimeout(async () => {
        try {
          const approvals = await approvalsService.getPendingApprovals();
          setPendingApprovals(approvals);
        } catch (error) {
          console.error('Error refreshing approvals:', error);
        }
      }, 1000);

      alert(`Successfully rejected ${selectedRequests.size} request(s)!`);
    } catch (error) {
      console.error('Error bulk rejecting requests:', error);
      alert('Failed to reject some requests. Please try again.');
    } finally {
      setBulkApproving(false);
    }
  };

  // Transform leave requests to approval format for display consistency
  const transformedLeaveRequests = allLeaveRequests.map(req => ({
    stepId: req.id, // Use request ID as stepId for non-pending items
    workflowInstanceId: '', // Not applicable for completed requests
    requestorName: `${req.firstName} ${req.lastName}`,
    requestorEmail: req.email,
    leaveType: req.type,
    startDate: req.startDate,
    endDate: req.endDate,
    totalDays: req.totalDays,
    reason: req.reason,
    submittedAt: req.createdAt,
    currentStep: req.status,
    metadata: { status: req.status, managerNotes: req.managerNotes }
  }));

  // Filter data based on status first
  let displayData;
  if (statusFilter === 'all') {
    displayData = transformedLeaveRequests;
  } else if (statusFilter === 'pending') {
    // For pending, use the workflow approvals data which has the stepId for actions
    displayData = pendingApprovals;
  } else {
    // Filter by specific status
    displayData = transformedLeaveRequests.filter(req => req.metadata.status === statusFilter);
  }

  // Get unique requestors from current filtered data
  const availableRequestors = Array.from(new Set(
    displayData.map(req => {
      if (statusFilter === 'pending') {
        // For pending requests, find user by email
        const user = users.find(u => u.email === req.requestorEmail);
        return user ? user.id : null;
      } else {
        // For other requests, find user by name
        const user = users.find(u => req.requestorName === `${u.firstName} ${u.lastName}`);
        return user ? user.id : null;
      }
    })
  )).filter(Boolean) as string[];

  // Filter data based on selected user
  if (selectedUser !== 'all') {
    displayData = displayData.filter(req => {
      // For pending approvals, check requestorEmail
      if (statusFilter === 'pending') {
        const user = users.find(u => u.id === selectedUser);
        return user && req.requestorEmail === user.email;
      }
      // For transformed leave requests, check the user ID from firstName/lastName combination
      else {
        const user = users.find(u => u.id === selectedUser);
        return user && req.requestorName === `${user.firstName} ${user.lastName}`;
      }
    });
  }

  // Filter data based on date period
  if (dateFilter !== 'all') {
    displayData = displayData.filter(req => {
      let dateRange;

      switch (dateFilter) {
        case 'current':
          dateRange = getCurrentMonthRange();
          break;
        case 'previous':
          dateRange = getPreviousMonthRange();
          break;
        case 'next':
          dateRange = getNextMonthRange();
          break;
        case 'custom':
          if (customStartDate && customEndDate) {
            dateRange = {
              start: new Date(customStartDate),
              end: new Date(customEndDate)
            };
          } else {
            return true; // Show all if custom dates not set
          }
          break;
        default:
          return true;
      }

      // Check if request falls within the date range
      // Check both start date and end date of the request
      const requestStartInRange = isDateInRange(req.startDate, dateRange.start, dateRange.end);
      const requestEndInRange = isDateInRange(req.endDate, dateRange.start, dateRange.end);
      // Include request if it starts, ends, or overlaps with the selected period
      const requestOverlaps = new Date(req.startDate) <= dateRange.end && new Date(req.endDate) >= dateRange.start;

      return requestStartInRange || requestEndInRange || requestOverlaps;
    });
  }

  const sortedApprovals = [...displayData].sort((a, b) => {
    switch (sortBy) {
      case 'type':
        return a.leaveType.localeCompare(b.leaveType);
      case 'date':
      default:
        return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
    }
  });

  // For compatibility with existing code
  const filteredApprovals = displayData;

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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leave Requests</h1>
          <p className="text-gray-600">View and manage all leave requests</p>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="mb-6">
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setViewMode('table')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center space-x-2 ${
              viewMode === 'table'
                ? 'bg-white text-gray-900 shadow'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span>Compact View</span>
          </button>
          <button
            onClick={() => setViewMode('details')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center space-x-2 ${
              viewMode === 'details'
                ? 'bg-white text-gray-900 shadow'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span>Details View</span>
          </button>
        </div>
      </div>

      {/* Filters and Sorting */}
      <div className="bg-white rounded-lg shadow mb-6 p-4">
        {/* Status Filter Buttons */}
        <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">Filter by Status</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                All Statuses
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors flex items-center space-x-2 ${
                  statusFilter === 'pending'
                    ? 'bg-orange-50 border-orange-500 text-orange-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                <span>Pending</span>
              </button>
              <button
                onClick={() => setStatusFilter('approved')}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors flex items-center space-x-2 ${
                  statusFilter === 'approved'
                    ? 'bg-green-50 border-green-500 text-green-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span>Approved</span>
              </button>
              <button
                onClick={() => setStatusFilter('rejected')}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors flex items-center space-x-2 ${
                  statusFilter === 'rejected'
                    ? 'bg-red-50 border-red-500 text-red-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                <span>Rejected</span>
              </button>
              <button
                onClick={() => setStatusFilter('cancelled')}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors flex items-center space-x-2 ${
                  statusFilter === 'cancelled'
                    ? 'bg-gray-50 border-gray-500 text-gray-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
                <span>Cancelled</span>
              </button>
            </div>
          </div>

        {/* Request Counter - Only show if there are requests */}
        {filteredApprovals.length > 0 && (
          <div className={`mb-4 text-sm ${
            statusFilter === 'all' ? 'text-blue-700' :
            statusFilter === 'pending' ? 'text-orange-700' :
            statusFilter === 'approved' ? 'text-green-700' :
            statusFilter === 'rejected' ? 'text-red-700' :
            statusFilter === 'cancelled' ? 'text-gray-700' :
            'text-gray-600'
          }`}>
            Showing {filteredApprovals.length} requests
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Requestor</label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Requestors</option>
              {users
                .filter(user => availableRequestors.includes(user.id))
                .map(user => (
                  <option key={user.id} value={user.id}>
                    {user.firstName} {user.lastName} ({user.department})
                  </option>
                ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Period</label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Periods</option>
              <option value="current">Current Month</option>
              <option value="previous">Previous Month</option>
              <option value="next">Next Month</option>
              <option value="custom">Custom Period</option>
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
              <option value="type">Leave Type</option>
            </select>
          </div>
        </div>

        {/* Custom Date Range */}
        {dateFilter === 'custom' && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions - Only for pending approvals */}
      {statusFilter === 'pending' && filteredApprovals.length > 0 && (
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedRequests.size === filteredApprovals.length && filteredApprovals.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <label className="ml-2 text-sm font-medium text-gray-700">
                  Select All ({selectedRequests.size} of {filteredApprovals.length} selected)
                </label>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {selectedRequests.size > 0 && (
                <>
                  <button
                    onClick={handleBulkApprove}
                    disabled={bulkApproving}
                    className="inline-flex items-center px-4 py-2 border border-green-600 text-sm font-medium rounded text-green-600 bg-transparent hover:bg-green-50 focus:outline-none focus:ring-1 focus:ring-green-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {bulkApproving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600 mr-2"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Approve Selected ({selectedRequests.size})
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleBulkReject}
                    disabled={bulkApproving}
                    className="inline-flex items-center px-4 py-2 border border-red-600 text-sm font-medium rounded text-red-600 bg-transparent hover:bg-red-50 focus:outline-none focus:ring-1 focus:ring-red-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {bulkApproving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600 mr-2"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Reject Selected ({selectedRequests.size})
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

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
      ) : viewMode === 'table' ? (
        /* Table View */
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {statusFilter === 'pending' && (
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedRequests.size === filteredApprovals.length && filteredApprovals.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                      />
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Requestor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dates
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Days
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  {statusFilter === 'pending' && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedApprovals.map((approval) => (
                  <tr key={approval.stepId} className="hover:bg-gray-50">
                    {statusFilter === 'pending' && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedRequests.has(approval.stepId)}
                          onChange={(e) => handleSelectionChange(approval.stepId, e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                        />
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{approval.requestorName}</div>
                        <div className="text-sm text-gray-500">{approval.requestorEmail}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900 capitalize">{approval.leaveType}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(approval.startDate).toLocaleDateString()} - {new Date(approval.endDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {approval.totalDays}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        approval.currentStep === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : approval.currentStep === 'rejected'
                          ? 'bg-red-100 text-red-800'
                          : approval.currentStep === 'cancelled'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {approval.currentStep.toUpperCase()}
                      </span>
                    </td>
                    {statusFilter === 'pending' && approval.currentStep !== 'approved' && approval.currentStep !== 'rejected' && approval.currentStep !== 'cancelled' && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => {
                              const comment = prompt('Enter approval comment:');
                              if (comment) handleApprove(approval.stepId, comment);
                            }}
                            disabled={loading || bulkApproving}
                            className="text-green-600 hover:text-green-900 disabled:opacity-50"
                            title="Approve"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => {
                              const comment = prompt('Enter rejection reason:');
                              if (comment) handleReject(approval.stepId, comment);
                            }}
                            disabled={loading || bulkApproving}
                            className="text-red-600 hover:text-red-900 disabled:opacity-50"
                            title="Reject"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Details View */
        <div className="space-y-6">
          {sortedApprovals.map((approval) => (
            <ApprovalRequestCard
              key={approval.stepId}
              request={approval}
              onApprove={handleApprove}
              onReject={handleReject}
              loading={loading}
              isSelected={statusFilter === 'pending' ? selectedRequests.has(approval.stepId) : false}
              onSelectionChange={statusFilter === 'pending' ? handleSelectionChange : undefined}
            />
          ))}
        </div>
      )}

    </div>
  );
};

export default Approvals;