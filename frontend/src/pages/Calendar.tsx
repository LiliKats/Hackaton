import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
// import { LeaveType } from '@/types';
import api from '@/services/api';

interface Employee {
  id: string;
  name: string;
  role: string;
  avatar?: string;
}

interface LeaveEntry {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  date: string;
  leaveType: string;
  status: string;
  reason: string;
  approvedAt?: string;
  approvedBy?: string;
  submittedAt?: string;
}

const Calendar: React.FC = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [leaveEntries, setLeaveEntries] = useState<LeaveEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Team members - we'll derive this from leave data
  const teamMembers: Employee[] = [
    { id: 'current-user', name: `${user?.firstName || 'You'} ${user?.lastName || '(Manager)'}`, role: 'Manager' },
    { id: 'john-doe', name: 'John Doe', role: 'Software Engineer' },
    { id: 'jane-smith', name: 'Jane Smith', role: 'Product Manager' },
    { id: 'mike-johnson', name: 'Mike Johnson', role: 'Designer' },
    { id: 'sarah-wilson', name: 'Sarah Wilson', role: 'QA Engineer' },
    { id: 'alex-chen', name: 'Alex Chen', role: 'DevOps Engineer' },
    { id: 'emily-rodriguez', name: 'Emily Rodriguez', role: 'Frontend Developer' },
  ];

  // Fetch leave data from backend API
  useEffect(() => {
    const fetchLeaveData = async () => {
      setLoading(true);
      try {
        const response = await api.get<LeaveEntry[]>('/leave-requests/all');
        setLeaveEntries(response.data);
        console.log('📅 Loaded leave data for calendar:', response.data.length, 'entries');
      } catch (error) {
        console.error('Error fetching leave data for calendar:', error);
        setLeaveEntries([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaveData();

    // Refresh every 30 seconds to show new approvals
    const interval = setInterval(fetchLeaveData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));
  };

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const getLeaveForEmployeeOnDate = (employeeId: string, date: string) => {
    return leaveEntries.find(entry => entry.employeeId === employeeId && entry.date === date);
  };

  const getLeaveTypeColor = (type: string, status: string) => {
    const baseColors: Record<string, string> = {
      'ANNUAL': 'bg-blue-100 text-blue-800 border-blue-200',
      'SICK': 'bg-red-100 text-red-800 border-red-200',
      'PERSONAL': 'bg-purple-100 text-purple-800 border-purple-200',
      'UNPAID': 'bg-gray-100 text-gray-800 border-gray-200',
      'MATERNITY': 'bg-pink-100 text-pink-800 border-pink-200',
      'PATERNITY': 'bg-green-100 text-green-800 border-green-200',
      'OTHER': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    };

    if (status === 'PENDING') {
      return 'bg-orange-100 text-orange-800 border-orange-200 border-dashed';
    }

    return baseColors[type] || baseColors['OTHER'];
  };

  const getLeaveTypeAbbr = (type: string) => {
    const abbr: Record<string, string> = {
      'ANNUAL': 'V',
      'SICK': 'S',
      'PERSONAL': 'P',
      'UNPAID': 'U',
      'MATERNITY': 'M',
      'PATERNITY': 'PT',
      'OTHER': 'O',
    };
    return abbr[type] || 'O';
  };

  const daysInSelectedMonth = useMemo(() => getDaysInMonth(selectedDate), [selectedDate]);

  const handleMonthChange = (direction: 'prev' | 'next') => {
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const handleMonthSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const [year, month] = event.target.value.split('-').map(Number);
    setSelectedDate(new Date(year, month));
  };

  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Team Calendar</h1>
            <p className="text-gray-600">
              View team leave schedule and plan your time off
              {loading && <span className="ml-2 text-indigo-600">Loading...</span>}
            </p>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center space-x-4">
            <button
              onClick={() => handleMonthChange('prev')}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="min-w-48">
              <select
                value={`${selectedDate.getFullYear()}-${selectedDate.getMonth()}`}
                onChange={handleMonthSelect}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {Array.from({ length: 24 }, (_, i) => {
                  const date = new Date();
                  date.setMonth(date.getMonth() - 12 + i);
                  return (
                    <option key={i} value={`${date.getFullYear()}-${date.getMonth()}`}>
                      {date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </option>
                  );
                })}
              </select>
            </div>

            <button
              onClick={() => handleMonthChange('next')}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Team Calendar Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="sticky left-0 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-48">
                  Employee
                </th>
                {daysInSelectedMonth.map((date) => (
                  <th
                    key={date.toISOString()}
                    className={`px-2 py-3 text-center text-xs font-medium uppercase tracking-wider min-w-12 ${
                      isWeekend(date)
                        ? 'text-red-500 bg-red-50'
                        : isToday(date)
                        ? 'text-indigo-600 bg-indigo-50'
                        : 'text-gray-500'
                    }`}
                  >
                    <div>{date.getDate()}</div>
                    <div className="text-xs">
                      {date.toLocaleDateString('en-US', { weekday: 'short' }).substr(0, 2)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {teamMembers.map((employee) => (
                <tr key={employee.id} className="hover:bg-gray-50">
                  <td className="sticky left-0 bg-white px-6 py-4 whitespace-nowrap border-r border-gray-200">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-indigo-600">
                            {employee.name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                        <div className="text-sm text-gray-500">{employee.role}</div>
                      </div>
                    </div>
                  </td>
                  {daysInSelectedMonth.map((date) => {
                    const dateStr = formatDate(date);
                    const leave = getLeaveForEmployeeOnDate(employee.id, dateStr);
                    const weekend = isWeekend(date);
                    const today = isToday(date);

                    return (
                      <td
                        key={dateStr}
                        className={`px-2 py-4 text-center ${
                          weekend ? 'bg-gray-50' : today ? 'bg-indigo-50' : ''
                        }`}
                      >
                        {leave ? (
                          <div
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getLeaveTypeColor(
                              leave.leaveType,
                              leave.status
                            )}`}
                            title={`${leave.leaveType} - ${leave.status}\n${leave.reason}`}
                          >
                            {getLeaveTypeAbbr(leave.leaveType)}
                          </div>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Legend</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">V</span>
            <span>Vacation</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">S</span>
            <span>Sick Leave</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">P</span>
            <span>Personal</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">U</span>
            <span>Unpaid</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200 border-dashed">?</span>
            <span>Pending</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-red-500 font-medium">Weekend</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-indigo-600 font-medium">Today</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calendar;