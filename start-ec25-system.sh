#!/bin/bash

# 🚀 EC25-EUX System Quick Start Script
# Jeden skrypt = gotowy system działający!
#
# Użycie:
#   ./start-ec25-system.sh           # Uruchom w trybie development
#   ./start-ec25-system.sh prod      # Uruchom w trybie production

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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
    echo "=================================================="
    echo "🚀 EC25-EUX Multi-Modem Management System"
    echo "=================================================="
    echo -e "${NC}"
}

# Check if running as root (required for hardware access)
check_permissions() {
    if [[ $EUID -ne 0 ]]; then
        print_error "Ten skrypt musi być uruchamiany jako root (sudo)"
        print_info "Użyj: sudo ./start-ec25-system.sh"
        exit 1
    fi
}

# Check if we're in the right directory
check_directory() {
    if [[ ! -f "src/modem-system.js" ]]; then
        print_error "Nieprawidłowy katalog! Uruchom skrypt z głównego katalogu EC25-EUX"
        print_info "Użyj: cd /path/to/EC25-EUX && sudo ./start-ec25-system.sh"
        exit 1
    fi
}

# Check and install dependencies
check_dependencies() {
    print_info "Sprawdzam zależności systemowe..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js nie jest zainstalowany!"
        print_info "Uruchom: sudo ./scripts/install-auto-system.sh"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm nie jest zainstalowany!"
        exit 1
    fi
    
    # Check if in src directory for npm commands
    if [[ ! -f "src/package.json" ]]; then
        print_error "Brak pliku package.json w katalogu src/"
        exit 1
    fi
    
    print_status "Zależności systemowe OK"
}

# Install npm dependencies if needed
install_npm_deps() {
    print_info "Sprawdzam zależności Node.js..."
    
    cd src/
    
    # Backend dependencies
    if [[ ! -d "node_modules" ]]; then
        print_info "Instaluję zależności backend..."
        npm install
        print_status "Zależności backend zainstalowane"
    fi
    
    # Frontend dependencies
    if [[ ! -d "frontend/node_modules" ]]; then
        print_info "Instaluję zależności frontend..."
        cd frontend/
        npm install
        cd ..
        print_status "Zależności frontend zainstalowane"
    fi
    
    cd ..
    print_status "Wszystkie zależności npm OK"
}

# Kill any existing processes on our ports
cleanup_ports() {
    print_info "Sprzątam porty (3000, 3002)..."
    
    # Kill processes on port 3000 (frontend)
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_warning "Zabijam procesy na porcie 3000..."
        lsof -Pi :3000 -sTCP:LISTEN -t | xargs kill -9 2>/dev/null || true
    fi
    
    # Kill processes on port 3002 (backend)
    if lsof -Pi :3002 -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_warning "Zabijam procesy na porcie 3002..."
        lsof -Pi :3002 -sTCP:LISTEN -t | xargs kill -9 2>/dev/null || true
    fi
    
    sleep 2
    print_status "Porty wyczyszczone"
}

# Check hardware (modems)
check_hardware() {
    print_info "Sprawdzam hardware (modemy EC25-EUX)..."
    
    local modem_count=$(lsusb | grep -c "2c7c:0125" || echo "0")
    
    if [[ $modem_count -eq 0 ]]; then
        print_warning "Nie wykryto modemów EC25-EUX (2c7c:0125)"
        print_info "System uruchomi się, ale bez aktywnych modemów"
    else
        print_status "Wykryto $modem_count modem(ów) EC25-EUX"
    fi
    
    # Check USB serial ports
    local usb_ports=$(ls /dev/ttyUSB* 2>/dev/null | wc -l || echo "0")
    if [[ $usb_ports -gt 0 ]]; then
        print_status "Dostępne porty USB serial: $usb_ports"
    fi
    
    # Check QMI devices
    local qmi_devices=$(ls /dev/cdc-wdm* 2>/dev/null | wc -l || echo "0")
    if [[ $qmi_devices -gt 0 ]]; then
        print_status "Dostępne urządzenia QMI: $qmi_devices"
    fi
}

# Start backend
start_backend() {
    print_info "Uruchamiam backend (port 3002)..."
    
    cd src/
    
    if [[ "$1" == "prod" ]]; then
        # Production mode
        print_info "Tryb: Production"
        nohup node modem-system.js auto-start > ../logs/backend.log 2>&1 &
        BACKEND_PID=$!
        echo $BACKEND_PID > ../logs/backend.pid
    else
        # Development mode with auto-restart
        print_info "Tryb: Development (z auto-restart)"
        nohup npm run dev > ../logs/backend.log 2>&1 &
        BACKEND_PID=$!
        echo $BACKEND_PID > ../logs/backend.pid
    fi
    
    cd ..
    
    # Wait a bit for backend to start
    sleep 5
    
    # Check if backend is running
    if kill -0 $BACKEND_PID 2>/dev/null; then
        print_status "Backend uruchomiony (PID: $BACKEND_PID)"
    else
        print_error "Backend nie mógł zostać uruchomiony!"
        print_info "Sprawdź logi: tail -f logs/backend.log"
        exit 1
    fi
}

# Start frontend
start_frontend() {
    print_info "Uruchamiam frontend (port 3000)..."
    
    cd src/frontend/
    
    if [[ "$1" == "prod" ]]; then
        # Production mode - build and start
        print_info "Buduję frontend dla produkcji..."
        npm run build
        nohup npm start > ../../logs/frontend.log 2>&1 &
        FRONTEND_PID=$!
        echo $FRONTEND_PID > ../../logs/frontend.pid
    else
        # Development mode
        nohup npm run dev > ../../logs/frontend.log 2>&1 &
        FRONTEND_PID=$!
        echo $FRONTEND_PID > ../../logs/frontend.pid
    fi
    
    cd ../..
    
    # Wait a bit for frontend to start
    sleep 10
    
    # Check if frontend is running
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        print_status "Frontend uruchomiony (PID: $FRONTEND_PID)"
    else
        print_error "Frontend nie mógł zostać uruchomiony!"
        print_info "Sprawdź logi: tail -f logs/frontend.log"
        exit 1
    fi
}

# Test system
test_system() {
    print_info "Testuję system..."
    
    # Test backend API
    sleep 5
    if curl -s http://localhost:3002/api/system/status > /dev/null; then
        print_status "Backend API responds OK"
    else
        print_warning "Backend API nie odpowiada (może jeszcze się uruchamiać)"
    fi
    
    # Test frontend
    if curl -s http://localhost:3000 > /dev/null; then
        print_status "Frontend responds OK"
    else
        print_warning "Frontend nie odpowiada (może jeszcze się uruchamiać)"
    fi
}

# Print final instructions
print_final_info() {
    echo -e "${GREEN}"
    echo "=================================================="
    echo "🎉 SYSTEM EC25-EUX URUCHOMIONY POMYŚLNIE!"
    echo "=================================================="
    echo -e "${NC}"
    
    echo -e "${BLUE}🌐 Dostęp do systemu:${NC}"
    echo "  • Web Interface:    http://localhost:3000"
    echo "  • Backend API:      http://localhost:3002/api"
    echo "  • Modemy API:       http://localhost:3002/api/modems"
    echo "  • Status systemu:   http://localhost:3002/api/system/status"
    echo ""
    
    echo -e "${BLUE}📊 Monitoring:${NC}"
    echo "  • Backend logi:     tail -f logs/backend.log"
    echo "  • Frontend logi:    tail -f logs/frontend.log"
    echo "  • System status:    curl http://localhost:3002/api/system/status"
    echo ""
    
    echo -e "${BLUE}🛑 Zatrzymanie systemu:${NC}"
    echo "  • Zabij backend:    kill \$(cat logs/backend.pid) 2>/dev/null || true"
    echo "  • Zabij frontend:   kill \$(cat logs/frontend.pid) 2>/dev/null || true"
    echo "  • Lub użyj:         ./stop-ec25-system.sh"
    echo ""
    
    echo -e "${YELLOW}⚠️  Pierwszy uruchomienie może potrwać 1-2 minuty!${NC}"
    echo -e "${GREEN}🚀 System gotowy do pracy!${NC}"
}

# Create logs directory
setup_logs() {
    mkdir -p logs
    touch logs/backend.log logs/frontend.log
}

# Main execution
main() {
    local mode=${1:-dev}
    
    print_header
    
    print_info "Tryb uruchomienia: $mode"
    echo ""
    
    check_permissions
    check_directory
    setup_logs
    check_dependencies
    install_npm_deps
    cleanup_ports
    check_hardware
    
    echo ""
    print_info "Uruchamiam system..."
    
    start_backend $mode
    start_frontend $mode
    
    test_system
    
    echo ""
    print_final_info
}

# Script entry point
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
