import React from 'react';

const LeaveRequests: React.FC = () => {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Leave Requests</h1>
        <p className="text-gray-600">Manage your vacation and leave requests</p>
      </div>

      <div className="mb-6">
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
          New Request
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          <li className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="inline-block h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                    📅
                  </span>
                </div>
                <div className="ml-4">
                  <div className="text-sm font-medium text-gray-900">Summer Vacation</div>
                  <div className="text-sm text-gray-500">July 15 - July 29, 2024 • 14 days</div>
                </div>
              </div>
              <div className="flex items-center">
                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                  Pending
                </span>
              </div>
            </div>
          </li>
          <li className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="inline-block h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                    🏥
                  </span>
                </div>
                <div className="ml-4">
                  <div className="text-sm font-medium text-gray-900">Sick Leave</div>
                  <div className="text-sm text-gray-500">June 10, 2024 • 1 day</div>
                </div>
              </div>
              <div className="flex items-center">
                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                  Approved
                </span>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default LeaveRequests;