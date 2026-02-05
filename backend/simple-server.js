const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Mock data - this serves as our initial backend data as requested (updated for 2026)
const mockPendingApprovals = [
  {
    stepId: 'step-001',
    workflowInstanceId: 'wf-001',
    requestorName: 'John Doe',
    requestorEmail: 'john.doe@company.com',
    leaveType: 'ANNUAL',
    startDate: '2026-05-15T00:00:00.000Z',
    endDate: '2026-05-22T00:00:00.000Z',
    totalDays: 8,
    reason: 'Family vacation to Italy. Planning this trip for months.',
    submittedAt: '2026-04-10T10:30:00.000Z',
    priority: 'high',
    currentStep: 'Manager Approval',
  },
  {
    stepId: 'step-002',
    workflowInstanceId: 'wf-002',
    requestorName: 'Jane Smith',
    requestorEmail: 'jane.smith@company.com',
    leaveType: 'SICK',
    startDate: '2026-03-12T00:00:00.000Z',
    endDate: '2026-03-12T00:00:00.000Z',
    totalDays: 1,
    reason: 'Medical appointment - routine checkup',
    submittedAt: '2026-03-11T14:15:00.000Z',
    priority: 'urgent',
    currentStep: 'Manager Approval',
  },
  {
    stepId: 'step-003',
    workflowInstanceId: 'wf-003',
    requestorName: 'Mike Johnson',
    requestorEmail: 'mike.johnson@company.com',
    leaveType: 'PERSONAL',
    startDate: '2026-04-14T00:00:00.000Z',
    endDate: '2026-04-16T00:00:00.000Z',
    totalDays: 3,
    reason: 'Personal matters requiring immediate attention',
    submittedAt: '2026-03-25T09:00:00.000Z',
    priority: 'medium',
    currentStep: 'Manager Approval',
  },
  {
    stepId: 'step-004',
    workflowInstanceId: 'wf-004',
    requestorName: 'Sarah Wilson',
    requestorEmail: 'sarah.wilson@company.com',
    leaveType: 'UNPAID',
    startDate: '2026-07-01T00:00:00.000Z',
    endDate: '2026-07-31T00:00:00.000Z',
    totalDays: 31,
    reason: 'Extended unpaid leave for personal sabbatical and travel',
    submittedAt: '2026-02-15T16:45:00.000Z',
    priority: 'low',
    currentStep: 'HR Approval',
  },
  {
    stepId: 'step-005',
    workflowInstanceId: 'wf-005',
    requestorName: 'Alex Chen',
    requestorEmail: 'alex.chen@company.com',
    leaveType: 'ANNUAL',
    startDate: '2026-08-05T00:00:00.000Z',
    endDate: '2026-08-09T00:00:00.000Z',
    totalDays: 5,
    reason: 'Summer vacation with family',
    submittedAt: '2026-07-01T11:20:00.000Z',
    priority: 'medium',
    currentStep: 'Manager Approval',
  },
];

// In-memory storage for persistent state
let pendingApprovals = [...mockPendingApprovals];
let processedApprovals = [];

// API Routes

// Get pending approvals (the main endpoint the frontend uses)
app.get('/api/workflows/my-pending-approvals', (req, res) => {
  console.log('📋 Fetching pending approvals...');
  res.json(pendingApprovals);
});

// Process approval decision
app.post('/api/workflows/steps/:stepId/approve', (req, res) => {
  const { stepId } = req.params;
  const { decision, comments } = req.body;

  console.log(`⚡ Processing approval for step ${stepId}: ${decision}`);
  console.log(`💬 Comments: ${comments}`);

  // Find and remove the approval from pending list
  const approvalIndex = pendingApprovals.findIndex(approval => approval.stepId === stepId);

  if (approvalIndex === -1) {
    return res.status(404).json({ error: 'Approval step not found' });
  }

  const approval = pendingApprovals[approvalIndex];

  // Move to processed list with decision
  const processedApproval = {
    ...approval,
    decision,
    comments,
    processedAt: new Date().toISOString(),
    processedBy: 'admin@dev.local', // Our dev admin user
  };

  processedApprovals.push(processedApproval);
  pendingApprovals.splice(approvalIndex, 1);

  console.log(`✅ Successfully processed approval. Remaining pending: ${pendingApprovals.length}`);

  res.json({
    success: true,
    message: `Request ${decision === 'approve' ? 'approved' : 'rejected'} successfully`,
    stepId,
    decision,
    comments,
    processedAt: processedApproval.processedAt,
    workflowInstance: {
      id: approval.workflowInstanceId,
      status: 'completed',
      completedAt: processedApproval.processedAt,
    }
  });
});

// Get workflow instance status
app.get('/api/workflows/instances/:instanceId', (req, res) => {
  const { instanceId } = req.params;

  // Check if it's processed
  const processed = processedApprovals.find(approval => approval.workflowInstanceId === instanceId);
  if (processed) {
    return res.json({
      id: instanceId,
      status: 'completed',
      completedAt: processed.processedAt,
      decision: processed.decision,
    });
  }

  // Otherwise it's still pending
  res.json({
    id: instanceId,
    status: 'active',
    message: 'Workflow is active and being processed',
  });
});

// Add some debug endpoints
app.get('/api/debug/processed', (req, res) => {
  res.json({
    processed: processedApprovals,
    pending: pendingApprovals,
    stats: {
      totalProcessed: processedApprovals.length,
      totalPending: pendingApprovals.length,
    }
  });
});

// Reset data endpoint for testing
app.post('/api/debug/reset', (req, res) => {
  pendingApprovals = [...mockPendingApprovals];
  processedApprovals = [];
  console.log('🔄 Reset all data to initial state');
  res.json({ message: 'Data reset successfully' });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    pendingCount: pendingApprovals.length,
    processedCount: processedApprovals.length,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 LeaveBoard Backend API running on http://localhost:${PORT}`);
  console.log(`📊 Initial state: ${pendingApprovals.length} pending approvals`);
  console.log('📋 Available endpoints:');
  console.log('  GET  /api/workflows/my-pending-approvals');
  console.log('  POST /api/workflows/steps/:stepId/approve');
  console.log('  GET  /api/workflows/instances/:instanceId');
  console.log('  GET  /api/debug/processed');
  console.log('  POST /api/debug/reset');
  console.log('  GET  /api/health');
});