# 🏖️ LeaveBoard - Vacation & Absence Tracking System

## 📋 Overview

LeaveBoard is a comprehensive full-stack vacation and absence tracking system designed to streamline leave management for modern organizations. Built with React + TypeScript frontend and NestJS + TypeORM backend, it provides employees and managers with powerful tools for requesting, approving, and tracking time off.

## ✨ Current Features

### 🏠 **Dashboard**
- Real-time overview of leave statistics
- Quick vacation request submission
- Pending requests counter
- Approved requests tracking
- Days remaining display
- Team availability status

### 📝 **Leave Request Management**
- **Multiple Leave Types**: Annual, Sick, Personal, Unpaid leave
- **Smart Form Validation**: Date validation, business rules enforcement
- **Priority Levels**: Urgent, High, Medium, Low prioritization
- **Rich Reason Input**: Detailed leave reason descriptions
- **Draft & Submit Options**: Save as draft or submit immediately

### ⚡ **Approval Workflows**
- **Multi-Level Approval Chains**: Manager → Department Head → HR → CEO
- **Parallel Approval Support**: Multiple approvers for complex scenarios
- **Conditional Routing**: Dynamic approval paths based on leave type/duration
- **Delegation Framework**: Acting manager assignments during absences
- **Escalation System**: Automatic escalation with configurable timers
- **Approval History**: Complete audit trail with timestamps and comments

### 👥 **Manager Tools**
- **Approval Dashboard**: Centralized pending approvals queue
- **Team Analytics**: Leave patterns and capacity forecasting
- **Bulk Operations**: Process multiple requests efficiently
- **SLA Tracking**: Monitor approval performance metrics
- **Team Calendar**: Visual team availability overview

### 🤖 **Workflow Automation**
- **Auto-Approval Rules**: Configurable rules for routine requests
- **Smart Routing**: Business rule-based approval path selection
- **Timer-Based Escalation**: Automatic promotion when SLA exceeded
- **Notification System**: Real-time updates and reminders

### 📊 **Analytics & Reporting**
- **Manager Dashboard**: Performance metrics and team insights
- **Team Capacity Planning**: Forecasting and availability analysis
- **Approval Performance**: SLA compliance and efficiency metrics
- **Comprehensive Audit Trail**: Immutable decision history

### 🔐 **Security & Compliance**
- **Role-Based Access Control**: Employee, Manager, HR, Admin roles
- **JWT Authentication**: Secure API access
- **Audit Logging**: Complete compliance trail
- **Data Validation**: Input sanitization and business rule enforcement

### 📱 **User Experience**
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Intuitive Interface**: Clean, modern Material-inspired UI
- **Real-Time Updates**: Live data synchronization
- **Comprehensive Error Handling**: User-friendly error messages

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- npm or yarn
- Git

### 1. Clone & Setup
```bash
git clone <repository-url>
cd ClaudeCodeHackathon

# Install dependencies
npm install
cd frontend && npm install
cd ../backend && npm install
```

### 2. Start Development Servers

**Frontend (React + TypeScript)**
```bash
cd frontend
npm run dev
# Runs on: http://localhost:3007
```

**Backend (Simple API Server)**
```bash
# From root directory
node simple-backend.js
# Runs on: http://127.0.0.1:3002
```

### 3. Access the Application
- **Frontend**: http://localhost:3007
- **Backend API**: http://127.0.0.1:3002
- **API Documentation**: Available via backend logs

## 🛠️ Development Setup

### Backend Development
```bash
cd backend
npm run start:dev    # NestJS development server (when database is configured)
npm run build        # Production build
npm run test         # Run tests
```

### Frontend Development
```bash
cd frontend
npm run dev          # Vite development server
npm run build        # Production build
npm run preview      # Preview production build
npm run test         # Run tests
```

## 📡 API Endpoints

### Core Endpoints
- `GET /api/health` - Health check
- `GET /api/workflows/my-pending-approvals` - Get pending approvals
- `POST /api/workflows/steps/:stepId/approve` - Process approval decision
- `GET /api/leave-requests/all` - Get all leave requests

### Workflow Management
- `GET /api/workflows/templates` - Available workflow templates
- `POST /api/workflows/initiate` - Start new workflow
- `GET /api/workflows/instances/:id` - Get workflow status
- `POST /api/workflows/instances/:id/cancel` - Cancel workflow

### Analytics & Reporting
- `GET /api/analytics/dashboard` - Manager dashboard data
- `GET /api/analytics/team/:teamId` - Team analytics
- `GET /api/workflows/analytics/performance` - Performance metrics

## 🧪 Testing

### Test Files Available
- `test-api.html` - API endpoint testing tool
- `debug-test.html` - Comprehensive diagnostics tool
- Backend unit tests in `/backend/src/**/*.spec.ts`
- Frontend component tests in `/frontend/src/**/*.test.tsx`

### Running Tests
```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test

# E2E tests
npm run test:e2e
```

## 📁 Project Structure

```
ClaudeCodeHackathon/
├── frontend/                 # React + TypeScript frontend
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/           # Page components
│   │   ├── services/        # API services
│   │   ├── contexts/        # React contexts
│   │   └── types/           # TypeScript definitions
├── backend/                 # NestJS + TypeORM backend
│   ├── src/
│   │   ├── modules/         # Feature modules
│   │   │   ├── auth/        # Authentication
│   │   │   ├── users/       # User management
│   │   │   ├── leave-requests/ # Leave requests
│   │   │   ├── workflows/   # Approval workflows
│   │   │   ├── analytics/   # Analytics & reporting
│   │   │   └── audit/       # Audit trail
│   │   └── database/        # Database configuration
├── simple-backend.js        # Simple API server for development
├── test-api.html           # API testing tool
└── debug-test.html         # Diagnostics tool
```

## 🔧 Configuration

### Environment Variables
```bash
# Backend (.env)
NODE_ENV=development
PORT=3002
JWT_SECRET=your-secret-key
DATABASE_URL=./database.sqlite

# Frontend (.env)
VITE_API_URL=http://127.0.0.1:3002
```

### Database Setup
The system supports both SQLite (development) and PostgreSQL (production):

```bash
# Using SQLite (current setup)
# No additional setup required

# Using PostgreSQL (for production)
# Update backend/.env with PostgreSQL connection string
```

## 🌟 Key Technical Features

### Architecture Highlights
- **Clean Architecture**: Separation of concerns with layered structure
- **Type Safety**: Full TypeScript implementation across frontend and backend
- **RESTful APIs**: Standard REST endpoints with proper HTTP methods
- **CORS Support**: Cross-origin requests properly configured
- **Error Handling**: Comprehensive error management and user feedback

### Performance Features
- **Lazy Loading**: Components loaded on demand
- **Optimistic Updates**: UI updates before server confirmation
- **Caching Strategy**: Efficient data caching for better performance
- **Background Processing**: Non-blocking operations for better UX

### Security Features
- **Input Validation**: Server-side validation for all inputs
- **SQL Injection Protection**: Parameterized queries via TypeORM
- **XSS Prevention**: Output encoding and CSP headers
- **RBAC**: Role-based access control throughout the application

## 📈 Development Status

### ✅ Completed Features
- [x] Full-stack application setup
- [x] Authentication system foundation
- [x] Leave request management
- [x] Approval workflow engine
- [x] Manager dashboard
- [x] Team analytics
- [x] API documentation
- [x] Frontend-backend integration
- [x] Responsive UI design
- [x] Testing framework

### 🚧 Work in Progress
- [ ] Database integration (SQLite/PostgreSQL)
- [ ] Email notifications
- [ ] Advanced reporting
- [ ] Mobile app companion

### 🔮 Planned Features
- [ ] Calendar integrations (Google Calendar, Outlook)
- [ ] Slack/Teams notifications
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] API rate limiting
- [ ] Advanced audit features

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support & Documentation

- **API Testing**: Use `test-api.html` for endpoint testing
- **Debugging**: Use `debug-test.html` for connectivity diagnostics
- **Development**: Check console logs for detailed error information
- **Issues**: Report bugs via GitHub issues

## 🎯 Quick Navigation

- **Dashboard**: Main overview page with statistics
- **Requests**: Submit and manage leave requests
- **Approvals**: Review and process pending approvals (Manager+)
- **Calendar**: Team availability and planning view
- **Analytics**: Performance metrics and insights (Manager+)

---

**Built with ❤️ using React, TypeScript, NestJS, and modern web technologies**

*For questions or support, please check the documentation or create an issue.*