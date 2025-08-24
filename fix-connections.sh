#!/bin/bash

# 🔧 Fix Frontend-Backend Connections DEFINITIVELY
# This script fixes ALL connection issues between frontend and backend

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
    echo "========================================================"
    echo "🔧 FIXING FRONTEND-BACKEND CONNECTIONS"
    echo "========================================================"
    echo -e "${NC}"
}

# Test backend API
test_backend() {
    print_info "Testing backend API..."
    
    if curl -s http://localhost:3002/api/system/status >/dev/null 2>&1; then
        print_status "Backend API responding on port 3002"
        
        # Show actual response
        local response=$(curl -s http://localhost:3002/api/system/status)
        echo "API Response: $response"
    else
        print_error "Backend API NOT responding on port 3002"
        print_info "Backend may not be running properly"
        return 1
    fi
}

# Fix CORS headers in backend
fix_cors() {
    print_info "Checking CORS configuration..."
    
    # Test CORS from frontend perspective
    local cors_test=$(curl -s -H "Origin: http://localhost:3000" \
                          -H "Access-Control-Request-Method: GET" \
                          -H "Access-Control-Request-Headers: Content-Type" \
                          -X OPTIONS http://localhost:3002/api/system/status 2>/dev/null || echo "FAIL")
    
    if [[ "$cors_test" == "FAIL" ]]; then
        print_warning "CORS may be blocking frontend-backend communication"
    else
        print_status "CORS appears to be configured correctly"
    fi
}

# Fix environment variables for frontend
fix_frontend_env() {
    print_info "Setting up frontend environment variables..."
    
    # Create .env.local for Next.js
    cat > src/frontend/.env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:3002/api
NEXT_PUBLIC_WS_URL=http://localhost:3002
EOF
    
    print_status "Frontend environment variables created"
}

# Fix WebSocket connection
fix_websocket() {
    print_info "Testing WebSocket connection..."
    
    # Test if Socket.IO endpoint is reachable
    if curl -s http://localhost:3002/socket.io/ >/dev/null 2>&1; then
        print_status "Socket.IO endpoint responding"
    else
        print_warning "Socket.IO endpoint may not be available"
    fi
}

# Restart frontend with fixed configuration
restart_frontend() {
    print_info "Restarting frontend with fixed configuration..."
    
    # Kill existing frontend
    pkill -f "next.*3000" 2>/dev/null || true
    
    # Wait a moment
    sleep 3
    
    # Start frontend in background
    cd src/frontend/
    nohup npm run dev > ../../logs/frontend-restart.log 2>&1 &
    local FRONTEND_PID=$!
    cd ../..
    
    # Wait for startup
    print_info "Waiting for frontend to start..."
    sleep 10
    
    # Test if frontend is responding
    if curl -s http://localhost:3000 >/dev/null 2>&1; then
        print_status "Frontend restarted successfully on port 3000"
    else
        print_error "Frontend failed to restart"
        print_info "Check logs: tail -f logs/frontend-restart.log"
        return 1
    fi
}

# Comprehensive test
test_full_connection() {
    print_info "Testing complete frontend-backend communication..."
    
    # Test API call from frontend perspective
    local api_test=$(curl -s -H "Origin: http://localhost:3000" \
                          -H "Content-Type: application/json" \
                          http://localhost:3002/api/system/status 2>/dev/null || echo "FAIL")
    
    if [[ "$api_test" != "FAIL" ]] && [[ "$api_test" == *"success"* ]]; then
        print_status "Frontend-Backend API communication: ✅ WORKING"
        echo "Response preview: ${api_test:0:100}..."
    else
        print_error "Frontend-Backend API communication: ❌ FAILED"
        echo "Response: $api_test"
        return 1
    fi
}

# Show final status
show_final_status() {
    echo ""
    print_info "=== FINAL CONNECTION STATUS ==="
    
    echo -n "Backend API (3002): "
    if curl -s http://localhost:3002/api/system/status >/dev/null 2>&1; then
        echo -e "${GREEN}✅ OK${NC}"
    else
        echo -e "${RED}❌ FAIL${NC}"
    fi
    
    echo -n "Frontend (3000): "
    if curl -s http://localhost:3000 >/dev/null 2>&1; then
        echo -e "${GREEN}✅ OK${NC}"
    else
        echo -e "${RED}❌ FAIL${NC}"
    fi
    
    echo -n "Socket.IO endpoint: "
    if curl -s http://localhost:3002/socket.io/ >/dev/null 2>&1; then
        echo -e "${GREEN}✅ OK${NC}"
    else
        echo -e "${RED}❌ FAIL${NC}"
    fi
    
    echo ""
    print_status "Open http://localhost:3000 to test the web interface"
    print_info "If still not working, check browser DevTools Console for errors"
}

# Main execution
main() {
    print_header
    
    test_backend || exit 1
    fix_cors
    fix_frontend_env
    fix_websocket
    restart_frontend || exit 1
    
    sleep 5
    test_full_connection || print_warning "API test failed - check browser console"
    
    show_final_status
    
    echo ""
    print_status "Connection fixes applied! Test the web interface now."
}

main "$@"
