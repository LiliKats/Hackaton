import { faker } from '@faker-js/faker';
import { addDays, startOfDay } from 'date-fns';

export interface CreateLeaveRequestData {
  userId?: number;
  leaveTypeId?: number;
  startDate?: Date;
  endDate?: Date;
  reason?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'cancelled';
  totalDays?: number;
}

/**
 * Generate fake leave request data for testing
 */
export function generateLeaveRequestData(
  overrides: CreateLeaveRequestData = {},
): CreateLeaveRequestData {
  const startDate = overrides.startDate || faker.date.future();
  const totalDays = overrides.totalDays || faker.number.int({ min: 1, max: 14 });
  const endDate = overrides.endDate || addDays(startDate, totalDays);

  return {
    userId: faker.number.int({ min: 1, max: 100 }),
    leaveTypeId: faker.number.int({ min: 1, max: 5 }),
    startDate: startOfDay(startDate),
    endDate: startOfDay(endDate),
    reason: faker.lorem.sentence(),
    status: faker.helpers.arrayElement(['pending', 'approved', 'rejected', 'cancelled']),
    totalDays,
    ...overrides,
  };
}

/**
 * Generate multiple leave requests
 */
export function generateLeaveRequests(
  count: number,
  overrides: CreateLeaveRequestData = {},
): CreateLeaveRequestData[] {
  return Array.from({ length: count }, () => generateLeaveRequestData(overrides));
}

/**
 * Generate pending leave request
 */
export function generatePendingLeaveRequest(
  overrides: Partial<CreateLeaveRequestData> = {},
): CreateLeaveRequestData {
  return generateLeaveRequestData({ status: 'pending', ...overrides });
}

/**
 * Generate approved leave request
 */
export function generateApprovedLeaveRequest(
  overrides: Partial<CreateLeaveRequestData> = {},
): CreateLeaveRequestData {
  return generateLeaveRequestData({ status: 'approved', ...overrides });
}

/**
 * Generate leave request for specific date range
 */
export function generateLeaveRequestForDateRange(
  startDate: Date,
  endDate: Date,
  overrides: Partial<CreateLeaveRequestData> = {},
): CreateLeaveRequestData {
  return generateLeaveRequestData({
    startDate,
    endDate,
    ...overrides,
  });
}
