#!/bin/bash

# LeaveBoard Database Backup Script
# Automated backup solution with S3 upload and retention management

set -e

# Configuration
BACKUP_DIR="/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="leaveboard_backup_${TIMESTAMP}.sql"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

# Database configuration
DB_HOST=${DB_HOST:-postgres-prod}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-leaveboard_prod}
DB_USER=${DB_USERNAME:-leaveboard_user}

# Logging
LOG_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.log"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error() {
    echo "[ERROR] $1" | tee -a "$LOG_FILE"
    exit 1
}

success() {
    echo "[SUCCESS] $1" | tee -a "$LOG_FILE"
}

# Create backup directory
mkdir -p "$BACKUP_DIR"

log "Starting database backup process..."

# Create database dump
log "Creating database dump..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --verbose \
    --clean \
    --create \
    --format=custom \
    --file="${BACKUP_DIR}/${BACKUP_FILE}" \
    2>&1 | tee -a "$LOG_FILE"

if [ ${PIPESTATUS[0]} -ne 0 ]; then
    error "Database backup failed"
fi

# Compress backup
log "Compressing backup..."
gzip "${BACKUP_DIR}/${BACKUP_FILE}"
COMPRESSED_FILE="${BACKUP_FILE}.gz"

# Verify backup integrity
log "Verifying backup integrity..."
gunzip -t "${BACKUP_DIR}/${COMPRESSED_FILE}"
if [ $? -ne 0 ]; then
    error "Backup integrity check failed"
fi

success "Database backup created: ${COMPRESSED_FILE}"

# Upload to S3 if configured
if [ -n "$S3_BACKUP_BUCKET" ] && [ -n "$AWS_ACCESS_KEY_ID" ]; then
    log "Uploading backup to S3..."
    aws s3 cp "${BACKUP_DIR}/${COMPRESSED_FILE}" "s3://${S3_BACKUP_BUCKET}/database-backups/"

    if [ $? -eq 0 ]; then
        success "Backup uploaded to S3"
    else
        error "S3 upload failed"
    fi
fi

# Cleanup old backups
log "Cleaning up old backups (older than ${RETENTION_DAYS} days)..."
find "$BACKUP_DIR" -name "leaveboard_backup_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
success "Cleanup completed"

# Send notification (if webhook configured)
if [ -n "$SLACK_WEBHOOK_URL" ]; then
    BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${COMPRESSED_FILE}" | cut -f1)
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"✅ LeaveBoard backup completed successfully\n📊 Size: ${BACKUP_SIZE}\n📅 Time: $(date)\"}" \
        "$SLACK_WEBHOOK_URL"
fi

log "Backup process completed successfully"
echo "Backup file: ${BACKUP_DIR}/${COMPRESSED_FILE}"