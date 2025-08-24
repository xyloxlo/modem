# 📦 COMPLETE PACKAGE INSTALLATION GUIDE - Multi-Modem LTE Proxy System

**Kompletna lista wszystkich pakietów potrzebnych dla Ubuntu 24.04.3 LTS**

Data utworzenia: 2024  
Target OS: **Ubuntu 24.04.3 LTS (Noble Numbat)**  
Status: ✅ **KOMPLETNE - wszystkie dependencies mapped**

---

## 🎯 **CURRENT INSTALLED STATUS**

### ✅ **JUŻ MASZ:**
```bash
libqmi-utils     ← QMI tools for modem management
postgresql       ← Database server 
nodejs           ← JavaScript runtime
npm              ← Node.js package manager
```

### 📋 **POTRZEBUJESZ JESZCZE:**

---

## 📦 **PHASE 1: CORE SYSTEM DEPENDENCIES**

### **1.1 Basic System Tools**
```bash
sudo apt install -y \
    curl \
    wget \
    git \
    vim \
    htop \
    iotop \
    ncdu \
    build-essential \
    linux-headers-$(uname -r) \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release
```

### **1.2 USB and Hardware Tools**
```bash
sudo apt install -y \
    usbutils \
    pciutils \
    usb-modeswitch \
    usb-modeswitch-data \
    minicom \
    screen \
    socat \
    netcat-openbsd
```

---

## 📡 **PHASE 2: QMI & MODEM MANAGEMENT (COMPLETE)**

### **2.1 QMI Libraries and Tools**
```bash
sudo apt install -y \
    libqmi-utils \           # ← JUŻ MASZ
    libqmi-glib0 \
    libqmi-proxy \
    libqmi-glib-dev \
    gir1.2-qmi-1.0 \
    modemmanager \
    modemmanager-dev
```

### **2.2 Network Management**
```bash
sudo apt install -y \
    network-manager \
    iproute2 \
    iptables \
    iputils-ping \
    bridge-utils
```

---

## 🗄️ **PHASE 3: DATABASE (POSTGRESQL) - COMPLETE**

### **3.1 PostgreSQL Server**
```bash
sudo apt install -y \
    postgresql \             # ← JUŻ MASZ
    postgresql-contrib \
    postgresql-client \
    postgresql-server-dev-16
```

### **3.2 Additional Database Tools**
```bash
sudo apt install -y \
    unixodbc-dev
```

---

## 🚀 **PHASE 4: NODE.JS DEVELOPMENT STACK - COMPLETE**

### **4.1 Node.js Runtime**
```bash
# JUŻ MASZ nodejs + npm

# Install PM2 globally for process management
npm install -g pm2

# Verify versions
node --version
npm --version
pm2 --version
```

### **4.2 Node.js Project Dependencies (npm install później)**
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "pg": "^8.11.0",
    "jsonwebtoken": "^9.0.0",
    "bcrypt": "^5.1.0",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "ws": "^8.13.0",
    "serialport": "^11.0.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  }
}
```

---

## 🔗 **PHASE 5: 3PROXY COMPILATION DEPENDENCIES**

### **5.1 Build Tools for 3proxy**
```bash
# JUŻ MASZ build-essential

# Download and compile 3proxy
wget https://github.com/z3APA3A/3proxy/archive/0.9.4.tar.gz
tar -xzf 0.9.4.tar.gz
cd 3proxy-0.9.4
make -f Makefile.Linux
```

### **5.2 3proxy Installation Directories**
```bash
# Create system directories (manual setup)
sudo mkdir -p /usr/local/3proxy/{sbin,bin}
sudo mkdir -p /usr/local/etc
sudo mkdir -p /var/log/3proxy
```

---

## 🔐 **PHASE 6: SECURITY AND SYSTEM TOOLS**

### **6.1 SSL/TLS Support**
```bash
sudo apt install -y \
    openssl \
    certbot \
    python3-certbot-nginx
```

### **6.2 System Monitoring**
```bash
sudo apt install -y \
    htop \               # ← JUŻ BĘDZIE
    iotop \             # ← JUŻ BĘDZIE  
    nethogs \
    iftop \
    tcpdump \
    wireshark-common \
    strace \
    lsof
```

---

## 🎨 **PHASE 7: FRONTEND DEVELOPMENT (OPTIONAL/LATER)**

### **7.1 Next.js/React Dependencies (npm install w projekcie)**
```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "socket.io-client": "^4.7.0",
    "axios": "^1.5.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "typescript": "^5.0.0",
    "tailwindcss": "^3.3.0"
  }
}
```

---

## 🎯 **SINGLE MASTER INSTALLATION COMMAND**

### **WSZYSTKO W JEDNEJ KOMENDZIE:**
```bash
#!/bin/bash
# master-package-installer.sh

echo "=== MASTER INSTALLATION: Multi-Modem LTE Proxy System ==="
echo "Target: Ubuntu 24.04.3 LTS + EC25-EUX"

# Update system
sudo apt update && sudo apt upgrade -y

# Install ALL packages at once
sudo apt install -y \
    curl wget git vim htop iotop ncdu \
    build-essential linux-headers-$(uname -r) \
    software-properties-common apt-transport-https ca-certificates gnupg lsb-release \
    usbutils pciutils usb-modeswitch usb-modeswitch-data minicom screen socat netcat-openbsd \
    libqmi-glib0 libqmi-proxy libqmi-glib-dev gir1.2-qmi-1.0 modemmanager modemmanager-dev \
    network-manager iproute2 iptables iputils-ping bridge-utils \
    postgresql-contrib postgresql-client postgresql-server-dev-16 unixodbc-dev \
    openssl certbot python3-certbot-nginx \
    nethogs iftop tcpdump wireshark-common strace lsof

# Install PM2 globally
npm install -g pm2

# Create 3proxy directories
sudo mkdir -p /usr/local/3proxy/{sbin,bin}
sudo mkdir -p /usr/local/etc
sudo mkdir -p /var/log/3proxy

# Create proxy user
sudo useradd -r -s /bin/false -d /var/empty -c "3proxy service" proxy

echo "✅ ALL PACKAGES INSTALLED SUCCESSFULLY!"

# Show summary
echo ""
echo "📊 INSTALLATION SUMMARY:"
echo "PostgreSQL: $(psql --version)"
echo "Node.js: $(node --version)"
echo "NPM: $(npm --version)"
echo "QMI Tools: $(qmicli --version | head -1)"
echo "ModemManager: $(mmcli --version)"

echo ""
echo "🔗 NEXT STEPS:"
echo "1. Download and compile 3proxy"
echo "2. Set up PostgreSQL database"
echo "3. Initialize Node.js project"
echo "4. Test EC25-EUX modem detection"
```

---

## 📋 **COMPREHENSIVE PACKAGE LIST BY CATEGORY**

### **🔧 System & Build (16 packages)**
- curl, wget, git, vim
- htop, iotop, ncdu
- build-essential, linux-headers-$(uname -r)
- software-properties-common, apt-transport-https, ca-certificates, gnupg, lsb-release
- usbutils, pciutils

### **📡 Modem & Communication (12 packages)**
- libqmi-utils ✅ (already have)
- libqmi-glib0, libqmi-proxy, libqmi-glib-dev, gir1.2-qmi-1.0
- modemmanager, modemmanager-dev
- usb-modeswitch, usb-modeswitch-data
- minicom, screen, socat, netcat-openbsd

### **🌐 Network & Routing (5 packages)**
- network-manager, iproute2, iptables, iputils-ping, bridge-utils

### **🗄️ Database (4 packages)**  
- postgresql ✅ (already have)
- postgresql-contrib, postgresql-client, postgresql-server-dev-16, unixodbc-dev

### **🚀 JavaScript Runtime (3 items)**
- nodejs ✅ (already have)
- npm ✅ (already have)  
- pm2 (npm global install)

### **🔐 Security & SSL (3 packages)**
- openssl, certbot, python3-certbot-nginx

### **🔍 Monitoring & Debug (7 packages)**
- nethogs, iftop, tcpdump, wireshark-common, strace, lsof

### **📦 Custom Compilation**
- 3proxy (from source: github.com/z3APA3A/3proxy/archive/0.9.4.tar.gz)

---

## 🎯 **TOTAL PACKAGE COUNT:**

```
System & Build:      16 packages
Modem & Communication: 11 packages (1 already have)
Network & Routing:    5 packages  
Database:            4 packages (1 already have)
JavaScript:          1 global npm package
Security & SSL:      3 packages
Monitoring & Debug:  7 packages
Custom Compilation:  1 source package

TOTAL: ~46 apt packages + 1 npm global + 1 source compile
```

---

## 🚀 **EXECUTION PLAN:**

### **STEP 1: Run master installer**
```bash
chmod +x master-package-installer.sh
sudo ./master-package-installer.sh
```

### **STEP 2: Compile 3proxy**
```bash
wget https://github.com/z3APA3A/3proxy/archive/0.9.4.tar.gz
tar -xzf 0.9.4.tar.gz && cd 3proxy-0.9.4
make -f Makefile.Linux
sudo cp bin/* /usr/local/3proxy/sbin/
```

### **STEP 3: Initialize project**
```bash
mkdir multi-modem-proxy && cd multi-modem-proxy
npm init -y
npm install express pg jsonwebtoken bcrypt cors helmet ws serialport
```

### **STEP 4: Test hardware**
```bash
lsusb | grep 2c7c
ls /dev/ttyUSB* /dev/cdc-wdm*
```

---

## ✅ **FINAL STATUS:**

```
🎉 KOMPLETNA LISTA GOTOWA!

Masz już: libqmi-utils, postgresql, nodejs, npm
Potrzebujesz: ~42 dodatkowych pakietów + kompilacja 3proxy

Single command installation available! 🚀
```

**Chcesz żebym utworzył master installer script i go uruchomił?** 🎯
