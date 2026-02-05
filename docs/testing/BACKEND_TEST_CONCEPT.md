# LeaveBoard Backend Testing Concept

**Document Version:** 1.0
**Date:** February 2026
**Author:** Development Team

## 📋 Table of Contents
1. [Testing Strategy](#testing-strategy)
2. [Testing Pyramid](#testing-pyramid)
3. [Testing Frameworks & Tools](#testing-frameworks--tools)
4. [Test Categories](#test-categories)
5. [Test Implementation Plan](#test-implementation-plan)
6. [Test Data Management](#test-data-management)
7. [CI/CD Integration](#cicd-integration)
8. [Performance Testing](#performance-testing)
9. [Security Testing](#security-testing)
10. [Test Metrics & Reporting](#test-metrics--reporting)

---

## 1. Testing Strategy

### 1.1 Goals
- **Ensure Code Quality**: Maintain 80%+ test coverage
- **Prevent Regressions**: Catch breaking changes before deployment
- **Validate Business Logic**: Test leave request workflows and approval chains
- **Security Assurance**: Verify authentication and authorization
- **Performance Validation**: Ensure API response times meet SLA

### 1.2 Testing Approach
- **Test-Driven Development (TDD)**: Write tests before implementation for new features
- **Behavior-Driven Development (BDD)**: Use descriptive test names and scenarios
- **Continuous Testing**: Automated tests run on every commit
- **Shift-Left Testing**: Early testing in development cycle

---

## 2. Testing Pyramid

```
    /\
   /  \     E2E Tests (10%)
  /____\    - Full workflow testing
 /      \   - API integration tests
/________\
           Integration Tests (20%)
          - Database operations
          - Service interactions
          - Module integration
_________________________________
        Unit Tests (70%)
       - Services, Controllers
       - Entities, DTOs
       - Utilities, Helpers
```

---

## 3. Testing Frameworks & Tools

### 3.1 Core Testing Stack
```typescript
// Primary Testing Framework
"jest": "^29.7.0"
"@nestjs/testing": "^10.3.0"

// Database Testing
"@testcontainers/postgresql": "^10.7.1"
"typeorm": "^0.3.17" // In-memory database for unit tests

// API Testing
"supertest": "^6.3.4"
"nock": "^13.5.1" // HTTP mocking

// Mocking & Spies
"jest-mock": "^29.7.0"
"sinon": "^17.0.1"

// Test Data Generation
"@faker-js/faker": "^8.4.0"
"factory.ts": "^1.4.1"

// Coverage & Reporting
"@jest/globals": "^29.7.0"
"jest-html-reporter": "^3.10.2"
```

### 3.2 Additional Tools
- **Docker Compose**: Test environment setup
- **TestContainers**: Real database integration testing
- **Artillery/K6**: Load testing
- **OWASP ZAP**: Security testing
- **SonarQube**: Code quality analysis

---

## 4. Test Categories

### 4.1 Unit Tests (70% Coverage Target)

#### 4.1.1 Service Layer Tests
```typescript
// Example: LeaveRequestsService Unit Tests
describe('LeaveRequestsService', () => {
  let service: LeaveRequestsService;
  let repository: Repository<LeaveRequest>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        LeaveRequestsService,
        {
          provide: getRepositoryToken(LeaveRequest),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<LeaveRequestsService>(LeaveRequestsService);
  });

  describe('create', () => {
    it('should create a leave request successfully', async () => {
      // Test implementation
    });

    it('should validate business days calculation', async () => {
      // Test business logic
    });

    it('should throw error for overlapping requests', async () => {
      // Test validation logic
    });

    it('should check team capacity constraints', async () => {
      // Test workflow rules
    });
  });
});
```

**Unit Test Scope:**
- ✅ **Services**: Business logic validation
- ✅ **Controllers**: Request/response handling
- ✅ **Entities**: Model validation
- ✅ **DTOs**: Data validation
- ✅ **Guards**: Authentication/authorization
- ✅ **Pipes**: Data transformation
- ✅ **Utilities**: Helper functions

#### 4.1.2 Controller Tests
```typescript
// Example: AuthController Unit Tests
describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  describe('login', () => {
    it('should return JWT token for valid credentials', async () => {
      // Test authentication
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      // Test error handling
    });

    it('should validate input DTOs', async () => {
      // Test validation
    });
  });
});
```

### 4.2 Integration Tests (20% Coverage Target)

#### 4.2.1 Database Integration Tests
```typescript
// Example: Database Integration Test
describe('LeaveRequest Repository Integration', () => {
  let app: INestApplication;
  let repository: Repository<LeaveRequest>;

  beforeAll(async () => {
    // Setup test database with TestContainers
    const container = await new PostgreSQLContainer()
      .withUsername('test')
      .withPassword('test')
      .withDatabase('testdb')
      .start();

    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: container.getHost(),
          port: container.getFirstMappedPort(),
          // ... other config
        }),
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  it('should persist and retrieve leave requests', async () => {
    // Test CRUD operations
  });

  it('should handle concurrent requests correctly', async () => {
    // Test race conditions
  });
});
```

#### 4.2.2 Module Integration Tests
```typescript
// Example: Workflow Integration Test
describe('Leave Request Workflow Integration', () => {
  it('should complete full approval workflow', async () => {
    // 1. Create request
    // 2. Manager approval
    // 3. HR approval (if needed)
    // 4. Verify final state
  });

  it('should handle delegation scenarios', async () => {
    // Test manager delegation workflow
  });
});
```

### 4.3 End-to-End (E2E) Tests (10% Coverage Target)

#### 4.3.1 API Endpoint Tests
```typescript
// Example: E2E API Tests
describe('LeaveRequests API (e2e)', () => {
  let app: INestApplication;
  let jwtToken: string;

  beforeAll(async () => {
    // Setup full application
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Authenticate and get JWT token
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'password' })
      .expect(200);

    jwtToken = response.body.access_token;
  });

  describe('/leave-requests (POST)', () => {
    it('should create leave request with valid data', () => {
      return request(app.getHttpServer())
        .post('/leave-requests')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          type: 'ANNUAL',
          startDate: '2024-07-01',
          endDate: '2024-07-05',
          reason: 'Summer vacation',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.id).toBeDefined();
          expect(res.body.status).toBe('PENDING');
        });
    });

    it('should reject invalid date ranges', () => {
      return request(app.getHttpServer())
        .post('/leave-requests')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          type: 'ANNUAL',
          startDate: '2024-07-05',
          endDate: '2024-07-01', // Invalid: end before start
          reason: 'Test',
        })
        .expect(400);
    });
  });
});
```

---

## 5. Test Implementation Plan

### Phase 1: Foundation (Week 1-2)
- [ ] Setup testing infrastructure (Jest, TestContainers)
- [ ] Create test database configuration
- [ ] Implement test data factories
- [ ] Setup CI/CD pipeline integration
- [ ] Write unit tests for core entities

### Phase 2: Core Features (Week 3-4)
- [ ] Unit tests for LeaveRequestsService
- [ ] Unit tests for AuthService and UserService
- [ ] Integration tests for database operations
- [ ] API endpoint tests for authentication

### Phase 3: Business Logic (Week 5-6)
- [ ] Workflow engine tests
- [ ] Approval chain tests
- [ ] Delegation logic tests
- [ ] Calendar integration tests

### Phase 4: Advanced Features (Week 7-8)
- [ ] Analytics service tests
- [ ] Audit trail tests
- [ ] Performance tests
- [ ] Security tests

### Phase 5: E2E & Polish (Week 9-10)
- [ ] Complete E2E test scenarios
- [ ] Load testing implementation
- [ ] Test documentation
- [ ] Coverage analysis and optimization

---

## 6. Test Data Management

### 6.1 Test Data Strategy
```typescript
// Factory Pattern for Test Data
export class LeaveRequestFactory {
  static create(overrides: Partial<LeaveRequest> = {}): LeaveRequest {
    return {
      id: faker.string.uuid(),
      type: LeaveType.ANNUAL,
      startDate: faker.date.future(),
      endDate: faker.date.future(),
      reason: faker.lorem.sentence(),
      status: LeaveStatus.PENDING,
      totalDays: 5,
      user: UserFactory.create(),
      ...overrides,
    };
  }

  static createPending(): LeaveRequest {
    return this.create({ status: LeaveStatus.PENDING });
  }

  static createApproved(): LeaveRequest {
    return this.create({ status: LeaveStatus.APPROVED });
  }
}
```

### 6.2 Database Seeding
```typescript
// Test Database Seeder
export class TestDatabaseSeeder {
  static async seed(repository: Repository<any>): Promise<void> {
    // Create test users, teams, leave requests
    const users = UserFactory.createMany(10);
    const teams = TeamFactory.createMany(3);
    const requests = LeaveRequestFactory.createMany(20);

    await repository.save(users);
    await repository.save(teams);
    await repository.save(requests);
  }

  static async clear(repository: Repository<any>): Promise<void> {
    await repository.clear();
  }
}
```

---

## 7. CI/CD Integration

### 7.1 GitHub Actions Workflow
```yaml
# .github/workflows/backend-tests.yml
name: Backend Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci
        working-directory: ./backend

      - name: Run unit tests
        run: npm run test
        working-directory: ./backend

      - name: Run integration tests
        run: npm run test:integration
        working-directory: ./backend

      - name: Run E2E tests
        run: npm run test:e2e
        working-directory: ./backend

      - name: Generate coverage report
        run: npm run test:coverage
        working-directory: ./backend

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
```

### 7.2 Test Scripts
```json
// package.json scripts
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
    "test:unit": "jest --testPathPattern=src/.*\\.spec\\.ts$",
    "test:integration": "jest --testPathPattern=test/.*\\.spec\\.ts$",
    "test:e2e": "jest --config ./test/jest-e2e.json"
  }
}
```

---

## 8. Performance Testing

### 8.1 Load Testing with K6
```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp up to 200 users
    { duration: '5m', target: 200 }, // Stay at 200 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'],    // Error rate under 10%
  },
};

export default function() {
  // Test leave request creation
  let response = http.post('http://localhost:3001/api/leave-requests', {
    type: 'ANNUAL',
    startDate: '2024-07-01',
    endDate: '2024-07-05',
    reason: 'Load test',
  }, {
    headers: { 'Authorization': 'Bearer ' + __ENV.JWT_TOKEN },
  });

  check(response, {
    'status is 201': (r) => r.status === 201,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

### 8.2 Performance Test Scenarios
- **Concurrent Users**: Test 100-500 concurrent API requests
- **Database Load**: Test with large datasets (10k+ records)
- **Memory Usage**: Monitor memory consumption during tests
- **Response Times**: Ensure 95th percentile < 500ms

---

## 9. Security Testing

### 9.1 Authentication Tests
```typescript
describe('Security Tests', () => {
  describe('Authentication', () => {
    it('should reject requests without JWT token', async () => {
      return request(app.getHttpServer())
        .get('/leave-requests')
        .expect(401);
    });

    it('should reject expired JWT tokens', async () => {
      const expiredToken = jwt.sign(
        { sub: 'user-id', exp: Math.floor(Date.now() / 1000) - 3600 },
        'secret'
      );

      return request(app.getHttpServer())
        .get('/leave-requests')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });

  describe('Authorization', () => {
    it('should prevent employees from accessing admin endpoints', async () => {
      const employeeToken = generateEmployeeToken();

      return request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(403);
    });
  });
});
```

### 9.2 Input Validation Tests
```typescript
describe('Input Validation Security', () => {
  it('should prevent SQL injection in search queries', async () => {
    const maliciousInput = "'; DROP TABLE users; --";

    return request(app.getHttpServer())
      .get(`/leave-requests?search=${encodeURIComponent(maliciousInput)}`)
      .set('Authorization', `Bearer ${validToken}`)
      .expect(400);
  });

  it('should sanitize XSS attempts in reason field', async () => {
    const xssPayload = '<script>alert("xss")</script>';

    const response = await request(app.getHttpServer())
      .post('/leave-requests')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        type: 'ANNUAL',
        startDate: '2024-07-01',
        endDate: '2024-07-05',
        reason: xssPayload,
      })
      .expect(400);
  });
});
```

---

## 10. Test Metrics & Reporting

### 10.1 Coverage Targets
| Component | Target Coverage | Current |
|-----------|----------------|---------|
| **Services** | ≥ 90% | TBD |
| **Controllers** | ≥ 85% | TBD |
| **Entities** | ≥ 95% | TBD |
| **Guards/Pipes** | ≥ 100% | TBD |
| **Overall** | ≥ 80% | TBD |

### 10.2 Quality Metrics
- **Code Coverage**: Minimum 80% line coverage
- **Test Execution Time**: All tests complete within 5 minutes
- **Test Stability**: <1% flaky test rate
- **Performance**: API response times < 500ms (95th percentile)
- **Security**: Zero high/critical security vulnerabilities

### 10.3 Reporting Dashboard
```typescript
// Custom test reporter
class TestMetricsReporter {
  onRunComplete(contexts: Set<Context>, results: AggregatedResult): void {
    const metrics = {
      coverage: results.coverageMap.getCoverageSummary(),
      testResults: {
        passed: results.numPassedTests,
        failed: results.numFailedTests,
        total: results.numTotalTests,
      },
      performance: {
        duration: results.testResults.reduce((acc, test) => acc + test.testExecError, 0),
        slowTests: results.testResults.filter(test => test.testExecError > 1000),
      },
    };

    // Send metrics to monitoring system
    this.sendToMonitoring(metrics);
  }
}
```

---

## 11. Test Environment Management

### 11.1 Environment Configuration
```typescript
// test/config/test.config.ts
export const testConfig = {
  database: {
    host: process.env.TEST_DB_HOST || 'localhost',
    port: parseInt(process.env.TEST_DB_PORT) || 5433,
    database: 'leaveboard_test',
    username: 'test_user',
    password: 'test_password',
  },
  redis: {
    host: 'localhost',
    port: 6380, // Different port for test Redis
  },
  auth: {
    jwtSecret: 'test-secret-key',
    jwtExpiration: '1h',
  },
};
```

### 11.2 Docker Test Environment
```yaml
# docker-compose.test.yml
version: '3.8'

services:
  test-postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: leaveboard_test
      POSTGRES_USER: test_user
      POSTGRES_PASSWORD: test_password
    ports:
      - "5433:5432"
    tmpfs:
      - /var/lib/postgresql/data

  test-redis:
    image: redis:7-alpine
    ports:
      - "6380:6379"
    tmpfs:
      - /data
```

---

## 12. Maintenance & Best Practices

### 12.1 Test Maintenance Guidelines
- **Regular Review**: Review and update tests monthly
- **Refactor**: Keep tests DRY and maintainable
- **Documentation**: Document complex test scenarios
- **Cleanup**: Remove obsolete tests when features are deprecated

### 12.2 Best Practices
1. **Test Naming**: Use descriptive names that explain the scenario
2. **Test Isolation**: Each test should be independent
3. **Setup/Teardown**: Proper cleanup after each test
4. **Mock Strategy**: Mock external dependencies, not internal logic
5. **Test Data**: Use factories for consistent test data
6. **Assertions**: Clear and specific assertions
7. **Error Testing**: Test both success and failure scenarios

### 12.3 Common Pitfalls to Avoid
- ❌ Testing implementation details instead of behavior
- ❌ Flaky tests due to timing issues
- ❌ Over-mocking internal dependencies
- ❌ Not testing edge cases and error conditions
- ❌ Slow tests that block development
- ❌ Tests that depend on external services

---

## 13. Conclusion

This testing concept provides a comprehensive framework for ensuring the quality, reliability, and security of the LeaveBoard backend. The multi-layered testing approach, combined with proper tooling and CI/CD integration, will help maintain high code quality and prevent regressions as the application evolves.

**Next Steps:**
1. Review and approve this testing concept
2. Set up testing infrastructure
3. Begin implementation following the phased approach
4. Monitor metrics and adjust strategy as needed

**Success Criteria:**
- 80%+ test coverage achieved
- All tests running in CI/CD pipeline
- Performance benchmarks met
- Zero critical security vulnerabilities
- Stable, maintainable test suite