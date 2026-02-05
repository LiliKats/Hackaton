import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * Setup MSW server for Node environment (Vitest tests)
 */
export const server = setupServer(...handlers);

/**
 * Start the mock server before all tests
 */
export function setupMockServer() {
  beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
}
