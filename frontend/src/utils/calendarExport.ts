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

/**
 * Generate a unique UID for calendar events
 */
const generateUID = (leaveData: BackendLeaveData): string => {
  const timestamp = new Date(leaveData.createdAt).getTime();
  return `leave-${leaveData.id}-${timestamp}@leaveboard.app`;
};

/**
 * Format date for ICS format (YYYYMMDD)
 */
const formatICSDate = (date: string): string => {
  return date.replace(/-/g, '');
};

/**
 * Format datetime for ICS format (YYYYMMDDTHHMMSSZ)
 */
const formatICSDateTime = (date: string): string => {
  const d = new Date(date);
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
};

/**
 * Escape text for ICS format
 */
const escapeICSText = (text: string): string => {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
};

/**
 * Get leave type display name
 */
const getLeaveTypeDisplayName = (type: string): string => {
  const typeMap: Record<string, string> = {
    'annual': 'Annual Leave',
    'sick': 'Sick Leave',
    'personal': 'Personal Leave',
    'unpaid': 'Unpaid Leave',
    'maternity': 'Maternity Leave',
    'paternity': 'Paternity Leave',
    'other': 'Other Leave'
  };
  return typeMap[type.toLowerCase()] || type;
};

/**
 * Get status display name
 */
const getStatusDisplayName = (status: string): string => {
  const statusMap: Record<string, string> = {
    'pending': 'Pending Approval',
    'approved': 'Approved',
    'rejected': 'Rejected',
    'cancelled': 'Cancelled'
  };
  return statusMap[status.toLowerCase()] || status;
};

/**
 * Generate ICS (iCalendar) format from leave data
 */
export const generateICS = (leaveData: BackendLeaveData[], teamName: string = 'Team'): string => {
  const now = new Date();
  const timestamp = formatICSDateTime(now.toISOString());

  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LeaveBoard//Team Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${teamName} Leave Schedule`,
    'X-WR-CALDESC:Team leave and absence schedule exported from LeaveBoard',
    'X-WR-TIMEZONE:UTC'
  ].join('\r\n');

  // Group leave data by leave request ID to avoid duplicating multi-day leaves
  const leaveRequests = leaveData.reduce((acc, leave) => {
    if (!acc[leave.id]) {
      acc[leave.id] = leave;
    }
    return acc;
  }, {} as Record<string, BackendLeaveData>);

  // Generate events for each unique leave request
  Object.values(leaveRequests).forEach(leave => {
    const uid = generateUID(leave);
    const startDate = formatICSDate(leave.startDate);

    // Calculate end date for all-day events (add 1 day)
    const nextDay = new Date(leave.endDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const dtEnd = formatICSDate(nextDay.toISOString().split('T')[0]);

    const summary = escapeICSText(`${leave.firstName} ${leave.lastName} - ${getLeaveTypeDisplayName(leave.type)}`);
    const status = getStatusDisplayName(leave.status);

    let description = [
      `Employee: ${leave.firstName} ${leave.lastName}`,
      `Email: ${leave.email}`,
      `Department: ${leave.department}`,
      `Leave Type: ${getLeaveTypeDisplayName(leave.type)}`,
      `Status: ${status}`,
      `Duration: ${leave.totalDays} day${leave.totalDays !== 1 ? 's' : ''}`,
      `Reason: ${leave.reason}`,
      `Submitted: ${new Date(leave.createdAt).toLocaleDateString()}`
    ];

    if (leave.managerNotes) {
      description.push(`Manager Notes: ${leave.managerNotes}`);
    }

    if (leave.status === 'approved' && leave.updatedAt !== leave.createdAt) {
      description.push(`Approved: ${new Date(leave.updatedAt).toLocaleDateString()}`);
    }

    const event = [
      '',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${timestamp}`,
      `DTSTART;VALUE=DATE:${startDate}`,
      `DTEND;VALUE=DATE:${dtEnd}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${escapeICSText(description.join('\\n'))}`,
      `ORGANIZER;CN=${escapeICSText(leave.firstName + ' ' + leave.lastName)}:mailto:${leave.email}`,
      `LOCATION:${escapeICSText(leave.department)}`,
      `STATUS:${leave.status === 'approved' ? 'CONFIRMED' : leave.status === 'pending' ? 'TENTATIVE' : 'CANCELLED'}`,
      `TRANSP:${leave.status === 'approved' ? 'OPAQUE' : 'TRANSPARENT'}`,
      `CATEGORIES:${escapeICSText(getLeaveTypeDisplayName(leave.type))}`,
      `X-LEAVE-TYPE:${leave.type.toUpperCase()}`,
      `X-LEAVE-STATUS:${leave.status.toUpperCase()}`,
      `X-EMPLOYEE-ID:${leave.userId}`,
      `X-REQUEST-ID:${leave.id}`,
      'END:VEVENT'
    ].join('\r\n');

    ics += event;
  });

  ics += '\r\nEND:VCALENDAR';
  return ics;
};

/**
 * Generate CSV format from leave data
 */
export const generateCSV = (leaveData: BackendLeaveData[]): string => {
  const headers = [
    'Request ID',
    'Employee Name',
    'Email',
    'Department',
    'Leave Type',
    'Start Date',
    'End Date',
    'Total Days',
    'Status',
    'Reason',
    'Submitted Date',
    'Manager Notes'
  ].join(',');

  const rows = leaveData.map(leave => [
    leave.id,
    `"${leave.firstName} ${leave.lastName}"`,
    leave.email,
    `"${leave.department}"`,
    getLeaveTypeDisplayName(leave.type),
    leave.startDate,
    leave.endDate,
    leave.totalDays,
    getStatusDisplayName(leave.status),
    `"${leave.reason}"`,
    new Date(leave.createdAt).toLocaleDateString(),
    `"${leave.managerNotes || ''}"`
  ].join(','));

  return [headers, ...rows].join('\n');
};

/**
 * Download file with given content and filename
 */
export const downloadFile = (content: string, filename: string, contentType: string): void => {
  const blob = new Blob([content], { type: contentType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

/**
 * Export team calendar as ICS file
 */
export const exportCalendarAsICS = (leaveData: BackendLeaveData[], teamName: string = 'Team'): void => {
  const icsContent = generateICS(leaveData, teamName);
  const filename = `${teamName.replace(/\s+/g, '_')}_Leave_Schedule_${new Date().toISOString().split('T')[0]}.ics`;
  downloadFile(icsContent, filename, 'text/calendar');
};

/**
 * Export team calendar as CSV file
 */
export const exportCalendarAsCSV = (leaveData: BackendLeaveData[], teamName: string = 'Team'): void => {
  const csvContent = generateCSV(leaveData);
  const filename = `${teamName.replace(/\s+/g, '_')}_Leave_Schedule_${new Date().toISOString().split('T')[0]}.csv`;
  downloadFile(csvContent, filename, 'text/csv');
};