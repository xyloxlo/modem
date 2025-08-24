# QMI Complete Documentation Guide for Ubuntu Server 24.04.3 LTS

## Overview

This guide covers **Qualcomm MSM Interface (QMI)** implementation on **Ubuntu Server 24.04.3 LTS** with **native EC25-EUX support**. QMI is the primary protocol for controlling Qualcomm-based cellular modems, including the **Quectel EC25-EUX** which is **natively supported** in kernel 6.8+ (no custom drivers needed).

### 🎉 **Ubuntu 24.04.3 LTS Benefits for EC25-EUX:**
- ✅ **Native EC25-EUX support** - Kernel 6.8 includes built-in drivers
- ✅ **Enhanced QMI subsystem** - Better performance and stability  
- ✅ **No custom drivers needed** - Plug-and-play functionality
- ✅ **Improved USB hotplug** - More reliable device detection

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│              Ubuntu Server 24.04.3 LTS (Native EC25)      │
├─────────────────────────────────────────────────────────────┤
│  QMI Management Layer                                       │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────────────┐  │
│  │ModemManager │ │    qmicli    │ │   libqmi-glib       │  │
│  │  (daemon)   │ │  (CLI tool)  │ │   (library)         │  │
│  └─────────────┘ └──────────────┘ └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  Kernel Drivers                                             │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────────────┐  │
│  │ qmi_wwan    │ │   qcserial   │ │     option          │  │
│  │  (data)     │ │    (AT)      │ │    (fallback)       │  │
│  └─────────────┘ └──────────────┘ └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  Hardware Layer                                             │
│  │   EC25-EUX and compatible QMI devices                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Installation & Setup

### Package Installation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install QMI packages (validated for Ubuntu 24.04.3 LTS with native EC25-EUX support)
sudo apt install -y \
    libqmi-utils \
    libqmi-glib0 \
    libqmi-proxy \
    modemmanager \
    modemmanager-dev \
    libqmi-glib-dev \
    gir1.2-qmi-1.0
```

### Standard File System Locations

**Configuration:**
- `/etc/qmi-network.conf` - qmi-network script configuration
- `/etc/ModemManager/` - ModemManager configuration directory

**Binaries:**
- `/usr/bin/qmicli` - main QMI tool
- `/usr/bin/qmi-network` - QMI network management script

**Logging:**
- `/var/log/messages` - main system logs (contain QMI information)
- `/var/log/syslog` - alternative system log location

**Runtime:**
- `/dev/cdc-wdm0` (or similar) - QMI device files
- `/run/ModemManager/` or `/var/run/ModemManager/` - runtime data

---

## QMI Protocol Fundamentals

### QMI Architecture Components

**Core Components:**
- **qmuxd** - QMI multiplexer daemon (on modem)
- **libqmi-glib** - Open-source QMI library
- **qmicli** - Command-line QMI tool
- **ModemManager** - High-level modem management daemon

**Protocol Infrastructure:**
- **SMD (Shared Memory Device)** channels
- **IPC Router (AF_MSM_IPC)** - Inter-process communication
- **BAM (Bus Access Manager)** - DMA engine
- **rmnet** network interfaces

### QMI Services

```bash
# Device Management Service (DMS)
qmicli -d /dev/cdc-wdm0 --dms-get-manufacturer
qmicli -d /dev/cdc-wdm0 --dms-get-model
qmicli -d /dev/cdc-wdm0 --dms-get-revision
qmicli -d /dev/cdc-wdm0 --dms-get-ids

# Wireless Data Service (WDS)
qmicli -d /dev/cdc-wdm0 --wds-get-packet-service-status
qmicli -d /dev/cdc-wdm0 --wds-get-data-bearer-technology

# Network Access Service (NAS)
qmicli -d /dev/cdc-wdm0 --nas-get-signal-strength
qmicli -d /dev/cdc-wdm0 --nas-get-serving-system

# User Identity Module (UIM)
qmicli -d /dev/cdc-wdm0 --uim-get-card-status
qmicli -d /dev/cdc-wdm0 --uim-get-supported-messages
```

---

## Basic QMI Commands

### Device Detection and Status

```bash
# List QMI devices
qmicli -L

# Check device capabilities
qmicli -d /dev/cdc-wdm0 --dms-get-capabilities

# Get device information
qmicli -d /dev/cdc-wdm0 --dms-get-manufacturer
qmicli -d /dev/cdc-wdm0 --dms-get-model
qmicli -d /dev/cdc-wdm0 --dms-get-revision
qmicli -d /dev/cdc-wdm0 --dms-get-msisdn

# Check SIM status
qmicli -d /dev/cdc-wdm0 --uim-get-card-status
```

### Network Operations

```bash
# Get signal information
qmicli -d /dev/cdc-wdm0 --nas-get-signal-strength
qmicli -d /dev/cdc-wdm0 --nas-get-signal-info

# Check network registration
qmicli -d /dev/cdc-wdm0 --nas-get-serving-system
qmicli -d /dev/cdc-wdm0 --nas-get-system-info

# Get operator information
qmicli -d /dev/cdc-wdm0 --nas-get-home-network
qmicli -d /dev/cdc-wdm0 --nas-get-preferred-networks
```

### Data Connection Management

```bash
# Check packet service status
qmicli -d /dev/cdc-wdm0 --wds-get-packet-service-status

# Get current data bearer technology
qmicli -d /dev/cdc-wdm0 --wds-get-data-bearer-technology

# Get packet statistics
qmicli -d /dev/cdc-wdm0 --wds-get-packet-statistics
```

---

## ModemManager Integration

### Basic ModemManager Commands

```bash
# List modems managed by ModemManager
mmcli -L

# Get modem information
mmcli -m 0

# Get detailed modem status
mmcli -m 0 --simple-status

# Monitor modem status
mmcli -m 0 --monitor-state
```

### ModemManager Configuration

```bash
# Enable debug logging
systemctl edit ModemManager
# Add: Environment="MM_LOGLEVEL=DEBUG"

# Check ModemManager logs
journalctl -u ModemManager -f

# Restart ModemManager service
sudo systemctl restart ModemManager
```

---

## EC25-EUX Specific Information

### USB Gadget Configuration

The EC25-EUX modem internal Linux system supports USB gadget reconfiguration:

```bash
# Inside EC25-EUX modem (via AT+QCFG="usbcfg")
echo 0 > /sys/class/android_usb/android0/enable
echo adb,diag,serial,rmnet > /sys/class/android_usb/android0/functions  
echo 1 > /sys/class/android_usb/android0/enable
```

### Internal Architecture

- **Qualcomm MSM 9x70 chipset**
- **Cortex-A5 core**
- **Internal Linux distribution**
- **Multiple USB interfaces** (ADB, DIAG, Serial, rmnet/QMI)

### QMI Communication Tracing

On the modem's internal system, QMI communications can be traced:

```bash
# Using qmuxd_wrapper for tracing
LD_PRELOAD=/home/root/qmuxd_wrapper.so atfwd_daemon
```

---

## References and Resources

### Official QMI Documentation

- **libqmi project**: Open-source QMI implementation
- **ModemManager**: High-level cellular modem management
- **QMI Protocol Specification**: Qualcomm proprietary protocol documentation

### Ubuntu 24.04.3 LTS Native Integration

- Package management via apt
- systemd service integration
- Standard Linux filesystem hierarchy compliance
- journald logging integration

---

## Next Steps

For advanced features beyond basic QMI operations, refer to:

- `uncertain-info.md` - Lists areas requiring additional documentation or testing
- Vendor-specific documentation for production deployments
- Real-world testing for multi-modem scaling scenarios

**Note:** This documentation covers validated, basic QMI functionality. Advanced automation, monitoring, and scaling features require additional validation and documentation.