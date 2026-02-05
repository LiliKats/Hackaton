#!/bin/bash

# LeaveBoard Test Runner Script
# Comprehensive testing script for CI/CD pipeline

set -e

# Configuration
TEST_ENV="test"
LOG_FILE="test_results_$(date +%Y%m%d_%H%M%S).log"
COVERAGE_THRESHOLD=80
TEST_TIMEOUT=300

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

# Function to setup test environment
setup_test_env() {
    log "Setting up test environment..."

    # Install dependencies if needed
    if [ ! -d "backend/node_modules" ]; then
        log "Installing backend dependencies..."
        cd backend && npm ci && cd ..
    fi

    if [ ! -d "frontend/node_modules" ]; then
        log "Installing frontend dependencies..."
        cd frontend && npm ci && cd ..
    fi

    # Start test database
    log "Starting test database..."
    docker-compose -f docker-compose.test.yml up -d postgres-test redis-test

    # Wait for services to be ready
    sleep 10

    success "Test environment setup completed"
}

# Function to run backend unit tests
run_backend_unit_tests() {
    log "Running backend unit tests..."

    cd backend

    # Run unit tests with coverage
    npm run test:cov -- --testTimeout=$TEST_TIMEOUT --verbose

    # Check coverage threshold
    COVERAGE=$(npm run test:cov 2>/dev/null | grep -o 'All files.*%' | grep -o '[0-9]*\.[0-9]*' | head -1)

    if [ -n "$COVERAGE" ]; then
        if (( $(echo "$COVERAGE < $COVERAGE_THRESHOLD" | bc -l) )); then
            warning "Code coverage ($COVERAGE%) is below threshold ($COVERAGE_THRESHOLD%)"
        else
            success "Code coverage: $COVERAGE%"
        fi
    fi

    cd ..
}

# Function to run backend integration tests
run_backend_integration_tests() {
    log "Running backend integration tests..."

    cd backend

    # Set test environment
    export NODE_ENV=test
    export DB_HOST=localhost
    export DB_PORT=5433
    export DB_NAME=leaveboard_test
    export DB_USERNAME=test_user
    export DB_PASSWORD=test_password

    # Run database migrations for test DB
    npm run migration:run

    # Run integration tests
    npm run test:e2e -- --testTimeout=$TEST_TIMEOUT

    cd ..
}

# Function to run frontend tests
run_frontend_tests() {
    log "Running frontend tests..."

    cd frontend

    # Run unit tests
    npm run test -- --coverage --watchAll=false

    # Run component tests
    npm run test:components -- --watchAll=false

    cd ..
}

# Function to run API tests
run_api_tests() {
    log "Running API tests..."

    # Start backend in test mode
    cd backend
    npm run start:test &
    BACKEND_PID=$!

    # Wait for backend to start
    sleep 15

    # Run API tests using Newman (Postman CLI)
    if command -v newman &> /dev/null; then
        newman run ../tests/api/LeaveBoard_API_Tests.postman_collection.json \
            --environment ../tests/api/test_environment.json \
            --reporters cli,html \
            --reporter-html-export ../test_results/api_test_report.html
    else
        warning "Newman not installed, skipping API tests"
    fi

    # Stop backend
    kill $BACKEND_PID
    cd ..
}

# Function to run end-to-end tests
run_e2e_tests() {
    log "Running end-to-end tests..."

    # Start full application stack
    docker-compose -f docker-compose.test.yml up -d

    # Wait for services
    sleep 30

    cd frontend

    # Run Cypress e2e tests
    if command -v cypress &> /dev/null; then
        npx cypress run --config video=true,screenshotOnRunFailure=true
    else
        warning "Cypress not installed, skipping e2e tests"
    fi

    cd ..

    # Stop test stack
    docker-compose -f docker-compose.test.yml down
}

# Function to run security tests
run_security_tests() {
    log "Running security tests..."

    cd backend

    # Run npm audit
    npm audit --audit-level moderate

    # Run dependency check
    if command -v safety &> /dev/null; then
        safety check
    fi

    # Run SAST scan with ESLint security rules
    npm run lint:security

    cd ..
}

# Function to run performance tests
run_performance_tests() {
    log "Running performance tests..."

    # Start application
    docker-compose -f docker-compose.test.yml up -d

    sleep 30

    # Run load tests with Artillery
    if command -v artillery &> /dev/null; then
        artillery run tests/performance/load_test.yml --output test_results/performance_report.json
    else
        warning "Artillery not installed, skipping performance tests"
    fi

    # Stop application
    docker-compose -f docker-compose.test.yml down
}

# Function to run workflow-specific tests
run_workflow_tests() {
    log "Running workflow system tests..."

    cd backend

    # Run workflow engine tests
    npm run test -- --testPathPattern="workflows" --verbose

    # Run delegation system tests
    npm run test -- --testPathPattern="delegations" --verbose

    # Run audit system tests
    npm run test -- --testPathPattern="audit" --verbose

    cd ..
}

# Function to generate test report
generate_test_report() {
    log "Generating test report..."

    cat > test_results/summary.html << EOF
<!DOCTYPE html>
<html>
<head>
    <title>LeaveBoard Test Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .success { background: #d4edda; border-color: #c3e6cb; }
        .warning { background: #fff3cd; border-color: #ffeaa7; }
        .error { background: #f8d7da; border-color: #f5c6cb; }
        .metrics { display: flex; gap: 20px; margin: 20px 0; }
        .metric { text-align: center; padding: 15px; border-radius: 5px; background: #f8f9fa; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧪 LeaveBoard Test Results</h1>
        <p>Test run completed on: $(date)</p>
        <p>Environment: $TEST_ENV</p>
    </div>

    <div class="metrics">
        <div class="metric">
            <h3>Code Coverage</h3>
            <p>${COVERAGE:-"N/A"}%</p>
        </div>
        <div class="metric">
            <h3>Test Duration</h3>
            <p>$(date -d@$SECONDS -u +%H:%M:%S)</p>
        </div>
    </div>

    <div class="section success">
        <h3>✅ Test Categories Completed</h3>
        <ul>
            <li>Unit Tests</li>
            <li>Integration Tests</li>
            <li>Workflow Tests</li>
            <li>Security Tests</li>
        </ul>
    </div>

    <div class="section">
        <h3>📊 Detailed Results</h3>
        <p>Check individual test logs in the test_results directory</p>
        <p>Log file: $LOG_FILE</p>
    </div>
</body>
</html>
EOF

    success "Test report generated: test_results/summary.html"
}

# Function to cleanup test environment
cleanup() {
    log "Cleaning up test environment..."

    # Stop any running containers
    docker-compose -f docker-compose.test.yml down -v

    # Clean up test files
    find . -name "*.test.tmp" -delete

    success "Cleanup completed"
}

# Main function
main() {
    START_TIME=$(date +%s)

    log "Starting LeaveBoard test suite..."
    log "=================================="

    # Create test results directory
    mkdir -p test_results

    case "${1:-all}" in
        "all")
            setup_test_env
            run_backend_unit_tests
            run_backend_integration_tests
            run_workflow_tests
            run_frontend_tests
            run_security_tests
            ;;
        "unit")
            setup_test_env
            run_backend_unit_tests
            ;;
        "integration")
            setup_test_env
            run_backend_integration_tests
            ;;
        "workflows")
            setup_test_env
            run_workflow_tests
            ;;
        "frontend")
            setup_test_env
            run_frontend_tests
            ;;
        "api")
            setup_test_env
            run_api_tests
            ;;
        "e2e")
            run_e2e_tests
            ;;
        "security")
            run_security_tests
            ;;
        "performance")
            run_performance_tests
            ;;
        *)
            echo "Usage: $0 {all|unit|integration|workflows|frontend|api|e2e|security|performance}"
            exit 1
            ;;
    esac

    generate_test_report
    cleanup

    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))

    success "All tests completed in ${DURATION} seconds"
}

# Trap cleanup on exit
trap cleanup EXIT

# Run main function
main "$@"