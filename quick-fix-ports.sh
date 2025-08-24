#!/bin/bash

# 🚀 Quick Fix for Port Conflicts and Startup Issues
# This script fixes common port conflicts and ensures clean startup

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
    echo "🔧 QUICK PORT FIX & CLEANUP"
    echo "========================================"
    echo -e "${NC}"
}

# Kill all Node.js processes
cleanup_node_processes() {
    print_info "Zabijam wszystkie procesy Node.js..."
    
    # Kill all node processes
    pkill -f "node" 2>/dev/null || true
    pkill -f "next" 2>/dev/null || true
    pkill -f "npm" 2>/dev/null || true
    
    sleep 2
    print_status "Procesy Node.js zakończone"
}

# Kill specific ports
cleanup_ports() {
    print_info "Sprzątam porty 3000, 3001, 3002..."
    
    for port in 3000 3001 3002; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            print_warning "Zabijam procesy na porcie $port..."
            lsof -Pi :$port -sTCP:LISTEN -t | xargs kill -9 2>/dev/null || true
        fi
    done
    
    sleep 2
    print_status "Porty wyczyszczone"
}

# Remove PID files
cleanup_pid_files() {
    print_info "Usuwam stare pliki PID..."
    
    rm -f logs/backend.pid logs/frontend.pid 2>/dev/null || true
    
    print_status "Pliki PID usunięte"
}

# Show port status
show_port_status() {
    print_info "Status portów:"
    
    for port in 3000 3001 3002; do
        if lsof -Pi :$port -sTCP:LISTEN >/dev/null 2>&1; then
            echo "  Port $port: ❌ ZAJĘTY"
        else
            echo "  Port $port: ✅ WOLNY"
        fi
    done
}

# Check if directories exist
check_directories() {
    print_info "Sprawdzam strukturę projektu..."
    
    if [[ ! -d "src" ]]; then
        print_error "Katalog src/ nie istnieje!"
        exit 1
    fi
    
    if [[ ! -d "src/frontend" ]]; then
        print_error "Katalog src/frontend/ nie istnieje!"
        exit 1
    fi
    
    if [[ ! -f "src/modem-system.js" ]]; then
        print_error "Plik src/modem-system.js nie istnieje!"
        exit 1
    fi
    
    print_status "Struktura projektu OK"
}

# Create logs directory
setup_logs() {
    print_info "Przygotowuję katalog logs..."
    
    mkdir -p logs
    touch logs/backend.log logs/frontend.log
    
    print_status "Katalog logs gotowy"
}

# Check Node.js dependencies
check_dependencies() {
    print_info "Sprawdzam zależności Node.js..."
    
    # Check backend dependencies
    if [[ ! -d "src/node_modules" ]]; then
        print_warning "Brak zależności backend - instaluję..."
        cd src/
        npm install
        cd ..
        print_status "Zależności backend zainstalowane"
    fi
    
    # Check frontend dependencies
    if [[ ! -d "src/frontend/node_modules" ]]; then
        print_warning "Brak zależności frontend - instaluję..."
        cd src/frontend/
        npm install
        cd ../..
        print_status "Zależności frontend zainstalowane"
    fi
    
    print_status "Wszystkie zależności OK"
}

# Main execution
main() {
    print_header
    
    check_directories
    cleanup_node_processes
    cleanup_ports
    cleanup_pid_files
    setup_logs
    check_dependencies
    
    echo ""
    show_port_status
    
    echo ""
    print_status "Wszystko naprawione! Możesz teraz uruchomić:"
    print_info "sudo ./start-ec25-system.sh"
    
    echo ""
    print_info "Lub sprawdź czy modemy są skonfigurowane:"
    print_info "sudo ./check-modem-mode.sh"
}

main "$@"
