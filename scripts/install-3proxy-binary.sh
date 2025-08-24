#!/bin/bash
# 🚀 3PROXY BINARY INSTALLER
# Fast installation using official .deb package from GitHub releases
# Source: https://github.com/3proxy/3proxy/releases/tag/0.9.4

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}===============================================${NC}"
echo -e "${BLUE}🚀 3PROXY BINARY INSTALLER${NC}"
echo -e "${BLUE}===============================================${NC}"
echo -e "${YELLOW}Installing 3proxy 0.9.4 from official .deb package${NC}"
echo -e "${YELLOW}Source: https://github.com/3proxy/3proxy/releases/tag/0.9.4${NC}"
echo ""

# Check if we're on x86_64
ARCH=$(dpkg --print-architecture)
echo "System architecture: $ARCH"

if [[ "$ARCH" != "amd64" ]]; then
    echo -e "${RED}⚠️  WARNING: This script is for x86_64 (amd64) systems${NC}"
    echo -e "${RED}   Your system: $ARCH${NC}"
    echo -e "${YELLOW}   Available architectures on GitHub:${NC}"
    echo "   - amd64: 3proxy-0.9.4.x86_64.deb"
    echo "   - arm64: 3proxy-0.9.4.aarch64.deb"
    echo "   - arm: 3proxy-0.9.4.arm.deb"
    echo ""
    echo -e "${YELLOW}   Continue anyway? (y/N)${NC}"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "Installation cancelled."
        exit 1
    fi
fi

# Create temporary directory
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

echo ""
echo -e "${BLUE}📦 DOWNLOADING 3PROXY BINARY PACKAGE...${NC}"
echo "Downloading from: https://github.com/3proxy/3proxy/releases/download/0.9.4/3proxy-0.9.4.x86_64.deb"
echo "Package size: ~197 KB"

# Download the .deb package
wget -O 3proxy-0.9.4.x86_64.deb \
    https://github.com/3proxy/3proxy/releases/download/0.9.4/3proxy-0.9.4.x86_64.deb

echo -e "${GREEN}✅ Download complete${NC}"

# Verify download
if [[ ! -f "3proxy-0.9.4.x86_64.deb" ]]; then
    echo -e "${RED}❌ Download failed - file not found${NC}"
    exit 1
fi

FILE_SIZE=$(du -h 3proxy-0.9.4.x86_64.deb | cut -f1)
echo "Downloaded file size: $FILE_SIZE"

echo ""
echo -e "${BLUE}🔧 INSTALLING 3PROXY PACKAGE...${NC}"

# Install the .deb package
sudo dpkg -i 3proxy-0.9.4.x86_64.deb

# Check if installation was successful
if dpkg -l | grep -q 3proxy; then
    echo -e "${GREEN}✅ 3proxy package installed successfully${NC}"
else
    echo -e "${RED}❌ Package installation may have failed${NC}"
    echo "Checking for missing dependencies..."
    sudo apt-get install -f
fi

echo ""
echo -e "${BLUE}📁 CHECKING INSTALLATION...${NC}"

# Check where files were installed
if command -v 3proxy &> /dev/null; then
    echo -e "${GREEN}✅ 3proxy command available: $(which 3proxy)${NC}"
    echo "Version: $(3proxy --help 2>&1 | head -1 || echo 'Version info not available')"
else
    echo -e "${YELLOW}⚠️  3proxy command not in PATH, checking manual locations...${NC}"
fi

# Check common installation paths
INSTALL_PATHS=(
    "/usr/bin/3proxy"
    "/usr/local/bin/3proxy"
    "/usr/sbin/3proxy"
    "/usr/local/sbin/3proxy"
    "/usr/local/3proxy/sbin/3proxy"
)

echo ""
echo "Checking installation paths:"
for path in "${INSTALL_PATHS[@]}"; do
    if [[ -f "$path" ]]; then
        echo -e "${GREEN}✅ Found: $path${NC}"
    else
        echo "❌ Not found: $path"
    fi
done

# List all files installed by the package
echo ""
echo -e "${BLUE}📋 FILES INSTALLED BY PACKAGE:${NC}"
dpkg -L 3proxy 2>/dev/null | head -20 || echo "Could not list package files"

# Create our standard directory structure if needed
echo ""
echo -e "${BLUE}📁 ENSURING STANDARD DIRECTORY STRUCTURE...${NC}"

# Create directories if they don't exist
sudo mkdir -p /usr/local/3proxy/{sbin,bin}
sudo mkdir -p /usr/local/etc
sudo mkdir -p /var/log/3proxy

# Copy 3proxy binary to our standard location if found elsewhere
FOUND_BINARY=""
for path in "${INSTALL_PATHS[@]}"; do
    if [[ -f "$path" ]]; then
        FOUND_BINARY="$path"
        break
    fi
done

if [[ -n "$FOUND_BINARY" ]]; then
    echo -e "${BLUE}🔗 LINKING TO STANDARD LOCATION...${NC}"
    sudo cp "$FOUND_BINARY" /usr/local/3proxy/sbin/3proxy
    sudo chmod +x /usr/local/3proxy/sbin/3proxy
    echo -e "${GREEN}✅ 3proxy copied to /usr/local/3proxy/sbin/3proxy${NC}"
fi

# Set up permissions for proxy user
if id proxy &>/dev/null; then
    sudo chown -R proxy:proxy /var/log/3proxy
    sudo chmod 750 /var/log/3proxy
    echo -e "${GREEN}✅ Permissions set for proxy user${NC}"
else
    echo -e "${YELLOW}⚠️  Proxy user not found - run main installer first${NC}"
fi

# Cleanup
echo ""
echo -e "${BLUE}🧹 CLEANING UP...${NC}"
cd /
rm -rf "$TEMP_DIR"

echo ""
echo -e "${GREEN}===============================================${NC}"
echo -e "${GREEN}✅ 3PROXY BINARY INSTALLATION COMPLETE!${NC}"
echo -e "${GREEN}===============================================${NC}"

echo ""
echo -e "${BLUE}📊 INSTALLATION SUMMARY:${NC}"
if [[ -f "/usr/local/3proxy/sbin/3proxy" ]]; then
    echo -e "${GREEN}✅ 3proxy binary: /usr/local/3proxy/sbin/3proxy${NC}"
    echo "Version info: $(/usr/local/3proxy/sbin/3proxy --help 2>&1 | head -1 || echo 'Available')"
else
    echo -e "${YELLOW}⚠️  3proxy binary location may differ from standard${NC}"
fi

echo -e "${GREEN}✅ Installation method: Official .deb package${NC}"
echo -e "${GREEN}✅ Source: GitHub releases 0.9.4${NC}"
echo -e "${GREEN}✅ Package size: ~197 KB${NC}"

echo ""
echo -e "${BLUE}🔗 NEXT STEPS:${NC}"
echo "1. Test 3proxy installation:"
echo "   /usr/local/3proxy/sbin/3proxy --help"
echo ""
echo "2. Create 3proxy configuration:"
echo "   sudo vim /usr/local/etc/3proxy.cfg"
echo ""
echo "3. Set up systemd service:"
echo "   # Create systemd service file for 3proxy"
echo ""
echo "4. Configure firewall and networking as needed"

echo ""
echo -e "${GREEN}🎉 3PROXY READY FOR CONFIGURATION!${NC}"

# Show release notes from GitHub
echo ""
echo -e "${BLUE}📋 3PROXY 0.9.4 RELEASE NOTES:${NC}"
echo "! Fix: invalid handling of '-' character in ACL hostname"
echo "! Fix: minor bugfixes and improvements"  
echo "+ parentretry command added (defaults to 2) to retry connections to parent proxies"
echo "- icqpr related code (OSCAR proxy) removed, due to drop of OSCAR support by messengers"
