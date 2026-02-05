// E2E test setup
import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Extended timeout for E2E tests
jest.setTimeout(60000);

// Clean up after all tests
afterAll(async () => {
  // Allow async operations to complete
  await new Promise((resolve) => setTimeout(resolve, 1000));
});
