import React from 'react';
import { LeaveStatus, LeaveType } from '@/types';

interface RequestStatusCardProps {
  id: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  status: LeaveStatus;
  reason: string;
  totalDays: number;
  submittedAt: string;
  onEdit?: (id: string) => void;
  onCancel?: (id: string) => void;
  onView?: (id: string) => void;
}

const RequestStatusCard: React.FC<RequestStatusCardProps> = ({
  id,
  type,
  startDate,
  endDate,
  status,
  reason,
  totalDays,
  submittedAt,
  onEdit,
  onCancel,
  onView
}) => {
  const getStatusColor = () => {
    switch (status) {
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
    switch (type) {
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
    switch (type) {
      case LeaveType.ANNUAL:
        return 'Paid Leave';
      case LeaveType.SICK:
        return 'Sick Leave';
      case LeaveType.UNPAID:
        return 'Unpaid Leave';
      case LeaveType.PERSONAL:
        return 'Personal Leave';
      default:
        return type;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const canEdit = status === LeaveStatus.PENDING;
  const canCancel = status === LeaveStatus.PENDING || status === LeaveStatus.APPROVED;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">{getTypeIcon()}</span>
          <div>
            <h3 className="text-lg font-medium text-gray-900">{getTypeName()}</h3>
            <p className="text-sm text-gray-500">
              {formatDate(startDate)} - {formatDate(endDate)} • {totalDays} day{totalDays !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor()}`}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>

      {/* Reason */}
      {reason && (
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            <span className="font-medium">Reason:</span> {reason}
          </p>
        </div>
      )}

      {/* Metadata */}
      <div className="text-xs text-gray-500 mb-4">
        Submitted: {new Date(submittedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-2">
        {onView && (
          <button
            onClick={() => onView(id)}
            className="px-3 py-1 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-colors"
          >
            View Details
          </button>
        )}

        {canEdit && onEdit && (
          <button
            onClick={() => onEdit(id)}
            className="px-3 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
          >
            Edit
          </button>
        )}

        {canCancel && onCancel && (
          <button
            onClick={() => onCancel(id)}
            className="px-3 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};

export default RequestStatusCard;