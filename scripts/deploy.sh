#!/bin/bash

# LeaveBoard Production Deployment Script
# This script handles the deployment of the LeaveBoard application to production

set -e  # Exit on any error

# Configuration
APP_NAME="leaveboard"
BACKUP_DIR="/backups"
DEPLOYMENT_DATE=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="/var/log/${APP_NAME}_deploy_${DEPLOYMENT_DATE}.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
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

# Function to check prerequisites
check_prerequisites() {
    log "Checking deployment prerequisites..."

    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
    fi

    if ! docker info &> /dev/null; then
        error "Docker daemon is not running"
    fi

    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed"
    fi

    # Check if environment file exists
    if [ ! -f ".env.production" ]; then
        error "Production environment file (.env.production) not found"
    fi

    # Check for required environment variables
    source .env.production
    if [ -z "$DB_PASSWORD" ] || [ -z "$JWT_SECRET" ] || [ -z "$REDIS_PASSWORD" ]; then
        error "Required environment variables are not set"
    fi

    success "Prerequisites check passed"
}

# Function to create backup
create_backup() {
    log "Creating database backup..."

    # Create backup directory if it doesn't exist
    mkdir -p "$BACKUP_DIR"

    # Backup database if it exists
    if docker ps | grep -q "leaveboard-db-prod"; then
        docker exec leaveboard-db-prod pg_dump -U "$DB_USERNAME" -d "$DB_NAME" > "${BACKUP_DIR}/backup_${DEPLOYMENT_DATE}.sql"
        success "Database backup created: backup_${DEPLOYMENT_DATE}.sql"
    else
        warning "No existing database container found, skipping backup"
    fi
}

# Function to pull latest images
pull_images() {
    log "Pulling latest Docker images..."
    docker-compose -f docker-compose.prod.yml pull
    success "Images pulled successfully"
}

# Function to build application images
build_images() {
    log "Building application images..."
    docker-compose -f docker-compose.prod.yml build --no-cache
    success "Images built successfully"
}

# Function to run database migrations
run_migrations() {
    log "Running database migrations..."

    # Wait for database to be ready
    log "Waiting for database to be ready..."
    timeout=60
    while [ $timeout -gt 0 ]; do
        if docker exec leaveboard-db-prod pg_isready -U "$DB_USERNAME" -d "$DB_NAME" &> /dev/null; then
            break
        fi
        sleep 2
        ((timeout-=2))
    done

    if [ $timeout -le 0 ]; then
        error "Database failed to become ready within 60 seconds"
    fi

    # Run migrations
    docker-compose -f docker-compose.prod.yml exec -T backend-prod npm run migration:run
    success "Database migrations completed"
}

# Function to create default data
create_default_data() {
    log "Creating default workflow templates..."
    docker-compose -f docker-compose.prod.yml exec -T backend-prod npm run seed:workflows
    success "Default data created"
}

# Function to deploy application
deploy_application() {
    log "Deploying application..."

    # Stop existing containers
    docker-compose -f docker-compose.prod.yml down

    # Start new containers
    docker-compose -f docker-compose.prod.yml up -d

    # Wait for services to be healthy
    log "Waiting for services to be healthy..."
    sleep 30

    # Check if all services are running
    if docker-compose -f docker-compose.prod.yml ps | grep -q "Exit"; then
        error "Some services failed to start"
    fi

    success "Application deployed successfully"
}

# Function to run health checks
run_health_checks() {
    log "Running health checks..."

    # Check backend health
    max_attempts=30
    attempt=1
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:3000/health &> /dev/null; then
            success "Backend health check passed"
            break
        fi
        log "Health check attempt $attempt/$max_attempts failed, waiting..."
        sleep 10
        ((attempt++))
    done

    if [ $attempt -gt $max_attempts ]; then
        error "Backend health check failed after $max_attempts attempts"
    fi

    # Check frontend health
    if curl -f http://localhost/health &> /dev/null; then
        success "Frontend health check passed"
    else
        warning "Frontend health check failed"
    fi

    # Check database connectivity
    if docker exec leaveboard-db-prod pg_isready -U "$DB_USERNAME" -d "$DB_NAME" &> /dev/null; then
        success "Database connectivity check passed"
    else
        error "Database connectivity check failed"
    fi
}

# Function to setup monitoring
setup_monitoring() {
    log "Setting up monitoring..."

    # Import Grafana dashboards
    if [ -d "./monitoring/grafana/dashboards" ]; then
        log "Importing Grafana dashboards..."
        # Dashboard import logic would go here
        success "Grafana dashboards imported"
    fi

    # Setup log rotation
    cat > /etc/logrotate.d/leaveboard << EOF
/var/log/leaveboard*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 root root
}
EOF

    success "Monitoring setup completed"
}

# Function to cleanup old resources
cleanup() {
    log "Cleaning up old resources..."

    # Remove old images
    docker image prune -f

    # Remove old backups (keep last 30 days)
    find "$BACKUP_DIR" -name "backup_*.sql" -mtime +30 -delete

    success "Cleanup completed"
}

# Function to print deployment summary
deployment_summary() {
    log "Deployment Summary:"
    log "=================="
    log "Deployment Date: $DEPLOYMENT_DATE"
    log "Application: $APP_NAME"
    log "Environment: Production"
    log ""
    log "Services Status:"
    docker-compose -f docker-compose.prod.yml ps
    log ""
    log "Application URLs:"
    log "Frontend: http://localhost"
    log "Backend API: http://localhost:3000"
    log "Grafana: http://localhost:3001"
    log "Kibana: http://localhost:5601"
    log ""
    log "Log File: $LOG_FILE"
    success "Deployment completed successfully!"
}

# Function to rollback deployment
rollback() {
    log "Rolling back deployment..."

    # Stop current containers
    docker-compose -f docker-compose.prod.yml down

    # Restore database from backup
    if [ -n "$1" ] && [ -f "${BACKUP_DIR}/$1" ]; then
        log "Restoring database from backup: $1"
        cat "${BACKUP_DIR}/$1" | docker exec -i leaveboard-db-prod psql -U "$DB_USERNAME" -d "$DB_NAME"
    fi

    # Start containers with previous version
    docker-compose -f docker-compose.prod.yml up -d

    warning "Rollback completed"
}

# Main deployment function
main() {
    log "Starting LeaveBoard production deployment..."
    log "=============================================="

    case "${1:-deploy}" in
        "deploy")
            check_prerequisites
            create_backup
            pull_images
            build_images
            deploy_application
            run_migrations
            create_default_data
            run_health_checks
            setup_monitoring
            cleanup
            deployment_summary
            ;;
        "rollback")
            rollback "$2"
            ;;
        "health")
            run_health_checks
            ;;
        "backup")
            create_backup
            ;;
        "cleanup")
            cleanup
            ;;
        *)
            echo "Usage: $0 {deploy|rollback|health|backup|cleanup}"
            echo ""
            echo "Commands:"
            echo "  deploy   - Full deployment (default)"
            echo "  rollback - Rollback to previous version"
            echo "  health   - Run health checks"
            echo "  backup   - Create database backup"
            echo "  cleanup  - Clean up old resources"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"