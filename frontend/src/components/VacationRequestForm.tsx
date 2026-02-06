import React, { useState } from 'react';
import { LeaveType } from '@/types';
import { calculateWorkingDays } from '@/utils/dateUtils';

interface VacationRequestFormProps {
  onClose: () => void;
  onSubmit: (formData: VacationRequestData) => void;
}

interface VacationRequestData {
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  action: 'plan' | 'request';
}

const VacationRequestForm: React.FC<VacationRequestFormProps> = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState<VacationRequestData>({
    type: LeaveType.ANNUAL,
    startDate: '',
    endDate: '',
    reason: '',
    action: 'plan'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const leaveTypeOptions = [
    { value: LeaveType.ANNUAL, label: 'Paid Leave (Annual)' },
    { value: LeaveType.UNPAID, label: 'Unpaid Leave' },
    { value: LeaveType.SICK, label: 'Sick Leave' },
    { value: LeaveType.PERSONAL, label: 'Personal Leave' },
  ];

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }
    if (!formData.endDate) {
      newErrors.endDate = 'End date is required';
    }
    if (formData.startDate && formData.endDate && new Date(formData.startDate) > new Date(formData.endDate)) {
      newErrors.endDate = 'End date must be after start date';
    }
    if (formData.startDate && new Date(formData.startDate) < new Date()) {
      newErrors.startDate = 'Start date cannot be in the past';
    }
    if (!formData.reason.trim()) {
      newErrors.reason = 'Reason is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const calculateDays = () => {
    if (formData.startDate && formData.endDate) {
      return calculateWorkingDays(formData.startDate, formData.endDate);
    }
    return 0;
  };

  const handleSubmit = (action: 'plan' | 'request') => {
    const updatedFormData = { ...formData, action };
    setFormData(updatedFormData);

    if (validateForm()) {
      onSubmit(updatedFormData);
    }
  };

  const handleInputChange = (field: keyof VacationRequestData, value: string | LeaveType) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto transform transition-all">
        {/* Compact Header */}
        <div className="p-4 border-b border-gray-200 bg-indigo-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                <span className="text-lg">🏖️</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Time Off Request</h3>
              </div>
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

        {/* Form Content */}
        <div className="p-4">
          <form className="space-y-4">
            {/* Leave Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Leave Type *
              </label>
              <select
                value={formData.type}
                onChange={(e) => handleInputChange('type', e.target.value as LeaveType)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
              >
                {leaveTypeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Selection */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  From *
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                    errors.startDate ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.startDate && (
                  <p className="mt-1 text-xs text-red-600">{errors.startDate}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  To *
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => handleInputChange('endDate', e.target.value)}
                  min={formData.startDate || new Date().toISOString().split('T')[0]}
                  className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                    errors.endDate ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.endDate && (
                  <p className="mt-1 text-xs text-red-600">{errors.endDate}</p>
                )}
              </div>
            </div>

            {/* Duration Display */}
            {formData.startDate && formData.endDate && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-md p-3">
                <p className="text-sm font-medium text-indigo-900">
                  Duration: {calculateDays()} day{calculateDays() !== 1 ? 's' : ''}
                </p>
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason *
              </label>
              <textarea
                value={formData.reason}
                onChange={(e) => handleInputChange('reason', e.target.value)}
                rows={3}
                placeholder="Provide reason for your leave request..."
                className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none ${
                  errors.reason ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.reason && (
                <p className="mt-1 text-xs text-red-600">{errors.reason}</p>
              )}
            </div>

          </form>
        </div>

        {/* Compact Action Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => handleSubmit('plan')}
            className="flex-1 px-4 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
          >
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => handleSubmit('request')}
            className="flex-1 px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors font-medium"
          >
            Submit Request
          </button>
        </div>
      </div>
    </div>
  );
};

export default VacationRequestForm;