import { faker } from '@faker-js/faker';
import { addDays, startOfDay } from 'date-fns';

export interface LeaveRequest {
  id: number;
  userId: number;
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reason: string;
}

/**
 * Generate fake leave request data for testing
 */
export function createMockLeaveRequest(
  overrides: Partial<LeaveRequest> = {}
): LeaveRequest {
  const startDate = overrides.startDate
    ? new Date(overrides.startDate)
    : faker.date.future();
  const totalDays = overrides.totalDays || faker.number.int({ min: 1, max: 14 });
  const endDate = overrides.endDate
    ? new Date(overrides.endDate)
    : addDays(startDate, totalDays);

  return {
    id: faker.number.int({ min: 1, max: 1000 }),
    userId: faker.number.int({ min: 1, max: 100 }),
    leaveTypeId: faker.number.int({ min: 1, max: 5 }),
    startDate: startOfDay(startDate).toISOString(),
    endDate: startOfDay(endDate).toISOString(),
    totalDays,
    status: faker.helpers.arrayElement(['pending', 'approved', 'rejected', 'cancelled']),
    reason: faker.lorem.sentence(),
    ...overrides,
  };
}

/**
 * Generate multiple leave requests
 */
export function createMockLeaveRequests(
  count: number,
  overrides: Partial<LeaveRequest> = {}
): LeaveRequest[] {
  return Array.from({ length: count }, () => createMockLeaveRequest(overrides));
}

/**
 * Generate pending leave request
 */
export function createMockPendingLeaveRequest(
  overrides: Partial<LeaveRequest> = {}
): LeaveRequest {
  return createMockLeaveRequest({ status: 'pending', ...overrides });
}

/**
 * Generate approved leave request
 */
export function createMockApprovedLeaveRequest(
  overrides: Partial<LeaveRequest> = {}
): LeaveRequest {
  return createMockLeaveRequest({ status: 'approved', ...overrides });
}
