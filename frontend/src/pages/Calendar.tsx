import React from 'react';

const Calendar: React.FC = () => {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
        <p className="text-gray-600">View team leave schedule and plan your time off</p>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
          {/* Calendar header */}
          <div className="bg-gray-50 py-2 px-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
            Sun
          </div>
          <div className="bg-gray-50 py-2 px-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
            Mon
          </div>
          <div className="bg-gray-50 py-2 px-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
            Tue
          </div>
          <div className="bg-gray-50 py-2 px-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
            Wed
          </div>
          <div className="bg-gray-50 py-2 px-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
            Thu
          </div>
          <div className="bg-gray-50 py-2 px-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
            Fri
          </div>
          <div className="bg-gray-50 py-2 px-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
            Sat
          </div>

          {/* Calendar body - simplified version */}
          {Array.from({ length: 35 }, (_, i) => (
            <div
              key={i}
              className="bg-white p-2 h-20 flex flex-col justify-between text-sm"
            >
              <span className="text-gray-900">{((i % 31) + 1)}</span>
              {/* Add leave indicators */}
              {i === 15 && (
                <div className="w-full h-1 bg-indigo-500 rounded"></div>
              )}
              {i === 22 && (
                <div className="w-full h-1 bg-green-500 rounded"></div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center space-x-6">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-indigo-500 rounded-full mr-2"></div>
            <span className="text-sm text-gray-600">My Leave</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            <span className="text-sm text-gray-600">Team Leave</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
            <span className="text-sm text-gray-600">Pending</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calendar;