#!/usr/bin/env node

/**
 * Test Script for EC25-EUX Modem Detector
 * Demonstrates automatic detection and port mapping
 */

const EC25ModemDetector = require('./modem-detector');

async function testDetector() {
    console.log('🧪 EC25-EUX MODEM DETECTOR TEST');
    console.log('==============================\n');
    
    // Initialize detector with debug logging
    const detector = new EC25ModemDetector({
        logLevel: 'debug',
        enableLogging: true
    });
    
    try {
        console.log('🔍 Step 1: Single detection scan...\n');
        
        // Run single detection
        const result = await detector.detectModems();
        
        if (result.success) {
            console.log('\n✅ DETECTION SUCCESSFUL!\n');
            
            // Display detailed results
            displayResults(result);
            
            // Display mapping verification
            displayMappingVerification(result.modems);
            
            // Display next steps
            displayNextSteps(result.modems);
            
        } else {
            console.log('\n❌ DETECTION FAILED!');
            console.log('Error:', result.error);
            console.log('\n🔧 Troubleshooting:');
            console.log('1. Check if EC25-EUX modems are connected');
            console.log('2. Verify USB permissions (run as sudo if needed)');
            console.log('3. Install dependencies: sudo apt install libqmi-utils usbutils');
        }
        
        // Show statistics
        console.log('\n📊 DETECTOR STATISTICS:');
        const stats = detector.getStatistics();
        Object.entries(stats).forEach(([key, value]) => {
            if (typeof value === 'object' && value !== null) {
                console.log(`   ${key}:`, JSON.stringify(value));
            } else {
                console.log(`   ${key}: ${value}`);
            }
        });
        
    } catch (error) {
        console.error('\n💥 FATAL ERROR:', error.message);
        console.error('Stack:', error.stack);
    }
}

function displayResults(result) {
    console.log('📊 DETECTION STATISTICS:');
    console.log(`   📱 USB Modems Found: ${result.statistics.usbDevices}`);
    console.log(`   🔌 Serial Ports: ${result.statistics.serialPorts}`);
    console.log(`   📡 QMI Devices: ${result.statistics.qmiDevices}`);
    console.log(`   🗺️  Mapped Modems: ${result.statistics.mappedModems}`);
    console.log(`   ⏱️  Scan Time: ${result.statistics.scanTime}ms`);
    console.log(`   📅 Timestamp: ${result.timestamp.toISOString()}\n`);
}

function displayMappingVerification(modems) {
    if (modems.length === 0) {
        console.log('⚠️  NO MODEMS TO VERIFY\n');
        return;
    }
    
    console.log('🧮 PORT MAPPING VERIFICATION:');
    console.log('============================');
    
    modems.forEach((modem, index) => {
        console.log(`\n📱 MODEM ${modem.modemNumber} (${modem.id}):`);
        console.log('   ├─ USB Info:');
        console.log(`   │  ├─ Bus ${modem.usb.busNumber}, Device ${modem.usb.deviceNumber}`);
        console.log(`   │  └─ ID: ${modem.usb.vendorProduct}`);
        
        console.log('   ├─ Port Calculation:');
        console.log(`   │  ├─ Formula: ${modem.portCalculation.formula}`);
        console.log(`   │  ├─ Base Port: ${modem.portCalculation.basePort}`);
        console.log(`   │  └─ Pattern: ${modem.portCalculation.pattern}`);
        
        console.log('   ├─ Serial Ports:');
        console.log(`   │  ├─ Diagnostics: ${modem.serial.diagnostics?.device || '❌ NOT FOUND'}`);
        console.log(`   │  ├─ NMEA GPS: ${modem.serial.nmea?.device || '❌ NOT FOUND'}`);
        console.log(`   │  ├─ AT Commands: ${modem.serial.at?.device || '❌ NOT FOUND'} ${modem.atPort ? '⭐' : ''}`);
        console.log(`   │  └─ Modem: ${modem.serial.modem?.device || '❌ NOT FOUND'}`);
        
        console.log('   ├─ QMI Interface:');
        console.log(`   │  └─ Device: ${modem.qmiDevice || '❌ NOT AVAILABLE'}`);
        
        console.log('   └─ Status:');
        console.log(`      ├─ AT Port Available: ${modem.status.atPortAvailable ? '✅' : '❌'}`);
        console.log(`      ├─ QMI Available: ${modem.status.qmiAvailable ? '✅' : '❌'}`);
        console.log(`      └─ Fully Mapped: ${modem.status.fullyMapped ? '✅ READY' : '⚠️ PARTIAL'}`);
    });
    
    console.log('\n🔍 PATTERN VERIFICATION:');
    const atPorts = modems
        .filter(m => m.atPort)
        .map(m => {
            const portNum = parseInt(m.atPort.replace('/dev/ttyUSB', ''));
            return { modem: m.modemNumber, port: portNum, device: m.atPort };
        })
        .sort((a, b) => a.modem - b.modem);
    
    if (atPorts.length > 0) {
        console.log('   AT Port Sequence:');
        atPorts.forEach(({ modem, port, device }) => {
            const expected = 2 + (modem - 1) * 4;
            const match = port === expected ? '✅' : '❌';
            console.log(`   │  Modem ${modem}: ${device} (${port}) - Expected: ${expected} ${match}`);
        });
        
        if (atPorts.length > 1) {
            const differences = [];
            for (let i = 1; i < atPorts.length; i++) {
                differences.push(atPorts[i].port - atPorts[i-1].port);
            }
            console.log(`   │`);
            console.log(`   └─ Port Differences: [${differences.join(', ')}] - Expected: [4, 4, 4...] ${differences.every(d => d === 4) ? '✅' : '❌'}`);
        }
    } else {
        console.log('   ❌ No AT ports found for verification');
    }
}

function displayNextSteps(modems) {
    console.log('\n🚀 NEXT STEPS:');
    console.log('==============');
    
    const readyModems = modems.filter(m => m.status.fullyMapped);
    const partialModems = modems.filter(m => !m.status.fullyMapped && m.status.atPortAvailable);
    
    if (readyModems.length > 0) {
        console.log('\n✅ READY FOR AT COMMUNICATION:');
        readyModems.forEach(modem => {
            console.log(`   📱 ${modem.id}: ${modem.atPort}`);
            console.log(`      Test command: sudo minicom -D ${modem.atPort} -b 115200`);
        });
        
        console.log('\n🔧 INTEGRATION OPTIONS:');
        console.log('   1. Test AT communication manually');
        console.log('   2. Run Node.js SerialPort integration');
        console.log('   3. Setup 3proxy instances per modem');
        console.log('   4. Implement database logging');
    }
    
    if (partialModems.length > 0) {
        console.log('\n⚠️  PARTIAL MODEMS (AT available, QMI issues):');
        partialModems.forEach(modem => {
            console.log(`   📱 ${modem.id}: AT=${modem.atPort}, QMI=${modem.qmiDevice || 'MISSING'}`);
        });
        console.log('   💡 Can proceed with AT-only communication');
    }
    
    if (modems.length === 0) {
        console.log('\n❌ NO MODEMS DETECTED:');
        console.log('   1. Check USB connections');
        console.log('   2. Verify EC25-EUX is powered on');
        console.log('   3. Check VirtualBox USB settings (if using VM)');
        console.log('   4. Run: lsusb | grep 2c7c:0125');
    }
    
    console.log('\n📋 RECOMMENDED COMMANDS:');
    console.log('   🔍 Manual verification: lsusb | grep 2c7c && ls /dev/ttyUSB* && ls /dev/cdc-wdm*');
    console.log('   🧪 Test Node.js manager: npm run test');
    console.log('   🔄 Re-run detector: npm run detect');
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log('\n\n🛑 Test interrupted by user');
    process.exit(0);
});

// Run the test
testDetector().catch(error => {
    console.error('\n💥 Unhandled error:', error);
    process.exit(1);
});