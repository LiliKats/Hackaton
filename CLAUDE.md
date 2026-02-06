# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LeaveBoard is a comprehensive vacation and absence tracking system with enterprise-grade workflow management capabilities. The application consists of a **NestJS backend** with TypeORM and PostgreSQL, and a **React frontend** with TypeScript, designed for manager approval workflows, delegation management, and audit compliance.

## Development Commands

### Backend (Express.js + SQLite + NestJS)

**Current Active Backend (Express.js + SQLite)**:
```bash
# Development API Server
cd backend
node real-api-server.js       # Start Express.js development API server (port 3001)
# Server provides:
# - Real SQLite database integration
# - Full leave request CRUD operations
# - User authentication endpoints
# - Workflow management APIs
# - API documentation at http://localhost:3001/api/docs
# - Health check at http://localhost:3001/api/health
```

**Original NestJS Backend (TypeORM + PostgreSQL)**:
```bash
# Setup and Development
cd backend
npm install                    # Install dependencies
npm run start:dev             # Start development server with hot reload
npm run start:debug          # Start with debugging enabled

# Building and Production
npm run build                 # Build production bundle
npm run start:prod            # Start production server

# Testing
npm run test                  # Run unit tests
npm run test:watch            # Run tests in watch mode
npm run test:cov              # Run tests with coverage report
npm run test:e2e              # Run end-to-end tests

# Database Operations
npm run migration:generate    # Generate migration from entity changes
npm run migration:create      # Create empty migration
npm run migration:run         # Run pending migrations
npm run migration:revert      # Revert last migration
npm run seed:run              # Run database seeds

# Code Quality
npm run lint                  # Run ESLint with auto-fix
npm run format               # Format code with Prettier
```

### Frontend (React + TypeScript + Vite)

```bash
# Setup and Development
cd frontend
npm install                   # Install dependencies
npm run dev                   # Start Vite development server

# Building and Production
npm run build                 # Build production bundle
npm run preview              # Preview production build

# Code Quality
npm run lint                  # Run ESLint
npm run format              # Format code with Prettier
```

### Docker Development Environment

```bash
# Full stack development
docker-compose up -d          # Start PostgreSQL, Redis, and services
docker-compose down           # Stop all services
docker-compose logs [service] # View service logs

# Individual services
docker-compose up postgres redis  # Start only databases
```

## High-Level Architecture

### Backend Module Architecture

The backend follows a **modular NestJS architecture** with the following key modules:

- **Core Business Logic**:
  - `auth/` - JWT authentication, role-based access control
  - `users/` - User management, profiles, leave balances
  - `leave-requests/` - Core leave request CRUD and business logic
  - `teams/` - Team management and hierarchy

- **Enterprise Workflow System** (25+ services, 5 entities):
  - `workflows/` - Multi-level approval orchestration, templates, conditional routing
  - `delegations/` - Manager delegation, acting managers, authority transfer
  - `audit/` - Immutable audit trail, compliance reporting (SOX/GDPR/HIPAA)
  - `analytics/` - Manager dashboards, capacity forecasting, performance metrics
  - `automation/` - Auto-approval rules, escalation engine, smart routing

- **Supporting Services**:
  - `calendar/` - Calendar integration and availability

### Frontend Architecture

**React + TypeScript** application with:

- **Routing**: React Router DOM with protected routes
- **State Management**: Zustand for client state + React Query for server state
- **Styling**: TailwindCSS with component-based design
- **Forms**: React Hook Form + Zod validation
- **API**: Axios with JWT interceptors

**Key Frontend Structure**:
```
src/
├── components/          # Reusable UI components
│   ├── VacationRequestForm.tsx  # Main leave request form
│   ├── RequestStatusCard.tsx    # Request display cards
│   └── DateRangePicker.tsx     # Date selection component
├── pages/              # Route-level components
│   ├── Dashboard.tsx   # Main dashboard
│   ├── LeaveRequests.tsx # Request management
│   ├── Calendar.tsx    # Calendar view
│   └── Login.tsx       # Authentication
├── services/           # API service layers
├── contexts/           # React contexts (Auth, etc.)
└── types/              # TypeScript definitions
```

### Database Design

**Current Implementation: SQLite** with direct SQL queries:

- **Core Tables**: users, leave_requests, workflow_instances, approval_steps
- **Database File**: `/backend/database.sqlite`
- **Real Data**: Populated with 6+ users and sample leave requests
- **Sample Users**:
  - `admin@dev.local` (admin-001) - Admin access
  - `manager@company.com` (manager-001) - Manager role
  - `john.doe@company.com` (emp-001) - Employee
  - Additional employees: jane.smith, mike.johnson, sarah.wilson

**Original Design: PostgreSQL** with TypeORM:

- **Core Entities**: User, LeaveRequest, Team
- **Workflow Entities**: WorkflowTemplate, WorkflowInstance, ApprovalStep
- **Enterprise Features**: ManagerDelegation, ApprovalHistory
- **Relationships**: Proper foreign keys, indexes for performance
- **Constraints**: Database-level validation and referential integrity

### Authentication & Authorization

- **JWT-based authentication** with refresh token support
- **Role-based access control**: Employee, Manager, HR, Admin
- **Delegation system**: Temporary authority transfer with scope control
- **Guards**: NestJS guards for route protection and permission validation

## Current Implementation Status (February 2026)

### Active Development Setup

The project currently runs with a **dual architecture approach**:

1. **Active Development Stack**:
   - **Frontend**: React + TypeScript + Vite (port 3000)
   - **Backend**: Express.js + SQLite (`real-api-server.js`, port 3001)
   - **Database**: SQLite file with real dummy data
   - **Authentication**: Development admin user with JWT simulation

2. **Original Architecture** (available but not actively used):
   - **Backend**: NestJS + TypeORM + PostgreSQL
   - **Full enterprise features**: Workflow engine, delegation system, audit trails

### Recent Implementation Fixes (Branch: `fix/leave-requests-frontend-integration`)

**Frontend Integration Issues Resolved**:
1. ✅ **Form Submissions**: Fixed Dashboard and LeaveRequests to actually call backend APIs instead of showing alerts
2. ✅ **Data Fetching**: Replaced all hardcoded mock data with real API calls
3. ✅ **User Authentication**: Fixed user ID mismatch between cache (`dev-admin-001`) and database (`admin-001`)
4. ✅ **Leave Request Cancellation**: Implemented proper cancel functionality with backend integration
5. ✅ **Role-based Data Access**: Admins see all requests, employees see only their own
6. ✅ **Real-time Updates**: Added automatic data refresh after all mutations
7. ✅ **Error Handling**: Comprehensive error messages and loading states

**Backend API Implementation**:
- ✅ **Complete REST API**: 19+ endpoints fully implemented and tested
- ✅ **Database Integration**: Real SQLite database with 6+ users and sample data
- ✅ **CORS Configuration**: Proper frontend-backend communication
- ✅ **Audit Trail**: All operations logged with status tracking

**User Experience Improvements**:
- ✅ **Filter Options**: Toggle to show/hide cancelled requests
- ✅ **Loading States**: Spinners and disabled buttons during operations
- ✅ **Visual Indicators**: Status badges, warning messages, fix buttons
- ✅ **Confirmation Dialogs**: Proper UX for destructive operations

### Development Workflow

**Starting the Application**:
```bash
# Terminal 1: Start Backend API
cd backend && node real-api-server.js

# Terminal 2: Start Frontend
cd frontend && npm run dev

# Access Application
Frontend: http://localhost:3000
Backend API: http://localhost:3001
API Docs: http://localhost:3001/api/docs
```

**Test Credentials**:
- **Admin**: `admin@dev.local` / `admin` (sees all requests)
- **Manager**: `manager@company.com` / `admin` (management features)
- **Employee**: `john.doe@company.com` / `admin` (own requests only)

## Important Implementation Details

### Workflow System Architecture

The application implements a sophisticated **enterprise workflow engine**:

1. **Template-Based Workflows**: Configurable approval chains for different leave types
2. **Multi-Level Approvals**: Sequential (Manager → HR → CEO) and parallel approvals
3. **Conditional Routing**: Dynamic workflow paths based on business rules (50+ built-in rules)
4. **Auto-Approval Engine**: 5 built-in rules for routine request automation
5. **Delegation Management**: Time-bound authority transfer with conflict resolution

### Database Migration Strategy

- **TypeORM migrations** handle schema changes automatically
- **Backward compatibility** maintained for existing leave requests
- **Seeding system** for default workflow templates and test data
- Use `npm run migration:generate` after entity changes

### API Design Patterns

**Current Express.js API** (`real-api-server.js`):
- **RESTful endpoints** with consistent HTTP status codes
- **SQLite Integration**: Direct SQL queries with proper error handling
- **CORS Configuration**: Enabled for `http://localhost:3000` frontend
- **Real-time Logging**: All operations logged with emojis for visibility
- **Key Endpoints**:
  ```
  GET /api/health              # Health check
  POST /api/auth/login         # User authentication
  GET /api/leave-requests      # All requests (admin) or user-specific
  POST /api/leave-requests     # Create new request
  PATCH /api/leave-requests/:id/cancel  # Cancel request
  PATCH /api/leave-requests/:id/approve # Approve request
  PATCH /api/leave-requests/:id/reject  # Reject request
  GET /api/workflows/my-pending-approvals  # Manager approvals
  ```

**Original NestJS API Patterns**:
- **DTO validation** using class-validator with detailed error messages
- **OpenAPI/Swagger** documentation available at `/api/docs`
- **Pagination**: Standard offset/limit patterns with total counts
- **Error handling**: Global exception filters with structured error responses

### Frontend State Management

- **AuthContext**: Global authentication state with JWT handling
  - **User ID Fix**: Automatic detection and correction of cached user ID mismatches
  - **Development Admin**: Quick admin login with `admin@dev.local` / `admin`
  - **Real User Integration**: Uses actual user IDs from database (`admin-001`, etc.)
- **API Services**: Typed service layer with axios interceptors
  - **Real API Integration**: All components now use live backend data
  - **Environment Configuration**: `VITE_API_URL=http://localhost:3001`
  - **Error Handling**: Comprehensive error messages and retry mechanisms
- **Data Management**: Real-time data fetching and updates
  - **Role-based Access**: Admins see all requests, users see own requests
  - **Automatic Refresh**: Data updates after mutations (create, cancel, etc.)
  - **Filter Options**: Toggle visibility of cancelled requests

### Testing Strategy

The project includes comprehensive **testing documentation** in `/docs/testing/`:

- **Backend**: Jest + NestJS Testing + Supertest + TestContainers
- **Frontend**: Vitest + Testing Library + Playwright + Storybook
- **Coverage targets**: 80%+ overall, 90%+ for critical services
- **Testing pyramid**: 70% unit, 20% integration, 10% E2E

### Production Deployment

- **Docker Compose** configurations for different environments:
  - `docker-compose.yml` - Development
  - `docker-compose.prod.yml` - Production
  - `docker-compose.test.yml` - Testing
- **CI/CD Pipeline**: GitHub Actions with security scanning and automated testing
- **Environment Configuration**: Separate configs for development/staging/production
- **Health Checks**: Built-in health endpoints for monitoring

## Common Development Patterns

### Adding New Modules

1. Create module structure: `backend/src/modules/new-module/`
2. Implement: entity, service, controller, dto, module files
3. Add to `AppModule` imports
4. Generate and run migrations if database changes are needed
5. Add corresponding frontend service and components

### Database Changes

1. Modify entity files in `backend/src/modules/*/entities/`
2. Generate migration: `npm run migration:generate`
3. Review generated SQL in `backend/src/database/migrations/`
4. Run migration: `npm run migration:run`

### API Integration

**Current Implementation**:
- ✅ **Real Backend Integration**: All frontend components use live API data
- ✅ **Automatic Data Refresh**: Lists update after create/update/cancel operations
- ✅ **Role-based Endpoints**: Different data access based on user role
- ✅ **Error Boundary Handling**: Comprehensive error messages and fallbacks
- ✅ **Loading States**: UI feedback during all async operations

**API Service Pattern**:
```typescript
// Example: LeaveRequestsService usage
const requests = await leaveRequestsService.getAll(); // Admin gets all
const requests = await leaveRequestsService.getByUser(userId); // User gets own
await leaveRequestsService.create(requestData); // Submit new request
await leaveRequestsService.cancel(id); // Cancel with backend update
```

**Authentication Flow**:
- Frontend stores JWT token in localStorage
- Axios interceptors automatically add Authorization headers
- User data cached with automatic ID validation and correction
- Development admin bypass available with warning indicators

**Original Design**:
- Backend APIs follow REST conventions with proper HTTP methods
- Frontend services use typed interfaces matching backend DTOs
- Authentication handled automatically via axios interceptors
- Error handling standardized across all services

### Workflow Development

When working with the workflow system:
- Use `WorkflowEngineService` for orchestration
- Implement business rules in `ApprovalRulesService`
- Add audit entries via `AuditTrailService`
- Test with workflow-specific test utilities in `__tests__/` directories

## Troubleshooting Common Issues

### User Authentication Problems

**Issue**: Frontend shows `dev-admin-001` but database expects `admin-001`
```
Solution: Click "Fix User ID" button in Dashboard or "Fix Login" in Leave Requests
Root Cause: Cached localStorage with outdated user data
Prevention: Use refreshAdminLogin() method to clear cache and re-authenticate
```

**Issue**: "New Request" button not submitting to backend
```
Solution: Ensure frontend/.env has VITE_API_URL=http://localhost:3001
Verification: Check browser Network tab for POST requests to /api/leave-requests
Debug: Backend logs should show "✅ Created new leave request: req-xxxxx"
```

### Data Display Issues

**Issue**: Leave requests not showing after creation
```
Check 1: Verify user ID matches database (admin-001, emp-001, etc.)
Check 2: Confirm backend is using INNER JOIN (may filter out orphaned requests)
Check 3: Look for requests with status 'cancelled' - they may be filtered out
Solution: Use "Show cancelled requests" toggle to see all data
```

**Issue**: Cancel button doesn't work
```
Fixed In: Recent implementation now calls leaveRequestsService.cancel(id)
Behavior: Request status changes to 'cancelled', appears with gray badge
Note: Cancelled requests remain in database for audit purposes (not deleted)
```

## Key Configuration Files

**Current Active Configuration**:
- `frontend/.env` - Contains `VITE_API_URL=http://localhost:3001`
- `backend/real-api-server.js` - Express.js server with SQLite integration
- `backend/database.sqlite` - SQLite database file with real data
- `frontend/src/services/api.ts` - Axios configuration with JWT handling

**Original Architecture Files**:
- `backend/.env` - Environment variables for development
- `backend/src/app.module.ts` - Main application module registration
- `frontend/vite.config.ts` - Vite build configuration
- `docker-compose.yml` - Local development environment
- `backend/package.json` - Backend scripts and dependencies
- `frontend/package.json` - Frontend scripts and dependencies

## Recent Changes Log

**February 2026 - Frontend Integration Fixes**:
- Branch: `fix/leave-requests-frontend-integration`
- Commit: `23c0051 - Fix leave requests frontend integration and user management`
- Files Modified: 4 files (777 insertions, 68 deletions)
- Key Changes:
  - Added real-api-server.js with complete SQLite API
  - Fixed Dashboard form submissions to call backend
  - Replaced mock data in LeaveRequests with real API calls
  - Fixed user authentication ID mismatch
  - Implemented leave request cancellation
  - Added role-based data filtering
  - Enhanced error handling and user experience