# QMI Port Configuration & Device Mapping Guide

## Overview

This guide provides basic instructions for **port configuration and device mapping** when working with QMI modems on **Ubuntu Server 24.04.3 LTS** with **native EC25-EUX support**. Based on provided documentation for the **EC25-EUX** modem architecture.

### 🎉 **Ubuntu 24.04.3 LTS Native Support Benefits:**
- ✅ **Automatic port detection** - Kernel 6.8 enhanced USB enumeration
- ✅ **Consistent device mapping** - No manual driver configuration needed
- ✅ **Improved stability** - Native drivers reduce configuration complexity

---

## EC25-EUX USB Interface Architecture

### USB Configuration Layout

```
┌─────────────────────────────────────────────────────────────┐
│                    Quectel EC25-EUX USB Device             │
├─────────────────────────────────────────────────────────────┤
│  USB Configuration 1 (Default - 5 interfaces)              │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────────────┐  │
│  │ Interface 0 │ │ Interface 1  │ │   Interface 2       │  │
│  │   diag      │ │    serial    │ │     serial          │  │
│  │ (diagnostic)│ │   (GPS)      │ │   (AT Primary)      │  │
│  └─────────────┘ └──────────────┘ └─────────────────────┘  │
│  ┌─────────────┐ ┌──────────────┐                         │
│  │ Interface 3 │ │ Interface 4  │                         │
│  │   serial    │ │   rmnet      │                         │
│  │(AT Secondary)│ │(QMI+Data)    │← PRIMARY QMI INTERFACE │
│  └─────────────┘ └──────────────┘                         │
├─────────────────────────────────────────────────────────────┤
│  USB Configuration 2 (ADB Enabled - 6 interfaces)         │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────────────┐  │
│  │ Interface 0 │ │ Interface 1  │ │   Interface 2       │  │
│  │     adb     │ │    diag      │ │     serial          │  │
│  │  (debug)    │ │ (diagnostic) │ │     (GPS)           │  │
│  └─────────────┘ └──────────────┘ └─────────────────────┘  │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────────────┐  │
│  │ Interface 3 │ │ Interface 4  │ │   Interface 5       │  │
│  │   serial    │ │    serial    │ │     rmnet           │  │
│  │(AT Primary) │ │(AT Secondary)│ │  (QMI+Data)         │  │
│  └─────────────┘ └──────────────┘ └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Linux Device Mapping

```bash
# Default Configuration (5 interfaces)
Interface 0 (diag) → /dev/ttyUSB0 (qcserial driver)
Interface 1 (GPS)  → /dev/ttyUSB1 (qcserial driver) 
Interface 2 (AT1)  → /dev/ttyUSB2 (qcserial driver)
Interface 3 (AT2)  → /dev/ttyUSB3 (qcserial driver)
Interface 4 (rmnet)→ /dev/cdc-wdm0 (qmi_wwan driver)

# ADB Configuration (6 interfaces)
Interface 0 (adb)  → No device file (ADB over USB)
Interface 1 (diag) → /dev/ttyUSB0 (qcserial driver)
Interface 2 (GPS)  → /dev/ttyUSB1 (qcserial driver)
Interface 3 (AT1)  → /dev/ttyUSB2 (qcserial driver) 
Interface 4 (AT2)  → /dev/ttyUSB3 (qcserial driver)
Interface 5 (rmnet)→ /dev/cdc-wdm0 (qmi_wwan driver)
```

---

## USB Gadget Reconfiguration

### Internal Modem Configuration

The EC25-EUX runs an internal Linux system that supports USB gadget reconfiguration:

```bash
# Reconfigure USB interfaces (executed inside modem)
echo 0 > /sys/class/android_usb/android0/enable
echo adb,diag,serial,rmnet > /sys/class/android_usb/android0/functions
echo 1 > /sys/class/android_usb/android0/enable
```

### Available USB Functions

- **adb** - Android Debug Bridge interface
- **diag** - Diagnostic interface (Qualcomm DIAG protocol)  
- **serial** - Multiple serial interfaces (AT commands, GPS)
- **rmnet** - Raw IP interface for QMI communication

---

## Basic Device Detection

### QMI Device Detection

```bash
# List available QMI devices
qmicli -L

# Check QMI device capabilities
qmicli -d /dev/cdc-wdm0 --dms-get-capabilities

# Get device information
qmicli -d /dev/cdc-wdm0 --dms-get-manufacturer
qmicli -d /dev/cdc-wdm0 --dms-get-model
qmicli -d /dev/cdc-wdm0 --dms-get-revision
```

### USB Device Detection

```bash
# List USB devices (Quectel vendor ID: 2c7c)
lsusb | grep 2c7c

# Check EC25-EUX specific device
lsusb -v -d 2c7c:0125

# List serial interfaces
ls -la /dev/ttyUSB*
```

### ModemManager Integration

```bash
# List modems managed by ModemManager
mmcli -L

# Get modem information
mmcli -m 0

# Monitor ModemManager for device detection
journalctl -u ModemManager -f
```

---

## QMI Interface Configuration

### Raw IP Mode

```bash
# Configure QMI device for raw IP mode
qmicli -d /dev/cdc-wdm0 --wda-set-data-format="link-layer-protocol=raw-ip"

# Verify data format configuration
qmicli -d /dev/cdc-wdm0 --wda-get-data-format
```

### Basic QMI Commands

```bash
# Device Management Service (DMS)
qmicli -d /dev/cdc-wdm0 --dms-get-ids
qmicli -d /dev/cdc-wdm0 --dms-get-msisdn

# Network Access Service (NAS)  
qmicli -d /dev/cdc-wdm0 --nas-get-signal-strength
qmicli -d /dev/cdc-wdm0 --nas-get-serving-system

# Wireless Data Service (WDS)
qmicli -d /dev/cdc-wdm0 --wds-get-packet-service-status
qmicli -d /dev/cdc-wdm0 --wds-get-packet-statistics
```

---

## Kernel Drivers

### Driver Modules

```bash
# Check loaded QMI-related modules
lsmod | grep qmi_wwan
lsmod | grep qcserial
lsmod | grep option

# Module information
modinfo qmi_wwan
modinfo qcserial
```

### Driver Responsibilities

- **qmi_wwan**: Handles QMI data interface (/dev/cdc-wdm* devices)
- **qcserial**: Handles Qualcomm serial interfaces (/dev/ttyUSB* devices)
- **option**: Generic USB serial driver (fallback)

---

## Troubleshooting

### Common Detection Issues

```bash
# Check USB enumeration
dmesg | grep -i "new.*device"
dmesg | grep -i "qmi\|qcserial"

# Verify QMI device creation
ls -la /dev/cdc-wdm*

# Force driver reload if needed
sudo modprobe -r qmi_wwan qcserial option
sudo modprobe qmi_wwan qcserial option
```

### Debug Information

```bash
# Monitor USB device events
udevadm monitor --environment --udev

# Get detailed device information  
udevadm info -a -p /sys/class/usbmisc/cdc-wdm0
```

---

## References

### Key Components
- **libqmi-glib**: QMI protocol library
- **qmicli**: Command-line QMI interface
- **ModemManager**: High-level modem management daemon

### File Locations (Ubuntu 24.04.3 LTS LTS)
- `/usr/bin/qmicli` - QMI command-line tool
- `/etc/ModemManager/` - ModemManager configuration
- `/var/log/messages` - System logs containing QMI information

---

## Next Steps

For advanced configuration scenarios:
- Refer to `uncertain-info.md` for areas requiring additional documentation
- Test with actual EC25-EUX hardware for validation
- Consult vendor documentation for production deployments

**Note:** This guide covers basic device architecture and detection based on provided documentation.
