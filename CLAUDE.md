# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LeaveBoard is a comprehensive vacation and absence tracking system with enterprise-grade workflow management capabilities. The application consists of a **NestJS backend** with TypeORM and PostgreSQL, and a **React frontend** with TypeScript, designed for manager approval workflows, delegation management, and audit compliance.

## Development Commands

### Backend (NestJS + TypeORM + PostgreSQL)

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

**PostgreSQL** with TypeORM featuring:

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

- **RESTful endpoints** with consistent HTTP status codes
- **DTO validation** using class-validator with detailed error messages
- **OpenAPI/Swagger** documentation available at `/api/docs`
- **Pagination**: Standard offset/limit patterns with total counts
- **Error handling**: Global exception filters with structured error responses

### Frontend State Management

- **AuthContext**: Global authentication state with JWT handling
- **API Services**: Typed service layer with axios interceptors
- **Development Mode**: Admin bypass for quick development access
- **Mock Data**: Components use mock data until API integration is complete

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

## Key Configuration Files

- `backend/.env` - Environment variables for development
- `backend/src/app.module.ts` - Main application module registration
- `frontend/vite.config.ts` - Vite build configuration
- `docker-compose.yml` - Local development environment
- `backend/package.json` - Backend scripts and dependencies
- `frontend/package.json` - Frontend scripts and dependencies