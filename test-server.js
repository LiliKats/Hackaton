const express = require('express');
const app = express();

// Enable CORS for frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3007');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'LeaveBoard API Test'
  });
});

app.get('/api/workflows/my-pending-approvals', (req, res) => {
  // Return array directly as expected by frontend service
  res.json([
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
      metadata: {
        stepOrder: 1,
        stepType: 'SINGLE_APPROVER',
        templateId: 'template-standard-approval'
      }
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
      metadata: {
        stepOrder: 1,
        stepType: 'SINGLE_APPROVER',
        templateId: 'template-standard-approval'
      }
    },
    {
      stepId: 'mock-step-3',
      workflowInstanceId: 'mock-workflow-3',
      requestorName: 'Mike Johnson',
      requestorEmail: 'mike.johnson@company.com',
      leaveType: 'personal',
      startDate: '2026-04-14T00:00:00.000Z',
      endDate: '2026-04-16T00:00:00.000Z',
      totalDays: 3,
      reason: 'Personal matters requiring immediate attention',
      submittedAt: '2026-04-12T09:15:00.000Z',
      priority: 'medium',
      currentStep: 'Manager Approval',
      metadata: {
        stepOrder: 1,
        stepType: 'SINGLE_APPROVER',
        templateId: 'template-standard-approval'
      }
    }
  ]);
});

app.listen(3002, () => {
  console.log('Test server running on http://localhost:3002');
});