# EC25-EUX AT Commands Quick Reference Card

## Basic Setup & Test
```
AT                      // Test communication → OK
ATI                     // Product info → EC25
AT+GMR                  // Firmware version
AT+CGSN                 // IMEI number
AT+CFUN=1              // Enable full functionality
AT+CMEE=2              // Verbose error messages
AT&F                    // Factory defaults
AT+QPOWD=1             // Power down (proper shutdown)
```

## SIM Management
```
AT+CPIN?               // Check PIN status
AT+CPIN="1234"         // Enter PIN
AT+CIMI                // Read IMSI
AT+QCCID               // Read ICCID
AT+QINISTAT            // Check SIM init status (7=ready)
```

## Network Registration
```
AT+COPS=0              // Auto operator selection
AT+COPS?               // Current operator
AT+CREG=2              // Enable registration URC+location
AT+CREG?               // Registration status
AT+CSQ                 // Signal quality (0-31)
AT+QNWINFO             // Network technology/band info
```

## Voice Calls
```
ATD+1234567890;        // Dial number (voice call)
ATA                    // Answer incoming call
ATH                    // Hang up call
AT+CLCC                // List current calls
AT+CHLD=2              // Hold/retrieve call
AT+VTS="123"           // Send DTMF tones
AT+CLVL=5              // Volume level (0-5)
AT+CMUT=1              // Mute on/off
```

## SMS Text Messages
```
AT+CMGF=1              // Text mode (0=PDU mode)
AT+CSCS="GSM"          // Character set
AT+CSCA="+1234567890"  // Set SMS center
AT+CNMI=1,2,0,1,0      // Enable SMS delivery URCs

// Send SMS
AT+CMGS="+1234567890"
> Hello World<Ctrl+Z>

// Read/manage SMS
AT+CMGL="ALL"          // List all messages
AT+CMGR=1              // Read message at index 1
AT+CMGD=1              // Delete message at index 1
```

## Data Connection (PDP)
```
AT+CGATT=1             // Attach to packet network
AT+CGDCONT=1,"IP","internet"  // Define PDP context
AT+CGACT=1,1           // Activate context
AT+CGPADDR=1           // Get assigned IP address
AT+CGACT=0,1           // Deactivate context
```

## Audio Configuration
```
AT+QAUDMOD=0           // Audio mode: 0=handset, 1=headset, 2=speaker
AT+QDAI=3,0,0,4,0,0,1,1  // Digital audio interface (codec)
AT+QMIC=15000,3000     // Microphone gains (codec, digital)
AT+QRXGAIN=8192        // Speaker/earpiece gain
AT+QTONEDET=1          // Enable DTMF detection
```

## Supplementary Services
```
AT+CLIP=1              // Enable caller ID display
AT+CCWA=1,1            // Enable call waiting
AT+CCFC=0,3,"+number"  // Set call forwarding
AT+CUSD=1,"*100#"      // Send USSD code
```

## URC Configuration
```
AT+QURCCFG="urcport","usbat"     // Route URCs to USB AT port
AT+QINDCFG="all",1,1             // Enable all URCs, save to NV
AT+QCFG="urc/ri/ring","pulse",120  // Ring indicator config
```

## Status & Monitoring
```
AT+CPAS                // Activity status (0=ready, 3=ringing, 4=call)
AT+CCLK?               // Read RTC clock
AT+CBC                 // Battery status
AT+QADC=0              // Read ADC channel 0
AT+QGDCNT?             // Data usage counter
```

## Common URCs (Unsolicited Result Codes)
```
RDY                    // Module ready
+CFUN: 1               // Full functionality enabled
+CPIN: READY           // SIM ready
+QIND: SMS DONE        // SMS initialization complete
+QIND: PB DONE         // Phonebook initialization complete

+CREG: 1,"1A2B","3C4D5E6F",7     // Network registered (LTE)
+CGREG: 1,"1A2B","3C4D5E6F",7    // GPRS registered
+CEREG: 1,"1A2B","3C4D5E6F",7    // EPS registered

RING                   // Incoming call
+CLIP: "+1234567890",145,,,"Contact",0  // Caller ID
+CCWA: "+1234567890",129,1        // Call waiting

+CMT: "+1234567890",,"21/12/15,10:30:45+32"  // Incoming SMS (start)
Hello World            // SMS content

+CMTI: "SM",5          // SMS stored at index 5
+CGEV: PDN ACT 1       // Data context activated
```

## Error Codes
```
// Common CME Errors
+CME ERROR: 10         // SIM not inserted
+CME ERROR: 11         // SIM PIN required
+CME ERROR: 13         // SIM failure
+CME ERROR: 30         // No network service
+CME ERROR: 32         // Network not allowed

// Common CMS Errors  
+CMS ERROR: 302        // Operation not allowed
+CMS ERROR: 322        // Memory full
+CMS ERROR: 330        // SMSC address unknown
```

## Essential Sequences

### **Initial Startup**
```
1. AT                  // Test communication
2. AT+CFUN=1          // Enable functionality
3. AT+CPIN="1234"     // Enter PIN (if needed)
4. AT+CREG=2          // Enable network URC
5. Wait for +CREG: 1  // Network registered
```

### **Make Voice Call**
```
1. AT+CLVL=4          // Set volume
2. AT+CLIP=1          // Enable caller ID
3. ATD+1234567890;    // Dial
4. Wait for OK        // Call setup
5. ATH                // Hang up when done
```

### **Send SMS**
```
1. AT+CMGF=1          // Text mode
2. AT+CSCA="+smsc"    // Set SMS center
3. AT+CMGS="+number"  // Send to number
4. Type message       // Enter text
5. <Ctrl+Z>           // Send (0x1A)
```

### **Setup Data**
```
1. AT+CGDCONT=1,"IP","apn"  // Configure APN
2. AT+CGATT=1              // Attach GPRS
3. AT+CGACT=1,1           // Activate context
4. AT+CGPADDR=1           // Check IP address
```

## Tips
- Always wait for `OK` response before sending next command
- Use `AT+CMEE=2` for detailed error messages
- Use `AT+CREG=2` for location info in registration URC
- `AT+QPOWD=1` for proper shutdown (wait for "POWERED DOWN")
- Default baud rate: 115200 bps
- Pin assignments vary by module variant - check hardware guide

---
**Quectel EC25-EUX LTE Cat 4 Module | Firmware: EC25EUXGAR08A05M1G**