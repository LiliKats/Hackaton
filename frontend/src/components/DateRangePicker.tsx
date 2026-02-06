import React from 'react';
import { calculateWorkingDays } from '@/utils/dateUtils';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  minDate?: string;
  maxDate?: string;
  className?: string;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  minDate,
  maxDate,
  className = ''
}) => {
  // const [showCalendar, setShowCalendar] = useState(false);

  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return 'Select date';
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const calculateDaysBetween = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const timeDiff = end.getTime() - start.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
  };

  const getWeekdayCount = () => {
    if (!startDate || !endDate) return 0;

    let count = 0;
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Exclude Saturday (6) and Sunday (0)
        count++;
      }
    }

    return count;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Date Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            From Date
          </label>
          <div className="relative">
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              min={minDate || new Date().toISOString().split('T')[0]}
              max={maxDate}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            To Date
          </label>
          <div className="relative">
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              min={startDate || minDate || new Date().toISOString().split('T')[0]}
              max={maxDate}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Date Range Summary */}
      {startDate && endDate && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-blue-800">From:</span>
              <p className="text-blue-700">{formatDateForDisplay(startDate)}</p>
            </div>
            <div>
              <span className="font-medium text-blue-800">To:</span>
              <p className="text-blue-700">{formatDateForDisplay(endDate)}</p>
            </div>
            <div>
              <span className="font-medium text-blue-800">Duration:</span>
              <p className="text-blue-700">
                {calculateWorkingDays(startDate, endDate)} working days
                <br />
                <span className="text-xs text-blue-600">
                  ({calculateDaysBetween()} total days)
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Presets */}
      <div className="flex flex-wrap gap-2">
        <h4 className="w-full text-sm font-medium text-gray-700 mb-2">Quick Options:</h4>

        <button
          type="button"
          onClick={() => {
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
            onStartDateChange(tomorrow.toISOString().split('T')[0]);
            onEndDateChange(tomorrow.toISOString().split('T')[0]);
          }}
          className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
        >
          Tomorrow
        </button>

        <button
          type="button"
          onClick={() => {
            const today = new Date();
            const nextWeek = new Date(today);
            nextWeek.setDate(today.getDate() + 7);
            const nextWeekEnd = new Date(nextWeek);
            nextWeekEnd.setDate(nextWeek.getDate() + 4); // Friday
            onStartDateChange(nextWeek.toISOString().split('T')[0]);
            onEndDateChange(nextWeekEnd.toISOString().split('T')[0]);
          }}
          className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
        >
          Next Week
        </button>

        <button
          type="button"
          onClick={() => {
            const today = new Date();
            const twoWeeksLater = new Date(today);
            twoWeeksLater.setDate(today.getDate() + 14);
            const twoWeeksEnd = new Date(twoWeeksLater);
            twoWeeksEnd.setDate(twoWeeksLater.getDate() + 4);
            onStartDateChange(twoWeeksLater.toISOString().split('T')[0]);
            onEndDateChange(twoWeeksEnd.toISOString().split('T')[0]);
          }}
          className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
        >
          In 2 Weeks
        </button>
      </div>
    </div>
  );
};

export default DateRangePicker;