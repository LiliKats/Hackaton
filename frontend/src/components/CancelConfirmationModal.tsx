import React from 'react';
import { LeaveRequest } from '@/types';

interface CancelConfirmationModalProps {
  request: LeaveRequest;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const CancelConfirmationModal: React.FC<CancelConfirmationModalProps> = ({
  request,
  onConfirm,
  onCancel,
  isLoading = false
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getTypeIcon = () => {
    switch (request.type) {
      case 'annual': return '🏖️';
      case 'sick': return '🏥';
      case 'unpaid': return '💼';
      case 'personal': return '👤';
      default: return '📅';
    }
  };

  const getStatusBadgeColor = () => {
    switch (request.status) {
      case 'approved': return 'bg-green-100 text-green-700 border-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full transform transition-all">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Cancel Leave Request</h3>
              <p className="text-sm text-gray-500">This action cannot be undone</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-600 mb-6">
            Are you sure you want to cancel this leave request? Once cancelled, you'll need to create a new request if you still need time off.
          </p>

          {/* Request Summary Card */}
          <div className="bg-gray-50 rounded-lg p-4 border">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-3">
                <span className="text-xl">{getTypeIcon()}</span>
                <div>
                  <h4 className="font-medium text-gray-900 capitalize">
                    {request.type.replace('_', ' ')} Leave
                  </h4>
                  <p className="text-sm text-gray-500">
                    {formatDate(request.startDate)} - {formatDate(request.endDate)}
                  </p>
                </div>
              </div>
              <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusBadgeColor()}`}>
                {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Duration:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {request.totalDays} day{request.totalDays !== 1 ? 's' : ''}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Request ID:</span>
                <span className="ml-2 font-mono text-xs text-gray-700">
                  {request.id.split('-').pop()}
                </span>
              </div>
            </div>

            {request.reason && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <span className="text-gray-500 text-sm">Reason:</span>
                <p className="text-sm text-gray-700 mt-1">
                  {request.reason}
                </p>
              </div>
            )}
          </div>

          {/* Warning Message */}
          {request.status === 'approved' && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start space-x-2">
              <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-800">This request has been approved</p>
                <p className="text-xs text-amber-700 mt-1">
                  Cancelling an approved request may require manager notification
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-xl flex justify-end space-x-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Keep Request
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            {isLoading && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            <span>{isLoading ? 'Cancelling...' : 'Yes, Cancel Request'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancelConfirmationModal;