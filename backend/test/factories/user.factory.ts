import { faker } from '@faker-js/faker';

export interface CreateUserData {
  email?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  role?: 'admin' | 'manager' | 'employee';
  departmentId?: number;
  managerId?: number;
}

/**
 * Generate fake user data for testing
 */
export function generateUserData(overrides: CreateUserData = {}): CreateUserData {
  return {
    email: faker.internet.email(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    password: faker.internet.password({ length: 12 }),
    role: faker.helpers.arrayElement(['admin', 'manager', 'employee']),
    ...overrides,
  };
}

/**
 * Generate multiple users
 */
export function generateUsers(count: number, overrides: CreateUserData = {}): CreateUserData[] {
  return Array.from({ length: count }, () => generateUserData(overrides));
}

/**
 * Generate admin user
 */
export function generateAdminUser(overrides: Partial<CreateUserData> = {}): CreateUserData {
  return generateUserData({ role: 'admin', ...overrides });
}

/**
 * Generate manager user
 */
export function generateManagerUser(overrides: Partial<CreateUserData> = {}): CreateUserData {
  return generateUserData({ role: 'manager', ...overrides });
}

/**
 * Generate employee user
 */
export function generateEmployeeUser(overrides: Partial<CreateUserData> = {}): CreateUserData {
  return generateUserData({ role: 'employee', ...overrides });
}
