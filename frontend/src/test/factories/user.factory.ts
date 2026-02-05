import { faker } from '@faker-js/faker';

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'manager' | 'employee';
  departmentId?: number;
  managerId?: number;
}

/**
 * Generate fake user data for testing
 */
export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: faker.number.int({ min: 1, max: 1000 }),
    email: faker.internet.email(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    role: faker.helpers.arrayElement(['admin', 'manager', 'employee']),
    ...overrides,
  };
}

/**
 * Generate multiple users
 */
export function createMockUsers(count: number, overrides: Partial<User> = {}): User[] {
  return Array.from({ length: count }, () => createMockUser(overrides));
}

/**
 * Generate admin user
 */
export function createMockAdmin(overrides: Partial<User> = {}): User {
  return createMockUser({ role: 'admin', ...overrides });
}

/**
 * Generate manager user
 */
export function createMockManager(overrides: Partial<User> = {}): User {
  return createMockUser({ role: 'manager', ...overrides });
}

/**
 * Generate employee user
 */
export function createMockEmployee(overrides: Partial<User> = {}): User {
  return createMockUser({ role: 'employee', ...overrides });
}
