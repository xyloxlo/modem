#!/bin/bash

# =============================================================================
# EC25-EUX Auto-Installation Script
# Automatically configures complete multi-modem system with systemd auto-start
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/home/server1/EC25-EUX"
SERVICE_USER="root"
SERVICE_NAME="ec25-eux"

echo -e "${BLUE}🚀 EC25-EUX Auto-Installation Starting...${NC}"
echo -e "${BLUE}===============================================${NC}"

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root (use sudo)"
        exit 1
    fi
    print_status "Running as root - OK"
}

# Function to verify Ubuntu version
check_ubuntu_version() {
    echo "🔍 Checking Ubuntu version..."
    
    if ! command -v lsb_release &> /dev/null; then
        print_error "lsb_release not found. Please install lsb-release package."
        exit 1
    fi
    
    UBUNTU_VERSION=$(lsb_release -rs)
    if [[ ! "$UBUNTU_VERSION" =~ ^24\.04 ]]; then
        print_warning "Ubuntu $UBUNTU_VERSION detected. Recommended: Ubuntu 24.04 LTS"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    print_status "Ubuntu $UBUNTU_VERSION - Compatible"
}

# Function to update system packages
update_system() {
    echo "📦 Updating system packages..."
    apt update -qq
    apt upgrade -y -qq
    print_status "System packages updated"
}

# Function to install Node.js
install_nodejs() {
    echo "🟢 Installing Node.js..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_status "Node.js already installed: $NODE_VERSION"
        return
    fi
    
    # Install Node.js 20 LTS
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
    
    NODE_VERSION=$(node --version)
    print_status "Node.js $NODE_VERSION installed"
}

# Function to install system dependencies
install_dependencies() {
    echo "📋 Installing system dependencies..."
    
    # Essential packages for EC25-EUX modems
    PACKAGES=(
        "postgresql"
        "postgresql-contrib"
        "minicom"
        "expect"
        "libqmi-glib5"
        "libqmi-utils"
        "setserial"
        "usbutils"
        "git"
        "curl"
        "wget"
        "build-essential"
    )
    
    for package in "${PACKAGES[@]}"; do
        if dpkg -l | grep -q "^ii  $package "; then
            echo "   ✅ $package already installed"
        else
            echo "   📦 Installing $package..."
            apt install -y "$package"
        fi
    done
    
    print_status "All dependencies installed"
}

# Function to configure PostgreSQL
configure_postgresql() {
    echo "🗄️  Configuring PostgreSQL..."
    
    # Start and enable PostgreSQL
    systemctl start postgresql
    systemctl enable postgresql
    
    # Wait for PostgreSQL to be ready
    sleep 3
    
    # Check if database exists
    if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw ec25_modems; then
        print_status "Database 'ec25_modems' already exists"
    else
        echo "   🔧 Creating database and user..."
        sudo -u postgres psql -c "CREATE DATABASE ec25_modems;"
        sudo -u postgres psql -c "CREATE USER modem_user WITH PASSWORD 'secure_password_123';"
        sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ec25_modems TO modem_user;"
        print_status "PostgreSQL configured"
    fi
}

# Function to install Node.js dependencies
install_npm_dependencies() {
    echo "📦 Installing Node.js dependencies..."
    
    cd "$PROJECT_DIR/src"
    
    if [[ ! -f "package.json" ]]; then
        print_error "package.json not found in $PROJECT_DIR/src"
        exit 1
    fi
    
    npm install
    print_status "Node.js dependencies installed"
}

# Function to install systemd service
install_systemd_service() {
    echo "⚙️  Installing systemd service..."
    
    # Copy service file
    if [[ -f "$PROJECT_DIR/ec25-eux.service" ]]; then
        cp "$PROJECT_DIR/ec25-eux.service" "/etc/systemd/system/"
        print_status "Service file copied"
    else
        print_error "Service file not found: $PROJECT_DIR/ec25-eux.service"
        exit 1
    fi
    
    # Reload systemd
    systemctl daemon-reload
    print_status "Systemd reloaded"
    
    # Enable service (but don't start yet)
    systemctl enable ec25-eux.service
    print_status "EC25-EUX service enabled for auto-start"
}

# Function to configure udev rules for stable device naming
configure_udev_rules() {
    echo "🔧 Configuring udev rules..."
    
    cat > /etc/udev/rules.d/99-ec25-modems.rule << 'EOF'
# EC25-EUX Modem udev rules
# Ensure stable device naming and permissions

# EC25-EUX USB modems (Vendor ID: 2c7c, Product ID: 0125)
SUBSYSTEM=="usb", ATTRS{idVendor}=="2c7c", ATTRS{idProduct}=="0125", MODE="0666", GROUP="dialout"

# Serial ports for modems
SUBSYSTEM=="tty", ATTRS{idVendor}=="2c7c", ATTRS{idProduct}=="0125", MODE="0666", GROUP="dialout"

# QMI devices for modems  
SUBSYSTEM=="usbmisc", ATTRS{idVendor}=="2c7c", ATTRS{idProduct}=="0125", MODE="0666", GROUP="dialout"
EOF
    
    # Reload udev rules
    udevadm control --reload-rules
    udevadm trigger
    
    print_status "Udev rules configured"
}

# Function to test system
test_system() {
    echo "🧪 Testing system configuration..."
    
    # Test Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js not found"
        return 1
    fi
    
    # Test PostgreSQL
    if ! systemctl is-active --quiet postgresql; then
        print_error "PostgreSQL not running"
        return 1
    fi
    
    # Test project directory
    if [[ ! -d "$PROJECT_DIR/src" ]]; then
        print_error "Project directory not found: $PROJECT_DIR/src"
        return 1
    fi
    
    # Test service file
    if [[ ! -f "/etc/systemd/system/ec25-eux.service" ]]; then
        print_error "Service file not installed"
        return 1
    fi
    
    print_status "All tests passed"
    return 0
}

# Function to display final instructions
show_final_instructions() {
    echo
    echo -e "${GREEN}🎉 EC25-EUX Auto-Installation Complete!${NC}"
    echo -e "${GREEN}======================================${NC}"
    echo
    echo -e "${BLUE}📋 System Status:${NC}"
    echo "   ✅ Ubuntu $(lsb_release -rs) configured"
    echo "   ✅ Node.js $(node --version) installed"
    echo "   ✅ PostgreSQL configured and running"
    echo "   ✅ System dependencies installed"
    echo "   ✅ Systemd service configured"
    echo "   ✅ Udev rules configured"
    echo
    echo -e "${BLUE}🚀 Usage:${NC}"
    echo
    echo -e "${YELLOW}Start EC25-EUX system manually:${NC}"
    echo "   sudo systemctl start ec25-eux"
    echo
    echo -e "${YELLOW}Check system status:${NC}"
    echo "   sudo systemctl status ec25-eux"
    echo
    echo -e "${YELLOW}View system logs:${NC}"
    echo "   sudo journalctl -u ec25-eux -f"
    echo
    echo -e "${YELLOW}Test modem detection:${NC}"
    echo "   cd $PROJECT_DIR/src && sudo node modem-detector.js"
    echo
    echo -e "${YELLOW}Access web interface:${NC}"
    echo "   http://localhost:3000"
    echo
    echo -e "${GREEN}🔄 Auto-start: System will automatically start on boot!${NC}"
    echo
    echo -e "${YELLOW}⚠️  Next steps:${NC}"
    echo "   1. Connect your EC25-EUX modems via USB"
    echo "   2. Start the service: sudo systemctl start ec25-eux"
    echo "   3. Check logs for successful modem detection"
    echo "   4. Access web interface for management"
    echo
}

# Main installation process
main() {
    echo "Starting EC25-EUX Auto-Installation..."
    echo "Project directory: $PROJECT_DIR"
    echo
    
    check_root
    check_ubuntu_version
    update_system
    install_nodejs
    install_dependencies
    configure_postgresql
    install_npm_dependencies
    configure_udev_rules
    install_systemd_service
    
    if test_system; then
        show_final_instructions
        exit 0
    else
        print_error "Installation completed with errors. Please check the output above."
        exit 1
    fi
}

# Run main function
main "$@"
