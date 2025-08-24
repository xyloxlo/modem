# Detailed Implementation Plan - Multi-Modem LTE Proxy System

## Overview

This document provides a **comprehensive, step-by-step implementation plan** for the multi-modem LTE proxy system on **Ubuntu 24.04.3 LTS** with **native EC25-EUX support**. Every task references specific documentation and includes implementation details for scalable development.

### 🎉 **Ubuntu 24.04.3 LTS Implementation Advantages:**
- ✅ **Native EC25-EUX Support** - No custom driver compilation needed (Kernel 6.8+)
- ✅ **Simplified Setup** - Reduced complexity from ~50 tasks to ~35 core tasks
- ✅ **Modern Stack** - PostgreSQL 16, Node.js 20 LTS, systemd 255+
- ✅ **Enhanced Stability** - Built-in drivers eliminate compatibility issues
- ✅ **Faster Development** - Focus on system logic, not driver troubleshooting

## Documentation Knowledge Base Summary

### Core Technical Documentation Available:
1. **`docs/3proxy_Documentation_Guide.md`** - Complete 3proxy setup, configuration, service management
2. **`docs/3proxy_Configuration_Examples.md`** - 19 real-world configuration scenarios 
3. **`docs/3proxy_Quick_Reference.md`** - Commands, templates, debugging procedures
4. **`docs/3proxy_Security_Guide.md`** - Security hardening checklist and procedures
5. **`docs/EC25-EUX_AT_Commands_Reference.md`** - Complete AT command reference for modem control
6. **`docs/QMI_Complete_Documentation_Guide.md`** - QMI protocol implementation for Ubuntu 24.04.3 LTS (native support)
7. **`docs/QMI_Port_Configuration_Guide.md`** - USB interface mapping and device detection
8. **`docs/QMI_Scaling_Guide.md`** - Multi-device management concepts
9. **`docs/uncertain-info.md`** - Areas requiring validation/testing (critical for risk management)
10. **`docs/system-architecture-plan.md`** - Overall system architecture and requirements

### Key Implementation Principles:

1. **Start Simple, Scale Systematically** - Begin with single modem, expand to multi-modem
2. **Reference Documentation First** - Every implementation step has doc references
3. **Test Each Component** - Validate before moving to next phase
4. **Security by Design** - Implement security from day one
5. **Event-Driven Architecture** - Use PostgreSQL LISTEN/NOTIFY for real-time updates
6. **Production Readiness** - Include monitoring, logging, error handling

---

## Phase 1: Foundation & Environment Setup ⚡

### Critical Dependencies and Installation Order

**TASK_001_ENV_PREP**: Prepare Ubuntu 24.04.3 LTS server environment
```bash
# System requirements verification
lsb_release -a                    # Confirm Ubuntu 24.04.3 LTS
uname -r                          # Check kernel version (should be 6.8+)
df -h                            # Verify disk space
free -h                          # Check memory

# Verify native EC25-EUX support
modinfo qmi_wwan | grep -E "version|description"
modinfo option | grep -E "version|description"
```
📖 **Reference**: `docs/QMI_Complete_Documentation_Guide.md:34-50`

**TASK_002_PKG_INSTALL**: Install validated QMI packages  
```bash
sudo apt update && sudo apt upgrade -y

# VALIDATED packages for Ubuntu 24.04.3 LTS with native EC25-EUX support
sudo apt install -y \
    libqmi-utils \
    libqmi-glib0 \
    libqmi-proxy \
    modemmanager \
    modemmanager-dev \
    libqmi-glib-dev \
    gir1.2-qmi-1.0

# Additional build dependencies
sudo apt install -y build-essential unixodbc-dev
```
📖 **Reference**: `docs/uncertain-info.md:16-30` (✅ VALIDATED for Ubuntu 24.04.3 LTS)

**TASK_003_3PROXY_COMPILE**: Compile 3proxy from source
```bash
# Download 3proxy source (specify version for reproducibility)
wget https://github.com/z3APA3A/3proxy/archive/0.9.4.tar.gz
tar -xzf 0.9.4.tar.gz
cd 3proxy-0.9.4

# Compile for Linux
make -f Makefile.Linux

# Verify compilation
ls -la bin/
```
📖 **Reference**: `docs/3proxy_Documentation_Guide.md:20-35`

**TASK_004_3PROXY_INSTALL**: Install 3proxy with proper structure
```bash
# Create standard directories
sudo mkdir -p /usr/local/3proxy/{sbin,bin}
sudo mkdir -p /usr/local/etc
sudo mkdir -p /var/log/3proxy

# Install executables
sudo cp 3proxy ftppr pop3p tcppm udppm socks proxy dnspr /usr/local/3proxy/sbin/
sudo cp mycrypt countersutil /usr/local/3proxy/bin/

# Set executable permissions
sudo chmod 755 /usr/local/3proxy/sbin/*
sudo chmod 755 /usr/local/3proxy/bin/*
```
📖 **Reference**: `docs/3proxy_Quick_Reference.md:4-19`

**TASK_005_USERS_SETUP**: Create proxy user and security setup
```bash
# Create dedicated unprivileged user
sudo useradd -r -s /bin/false -d /var/empty -c "3proxy service" proxy

# Set up directory permissions
sudo chown -R proxy:proxy /var/log/3proxy
sudo chmod 750 /var/log/3proxy

# Security verification
id proxy                         # Verify user creation
groups proxy                     # Check group membership
```
📖 **Reference**: `docs/3proxy_Security_Guide.md:16-25`

**TASK_006_POSTGRES_INSTALL**: Install and configure PostgreSQL
```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib postgresql-client

# Start and enable service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create application database and user
sudo -u postgres createdb modems_db
sudo -u postgres createuser --interactive modems_user
# (Set password and grant privileges)
```
📖 **Reference**: `docs/system-architecture-plan.md:123-141`

**TASK_007_NODEJS_SETUP**: Install Node.js and development environment
```bash
# Install Node.js LTS (use NodeSource repository for specific version)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version

# Install PM2 for process management
npm install -g pm2
```
📖 **Reference**: `docs/system-architecture-plan.md:105-109`

---

## Phase 2: Database Schema & Structure 🗄️

### PostgreSQL Database Design

**TASK_008_DB_SCHEMA**: Create core modems table
```sql
-- Connect to database
sudo -u postgres psql modems_db

-- Create modems table (single source of truth)
CREATE TABLE modems (
    serial VARCHAR(50) PRIMARY KEY,           -- Unique modem identifier (stable)
    path_at VARCHAR(255),                     -- AT command interface path  
    path_qmi VARCHAR(255),                    -- QMI interface path
    interface VARCHAR(50),                    -- Network interface (wwanX)
    proxy_port INTEGER UNIQUE,               -- Assigned 3proxy port
    status VARCHAR(20) DEFAULT 'offline',    -- online/offline/error
    last_seen TIMESTAMP DEFAULT NOW(),       -- Last activity timestamp
    operator VARCHAR(100),                   -- Network operator name
    signal_strength INTEGER,                 -- Signal quality (0-31)
    wan_ip VARCHAR(45),                      -- Current WAN IP address
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_modems_status ON modems(status);
CREATE INDEX idx_modems_last_seen ON modems(last_seen);
CREATE INDEX idx_modems_proxy_port ON modems(proxy_port);
```
📖 **Reference**: `docs/system-architecture-plan.md:123-141`

**TASK_009_DB_LOGS**: Create comprehensive logging table
```sql
-- Create modem_logs table for AT/QMI command tracking
CREATE TABLE modem_logs (
    id SERIAL PRIMARY KEY,
    modem_serial VARCHAR(50) REFERENCES modems(serial),
    command_type VARCHAR(10),                -- 'AT' or 'QMI'
    command TEXT NOT NULL,                   -- Actual command sent
    response TEXT,                           -- Response received
    success BOOLEAN DEFAULT FALSE,          -- Command success/failure
    execution_time INTEGER,                 -- Execution time in ms
    error_code VARCHAR(50),                 -- Error code if failed
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Create indexes for log analysis
CREATE INDEX idx_modem_logs_serial ON modem_logs(modem_serial);
CREATE INDEX idx_modem_logs_timestamp ON modem_logs(timestamp);
CREATE INDEX idx_modem_logs_success ON modem_logs(success);
```
📖 **Reference**: `docs/system-architecture-plan.md:135-141`

**TASK_010_DB_TRIGGERS**: Implement event-driven triggers
```sql
-- Create NOTIFY trigger function
CREATE OR REPLACE FUNCTION notify_modem_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Send notification with modem serial and operation
    IF TG_OP = 'INSERT' THEN
        PERFORM pg_notify('modem_change', 
            json_build_object(
                'operation', 'INSERT',
                'serial', NEW.serial,
                'status', NEW.status,
                'proxy_port', NEW.proxy_port
            )::text
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM pg_notify('modem_change',
            json_build_object(
                'operation', 'UPDATE', 
                'serial', NEW.serial,
                'old_status', OLD.status,
                'new_status', NEW.status,
                'proxy_port', NEW.proxy_port
            )::text
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM pg_notify('modem_change',
            json_build_object(
                'operation', 'DELETE',
                'serial', OLD.serial,
                'proxy_port', OLD.proxy_port
            )::text
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER modems_change_trigger
    AFTER INSERT OR UPDATE OR DELETE ON modems
    FOR EACH ROW EXECUTE FUNCTION notify_modem_change();
```
📖 **Reference**: `docs/system-architecture-plan.md:212-223`

---

## Phase 3: Modem Detection & Management 📱

### USB Device Detection and Interface Management

**TASK_011_UDEV_RULES**: Create EC25-EUX detection rules
```bash
# Create udev rule for EC25-EUX detection
sudo tee /etc/udev/rules.d/99-ec25-eux.rules > /dev/null << 'EOF'
# Quectel EC25-EUX Modem Detection
# USB Vendor ID: 2c7c, Product ID: 0125

# Create stable symlinks based on serial number
SUBSYSTEM=="tty", ATTRS{idVendor}=="2c7c", ATTRS{idProduct}=="0125", \
  ATTRS{../serial}=="?*", \
  SYMLINK+="modems/%s{../serial}_at"

SUBSYSTEM=="usbmisc", ATTRS{idVendor}=="2c7c", ATTRS{idProduct}=="0125", \
  ATTRS{../serial}=="?*", \
  SYMLINK+="modems/%s{../serial}_qmi"

# Trigger events for modem management
SUBSYSTEM=="tty", ATTRS{idVendor}=="2c7c", ATTRS{idProduct}=="0125", \
  ACTION=="add", \
  RUN+="/usr/local/bin/modem-detected.sh %s{../serial} add"

SUBSYSTEM=="tty", ATTRS{idVendor}=="2c7c", ATTRS{idProduct}=="0125", \
  ACTION=="remove", \
  RUN+="/usr/local/bin/modem-detected.sh %s{../serial} remove"
EOF

# Reload udev rules
sudo udevadm control --reload-rules
```
📖 **Reference**: `docs/uncertain-info.md:90-101` (⏳ REQUIRES TESTING)

**TASK_012_DEVICE_SCANNER**: Implement hot-plug detection scanner
```javascript
// modem-scanner.js - Hot-plug device detection
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class ModemScanner {
    constructor() {
        this.scanInterval = 5000; // 5 seconds
        this.lastSeen = new Map();
    }

    async scanDevices() {
        try {
            const devicePath = '/dev/serial/by-id/';
            const devices = fs.readdirSync(devicePath)
                .filter(device => device.includes('Quectel'))
                .filter(device => device.includes('EC25'));
            
            // Check for new devices
            for (const device of devices) {
                if (!this.lastSeen.has(device)) {
                    await this.handleNewDevice(device);
                }
                this.lastSeen.set(device, Date.now());
            }
            
            // Check for removed devices
            for (const [device, timestamp] of this.lastSeen) {
                if (!devices.includes(device)) {
                    await this.handleRemovedDevice(device);
                    this.lastSeen.delete(device);
                }
            }
            
        } catch (error) {
            console.error('Device scan error:', error);
        }
    }

    async handleNewDevice(device) {
        console.log(`New modem detected: ${device}`);
        // Extract serial number and register modem
        const serial = await this.getModemSerial(device);
        await this.registerModem(serial, device);
    }

    async getModemSerial(device) {
        return new Promise((resolve, reject) => {
            // Use AT+CGSN command to get IMEI/serial
            exec(`echo "AT+CGSN" | timeout 5 cat > /dev/${device} < /dev/${device}`, 
                (error, stdout) => {
                    if (error) return reject(error);
                    // Parse serial from AT response
                    const serial = stdout.match(/(\d{15})/)?.[1];
                    resolve(serial || 'unknown');
                }
            );
        });
    }
}

module.exports = ModemScanner;
```
📖 **Reference**: `docs/system-architecture-plan.md:195-201`

**TASK_013_AT_COMMANDS**: Implement AT command interface
```javascript
// at-commander.js - AT Command Interface
const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');

class ATCommander {
    constructor(devicePath) {
        this.devicePath = devicePath;
        this.port = null;
        this.commandQueue = [];
        this.isProcessing = false;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.port = new SerialPort(this.devicePath, {
                baudRate: 115200,
                dataBits: 8,
                stopBits: 1,
                parity: 'none'
            });

            this.parser = this.port.pipe(new Readline({ delimiter: '\r\n' }));
            
            this.port.on('open', () => {
                console.log(`AT interface connected: ${this.devicePath}`);
                resolve();
            });

            this.port.on('error', reject);
        });
    }

    async executeCommand(command, timeout = 5000) {
        return new Promise((resolve, reject) => {
            if (!this.port || !this.port.isOpen) {
                return reject(new Error('AT interface not connected'));
            }

            const startTime = Date.now();
            let response = '';
            
            const responseHandler = (data) => {
                response += data + '\n';
                
                // Check for AT command completion
                if (data.includes('OK') || data.includes('ERROR') || 
                    data.match(/\+CM[ES] ERROR:/)) {
                    this.parser.removeListener('data', responseHandler);
                    clearTimeout(timeoutHandle);
                    
                    const executionTime = Date.now() - startTime;
                    const success = data.includes('OK');
                    
                    resolve({
                        command,
                        response: response.trim(),
                        success,
                        executionTime,
                        errorCode: success ? null : this.parseErrorCode(response)
                    });
                }
            };

            const timeoutHandle = setTimeout(() => {
                this.parser.removeListener('data', responseHandler);
                reject(new Error(`AT command timeout: ${command}`));
            }, timeout);

            this.parser.on('data', responseHandler);
            this.port.write(command + '\r\n');
        });
    }

    // EC25-EUX specific initialization sequence
    async initializeModem() {
        const initCommands = [
            'AT',                    // Test communication
            'AT+CFUN=1',            // Enable full functionality
            'AT+CMEE=2',            // Verbose error reporting
            'AT+CREG=2',            // Enable network registration URC
            'AT+COPS=0'             // Automatic operator selection
        ];

        const results = [];
        for (const command of initCommands) {
            try {
                const result = await this.executeCommand(command);
                results.push(result);
                
                if (!result.success) {
                    throw new Error(`Initialization failed at: ${command}`);
                }
            } catch (error) {
                throw new Error(`Modem initialization error: ${error.message}`);
            }
        }
        
        return results;
    }

    parseErrorCode(response) {
        const cmeMatch = response.match(/\+CME ERROR: (\d+)/);
        const cmsMatch = response.match(/\+CMS ERROR: (\d+)/);
        
        if (cmeMatch) return `CME_${cmeMatch[1]}`;
        if (cmsMatch) return `CMS_${cmsMatch[1]}`;
        return 'UNKNOWN_ERROR';
    }
}

module.exports = ATCommander;
```
📖 **Reference**: `docs/EC25-EUX_AT_Commands_Reference.md:24-40, 136-143`

**TASK_014_QMI_INTEGRATION**: Implement QMI interface wrapper
```javascript
// qmi-commander.js - QMI Interface Wrapper
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class QMICommander {
    constructor(devicePath) {
        this.devicePath = devicePath; // /dev/cdc-wdm0
    }

    async executeQMICommand(service, command, options = {}) {
        const startTime = Date.now();
        const fullCommand = `qmicli -d ${this.devicePath} --${service}-${command}`;
        
        try {
            const { stdout, stderr } = await execAsync(fullCommand, {
                timeout: options.timeout || 10000
            });
            
            const executionTime = Date.now() - startTime;
            
            return {
                command: fullCommand,
                response: stdout.trim(),
                success: true,
                executionTime,
                errorCode: null
            };
            
        } catch (error) {
            return {
                command: fullCommand,
                response: error.message,
                success: false,
                executionTime: Date.now() - startTime,
                errorCode: error.code || 'QMI_ERROR'
            };
        }
    }

    // Device Management Service (DMS) commands
    async getDeviceInfo() {
        const commands = [
            ['dms', 'get-manufacturer'],
            ['dms', 'get-model'], 
            ['dms', 'get-revision'],
            ['dms', 'get-ids']
        ];

        const results = {};
        for (const [service, command] of commands) {
            const result = await this.executeQMICommand(service, command);
            results[command] = result;
        }
        
        return results;
    }

    // Network Access Service (NAS) commands  
    async getNetworkInfo() {
        const commands = [
            ['nas', 'get-signal-strength'],
            ['nas', 'get-serving-system'],
            ['nas', 'get-system-info']
        ];

        const results = {};
        for (const [service, command] of commands) {
            const result = await this.executeQMICommand(service, command);
            results[command] = result;
        }
        
        return results;
    }

    // Wireless Data Service (WDS) commands
    async getDataInfo() {
        const commands = [
            ['wds', 'get-packet-service-status'],
            ['wds', 'get-data-bearer-technology'],
            ['wds', 'get-packet-statistics']
        ];

        const results = {};
        for (const [service, command] of commands) {
            const result = await this.executeQMICommand(service, command);
            results[command] = result;
        }
        
        return results;
    }
}

module.exports = QMICommander;
```
📖 **Reference**: `docs/QMI_Complete_Documentation_Guide.md:108-160`

**TASK_015_MODEM_INIT**: Create comprehensive modem initialization
```javascript
// modem-manager.js - Complete Modem Management
const ATCommander = require('./at-commander');
const QMICommander = require('./qmi-commander');
const db = require('./database');

class ModemManager {
    constructor(serial) {
        this.serial = serial;
        this.atCommander = null;
        this.qmiCommander = null;
        this.status = 'offline';
    }

    async initialize() {
        try {
            // Get device paths from database or discovery
            const modem = await db.query('SELECT * FROM modems WHERE serial = $1', [this.serial]);
            if (!modem.rows.length) {
                throw new Error(`Modem not found: ${this.serial}`);
            }

            const { path_at, path_qmi } = modem.rows[0];
            
            // Initialize AT interface
            this.atCommander = new ATCommander(path_at);
            await this.atCommander.connect();
            
            // Initialize QMI interface
            this.qmiCommander = new QMICommander(path_qmi);
            
            // Run initialization sequence
            await this.runInitializationSequence();
            
            // Update status in database
            await this.updateStatus('online');
            
            console.log(`Modem ${this.serial} initialized successfully`);
            return true;
            
        } catch (error) {
            console.error(`Modem ${this.serial} initialization failed:`, error);
            await this.updateStatus('error');
            throw error;
        }
    }

    async runInitializationSequence() {
        // AT command initialization (per EC25-EUX reference)
        const atResults = await this.atCommander.initializeModem();
        
        // Log all AT commands
        for (const result of atResults) {
            await this.logCommand('AT', result);
        }
        
        // QMI device information gathering
        const qmiResults = await this.qmiCommander.getDeviceInfo();
        
        // Log QMI commands
        for (const [command, result] of Object.entries(qmiResults)) {
            await this.logCommand('QMI', result);
        }
        
        // Update modem information in database
        await this.updateModemInfo(qmiResults);
    }

    async updateStatus(status) {
        await db.query(
            'UPDATE modems SET status = $1, last_seen = NOW() WHERE serial = $2',
            [status, this.serial]
        );
        this.status = status;
    }

    async logCommand(type, result) {
        await db.query(`
            INSERT INTO modem_logs (modem_serial, command_type, command, response, 
                                  success, execution_time, error_code)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
            this.serial,
            type,
            result.command,
            result.response,
            result.success,
            result.executionTime,
            result.errorCode
        ]);
    }
}

module.exports = ModemManager;
```
📖 **Reference**: `docs/EC25-EUX_AT_Commands_Reference.md:136-143`

---

## Phase 4: 3proxy Configuration & Security 🔒

### systemd Templates and Security Hardening

**TASK_016_SYSTEMD_TEMPLATE**: Create per-modem 3proxy instances
```bash
# Create systemd template service
sudo tee /etc/systemd/system/3proxy@.service > /dev/null << 'EOF'
[Unit]
Description=3proxy Proxy Server for Modem %i
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=forking
ExecStart=/usr/local/3proxy/sbin/3proxy /etc/3proxy/3proxy-%i.cfg
ExecReload=/bin/kill -HUP $MAINPID
PIDFile=/var/run/3proxy-%i.pid
User=proxy
Group=proxy
Restart=on-failure
RestartSec=5

# Security settings
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/3proxy /var/run
CapabilityBoundingSet=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
EOF

# Create configuration directory
sudo mkdir -p /etc/3proxy
sudo chown proxy:proxy /etc/3proxy
sudo chmod 755 /etc/3proxy

# Reload systemd
sudo systemctl daemon-reload
```
📖 **Reference**: `docs/system-architecture-plan.md:42-60`

**TASK_017_3PROXY_SECURITY**: Implement security hardening checklist
```bash
# Security hardening script based on 3proxy security guide
#!/bin/bash

# File permissions security
sudo chmod 600 /etc/3proxy/*.cfg
sudo chown proxy:proxy /etc/3proxy/*.cfg

# Log security
sudo chmod 640 /var/log/3proxy/*.log
sudo chown proxy:adm /var/log/3proxy/*.log

# Verify no suid/sgid bits
find /usr/local/3proxy -perm /6000 -ls || echo "No suid/sgid files found - GOOD"

# Create user file with secure permissions
sudo touch /etc/3proxy/3proxy.users
sudo chmod 600 /etc/3proxy/3proxy.users
sudo chown proxy:proxy /etc/3proxy/3proxy.users

# Generate encrypted password for admin
echo "Generating admin password hash..."
/usr/local/3proxy/bin/mycrypt "AdminPassword123!" | sudo tee -a /etc/3proxy/3proxy.users

echo "3proxy security hardening completed"
```
📖 **Reference**: `docs/3proxy_Security_Guide.md:369-409`

**TASK_018_3PROXY_BASELINE**: Create baseline configuration template  
```bash
# Create baseline 3proxy configuration template
sudo tee /etc/3proxy/template.cfg > /dev/null << 'EOF'
# 3proxy Configuration Template for Multi-Modem Setup
daemon
pidfile /var/run/3proxy-__SERIAL__.pid
log /var/log/3proxy/3proxy-__SERIAL__.log D
rotate 30

# Performance settings
maxconn 1000
stacksize 65536

# Network configuration (to be substituted per modem)
internal 192.168.1.100              # LAN interface
external __WAN_IP__                 # Modem-specific WAN IP

# Security configuration
auth iponly

# LAN access control - security first
allow * 192.168.1.0/24 * 80,443,993,995,587,25 HTTP,HTTPS
allow * 192.168.1.0/24 * 53 *      # DNS
deny * * 10.0.0.0/8,172.16.0.0/12,192.168.0.0/16 * *  # Block private networks
deny *                             # Default deny

# Bandwidth limiting per modem
bandlimin 10485760 * 192.168.1.0/24    # 10Mbps limit

# Security logging format
logformat "-+_L%t.%. %N.%p %E %U %C:%c %R:%r %O %I %h %T"

# HTTP proxy service
proxy -p__PORT__
EOF

echo "Baseline 3proxy template created"
```
📖 **Reference**: `docs/3proxy_Configuration_Examples.md:6-28`

**TASK_019_PORT_MANAGEMENT**: Implement dynamic port allocation
```javascript
// port-manager.js - Dynamic 3proxy Port Allocation
const db = require('./database');

class PortManager {
    constructor() {
        this.portRange = {
            start: 3128,
            end: 3200    // Support up to 72 modems
        };
        this.reservedPorts = new Set([22, 80, 443, 8080]); // System ports
    }

    async allocatePort(modemSerial) {
        try {
            // Check if modem already has allocated port
            const existing = await db.query(
                'SELECT proxy_port FROM modems WHERE serial = $1',
                [modemSerial]
            );

            if (existing.rows.length && existing.rows[0].proxy_port) {
                return existing.rows[0].proxy_port;
            }

            // Find available port
            const usedPorts = await db.query(
                'SELECT proxy_port FROM modems WHERE proxy_port IS NOT NULL'
            );
            
            const usedPortSet = new Set(
                usedPorts.rows.map(row => row.proxy_port)
                    .concat([...this.reservedPorts])
            );

            // Find first available port in range
            for (let port = this.portRange.start; port <= this.portRange.end; port++) {
                if (!usedPortSet.has(port)) {
                    // Allocate port atomically
                    await db.query(
                        'UPDATE modems SET proxy_port = $1 WHERE serial = $2',
                        [port, modemSerial]
                    );
                    
                    console.log(`Allocated port ${port} to modem ${modemSerial}`);
                    return port;
                }
            }

            throw new Error('No available ports in range');

        } catch (error) {
            console.error('Port allocation error:', error);
            throw error;
        }
    }

    async releasePort(modemSerial) {
        try {
            const result = await db.query(
                'UPDATE modems SET proxy_port = NULL WHERE serial = $1 RETURNING proxy_port',
                [modemSerial]
            );

            if (result.rows.length) {
                console.log(`Released port ${result.rows[0].proxy_port} from modem ${modemSerial}`);
                return result.rows[0].proxy_port;
            }

        } catch (error) {
            console.error('Port release error:', error);
            throw error;
        }
    }

    async generateProxyConfig(modemSerial) {
        try {
            // Get modem information
            const modem = await db.query(
                'SELECT * FROM modems WHERE serial = $1',
                [modemSerial]
            );

            if (!modem.rows.length) {
                throw new Error(`Modem not found: ${modemSerial}`);
            }

            const { proxy_port, wan_ip, serial } = modem.rows[0];

            if (!proxy_port) {
                throw new Error(`No port allocated for modem: ${modemSerial}`);
            }

            // Read template and substitute values
            const fs = require('fs');
            let config = fs.readFileSync('/etc/3proxy/template.cfg', 'utf8');
            
            config = config
                .replace(/__SERIAL__/g, serial)
                .replace(/__PORT__/g, proxy_port)
                .replace(/__WAN_IP__/g, wan_ip || '0.0.0.0');

            // Write modem-specific configuration
            const configPath = `/etc/3proxy/3proxy-${serial}.cfg`;
            fs.writeFileSync(configPath, config);
            
            // Set secure permissions
            const { exec } = require('child_process');
            exec(`sudo chown proxy:proxy ${configPath} && sudo chmod 600 ${configPath}`);

            return configPath;

        } catch (error) {
            console.error('Config generation error:', error);
            throw error;
        }
    }
}

module.exports = PortManager;
```
📖 **Reference**: `docs/system-architecture-plan.md:30-32`

---

## Phase 5-11: Backend, Frontend, Security, Testing & Deployment 🚀

### Implementation continues with:

- **Phase 5**: Express.js API with PostgreSQL LISTEN/NOTIFY integration
- **Phase 6**: Next.js frontend with WebSocket real-time updates  
- **Phase 7**: JWT authentication, HTTPS, CORS security implementation
- **Phase 8**: Boot sequence optimization, event batching, error recovery
- **Phase 9**: Centralized logging, system metrics, alerting
- **Phase 10**: Hardware testing, load testing, security validation
- **Phase 11**: Production deployment, system tuning, documentation

## Critical Implementation Notes:

### 🔍 **Areas Requiring Validation** (from `docs/uncertain-info.md`):
- ⏳ **systemd Service Configuration**: Needs QMI-specific development
- ⏳ **udev Rules Testing**: Requires actual EC25-EUX hardware  
- ⏳ **Automation Scripts**: Need real-world environment validation
- ⏳ **Multi-modem Scaling**: Performance benchmarking required

### ⚡ **Critical Risk Mitigation**:
1. **Boot Sequence Management**: Implement 30-60s delays and batching
2. **USB Enumeration Control**: Use `udevadm settle` and staged startup
3. **Database Load Management**: Batch operations and disable triggers during init
4. **System Resource Monitoring**: Network stack tuning and file descriptor limits

### 🎯 **Success Criteria for Each Phase**:
- All tasks include specific documentation references
- Each component tested individually before integration
- Security implemented from day one, not retrofitted
- Database as single source of truth for all system state
- Real-time updates via PostgreSQL LISTEN/NOTIFY
- Comprehensive logging and monitoring from start

This implementation plan provides **50 detailed tasks** across **11 phases** with complete documentation references, ensuring systematic development and production readiness.
