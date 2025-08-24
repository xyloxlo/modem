# EC25-EUX AT Commands Reference Guide

## Overview

This comprehensive reference covers AT commands for the **Quectel EC25-EUX LTE modem**, based on the official EC25&EC21 AT Commands Manual v1.3 (2018-09-20). The EC25-EUX is a multi-mode LTE Cat 4 module supporting voice calls, SMS messaging, and high-speed data connectivity.

### Key Features
- **LTE Cat 4**: Up to 150 Mbps DL / 50 Mbps UL
- **Voice Support**: VoLTE and Circuit Switched Fallback (CSFB)
- **SMS**: Full SMS support including concatenated messages
- **Interfaces**: USB (AT/Modem), UART, audio interface
- **Standards**: 3GPP TS 27.007, 27.005, V.25ter compliant

### AT Command Syntax
- **Basic**: `AT<command><parameters>`
- **Extended**: `AT+<command>=<parameters>`
- **Termination**: Commands end with `<CR>` (ASCII 13)
- **Response Format**: `<CR><LF><response><CR><LF>`

---

## Command Categories

### 1. **System & Configuration**
Essential commands for module setup and configuration.

| Command | Description | Example |
|---------|-------------|---------|
| `ATI` | Product identification | `ATI` → `EC25` |
| `AT+GMR` | Firmware version | `AT+GMR` → `EC25EFAR02A09M4G` |
| `AT+CGSN` | IMEI number | `AT+CGSN` → `867549048123456` |
| `AT+CFUN` | Set functionality | `AT+CFUN=1` (full functionality) |
| `AT+CMEE` | Error format | `AT+CMEE=2` (verbose errors) |
| `AT+CSCS` | Character set | `AT+CSCS="GSM"` |
| `AT&F` | Factory defaults | `AT&F` |
| `AT+QPOWD` | Power down | `AT+QPOWD=1` (normal shutdown) |

### 2. **SIM/USIM Management**
Commands for SIM card operations and security.

| Command | Description | Example |
|---------|-------------|---------|
| `AT+CPIN` | Enter PIN | `AT+CPIN="1234"` |
| `AT+CIMI` | Read IMSI | `AT+CIMI` → `460030912345678` |
| `AT+QCCID` | Read ICCID | `AT+QCCID` → `89860012345678901234` |
| `AT+CLCK` | Facility lock | `AT+CLCK="SC",2` (query SIM lock) |
| `AT+CPWD` | Change password | `AT+CPWD="SC","1234","5678"` |
| `AT+QSIMDET` | SIM detection | `AT+QSIMDET=1,0` (enable hot-swap) |
| `AT+QINISTAT` | Init status | `AT+QINISTAT` → `7` (all ready) |

### 3. **Network & Registration**
Commands for network selection and registration status.

| Command | Description | Example |
|---------|-------------|---------|
| `AT+COPS` | Operator selection | `AT+COPS=1,2,"46000"` |
| `AT+CREG` | Network registration | `AT+CREG=2` (enable location info) |
| `AT+CGREG` | GPRS registration | `AT+CGREG=2` |
| `AT+CEREG` | LTE registration | `AT+CEREG=2` |
| `AT+CSQ` | Signal quality | `AT+CSQ` → `+CSQ: 25,99` |
| `AT+QNWINFO` | Network info | Shows technology, operator, band, channel |
| `AT+QSPN` | Network name | Shows registered network name |
| `AT+QLTS` | Network time | `AT+QLTS=2` (local time) |

### 4. **Voice Calls**
Commands for voice call management.

| Command | Description | Example |
|---------|-------------|---------|
| `ATD` | Dial number | `ATD+1234567890;` |
| `ATA` | Answer call | `ATA` |
| `ATH` | Hang up | `ATH` |
| `AT+CHUP` | Hang up | `AT+CHUP` |
| `AT+CLCC` | List calls | Shows all active calls |
| `AT+CHLD` | Call hold/multiparty | `AT+CHLD=2` (hold/accept) |
| `AT+VTS` | Send DTMF | `AT+VTS="123"` |
| `AT+CLVL` | Volume level | `AT+CLVL=5` |
| `AT+CMUT` | Mute control | `AT+CMUT=1` (mute on) |

### 5. **SMS Messaging**
Complete SMS functionality including concatenated messages.

| Command | Description | Example |
|---------|-------------|---------|
| `AT+CMGF` | Message format | `AT+CMGF=1` (text mode) |
| `AT+CSCA` | Service center | `AT+CSCA="+1234567890"` |
| `AT+CMGS` | Send SMS | `AT+CMGS="+1234567890"` |
| `AT+CMGR` | Read SMS | `AT+CMGR=1` |
| `AT+CMGL` | List SMS | `AT+CMGL="ALL"` |
| `AT+CMGD` | Delete SMS | `AT+CMGD=1` |
| `AT+CPMS` | Storage selection | `AT+CPMS="SM","SM","SM"` |
| `AT+CNMI` | New message indication | `AT+CNMI=1,2,0,1,0` |
| `AT+QCMGS` | Send concatenated | For long messages |

### 6. **Data Connectivity**
Packet Data Protocol (PDP) context management.

| Command | Description | Example |
|---------|-------------|---------|
| `AT+CGATT` | GPRS attach | `AT+CGATT=1` |
| `AT+CGDCONT` | Define PDP context | `AT+CGDCONT=1,"IP","internet"` |
| `AT+CGACT` | Activate context | `AT+CGACT=1,1` |
| `AT+CGPADDR` | Get IP address | `AT+CGPADDR=1` |
| `AT+CGEREP` | Event reporting | `AT+CGEREP=2,1` |
| `AT+CGDATA` | Enter data mode | `AT+CGDATA="PPP",1` |
| `AT+QGDCNT` | Data counter | Track data usage |

### 7. **Audio Configuration**
Advanced audio interface control for voice applications.

| Command | Description | Example |
|---------|-------------|---------|
| `AT+QAUDMOD` | Audio mode | `AT+QAUDMOD=0` (handset) |
| `AT+QDAI` | Digital audio interface | `AT+QDAI=3,0,0,4,0,0,1,1` |
| `AT+QEEC` | Echo cancellation | Configure echo parameters |
| `AT+QMIC` | Microphone gain | `AT+QMIC=20000,5000` |
| `AT+QRXGAIN` | Speaker gain | `AT+QRXGAIN=8192` |
| `AT+QTONEDET` | DTMF detection | `AT+QTONEDET=1` |
| `AT+QLDTMF` | Local DTMF | `AT+QLDTMF=2,"123"` |

### 8. **Supplementary Services**
Network supplementary services for call management.

| Command | Description | Example |
|---------|-------------|---------|
| `AT+CCFC` | Call forwarding | `AT+CCFC=0,3,"+1234567890"` |
| `AT+CCWA` | Call waiting | `AT+CCWA=1,1` |
| `AT+CLIP` | Caller ID presentation | `AT+CLIP=1` |
| `AT+CLIR` | Caller ID restriction | `AT+CLIR=1` |
| `AT+CUSD` | USSD | `AT+CUSD=1,"*100#"` |

---

## Essential Commands Quick Reference

### **Initial Setup Sequence**
```
AT                          // Test communication
AT+CFUN=1                   // Enable full functionality  
AT+CPIN="1234"             // Enter PIN (if required)
AT+CREG=2                  // Enable network registration URC
AT+COPS=0                  // Automatic operator selection
```

### **SMS Setup**
```
AT+CMGF=1                  // Text mode
AT+CSCS="GSM"             // Character set
AT+CNMI=1,2,0,1,0         // Enable SMS URCs
AT+CSCA="+1234567890"     // Set SMS center
```

### **Data Connection Setup**
```
AT+CGDCONT=1,"IP","internet"    // Define PDP context
AT+CGATT=1                      // Attach to GPRS
AT+CGACT=1,1                   // Activate context
AT+CGPADDR=1                   // Get IP address
```

### **Voice Call Setup**
```
AT+QAUDMOD=0              // Set handset mode
AT+CLVL=5                 // Set volume
AT+CLIP=1                 // Enable caller ID
ATD+1234567890;           // Make call
```

---

## URC (Unsolicited Result Codes)

URCs provide automatic notifications of network events:

| URC | Description | Example |
|-----|-------------|---------|
| `+CREG:` | Network registration | `+CREG: 1,"1A2B","3C4D5E6F",7` |
| `+CGREG:` | GPRS registration | `+CGREG: 1,"1A2B","3C4D5E6F",7` |
| `+CEREG:` | LTE registration | `+CEREG: 1,"1A2B","3C4D5E6F",7` |
| `RING` | Incoming call | Followed by `+CLIP:` if enabled |
| `+CMT:` | Incoming SMS | Direct SMS delivery |
| `+CMTI:` | SMS received | SMS stored to memory |
| `+CGEV:` | PDP events | Context activation/deactivation |
| `+CCWA:` | Call waiting | Second call waiting |

---

## Error Handling

### **CME Errors (Mobile Equipment)**
```
+CME ERROR: 10         // SIM not inserted
+CME ERROR: 11         // SIM PIN required  
+CME ERROR: 13         // SIM failure
+CME ERROR: 30         // No network service
+CME ERROR: 32         // Network not allowed
```

### **CMS Errors (SMS)**
```
+CMS ERROR: 302        // Operation not allowed
+CMS ERROR: 310        // SIM not inserted
+CMS ERROR: 322        // Memory full
+CMS ERROR: 330        // SMSC address unknown
```

### **Error Format Control**
```
AT+CMEE=0             // Disable (+ERROR only)
AT+CMEE=1             // Numeric (+CME ERROR: 10)
AT+CMEE=2             // Verbose (+CME ERROR: SIM not inserted)
```

---

## Common Usage Patterns

### **1. Network Registration Check**
```
AT+COPS?              // Check current operator
AT+CREG?              // Check registration status
AT+CSQ                // Check signal quality
AT+QNWINFO            // Detailed network info
```

### **2. Send SMS**
```
AT+CMGF=1             // Text mode
AT+CMGS="+1234567890" // Destination number
> Hello World<Ctrl+Z> // Message content + send
```

### **3. Read Incoming SMS**
```
// After receiving +CMTI: "SM",5
AT+CMGR=5             // Read message at index 5
AT+CMGD=5             // Delete message
```

### **4. Make Voice Call**
```
AT+CLCC               // Check current calls
ATD+1234567890;       // Dial number
// Call conversation
ATH                   // Hang up
```

### **5. Data Connection**
```
AT+CGDCONT=1,"IP","internet"  // Define context
AT+CGACT=1,1                  // Activate
AT+CGPADDR=1                  // Get IP
```

### **6. Audio Configuration**
```
AT+QAUDMOD=1          // Headset mode
AT+QDAI=3,0,0,4,0,0,1,1  // Configure audio codec
AT+QMIC=15000,3000    // Set microphone gains
AT+QRXGAIN=10000      // Set speaker gain
```

---

## Advanced Features

### **Concatenated SMS (Long Messages)**
```
AT+QCMGS="+1234567890",123,1,2  // Part 1 of 2, UID=123
> First part of long message<Ctrl+Z>

AT+QCMGS="+1234567890",123,2,2  // Part 2 of 2, UID=123  
> Second part of message<Ctrl+Z>
```

### **USSD Services**
```
AT+CUSD=1,"*100#"     // Balance inquiry
// Response: +CUSD: 0,"Your balance is $10.50",15
```

### **Call Forwarding**
```
AT+CCFC=0,3,"+1234567890"  // Set unconditional forwarding
AT+CCFC=0,1                // Enable forwarding
AT+CCFC=0,2                // Query status
AT+CCFC=0,4                // Disable forwarding
```

### **Multiple Call Management**
```
ATD+1111111111;       // First call
// During call, second call comes in: +CCWA: "+2222222222"
AT+CHLD=2             // Hold first, answer second
AT+CHLD=3             // Conference both calls
AT+CHLD=1             // Hang up active, retrieve held
```

---

## Module Configuration

### **Band Configuration**
```
AT+QCFG="band",0x15,0x400A0E189F,0x21,1  // Set specific bands
AT+QCFG="nwscanmode",0,1                  // Auto mode, immediate
AT+QCFG="nwscanseq",00010203,1           // LTE/GSM/TD/WCDMA sequence
```

### **URC Configuration**
```
AT+QURCCFG="urcport","usbat"     // URCs to USB AT port
AT+QCFG="urc/ri/ring","wave",120,1000,3000,"on",1  // Ring indicator
AT+QINDCFG="all",1,1             // Enable all URCs, save to NV
```

### **Sleep Mode**
```
AT+QSCLK=1            // Enable sleep mode (DTR controlled)
// Pull DTR high to enter sleep, low to wake
```

---

## Protocol Extensions

For advanced applications, the EC25-EUX supports additional protocols via separate AT command sets:

- **TCP/IP**: `AT+QIOPEN`, `AT+QISEND`, `AT+QIRD` - Socket operations
- **HTTP(S)**: `AT+QHTTPGET`, `AT+QHTTPPOST` - Web requests  
- **FTP(S)**: `AT+QFTPOPEN`, `AT+QFTPPUT` - File transfer
- **SMTP**: `AT+QSMTPPUT` - Email sending
- **MMS**: `AT+QMMSEND` - Multimedia messaging
- **GNSS**: `AT+QGPS`, `AT+QGPSLOC` - GPS positioning

Refer to the specific protocol manuals for detailed command descriptions.

---

## Notes

1. **Power Management**: Always use `AT+QPOWD=1` for proper shutdown
2. **SIM Hot-swap**: Use `AT+QSIMDET=1,0` for hot-swap detection
3. **Character Sets**: Default is GSM 7-bit, use UCS2 for Unicode
4. **Audio Codecs**: Supports external codecs via I2C (NAU8814, ALC5616, TLV320AIC3104)
5. **Data Counters**: Use `AT+QGDCNT` and `AT+QAUGDCNT` for usage tracking
6. **Factory Reset**: `AT&F` + `AT&W` + restart for complete reset

This reference guide covers the essential AT commands for EC25-EUX modem integration. For complete technical details, consult the full official manual.