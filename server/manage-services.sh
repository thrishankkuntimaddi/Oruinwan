#!/bin/bash

# Oruniwan Microservices Management Script
# Simplifies managing individual Docker services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Service names
SERVICES=("databases" "cache" "server" "all")

# Helper functions
print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Show usage
show_usage() {
    echo "Oruniwan Microservices Management"
    echo ""
    echo "Usage: ./manage-services.sh <command> [options]"
    echo ""
    echo "Commands:"
    echo "  start [service]       Start services (databases, cache, server, or all)"
    echo "  stop [service]        Stop services"
    echo "  restart [service]     Restart services"
    echo "  logs [service]        View logs for a service"
    echo "  status                Show status of all services"
    echo "  build                 Build Docker images"
    echo "  clean                 Stop and remove volumes (WARNING: deletes data)"
    echo "  reset                 Full reset (remove images, volumes, containers)"
    echo "  health                Check health status of all services"
    echo "  ps                    Show running containers"
    echo ""
    echo "Examples:"
    echo "  ./manage-services.sh start all              # Start all services"
    echo "  ./manage-services.sh start databases        # Start only databases"
    echo "  ./manage-services.sh logs server -f         # Follow server logs"
    echo "  ./manage-services.sh stop cache             # Stop Redis cache"
    echo "  ./manage-services.sh status                 # Show service status"
    echo ""
}

# Check if .env file exists
check_env() {
    if [ ! -f .env ]; then
        print_warning ".env file not found"
        print_info "Creating .env from .env.docker.example..."
        cp .env.docker.example .env
        print_success ".env created - please update it with your values"
    fi
}

# Start services
start_service() {
    local service=$1

    check_env

    if [ "$service" = "all" ] || [ -z "$service" ]; then
        print_header "Starting All Microservices"
        docker-compose up -d
        print_success "All services started"
        sleep 2
        show_service_info
    else
        case $service in
            databases)
                print_header "Starting Database Services"
                docker-compose -f docker-compose.databases.yml up -d
                print_success "Database services started (PostgreSQL + MongoDB)"
                ;;
            cache)
                print_header "Starting Cache Service"
                docker-compose -f docker-compose.cache.yml up -d
                print_success "Cache service started (Redis)"
                ;;
            server)
                print_header "Starting Server"
                docker-compose -f docker-compose.server.yml up -d
                print_success "Server started on http://localhost:8080"
                ;;
            *)
                print_error "Unknown service: $service"
                echo "Available services: databases, cache, server, all"
                exit 1
                ;;
        esac
    fi
}

# Stop services
stop_service() {
    local service=$1

    if [ "$service" = "all" ] || [ -z "$service" ]; then
        print_header "Stopping All Services"
        docker-compose down
        print_success "All services stopped"
    else
        case $service in
            databases)
                print_header "Stopping Database Services"
                docker-compose -f docker-compose.databases.yml down
                print_success "Database services stopped"
                ;;
            cache)
                print_header "Stopping Cache Service"
                docker-compose -f docker-compose.cache.yml down
                print_success "Cache service stopped"
                ;;
            server)
                print_header "Stopping Server"
                docker-compose -f docker-compose.server.yml down
                print_success "Server stopped"
                ;;
            *)
                print_error "Unknown service: $service"
                exit 1
                ;;
        esac
    fi
}

# Restart services
restart_service() {
    local service=$1
    print_info "Restarting $service..."
    stop_service "$service"
    sleep 1
    start_service "$service"
    print_success "Service restarted"
}

# View logs
view_logs() {
    local service=$1
    shift
    local args=$@

    case $service in
        databases|cache|server)
            docker-compose logs "$service" $args
            ;;
        all|"")
            docker-compose logs $args
            ;;
        *)
            print_error "Unknown service: $service"
            exit 1
            ;;
    esac
}

# Show status
show_status() {
    print_header "Service Status"
    docker-compose ps
}

# Show service info
show_service_info() {
    echo ""
    print_header "Service Information"
    echo ""
    echo -e "${GREEN}API Server${NC}"
    echo "  URL: http://localhost:8080"
    echo "  Health: http://localhost:8080/api/health"
    echo ""
    echo -e "${GREEN}PostgreSQL${NC}"
    echo "  Host: localhost:5432"
    echo "  User: postgres"
    echo "  Database: oruniwan"
    echo ""
    echo -e "${GREEN}MongoDB${NC}"
    echo "  Host: localhost:27017"
    echo "  User: admin"
    echo "  Database: oruniwan"
    echo ""
    echo -e "${GREEN}Redis${NC}"
    echo "  Host: localhost:6379"
    echo ""
}

# Build images
build_images() {
    print_header "Building Docker Images"
    docker-compose build
    print_success "Images built"
}

# Check health
check_health() {
    print_header "Service Health Status"
    echo ""

    containers=$(docker-compose ps --services)

    for container in $containers; do
        if docker-compose ps "$container" 2>/dev/null | grep -q "healthy"; then
            print_success "$container is healthy"
        elif docker-compose ps "$container" 2>/dev/null | grep -q "unhealthy"; then
            print_error "$container is unhealthy"
        elif docker-compose ps "$container" 2>/dev/null | grep -q "Up"; then
            print_info "$container is running (no health check)"
        else
            print_error "$container is not running"
        fi
    done
    echo ""
}

# Show running containers
show_ps() {
    print_header "Running Containers"
    docker-compose ps
}

# Clean services
clean_services() {
    print_header "Cleaning Services"
    print_warning "This will stop all services and remove volumes (data will be lost)"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose down -v
        print_success "Services cleaned"
    else
        print_info "Clean cancelled"
    fi
}

# Reset everything
reset_services() {
    print_header "Full Reset"
    print_warning "This will remove all containers, images, and volumes"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose down -v
        docker-compose rmi
        print_success "Full reset completed"
    else
        print_info "Reset cancelled"
    fi
}

# Main script logic
main() {
    local command=$1
    shift

    case $command in
        start)
            start_service "$@"
            ;;
        stop)
            stop_service "$@"
            ;;
        restart)
            restart_service "$@"
            ;;
        logs)
            view_logs "$@"
            ;;
        status)
            show_status
            ;;
        build)
            build_images
            ;;
        health)
            check_health
            ;;
        ps)
            show_ps
            ;;
        clean)
            clean_services
            ;;
        reset)
            reset_services
            ;;
        info|--info|-i)
            show_service_info
            ;;
        help|--help|-h|"")
            show_usage
            ;;
        *)
            print_error "Unknown command: $command"
            echo ""
            show_usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
