import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

/**
 * Setup MSW worker for browser environment (development/debugging)
 * This can be used to mock API calls during development
 */
export const worker = setupWorker(...handlers);
