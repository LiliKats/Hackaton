const http = require('http');
const url = require('url');

const server = http.createServer((req, res) => {
  // Log all requests
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Origin:', req.headers.origin);

  // Set CORS headers - allow all origins for testing
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'false');
  res.setHeader('Content-Type', 'application/json');

  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Health endpoint
  if (pathname === '/api/health' && req.method === 'GET') {
    const response = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'Simple LeaveBoard API'
    };
    res.writeHead(200);
    res.end(JSON.stringify(response));
    return;
  }

  // Leave requests endpoint
  if (pathname === '/api/leave-requests/all' && req.method === 'GET') {
    const leaveRequests = [
      {
        id: 'req-001',
        userId: 'user-001',
        type: 'annual',
        startDate: '2026-05-15T00:00:00.000Z',
        endDate: '2026-05-22T00:00:00.000Z',
        totalDays: 8,
        reason: 'Family vacation',
        status: 'pending',
        createdAt: '2026-02-01T10:00:00.000Z'
      }
    ];
    res.writeHead(200);
    res.end(JSON.stringify(leaveRequests));
    return;
  }

  // Pending approvals endpoint
  if (pathname === '/api/workflows/my-pending-approvals' && req.method === 'GET') {
    const approvals = [
      {
        stepId: 'mock-step-1',
        workflowInstanceId: 'mock-workflow-1',
        requestorName: 'John Doe',
        requestorEmail: 'john.doe@company.com',
        leaveType: 'annual',
        startDate: '2026-05-15T00:00:00.000Z',
        endDate: '2026-05-22T00:00:00.000Z',
        totalDays: 8,
        reason: 'Family vacation to Italy',
        submittedAt: '2026-02-01T10:00:00.000Z',
        priority: 'high',
        currentStep: 'Manager Approval',
        metadata: { stepOrder: 1, stepType: 'SINGLE_APPROVER' }
      },
      {
        stepId: 'mock-step-2',
        workflowInstanceId: 'mock-workflow-2',
        requestorName: 'Jane Smith',
        requestorEmail: 'jane.smith@company.com',
        leaveType: 'sick',
        startDate: '2026-03-12T00:00:00.000Z',
        endDate: '2026-03-12T00:00:00.000Z',
        totalDays: 1,
        reason: 'Medical appointment - routine checkup',
        submittedAt: '2026-03-10T14:30:00.000Z',
        priority: 'urgent',
        currentStep: 'Manager Approval',
        metadata: { stepOrder: 1, stepType: 'SINGLE_APPROVER' }
      }
    ];

    res.writeHead(200);
    res.end(JSON.stringify(approvals));
    return;
  }

  // Approval processing endpoint
  if (pathname.match(/^\/api\/workflows\/steps\/(.+)\/approve$/) && req.method === 'POST') {
    const stepId = pathname.match(/^\/api\/workflows\/steps\/(.+)\/approve$/)[1];

    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const response = {
          success: true,
          message: `Request ${data.decision}d successfully`,
          stepId: stepId,
          decision: data.decision,
          comments: data.comments
        };
        res.writeHead(200);
        res.end(JSON.stringify(response));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // 404 for unknown routes
  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not Found' }));
});

const PORT = 3002;
server.listen(PORT, () => {
  console.log(`✅ Simple API Server running on http://localhost:${PORT}`);
  console.log(`🌐 CORS enabled for http://localhost:3007`);
  console.log(`📝 Test with: http://localhost:3002/api/health`);
});