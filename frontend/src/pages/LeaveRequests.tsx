import React, { useState } from 'react';
import VacationRequestForm from '@/components/VacationRequestForm';
import RequestStatusCard from '@/components/RequestStatusCard';
import { LeaveStatus, LeaveType } from '@/types';

const LeaveRequests: React.FC = () => {
  const [showRequestForm, setShowRequestForm] = useState(false);

  // Sample data - replace with real API data
  const [requests] = useState([
    {
      id: '1',
      type: LeaveType.ANNUAL,
      startDate: '2024-07-15',
      endDate: '2024-07-29',
      status: LeaveStatus.PENDING,
      reason: 'Family vacation to Italy',
      totalDays: 15,
      submittedAt: '2024-06-10T10:30:00Z'
    },
    {
      id: '2',
      type: LeaveType.SICK,
      startDate: '2024-06-10',
      endDate: '2024-06-10',
      status: LeaveStatus.APPROVED,
      reason: 'Medical appointment',
      totalDays: 1,
      submittedAt: '2024-06-09T14:15:00Z'
    },
    {
      id: '3',
      type: LeaveType.PERSONAL,
      startDate: '2024-08-01',
      endDate: '2024-08-02',
      status: LeaveStatus.APPROVED,
      reason: 'Personal matters',
      totalDays: 2,
      submittedAt: '2024-05-20T09:00:00Z'
    }
  ]);

  const handleNewRequest = () => {
    setShowRequestForm(true);
  };

  const handleCloseForm = () => {
    setShowRequestForm(false);
  };

  const handleSubmitRequest = (formData: any) => {
    console.log('Request submitted:', formData);
    // TODO: Integrate with backend API

    if (formData.action === 'plan') {
      alert('Request saved as draft!');
    } else {
      alert('Request submitted for approval!');
    }

    setShowRequestForm(false);
  };

  const handleEditRequest = (id: string) => {
    console.log('Edit request:', id);
    // TODO: Implement edit functionality
    alert(`Edit request ${id} - Feature coming soon!`);
  };

  const handleCancelRequest = (id: string) => {
    console.log('Cancel request:', id);
    // TODO: Implement cancel functionality
    const confirmed = window.confirm('Are you sure you want to cancel this request?');
    if (confirmed) {
      alert(`Request ${id} cancelled!`);
    }
  };

  const handleViewRequest = (id: string) => {
    console.log('View request:', id);
    // TODO: Implement view details
    alert(`View details for request ${id} - Feature coming soon!`);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Leave Requests</h1>
        <p className="text-gray-600">Manage your vacation and leave requests</p>
      </div>

      <div className="mb-6">
        <button
          onClick={handleNewRequest}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>New Request</span>
        </button>
      </div>

      {/* Requests List */}
      <div className="space-y-6">
        {requests.length === 0 ? (
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
            <h2 className="text-lg font-medium text-gray-900">Your Requests</h2>
            {requests.map((request) => (
              <RequestStatusCard
                key={request.id}
                id={request.id}
                type={request.type}
                startDate={request.startDate}
                endDate={request.endDate}
                status={request.status}
                reason={request.reason}
                totalDays={request.totalDays}
                submittedAt={request.submittedAt}
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
    </div>
  );
};

export default LeaveRequests;