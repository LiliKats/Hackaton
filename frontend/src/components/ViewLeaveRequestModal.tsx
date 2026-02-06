import React from 'react';
import { LeaveType, LeaveStatus, LeaveRequest } from '@/types';

interface ViewLeaveRequestModalProps {
  request: LeaveRequest;
  onClose: () => void;
  onEdit?: () => void;
  onCancel?: () => void;
}

const ViewLeaveRequestModal: React.FC<ViewLeaveRequestModalProps> = ({
  request,
  onClose,
  onEdit,
  onCancel,
}) => {
  const getStatusColor = () => {
    switch (request.status) {
      case LeaveStatus.APPROVED:
        return 'bg-green-100 text-green-800 border-green-200';
      case LeaveStatus.REJECTED:
        return 'bg-red-100 text-red-800 border-red-200';
      case LeaveStatus.PENDING:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case LeaveStatus.CANCELLED:
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getTypeIcon = () => {
    switch (request.type) {
      case LeaveType.ANNUAL:
        return '🏖️';
      case LeaveType.SICK:
        return '🏥';
      case LeaveType.UNPAID:
        return '💼';
      case LeaveType.PERSONAL:
        return '👤';
      default:
        return '📅';
    }
  };

  const getTypeName = () => {
    switch (request.type) {
      case LeaveType.ANNUAL:
        return 'Paid Leave';
      case LeaveType.SICK:
        return 'Sick Leave';
      case LeaveType.UNPAID:
        return 'Unpaid Leave';
      case LeaveType.PERSONAL:
        return 'Personal Leave';
      default:
        return request.type;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const canEdit = request.status === LeaveStatus.PENDING;
  const canCancel = request.status === LeaveStatus.PENDING || request.status === LeaveStatus.APPROVED;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full max-h-[85vh] overflow-y-auto transform transition-all">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-indigo-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                <span className="text-lg">👁️</span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Request Details</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Header with icon and type */}
          <div className="flex items-center space-x-4">
            <span className="text-3xl">{getTypeIcon()}</span>
            <div className="flex-1">
              <h3 className="text-lg font-medium text-gray-900">{getTypeName()}</h3>
              <p className="text-sm text-gray-500">Request ID: {request.id}</p>
            </div>
            <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full border ${getStatusColor()}`}>
              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
            </span>
          </div>

          {/* Duration */}
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg p-4">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                <span className="text-lg">📅</span>
              </div>
              <h4 className="text-sm font-medium text-gray-900">Duration</h4>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Start Date:</span>
                <span className="text-sm font-medium text-gray-900">{formatDate(request.startDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">End Date:</span>
                <span className="text-sm font-medium text-gray-900">{formatDate(request.endDate)}</span>
              </div>
              <div className="flex justify-between border-t border-indigo-200 pt-3">
                <span className="text-sm text-gray-600">Total Days:</span>
                <span className="text-sm font-bold text-indigo-600">{request.totalDays} day{request.totalDays !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>

          {/* Reason */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <span className="text-lg">✍️</span>
              <h4 className="text-sm font-medium text-gray-900">Reason</h4>
            </div>
            <div className="bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-700 leading-relaxed">{request.reason || 'No reason provided'}</p>
            </div>
          </div>

          {/* Metadata */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-900">Request Information</h4>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex justify-between">
                <span className="text-xs text-gray-600">Submitted:</span>
                <span className="text-xs font-medium">{formatDateTime(request.createdAt)}</span>
              </div>
              {request.updatedAt && request.updatedAt !== request.createdAt && (
                <div className="flex justify-between">
                  <span className="text-xs text-gray-600">Last Updated:</span>
                  <span className="text-xs font-medium">{formatDateTime(request.updatedAt)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-xs text-gray-600">Priority:</span>
                <span className="text-xs font-medium capitalize">{request.priority || 'Medium'}</span>
              </div>
            </div>
          </div>

          {/* Manager Notes */}
          {request.managerNotes && (
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Manager Notes</h4>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-700">{request.managerNotes}</p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-end space-x-2">
          {canEdit && onEdit && (
            <button
              onClick={onEdit}
              className="px-4 py-2 text-sm text-blue-700 bg-blue-50 border border-blue-300 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors font-medium flex items-center space-x-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>Edit</span>
            </button>
          )}

          {canCancel && onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-red-700 bg-red-50 border border-red-300 rounded-md hover:bg-red-100 focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors font-medium flex items-center space-x-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Decline</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-500 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewLeaveRequestModal;