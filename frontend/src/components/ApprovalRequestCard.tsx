import React, { useState } from 'react';
import { LeaveType } from '@/types';

interface ApprovalRequest {
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
  priority: 'low' | 'medium' | 'high' | 'urgent';
  currentStep: string;
  metadata?: Record<string, any>;
}

interface ApprovalRequestCardProps {
  request: ApprovalRequest;
  onApprove: (stepId: string, comment: string) => Promise<void>;
  onReject: (stepId: string, comment: string) => Promise<void>;
  loading?: boolean;
}

const ApprovalRequestCard: React.FC<ApprovalRequestCardProps> = ({
  request,
  onApprove,
  onReject,
  loading = false
}) => {
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const getLeaveTypeIcon = () => {
    switch (request.leaveType) {
      case LeaveType.ANNUAL:
        return '🏖️';
      case LeaveType.SICK:
        return '🏥';
      case LeaveType.PERSONAL:
        return '👤';
      case LeaveType.UNPAID:
        return '💼';
      default:
        return '📅';
    }
  };

  const getLeaveTypeName = () => {
    switch (request.leaveType) {
      case LeaveType.ANNUAL:
        return 'Vacation Leave';
      case LeaveType.SICK:
        return 'Sick Leave';
      case LeaveType.PERSONAL:
        return 'Personal Leave';
      case LeaveType.UNPAID:
        return 'Unpaid Leave';
      default:
        return request.leaveType;
    }
  };

  const getPriorityColor = () => {
    switch (request.priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleActionClick = (action: 'approve' | 'reject') => {
    setApprovalAction(action);
    setShowApprovalModal(true);
    setComment('');
  };

  const handleSubmitDecision = async () => {
    if (!approvalAction || !comment.trim()) return;

    setSubmitting(true);
    try {
      if (approvalAction === 'approve') {
        await onApprove(request.stepId, comment);
      } else {
        await onReject(request.stepId, comment);
      }
      setShowApprovalModal(false);
      setComment('');
      setApprovalAction(null);
    } catch (error) {
      console.error('Error submitting decision:', error);
      // Error handling would go here - could add a toast notification
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setShowApprovalModal(false);
    setComment('');
    setApprovalAction(null);
  };

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{getLeaveTypeIcon()}</span>
            <div>
              <h3 className="text-lg font-medium text-gray-900">{getLeaveTypeName()}</h3>
              <p className="text-sm text-gray-500">
                Requested by {request.requestorName}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end space-y-2">
            <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full border ${getPriorityColor()}`}>
              {request.priority.toUpperCase()} PRIORITY
            </span>
            <span className="text-xs text-gray-500">
              Step: {request.currentStep}
            </span>
          </div>
        </div>

        {/* Request Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">📅 Duration</h4>
            <p className="text-sm text-gray-900">
              {formatDate(request.startDate)} - {formatDate(request.endDate)}
            </p>
            <p className="text-xs text-gray-500">{request.totalDays} day{request.totalDays !== 1 ? 's' : ''}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">📧 Contact</h4>
            <p className="text-sm text-gray-900">{request.requestorEmail}</p>
            <p className="text-xs text-gray-500">
              Submitted {new Date(request.submittedAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Reason */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 mb-2">📝 Reason</h4>
          <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md">
            {request.reason || 'No reason provided'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => handleActionClick('approve')}
            disabled={loading || submitting}
            className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Approve</span>
          </button>

          <button
            onClick={() => handleActionClick('reject')}
            disabled={loading || submitting}
            className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span>Reject</span>
          </button>
        </div>
      </div>

      {/* Approval Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-1/2 lg:w-1/3 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {approvalAction === 'approve' ? '✅ Approve Request' : '❌ Reject Request'}
                </h3>
                <button
                  onClick={handleCancel}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  You are about to {approvalAction} the leave request from {request.requestorName}.
                </p>
                <div className="bg-gray-50 p-3 rounded-md text-sm">
                  <strong>{getLeaveTypeName()}</strong><br />
                  {formatDate(request.startDate)} - {formatDate(request.endDate)} ({request.totalDays} days)
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {approvalAction === 'approve' ? 'Approval Comments *' : 'Rejection Reason *'}
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  placeholder={
                    approvalAction === 'approve'
                      ? 'Add any comments about this approval...'
                      : 'Please provide a clear reason for rejection...'
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                />
                {!comment.trim() && (
                  <p className="mt-1 text-sm text-red-600">Comment is required</p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleSubmitDecision}
                  disabled={!comment.trim() || submitting}
                  className={`flex-1 text-white py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                    approvalAction === 'approve'
                      ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                      : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                  }`}
                >
                  {submitting ? 'Processing...' : `Confirm ${approvalAction === 'approve' ? 'Approval' : 'Rejection'}`}
                </button>

                <button
                  onClick={handleCancel}
                  disabled={submitting}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ApprovalRequestCard;