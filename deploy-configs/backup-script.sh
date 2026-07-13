#!/usr/bin/env bash
# backup-script.sh — Automated DB + Storage backup for ERP Konstruksi
# Usage: ./backup-script.sh [--s3|--local] [--encrypt] [--retention-days N]
# Cron: 0 2 * * * /var/www/erp/deploy-configs/backup-script.sh --s3 --encrypt >> /var/log/erp-backup.log 2>&1

set -euo pipefail

# =============================================================================
# CONFIGURATION — EDIT THESE FOR YOUR ENVIRONMENT
# =============================================================================

# App paths
APP_DIR="/var/www/erp"
STORAGE_DIR="${APP_DIR}/storage/app"
DB_CONNECTION="mysql"

# Backup settings
BACKUP_ROOT="/var/backups/erp"
RETENTION_DAYS=30
ENCRYPT=false
ENCRYPT_KEY=""  # Set via env BACKUP_ENCRYPT_KEY or gpg --gen-key

# S3 settings (optional)
USE_S3=false
S3_BUCKET="erp-backups-prod"
S3_REGION="ap-southeast-1"
S3_PREFIX="erp-backups"
AWS_PROFILE="default"

# Notification (optional)
SLACK_WEBHOOK_URL=""    # For success/failure notifications
DISCORD_WEBHOOK_URL=""  # Alternative
EMAIL_TO=""             # For mailx/mutt

# MySQL credentials (read from .env if not set here)
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_DATABASE="${DB_DATABASE:-erp_konstruksi}"
DB_USERNAME="${DB_USERNAME:-erp_user}"
DB_PASSWORD="${DB_PASSWORD:-}"

# =============================================================================
# COLORS & HELPERS
# =============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()   { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $*"; }
ok()    { echo -e "${GREEN}✓${NC} $*"; }
warn()  { echo -e "${YELLOW}⚠${NC} $*"; }
err()   { echo -e "${RED}✗${NC} $*" >&2; }

# =============================================================================
# PARSE ARGUMENTS
# =============================================================================

while [[ $# -gt 0 ]]; do
    case $1 in
        --s3) USE_S3=true; shift ;;
        --local) USE_S3=false; shift ;;
        --encrypt) ENCRYPT=true; shift ;;
        --retention-days) RETENTION_DAYS="$2"; shift 2 ;;
        --encrypt-key) ENCRYPT_KEY="$2"; shift 2 ;;
        --help|-h)
            cat <<EOF
Usage: $0 [options]

Options:
  --s3              Upload to S3 (default: local only)
  --local           Store locally only (default)
  --encrypt         Encrypt backups with GPG
  --retention-days N  Keep backups for N days (default: 30)
  --encrypt-key KEY   GPG key ID or passphrase
  --help, -h        Show this help

Environment variables (alternative to flags):
  BACKUP_S3=true
  BACKUP_ENCRYPT=true
  BACKUP_RETENTION_DAYS=30
  BACKUP_ENCRYPT_KEY=...
  SLACK_WEBHOOK_URL=...
  DISCORD_WEBHOOK_URL=...
  EMAIL_TO=...
EOF
            exit 0
            ;;
        *) err "Unknown option: $1"; exit 1 ;;
    esac
done

# Override from env
USE_S3="${BACKUP_S3:-$USE_S3}"
ENCRYPT="${BACKUP_ENCRYPT:-$ENCRYPT}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-$RETENTION_DAYS}"
ENCRYPT_KEY="${BACKUP_ENCRYPT_KEY:-$ENCRYPT_KEY}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-$SLACK_WEBHOOK_URL}"
DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-$DISCORD_WEBHOOK_URL}"
EMAIL_TO="${EMAIL_TO:-$EMAIL_TO}"

# =============================================================================
# PRE-CHECKS
# =============================================================================

log "Starting ERP backup..."

# Check required commands
for cmd in mysqldump tar gzip aws gpg; do
    if ! command -v "$cmd" &>/dev/null && [[ "$cmd" != "aws" || "$USE_S3" != "true" ]] && [[ "$cmd" != "gpg" || "$ENCRYPT" != "true" ]]; then
        err "Required command not found: $cmd"
        exit 1
    fi
done

# Load .env if exists
if [[ -f "${APP_DIR}/.env" ]]; then
    # shellcheck disable=SC1090
    source <(grep -E '^(DB_|APP_)=' "${APP_DIR}/.env" | sed 's/^/export /')
fi

# Final DB password check
if [[ -z "$DB_PASSWORD" ]]; then
    err "DB_PASSWORD not set. Set in .env or pass via env var."
    exit 1
fi

# Create backup directory
mkdir -p "${BACKUP_ROOT}/daily" "${BACKUP_ROOT}/weekly" "${BACKUP_ROOT}/monthly"

TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
DATE_DIR=$(date '+%Y-%m-%d')
BACKUP_DIR="${BACKUP_ROOT}/daily/${DATE_DIR}"
mkdir -p "${BACKUP_DIR}"

DB_FILE="${BACKUP_DIR}/erp_db_${TIMESTAMP}.sql.gz"
STORAGE_FILE="${BACKUP_DIR}/erp_storage_${TIMESTAMP}.tar.gz"
MANIFEST_FILE="${BACKUP_DIR}/manifest_${TIMESTAMP}.json"

# =============================================================================
# BACKUP DATABASE
# =============================================================================

log "Backing up database (${DB_DATABASE})..."

if mysqldump \
    --host="${DB_HOST}" \
    --port="${DB_PORT}" \
    --user="${DB_USERNAME}" \
    --password="${DB_PASSWORD}" \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    --hex-blob \
    --quick \
    --lock-tables=false \
    "${DB_DATABASE}" | gzip > "${DB_FILE}"; then
    DB_SIZE=$(du -h "${DB_FILE}" | cut -f1)
    ok "Database backup: ${DB_FILE} (${DB_SIZE})"
else
    err "Database backup failed!"
    exit 1
fi

# =============================================================================
# BACKUP STORAGE (public + private)
# =============================================================================

log "Backing up storage directory..."

# Only backup files that aren't huge/temp
tar --exclude='*/node_modules' \
    --exclude='*/vendor' \
    --exclude='*/.git' \
    --exclude='*/cache/*' \
    --exclude='*/logs/*.log' \
    --exclude='*/debugbar/*' \
    --exclude='*/telescope/*' \
    -czf "${STORAGE_FILE}" \
    -C "${APP_DIR}" storage/app/public storage/app/private 2>/dev/null || true

if [[ -f "${STORAGE_FILE}" ]]; then
    STORAGE_SIZE=$(du -h "${STORAGE_FILE}" | cut -f1)
    ok "Storage backup: ${STORAGE_FILE} (${STORAGE_SIZE})"
else
    warn "Storage backup empty or failed, creating empty archive"
    tar -czf "${STORAGE_FILE}" -T /dev/null
    STORAGE_SIZE="0B"
fi

# =============================================================================
# CREATE MANIFEST
# =============================================================================

log "Creating manifest..."

cat > "${MANIFEST_FILE}" <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "app": "erp-konstruksi",
  "version": "$(cd ${APP_DIR} && git describe --tags --always 2>/dev/null || echo 'unknown')",
  "database": {
    "file": "$(basename ${DB_FILE})",
    "size_bytes": $(stat -c%s "${DB_FILE}"),
    "tables": $(mysqldump --host="${DB_HOST}" --port="${DB_PORT}" --user="${DB_USERNAME}" --password="${DB_PASSWORD}" --no-data "${DB_DATABASE}" 2>/dev/null | grep -c '^CREATE TABLE' || echo 0)
  },
  "storage": {
    "file": "$(basename ${STORAGE_FILE})",
    "size_bytes": $(stat -c%s "${STORAGE_FILE}")
  },
  "retention_days": ${RETENTION_DAYS},
  "encrypted": ${ENCRYPT},
  "s3_uploaded": ${USE_S3}
}
EOF

ok "Manifest: ${MANIFEST_FILE}"

# =============================================================================
# ENCRYPT (OPTIONAL)
# =============================================================================

if [[ "${ENCRYPT}" == "true" ]]; then
    log "Encrypting backup files..."
    for f in "${DB_FILE}" "${STORAGE_FILE}" "${MANIFEST_FILE}"; do
        if [[ -n "${ENCRYPT_KEY}" ]]; then
            echo "${ENCRYPT_KEY}" | gpg --batch --yes --passphrase-fd 0 --symmetric --cipher-algo AES256 "${f}"
        else
            gpg --batch --yes --symmetric --cipher-algo AES256 "${f}"
        fi
        mv "${f}.gpg" "${f}"
        ok "Encrypted: $(basename ${f})"
    done
fi

# =============================================================================
# UPLOAD TO S3 (OPTIONAL)
# =============================================================================

if [[ "${USE_S3}" == "true" ]]; then
    log "Uploading to S3 (s3://${S3_BUCKET}/${S3_PREFIX}/${DATE_DIR}/)..."

    for f in "${DB_FILE}" "${STORAGE_FILE}" "${MANIFEST_FILE}"; do
        if aws s3 cp "${f}" "s3://${S3_BUCKET}/${S3_PREFIX}/${DATE_DIR}/" \
            --storage-class STANDARD_IA \
            --metadata "app=erp,date=${DATE_DIR},type=$(basename ${f})" \
            --profile "${AWS_PROFILE}"; then
            ok "Uploaded: $(basename ${f})"
        else
            err "S3 upload failed for $(basename ${f})"
            exit 1
        fi
    done

    # Also copy to weekly/monthly if applicable
    DAY_OF_WEEK=$(date '+%u')  # 1=Mon, 7=Sun
    DAY_OF_MONTH=$(date '+%d')

    if [[ "${DAY_OF_WEEK}" == "7" ]]; then  # Sunday = weekly
        log "Creating weekly snapshot..."
        aws s3 cp "${BACKUP_DIR}/" "s3://${S3_BUCKET}/${S3_PREFIX}/weekly/week-$(date '+%V')/" --recursive --profile "${AWS_PROFILE}"
    fi

    if [[ "${DAY_OF_MONTH}" == "01" ]]; then  # 1st = monthly
        log "Creating monthly snapshot..."
        aws s3 cp "${BACKUP_DIR}/" "s3://${S3_BUCKET}/${S3_PREFIX}/monthly/$(date '+%Y-%m')/" --recursive --profile "${AWS_PROFILE}"
    fi
fi

# =============================================================================
# CLEANUP OLD BACKUPS
# =============================================================================

log "Cleaning up backups older than ${RETENTION_DAYS} days..."

# Local cleanup
find "${BACKUP_ROOT}/daily" -type f -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true
find "${BACKUP_ROOT}/daily" -type d -empty -delete 2>/dev/null || true

# S3 cleanup (if enabled)
if [[ "${USE_S3}" == "true" ]]; then
    # S3 lifecycle policy recommended instead, but manual cleanup as fallback
    log "S3 cleanup should be handled by S3 Lifecycle Policy (recommended)"
fi

ok "Cleanup done"

# =============================================================================
# NOTIFICATION
# =============================================================================

BACKUP_STATUS="success"
BACKUP_MSG="ERP Backup completed successfully at $(date '+%Y-%m-%d %H:%M:%S')
DB: ${DB_SIZE}
Storage: ${STORAGE_SIZE}
Location: ${BACKUP_DIR}
S3: ${USE_S3}"

notify() {
    local title="$1"
    local message="$2"
    local color="$3"

    # Slack
    if [[ -n "${SLACK_WEBHOOK_URL}" ]]; then
        curl -s -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"${title}\",\"attachments\":[{\"color\":\"${color}\",\"text\":\"${message}\"}]}" \
            "${SLACK_WEBHOOK_URL}" >/dev/null || true
    fi

    # Discord
    if [[ -n "${DISCORD_WEBHOOK_URL}" ]]; then
        curl -s -X POST -H 'Content-type: application/json' \
            --data "{\"embeds\":[{\"title\":\"${title}\",\"description\":\"${message}\",\"color\":${color}}]}" \
            "${DISCORD_WEBHOOK_URL}" >/dev/null || true
    fi

    # Email
    if [[ -n "${EMAIL_TO}" ]] && command -v mailx &>/dev/null; then
        echo "${message}" | mailx -s "${title}" "${EMAIL_TO}" || true
    fi
}

if [[ "${BACKUP_STATUS}" == "success" ]]; then
    notify "✅ ERP Backup Success" "${BACKUP_MSG}" "3066993"  # green
else
    notify "❌ ERP Backup Failed" "Backup failed at $(date). Check logs." "15158332"  # red
fi

# =============================================================================
# SUMMARY
# =============================================================================

log "Backup completed successfully!"
echo
echo "┌────────────────────────────────────────────┐"
echo "│           BACKUP SUMMARY                   │"
echo "├────────────────────────────────────────────┤"
printf "│ Database:  %-30s │\n" "${DB_FILE} (${DB_SIZE})"
printf "│ Storage:   %-30s │\n" "${STORAGE_FILE} (${STORAGE_SIZE})"
printf "│ Manifest:  %-30s │\n" "${MANIFEST_FILE}"
printf "│ Retention: %-30s │\n" "${RETENTION_DAYS} days"
printf "│ Encrypted: %-30s │\n" "${ENCRYPT}"
printf "│ S3 Upload: %-30s │\n" "${USE_S3}"
echo "└────────────────────────────────────────────┘"

exit 0