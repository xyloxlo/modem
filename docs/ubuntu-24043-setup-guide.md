# 🎯 UBUNTU 24.04.3 LTS SETUP GUIDE dla EC25-EUX MULTI-MODEM SYSTEM

**Kompletny przewodnik przygotowania Ubuntu 24.04.3 LTS dla systemu multi-modem LTE proxy z EC25-EUX**

Data utworzenia: 2024  
Target OS: **Ubuntu 24.04.3 LTS (Noble Numbat)**  
Kernel: **6.8 LTS** z natywną obsługą EC25-EUX

---

## 🎉 **DLACZEGO Ubuntu 24.04.3 LTS jest IDEALNY dla naszego projektu:**

### **✅ NATYWNE WSPARCIE EC25-EUX**
- 🔥 **Kernel 6.8** ma built-in support dla EC25-EUX (2c7c:0125)
- 🔥 **Nie potrzebujesz custom drivers** - wszystko działa out-of-the-box!
- 🔥 **Ulepszone QMI subsystem** - better performance i stability
- 🔥 **Enhanced USB hotplug** - automatic device detection

### **📦 UPDATED PACKAGES ECOSYSTEM**
```bash
# Ubuntu 24.04.3 LTS packages:
libqmi-utils:        1.32.0+     ← Advanced QMI tools
ModemManager:        1.20.0+     ← Better multi-modem support  
NetworkManager:      1.46.0+     ← Enhanced networking
systemd:             255.4+      ← Latest systemd features
PostgreSQL:          16.1+       ← Modern database
Node.js:             20.x LTS    ← Stable JavaScript runtime
3proxy:              0.9.4+      ← Latest proxy features
```

### **🛡️ DŁUGOTERMINOWA STABILNOŚĆ**
- ✅ **Support do kwietnia 2029** (5+ lat wsparcia)
- ✅ **Regular security updates**
- ✅ **Hardware Enablement Stack** updates
- ✅ **Kernel 6.8 LTS** - stabilny long-term kernel

---

## 🚀 **CZĘŚĆ 1: PODSTAWOWA INSTALACJA UBUNTU 24.04.3 LTS**

### **KROK 1.1: Download i instalacja**
```bash
# Download Ubuntu 24.04.3 LTS Server
wget https://releases.ubuntu.com/24.04.3/ubuntu-24.04.3-live-server-amd64.iso

# Opcje instalacji:
# - VM: 8GB RAM, 4 CPU cores, 100GB storage (recommended)
# - Physical: minimum 4GB RAM, 2 cores, 50GB storage
# - Network: static IP w sieci LAN (np. 192.168.1.100)
```

### **KROK 1.2: Post-install system update**
```bash
#!/bin/bash
# ubuntu-2404-initial-setup.sh

echo "=== UBUNTU 24.04.3 LTS INITIAL SETUP ==="

# Update package database
sudo apt update

# Upgrade system to latest packages
sudo apt upgrade -y

# Install essential packages
sudo apt install -y \
    curl wget git vim \
    htop iotop ncdu \
    build-essential \
    linux-headers-$(uname -r) \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release

# Check system info
echo ""
echo "📊 SYSTEM INFORMATION:"
echo "OS: $(lsb_release -d | cut -f2)"
echo "Kernel: $(uname -r)"
echo "Architecture: $(dpkg --print-architecture)"
echo "CPU Cores: $(nproc)"
echo "Memory: $(free -h | grep Mem | awk '{print $2}')"
echo "Storage: $(df -h / | tail -1 | awk '{print $4}') available"

echo "✅ Ubuntu 24.04.3 LTS basic setup complete"
```

---

## 📡 **CZĘŚĆ 2: EC25-EUX MODEM SUPPORT (BUILT-IN)**

### **KROK 2.1: Sprawdź natywne wsparcie**
```bash
#!/bin/bash
# check-ec25-native-support.sh

echo "=== SPRAWDZANIE NATYWNEGO WSPARCIA EC25-EUX w Ubuntu 24.04.3 ==="

echo "🔍 Checking kernel version..."
KERNEL_VERSION=$(uname -r)
echo "Current kernel: $KERNEL_VERSION"

# Check if kernel 6.8+
if [[ "$KERNEL_VERSION" =~ ^6\.[8-9] ]] || [[ "$KERNEL_VERSION" =~ ^[7-9] ]]; then
    echo "✅ Kernel $KERNEL_VERSION has native EC25-EUX support"
else
    echo "⚠️  Kernel $KERNEL_VERSION may need verification for EC25-EUX support"
fi

echo ""
echo "🔍 Checking available QMI drivers..."

# Check QMI driver
if modinfo qmi_wwan &>/dev/null; then
    echo "✅ qmi_wwan driver available"
    echo "   Version: $(modinfo qmi_wwan | grep version | head -1 | cut -d: -f2 | xargs)"
    
    # Check EC25 support in driver
    if modinfo qmi_wwan | grep -q "2c7c"; then
        echo "✅ Quectel devices (2c7c) supported in qmi_wwan"
    else
        echo "⚠️  Quectel vendor ID not explicitly listed (may still work)"
    fi
else
    echo "❌ qmi_wwan driver not found"
fi

# Check USB serial driver
if modinfo option &>/dev/null; then
    echo "✅ option (USB serial) driver available"
    echo "   Version: $(modinfo option | grep version | head -1 | cut -d: -f2 | xargs)"
    
    # Check EC25 support
    if modinfo option | grep -q "2c7c"; then
        echo "✅ Quectel devices (2c7c) supported in option driver"
    else
        echo "⚠️  Quectel vendor ID not explicitly listed (may still work)"
    fi
else
    echo "❌ option driver not found"
fi

echo ""
echo "🔍 Checking USB subsystem..."
echo "USB subsystem version: $(cat /sys/kernel/debug/usb/version 2>/dev/null || echo "Debug info not available")"

echo "✅ Native support check complete"
```

### **KROK 2.2: Install QMI tools (modern versions)**
```bash
#!/bin/bash
# install-qmi-tools-2404.sh

echo "=== INSTALACJA NOWOCZESNYCH QMI TOOLS dla Ubuntu 24.04.3 ==="

# Install QMI and modem management tools
sudo apt install -y \
    libqmi-utils \
    libqmi-glib0 \
    libqmi-proxy \
    modemmanager \
    network-manager \
    usb-modeswitch \
    usb-modeswitch-data

# Additional USB and networking tools
sudo apt install -y \
    usbutils \
    pciutils \
    minicom \
    screen \
    socat \
    netcat-openbsd

# Show installed versions
echo ""
echo "📦 INSTALLED PACKAGES VERSIONS:"
echo "libqmi-utils: $(dpkg -l | grep libqmi-utils | awk '{print $3}')"
echo "ModemManager: $(dpkg -l | grep modemmanager | awk '{print $3}')"
echo "NetworkManager: $(dpkg -l | grep network-manager | awk '{print $3}' | head -1)"

# Disable ModemManager for our custom setup
echo ""
echo "🔄 Configuring ModemManager..."
sudo systemctl stop ModemManager
sudo systemctl disable ModemManager

echo "⚠️  ModemManager disabled - we'll use custom management"
echo "✅ QMI tools installation complete"
```

### **KROK 2.3: Test natywnego wykrywania EC25-EUX**
```bash
#!/bin/bash
# test-ec25-native-detection.sh

echo "=== TEST NATYWNEGO WYKRYWANIA EC25-EUX na Ubuntu 24.04.3 ==="

echo "🔌 Podłącz modem EC25-EUX i naciśnij Enter..."
read

echo "⏳ Waiting for device enumeration (10 seconds)..."
sleep 10

# Test 1: USB Detection
echo ""
echo "🔍 Test 1: USB Device Detection"
USB_DEVICES=$(lsusb | grep "2c7c:0125")
if [ -n "$USB_DEVICES" ]; then
    echo "✅ EC25-EUX detected via USB:"
    echo "$USB_DEVICES"
else
    echo "❌ EC25-EUX not detected via USB"
    echo "Available Quectel devices:"
    lsusb | grep -i quectel || echo "No Quectel devices found"
fi

# Test 2: Kernel Messages
echo ""
echo "🔍 Test 2: Kernel Messages (last 20 lines)"
echo "Recent USB/modem kernel messages:"
dmesg | tail -20 | grep -i -E "(usb|modem|qmi|tty|cdc)" || echo "No relevant kernel messages"

# Test 3: Serial Ports
echo ""
echo "🔍 Test 3: Serial Ports Creation"
SERIAL_PORTS=$(ls /dev/ttyUSB* 2>/dev/null | wc -l)
echo "Serial ports created: $SERIAL_PORTS"
if [ $SERIAL_PORTS -gt 0 ]; then
    echo "✅ Serial ports available:"
    ls -la /dev/ttyUSB* 2>/dev/null
else
    echo "❌ No serial ports created"
fi

# Test 4: QMI Interfaces
echo ""
echo "🔍 Test 4: QMI Interfaces Creation"
QMI_INTERFACES=$(ls /dev/cdc-wdm* 2>/dev/null | wc -l)
echo "QMI interfaces created: $QMI_INTERFACES"
if [ $QMI_INTERFACES -gt 0 ]; then
    echo "✅ QMI interfaces available:"
    ls -la /dev/cdc-wdm* 2>/dev/null
else
    echo "❌ No QMI interfaces created"
fi

# Test 5: Network Interfaces
echo ""
echo "🔍 Test 5: Network Interfaces"
WWAN_INTERFACES=$(ip link | grep -c wwan)
echo "WWAN interfaces found: $WWAN_INTERFACES"
if [ $WWAN_INTERFACES -gt 0 ]; then
    echo "✅ WWAN interfaces available:"
    ip link | grep wwan
else
    echo "❌ No WWAN interfaces found"
fi

# Summary
echo ""
echo "📊 NATIVE DETECTION SUMMARY:"
echo "   USB Detection: $([ -n "$USB_DEVICES" ] && echo "✅ SUCCESS" || echo "❌ FAILED")"
echo "   Serial Ports: $([ $SERIAL_PORTS -gt 0 ] && echo "✅ SUCCESS ($SERIAL_PORTS ports)" || echo "❌ FAILED")"
echo "   QMI Interfaces: $([ $QMI_INTERFACES -gt 0 ] && echo "✅ SUCCESS ($QMI_INTERFACES interfaces)" || echo "❌ FAILED")"
echo "   Network Interfaces: $([ $WWAN_INTERFACES -gt 0 ] && echo "✅ SUCCESS ($WWAN_INTERFACES interfaces)" || echo "❌ FAILED")"

if [ -n "$USB_DEVICES" ] && [ $SERIAL_PORTS -gt 0 ] && [ $QMI_INTERFACES -gt 0 ]; then
    echo ""
    echo "🎉 NATIVE DETECTION SUCCESSFUL!"
    echo "✅ Ubuntu 24.04.3 LTS fully supports EC25-EUX out-of-the-box"
    echo "✅ No custom drivers needed!"
else
    echo ""
    echo "⚠️  PARTIAL DETECTION - may need troubleshooting"
fi
```

---

## 🗄️ **CZĘŚĆ 3: POSTGRESQL 16+ SETUP**

### **KROK 3.1: Install PostgreSQL 16**
```bash
#!/bin/bash
# install-postgresql16-ubuntu2404.sh

echo "=== INSTALACJA POSTGRESQL 16 na Ubuntu 24.04.3 LTS ==="

# Install PostgreSQL 16 (latest in Ubuntu 24.04.3)
sudo apt install -y \
    postgresql-16 \
    postgresql-client-16 \
    postgresql-contrib-16 \
    postgresql-16-dbgsym

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Check PostgreSQL version
echo ""
echo "📦 PostgreSQL installation:"
POSTGRES_VERSION=$(sudo -u postgres psql -c "SELECT version();" | grep PostgreSQL)
echo "$POSTGRES_VERSION"

# Configure PostgreSQL for multi-modem system
echo ""
echo "🔧 Configuring PostgreSQL for multi-modem system..."

# Create database and user for modems
sudo -u postgres psql << 'EOF'
-- Create database for modems
CREATE DATABASE modems_db;

-- Create user for modems system
CREATE USER modems_user WITH PASSWORD 'secure_password_2024';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE modems_db TO modems_user;

-- Create admin user
CREATE USER modems_admin WITH PASSWORD 'admin_password_2024' CREATEROLE;
GRANT ALL PRIVILEGES ON DATABASE modems_db TO modems_admin;

\q
EOF

# Configure PostgreSQL settings for performance
sudo tee -a /etc/postgresql/16/main/postgresql.conf << 'EOF'

# Multi-modem system optimizations
max_connections = 200                    # Support for many modems
shared_buffers = 256MB                   # Memory for caching
effective_cache_size = 1GB               # Available system memory
work_mem = 4MB                           # Memory per operation
maintenance_work_mem = 64MB              # Memory for maintenance
checkpoint_completion_target = 0.9      # Checkpoint performance
wal_buffers = 16MB                       # WAL buffering
random_page_cost = 1.1                   # SSD optimization

# Logging for debugging
log_statement = 'mod'                    # Log modifications
log_duration = on                        # Log query duration
log_min_duration_statement = 1000       # Log slow queries (>1s)

# LISTEN/NOTIFY for real-time events
listen_addresses = 'localhost'          # Listen on localhost
EOF

# Restart PostgreSQL
sudo systemctl restart postgresql

echo "✅ PostgreSQL 16 installation and configuration complete"
```

### **KROK 3.2: Setup database schema**
```bash
#!/bin/bash
# setup-modems-database-schema.sh

echo "=== SETUP DATABASE SCHEMA dla MULTI-MODEM SYSTEM ==="

# Create advanced schema with PostgreSQL 16 features
PGPASSWORD=secure_password_2024 psql -h localhost -U modems_user -d modems_db << 'EOF'

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Modems table with dynamic allocation support
CREATE TABLE IF NOT EXISTS modems (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    serial VARCHAR(50) UNIQUE NOT NULL,
    imei VARCHAR(20),
    path_at VARCHAR(100),
    path_qmi VARCHAR(100),
    interface_id INTEGER,
    proxy_port INTEGER,
    routing_table_id INTEGER,
    status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'error', 'initializing')),
    signal_strength INTEGER,
    network_type VARCHAR(10),
    operator_name VARCHAR(50),
    ip_address INET,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Modem logs table with partitioning support (PostgreSQL 16 feature)
CREATE TABLE IF NOT EXISTS modem_logs (
    id BIGSERIAL,
    modem_id UUID REFERENCES modems(id) ON DELETE CASCADE,
    command_type VARCHAR(10) CHECK (command_type IN ('AT', 'QMI')),
    command VARCHAR(500),
    response TEXT,
    execution_time_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (timestamp);

-- Create partitions for current and next month
CREATE TABLE modem_logs_current PARTITION OF modem_logs 
    FOR VALUES FROM (DATE_TRUNC('month', CURRENT_DATE)) 
    TO (DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month'));

CREATE TABLE modem_logs_next PARTITION OF modem_logs 
    FOR VALUES FROM (DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month')) 
    TO (DATE_TRUNC('month', CURRENT_DATE + INTERVAL '2 months'));

-- System metrics table for monitoring
CREATE TABLE IF NOT EXISTS system_metrics (
    id BIGSERIAL PRIMARY KEY,
    metric_name VARCHAR(50) NOT NULL,
    metric_value NUMERIC NOT NULL,
    unit VARCHAR(20),
    tags JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Proxy instances table for dynamic management
CREATE TABLE IF NOT EXISTS proxy_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    modem_id UUID REFERENCES modems(id) ON DELETE CASCADE,
    port INTEGER NOT NULL,
    pid INTEGER,
    status VARCHAR(20) DEFAULT 'stopped' CHECK (status IN ('running', 'stopped', 'error')),
    config_path VARCHAR(200),
    started_at TIMESTAMP,
    stopped_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dynamic allocation functions (improved for PostgreSQL 16)
CREATE OR REPLACE FUNCTION allocate_interface_id() RETURNS INTEGER AS $$
DECLARE
    next_id INTEGER;
BEGIN
    SELECT COALESCE(MAX(interface_id), -1) + 1 INTO next_id FROM modems;
    RETURN next_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION allocate_proxy_port() RETURNS INTEGER AS $$
DECLARE
    next_port INTEGER;
    base_port INTEGER := 3128;
    max_port INTEGER := 4127;
BEGIN
    SELECT COALESCE(MAX(proxy_port), base_port - 1) + 1 INTO next_port FROM modems;
    IF next_port > max_port THEN
        RAISE EXCEPTION 'No available proxy ports (max: %)', max_port;
    END IF;
    RETURN next_port;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION allocate_routing_table() RETURNS INTEGER AS $$
DECLARE
    next_table INTEGER;
    base_table INTEGER := 100;
    max_table INTEGER := 999;
BEGIN
    SELECT COALESCE(MAX(routing_table_id), base_table - 1) + 1 INTO next_table FROM modems;
    IF next_table > max_table THEN
        RAISE EXCEPTION 'No available routing tables (max: %)', max_table;
    END IF;
    RETURN next_table;
END;
$$ LANGUAGE plpgsql;

-- Triggers for LISTEN/NOTIFY events
CREATE OR REPLACE FUNCTION notify_modem_change() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM pg_notify('modem_change', json_build_object('action', 'insert', 'serial', NEW.serial)::text);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM pg_notify('modem_change', json_build_object('action', 'update', 'serial', NEW.serial, 'old_status', OLD.status, 'new_status', NEW.status)::text);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM pg_notify('modem_change', json_build_object('action', 'delete', 'serial', OLD.serial)::text);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER modem_change_trigger
    AFTER INSERT OR UPDATE OR DELETE ON modems
    FOR EACH ROW EXECUTE FUNCTION notify_modem_change();

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_modems_updated_at
    BEFORE UPDATE ON modems
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_modems_serial ON modems(serial);
CREATE INDEX IF NOT EXISTS idx_modems_status ON modems(status);
CREATE INDEX IF NOT EXISTS idx_modems_last_seen ON modems(last_seen);
CREATE INDEX IF NOT EXISTS idx_modem_logs_modem_id ON modem_logs(modem_id);
CREATE INDEX IF NOT EXISTS idx_modem_logs_timestamp ON modem_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_system_metrics_name ON system_metrics(metric_name);

-- Views for easy monitoring
CREATE OR REPLACE VIEW active_modems AS
SELECT 
    serial,
    status,
    signal_strength,
    network_type,
    operator_name,
    ip_address,
    proxy_port,
    last_seen
FROM modems 
WHERE status = 'online'
ORDER BY last_seen DESC;

CREATE OR REPLACE VIEW modem_summary AS
SELECT 
    COUNT(*) as total_modems,
    COUNT(*) FILTER (WHERE status = 'online') as online_modems,
    COUNT(*) FILTER (WHERE status = 'offline') as offline_modems,
    COUNT(*) FILTER (WHERE status = 'error') as error_modems,
    AVG(signal_strength) FILTER (WHERE status = 'online') as avg_signal_strength
FROM modems;

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO modems_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO modems_user;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO modems_user;

-- Initial system setup
INSERT INTO system_metrics (metric_name, metric_value, unit) VALUES 
('system_start', EXTRACT(EPOCH FROM CURRENT_TIMESTAMP), 'timestamp'),
('max_modems_supported', 100, 'count'),
('database_schema_version', 1.0, 'version');

COMMIT;
EOF

echo "✅ Advanced database schema created with PostgreSQL 16 features"
```

---

## 🚀 **CZĘŚĆ 4: NODE.JS 20 LTS + 3PROXY SETUP**

### **KROK 4.1: Install Node.js 20 LTS**
```bash
#!/bin/bash
# install-nodejs20-ubuntu2404.sh

echo "=== INSTALACJA NODE.JS 20 LTS na Ubuntu 24.04.3 ==="

# Install NodeSource repository for Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js 20 LTS
sudo apt install -y nodejs

# Install additional development tools
sudo apt install -y \
    npm \
    yarn \
    build-essential

# Verify installation
echo ""
echo "📦 Node.js installation:"
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"
echo "yarn version: $(yarn --version)"

# Update npm to latest
sudo npm install -g npm@latest

# Install global development tools
sudo npm install -g \
    pm2 \
    nodemon \
    typescript \
    ts-node

# Configure npm for security
npm audit

echo "✅ Node.js 20 LTS installation complete"
```

### **KROK 4.2: Install 3proxy (latest)**
```bash
#!/bin/bash
# install-3proxy-ubuntu2404.sh

echo "=== INSTALACJA 3PROXY LATEST na Ubuntu 24.04.3 ==="

# Install build dependencies
sudo apt install -y \
    gcc \
    make \
    libc6-dev \
    libssl-dev

# Create 3proxy directories
sudo mkdir -p /usr/local/3proxy/{sbin,bin,etc,log}

# Download and compile 3proxy (latest stable)
cd /tmp
wget https://github.com/z3APA3A/3proxy/archive/refs/heads/master.zip
unzip master.zip
cd 3proxy-master

# Compile for Linux
make -f Makefile.Linux

# Install binaries
sudo cp bin/3proxy /usr/local/3proxy/sbin/
sudo cp bin/proxy /usr/local/3proxy/bin/
sudo cp bin/socks /usr/local/3proxy/bin/

# Set permissions
sudo chmod +x /usr/local/3proxy/sbin/3proxy
sudo chmod +x /usr/local/3proxy/bin/*

# Create proxy user
sudo useradd -r -s /bin/false -d /usr/local/3proxy proxy
sudo chown -R proxy:proxy /usr/local/3proxy

# Test 3proxy installation
echo ""
echo "📦 3proxy installation:"
/usr/local/3proxy/sbin/3proxy -v

# Create basic configuration template
sudo tee /usr/local/3proxy/etc/3proxy-template.cfg << 'EOF'
# 3proxy configuration template for EC25-EUX multi-modem
daemon
pidfile /var/run/3proxy-SERIAL.pid
log /var/log/3proxy/3proxy-SERIAL.log D
logformat "- +_L%t.%. %N.%p %E %U %C:%c %R:%r %O %I %h %T"
auth none

# HTTP proxy on dynamic port
proxy -pPORT

# Access control
allow * * * * *
EOF

# Create log directory
sudo mkdir -p /var/log/3proxy
sudo chown proxy:proxy /var/log/3proxy

echo "✅ 3proxy installation complete"
```

---

## 🔧 **CZĘŚĆ 5: SYSTEMD 255+ CONFIGURATION**

### **KROK 5.1: Advanced systemd templates**
```bash
#!/bin/bash
# setup-systemd-templates-ubuntu2404.sh

echo "=== SETUP ADVANCED SYSTEMD TEMPLATES dla Ubuntu 24.04.3 ==="

# Create systemd template for 3proxy instances (modern systemd 255+ features)
sudo tee /etc/systemd/system/3proxy@.service << 'EOF'
[Unit]
Description=3proxy Proxy Server for Modem %I
Documentation=man:3proxy(8)
After=network.target postgresql.service modem-detection.service
Wants=postgresql.service
BindsTo=sys-devices-platform-modem\x2d%i.device
Conflicts=3proxy@.service

[Service]
Type=forking
User=proxy
Group=proxy
ExecStartPre=/usr/local/bin/setup-modem-proxy.sh %i
ExecStart=/usr/local/3proxy/sbin/3proxy /etc/3proxy/3proxy-%i.cfg
ExecStartPost=/usr/local/bin/register-proxy-instance.sh %i
ExecReload=/bin/kill -HUP $MAINPID
ExecStop=/usr/local/bin/cleanup-proxy-instance.sh %i
PIDFile=/var/run/3proxy-%i.pid
Restart=on-failure
RestartSec=5
TimeoutStartSec=30
TimeoutStopSec=10

# Resource management (systemd 255+ features)
Slice=modems.slice
MemoryMax=256M
MemorySwapMax=0
CPUQuota=10%
TasksMax=100
IOWeight=100

# Security hardening (enhanced in systemd 255+)
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictRealtime=true
RestrictSUIDSGID=true
RemoveIPC=true
PrivateTmp=true
PrivateDevices=false
ReadWritePaths=/var/log/3proxy /var/run /etc/3proxy
CapabilityBoundingSet=CAP_NET_BIND_SERVICE CAP_SETUID CAP_SETGID
AmbientCapabilities=CAP_NET_BIND_SERVICE

# Monitoring and watchdog
WatchdogSec=60s
NotifyAccess=none

[Install]
WantedBy=multi-user.target
EOF

# Create modems.slice for resource management
sudo tee /etc/systemd/system/modems.slice << 'EOF'
[Unit]
Description=Slice for EC25-EUX Modem Services
Documentation=man:systemd.slice(5)

[Slice]
# Total resource limits for all modems
MemoryMax=8G
CPUQuota=400%
TasksMax=5000
IOWeight=500

# Accounting
CPUAccounting=true
MemoryAccounting=true
TasksAccounting=true
IOAccounting=true
EOF

# Create modem detection service
sudo tee /etc/systemd/system/modem-detection.service << 'EOF'
[Unit]
Description=EC25-EUX Modem Detection Service
Documentation=file:///usr/local/share/doc/modem-detection
After=network.target postgresql.service udev.service
Wants=postgresql.service
Requires=udev.service

[Service]
Type=notify
User=root
Group=root
ExecStart=/usr/local/bin/modem-detection-daemon
ExecReload=/bin/kill -HUP $MAINPID
Restart=always
RestartSec=10
TimeoutStartSec=60

# Resource limits
MemoryMax=512M
CPUQuota=20%

# Security
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/run /var/log /sys/bus/usb

# Monitoring
WatchdogSec=30s

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd configuration
sudo systemctl daemon-reload

# Enable services
sudo systemctl enable modem-detection.service

echo "✅ Advanced systemd templates created with modern systemd 255+ features"
```

---

## 📊 **CZĘŚĆ 6: MODERN MONITORING & LOGGING**

### **KROK 6.1: Setup modern logging (systemd 255+ features)**
```bash
#!/bin/bash
# setup-modern-logging-ubuntu2404.sh

echo "=== SETUP MODERN LOGGING dla Ubuntu 24.04.3 ==="

# Configure journald for better logging (systemd 255+ features)
sudo tee /etc/systemd/journald.conf << 'EOF'
[Journal]
# Storage
Storage=persistent
SystemMaxUse=2G
SystemKeepFree=1G
SystemMaxFileSize=256M
SystemMaxFiles=50

# Real-time features (systemd 255+)
Seal=yes
SplitMode=uid
RateLimitInterval=30s
RateLimitBurst=10000

# Performance
Compress=yes
ForwardToSyslog=no
ForwardToKMsg=no
ForwardToConsole=no
ForwardToWall=no

# Security
MaxLevelStore=info
MaxLevelSyslog=info
MaxLevelKMsg=warning
MaxLevelConsole=warning
MaxLevelWall=emerg
EOF

# Create logging configuration for multi-modem system
sudo mkdir -p /etc/rsyslog.d

sudo tee /etc/rsyslog.d/50-modems.conf << 'EOF'
# Multi-modem system logging configuration

# 3proxy logs
if $programname startswith '3proxy' then {
    /var/log/modems/3proxy.log
    stop
}

# Modem detection logs
if $programname == 'modem-detection' then {
    /var/log/modems/detection.log
    stop
}

# QMI/AT command logs
if $msg contains 'QMI' or $msg contains 'AT+' then {
    /var/log/modems/commands.log
    stop
}

# USB/device logs
if $msg contains 'usb' and $msg contains '2c7c:0125' then {
    /var/log/modems/devices.log
    stop
}
EOF

# Create log directories
sudo mkdir -p /var/log/modems
sudo mkdir -p /var/log/3proxy

# Setup log rotation
sudo tee /etc/logrotate.d/modems << 'EOF'
/var/log/modems/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    postrotate
        systemctl reload rsyslog
    endscript
}

/var/log/3proxy/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    copytruncate
}
EOF

# Restart logging services
sudo systemctl restart systemd-journald
sudo systemctl restart rsyslog

echo "✅ Modern logging configuration complete"
```

---

## 🎯 **KOMPLETNY SETUP SCRIPT dla Ubuntu 24.04.3 LTS**

### **master-ubuntu2404-setup.sh**
```bash
#!/bin/bash
# master-ubuntu2404-setup.sh

echo "============================================="
echo "🚀 UBUNTU 24.04.3 LTS COMPLETE SETUP"
echo "     dla EC25-EUX MULTI-MODEM SYSTEM"
echo "============================================="

set -e

# Check Ubuntu version
if ! lsb_release -d | grep -q "24.04"; then
    echo "❌ This script is for Ubuntu 24.04.3 LTS only!"
    exit 1
fi

echo "📋 Setup phases:"
echo "   1. Basic system setup"
echo "   2. EC25-EUX native support verification"
echo "   3. PostgreSQL 16 installation"
echo "   4. Node.js 20 LTS + 3proxy setup"
echo "   5. Advanced systemd configuration"
echo "   6. Modern logging setup"
echo ""

read -p "Proceed with complete setup? (y/N): " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "Setup cancelled"
    exit 0
fi

echo ""
echo "🚀 Starting Ubuntu 24.04.3 LTS setup..."

# Phase 1: Basic setup
echo ""
echo "=== PHASE 1: BASIC SYSTEM SETUP ==="
./ubuntu-2404-initial-setup.sh

# Phase 2: EC25-EUX support
echo ""
echo "=== PHASE 2: EC25-EUX NATIVE SUPPORT ==="
./check-ec25-native-support.sh
./install-qmi-tools-2404.sh

# Phase 3: PostgreSQL
echo ""
echo "=== PHASE 3: POSTGRESQL 16 SETUP ==="
./install-postgresql16-ubuntu2404.sh
./setup-modems-database-schema.sh

# Phase 4: Node.js + 3proxy
echo ""
echo "=== PHASE 4: NODE.JS + 3PROXY SETUP ==="
./install-nodejs20-ubuntu2404.sh
./install-3proxy-ubuntu2404.sh

# Phase 5: systemd
echo ""
echo "=== PHASE 5: SYSTEMD CONFIGURATION ==="
./setup-systemd-templates-ubuntu2404.sh

# Phase 6: Logging
echo ""
echo "=== PHASE 6: MODERN LOGGING ==="
./setup-modern-logging-ubuntu2404.sh

echo ""
echo "============================================="
echo "🎉 UBUNTU 24.04.3 LTS SETUP COMPLETE!"
echo "============================================="
echo ""
echo "📊 System Summary:"
echo "   OS: Ubuntu 24.04.3 LTS (Noble Numbat)"
echo "   Kernel: $(uname -r)"
echo "   PostgreSQL: $(sudo -u postgres psql -c 'SELECT version();' | grep PostgreSQL | cut -d' ' -f2)"
echo "   Node.js: $(node --version)"
echo "   3proxy: Installed and configured"
echo "   systemd: $(systemctl --version | head -1 | cut -d' ' -f2)"
echo ""
echo "✅ Ready for EC25-EUX multi-modem system!"
echo "🔌 Connect modems and run: ./test-ec25-native-detection.sh"
echo ""
echo "📝 Next steps:"
echo "   1. Test modem detection"
echo "   2. Configure udev rules"  
echo "   3. Implement backend services"
echo "   4. Deploy frontend interface"
```

---

## 🎉 **DLACZEGO Ubuntu 24.04.3 LTS to NAJLEPSZA DECYZJA:**

### **✅ ZERO CUSTOM DRIVERS NEEDED**
```bash
# Ubuntu 24.04.3 LTS out-of-the-box:
✅ EC25-EUX (2c7c:0125) natywnie obsługiwany
✅ QMI subsystem kernel 6.8 - enhanced performance
✅ USB hotplug improvements - stable detection
✅ ModemManager 1.20+ - better multi-modem support
```

### **🚀 MODERN STACK**
```bash
# Wszystko najnowsze i stable:
✅ PostgreSQL 16 - JSON, partitioning, performance
✅ Node.js 20 LTS - modern JavaScript runtime
✅ systemd 255+ - enhanced security, monitoring
✅ 5+ lat support do 2029
```

### **🛡️ ENTERPRISE READY**
```bash
# Production-grade features:
✅ Resource management (cgroups v2)
✅ Security hardening (systemd security features)
✅ Modern logging (structured logs, monitoring)  
✅ Database partitioning (automatic log rotation)
```

**Ubuntu 24.04.3 LTS to perfect choice dla tego projektu! 🎯**

**Czy chcesz żebym teraz stworzył te skrypty jako oddzielne pliki gotowe do uruchomienia?** 🚀
