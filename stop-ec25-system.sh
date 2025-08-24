#!/bin/bash

# 🛑 EC25-EUX System Stop Script
# Bezpiecznie zatrzymaj cały system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_header() {
    echo -e "${BLUE}"
    echo "========================================"
    echo "🛑 Zatrzymuję EC25-EUX System"
    echo "========================================"
    echo -e "${NC}"
}

# Kill processes by PID files
kill_by_pid() {
    local service=$1
    local pid_file="logs/${service}.pid"
    
    if [[ -f "$pid_file" ]]; then
        local pid=$(cat "$pid_file")
        if kill -0 $pid 2>/dev/null; then
            print_info "Zatrzymuję $service (PID: $pid)..."
            kill $pid
            sleep 2
            
            # Force kill if still running
            if kill -0 $pid 2>/dev/null; then
                print_warning "Wymuszam zatrzymanie $service..."
                kill -9 $pid 2>/dev/null || true
            fi
            
            print_status "$service zatrzymany"
        else
            print_warning "$service już nie działa (PID: $pid)"
        fi
        rm -f "$pid_file"
    else
        print_warning "Brak pliku PID dla $service"
    fi
}

# Kill processes by port
kill_by_port() {
    local port=$1
    local service=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_info "Zatrzymuję procesy na porcie $port ($service)..."
        lsof -Pi :$port -sTCP:LISTEN -t | xargs kill -9 2>/dev/null || true
        sleep 1
        print_status "Procesy na porcie $port zatrzymane"
    else
        print_info "Brak procesów na porcie $port ($service)"
    fi
}

main() {
    print_header
    
    # Try to kill by PID first (graceful)
    print_info "Próbuję graceful shutdown..."
    kill_by_pid "frontend"
    kill_by_pid "backend"
    
    # Then kill by port (force)
    print_info "Sprawdzam porty..."
    kill_by_port "3000" "frontend"
    kill_by_port "3002" "backend"
    
    # Kill any remaining node processes related to our project
    print_info "Sprzątam pozostałe procesy..."
    pkill -f "modem-system.js" 2>/dev/null || true
    pkill -f "next-server" 2>/dev/null || true
    pkill -f "npm run" 2>/dev/null || true
    
    sleep 2
    
    echo ""
    print_status "System EC25-EUX zatrzymany"
    
    # Show final status
    echo ""
    print_info "Status portów:"
    if lsof -Pi :3000 -sTCP:LISTEN >/dev/null 2>&1; then
        print_warning "Port 3000 nadal zajęty"
    else
        print_status "Port 3000 wolny"
    fi
    
    if lsof -Pi :3002 -sTCP:LISTEN >/dev/null 2>&1; then
        print_warning "Port 3002 nadal zajęty"
    else
        print_status "Port 3002 wolny"
    fi
    
    echo ""
    print_info "Aby uruchomić ponownie: sudo ./start-ec25-system.sh"
}

main "$@"
