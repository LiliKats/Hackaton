const express = require('express');
const cors = require('cors');
const app = express();

// Enable JSON parsing
app.use(express.json());

// Enable CORS with explicit configuration
app.use(cors({
  origin: 'http://localhost:3007',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept']
}));

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  next();
});

app.get('/api/health', (req, res) => {
  console.log('Health check requested');
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'LeaveBoard API'
  });
});

app.get('/api/workflows/my-pending-approvals', (req, res) => {
  console.log('Pending approvals requested');
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

app.post('/api/workflows/steps/:stepId/approve', (req, res) => {
  const { stepId } = req.params;
  const { decision, comments } = req.body;

  console.log(`Processing approval: ${stepId}, decision: ${decision}, comments: ${comments}`);

  res.json({
    success: true,
    message: `Request ${decision === 'approve' ? 'approved' : 'rejected'} successfully`,
    stepId,
    decision,
    comments,
    workflowInstance: {
      id: 'mock-workflow-' + stepId.split('-')[2],
      status: decision === 'approve' ? 'completed' : 'rejected'
    }
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`✅ LeaveBoard API Server running on http://localhost:${PORT}`);
  console.log(`🌐 CORS enabled for http://localhost:3007`);
  console.log(`📝 Ready to receive frontend requests`);
});