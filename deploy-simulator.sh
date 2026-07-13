#!/usr/bin/env bash
# ==============================================================================
# Laravel ERP Konstruksi - Production Deployment Simulator
# ==============================================================================
# Simulates a full production deployment for Laravel 11 + React/Inertia
# on Ubuntu 22.04/24.04 with PHP 8.3+, MySQL 8.0, Redis, Nginx
# ==============================================================================
# Usage: ./deploy-simulator.sh [--dry-run] [--skip-assets] [--skip-tests]
# ==============================================================================

set -euo pipefail

# ==============================================================================
# CONFIGURATION & CONSTANTS
# ==============================================================================

SCRIPT_NAME="deploy-simulator.sh"
SCRIPT_VERSION="1.0.0"
DEPLOY_TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
DRY_RUN=false
SKIP_ASSETS=false
SKIP_TESTS=false
VERBOSE=false

# Parse arguments
for arg in "$@"; do
    case $arg in
        --dry-run) DRY_RUN=true ;;
        --skip-assets) SKIP_ASSETS=true ;;
        --skip-tests) SKIP_TESTS=true ;;
        --verbose) VERBOSE=true ;;
        --help|-h)
            echo "Usage: $0 [--dry-run] [--skip-assets] [--skip-tests] [--verbose]"
            exit 0
            ;;
        *) echo "Unknown option: $arg"; exit 1 ;;
    esac
done

# ==============================================================================
# COLORS & OUTPUT
# ==============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
BOLD='\033[1m'
NC='\033[0m'

# Report data
DEPLOY_REPORT_FILE="deploy-report-${DEPLOY_TIMESTAMP}.json"
REPORT_JSON="{}"
ERRORS=()
WARNINGS=()
STEPS=()
declare -A STEP_TIMINGS
START_TIME=$(date +%s)

# ==============================================================================
# UTILITY FUNCTIONS
# ==============================================================================

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local color="" prefix=""

    case "$level" in
        INFO)  color="$BLUE";    prefix="ℹ" ;;
        OK)    color="$GREEN";   prefix="✓" ;;
        WARN)  color="$YELLOW";  prefix="⚠" ;;
        ERROR) color="$RED";     prefix="✗" ;;
        STEP)  color="$MAGENTA"; prefix="▶" ;;
        TIME)  color="$CYAN";    prefix="⏱" ;;
        *)     color="$WHITE";   prefix="●" ;;
    esac

    echo -e "${color}${prefix} ${timestamp} ${message}${NC}"

    # Update report
    case "$level" in
        ERROR) ERRORS+=("$message") ;;
        WARN)  WARNINGS+=("$message") ;;
    esac
}

log_step() {
    local step_name="$1"
    STEPS+=("$step_name")
    STEP_TIMINGS["${step_name}_start"]=$(date +%s.%N)
    log "STEP" "${BOLD}Step: ${step_name}${NC}"
}

log_step_done() {
    local step_name="$1"
    local start="${STEP_TIMINGS[${step_name}_start]}"
    local end=$(date +%s.%N)
    local duration=$(echo "$end - $start" | bc -l 2>/dev/null || echo "0")
    STEP_TIMINGS["${step_name}_duration"]=$duration
    log "TIME" "Step '$step_name' completed in ${duration}s"
}

run_cmd() {
    local cmd="$1"
    local description="${2:-Executing command}"

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "[DRY-RUN] $description"
        log "INFO" "[DRY-RUN] $ $cmd"
        return 0
    fi

    log "INFO" "$description"
    if [[ "$VERBOSE" == "true" ]]; then
        log "INFO" "$ $cmd"
    fi

    local start=$(date +%s.%N)
    if eval "$cmd"; then
        local end=$(date +%s.%N)
        local duration=$(echo "$end - $start" | bc -l 2>/dev/null || echo "0")
        log "OK" "$description completed in ${duration}s"
        return 0
    else
        local end=$(date +%s.%N)
        local duration=$(echo "$end - $start" | bc -l 2>/dev/null || echo "0")
        log "ERROR" "$description failed after ${duration}s"
        return 1
    fi
}

generate_report() {
    local end_time=$(date +%s)
    local total_duration=$((end_time - START_TIME))

    # Build JSON report
    local steps_json=""
    for step in "${STEPS[@]}"; do
        local dur="${STEP_TIMINGS[${step}_duration]:-0}"
        steps_json="${steps_json}{\"name\":\"${step}\",\"duration\":${dur}},"
    done
    steps_json="[${steps_json%,}]"

    local errors_json=""
    for err in "${ERRORS[@]}"; do
        errors_json="${errors_json}\"${err}\","
    done
    errors_json="[${errors_json%,}]"

    local warnings_json=""
    for warn in "${WARNINGS[@]}"; do
        warnings_json="${warnings_json}\"${warn}\","
    done
    warnings_json="[${warnings_json%,}]"

    cat > "$DEPLOY_REPORT_FILE" <<EOF
{
  "deployment": {
    "timestamp": "$(date -Iseconds)",
    "project": "ERP Konstruksi",
    "version": "1.0.0",
    "environment": "production",
    "dry_run": $DRY_RUN,
    "total_duration_seconds": $total_duration,
    "status": "$( [[ ${#ERRORS[@]} -eq 0 ]] && echo "success" || echo "failed" )"
  },
  "steps": $steps_json,
  "errors": $errors_json,
  "warnings": $warnings_json,
  "summary": {
    "total_steps": ${#STEPS[@]},
    "errors": ${#ERRORS[@]},
    "warnings": ${#WARNINGS[@]}
  }
}
EOF

    log "INFO" "Deployment report saved to: $DEPLOY_REPORT_FILE"
    cat "$DEPLOY_REPORT_FILE" | python3 -m json.tool 2>/dev/null || cat "$DEPLOY_REPORT_FILE"
}

# ==============================================================================
# MAIN DEPLOYMENT STEPS
# ==============================================================================

main() {
    log "INFO" "========================================"
    log "INFO" "ERP Konstruksi - Deployment Simulator"
    log "INFO" "Version: $SCRIPT_VERSION | Timestamp: $DEPLOY_TIMESTAMP"
    log "INFO" "Dry-run: $DRY_RUN | Skip assets: $SKIP_ASSETS | Skip tests: $SKIP_TESTS"
    log "INFO" "========================================"

    # Step 1: System Requirements Check
    log_step "System Requirements Check"
    run_cmd "php --version" "Check PHP version"
    run_cmd "php -m | grep -E 'mbstring|dom|pdo_mysql|redis|gd|zip|bcmath|intl|fileinfo|xml|curl|openssl'" "Check required PHP extensions"
    run_cmd "composer --version" "Check Composer"
    run_cmd "node --version && npm --version" "Check Node.js & npm"
    run_cmd "nginx -v" "Check Nginx"
    run_cmd "mysql --version" "Check MySQL"
    run_cmd "redis-cli --version" "Check Redis"
    run_cmd "supervisord -v" "Check Supervisor"
    log_step_done "System Requirements Check"

    # Step 2: Validate Critical Configs
    log_step "Validate Critical Configurations"
    if [[ -f ".env" ]]; then
        run_cmd "grep -q 'APP_DEBUG=false' .env" "Check APP_DEBUG=false"
        run_cmd "grep -q 'APP_ENV=production' .env" "Check APP_ENV=production"
        run_cmd "grep -q '^APP_KEY=' .env" "Check APP_KEY exists"
        run_cmd "grep -q '^DB_DATABASE=' .env" "Check DB_DATABASE set"
        run_cmd "grep -q '^REDIS_HOST=' .env" "Check REDIS_HOST set"
        run_cmd "grep -q '^MAIL_MAILER=' .env" "Check MAIL_MAILER set"
    else
        log "WARN" ".env file not found (expected in dry-run)"
    fi
    log_step_done "Validate Critical Configurations"

    # Step 3: Install Dependencies
    log_step "Install Dependencies"
    run_cmd "composer install --optimize-autoloader --no-dev --no-interaction" "Install PHP dependencies"
    if [[ "$SKIP_ASSETS" != "true" ]]; then
        run_cmd "npm ci" "Install Node dependencies"
        run_cmd "npm run build" "Build frontend assets"
    fi
    log_step_done "Install Dependencies"

    # Step 4: Database Migration
    log_step "Database Migration"
    run_cmd "php artisan migrate --force --no-interaction" "Run migrations"
    run_cmd "php artisan db:seed --force --no-interaction" "Run seeders (if any)"
    log_step_done "Database Migration"

    # Step 5: Laravel Optimization
    log_step "Laravel Optimization"
    run_cmd "php artisan config:cache" "Cache config"
    run_cmd "php artisan route:cache" "Cache routes"
    run_cmd "php artisan view:cache" "Cache views"
    run_cmd "php artisan event:cache" "Cache events"
    run_cmd "php artisan storage:link" "Create storage link"
    log_step_done "Laravel Optimization"

    # Step 6: Permissions
    log_step "Set Permissions"
    run_cmd "chown -R www-data:www-data storage bootstrap/cache" "Set ownership"
    run_cmd "chmod -R 775 storage bootstrap/cache" "Set permissions"
    log_step_done "Set Permissions"

    # Step 7: Service Management
    log_step "Service Management"
    run_cmd "supervisorctl reread && supervisorctl update" "Reload Supervisor"
    run_cmd "supervisorctl status" "Check Supervisor status"
    run_cmd "systemctl reload nginx" "Reload Nginx"
    run_cmd "systemctl reload php8.3-fpm" "Reload PHP-FPM"
    log_step_done "Service Management"

    # Step 8: Health Checks
    log_step "Health Checks"
    run_cmd "curl -f http://localhost/api/dashboard/executive 2>/dev/null | head -c 100" "Test dashboard API"
    run_cmd "redis-cli ping" "Test Redis connection"
    run_cmd "mysql -e 'SELECT 1'" "Test MySQL connection"
    run_cmd "php artisan queue:work --once --timeout=10 2>&1 | head -5" "Test queue worker"
    log_step_done "Health Checks"

    # Step 9: Run Tests
    if [[ "$SKIP_TESTS" != "true" ]]; then
        log_step "Run Test Suite"
        run_cmd "php artisan test --no-interaction" "Run PHPUnit tests"
        log_step_done "Run Test Suite"
    fi

    # Final Report
    log "INFO" "========================================"
    log "INFO" "Deployment Simulation Complete"
    log "INFO" "========================================"
    generate_report

    if [[ ${#ERRORS[@]} -gt 0 ]]; then
        log "ERROR" "Deployment completed with ${#ERRORS[@]} error(s)"
        exit 1
    else
        log "OK" "Deployment simulation successful!"
        exit 0
    fi
}

# ==============================================================================
# ENTRY POINT
# ==============================================================================

main "$@"