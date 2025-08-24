# QMI Scaling Guide - Basic Concepts

## Overview

This guide covers basic concepts for **scaling QMI modem deployments** on **Ubuntu Server 24.04.3 LTS** with **native EC25-EUX support**. This focuses on fundamental QMI protocol understanding for multiple device scenarios.

### 🎉 **Ubuntu 24.04.3 LTS Native EC25-EUX Benefits for Scaling:**
- ✅ **Simplified deployment** - No custom driver compilation for multiple modems
- ✅ **Consistent device enumeration** - Kernel 6.8 enhanced USB handling
- ✅ **Better resource management** - Improved QMI subsystem efficiency
- ✅ **Reduced complexity** - Native support eliminates driver compatibility issues

---

## QMI Protocol Fundamentals for Scaling

### Core QMI Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Multiple QMI Devices                    │
├─────────────────────────────────────────────────────────────┤
│  Device 1     │  Device 2     │  Device N                   │
│  /dev/cdc-wdm0│  /dev/cdc-wdm1│  /dev/cdc-wdmN             │
├─────────────────────────────────────────────────────────────┤
│               libqmi-glib Library                           │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────────────┐  │
│  │   qmicli    │ │ModemManager  │ │  Custom Applications│  │
│  │ (per device)│ │  (manages    │ │   (per device)      │  │
│  │             │ │   all)       │ │                     │  │
│  └─────────────┘ └──────────────┘ └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│            Ubuntu Server 24.04.3 LTS (Native EC25)       │
└─────────────────────────────────────────────────────────────┘
```

### Multiple Device Management

#### Device Enumeration
```bash
# List all QMI devices
qmicli -L

# Enumerate devices programmatically
for device in /dev/cdc-wdm*; do
    echo "Checking device: $device"
    qmicli -d "$device" --dms-get-model
done
```

#### Per-Device Commands
```bash
# Get information from multiple devices
qmicli -d /dev/cdc-wdm0 --dms-get-manufacturer
qmicli -d /dev/cdc-wdm1 --dms-get-manufacturer
qmicli -d /dev/cdc-wdm2 --dms-get-manufacturer

# Check signal strength across devices
for device in /dev/cdc-wdm*; do
    echo "Signal for $device:"
    qmicli -d "$device" --nas-get-signal-strength
done
```

---

## ModemManager Multi-Device Support

### Device Discovery
```bash
# List all modems managed by ModemManager
mmcli -L

# Get information for specific modems
mmcli -m 0  # First modem
mmcli -m 1  # Second modem
mmcli -m 2  # Third modem
```

### Batch Operations
```bash
# Check status of all modems
for modem in $(mmcli -L | grep -o '/org/freedesktop/ModemManager1/Modem/[0-9]*' | cut -d'/' -f6); do
    echo "Modem $modem status:"
    mmcli -m "$modem" --simple-status
done
```

---

## USB Device Considerations

### Device Detection
```bash
# List all Quectel devices (vendor ID: 2c7c)
lsusb | grep 2c7c

# Check USB device tree for multiple modems
lsusb -t

# Monitor new device connections
udevadm monitor --environment --udev | grep -i qmi
```

### Interface Mapping
```bash
# Understand device-to-interface mapping
for device in /sys/class/usbmisc/cdc-wdm*; do
    if [ -e "$device" ]; then
        echo "Device: $(basename $device)"
        echo "  Path: $(readlink -f $device)"
    fi
done
```

---

## Basic Scaling Concepts

### Device Independence
- Each QMI device operates independently
- `/dev/cdc-wdm*` devices are separate control channels
- ModemManager manages multiple modems simultaneously
- No shared state between QMI devices

### Command Isolation
```bash
# Each device requires explicit targeting
qmicli -d /dev/cdc-wdm0 --nas-get-signal-strength  # Device 0 only
qmicli -d /dev/cdc-wdm1 --nas-get-signal-strength  # Device 1 only

# No broadcast or group commands in basic QMI
```

### Network Interface Scaling
```bash
# Each QMI device typically creates its own network interface
ip link show | grep wwan

# Example output for multiple devices:
# wwan0: ... (from /dev/cdc-wdm0)
# wwan1: ... (from /dev/cdc-wdm1)
# wwan2: ... (from /dev/cdc-wdm2)
```

---

## System Resource Considerations

### Kernel Module Support
```bash
# Verify drivers support multiple devices
lsmod | grep qmi_wwan
lsmod | grep qcserial

# Check module parameters
modinfo qmi_wwan | grep -i param
```

### File Descriptor Usage
```bash
# Each QMI device opens file descriptors
ls -la /dev/cdc-wdm*

# ModemManager process file descriptor usage
lsof -p $(pgrep ModemManager) | grep cdc-wdm
```

---

## Limitations and Considerations

### Hardware Limitations
- USB bandwidth shared among devices on same controller
- Power consumption increases linearly with device count
- Physical USB port availability

### Software Limitations  
- No built-in load balancing in basic QMI tools
- Each device must be managed individually
- No automatic failover mechanisms

### System Limits
```bash
# Check current system limits
ulimit -n  # File descriptor limit
cat /proc/sys/fs/file-max  # System-wide file limit

# Check USB device limits
cat /sys/module/usbcore/parameters/autosuspend
```

---

## Kernel Parameter Analysis

Based on provided documentation analysis, standard high-performance kernel parameters are **not required** for QMI scaling:

```bash
# These parameters are for high-throughput applications, not QMI control:
# net.core.rmem_max = 134217728    # For Oracle DB, not QMI
# kernel.pid_max = 4194304         # For thousands of processes, QMI creates few

# More relevant for QMI scaling (if needed):
# USB timeouts for stability
echo 5000 > /sys/module/usbcore/parameters/autosuspend

# Network backlog (only for many modems)
# net.core.netdev_max_backlog = 5000
```

---

## References

### Core QMI Components
- **libqmi-glib**: QMI protocol library supporting multiple devices
- **qmicli**: Command-line tool for per-device operations  
- **ModemManager**: Multi-modem management daemon
- **qmi_wwan**: Kernel driver supporting multiple interfaces

### Ubuntu 24.04.3 LTS LTS Integration
- Standard package management via apt
- systemd service integration for ModemManager
- journald logging for all devices

---

## Next Steps

For production scaling scenarios beyond basic multi-device support:

- Refer to `uncertain-info.md` for areas requiring additional documentation
- Test with actual hardware for performance validation
- Consult vendor documentation for hardware-specific scaling limits

**Note:** This guide covers basic multi-device QMI concepts. Advanced automation, monitoring, and hardware optimization require additional validation and documentation.
