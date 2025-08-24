#!/usr/bin/env node

/**
 * EC25-EUX Modem Detector & Port Mapper
 * Based on verified patterns from production testing
 * 
 * References:
 * - docs/Wazne-informacje.md - Verified AT port mapping (2, 6, 10, 14...)
 * - docs/nodejs-multi-serial-guide.md - Production patterns for multi-serial
 * - docs/EC25-EUX_Quick_Reference_Card.md - EC25-EUX specifics
 * - docs/detailed-implementation-plan.md - Implementation guidelines
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

/**
 * EC25-EUX Modem Detector
 * Implements automatic modem detection and verified port mapping
 */
class EC25ModemDetector {
    constructor(options = {}) {
        this.options = {
            // EC25-EUX USB Vendor:Product ID
            usbVendorProduct: '2c7c:0125',
            
            // Verified port mapping pattern from testing
            portPattern: {
                diagnostics: 0,    // ttyUSB[base+0]
                nmea: 1,          // ttyUSB[base+1] 
                at: 2,            // ttyUSB[base+2] ⭐ VERIFIED
                modem: 3          // ttyUSB[base+3]
            },
            
            // AT communication settings
            atSettings: {
                baudRate: 115200,
                timeout: 5000,
                retries: 3
            },
            
            // Detection intervals
            scanInterval: 10000,  // 10 seconds
            
            // Logging
            enableLogging: true,
            logLevel: 'info',
            
            ...options
        };
        
        // Internal state
        this.detectedModems = new Map();
        this.lastScanTime = null;
        this.scanCount = 0;
        this.errors = [];
        
        // Performance tracking
        this.stats = {
            totalScans: 0,
            successfulDetections: 0,
            failedDetections: 0,
            averageScanTime: 0
        };
        
        this.log('info', 'EC25-EUX Modem Detector initialized', {
            usbId: this.options.usbVendorProduct,
            portPattern: this.options.portPattern
        });
    }
    
    /**
     * STEP 1: Automatic modem detection
     * Implements multi-stage detection: USB → Serial → QMI
     */
    async detectModems() {
        const startTime = Date.now();
        this.stats.totalScans++;
        this.scanCount++;
        
        this.log('info', `Starting modem detection scan #${this.scanCount}`);
        
        try {
            // Stage 1: USB Device Detection
            const usbModems = await this.detectUSBModems();
            this.log('debug', `USB Detection: Found ${usbModems.length} EC25-EUX devices`);
            
            // Stage 2: Serial Port Detection  
            const serialPorts = await this.detectSerialPorts();
            this.log('debug', `Serial Detection: Found ${serialPorts.length} ttyUSB ports`);
            
            // Stage 3: QMI Interface Detection
            const qmiDevices = await this.detectQMIDevices();
            this.log('debug', `QMI Detection: Found ${qmiDevices.length} QMI devices`);
            
            // Stage 4: Port Mapping & Validation
            const mappedModems = await this.mapModemPorts(usbModems, serialPorts, qmiDevices);
            
            // Update internal state
            this.detectedModems.clear();
            mappedModems.forEach((modem, id) => {
                this.detectedModems.set(id, modem);
            });
            
            // Update statistics
            const scanTime = Date.now() - startTime;
            this.updateScanStatistics(scanTime, mappedModems.size > 0);
            this.lastScanTime = new Date();
            
            this.log('info', `Modem detection completed`, {
                usbCount: usbModems.length,
                serialCount: serialPorts.length,
                qmiCount: qmiDevices.length,
                mappedCount: mappedModems.size,
                scanTime: `${scanTime}ms`
            });
            
            return {
                success: true,
                modems: Array.from(mappedModems.values()),
                statistics: {
                    usbDevices: usbModems.length,
                    serialPorts: serialPorts.length,
                    qmiDevices: qmiDevices.length,
                    mappedModems: mappedModems.size,
                    scanTime
                },
                timestamp: this.lastScanTime
            };
            
        } catch (error) {
            this.stats.failedDetections++;
            this.errors.push({
                timestamp: new Date(),
                error: error.message,
                type: 'detection_failure'
            });
            
            this.log('error', 'Modem detection failed', { error: error.message });
            
            return {
                success: false,
                error: error.message,
                modems: [],
                timestamp: new Date()
            };
        }
    }
    
    /**
     * USB Modem Detection
     * Uses lsusb to find EC25-EUX devices (2c7c:0125)
     */
    async detectUSBModems() {
        try {
            const { stdout } = await execAsync(`lsusb | grep "${this.options.usbVendorProduct}"`);
            
            if (!stdout.trim()) {
                return [];
            }
            
            const lines = stdout.trim().split('\n');
            const modems = lines.map((line, index) => {
                // Parse lsusb output: "Bus 001 Device 003: ID 2c7c:0125 Quectel..."
                const match = line.match(/Bus (\d+) Device (\d+): ID ([a-f0-9:]+)\s+(.+)/i);
                
                if (match) {
                    return {
                        usbId: `${match[1]}-${match[2]}`,
                        busNumber: parseInt(match[1]),
                        deviceNumber: parseInt(match[2]),
                        vendorProduct: match[3],
                        description: match[4],
                        detectionOrder: index + 1
                    };
                }
                
                return null;
            }).filter(Boolean);
            
            this.log('debug', `Detected ${modems.length} USB modems`, { modems });
            
            return modems;
            
        } catch (error) {
            if (error.message.includes('No such file or directory')) {
                throw new Error('lsusb command not available - install usbutils package');
            }
            throw new Error(`USB detection failed: ${error.message}`);
        }
    }
    
    /**
     * Serial Port Detection
     * Scans /dev/ttyUSB* devices created by EC25-EUX modems
     */
    async detectSerialPorts() {
        try {
            const { stdout } = await execAsync('ls -la /dev/ttyUSB* 2>/dev/null || echo ""');
            
            if (!stdout.trim()) {
                return [];
            }
            
            const lines = stdout.trim().split('\n');
            const ports = [];
            
            for (const line of lines) {
                // Parse ls output: "crw-rw---- 1 root dialout 188, 0 Aug 24 16:19 /dev/ttyUSB0"
                const match = line.match(/.*\s+(\d+),\s*(\d+).*\/dev\/(ttyUSB\d+)$/);
                
                if (match) {
                    const portNumber = parseInt(match[3].replace('ttyUSB', ''));
                    
                    ports.push({
                        device: `/dev/${match[3]}`,
                        name: match[3],
                        portNumber,
                        major: parseInt(match[1]),
                        minor: parseInt(match[2]),
                        accessible: await this.checkPortAccess(`/dev/${match[3]}`)
                    });
                }
            }
            
            // Sort by port number for consistent mapping
            ports.sort((a, b) => a.portNumber - b.portNumber);
            
            this.log('debug', `Detected ${ports.length} serial ports`, { 
                ports: ports.map(p => p.name)
            });
            
            return ports;
            
        } catch (error) {
            throw new Error(`Serial port detection failed: ${error.message}`);
        }
    }
    
    /**
     * QMI Device Detection
     * Scans /dev/cdc-wdm* devices with accessibility check
     */
    async detectQMIDevices() {
        try {
            const { stdout } = await execAsync('ls -la /dev/cdc-wdm* 2>/dev/null || echo ""');
            
            if (!stdout.trim()) {
                return [];
            }
            
            const lines = stdout.trim().split('\n');
            const devices = [];
            
            for (const line of lines) {
                const match = line.match(/.*\/dev\/(cdc-wdm\d+)$/);
                
                if (match) {
                    const deviceNumber = parseInt(match[1].replace('cdc-wdm', ''));
                    const devicePath = `/dev/${match[1]}`;
                    
                    // Test QMI accessibility (non-blocking)
                    const accessible = await this.testQMIAccess(devicePath);
                    
                    devices.push({
                        device: devicePath,
                        name: match[1],
                        deviceNumber,
                        accessible,
                        status: accessible ? 'active' : 'inactive'
                    });
                }
            }
            
            // Sort by device number
            devices.sort((a, b) => a.deviceNumber - b.deviceNumber);
            
            this.log('debug', `Detected ${devices.length} QMI devices`, { 
                devices: devices.map(d => `${d.name}(${d.status})`)
            });
            
            return devices;
            
        } catch (error) {
            throw new Error(`QMI device detection failed: ${error.message}`);
        }
    }
    
    /**
     * STEP 2: Port Mapping using verified formula
     * Maps USB modems to serial/QMI ports using proven pattern
     */
    async mapModemPorts(usbModems, serialPorts, qmiDevices) {
        this.log('info', 'Starting port mapping with verified formula');
        
        const mappedModems = new Map();
        
        for (let i = 0; i < usbModems.length; i++) {
            const usbModem = usbModems[i];
            const modemNumber = i + 1;
            const modemId = `ec25_${modemNumber}`;
            
            // VERIFIED FORMULA: AT_Port = 2 + (Modem_Number - 1) × 4
            const basePortNumber = (modemNumber - 1) * 4;
            const atPortNumber = basePortNumber + this.options.portPattern.at; // +2
            
            // Map all 4 serial ports for this modem
            const serialMapping = {
                diagnostics: this.findSerialPort(serialPorts, basePortNumber + this.options.portPattern.diagnostics),
                nmea: this.findSerialPort(serialPorts, basePortNumber + this.options.portPattern.nmea),
                at: this.findSerialPort(serialPorts, basePortNumber + this.options.portPattern.at),
                modem: this.findSerialPort(serialPorts, basePortNumber + this.options.portPattern.modem)
            };
            
            // Find corresponding QMI device (complex mapping - scan for accessible)
            const qmiDevice = this.findAccessibleQMI(qmiDevices, modemNumber);
            
            const mappedModem = {
                id: modemId,
                modemNumber,
                usb: usbModem,
                
                // Serial port mapping (verified pattern)
                serial: serialMapping,
                
                // Primary communication ports
                atPort: serialMapping.at?.device || null,
                qmiDevice: qmiDevice?.device || null,
                
                // Port calculation details
                portCalculation: {
                    basePort: basePortNumber,
                    atPortNumber,
                    formula: `2 + (${modemNumber} - 1) × 4 = ${atPortNumber}`,
                    pattern: 'VERIFIED'
                },
                
                // Status and capabilities
                status: {
                    detected: true,
                    atPortAvailable: !!serialMapping.at,
                    qmiAvailable: !!qmiDevice,
                    fullyMapped: !!(serialMapping.at && qmiDevice)
                },
                
                // Detection metadata
                detectedAt: new Date(),
                detectionScan: this.scanCount
            };
            
            mappedModems.set(modemId, mappedModem);
            
            this.log('info', `Mapped ${modemId}`, {
                atPort: mappedModem.atPort,
                qmiDevice: mappedModem.qmiDevice,
                formula: mappedModem.portCalculation.formula,
                fullyMapped: mappedModem.status.fullyMapped
            });
        }
        
        this.log('info', `Port mapping completed: ${mappedModems.size} modems mapped`);
        
        return mappedModems;
    }
    
    /**
     * Helper: Find serial port by number
     */
    findSerialPort(serialPorts, portNumber) {
        return serialPorts.find(port => port.portNumber === portNumber) || null;
    }
    
    /**
     * Helper: Find accessible QMI device
     * NOTE: QMI mapping is not 1:1 - find first accessible device
     */
    findAccessibleQMI(qmiDevices, modemNumber) {
        // Try direct mapping first (optimistic)
        const directIndex = modemNumber - 1;
        if (qmiDevices[directIndex]?.accessible) {
            return qmiDevices[directIndex];
        }
        
        // Fallback: find any accessible QMI device
        return qmiDevices.find(device => device.accessible) || null;
    }
    
    /**
     * Helper: Check port accessibility
     */
    async checkPortAccess(portPath) {
        try {
            await fs.access(portPath, fs.constants.R_OK | fs.constants.W_OK);
            return true;
        } catch {
            return false;
        }
    }
    
    /**
     * Helper: Test QMI device accessibility
     */
    async testQMIAccess(devicePath) {
        try {
            // Quick non-blocking test with timeout
            const { stdout } = await execAsync(`timeout 2s qmicli -d ${devicePath} --get-service-version-info 2>/dev/null || echo "TIMEOUT"`);
            return !stdout.includes('TIMEOUT') && !stdout.includes('error') && stdout.trim().length > 0;
        } catch {
            return false;
        }
    }
    
    /**
     * Update scan statistics
     */
    updateScanStatistics(scanTime, success) {
        if (success) {
            this.stats.successfulDetections++;
        }
        
        // Update average scan time
        const totalTime = this.stats.averageScanTime * (this.stats.totalScans - 1) + scanTime;
        this.stats.averageScanTime = Math.round(totalTime / this.stats.totalScans);
    }
    
    /**
     * Get detection statistics
     */
    getStatistics() {
        return {
            ...this.stats,
            successRate: this.stats.totalScans > 0 ? 
                Math.round((this.stats.successfulDetections / this.stats.totalScans) * 100) : 0,
            lastScanTime: this.lastScanTime,
            detectedModems: this.detectedModems.size,
            recentErrors: this.errors.slice(-5) // Last 5 errors
        };
    }
    
    /**
     * Get detected modems
     */
    getDetectedModems() {
        return Array.from(this.detectedModems.values());
    }
    
    /**
     * Simple logging
     */
    log(level, message, data = {}) {
        if (!this.options.enableLogging) return;
        
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            ...data
        };
        
        if (level === 'error' || this.options.logLevel === 'debug') {
            console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`, 
                Object.keys(data).length > 0 ? data : '');
        }
    }
}

module.exports = EC25ModemDetector;

// CLI usage
if (require.main === module) {
    const detector = new EC25ModemDetector({ logLevel: 'debug' });
    
    async function runDetection() {
        console.log('🔍 EC25-EUX Modem Detection & Port Mapping');
        console.log('==========================================\n');
        
        try {
            const result = await detector.detectModems();
            
            if (result.success) {
                console.log('✅ Detection successful!\n');
                
                console.log('📊 Statistics:');
                console.log(`   USB Devices: ${result.statistics.usbDevices}`);
                console.log(`   Serial Ports: ${result.statistics.serialPorts}`);
                console.log(`   QMI Devices: ${result.statistics.qmiDevices}`);
                console.log(`   Mapped Modems: ${result.statistics.mappedModems}`);
                console.log(`   Scan Time: ${result.statistics.scanTime}ms\n`);
                
                console.log('📱 Detected Modems:');
                result.modems.forEach(modem => {
                    console.log(`\n🔹 ${modem.id.toUpperCase()}:`);
                    console.log(`   Formula: ${modem.portCalculation.formula}`);
                    console.log(`   AT Port: ${modem.atPort || 'NOT AVAILABLE'}`);
                    console.log(`   QMI Device: ${modem.qmiDevice || 'NOT AVAILABLE'}`);
                    console.log(`   Status: ${modem.status.fullyMapped ? '✅ READY' : '⚠️ PARTIAL'}`);
                });
                
            } else {
                console.log('❌ Detection failed:', result.error);
            }
            
        } catch (error) {
            console.error('💥 Fatal error:', error.message);
            process.exit(1);
        }
    }
    
    runDetection();
}