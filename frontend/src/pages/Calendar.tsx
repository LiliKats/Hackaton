import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
// import { LeaveType } from '@/types';
import api from '@/services/api';
import { exportCalendarAsICS, exportCalendarAsCSV } from '@/utils/calendarExport';

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

interface BackendLeaveData {
  id: string;
  userId: string;
  type: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: string;
  priority: string;
  managerNotes?: string;
  createdAt: string;
  updatedAt: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
}

const Calendar: React.FC = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [leaveEntries, setLeaveEntries] = useState<LeaveEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [backendLeaveData, setBackendLeaveData] = useState<BackendLeaveData[]>([]);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Derive team members from leave data
  const teamMembers: Employee[] = useMemo(() => {
    const uniqueEmployees = new Map<string, Employee>();

    // Add current user if not in leave data
    if (user) {
      uniqueEmployees.set(user.id, {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        role: user.role || 'Employee'
      });
    }

    // Extract unique employees from leave entries
    leaveEntries.forEach(entry => {
      if (!uniqueEmployees.has(entry.employeeId)) {
        uniqueEmployees.set(entry.employeeId, {
          id: entry.employeeId,
          name: entry.employeeName,
          role: 'Employee' // Default role, could be enhanced by fetching user details
        });
      }
    });

    return Array.from(uniqueEmployees.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [leaveEntries, user]);

  // Helper function to convert backend data to calendar entries
  const convertBackendDataToCalendarEntries = (backendData: BackendLeaveData[]): LeaveEntry[] => {
    const entries: LeaveEntry[] = [];

    backendData.forEach(leave => {
      const startDate = new Date(leave.startDate);
      const endDate = new Date(leave.endDate);

      // Generate an entry for each day in the leave period
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        entries.push({
          employeeId: leave.userId,
          employeeName: `${leave.firstName} ${leave.lastName}`,
          employeeEmail: leave.email,
          date: formatDate(new Date(d)),
          leaveType: leave.type.toUpperCase(),
          status: leave.status.toUpperCase(),
          reason: leave.reason,
          submittedAt: leave.createdAt,
        });
      }
    });

    return entries;
  };

  // Fetch leave data from backend API
  useEffect(() => {
    const fetchLeaveData = async () => {
      setLoading(true);
      try {
        const response = await api.get<BackendLeaveData[]>('/leave-requests/all');
        setBackendLeaveData(response.data); // Store original backend data for export
        const calendarEntries = convertBackendDataToCalendarEntries(response.data);
        setLeaveEntries(calendarEntries);
        console.log('📅 Loaded leave data for calendar:', response.data.length, 'leave requests,', calendarEntries.length, 'calendar entries');
      } catch (error) {
        console.error('Error fetching leave data for calendar:', error);
        setLeaveEntries([]);
        setBackendLeaveData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaveData();

    // Refresh every 30 seconds to show new approvals
    const interval = setInterval(fetchLeaveData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowExportDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
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

  const handleYearSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const year = parseInt(event.target.value);
    setSelectedDate(new Date(year, selectedDate.getMonth()));
  };

  const handleMonthSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const month = parseInt(event.target.value);
    setSelectedDate(new Date(selectedDate.getFullYear(), month));
  };

  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = () => {
    const today = new Date();
    return selectedDate.getFullYear() === today.getFullYear() &&
           selectedDate.getMonth() === today.getMonth();
  };

  const handleGoToCurrentMonth = () => {
    setSelectedDate(new Date());
  };

  // Export handlers
  const handleExport = (format: 'ics' | 'csv') => {
    if (backendLeaveData.length === 0) {
      alert('No leave data available to export');
      return;
    }

    const teamName = user?.department || 'Team';

    if (format === 'ics') {
      exportCalendarAsICS(backendLeaveData, teamName);
    } else {
      exportCalendarAsCSV(backendLeaveData, teamName);
    }

    setShowExportDropdown(false);
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
              {!loading && <span className="ml-2 text-gray-500">({backendLeaveData.length} leave requests)</span>}
            </p>
          </div>

          {/* Export Actions */}
          <div className="flex items-center space-x-3">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                disabled={loading || backendLeaveData.length === 0}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                title="Export team calendar data"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Export</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {showExportDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                  <div className="py-1">
                    <button
                      onClick={() => handleExport('ics')}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <div className="text-left">
                        <div className="font-medium">Calendar (ICS)</div>
                        <div className="text-xs text-gray-500">Import to Google Calendar, Outlook</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleExport('csv')}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="text-left">
                        <div className="font-medium">Spreadsheet (CSV)</div>
                        <div className="text-xs text-gray-500">Open in Excel, Google Sheets</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Month Navigation */}
        <div className="flex justify-center mt-4">
          <div className="flex items-center space-x-4 bg-white border border-gray-300 rounded-lg p-2">
            <button
              onClick={() => handleMonthChange('prev')}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              title="Previous Month"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Year Selector */}
            <div className="min-w-24">
              <select
                value={selectedDate.getFullYear()}
                onChange={handleYearSelect}
                className="block w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center font-medium"
              >
                {Array.from({ length: 10 }, (_, i) => {
                  const year = new Date().getFullYear() - 5 + i;
                  return (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Month Selector */}
            <div className="min-w-32">
              <select
                value={selectedDate.getMonth()}
                onChange={handleMonthSelect}
                className="block w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center font-medium"
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const date = new Date(selectedDate.getFullYear(), i, 1);
                  return (
                    <option key={i} value={i}>
                      {date.toLocaleDateString('en-US', { month: 'long' })}
                    </option>
                  );
                })}
              </select>
            </div>

            <button
              onClick={() => handleMonthChange('next')}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              title="Next Month"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Current Month Button - always visible, disabled when viewing current month */}
            <button
              onClick={handleGoToCurrentMonth}
              disabled={isCurrentMonth()}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors border ${
                isCurrentMonth()
                  ? 'text-gray-400 cursor-not-allowed border-gray-200 bg-gray-50'
                  : 'text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 border-indigo-200 bg-indigo-50'
              }`}
              title={isCurrentMonth() ? 'Currently viewing this month' : 'Go to current month'}
            >
              <div className="flex items-center space-x-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Current</span>
              </div>
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