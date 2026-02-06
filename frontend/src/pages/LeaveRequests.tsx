import React, { useState, useEffect } from 'react';
import VacationRequestForm from '@/components/VacationRequestForm';
import RequestStatusCard from '@/components/RequestStatusCard';
import EditLeaveRequestModal from '@/components/EditLeaveRequestModal';
import ViewLeaveRequestModal from '@/components/ViewLeaveRequestModal';
import CancelConfirmationModal from '@/components/CancelConfirmationModal';
import { LeaveStatus, LeaveType, LeaveRequest } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { leaveRequestsService } from '@/services/leave-requests.service';

const LeaveRequests: React.FC = () => {
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCancelled, setShowCancelled] = useState(true);
  const [showDrafts, setShowDrafts] = useState(true);
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

        // Calculate total days
        const startDate = new Date(formData.startDate);
        const endDate = new Date(formData.endDate);
        const timeDiff = endDate.getTime() - startDate.getTime();
        const totalDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;

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

      // Calculate total days
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);
      const timeDiff = endDate.getTime() - startDate.getTime();
      const totalDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;

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
        <h1 className="text-2xl font-bold text-gray-900">Leave Requests</h1>
        <p className="text-gray-600">Manage your vacation and leave requests</p>
      </div>

      <div className="mb-6 flex justify-between items-center">
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

        {/* Show warning and fix button if user has old ID */}
        {user?.id === 'dev-admin-001' && (
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
        )}
      </div>

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
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">Your Requests</h2>
              <div className="flex space-x-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={showDrafts}
                    onChange={(e) => setShowDrafts(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                  />
                  <span className="text-sm text-gray-600">Show drafts</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={showCancelled}
                    onChange={(e) => setShowCancelled(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                  />
                  <span className="text-sm text-gray-600">Show cancelled</span>
                </label>
              </div>
            </div>
            {requests
              .filter((request: any) => {
                if (request.status === 'cancelled' && !showCancelled) return false;
                if (request.status === 'draft' && !showDrafts) return false;
                return true;
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