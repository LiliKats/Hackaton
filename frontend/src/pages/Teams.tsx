import React from 'react';

const Teams: React.FC = () => {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Teams</h1>
        <p className="text-gray-600">Manage team members and view their leave status</p>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          <li className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <img
                    className="h-10 w-10 rounded-full"
                    src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                    alt="Profile"
                  />
                </div>
                <div className="ml-4">
                  <div className="text-sm font-medium text-gray-900">John Doe</div>
                  <div className="text-sm text-gray-500">Software Engineer • john@example.com</div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                  Available
                </span>
                <span className="text-sm text-gray-500">15 days left</span>
              </div>
            </div>
          </li>
          <li className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <img
                    className="h-10 w-10 rounded-full"
                    src="https://images.unsplash.com/photo-1494790108755-2616b612b47c?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                    alt="Profile"
                  />
                </div>
                <div className="ml-4">
                  <div className="text-sm font-medium text-gray-900">Jane Smith</div>
                  <div className="text-sm text-gray-500">Product Manager • jane@example.com</div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                  On Leave
                </span>
                <span className="text-sm text-gray-500">Back Mar 1</span>
              </div>
            </div>
          </li>
          <li className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <img
                    className="h-10 w-10 rounded-full"
                    src="https://images.unsplash.com/photo-1519244703995-f4e0f30006d5?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                    alt="Profile"
                  />
                </div>
                <div className="ml-4">
                  <div className="text-sm font-medium text-gray-900">Mike Johnson</div>
                  <div className="text-sm text-gray-500">Designer • mike@example.com</div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                  Available
                </span>
                <span className="text-sm text-gray-500">22 days left</span>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Teams;