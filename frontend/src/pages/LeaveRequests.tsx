import React, { useState, useEffect } from 'react';
import VacationRequestForm from '@/components/VacationRequestForm';
import RequestStatusCard from '@/components/RequestStatusCard';
import EditLeaveRequestModal from '@/components/EditLeaveRequestModal';
import ViewLeaveRequestModal from '@/components/ViewLeaveRequestModal';
import CancelConfirmationModal from '@/components/CancelConfirmationModal';
import { LeaveStatus, LeaveType, LeaveRequest } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { leaveRequestsService } from '@/services/leave-requests.service';
import { calculateWorkingDays } from '@/utils/dateUtils';

// Calendar component for displaying leave requests
interface LeaveCalendarProps {
  requests: any[];
}

const LeaveCalendar: React.FC<LeaveCalendarProps> = ({ requests }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));
  };

  const getLeaveForDate = (dateStr: string) => {
    return requests.find(request => {
      const startDate = new Date(request.startDate);
      const endDate = new Date(request.endDate);
      const checkDate = new Date(dateStr);
      return checkDate >= startDate && checkDate <= endDate;
    });
  };

  const getLeaveTypeColor = (type: string, status: string) => {
    const baseColors: Record<string, string> = {
      'annual': 'bg-blue-100 text-blue-800 border-blue-200',
      'sick': 'bg-red-100 text-red-800 border-red-200',
      'personal': 'bg-purple-100 text-purple-800 border-purple-200',
      'unpaid': 'bg-gray-100 text-gray-800 border-gray-200',
    };

    if (status === 'pending') {
      return 'bg-orange-100 text-orange-800 border-orange-200 border-dashed';
    } else if (status === 'approved') {
      return baseColors[type] || baseColors['annual'];
    } else if (status === 'rejected') {
      return 'bg-gray-100 text-gray-500 border-gray-200 line-through';
    } else if (status === 'draft') {
      return 'bg-purple-50 text-purple-400 border-purple-100 border-dotted';
    }

    return baseColors[type] || baseColors['annual'];
  };

  const getLeaveTypeAbbr = (type: string) => {
    const abbr: Record<string, string> = {
      'annual': 'V',
      'sick': 'S',
      'personal': 'P',
      'unpaid': 'U',
    };
    return abbr[type] || 'L';
  };

  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const handleMonthChange = (direction: 'prev' | 'next') => {
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const daysInSelectedMonth = getDaysInMonth(selectedDate);
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  return (
    <div className="bg-white">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => handleMonthChange('prev')}
          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          title="Previous Month"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h3 className="text-lg font-medium text-gray-900">
          {monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}
        </h3>

        <button
          onClick={() => handleMonthChange('next')}
          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          title="Next Month"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {/* Day Headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-2 font-medium text-gray-500 bg-gray-50">
            {day}
          </div>
        ))}

        {/* Days */}
        {daysInSelectedMonth.map(date => {
          const dateStr = formatDate(date);
          const leave = getLeaveForDate(dateStr);
          const weekend = isWeekend(date);
          const today = isToday(date);

          return (
            <div
              key={dateStr}
              className={`p-2 h-20 border border-gray-100 ${
                weekend ? 'bg-gray-50' : today ? 'bg-indigo-50' : 'bg-white'
              }`}
            >
              <div className="text-xs text-gray-500 mb-1">{date.getDate()}</div>
              {leave ? (
                <div
                  className={`inline-flex items-center px-1 py-1 rounded text-xs font-medium border ${getLeaveTypeColor(
                    leave.type,
                    leave.status
                  )}`}
                  title={`${leave.type.toUpperCase()} - ${leave.status.toUpperCase()}\n${leave.reason || ''}`}
                >
                  {getLeaveTypeAbbr(leave.type)}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs">
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div>
          <span>Annual (V)</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 bg-red-100 border border-red-200 rounded"></div>
          <span>Sick (S)</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 bg-purple-100 border border-purple-200 rounded"></div>
          <span>Personal (P)</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 bg-orange-100 border border-orange-200 border-dashed rounded"></div>
          <span>Pending</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 bg-purple-50 border border-purple-100 border-dotted rounded"></div>
          <span>Planned</span>
        </div>
      </div>
    </div>
  );
};

const LeaveRequests: React.FC = () => {
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'cancelled' | 'planned'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'details'>('table');
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);
  const [editingRequest, setEditingRequest] = useState<LeaveRequest | null>(null);
  const [viewingRequest, setViewingRequest] = useState<LeaveRequest | null>(null);
  const [cancellingRequest, setCancellingRequest] = useState<LeaveRequest | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const { user, refreshAdminLogin } = useAuth();

  // Fetch leave requests on component mount
  useEffect(() => {
    fetchRequests();
  }, [user]);

  const fetchRequests = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // If admin, fetch all requests; otherwise fetch user's requests
      let userRequests;
      if (user.role === 'admin' || user.role === 'manager') {
        userRequests = await leaveRequestsService.getAll();
      } else {
        userRequests = await leaveRequestsService.getByUser(user.id);
      }

      setRequests(userRequests);
      console.log(`📊 Loaded ${userRequests.length} leave requests for ${user.role}`);
    } catch (error) {
      console.error('Error fetching requests:', error);
      alert('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  };

  const handleNewRequest = () => {
    setShowRequestForm(true);
  };

  const handleCloseForm = () => {
    setShowRequestForm(false);
  };

  const handleSubmitRequest = async (formData: any) => {
    console.log('Request submitted:', formData);

    if (!user) {
      alert('You must be logged in to submit a request');
      return;
    }

    if (formData.action === 'plan') {
      // Handle draft submission
      try {
        setIsSubmitting(true);

        // Calculate working days (excluding weekends)
        const totalDays = calculateWorkingDays(formData.startDate, formData.endDate);

        // Prepare data for API call with draft status
        const draftData = {
          userId: user.id,
          type: formData.type as LeaveType,
          startDate: formData.startDate,
          endDate: formData.endDate,
          totalDays: totalDays,
          reason: formData.reason,
          status: 'draft' // Set status as draft
        };

        console.log('Saving draft:', draftData);
        await leaveRequestsService.create(draftData);

        alert('Request saved as draft!');
        setShowRequestForm(false);

        // Refresh the requests list
        await fetchRequests();
      } catch (error) {
        console.error('Error saving draft:', error);
        alert('Failed to save draft. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Handle actual submission for 'request' action
    try {
      setIsSubmitting(true);

      // Calculate working days (excluding weekends)
      const totalDays = calculateWorkingDays(formData.startDate, formData.endDate);

      // Prepare data for API call
      const requestData = {
        userId: user.id,
        type: formData.type as LeaveType,
        startDate: formData.startDate,
        endDate: formData.endDate,
        totalDays: totalDays,
        reason: formData.reason
      };

      console.log('Submitting to API:', requestData);
      await leaveRequestsService.create(requestData);

      alert('Request submitted for approval successfully!');
      setShowRequestForm(false);

      // Refresh the requests list
      await fetchRequests();
    } catch (error) {
      console.error('Error submitting request:', error);
      alert('Failed to submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditRequest = (id: string) => {
    console.log('Edit request:', id);
    const request = requests.find(r => r.id === id);
    if (request) {
      setEditingRequest(request);
    }
  };

  const handleCancelRequest = (id: string) => {
    console.log('Cancel request:', id);
    const request = requests.find(r => r.id === id);
    if (request) {
      setCancellingRequest(request);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancellingRequest) return;

    try {
      setIsCancelling(true);
      await leaveRequestsService.cancel(cancellingRequest.id);
      alert('Request cancelled successfully!');
      setCancellingRequest(null);
      setViewingRequest(null);

      // Refresh the requests list
      await fetchRequests();
    } catch (error) {
      console.error('Error cancelling request:', error);
      alert('Failed to cancel request. Please try again.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleViewRequest = (id: string) => {
    console.log('View request:', id);
    const request = requests.find(r => r.id === id);
    if (request) {
      setViewingRequest(request);
    }
  };

  const handleCancelFromModal = (id: string) => {
    const request = requests.find(r => r.id === id);
    if (request) {
      setViewingRequest(null);
      setCancellingRequest(request);
    }
  };

  const handleUpdateRequest = async (id: string, formData: any) => {
    console.log('Update request:', id, formData);

    try {
      setIsSubmitting(true);

      await leaveRequestsService.update(id, formData);

      alert('Request updated successfully!');
      setEditingRequest(null);

      // Refresh the requests list
      await fetchRequests();
    } catch (error) {
      console.error('Error updating request:', error);
      alert('Failed to update request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Leave Requests</h1>
            <p className="text-gray-600">Manage your vacation and leave requests</p>
          </div>
          <button
            onClick={handleNewRequest}
            disabled={isSubmitting}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>{isSubmitting ? 'Submitting...' : 'New Request'}</span>
          </button>
        </div>
      </div>

      {/* Calendar Overview */}
      <div className="mb-6 bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={() => setIsCalendarExpanded(!isCalendarExpanded)}
            className="flex items-center justify-between w-full text-left"
          >
            <h2 className="text-lg font-medium text-gray-900">Your Leave Schedule</h2>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">
                {isCalendarExpanded ? 'Hide Calendar' : 'Show Calendar'}
              </span>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                  isCalendarExpanded ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
        </div>
        {isCalendarExpanded && (
          <div className="p-4">
            <LeaveCalendar requests={requests} />
          </div>
        )}
      </div>

      {/* View Mode Toggle */}
      <div className="mb-6">
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setViewMode('table')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center space-x-2 ${
              viewMode === 'table'
                ? 'bg-blue-50 text-blue-600 border border-blue-200'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
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
                ? 'bg-blue-50 text-blue-600 border border-blue-200'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span>Details View</span>
          </button>
        </div>
      </div>

      {/* Show warning and fix button if user has old ID */}
      {user?.id === 'dev-admin-001' && (
        <div className="mb-6 flex justify-end">
          <div className="flex items-center space-x-3">
            <span className="text-sm text-yellow-600 bg-yellow-50 px-3 py-1 rounded-md">
              ⚠️ User ID issue detected
            </span>
            <button
              onClick={refreshAdminLogin}
              className="bg-yellow-600 text-white px-3 py-1 rounded-md hover:bg-yellow-700 transition-colors text-sm"
            >
              Fix Login
            </button>
          </div>
        </div>
      )}

      {/* Requests List */}
      <div className="space-y-6">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <span className="ml-3 text-gray-600">Loading requests...</span>
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto mb-4 text-6xl">📅</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No requests yet</h3>
            <p className="text-gray-600 mb-6">Start by creating your first vacation request!</p>
            <button
              onClick={handleNewRequest}
              className="bg-indigo-600 text-white px-6 py-3 rounded-md hover:bg-indigo-700 transition-colors"
            >
              Create Your First Request
            </button>
          </div>
        ) : (
          <div className="grid gap-6">
            <div className="mb-6">

              {/* Status Filter Buttons */}
              <div className="bg-white rounded-lg shadow p-4 mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">Filter by Status</label>
                <div className="flex justify-between items-center">
                  {/* Main Status Filters */}
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

                  {/* Planned Filter - Right Aligned */}
                  <div>
                    <button
                      onClick={() => setStatusFilter('planned')}
                      className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors flex items-center space-x-2 ${
                        statusFilter === 'planned'
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                      <span>Planned</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Request Counter */}
              <div className={`mb-4 text-sm ${
                statusFilter === 'all' ? 'text-blue-700' :
                statusFilter === 'pending' ? 'text-orange-700' :
                statusFilter === 'approved' ? 'text-green-700' :
                statusFilter === 'rejected' ? 'text-red-700' :
                statusFilter === 'cancelled' ? 'text-gray-700' :
                statusFilter === 'planned' ? 'text-indigo-700' :
                'text-gray-600'
              }`}>
                Showing {requests.filter(request => {
                  if (statusFilter === 'all') return true;
                  if (statusFilter === 'planned') {
                    // Planned = draft status (not yet published/submitted)
                    return request.status === 'draft';
                  }
                  return request.status === statusFilter;
                }).length} requests
              </div>
            </div>
            {viewMode === 'table' ? (
              /* Table View */
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
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
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Submitted
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {requests
                        .filter((request: any) => {
                          if (statusFilter === 'all') return true;
                          if (statusFilter === 'planned') {
                            return request.status === 'draft';
                          }
                          return request.status === statusFilter;
                        })
                        .map((request: any) => (
                          <tr key={request.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm text-gray-900 capitalize">{request.type}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {request.totalDays}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                request.status === 'approved'
                                  ? 'bg-green-100 text-green-800'
                                  : request.status === 'rejected'
                                  ? 'bg-red-100 text-red-800'
                                  : request.status === 'cancelled'
                                  ? 'bg-gray-100 text-gray-800'
                                  : request.status === 'draft'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-orange-100 text-orange-800'
                              }`}>
                                {request.status === 'draft' ? 'PLANNED' : request.status.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(request.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex justify-end space-x-2">
                                <button
                                  onClick={() => handleViewRequest(request.id)}
                                  className="text-indigo-600 hover:text-indigo-900"
                                  title="View"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </button>
                                {request.status === 'pending' && (
                                  <>
                                    <button
                                      onClick={() => handleEditRequest(request.id)}
                                      className="text-blue-600 hover:text-blue-900"
                                      title="Edit"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => handleCancelRequest(request.id)}
                                      className="text-red-600 hover:text-red-900"
                                      title="Cancel"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* Details View */
              <div className="space-y-4">
                {requests
                  .filter((request: any) => {
                    if (statusFilter === 'all') return true;
                    if (statusFilter === 'planned') {
                      return request.status === 'draft';
                    }
                    return request.status === statusFilter;
                  })
                  .map((request: any) => (
                    <RequestStatusCard
                      key={request.id}
                      id={request.id}
                      type={request.type as LeaveType}
                      startDate={request.startDate}
                      endDate={request.endDate}
                      status={request.status as LeaveStatus}
                      reason={request.reason || 'No reason provided'}
                      totalDays={request.totalDays}
                      submittedAt={request.createdAt}
                      onEdit={handleEditRequest}
                      onCancel={handleCancelRequest}
                      onView={handleViewRequest}
                    />
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Vacation Request Form Modal */}
      {showRequestForm && (
        <VacationRequestForm
          onClose={handleCloseForm}
          onSubmit={handleSubmitRequest}
        />
      )}

      {/* Edit Leave Request Modal */}
      {editingRequest && (
        <EditLeaveRequestModal
          request={editingRequest}
          onClose={() => setEditingRequest(null)}
          onSubmit={handleUpdateRequest}
          isSubmitting={isSubmitting}
        />
      )}

      {/* View Leave Request Modal */}
      {viewingRequest && (
        <ViewLeaveRequestModal
          request={viewingRequest}
          onClose={() => setViewingRequest(null)}
          onEdit={() => {
            setViewingRequest(null);
            setEditingRequest(viewingRequest);
          }}
          onCancel={() => handleCancelFromModal(viewingRequest.id)}
        />
      )}

      {/* Cancel Confirmation Modal */}
      {cancellingRequest && (
        <CancelConfirmationModal
          request={cancellingRequest}
          onConfirm={handleConfirmCancel}
          onCancel={() => setCancellingRequest(null)}
          isLoading={isCancelling}
        />
      )}
    </div>
  );
};

export default LeaveRequests;