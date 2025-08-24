# systemd Complete Guide for Multi-Modem LTE Proxy System

## Overview

This document consolidates essential systemd concepts and implementations specifically for our **multi-modem LTE proxy system**. It covers instantiated services, resource management, cgroup delegation, boot sequence management, security hardening, and watchdog implementation.

**Project Context**: Managing 30+ EC25-EUX modems with individual 3proxy instances, event-driven architecture, and production-grade reliability requirements.

## Core systemd Concepts for Our Project

### Key Requirements Addressed:
1. **30 service instances** - 3proxy@serial.service templates
2. **Resource isolation** - per-modem memory/CPU limits
3. **Boot sequence control** - dependency management and timing
4. **Health monitoring** - watchdog and failure recovery
5. **Security hardening** - privilege restriction and isolation
6. **Network dependencies** - proper service ordering

---

## 1. Instantiated Services (Template Services) 🏭

### Concept
Instantiated services allow running multiple instances of the same service with different parameters. Perfect for our 30 modem setup where each needs its own 3proxy instance.

### Template Service Pattern
```bash
# Service name pattern: foobar@instance.service
# Template file: foobar@.service
# Instance example: 3proxy@EC25_12345.service
```

### Template Variables
- **%i** - exact instance identifier (escaped)
- **%I** - unescaped instance identifier (for display/commands)

### Our 3proxy Template Implementation

#### `/etc/systemd/system/3proxy@.service`
```ini
[Unit]
Description=3proxy Proxy Server for Modem %I
After=network.target postgresql.service udev-settled.service
Wants=postgresql.service
BindTo=dev-modem-%i.device
Conflicts=3proxy@.service

[Service]
Type=forking
ExecStart=/usr/local/3proxy/sbin/3proxy /etc/3proxy/3proxy-%i.cfg
ExecReload=/bin/kill -HUP $MAINPID
PIDFile=/var/run/3proxy-%i.pid
User=proxy
Group=proxy
Restart=on-failure
RestartSec=5

# Resource limits (per instance)
Slice=modems.slice
MemoryMax=128M
CPUQuota=2%
TasksMax=50

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/3proxy /var/run /etc/3proxy
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
DeviceAllow=/dev/null rw

# Watchdog configuration
WatchdogSec=60s
NotifyAccess=none

[Install]
WantedBy=multi-user.target
```

### Dynamic Instance Management
```bash
# Start specific modem instance
systemctl start 3proxy@EC25_12345.service

# Create instance from template automatically
systemctl enable 3proxy@EC25_12345.service

# List all instances
systemctl list-units '3proxy@*'

# Reload specific instance
systemctl reload 3proxy@EC25_12345.service
```

### Escaping Rules for Device Names
```bash
# Original device: /dev/serial/by-path/pci-0000:00:1d.0-usb-0:1.4:1.1
# Escaped: serial-by\x2dpath-pci\x2d0000:00:1d.0\x2dusb\x2d0:1.4:1.1
# Usage: 3proxy@serial-by\x2dpath-pci\x2d0000:00:1d.0\x2dusb\x2d0:1.4:1.1.service

# %i = escaped version (for dependencies)
# %I = unescaped version (for commands and display)
```

---

## 2. Resource Management & Control Groups 📊

### systemd Resource Control Architecture
systemd uses Linux cgroups for resource management with three approaches:

#### CPU Control
```ini
[Service]
# CPU shares (default 1024)
CPUShares=1500              # More CPU than default
CPUShares=512               # Less CPU than default

# CPU quota (percentage)
CPUQuota=25%                # Limit to 25% of one core
CPUQuota=200%               # Allow up to 2 full cores
```

#### Memory Control  
```ini
[Service]
# Memory limits
MemoryMax=128M              # Hard limit (OOM if exceeded)
MemorySoftLimit=100M        # Soft limit (allows bursts)
MemoryLow=50M               # Protected memory amount
```

#### Block I/O Control
```ini
[Service]
# I/O weight (10-1000, default 100)
BlockIOWeight=500           # Half priority I/O

# Per-device bandwidth limits
BlockIOReadBandwidth=/var/log 5M    # 5MB/s read limit
BlockIOWriteBandwidth=/var/log 2M   # 2MB/s write limit

# Per-device weight
BlockIODeviceWeight=/dev/sda 750    # Device-specific priority
```

### Advanced Resource Options
```ini
[Service]
# Low-level cgroup attributes
ControlGroupAttribute=memory.swappiness 70
ControlGroupAttribute=memory.oom_control 1

# Traditional process limits
LimitNOFILE=1024           # File descriptor limit
LimitNPROC=100             # Process limit (security)
LimitFSIZE=0               # Disable file creation (security)
```

### Our Modem Resource Configuration
```ini
# Resource slice for all modems
# /etc/systemd/system/modems.slice
[Unit]
Description=Slice for All Modem Services
Before=slices.target
Wants=slices.target

[Slice]
# Collective limits for all modems
MemoryMax=4G               # Total memory for all modems
CPUQuota=3000%             # Max 30 cores for all modems (30 modems * 100%)
TasksMax=1500              # Max 50 tasks per modem * 30 modems
```

### Resource Monitoring
```bash
# Monitor resource usage
systemd-cgtop

# Check specific service resources
systemctl status 3proxy@EC25_12345.service

# Show resource properties
systemctl show 3proxy@EC25_12345.service | grep -E "(Memory|CPU|BlockIO)"
```

---

## 3. Control Group Delegation 🎯

### Delegation Concept
Delegation allows services to manage their own sub-cgroups, essential for container-like isolation.

### Delegation Rules
1. **No processes in inner nodes** - cgroups are either inner nodes or leaf nodes
2. **Single writer rule** - only one process manages each cgroup

### Delegation Configuration
```ini
[Service]
# Enable cgroup delegation
Delegate=yes                    # Delegate all available controllers
Delegate=cpu memory pids        # Delegate specific controllers only

# Security considerations
User=proxy                      # Required for secure delegation
DelegateSubgroup=manager        # Put main process in subgroup
```

### Use Cases for Our Project
```bash
# If we need container-like isolation per modem:
# Each 3proxy instance gets its own delegated cgroup tree

[Service]
Delegate=yes
User=proxy
DelegateSubgroup=supervisor

# This allows 3proxy to create:
# /sys/fs/cgroup/system.slice/3proxy@EC25_12345.service/supervisor/
# /sys/fs/cgroup/system.slice/3proxy@EC25_12345.service/worker1/
# /sys/fs/cgroup/system.slice/3proxy@EC25_12345.service/worker2/
```

### Detection of Delegation
```bash
# Check if delegation is enabled
getxattr /sys/fs/cgroup/system.slice/3proxy@EC25_12345.service user.delegate

# Will return "1" if delegation is enabled
```

---

## 4. Boot Sequence & Dependency Management 🚀

### Boot Sequence Problems (Our Critical Issue)
**Problem**: 30 modems connecting simultaneously after power outage = system chaos

### Boot Assessment System
systemd provides automatic boot failure detection and recovery:

#### Boot Counter Mechanism
```bash
# Kernel entry with boot counting
/boot/loader/entries/kernel+3.conf     # 3 tries left
→ /boot/loader/entries/kernel+2-1.conf  # 2 tries left, 1 failed
→ /boot/loader/entries/kernel+1-2.conf  # 1 try left, 2 failed  
→ /boot/loader/entries/kernel+0-3.conf  # 0 tries left, 3 failed = BAD
```

#### Boot Success Targets
```ini
# Critical target for boot success
boot-complete.target

# Our service dependencies for boot success
[Unit]
Description=Boot Success Check for Modem System
Before=boot-complete.target
Wants=boot-complete.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/bin/modem-boot-check.sh
```

### Mount Requirements for Boot
**Critical for our system**:
- **initrd**: `/`, `/usr`, `/etc` must be available
- **early**: `/var`, `/var/tmp`, `/tmp` must be mounted before `local-fs.target`
- **regular**: `/home`, `/srv`, ESP can be mounted anytime

### Our Boot Sequence Strategy
```bash
# 1. Delay worker startup
After=postgresql.service udev-settled.service network.target

# 2. Staged modem activation
After=modems-boot-delay.service

# 3. Dependency chain
udev-settled → postgresql → modems-boot-delay → 3proxy@*.service
```

#### Boot Delay Service
```ini
# /etc/systemd/system/modems-boot-delay.service
[Unit]
Description=Modem System Boot Delay
After=udev-settled.service postgresql.service
Wants=postgresql.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/sleep 60
ExecStart=/usr/local/bin/check-usb-settled.sh

[Install]
WantedBy=multi-user.target
```

### Network Dependencies
```ini
# Network synchronization points
After=network.target          # Network stack ready
After=network-online.target   # Network connectivity established  
After=network-pre.target      # Before network configuration

# Our specific needs
After=network.target          # Basic network stack
Wants=network-online.target   # Wait for connectivity (optional)
```

---

## 5. Watchdog Implementation 🐕

### Hardware Watchdog (systemd-level)
```ini
# /etc/systemd/system.conf
[Manager]
RuntimeWatchdogSec=20s        # Hardware reset after 20s hang
ShutdownWatchdogSec=10min     # Extra safety during shutdown
```

### Software Watchdog (per-service)
```ini
[Service]
# Watchdog configuration
WatchdogSec=30s               # Service must ping every 30s
NotifyAccess=main             # Allow sd_notify() calls

# Failure handling
Restart=on-failure            # Restart on watchdog failure
StartLimitInterval=5min       # Time window for restart attempts
StartLimitBurst=4             # Max 4 restarts in 5min
StartLimitAction=reboot-force # System action if limit exceeded
```

### Our Modem Watchdog Strategy
```ini
# Individual modem watchdog
[Service]
WatchdogSec=60s               # Each modem pings every 60s
Restart=on-failure
StartLimitInterval=10min      # Longer window for modems
StartLimitBurst=3             # Max 3 restarts per modem
StartLimitAction=none         # Don't reboot system for single modem

# System-level watchdog for worker
[Service]
WatchdogSec=30s
StartLimitAction=reboot-force # System restart if worker fails
```

### Watchdog Implementation in Code
```javascript
// Node.js watchdog implementation
const sd = require('systemd-daemon');

// Send watchdog ping
function sendWatchdogPing() {
    if (process.env.WATCHDOG_USEC) {
        sd.notify('WATCHDOG=1');
    }
}

// Setup watchdog timer
const watchdogInterval = process.env.WATCHDOG_USEC ? 
    parseInt(process.env.WATCHDOG_USEC) / 2000 : 30000; // Half of interval

setInterval(sendWatchdogPing, watchdogInterval);
```

---

## 6. Security Hardening 🔒

### Network Isolation
```ini
[Service]
# Complete network isolation
PrivateNetwork=yes            # Service sees only loopback

# Use case: Local processing services that don't need network
```

### File System Security
```ini
[Service]
# Temporary file isolation
PrivateTmp=yes                # Private /tmp namespace

# Directory access control
ReadOnlyDirectories=/var      # Make /var read-only
InaccessibleDirectories=/home # Hide /home completely

# System protection
ProtectSystem=strict          # Most of filesystem read-only
ProtectHome=true              # Hide home directories
```

### Capability Restrictions
```ini
[Service]
# Capability management
CapabilityBoundingSet=CAP_NET_BIND_SERVICE CAP_SETUID
CapabilityBoundingSet=~CAP_SYS_PTRACE     # Remove dangerous capabilities

# Additional restrictions
NoNewPrivileges=true          # Prevent privilege escalation
```

### Device Access Control
```ini
[Service]
# Device whitelist
DeviceAllow=/dev/null rw      # Allow only specific devices
DeviceAllow=/dev/ttyUSB0 rw   # Allow modem serial port
```

### Our Security Profile
```ini
# Complete security configuration for 3proxy
[Service]
# User isolation
User=proxy
Group=proxy
SupplementaryGroups=dialout   # For modem access

# System protection
ProtectSystem=strict
ProtectHome=true
PrivateTmp=yes
NoNewPrivileges=true

# Capability restrictions  
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=~CAP_SYS_PTRACE CAP_SYS_ADMIN

# File system access
ReadWritePaths=/var/log/3proxy /var/run /etc/3proxy
ReadOnlyDirectories=/etc

# Device access
DeviceAllow=/dev/null rw
DeviceAllow=/dev/ttyUSB* rw    # Modem serial ports
DeviceAllow=/dev/cdc-wdm* rw   # QMI interfaces

# Resource limits for security
LimitNPROC=10                 # Limit process creation
LimitFSIZE=100M               # Limit file creation
```

---

## 7. Socket Activation (Optional Enhancement) 🔌

### Concept
Socket activation allows starting services on-demand when connections arrive, useful for our Node.js API.

### Socket Configuration
```ini
# /etc/systemd/system/modem-api.socket
[Socket]
ListenStream=8080             # HTTP API port
Accept=false                  # Single instance handles all connections

[Install]
WantedBy=sockets.target
```

### Service Configuration
```ini
# /etc/systemd/system/modem-api.service
[Service]
ExecStart=/usr/bin/node /opt/modem-api/server.js
User=modem-api
Group=modem-api

[Install]
WantedBy=multi-user.target
```

### Node.js Implementation
```javascript
// Socket activation support in Express.js
const express = require('express');
const sd = require('systemd-daemon');

const app = express();

// Check for systemd socket activation
const listenFds = sd.listen_fds();
if (listenFds.length > 0) {
    // Use socket from systemd
    const server = app.listen({ fd: 3 }); // SD_LISTEN_FDS_START = 3
} else {
    // Fallback to regular listen
    app.listen(8080);
}
```

---

## 8. Complete Service Integration Example

### Master Service Unit
```ini
# /etc/systemd/system/modem-system.service
[Unit]
Description=Multi-Modem LTE Proxy System Master Service
After=network.target postgresql.service udev-settled.service
Wants=postgresql.service
Conflicts=shutdown.target

[Service]
Type=notify
ExecStart=/usr/local/bin/modem-master.js
User=modem-system
Group=modem-system

# Resource management
Slice=modems.slice
MemoryMax=512M
CPUQuota=100%

# Security
ProtectSystem=strict
ProtectHome=true
PrivateTmp=yes
NoNewPrivileges=true
CapabilityBoundingSet=CAP_NET_BIND_SERVICE

# Watchdog
WatchdogSec=30s
Restart=on-failure
StartLimitInterval=10min
StartLimitBurst=3
StartLimitAction=reboot-force

# Environment
Environment=NODE_ENV=production
EnvironmentFile=/etc/modem-system/config

[Install]
WantedBy=multi-user.target
Also=modem-api.socket modem-scanner.path
```

### Supporting Units
```ini
# Path-based activation for device scanning
# /etc/systemd/system/modem-scanner.path
[Path]
PathChanged=/dev/serial/by-id/
PathChanged=/dev/cdc-wdm*

[Install]
WantedBy=multi-user.target

# Timer for health checks
# /etc/systemd/system/modem-health.timer
[Timer]
OnBootSec=5min
OnUnitActiveSec=2min

[Install]
WantedBy=timers.target
```

---

## 9. Troubleshooting & Debugging

### Common Commands
```bash
# Check service status
systemctl status 3proxy@EC25_12345.service

# View logs
journalctl -u 3proxy@EC25_12345.service -f

# Check dependencies
systemctl list-dependencies 3proxy@EC25_12345.service

# Resource usage
systemd-cgtop
systemctl show 3proxy@EC25_12345.service | grep -E "(Memory|CPU)"

# Boot analysis
systemd-analyze blame
systemd-analyze critical-chain

# List all instances
systemctl list-units '3proxy@*'
```

### Boot Problems Debugging
```bash
# Check boot timing
systemd-analyze

# Critical chain analysis
systemd-analyze critical-chain multi-user.target

# Check failed services
systemctl --failed
```

### Resource Problems
```bash
# Check cgroup limits
cat /proc/cgroups
ls -la /sys/fs/cgroup/system.slice/

# Monitor resource usage
systemd-cgtop -p

# Check memory pressure
systemctl show system.slice | grep Memory
```

---

## 10. Production Deployment Checklist

### ✅ **systemd Configuration Checklist**
- [ ] Template services configured with proper escaping
- [ ] Resource limits set for all instances
- [ ] Security hardening applied (capabilities, file system)
- [ ] Watchdog configured at system and service level
- [ ] Boot dependencies properly ordered
- [ ] Logging configuration optimized
- [ ] Hardware watchdog enabled in system.conf
- [ ] Boot counting enabled for automatic recovery

### ⚠️ **Critical Settings for 30 Modems**
```bash
# System limits
echo "DefaultLimitNOFILE=65536" >> /etc/systemd/system.conf
echo "DefaultLimitNPROC=4096" >> /etc/systemd/system.conf

# Hardware watchdog
echo "RuntimeWatchdogSec=30s" >> /etc/systemd/system.conf

# Boot delay for USB settling
echo "DefaultTimeoutStartSec=300s" >> /etc/systemd/system.conf
```

This guide provides complete systemd integration for our multi-modem LTE proxy system, addressing all critical aspects from resource management to boot sequence control and security hardening.
