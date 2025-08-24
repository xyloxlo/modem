#!/bin/bash
# 🎯 ULTIMATE DEPENDENCY INSTALLER
# Ubuntu 24.04.3 LTS Multi-Modem LTE Proxy System
# EC25-EUX Native Support + All Dependencies
# PRODUCTION READY - FIXED ALL PACKAGE ISSUES

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}===============================================${NC}"
echo -e "${BLUE}🎯 ULTIMATE DEPENDENCY INSTALLER${NC}"
echo -e "${BLUE}===============================================${NC}"
echo -e "${YELLOW}Ubuntu 24.04.3 LTS Multi-Modem LTE Proxy System${NC}"
echo -e "${YELLOW}EC25-EUX Native Support + All Dependencies${NC}"
echo ""

# System info
echo -e "${BLUE}📊 SYSTEM INFORMATION:${NC}"
echo "OS: $(lsb_release -d | cut -f2 2>/dev/null || echo 'Unknown')"
echo "Kernel: $(uname -r)"
echo "Architecture: $(dpkg --print-architecture 2>/dev/null || echo 'Unknown')"
echo "CPU Cores: $(nproc)"
echo "Memory: $(free -h | grep Mem | awk '{print $2}')"
echo ""

# Verify Ubuntu 24.04
if ! lsb_release -d | grep -q "24.04"; then
    echo -e "${RED}⚠️  WARNING: This script is optimized for Ubuntu 24.04.3 LTS${NC}"
    echo -e "${RED}   Your system: $(lsb_release -d | cut -f2)${NC}"
    echo -e "${YELLOW}   Continue anyway? (y/N)${NC}"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "Installation cancelled."
        exit 1
    fi
fi

# Installation mode selection
echo -e "${BLUE}🎯 SELECT INSTALLATION MODE:${NC}"
echo "1) Complete installation (recommended) - all packages"
echo "2) Minimal installation - only critical packages"
echo "3) Exit"
echo ""
read -p "Choose option (1-3): " choice

case $choice in
    1)
        INSTALL_MODE="complete"
        echo -e "${GREEN}✅ Complete installation selected${NC}"
        ;;
    2)
        INSTALL_MODE="minimal"
        echo -e "${GREEN}✅ Minimal installation selected${NC}"
        ;;
    3)
        echo "Installation cancelled."
        exit 0
        ;;
    *)
        echo -e "${RED}❌ Invalid choice. Exiting.${NC}"
        exit 1
        ;;
esac

echo ""

# Update system first
echo -e "${BLUE}🔄 UPDATING SYSTEM...${NC}"
sudo apt update && sudo apt upgrade -y

# Core system tools (always installed)
echo ""
echo -e "${BLUE}📦 INSTALLING CORE SYSTEM TOOLS...${NC}"
sudo apt install -y \
    curl \
    wget \
    git \
    vim \
    htop \
    build-essential \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    socat

# USB and hardware tools (always installed)
echo ""
echo -e "${BLUE}🔧 INSTALLING USB & HARDWARE TOOLS...${NC}"
sudo apt install -y \
    usbutils \
    pciutils \
    usb-modeswitch \
    usb-modeswitch-data \
    minicom \
    screen \
    expect \
    setserial

# ✅ CRITICAL FIX: Correct QMI packages for Ubuntu 24.04
echo ""
echo -e "${BLUE}📡 INSTALLING QMI & MODEM PACKAGES (Ubuntu 24.04 compatible)...${NC}"
sudo apt install -y \
    libqmi-utils \
    libqmi-glib5 \
    libqmi-proxy \
    modemmanager

# Network tools (always installed)
echo ""
echo -e "${BLUE}🌐 INSTALLING NETWORK TOOLS...${NC}"
sudo apt install -y \
    network-manager \
    iproute2 \
    iptables \
    iputils-ping

# Database basics (always installed)
echo ""
echo -e "${BLUE}🗄️ INSTALLING DATABASE BASICS...${NC}"
sudo apt install -y \
    postgresql \
    postgresql-contrib \
    postgresql-client

# Install Node.js LTS (always installed)
echo ""
echo -e "${BLUE}🚀 INSTALLING NODE.JS LTS...${NC}"
if ! command -v node &> /dev/null; then
    echo "Installing Node.js from NodeSource repository..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo "Node.js already installed: $(node --version)"
fi

# Install PM2 globally (always installed)
echo ""
echo -e "${BLUE}📦 INSTALLING PM2 PROCESS MANAGER...${NC}"
npm install -g pm2

# Complete installation additional packages
if [[ "$INSTALL_MODE" == "complete" ]]; then
    echo ""
    echo -e "${BLUE}📦 INSTALLING ADDITIONAL PACKAGES (Complete mode)...${NC}"
    
    # Development tools
    echo -e "${YELLOW}Installing development tools...${NC}"
    sudo apt install -y \
        iotop \
        ncdu \
        netcat-openbsd \
        unixodbc-dev
    
    # QMI development packages
    echo -e "${YELLOW}Installing QMI development packages...${NC}"
    sudo apt install -y \
        libqmi-glib-dev \
        gir1.2-qmi-1.0 \
        modemmanager-dev
    
    # Additional network tools
    echo -e "${YELLOW}Installing additional network tools...${NC}"
    sudo apt install -y \
        bridge-utils \
        nethogs \
        iftop \
        tcpdump \
        tshark
    
    # Security and SSL tools
    echo -e "${YELLOW}Installing security and SSL tools...${NC}"
    sudo apt install -y \
        openssl \
        certbot
    
    # Monitoring and debug tools
    echo -e "${YELLOW}Installing monitoring and debug tools...${NC}"
    sudo apt install -y \
        strace \
        lsof
    
    # Try to install kernel headers (may fail on some VMs)
    echo -e "${YELLOW}Installing kernel headers (may fail on custom kernels)...${NC}"
    sudo apt install -y linux-headers-$(uname -r) || {
        echo -e "${YELLOW}⚠️  Specific kernel headers failed, installing generic...${NC}"
        sudo apt install -y linux-headers-generic || echo -e "${RED}❌ Kernel headers installation failed${NC}"
    }
fi

# Create 3proxy directories
echo ""
echo -e "${BLUE}📁 CREATING 3PROXY DIRECTORIES...${NC}"
sudo mkdir -p /usr/local/3proxy/{sbin,bin}
sudo mkdir -p /usr/local/etc
sudo mkdir -p /var/log/3proxy

# Create proxy user
echo ""
echo -e "${BLUE}👤 CREATING PROXY USER...${NC}"
if ! id proxy &>/dev/null; then
    sudo useradd -r -s /bin/false -d /var/empty -c "3proxy service" proxy
    echo -e "${GREEN}✅ User 'proxy' created${NC}"
else
    echo -e "${GREEN}✅ User 'proxy' already exists${NC}"
fi

# Set permissions
sudo chown -R proxy:proxy /var/log/3proxy
sudo chmod 750 /var/log/3proxy

# Cleanup
echo ""
echo -e "${BLUE}🧹 CLEANING UP...${NC}"
sudo apt autoremove -y
sudo apt clean

echo ""
echo -e "${GREEN}===============================================${NC}"
echo -e "${GREEN}✅ INSTALLATION COMPLETE!${NC}"
echo -e "${GREEN}===============================================${NC}"

# Show installation summary
echo ""
echo -e "${BLUE}📊 INSTALLATION SUMMARY:${NC}"
echo "PostgreSQL: $(psql --version 2>/dev/null || echo 'Not in PATH')"
echo "Node.js: $(node --version 2>/dev/null || echo 'Failed')"
echo "NPM: $(npm --version 2>/dev/null || echo 'Failed')"
echo "PM2: $(pm2 --version 2>/dev/null || echo 'Failed')"
echo "QMI Tools: $(qmicli --version 2>/dev/null | head -1 || echo 'Not available')"
echo "ModemManager: $(mmcli --version 2>/dev/null || echo 'Not available')"

echo ""
echo -e "${BLUE}📁 CREATED DIRECTORIES:${NC}"
echo -e "${GREEN}✅ /usr/local/3proxy/sbin${NC}"
echo -e "${GREEN}✅ /usr/local/3proxy/bin${NC}"
echo -e "${GREEN}✅ /usr/local/etc${NC}"
echo -e "${GREEN}✅ /var/log/3proxy (proxy:proxy 750)${NC}"

echo ""
echo -e "${BLUE}👤 CREATED USERS:${NC}"
echo -e "${GREEN}✅ proxy (system user for 3proxy service)${NC}"

echo ""
echo -e "${BLUE}🔗 NEXT STEPS:${NC}"
echo "1. Install 3proxy (choose option):"
echo ""
echo -e "${YELLOW}   OPTION A - Binary package (FASTER):${NC}"
echo "   wget https://github.com/3proxy/3proxy/releases/download/0.9.4/3proxy-0.9.4.x86_64.deb"
echo "   sudo dpkg -i 3proxy-0.9.4.x86_64.deb"
echo ""
echo -e "${YELLOW}   OPTION B - Source compilation:${NC}"
echo "   wget https://github.com/z3APA3A/3proxy/archive/0.9.4.tar.gz"
echo "   tar -xzf 0.9.4.tar.gz && cd 3proxy-0.9.4"
echo "   make -f Makefile.Linux"
echo "   sudo cp bin/* /usr/local/3proxy/sbin/"
echo ""
echo "2. Set up PostgreSQL database:"
echo "   sudo systemctl start postgresql"
echo "   sudo systemctl enable postgresql"
echo ""
echo "3. Test EC25-EUX modem detection:"
echo "   lsusb | grep 2c7c"
echo "   ls /dev/ttyUSB* /dev/cdc-wdm*"
echo ""
echo "4. Initialize Node.js project:"
echo "   mkdir multi-modem-proxy && cd multi-modem-proxy"
echo "   npm init -y"
echo "   npm install express pg jsonwebtoken bcrypt cors helmet ws serialport"

echo ""
echo -e "${GREEN}🎉 SYSTEM READY FOR MULTI-MODEM LTE PROXY DEVELOPMENT!${NC}"

# Show what was installed based on mode
if [[ "$INSTALL_MODE" == "complete" ]]; then
    echo ""
    echo -e "${BLUE}📋 COMPLETE INSTALLATION INCLUDED:${NC}"
    echo "• Core system tools and build essentials"
    echo "• USB and hardware detection tools"
    echo "• QMI and modem management (libqmi-glib5 for Ubuntu 24.04)"
    echo "• Network configuration tools"
    echo "• PostgreSQL database server"
    echo "• Node.js 20 LTS + PM2"
    echo "• Development packages and headers"
    echo "• Security and SSL tools"
    echo "• Monitoring and debugging tools"
    echo "• 3proxy directory structure"
    echo "• System user for proxy service"
else
    echo ""
    echo -e "${BLUE}📋 MINIMAL INSTALLATION INCLUDED:${NC}"
    echo "• Essential system tools"
    echo "• USB and hardware detection"
    echo "• QMI and modem basics (libqmi-glib5 for Ubuntu 24.04)"
    echo "• Network tools"
    echo "• PostgreSQL database"
    echo "• Node.js 20 LTS + PM2"
    echo "• 3proxy directory structure"
    echo "• System user for proxy service"
fi
