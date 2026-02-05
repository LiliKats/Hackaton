import { http, HttpResponse } from 'msw';

const API_URL = 'http://localhost:3000/api';

/**
 * MSW request handlers for mocking API responses
 */
export const handlers = [
  // Auth endpoints
  http.post(`${API_URL}/auth/login`, async ({ request }) => {
    const body = await request.json() as { email: string; password: string };

    if (body.email === 'test@example.com' && body.password === 'password123') {
      return HttpResponse.json({
        access_token: 'mock-jwt-token',
        user: {
          id: 1,
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'employee',
        },
      });
    }

    return HttpResponse.json(
      { message: 'Invalid credentials' },
      { status: 401 }
    );
  }),

  http.get(`${API_URL}/auth/me`, () => {
    return HttpResponse.json({
      id: 1,
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'employee',
    });
  }),

  // Leave requests endpoints
  http.get(`${API_URL}/leave-requests`, () => {
    return HttpResponse.json([
      {
        id: 1,
        userId: 1,
        leaveTypeId: 1,
        startDate: '2024-03-01',
        endDate: '2024-03-05',
        totalDays: 5,
        status: 'pending',
        reason: 'Vacation',
      },
      {
        id: 2,
        userId: 1,
        leaveTypeId: 2,
        startDate: '2024-04-10',
        endDate: '2024-04-12',
        totalDays: 3,
        status: 'approved',
        reason: 'Family event',
      },
    ]);
  }),

  http.post(`${API_URL}/leave-requests`, async () => {
    return HttpResponse.json(
      {
        id: 3,
        userId: 1,
        leaveTypeId: 1,
        startDate: '2024-05-01',
        endDate: '2024-05-05',
        totalDays: 5,
        status: 'pending',
        reason: 'Summer vacation',
      },
      { status: 201 }
    );
  }),

  http.get(`${API_URL}/leave-requests/:id`, ({ params }) => {
    const { id } = params;
    return HttpResponse.json({
      id: Number(id),
      userId: 1,
      leaveTypeId: 1,
      startDate: '2024-03-01',
      endDate: '2024-03-05',
      totalDays: 5,
      status: 'pending',
      reason: 'Vacation',
    });
  }),

  // Leave types endpoints
  http.get(`${API_URL}/leave-types`, () => {
    return HttpResponse.json([
      { id: 1, name: 'Annual Leave', color: '#3b82f6' },
      { id: 2, name: 'Sick Leave', color: '#ef4444' },
      { id: 3, name: 'Personal Leave', color: '#f59e0b' },
    ]);
  }),
];
