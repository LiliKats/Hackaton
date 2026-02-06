import React, { useState } from 'react';
import { LeaveType } from '@/types';

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
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      const timeDiff = end.getTime() - start.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
      return daysDiff > 0 ? daysDiff : 0;
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
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto transform transition-all">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 7V3a1 1 0 011-1h6a1 1 0 011 1v4h3a1 1 0 110 2h-1v9a2 2 0 01-2 2H7a2 2 0 01-2-2V9H4a1 1 0 110-2h4z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-gray-900">Request Time Off</h3>
              <p className="text-sm text-gray-500">Submit your leave request for approval</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form Content */}
        <div className="p-6">

          <form className="space-y-6">
            {/* Leave Type Selection */}
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-3">
                <span className="mr-2">📋</span>
                Leave Type *
              </label>
              <div className="relative">
                <select
                  value={formData.type}
                  onChange={(e) => handleInputChange('type', e.target.value as LeaveType)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white shadow-sm transition-all hover:border-gray-400"
                >
                  {leaveTypeOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Date Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-3">
                  <span className="mr-2">📅</span>
                  From Date *
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm transition-all hover:border-gray-400 ${
                    errors.startDate ? 'border-red-300 ring-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.startDate && (
                  <p className="mt-2 flex items-center text-sm text-red-600">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.startDate}
                  </p>
                )}
              </div>

              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-3">
                  <span className="mr-2">📅</span>
                  To Date *
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => handleInputChange('endDate', e.target.value)}
                  min={formData.startDate || new Date().toISOString().split('T')[0]}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm transition-all hover:border-gray-400 ${
                    errors.endDate ? 'border-red-300 ring-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.endDate && (
                  <p className="mt-2 flex items-center text-sm text-red-600">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.endDate}
                  </p>
                )}
              </div>
            </div>

            {/* Duration Display */}
            {formData.startDate && formData.endDate && (
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                    <span className="text-lg">⏱️</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-indigo-900">
                      Total Duration: {calculateDays()} day{calculateDays() !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-indigo-700">
                      Your request will be submitted for manager approval
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-3">
                <span className="mr-2">✍️</span>
                Reason *
              </label>
              <textarea
                value={formData.reason}
                onChange={(e) => handleInputChange('reason', e.target.value)}
                rows={4}
                placeholder="Please provide a detailed reason for your leave request. Include any relevant information that will help your manager make an informed decision..."
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm transition-all hover:border-gray-400 resize-none ${
                  errors.reason ? 'border-red-300 ring-red-500' : 'border-gray-300'
                }`}
              />
              {errors.reason && (
                <p className="mt-2 flex items-center text-sm text-red-600">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {errors.reason}
                </p>
              )}
            </div>

          </form>

          {/* Help Text */}
          <div className="mt-6 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-lg">💡</span>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-amber-900 mb-2">Before you submit:</h4>
                <ul className="text-sm text-amber-800 space-y-1">
                  <li>• <strong>Draft:</strong> Save your request to complete later</li>
                  <li>• <strong>Submit:</strong> Send for manager approval immediately</li>
                  <li>• <strong>Tip:</strong> Provide detailed reasons for faster approval</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 rounded-b-xl flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 sm:flex-none px-6 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200 font-medium"
          >
            Cancel
          </button>

          <div className="flex flex-1 gap-3">
            <button
              type="button"
              onClick={() => handleSubmit('plan')}
              className="flex-1 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200 font-medium flex items-center justify-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Save Draft</span>
            </button>

            <button
              type="button"
              onClick={() => handleSubmit('request')}
              className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200 font-medium flex items-center justify-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              <span>Submit Request</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VacationRequestForm;