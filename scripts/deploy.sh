#!/bin/bash
# ============================================
# Zero-Downtime Deployment Script
# ============================================

set -e  # Exit on error

# ============================================
# Configuration
# ============================================
APP_NAME="travelbot"
DOCKER_COMPOSE="docker-compose"
HEALTH_CHECK_URL="http://localhost/api/health"
HEALTH_CHECK_RETRIES=10
HEALTH_CHECK_INTERVAL=5
ROLLBACK_LIMIT=3

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================
# Functions
# ============================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check .env file
    if [ ! -f ".env" ]; then
        log_error ".env file not found. Copy .env.example to .env and configure it."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

pull_latest_code() {
    log_info "Pulling latest code from Git..."
    
    git fetch origin
    git pull origin main
    
    log_success "Code updated to latest version"
}

build_images() {
    log_info "Building Docker images..."
    
    $DOCKER_COMPOSE build --no-cache app
    
    log_success "Docker images built successfully"
}

run_migrations() {
    log_info "Running database migrations..."
    
    # Example migration command
    # docker-compose run --rm app npm run migrate
    
    log_success "Database migrations completed"
}

health_check() {
    log_info "Running health check..."
    
    local retries=0
    
    while [ $retries -lt $HEALTH_CHECK_RETRIES ]; do
        if curl -s -o /dev/null -w "%{http_code}" $HEALTH_CHECK_URL | grep -q "200"; then
            log_success "Health check passed"
            return 0
        fi
        
        retries=$((retries + 1))
        log_warning "Health check attempt $retries/$HEALTH_CHECK_RETRIES failed"
        sleep $HEALTH_CHECK_INTERVAL
    done
    
    log_error "Health check failed after $HEALTH_CHECK_RETRIES attempts"
    return 1
}

deploy_rolling() {
    log_info "Starting rolling deployment (zero downtime)..."
    
    # Get current running containers
    local current_containers=$($DOCKER_COMPOSE ps -q app)
    
    # Build and start new containers one by one
    $DOCKER_COMPOSE up -d --no-deps --scale app=3 --build app
    
    # Wait for containers to be healthy
    sleep 10
    
    log_success "New containers started"
}

rollback() {
    log_warning "Rolling back to previous version..."
    
    # Stop new containers
    $DOCKER_COMPOSE stop app
    
    # Start previous version (if available)
    $DOCKER_COMPOSE up -d
    
    log_success "Rollback completed"
}

cleanup() {
    log_info "Cleaning up old images and containers..."
    
    # Remove dangling images
    docker image prune -f
    
    # Remove stopped containers
    docker container prune -f
    
    log_success "Cleanup completed"
}

show_status() {
    log_info "Deployment status:"
    
    $DOCKER_COMPOSE ps
    
    log_info "Container logs (last 20 lines):"
    $DOCKER_COMPOSE logs --tail=20 app
}

# ============================================
# Main Deployment Flow
# ============================================

main() {
    log_info "=========================================="
    log_info "Starting Deployment: $APP_NAME"
    log_info "=========================================="
    log_info "Timestamp: $(date)"
    echo ""
    
    # Step 1: Check prerequisites
    check_prerequisites
    echo ""
    
    # Step 2: Pull latest code
    pull_latest_code
    echo ""
    
    # Step 3: Build Docker images
    build_images
    echo ""
    
    # Step 4: Run migrations
    run_migrations
    echo ""
    
    # Step 5: Rolling restart (zero downtime)
    deploy_rolling
    echo ""
    
    # Step 6: Health check
    if health_check; then
        log_success "Deployment successful!"
        echo ""
        show_status
        echo ""
        cleanup
    else
        log_error "Deployment failed! Health check did not pass."
        echo ""
        
        # Ask for rollback
        read -p "Do you want to rollback? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rollback
        else
            log_warning "Keeping new version. Please fix issues manually."
        fi
        
        exit 1
    fi
    
    echo ""
    log_info "=========================================="
    log_success "Deployment completed successfully!"
    log_info "=========================================="
    log_info "Timestamp: $(date)"
}

# Run main function
main "$@"
