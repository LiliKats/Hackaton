# LeaveBoard Frontend Testing Concept

**Document Version:** 1.0
**Date:** February 2026
**Author:** Development Team

## 📋 Table of Contents
1. [Testing Strategy](#testing-strategy)
2. [Testing Pyramid](#testing-pyramid)
3. [Testing Frameworks & Tools](#testing-frameworks--tools)
4. [Test Categories](#test-categories)
5. [Test Implementation Plan](#test-implementation-plan)
6. [Component Testing](#component-testing)
7. [User Flow Testing](#user-flow-testing)
8. [Accessibility Testing](#accessibility-testing)
9. [Performance Testing](#performance-testing)
10. [Visual Regression Testing](#visual-regression-testing)

---

## 1. Testing Strategy

### 1.1 Goals
- **User Experience Validation**: Ensure seamless user interactions
- **Component Reliability**: Test all UI components in isolation
- **Cross-browser Compatibility**: Support modern browsers
- **Accessibility Compliance**: WCAG 2.1 AA standards
- **Performance Assurance**: Fast loading and responsive UI
- **Regression Prevention**: Catch UI/UX breaking changes

### 1.2 Testing Philosophy
- **User-Centric Testing**: Test from user's perspective, not implementation details
- **Test Early and Often**: Shift-left testing with component development
- **Real User Scenarios**: Focus on actual user workflows
- **Visual Consistency**: Ensure design system compliance

---

## 2. Testing Pyramid

```
     /\
    /  \      E2E Tests (10%)
   /____\     - Complete user journeys
  /      \    - Cross-browser testing
 /________\   - Critical business flows

             Integration Tests (20%)
            - API integration
            - Component interactions
            - State management
            - Route navigation
_____________________________________
           Unit Tests (70%)
          - Component logic
          - Utility functions
          - Custom hooks
          - State reducers
```

---

## 3. Testing Frameworks & Tools

### 3.1 Core Testing Stack
```json
{
  // Primary Testing Framework
  "@testing-library/react": "^14.2.1",
  "@testing-library/jest-dom": "^6.4.2",
  "@testing-library/user-event": "^14.5.2",
  "vitest": "^1.2.2",
  "@vitest/ui": "^1.2.2",

  // Component Testing
  "@storybook/react": "^7.6.17",
  "@storybook/test": "^7.6.17",

  // E2E Testing
  "@playwright/test": "^1.41.2",
  "playwright": "^1.41.2",

  // Mocking & API
  "msw": "^2.2.0", // Mock Service Worker
  "@faker-js/faker": "^8.4.0",

  // Accessibility Testing
  "@axe-core/react": "^4.8.4",
  "jest-axe": "^8.0.0",

  // Visual Testing
  "@storybook/addon-visual-tests": "^7.6.17",
  "percy-storybook": "^5.0.0",

  // Performance Testing
  "@testing-library/jest-dom": "^6.4.2",
  "lighthouse": "^11.5.0"
}
```

### 3.2 Development Tools
- **Storybook**: Component documentation and testing
- **React DevTools**: Component debugging
- **Chrome DevTools**: Performance profiling
- **axe DevTools**: Accessibility testing
- **Percy**: Visual regression testing

---

## 4. Test Categories

### 4.1 Unit Tests (70% Coverage Target)

#### 4.1.1 Component Unit Tests
```typescript
// Example: VacationRequestForm.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VacationRequestForm } from '@/components/VacationRequestForm';
import { LeaveType } from '@/types';

describe('VacationRequestForm', () => {
  const mockProps = {
    onClose: jest.fn(),
    onSubmit: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Form Validation', () => {
    test('should display error for empty required fields', async () => {
      render(<VacationRequestForm {...mockProps} />);

      const submitButton = screen.getByRole('button', { name: /submit/i });
      await userEvent.click(submitButton);

      expect(screen.getByText('Start date is required')).toBeInTheDocument();
      expect(screen.getByText('End date is required')).toBeInTheDocument();
      expect(screen.getByText('Reason is required')).toBeInTheDocument();
    });

    test('should validate date range (end after start)', async () => {
      render(<VacationRequestForm {...mockProps} />);

      const startDate = screen.getByLabelText(/start date/i);
      const endDate = screen.getByLabelText(/end date/i);

      await userEvent.type(startDate, '2024-07-15');
      await userEvent.type(endDate, '2024-07-10'); // Earlier than start

      const submitButton = screen.getByRole('button', { name: /submit/i });
      await userEvent.click(submitButton);

      expect(screen.getByText('End date must be after start date')).toBeInTheDocument();
    });

    test('should prevent past dates for start date', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      render(<VacationRequestForm {...mockProps} />);

      const startDate = screen.getByLabelText(/start date/i);
      await userEvent.type(startDate, yesterday.toISOString().split('T')[0]);

      const submitButton = screen.getByRole('button', { name: /submit/i });
      await userEvent.click(submitButton);

      expect(screen.getByText('Start date cannot be in the past')).toBeInTheDocument();
    });
  });

  describe('Form Interaction', () => {
    test('should allow selecting different leave types', async () => {
      render(<VacationRequestForm {...mockProps} />);

      const leaveTypeSelect = screen.getByLabelText(/leave type/i);
      await userEvent.selectOptions(leaveTypeSelect, LeaveType.SICK);

      expect(leaveTypeSelect).toHaveValue(LeaveType.SICK);
    });

    test('should call onSubmit with correct data on valid submission', async () => {
      render(<VacationRequestForm {...mockProps} />);

      // Fill form with valid data
      await userEvent.type(screen.getByLabelText(/start date/i), '2024-07-15');
      await userEvent.type(screen.getByLabelText(/end date/i), '2024-07-19');
      await userEvent.type(screen.getByLabelText(/reason/i), 'Summer vacation');
      await userEvent.selectOptions(screen.getByLabelText(/leave type/i), LeaveType.ANNUAL);

      const submitButton = screen.getByRole('button', { name: /submit/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockProps.onSubmit).toHaveBeenCalledWith({
          type: LeaveType.ANNUAL,
          startDate: '2024-07-15',
          endDate: '2024-07-19',
          reason: 'Summer vacation',
          action: 'request',
        });
      });
    });

    test('should call onClose when cancel button is clicked', async () => {
      render(<VacationRequestForm {...mockProps} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await userEvent.click(cancelButton);

      expect(mockProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Draft vs Submit Actions', () => {
    test('should save as draft when plan action is selected', async () => {
      render(<VacationRequestForm {...mockProps} />);

      // Fill form
      await userEvent.type(screen.getByLabelText(/start date/i), '2024-07-15');
      await userEvent.type(screen.getByLabelText(/end date/i), '2024-07-19');
      await userEvent.type(screen.getByLabelText(/reason/i), 'Planning ahead');

      // Select plan action
      const planRadio = screen.getByLabelText(/save as draft/i);
      await userEvent.click(planRadio);

      const submitButton = screen.getByRole('button', { name: /save draft/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockProps.onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ action: 'plan' })
        );
      });
    });
  });
});
```

#### 4.1.2 Custom Hook Tests
```typescript
// Example: useAuth.test.tsx
import { renderHook, act } from '@testing-library/react';
import { useAuth } from '@/hooks/useAuth';
import { AuthProvider } from '@/contexts/AuthContext';

describe('useAuth Hook', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  test('should initialize with no authenticated user', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  test('should handle successful login', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login('test@example.com', 'password');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(
      expect.objectContaining({
        email: 'test@example.com',
      })
    );
  });

  test('should handle logout', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Login first
    await act(async () => {
      await result.current.login('test@example.com', 'password');
    });

    // Then logout
    act(() => {
      result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });
});
```

#### 4.1.3 Utility Function Tests
```typescript
// Example: dateUtils.test.ts
import {
  calculateBusinessDays,
  formatDateRange,
  isWeekend,
  addBusinessDays,
} from '@/utils/dateUtils';

describe('Date Utilities', () => {
  describe('calculateBusinessDays', () => {
    test('should calculate business days correctly', () => {
      const start = new Date('2024-07-01'); // Monday
      const end = new Date('2024-07-05');   // Friday

      expect(calculateBusinessDays(start, end)).toBe(5);
    });

    test('should exclude weekends', () => {
      const start = new Date('2024-07-01'); // Monday
      const end = new Date('2024-07-07');   // Sunday

      expect(calculateBusinessDays(start, end)).toBe(5);
    });

    test('should handle single day', () => {
      const date = new Date('2024-07-01'); // Monday

      expect(calculateBusinessDays(date, date)).toBe(1);
    });

    test('should return 0 for weekend-only range', () => {
      const start = new Date('2024-07-06'); // Saturday
      const end = new Date('2024-07-07');   // Sunday

      expect(calculateBusinessDays(start, end)).toBe(0);
    });
  });

  describe('formatDateRange', () => {
    test('should format single day correctly', () => {
      const date = new Date('2024-07-01');
      expect(formatDateRange(date, date)).toBe('July 1, 2024');
    });

    test('should format date range correctly', () => {
      const start = new Date('2024-07-01');
      const end = new Date('2024-07-05');
      expect(formatDateRange(start, end)).toBe('July 1 - 5, 2024');
    });

    test('should format cross-month range correctly', () => {
      const start = new Date('2024-06-29');
      const end = new Date('2024-07-03');
      expect(formatDateRange(start, end)).toBe('June 29 - July 3, 2024');
    });
  });
});
```

### 4.2 Integration Tests (20% Coverage Target)

#### 4.2.1 API Integration Tests
```typescript
// Example: LeaveRequestsPage.integration.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { LeaveRequestsPage } from '@/pages/LeaveRequests';
import { AppProviders } from '@/providers/AppProviders';

// Mock API responses
const server = setupServer(
  rest.get('/api/leave-requests', (req, res, ctx) => {
    return res(
      ctx.json([
        {
          id: '1',
          type: 'ANNUAL',
          startDate: '2024-07-15',
          endDate: '2024-07-19',
          status: 'PENDING',
          reason: 'Summer vacation',
          totalDays: 5,
        },
      ])
    );
  }),

  rest.post('/api/leave-requests', (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        id: '2',
        ...req.body,
        status: 'PENDING',
      })
    );
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('LeaveRequests Integration', () => {
  const renderWithProviders = (component: React.ReactNode) => {
    return render(
      <AppProviders>
        {component}
      </AppProviders>
    );
  };

  test('should load and display leave requests from API', async () => {
    renderWithProviders(<LeaveRequestsPage />);

    await waitFor(() => {
      expect(screen.getByText('Summer vacation')).toBeInTheDocument();
    });

    expect(screen.getByText('PENDING')).toBeInTheDocument();
    expect(screen.getByText('July 15 - 19, 2024')).toBeInTheDocument();
  });

  test('should create new leave request via API', async () => {
    renderWithProviders(<LeaveRequestsPage />);

    // Open form
    const newRequestButton = screen.getByRole('button', { name: /new request/i });
    await userEvent.click(newRequestButton);

    // Fill and submit form
    await userEvent.type(screen.getByLabelText(/start date/i), '2024-08-01');
    await userEvent.type(screen.getByLabelText(/end date/i), '2024-08-05');
    await userEvent.type(screen.getByLabelText(/reason/i), 'Beach vacation');

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    // Verify API call and UI update
    await waitFor(() => {
      expect(screen.getByText('Beach vacation')).toBeInTheDocument();
    });
  });

  test('should handle API errors gracefully', async () => {
    server.use(
      rest.post('/api/leave-requests', (req, res, ctx) => {
        return res(ctx.status(400), ctx.json({ message: 'Invalid request' }));
      })
    );

    renderWithProviders(<LeaveRequestsPage />);

    const newRequestButton = screen.getByRole('button', { name: /new request/i });
    await userEvent.click(newRequestButton);

    // Submit invalid form
    const submitButton = screen.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid request/i)).toBeInTheDocument();
    });
  });
});
```

#### 4.2.2 State Management Integration
```typescript
// Example: Auth State Integration Test
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { App } from '@/App';
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.post('/api/auth/login', (req, res, ctx) => {
    return res(
      ctx.json({
        access_token: 'jwt-token',
        user: {
          id: '1',
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'EMPLOYEE',
        },
      })
    );
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Authentication Flow Integration', () => {
  test('should redirect to dashboard after successful login', async () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    // Should start at login page
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();

    // Fill login form
    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password');

    const loginButton = screen.getByRole('button', { name: /sign in/i });
    await userEvent.click(loginButton);

    // Should redirect to dashboard
    await waitFor(() => {
      expect(screen.getByText(/welcome back, john/i)).toBeInTheDocument();
    });
  });
});
```

### 4.3 End-to-End Tests (10% Coverage Target)

#### 4.3.1 Critical User Journeys
```typescript
// Example: leave-request-flow.e2e.ts
import { test, expect } from '@playwright/test';

test.describe('Leave Request Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Login
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'employee@example.com');
    await page.fill('[data-testid="password"]', 'password');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('Employee can create and submit leave request', async ({ page }) => {
    // Navigate to leave requests
    await page.click('[data-testid="nav-leave-requests"]');
    await expect(page).toHaveURL('/leave-requests');

    // Create new request
    await page.click('[data-testid="new-request-button"]');
    await expect(page.locator('[data-testid="request-form"]')).toBeVisible();

    // Fill form
    await page.selectOption('[data-testid="leave-type"]', 'ANNUAL');
    await page.fill('[data-testid="start-date"]', '2024-07-15');
    await page.fill('[data-testid="end-date"]', '2024-07-19');
    await page.fill('[data-testid="reason"]', 'Summer vacation with family');

    // Submit request
    await page.click('[data-testid="submit-request"]');

    // Verify success
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="request-status-PENDING"]')).toBeVisible();

    // Verify request appears in list
    await expect(page.locator('text=Summer vacation with family')).toBeVisible();
    await expect(page.locator('text=July 15 - 19, 2024')).toBeVisible();
  });

  test('Manager can approve leave requests', async ({ page }) => {
    // Login as manager
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'manager@example.com');
    await page.fill('[data-testid="password"]', 'password');
    await page.click('[data-testid="login-button"]');

    // Navigate to pending approvals
    await page.click('[data-testid="nav-approvals"]');

    // Find and approve request
    await page.click('[data-testid="request-approve-btn-1"]');
    await page.fill('[data-testid="approval-comments"]', 'Approved for summer vacation');
    await page.click('[data-testid="confirm-approval"]');

    // Verify approval
    await expect(page.locator('[data-testid="request-status-APPROVED"]')).toBeVisible();
  });

  test('Employee can view calendar with approved leave', async ({ page }) => {
    // Navigate to calendar
    await page.click('[data-testid="nav-calendar"]');
    await expect(page).toHaveURL('/calendar');

    // Verify approved leave appears on calendar
    await expect(page.locator('[data-testid="calendar-event"]')).toContainText('John Doe - Annual Leave');

    // Click on event for details
    await page.click('[data-testid="calendar-event"]');
    await expect(page.locator('[data-testid="event-details"]')).toBeVisible();
  });
});

test.describe('Error Scenarios', () => {
  test('should handle network errors gracefully', async ({ page }) => {
    // Intercept and fail API requests
    await page.route('/api/leave-requests', route => route.abort());

    await page.goto('/leave-requests');

    // Verify error message is shown
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Unable to load leave requests');

    // Verify retry mechanism works
    await page.unroute('/api/leave-requests');
    await page.click('[data-testid="retry-button"]');
    await expect(page.locator('[data-testid="request-list"]')).toBeVisible();
  });
});

test.describe('Cross-browser Compatibility', () => {
  ['chromium', 'firefox', 'webkit'].forEach(browserName => {
    test(`Leave request flow works in ${browserName}`, async ({ page, browserName: currentBrowser }) => {
      test.skip(currentBrowser !== browserName);

      // Run critical flow test
      await page.goto('/login');
      // ... rest of the test
    });
  });
});
```

---

## 5. Test Implementation Plan

### Phase 1: Foundation Setup (Week 1)
- [ ] Configure Vitest and Testing Library
- [ ] Setup Storybook for component development
- [ ] Configure MSW for API mocking
- [ ] Setup Playwright for E2E testing
- [ ] Create test utilities and helpers

### Phase 2: Component Testing (Week 2-3)
- [ ] Test VacationRequestForm component
- [ ] Test RequestStatusCard component
- [ ] Test DateRangePicker component
- [ ] Test Layout and Navigation components
- [ ] Test common UI components

### Phase 3: Page Integration Testing (Week 4-5)
- [ ] Test LeaveRequests page integration
- [ ] Test Dashboard page with API
- [ ] Test Login/Authentication flow
- [ ] Test Calendar page integration
- [ ] Test Profile and Teams pages

### Phase 4: E2E Critical Flows (Week 6-7)
- [ ] Employee leave request workflow
- [ ] Manager approval workflow
- [ ] Calendar viewing and interaction
- [ ] Error handling scenarios
- [ ] Cross-browser testing

### Phase 5: Accessibility & Performance (Week 8-9)
- [ ] WCAG compliance testing
- [ ] Screen reader compatibility
- [ ] Performance testing with Lighthouse
- [ ] Visual regression testing
- [ ] Mobile responsiveness testing

### Phase 6: Polish & Optimization (Week 10)
- [ ] Test coverage optimization
- [ ] Flaky test resolution
- [ ] Test documentation
- [ ] CI/CD integration
- [ ] Monitoring and reporting setup

---

## 6. Component Testing

### 6.1 Storybook Integration
```typescript
// Example: VacationRequestForm.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { VacationRequestForm } from './VacationRequestForm';
import { action } from '@storybook/addon-actions';

const meta: Meta<typeof VacationRequestForm> = {
  title: 'Components/VacationRequestForm',
  component: VacationRequestForm,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    onClose: { action: 'closed' },
    onSubmit: { action: 'submitted' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onClose: action('onClose'),
    onSubmit: action('onSubmit'),
  },
};

export const WithValidationErrors: Story = {
  args: {
    onClose: action('onClose'),
    onSubmit: action('onSubmit'),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const submitButton = canvas.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);
  },
};

export const FilledForm: Story = {
  args: {
    onClose: action('onClose'),
    onSubmit: action('onSubmit'),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText(/start date/i), '2024-07-15');
    await userEvent.type(canvas.getByLabelText(/end date/i), '2024-07-19');
    await userEvent.type(canvas.getByLabelText(/reason/i), 'Summer vacation');
  },
};
```

### 6.2 Visual Testing
```typescript
// Example: Component visual tests
import { test, expect } from '@storybook/test';

test('VacationRequestForm renders correctly', async ({ page }) => {
  await page.goto('/iframe.html?id=components-vacationrequestform--default');
  await expect(page.locator('[data-testid="request-form"]')).toHaveScreenshot('vacation-form-default.png');
});

test('VacationRequestForm shows validation errors', async ({ page }) => {
  await page.goto('/iframe.html?id=components-vacationrequestform--with-validation-errors');
  await expect(page.locator('[data-testid="request-form"]')).toHaveScreenshot('vacation-form-errors.png');
});
```

---

## 7. User Flow Testing

### 7.1 Authentication Flow
```typescript
// auth-flow.e2e.ts
test.describe('Authentication Flow', () => {
  test('Complete login flow', async ({ page }) => {
    await page.goto('/');

    // Should redirect to login
    await expect(page).toHaveURL('/login');

    // Login with valid credentials
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password');
    await page.click('[data-testid="login-button"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('Invalid login shows error', async ({ page }) => {
    await page.goto('/login');

    await page.fill('[data-testid="email"]', 'wrong@example.com');
    await page.fill('[data-testid="password"]', 'wrongpassword');
    await page.click('[data-testid="login-button"]');

    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
  });

  test('Logout flow', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password');
    await page.click('[data-testid="login-button"]');

    // Logout
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');

    // Should redirect to login
    await expect(page).toHaveURL('/login');
  });
});
```

### 7.2 Leave Request Workflow
```typescript
// leave-workflow.e2e.ts
test.describe('Leave Request Workflow', () => {
  test('Complete leave request submission', async ({ page, context }) => {
    // Employee login
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'employee@example.com');
    await page.fill('[data-testid="password"]', 'password');
    await page.click('[data-testid="login-button"]');

    // Create leave request
    await page.click('[data-testid="nav-leave-requests"]');
    await page.click('[data-testid="new-request-button"]');

    await page.selectOption('[data-testid="leave-type"]', 'ANNUAL');
    await page.fill('[data-testid="start-date"]', '2024-07-15');
    await page.fill('[data-testid="end-date"]', '2024-07-19');
    await page.fill('[data-testid="reason"]', 'Family vacation');

    await page.click('[data-testid="submit-request"]');
    await expect(page.locator('text=Request submitted')).toBeVisible();

    // Manager approval in new context
    const managerPage = await context.newPage();
    await managerPage.goto('/login');
    await managerPage.fill('[data-testid="email"]', 'manager@example.com');
    await managerPage.fill('[data-testid="password"]', 'password');
    await managerPage.click('[data-testid="login-button"]');

    await managerPage.click('[data-testid="nav-approvals"]');
    await managerPage.click('[data-testid="approve-request-1"]');
    await managerPage.fill('[data-testid="approval-comments"]', 'Approved');
    await managerPage.click('[data-testid="confirm-approval"]');

    // Verify status change
    await page.reload();
    await expect(page.locator('[data-testid="request-status"]')).toContainText('Approved');
  });
});
```

---

## 8. Accessibility Testing

### 8.1 Automated Accessibility Tests
```typescript
// accessibility.test.tsx
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { VacationRequestForm } from '@/components/VacationRequestForm';

expect.extend(toHaveNoViolations);

describe('Accessibility Tests', () => {
  test('VacationRequestForm has no accessibility violations', async () => {
    const { container } = render(<VacationRequestForm onClose={() => {}} onSubmit={() => {}} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('Form labels are properly associated', () => {
    render(<VacationRequestForm onClose={() => {}} onSubmit={() => {}} />);

    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/end date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/reason/i)).toBeInTheDocument();
  });

  test('Form has proper ARIA attributes', () => {
    render(<VacationRequestForm onClose={() => {}} onSubmit={() => {}} />);

    const form = screen.getByRole('form');
    expect(form).toHaveAttribute('aria-label', 'Leave request form');
  });
});
```

### 8.2 Screen Reader Testing
```typescript
// screen-reader.e2e.ts
test.describe('Screen Reader Compatibility', () => {
  test('Leave request form is navigable with keyboard only', async ({ page }) => {
    await page.goto('/leave-requests');
    await page.click('[data-testid="new-request-button"]');

    // Tab through form elements
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="leave-type"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="start-date"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="end-date"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="reason"]')).toBeFocused();
  });

  test('Error messages are announced to screen readers', async ({ page }) => {
    await page.goto('/leave-requests');
    await page.click('[data-testid="new-request-button"]');

    // Submit empty form
    await page.keyboard.press('Tab'); // Skip to submit button
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');

    // Verify ARIA live region is updated
    const errorRegion = page.locator('[aria-live="polite"]');
    await expect(errorRegion).toContainText('Start date is required');
  });
});
```

---

## 9. Performance Testing

### 9.1 Component Performance
```typescript
// performance.test.tsx
import { render, act } from '@testing-library/react';
import { performance } from 'perf_hooks';
import { LeaveRequestsPage } from '@/pages/LeaveRequests';

describe('Performance Tests', () => {
  test('LeaveRequestsPage renders within performance budget', async () => {
    const startTime = performance.now();

    await act(async () => {
      render(<LeaveRequestsPage />);
    });

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // Should render within 100ms
    expect(renderTime).toBeLessThan(100);
  });

  test('Large list rendering performance', async () => {
    const largeDataSet = Array.from({ length: 1000 }, (_, i) => ({
      id: i.toString(),
      type: 'ANNUAL',
      status: 'PENDING',
      startDate: '2024-07-15',
      endDate: '2024-07-19',
      reason: `Request ${i}`,
    }));

    const startTime = performance.now();

    await act(async () => {
      render(<LeaveRequestsPage initialData={largeDataSet} />);
    });

    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(500); // 500ms budget for large lists
  });
});
```

### 9.2 Lighthouse Testing
```typescript
// lighthouse.e2e.ts
import { test } from '@playwright/test';
import { playAudit } from 'playwright-lighthouse';

test('Performance audit for main pages', async ({ page }) => {
  await page.goto('/login');
  await playAudit({
    page,
    thresholds: {
      performance: 90,
      accessibility: 95,
      'best-practices': 90,
      seo: 80,
    },
    port: 9222,
  });

  // Test dashboard performance after login
  await page.fill('[data-testid="email"]', 'test@example.com');
  await page.fill('[data-testid="password"]', 'password');
  await page.click('[data-testid="login-button"]');

  await playAudit({
    page,
    thresholds: {
      performance: 85,
      accessibility: 95,
    },
    port: 9222,
  });
});
```

---

## 10. Visual Regression Testing

### 10.1 Percy Integration
```typescript
// visual-regression.test.ts
import { test } from '@playwright/test';
import percySnapshot from '@percy/playwright';

test.describe('Visual Regression Tests', () => {
  test('LeaveRequests page visual test', async ({ page }) => {
    await page.goto('/leave-requests');
    await page.waitForLoadState('networkidle');
    await percySnapshot(page, 'LeaveRequests Page');
  });

  test('VacationRequestForm modal visual test', async ({ page }) => {
    await page.goto('/leave-requests');
    await page.click('[data-testid="new-request-button"]');
    await page.waitForSelector('[data-testid="request-form"]');
    await percySnapshot(page, 'VacationRequestForm Modal');
  });

  test('Form validation errors visual test', async ({ page }) => {
    await page.goto('/leave-requests');
    await page.click('[data-testid="new-request-button"]');
    await page.click('[data-testid="submit-request"]'); // Trigger validation
    await percySnapshot(page, 'Form Validation Errors');
  });
});
```

### 10.2 Responsive Design Testing
```typescript
// responsive.e2e.ts
test.describe('Responsive Design Tests', () => {
  const viewports = [
    { name: 'Mobile', width: 375, height: 667 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1920, height: 1080 },
  ];

  viewports.forEach(viewport => {
    test(`${viewport.name} viewport test`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/leave-requests');

      // Test navigation responsiveness
      if (viewport.width < 768) {
        // Mobile: hamburger menu should be visible
        await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
      } else {
        // Desktop/Tablet: full navigation should be visible
        await expect(page.locator('[data-testid="desktop-nav"]')).toBeVisible();
      }

      await percySnapshot(page, `LeaveRequests ${viewport.name}`);
    });
  });
});
```

---

## 11. Test Environment Configuration

### 11.1 Vitest Configuration
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.ts',
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### 11.2 Test Setup
```typescript
// src/test/setup.ts
import '@testing-library/jest-dom/vitest';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
```

---

## 12. Continuous Integration

### 12.1 GitHub Actions Workflow
```yaml
# .github/workflows/frontend-tests.yml
name: Frontend Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18, 20]

    steps:
      - uses: actions/checkout@v4
      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci
        working-directory: ./frontend

      - name: Run unit tests
        run: npm run test:coverage
        working-directory: ./frontend

      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          file: ./frontend/coverage/lcov.info

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm ci
        working-directory: ./frontend

      - name: Install Playwright browsers
        run: npx playwright install --with-deps
        working-directory: ./frontend

      - name: Start backend for E2E tests
        run: |
          cd backend && npm ci && npm run start:test &
          sleep 30

      - name: Start frontend for E2E tests
        run: |
          cd frontend && npm run build && npm run preview &
          sleep 10

      - name: Run E2E tests
        run: npm run test:e2e
        working-directory: ./frontend

      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: frontend/playwright-report/
```

---

## 13. Test Metrics & Reporting

### 13.1 Coverage Targets
| Component Type | Target Coverage | Priority |
|---------------|----------------|----------|
| **Components** | ≥ 85% | High |
| **Pages** | ≥ 80% | High |
| **Hooks** | ≥ 90% | Medium |
| **Utils** | ≥ 95% | Medium |
| **Overall** | ≥ 80% | Critical |

### 13.2 Quality Metrics
- **Test Execution Time**: All tests complete within 3 minutes
- **E2E Test Stability**: <2% flaky test rate
- **Performance**: Page load times < 2 seconds
- **Accessibility**: WCAG 2.1 AA compliance
- **Browser Support**: Chrome, Firefox, Safari, Edge (last 2 versions)

### 13.3 Dashboard & Reporting
```typescript
// Custom test reporter
export class TestMetricsReporter {
  onTestComplete(test: Test, result: TestResult): void {
    const metrics = {
      name: test.name,
      duration: result.duration,
      status: result.status,
      coverage: result.coverage,
      performance: result.performance,
    };

    // Send to monitoring dashboard
    this.sendToMonitoring(metrics);
  }

  generateReport(): TestSummary {
    return {
      totalTests: this.stats.total,
      passedTests: this.stats.passed,
      failedTests: this.stats.failed,
      coverage: this.coverage.summary,
      performance: this.performance.summary,
      accessibility: this.accessibility.summary,
    };
  }
}
```

---

## 14. Best Practices & Guidelines

### 14.1 Test Writing Guidelines
1. **User-Centric Tests**: Test behavior, not implementation
2. **Clear Test Names**: Describe what is being tested and expected outcome
3. **Arrange-Act-Assert**: Structure tests clearly
4. **Test Isolation**: Each test should be independent
5. **Realistic Data**: Use realistic test data that represents actual use cases

### 14.2 Component Testing Best Practices
```typescript
// Good: Testing behavior
test('should show error when submitting empty form', async () => {
  render(<VacationRequestForm onSubmit={mockSubmit} />);

  await userEvent.click(screen.getByRole('button', { name: /submit/i }));

  expect(screen.getByText('Start date is required')).toBeInTheDocument();
  expect(mockSubmit).not.toHaveBeenCalled();
});

// Bad: Testing implementation details
test('should call useState when component mounts', () => {
  const useStateSpy = jest.spyOn(React, 'useState');
  render(<VacationRequestForm onSubmit={mockSubmit} />);
  expect(useStateSpy).toHaveBeenCalled();
});
```

### 14.3 Common Anti-patterns to Avoid
- ❌ Testing implementation details instead of user behavior
- ❌ Complex test setup that's hard to understand
- ❌ Tests that depend on each other
- ❌ Overly broad or overly specific selectors
- ❌ Not testing edge cases and error conditions
- ❌ Slow tests that block development workflow

---

## 15. Conclusion

This comprehensive frontend testing concept ensures the LeaveBoard application delivers a reliable, accessible, and performant user experience. The multi-layered testing approach covers everything from individual component logic to complete user workflows, providing confidence in the application's quality and maintainability.

**Implementation Success Criteria:**
- 80%+ test coverage achieved
- All critical user flows covered by E2E tests
- WCAG 2.1 AA accessibility compliance
- Performance benchmarks met across all devices
- Stable test suite with minimal flaky tests
- Comprehensive visual regression detection

**Next Steps:**
1. Review and approve this testing concept
2. Set up testing infrastructure and tooling
3. Begin implementation following the phased approach
4. Establish CI/CD pipeline integration
5. Monitor metrics and continuously improve test quality