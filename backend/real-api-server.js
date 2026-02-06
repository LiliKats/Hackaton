const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3002', 'http://localhost:3003'],
  credentials: true
}));
app.use(express.json());

// Database connection
const dbPath = path.join(__dirname, 'database.sqlite');
console.log('Connecting to database at:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('✅ Connected to SQLite database');
  }
});

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'LeaveBoard API',
    database: 'Connected to SQLite with real data'
  });
});

// Profile picture mapping for users
const profilePictureMap = {
  // Admin and management
  'Admin User': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face&auto=format',
  'Manager Johnson': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face&auto=format',

  // Employees
  'John Doe': 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face&auto=format',
  'Jane Smith': 'https://images.unsplash.com/photo-1494790108755-2616b9c68a3b?w=150&h=150&fit=crop&crop=face&auto=format',
  'Mike Johnson': 'https://images.unsplash.com/photo-1519244703995-f4e0f30006d5?w=150&h=150&fit=crop&crop=face&auto=format',
  'Sarah Wilson': 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face&auto=format',

  // Additional backup employees
  'Emily Davis': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face&auto=format',
  'David Brown': 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=face&auto=format',
  'Lisa Anderson': 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=150&h=150&fit=crop&crop=face&auto=format',
  'Robert Taylor': 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop&crop=face&auto=format'
};

// Generate fallback avatar URL
function generateFallbackAvatar(name) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
  const colors = ['4F46E5', '7C3AED', 'DB2777', 'DC2626', 'EA580C', '059669', '0891B2'];
  const colorIndex = name.length % colors.length;
  const bgColor = colors[colorIndex];
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${bgColor}&color=fff&size=64&font-size=0.5&rounded=true&format=svg`;
}

// Get profile picture URL for a user
function getProfilePictureUrl(firstName, lastName) {
  const fullName = `${firstName} ${lastName}`;
  return profilePictureMap[fullName] || generateFallbackAvatar(fullName);
}

// Get all users
app.get('/api/users', (req, res) => {
  db.all(`SELECT id, email, firstName, lastName, role, position, department,
          annualLeaveDays, usedLeaveDays, isActive FROM users`, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: err.message });
    } else {
      // Add profile pictures to user data
      const usersWithProfilePictures = rows.map(user => ({
        ...user,
        profilePictureUrl: getProfilePictureUrl(user.firstName, user.lastName),
        hasProfilePicture: !!profilePictureMap[`${user.firstName} ${user.lastName}`]
      }));

      console.log(`📊 Returning ${rows.length} users from database with profile pictures`);
      res.json(usersWithProfilePictures);
    }
  });
});

// Get all leave requests (route must come before /:id route to avoid conflict)
app.get('/api/leave-requests/all', (req, res) => {
  const { status } = req.query;
  let query = `SELECT lr.*, u.firstName, u.lastName, u.email, u.department
               FROM leave_requests lr
               JOIN users u ON lr.userId = u.id`;
  let params = [];

  if (status) {
    query += ` WHERE lr.status = ?`;
    params.push(status);
  }

  query += ` ORDER BY lr.createdAt DESC`;

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: err.message });
    } else {
      const statusFilter = status ? ` (status: ${status})` : '';
      console.log(`📅 Returning ${rows.length} leave requests${statusFilter} from database`);
      res.json(rows);
    }
  });
});

// Get all leave requests
app.get('/api/leave-requests', (req, res) => {
  db.all(`SELECT lr.*, u.firstName, u.lastName, u.email, u.department
          FROM leave_requests lr
          JOIN users u ON lr.userId = u.id
          ORDER BY lr.createdAt DESC`, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: err.message });
    } else {
      console.log(`📊 Returning ${rows.length} leave requests from database`);
      res.json(rows);
    }
  });
});

// Get pending approvals (what a manager would see)
app.get('/api/workflows/my-pending-approvals', (req, res) => {
  db.all(`
    SELECT
      ast.id as stepId,
      wi.id as workflowInstanceId,
      u.firstName || ' ' || u.lastName as requestorName,
      u.email as requestorEmail,
      lr.type as leaveType,
      lr.startDate,
      lr.endDate,
      lr.totalDays,
      lr.reason,
      lr.createdAt as submittedAt,
      ast.stepName as currentStep,
      lr.status
    FROM approval_steps ast
    JOIN workflow_instances wi ON ast.workflowInstanceId = wi.id
    JOIN leave_requests lr ON wi.entityId = lr.id
    JOIN users u ON lr.userId = u.id
    WHERE ast.status = 'pending'
    ORDER BY lr.createdAt DESC
  `, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: err.message });
    } else {
      console.log(`📊 Returning ${rows.length} pending approvals from database`);
      res.json(rows);
    }
  });
});

// Login endpoint - check real users from database
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  db.get('SELECT * FROM users WHERE email = ? AND isActive = 1', [email], (err, user) => {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: err.message });
    } else if (user) {
      console.log(`🔐 User login: ${user.email} (${user.role})`);
      // In a real app, you'd verify the password here
      res.json({
        access_token: 'mock-jwt-token-' + Date.now(),
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          position: user.position,
          department: user.department,
          hireDate: user.hireDate,
          annualLeaveDays: user.annualLeaveDays,
          usedLeaveDays: user.usedLeaveDays,
          isActive: user.isActive
        }
      });
    } else {
      res.status(401).json({ error: 'Invalid credentials or user not found' });
    }
  });
});

// Get user leave requests (frontend expects this route)
app.get('/api/leave-requests/user/:userId', (req, res) => {
  const { userId } = req.params;

  db.all(`SELECT * FROM leave_requests WHERE userId = ? ORDER BY createdAt DESC`, [userId], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: err.message });
    } else {
      console.log(`📊 Returning ${rows.length} requests for user ${userId}`);
      res.json(rows);
    }
  });
});

// Alternative route (backend pattern)
app.get('/api/users/:userId/leave-requests', (req, res) => {
  const { userId } = req.params;

  db.all(`SELECT * FROM leave_requests WHERE userId = ? ORDER BY createdAt DESC`, [userId], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: err.message });
    } else {
      console.log(`📊 Returning ${rows.length} requests for user ${userId}`);
      res.json(rows);
    }
  });
});

// Get single leave request by ID
app.get('/api/leave-requests/:id', (req, res) => {
  const { id } = req.params;

  db.get(`SELECT lr.*, u.firstName, u.lastName, u.email, u.department
          FROM leave_requests lr
          JOIN users u ON lr.userId = u.id
          WHERE lr.id = ?`, [id], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: err.message });
    } else if (row) {
      console.log(`📊 Returning leave request ${id}`);
      res.json(row);
    } else {
      res.status(404).json({ error: 'Leave request not found' });
    }
  });
});

// Approve leave request
app.patch('/api/leave-requests/:id/approve', (req, res) => {
  const { id } = req.params;
  const { approverId } = req.body;

  db.run(`UPDATE leave_requests SET status = 'approved', managerNotes = ?
          WHERE id = ?`, [`Approved by ${approverId}`, id], function(err) {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: err.message });
    } else if (this.changes > 0) {
      console.log(`✅ Approved leave request ${id}`);

      // Also update approval step
      db.run(`UPDATE approval_steps SET status = 'completed', completedAt = datetime('now')
              WHERE workflowInstanceId IN (
                SELECT id FROM workflow_instances WHERE entityId = ?
              )`, [id]);

      // Return updated leave request
      db.get(`SELECT lr.*, u.firstName, u.lastName FROM leave_requests lr
              JOIN users u ON lr.userId = u.id WHERE lr.id = ?`, [id], (err, row) => {
        res.json(row);
      });
    } else {
      res.status(404).json({ error: 'Leave request not found' });
    }
  });
});

// Reject leave request
app.patch('/api/leave-requests/:id/reject', (req, res) => {
  const { id } = req.params;
  const { approverId, reason } = req.body;

  db.run(`UPDATE leave_requests SET status = 'rejected', managerNotes = ?
          WHERE id = ?`, [`Rejected by ${approverId}: ${reason}`, id], function(err) {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: err.message });
    } else if (this.changes > 0) {
      console.log(`❌ Rejected leave request ${id}`);

      // Also update approval step
      db.run(`UPDATE approval_steps SET status = 'rejected', completedAt = datetime('now')
              WHERE workflowInstanceId IN (
                SELECT id FROM workflow_instances WHERE entityId = ?
              )`, [id]);

      // Return updated leave request
      db.get(`SELECT lr.*, u.firstName, u.lastName FROM leave_requests lr
              JOIN users u ON lr.userId = u.id WHERE lr.id = ?`, [id], (err, row) => {
        res.json(row);
      });
    } else {
      res.status(404).json({ error: 'Leave request not found' });
    }
  });
});

// Cancel leave request
app.patch('/api/leave-requests/:id/cancel', (req, res) => {
  const { id } = req.params;

  db.run(`UPDATE leave_requests SET status = 'cancelled'
          WHERE id = ?`, [id], function(err) {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: err.message });
    } else if (this.changes > 0) {
      console.log(`🚫 Cancelled leave request ${id}`);

      // Return updated leave request
      db.get(`SELECT lr.*, u.firstName, u.lastName FROM leave_requests lr
              JOIN users u ON lr.userId = u.id WHERE lr.id = ?`, [id], (err, row) => {
        res.json(row);
      });
    } else {
      res.status(404).json({ error: 'Leave request not found' });
    }
  });
});

// Create new leave request
app.post('/api/leave-requests', (req, res) => {
  const { userId, type, startDate, endDate, totalDays, reason } = req.body;
  const id = 'req-' + Date.now();

  db.run(`
    INSERT INTO leave_requests (id, userId, type, startDate, endDate, totalDays, reason, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
  `, [id, userId, type, startDate, endDate, totalDays, reason], function(err) {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: err.message });
    } else {
      console.log(`✅ Created new leave request: ${id}`);
      res.json({ id, message: 'Leave request created successfully' });
    }
  });
});

// Update leave request
app.put('/api/leave-requests/:id', (req, res) => {
  const { id } = req.params;
  const { type, startDate, endDate, totalDays, reason, priority = 'medium' } = req.body;

  // Only allow updating pending requests
  db.get(`SELECT status FROM leave_requests WHERE id = ?`, [id], (err, request) => {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: err.message });
      return;
    }

    if (!request) {
      res.status(404).json({ error: 'Leave request not found' });
      return;
    }

    if (request.status !== 'pending') {
      res.status(400).json({ error: 'Can only edit pending requests' });
      return;
    }

    // Update the request
    db.run(`
      UPDATE leave_requests
      SET type = ?, startDate = ?, endDate = ?, totalDays = ?, reason = ?, priority = ?, updatedAt = datetime('now')
      WHERE id = ?
    `, [type, startDate, endDate, totalDays, reason, priority, id], function(err) {
      if (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: err.message });
      } else if (this.changes > 0) {
        console.log(`✅ Updated leave request: ${id}`);

        // Return the updated request with user info
        db.get(`SELECT lr.*, u.firstName, u.lastName, u.email, u.department FROM leave_requests lr
                JOIN users u ON lr.userId = u.id WHERE lr.id = ?`, [id], (err, row) => {
          if (err) {
            res.status(500).json({ error: err.message });
          } else {
            res.json(row);
          }
        });
      } else {
        res.status(404).json({ error: 'Leave request not found' });
      }
    });
  });
});

// Process workflow approval decision
app.post('/api/workflows/steps/:stepId/approve', (req, res) => {
  const { stepId } = req.params;
  const { decision, comments } = req.body;

  if (decision === 'approve') {
    // Update approval step
    db.run(`UPDATE approval_steps SET status = 'completed', completedAt = datetime('now')
            WHERE id = ?`, [stepId], function(err) {
      if (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: err.message });
      } else {
        console.log(`✅ Processed approval for step ${stepId}: ${decision}`);

        // Get workflow instance and update leave request
        db.get(`SELECT wi.entityId FROM workflow_instances wi
                JOIN approval_steps ast ON wi.id = ast.workflowInstanceId
                WHERE ast.id = ?`, [stepId], (err, workflow) => {
          if (workflow) {
            const status = decision === 'approve' ? 'approved' : 'rejected';
            db.run(`UPDATE leave_requests SET status = ?, managerNotes = ?
                    WHERE id = ?`, [status, comments, workflow.entityId]);
          }
          res.json({ id: 'mock-workflow-instance', status: 'completed' });
        });
      }
    });
  } else {
    // Reject
    db.run(`UPDATE approval_steps SET status = 'rejected', completedAt = datetime('now')
            WHERE id = ?`, [stepId], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        console.log(`❌ Rejected approval for step ${stepId}`);

        // Update leave request
        db.get(`SELECT wi.entityId FROM workflow_instances wi
                JOIN approval_steps ast ON wi.id = ast.workflowInstanceId
                WHERE ast.id = ?`, [stepId], (err, workflow) => {
          if (workflow) {
            db.run(`UPDATE leave_requests SET status = 'rejected', managerNotes = ?
                    WHERE id = ?`, [comments, workflow.entityId]);
          }
          res.json({ id: 'mock-workflow-instance', status: 'rejected' });
        });
      }
    });
  }
});

// Get workflow instance details
app.get('/api/workflows/instances/:instanceId', (req, res) => {
  const { instanceId } = req.params;

  db.get(`SELECT wi.*, lr.reason, lr.type, lr.startDate, lr.endDate
          FROM workflow_instances wi
          LEFT JOIN leave_requests lr ON wi.entityId = lr.id
          WHERE wi.id = ?`, [instanceId], (err, instance) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (instance) {
      // Get approval steps
      db.all(`SELECT * FROM approval_steps WHERE workflowInstanceId = ?
              ORDER BY stepOrder`, [instanceId], (err, steps) => {
        res.json({
          ...instance,
          steps: steps || [],
          context: instance.context ? JSON.parse(instance.context) : {}
        });
      });
    } else {
      res.status(404).json({ error: 'Workflow instance not found' });
    }
  });
});

// Get workflow step details
app.get('/api/workflows/steps/:stepId', (req, res) => {
  const { stepId } = req.params;

  db.get(`SELECT * FROM approval_steps WHERE id = ?`, [stepId], (err, step) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (step) {
      res.json(step);
    } else {
      res.status(404).json({ error: 'Workflow step not found' });
    }
  });
});

// Escalate workflow step (mock implementation)
app.post('/api/workflows/steps/:stepId/escalate', (req, res) => {
  const { stepId } = req.params;
  const { reason } = req.body;

  console.log(`🔺 Escalation request for step ${stepId}: ${reason}`);
  res.json({ id: 'mock-workflow-instance', status: 'escalated', message: 'Step escalated successfully' });
});

// Get parallel approval status (mock implementation)
app.get('/api/workflows/parallel-approvals/:stepId/status', (req, res) => {
  res.json({ status: 'pending', approvers: [], requiredApprovals: 1 });
});

// Get pending parallel approvals (mock implementation)
app.get('/api/workflows/my-parallel-approvals', (req, res) => {
  res.json([]);
});

// Get workflow analytics (mock implementation)
app.get('/api/workflows/analytics/performance', (req, res) => {
  res.json({
    averageApprovalTime: 24,
    totalRequests: 6,
    approvalRate: 0.75,
    escalationRate: 0.05
  });
});

// Cancel workflow instance
app.post('/api/workflows/instances/:instanceId/cancel', (req, res) => {
  const { instanceId } = req.params;
  const { reason } = req.body;

  db.run(`UPDATE workflow_instances SET status = 'cancelled'
          WHERE id = ?`, [instanceId], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      console.log(`🚫 Cancelled workflow instance ${instanceId}: ${reason}`);

      // Also cancel the associated leave request
      db.run(`UPDATE leave_requests SET status = 'cancelled'
              WHERE id = (SELECT entityId FROM workflow_instances WHERE id = ?)`, [instanceId]);

      res.json({ id: instanceId, status: 'cancelled' });
    }
  });
});

// Database stats endpoint
app.get('/api/stats', (req, res) => {
  const stats = {};

  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    stats.tables = tables.map(t => t.name);

    // Get counts for each table
    const promises = tables.map(table => {
      return new Promise((resolve) => {
        db.get(`SELECT COUNT(*) as count FROM ${table.name}`, (err, result) => {
          resolve({ table: table.name, count: err ? 0 : result.count });
        });
      });
    });

    Promise.all(promises).then(counts => {
      stats.counts = counts;
      res.json(stats);
    });
  });
});

// API documentation
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'LeaveBoard API - Real Database',
    version: '1.0.0',
    database: 'SQLite with real dummy data',
    endpoints: {
      'GET /api/health': 'Health check with database status',
      'POST /api/auth/login': 'User authentication with real users',
      'GET /api/users': 'Get all users from database',
      'GET /api/leave-requests': 'Get all leave requests from database',
      'GET /api/leave-requests/all': 'Get all leave requests for calendar',
      'GET /api/leave-requests/user/:userId': 'Get user leave requests (frontend route)',
      'GET /api/leave-requests/:id': 'Get single leave request by ID',
      'POST /api/leave-requests': 'Create new leave request',
      'PUT /api/leave-requests/:id': 'Update leave request (pending only)',
      'PATCH /api/leave-requests/:id/approve': 'Approve leave request',
      'PATCH /api/leave-requests/:id/reject': 'Reject leave request',
      'PATCH /api/leave-requests/:id/cancel': 'Cancel leave request',
      'GET /api/workflows/my-pending-approvals': 'Get pending approvals from database',
      'POST /api/workflows/steps/:stepId/approve': 'Process workflow approval',
      'GET /api/workflows/instances/:instanceId': 'Get workflow instance details',
      'GET /api/workflows/steps/:stepId': 'Get workflow step details',
      'POST /api/workflows/steps/:stepId/escalate': 'Escalate workflow step',
      'POST /api/workflows/instances/:instanceId/cancel': 'Cancel workflow instance',
      'GET /api/workflows/analytics/performance': 'Get workflow analytics',
      'GET /api/stats': 'Database statistics'
    },
    sampleUsers: [
      'admin@dev.local (admin)',
      'manager@company.com (manager)',
      'john.doe@company.com (employee)',
      'jane.smith@company.com (employee)'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 LeaveBoard API server running on http://localhost:${PORT}`);
  console.log(`📚 API documentation: http://localhost:${PORT}/api/docs`);
  console.log(`❤️  Health check: http://localhost:${PORT}/api/health`);
  console.log(`📊 Database stats: http://localhost:${PORT}/api/stats`);
  console.log(`💾 Database: Real SQLite data at ${dbPath}`);
  console.log('');
  console.log('🎯 Test users:');
  console.log('   - admin@dev.local (admin)');
  console.log('   - manager@company.com (manager)');
  console.log('   - john.doe@company.com (employee)');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  db.close((err) => {
    if (err) {
      console.error(err.message);
    } else {
      console.log('Database connection closed.');
    }
    process.exit(0);
  });
});