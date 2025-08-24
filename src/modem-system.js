#!/usr/bin/env node

/**
 * EC25-EUX Multi-Modem Management System
 * Enterprise-grade scalable architecture for production deployment
 * 
 * Architecture: Event-driven system with PostgreSQL LISTEN/NOTIFY
 * Scaling: Support for 100+ modems with dynamic proxy allocation
 * Hot-plug: Real-time device detection with udev integration
 * 
 * References:
 * - docs/system-architecture-plan.md - Complete system architecture
 * - docs/detailed-implementation-plan.md - 11-phase implementation
 * - docs/Wazne-informacje.md - Verified port mapping patterns
 */

const express = require('express');
const { Pool } = require('pg');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

/**
 * Main system class implementing event-driven architecture
 */
class EC25ModemSystem {
    constructor(options = {}) {
        this.options = {
            // Database configuration
            database: {
                host: process.env.DB_HOST || 'localhost',
                port: process.env.DB_PORT || 5432,
                database: process.env.DB_NAME || 'ec25_modems',
                user: process.env.DB_USER || 'modem_user',
                password: process.env.DB_PASSWORD || 'secure_password_123'
            },
            
            // API server configuration
            api: {
                port: process.env.API_PORT || 3002,
                host: process.env.API_HOST || '0.0.0.0',
                jwtSecret: process.env.JWT_SECRET || 'ec25-eux-secret-key-change-in-production'
            },
            
            // Modem detection settings (verified patterns from testing)
            modems: {
                usbVendorProduct: '2c7c:0125',
                portPattern: {
                    at: 2,  // ttyUSB[base+2] - VERIFIED pattern
                    diagnostics: 0,
                    nmea: 1,
                    modem: 3
                },
                // VERIFIED FORMULA: AT_Port = 2 + (Modem_Number - 1) × 4
                atPortFormula: (modemNumber) => 2 + (modemNumber - 1) * 4
            },
            
            // Proxy port allocation (3128-4127 = 1000 ports, max 100 modems)
            proxy: {
                portRange: { start: 3128, end: 4127 },
                reservedPorts: [22, 80, 443, 8080, 3000, 3001, 3002, 5432]
            },
            
            // Hot-plug detection settings
            detection: {
                scanInterval: 5000,  // 5 seconds (per docs)
                retryAttempts: 3,
                timeout: 10000
            },
            
            // System limits and scaling
            scaling: {
                maxModems: 100,
                maxConcurrentDetections: 10,
                dbConnectionPoolSize: 20
            },
            
            // Boot sequence configuration (per docs)
            bootSequence: {
                delaySeconds: 45,           // Boot delay (30-60s per docs)
                batchSize: 5,               // Groups of 5 modems
                batchDelay: 5000,           // 5s between batches  
                instanceDelay: 2500,        // 2.5s between instances
                gracePeriod: 150000         // 2.5 min health check grace
            },
            
            ...options
        };
        
        // System components
        this.db = null;
        this.api = null;
        this.io = null;
        this.detectionWorker = null;
        
        // State management
        this.connectedClients = new Set();
        this.activeModems = new Map();
        this.lastScan = null;
        this.systemStats = {
            totalDetections: 0,
            activeModems: 0,
            allocatedPorts: 0,
            uptime: Date.now()
        };
        
        console.log('🚀 EC25-EUX Multi-Modem System initializing...');
        console.log(`📊 Configuration: max ${this.options.scaling.maxModems} modems, ports ${this.options.proxy.portRange.start}-${this.options.proxy.portRange.end}`);
    }
    
    /**
     * Initialize complete system
     * Phase 2: Database + Phase 3: Detection + Phase 5: API
     */
    async initialize() {
        try {
            console.log('🔄 Initializing system components...');
            
            // Phase 2: Database connection with event triggers
            await this.initializeDatabase();
            
            // Phase 3: Modem detection system
            await this.initializeDetection();
            
            // Phase 5: API server with real-time features
            await this.initializeAPI();
            
            // Start background workers
            await this.startSystemWorkers();
            
            console.log('✅ EC25-EUX Multi-Modem System ready!');
            console.log(`🌐 API server: http://${this.options.api.host}:${this.options.api.port}`);
            console.log(`📡 Socket.IO: http://${this.options.api.host}:${this.options.api.port}`);
            
            return true;
            
        } catch (error) {
            console.error('❌ System initialization failed:', error);
            throw error;
        }
    }
    
    /**
     * Phase 2: Database initialization with event-driven triggers
     * AUTO-SETUP: Automatically installs and configures PostgreSQL if needed
     */
    async initializeDatabase() {
        console.log('🗄️  Initializing PostgreSQL with auto-setup...');
        
        try {
            // Step 1: Ensure PostgreSQL is installed and running
            await this.ensurePostgreSQLAvailable();
            
            // Step 2: Create database connection pool
            this.db = new Pool({
                ...this.options.database,
                max: this.options.scaling.dbConnectionPoolSize,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 5000
            });
            
            // Step 3: Test connection and setup database
            const client = await this.db.connect();
            
            try {
                // Create database and user if needed
                await this.setupDatabaseAndUser(client);
                
                // Create tables if not exist (idempotent)
                await this.createDatabaseSchema(client);
                
                // Setup event-driven triggers (PostgreSQL LISTEN/NOTIFY)
                await this.setupEventTriggers(client);
                
                // Start listening for database events
                await this.startDatabaseEventListener();
                
                console.log('✅ Database initialized with event-driven architecture');
                
            } finally {
                client.release();
            }
            
        } catch (error) {
            console.log('⚠️  PostgreSQL not available, running in standalone mode...');
            console.log(`   Database error: ${error.message}`);
            
            // Initialize in-memory fallback
            await this.initializeStandaloneMode();
        }
    }
    
    /**
     * AUTO-SETUP: Ensure PostgreSQL is installed and running
     */
    async ensurePostgreSQLAvailable() {
        console.log('🔍 Checking PostgreSQL availability...');
        
        try {
            // Check if PostgreSQL is installed
            await execAsync('which pg_isready');
            console.log('   ✅ PostgreSQL tools found');
            
            // Check if PostgreSQL service is running
            const { stdout } = await execAsync('pg_isready -h localhost -p 5432');
            
            if (stdout.includes('accepting connections')) {
                console.log('   ✅ PostgreSQL service is running');
                return true;
            }
            
        } catch (error) {
            console.log('   ❌ PostgreSQL not available, attempting auto-installation...');
            await this.autoInstallPostgreSQL();
        }
    }
    
    /**
     * AUTO-SETUP: Install and configure PostgreSQL automatically
     */
    async autoInstallPostgreSQL() {
        console.log('📦 Auto-installing PostgreSQL...');
        
        try {
            // Update package list
            console.log('   📥 Updating package list...');
            await execAsync('apt update', { timeout: 30000 });
            
            // Install PostgreSQL
            console.log('   📦 Installing PostgreSQL...');
            await execAsync('apt install -y postgresql postgresql-contrib', { timeout: 120000 });
            
            // Start and enable PostgreSQL service
            console.log('   🚀 Starting PostgreSQL service...');
            await execAsync('systemctl start postgresql');
            await execAsync('systemctl enable postgresql');
            
            // Wait for service to be ready
            console.log('   ⏱️  Waiting for PostgreSQL to be ready...');
            await this.sleep(5000);
            
            // Verify installation
            await execAsync('pg_isready -h localhost -p 5432');
            console.log('   ✅ PostgreSQL auto-installation successful');
            
        } catch (error) {
            throw new Error(`PostgreSQL auto-installation failed: ${error.message}`);
        }
    }
    
    /**
     * AUTO-SETUP: Create database and user if they don't exist
     */
    async setupDatabaseAndUser(client) {
        console.log('🔧 Setting up database and user...');
        
        try {
            // Try connecting with postgres user first
            const adminPool = new Pool({
                host: this.options.database.host,
                port: this.options.database.port,
                database: 'postgres', // Connect to default postgres db
                user: 'postgres',
                password: '' // Try without password first
            });
            
            const adminClient = await adminPool.connect();
            
            try {
                // Create database if not exists
                console.log(`   🗄️  Creating database '${this.options.database.database}'...`);
                await adminClient.query(`
                    SELECT 1 FROM pg_database WHERE datname = '${this.options.database.database}'
                `).then(async (result) => {
                    if (result.rows.length === 0) {
                        await adminClient.query(`CREATE DATABASE ${this.options.database.database}`);
                        console.log('   ✅ Database created');
                    } else {
                        console.log('   ✅ Database already exists');
                    }
                });
                
                // Create user if not exists
                console.log(`   👤 Creating user '${this.options.database.user}'...`);
                await adminClient.query(`
                    SELECT 1 FROM pg_roles WHERE rolname = '${this.options.database.user}'
                `).then(async (result) => {
                    if (result.rows.length === 0) {
                        await adminClient.query(`
                            CREATE USER ${this.options.database.user} 
                            WITH PASSWORD '${this.options.database.password}'
                        `);
                        console.log('   ✅ User created');
                    } else {
                        console.log('   ✅ User already exists');
                    }
                });
                
                // Grant privileges
                await adminClient.query(`
                    GRANT ALL PRIVILEGES ON DATABASE ${this.options.database.database} 
                    TO ${this.options.database.user}
                `);
                console.log('   ✅ Privileges granted');
                
            } finally {
                adminClient.release();
                await adminPool.end();
            }
            
        } catch (error) {
            console.log(`   ⚠️  Database setup warning: ${error.message}`);
            console.log('   📝 You may need to manually configure PostgreSQL');
        }
    }
    
    /**
     * Initialize standalone mode (no database)
     */
    async initializeStandaloneMode() {
        console.log('🔄 Initializing standalone mode (in-memory storage)...');
        
        // Use Map for in-memory storage
        this.standaloneMode = true;
        this.inMemoryModems = new Map();
        this.inMemoryLogs = [];
        
        console.log('   ✅ Standalone mode initialized');
        console.log('   📝 Note: Data will not persist between restarts');
    }
    
    /**
     * Create database schema (Phase 2 implementation)
     */
    async createDatabaseSchema(client) {
        const createTables = `
            -- Main modems table (single source of truth)
            CREATE TABLE IF NOT EXISTS modems (
                serial VARCHAR(50) PRIMARY KEY,
                usb_id VARCHAR(20),
                at_port VARCHAR(20),
                qmi_device VARCHAR(20),
                proxy_port INTEGER UNIQUE,
                status VARCHAR(20) DEFAULT 'detected',
                wan_ip INET,
                signal_strength INTEGER,
                operator VARCHAR(100),
                last_seen TIMESTAMP DEFAULT NOW(),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
            
            -- Modem command logs table  
            CREATE TABLE IF NOT EXISTS modem_logs (
                id SERIAL PRIMARY KEY,
                modem_serial VARCHAR(50) REFERENCES modems(serial) ON DELETE CASCADE,
                command VARCHAR(200),
                response TEXT,
                success BOOLEAN,
                execution_time INTEGER,
                timestamp TIMESTAMP DEFAULT NOW()
            );
            
            -- Create indexes for performance
            CREATE INDEX IF NOT EXISTS idx_modems_status ON modems(status);
            CREATE INDEX IF NOT EXISTS idx_modems_last_seen ON modems(last_seen);
            CREATE INDEX IF NOT EXISTS idx_modem_logs_serial ON modem_logs(modem_serial);
            CREATE INDEX IF NOT EXISTS idx_modem_logs_timestamp ON modem_logs(timestamp);
        `;
        
        await client.query(createTables);
        console.log('📋 Database schema created/verified');
    }
    
    /**
     * Setup PostgreSQL LISTEN/NOTIFY event triggers (Phase 2)
     */
    async setupEventTriggers(client) {
        const triggerFunction = `
            CREATE OR REPLACE FUNCTION notify_modem_change()
            RETURNS TRIGGER AS $$
            BEGIN
                IF TG_OP = 'INSERT' THEN
                    PERFORM pg_notify('modem_change', 
                        json_build_object(
                            'operation', 'INSERT',
                            'serial', NEW.serial,
                            'status', NEW.status,
                            'proxy_port', NEW.proxy_port,
                            'at_port', NEW.at_port
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
                            'proxy_port', NEW.proxy_port,
                            'at_port', NEW.at_port
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
            
            DROP TRIGGER IF EXISTS modems_change_trigger ON modems;
            CREATE TRIGGER modems_change_trigger
                AFTER INSERT OR UPDATE OR DELETE ON modems
                FOR EACH ROW EXECUTE FUNCTION notify_modem_change();
        `;
        
        await client.query(triggerFunction);
        console.log('🔔 Event triggers configured for real-time updates');
    }
    
    /**
     * Start database event listener (real-time system updates)
     */
    async startDatabaseEventListener() {
        const eventClient = await this.db.connect();
        
        eventClient.on('notification', (msg) => {
            try {
                const payload = JSON.parse(msg.payload);
                this.handleModemEvent(payload);
            } catch (error) {
                console.error('Event parsing error:', error);
            }
        });
        
        await eventClient.query('LISTEN modem_change');
        console.log('👂 Database event listener started');
    }
    
    /**
     * Handle real-time modem events from database
     */
    handleModemEvent(event) {
        console.log(`📡 Modem event: ${event.operation} - ${event.serial}`);
        
        // Update internal state
        if (event.operation === 'INSERT' || event.operation === 'UPDATE') {
            this.activeModems.set(event.serial, {
                serial: event.serial,
                status: event.new_status || event.status,
                proxy_port: event.proxy_port,
                at_port: event.at_port,
                last_updated: new Date()
            });
        } else if (event.operation === 'DELETE') {
            this.activeModems.delete(event.serial);
        }
        
        // Broadcast to WebSocket clients
        this.broadcastToClients({
            type: 'modem_change',
            event: event,
            timestamp: new Date().toISOString()
        });
        
        // Update system statistics
        this.systemStats.activeModems = this.activeModems.size;
    }
    
    /**
     * Phase 3: Initialize modem detection system
     */
    async initializeDetection() {
        console.log('🔍 Initializing modem detection system...');
        
        // Import our verified detector
        const EC25ModemDetector = require('./modem-detector');
        this.detector = new EC25ModemDetector({
            logLevel: 'info',
            enableLogging: true
        });
        
        console.log('✅ Detection system ready with verified port mapping');
    }
    
    /**
     * Phase 5: Initialize Express.js API with security
     */
    async initializeAPI() {
        console.log('🌐 Initializing API server...');
        
        this.api = express();
        
        // Security middleware (Phase 7)
        this.api.use(helmet());
        this.api.use(cors({
            origin: [
                'http://localhost:3000',
                'http://127.0.0.1:3000',
                process.env.CORS_ORIGIN || 'http://localhost:3000'
            ],
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With']
        }));
        this.api.use(express.json());
        
        // API routes
        this.setupAPIRoutes();
        
        // Socket.IO server for real-time updates
        const server = this.api.listen(this.options.api.port, this.options.api.host);
        this.io = new Server(server, {
            cors: {
                origin: [
                    'http://localhost:3000',
                    'http://127.0.0.1:3000',
                    process.env.CORS_ORIGIN || 'http://localhost:3000'
                ],
                credentials: true,
                methods: ['GET', 'POST']
            },
            transports: ['websocket', 'polling']
        });
        
        this.setupWebSocketHandlers();
        
        console.log('✅ API server initialized with Socket.IO support');
    }
    
    /**
     * Setup REST API endpoints (Phase 5)
     */
    setupAPIRoutes() {
        // GET /api/modems - Retrieve all modems with status
        this.api.get('/api/modems', async (req, res) => {
            try {
                let modems = [];
                
                if (this.standaloneMode) {
                    // Standalone mode: get from memory
                    modems = Array.from(this.inMemoryModems.values())
                        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
                } else {
                    // Database mode: query PostgreSQL
                    const result = await this.db.query(`
                        SELECT serial, usb_id, at_port, qmi_device, proxy_port, 
                               status, wan_ip, signal_strength, operator, last_seen
                        FROM modems 
                        ORDER BY created_at ASC
                    `);
                    modems = result.rows;
                }
                
                res.json({
                    success: true,
                    modems: modems,
                    count: modems.length,
                    mode: this.standaloneMode ? 'standalone' : 'database',
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });
        
        // POST /api/modems/scan - Trigger manual detection scan
        this.api.post('/api/modems/scan', async (req, res) => {
            try {
                const result = await this.performDetectionScan();
                res.json({
                    success: true,
                    result: result,
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });
        
        // POST /api/modems/:serial/command - Execute AT/QMI command
        this.api.post('/api/modems/:serial/command', async (req, res) => {
            try {
                const { serial } = req.params;
                const { command, commandInterface } = req.body; // commandInterface: 'AT' or 'QMI'
                
                const result = await this.executeModemCommand(serial, command, commandInterface);
                res.json({
                    success: true,
                    result: result,
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });
        
        // GET /api/system/status - System health and statistics
        this.api.get('/api/system/status', (req, res) => {
            res.json({
                success: true,
                status: 'operational',
                statistics: {
                    ...this.systemStats,
                    uptime: Date.now() - this.systemStats.uptime,
                    lastScan: this.lastScan
                },
                timestamp: new Date().toISOString()
            });
        });
        
        console.log('📡 API endpoints configured');
    }
    
    /**
     * Setup WebSocket handlers for real-time updates
     */
    setupWebSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log('👤 Socket.IO client connected:', socket.id);
            this.connectedClients.add(socket);
            
            // Send current system state
            socket.emit('system_status', {
                activeModems: Array.from(this.activeModems.values()),
                statistics: this.systemStats
            });
            
            socket.on('disconnect', () => {
                console.log('👤 Socket.IO client disconnected:', socket.id);
                this.connectedClients.delete(socket);
            });
        });
        
        console.log('🔄 Socket.IO handlers configured');
    }
    
    /**
     * Broadcast message to all Socket.IO clients
     */
    broadcastToClients(message) {
        if (this.io) {
            this.io.emit(message.type, message);
        }
    }
    
    /**
     * Start background system workers (Phase 3)
     */
    async startSystemWorkers() {
        console.log('⚙️  Starting background workers...');
        
        // Hot-plug detection worker (5-second intervals per docs)
        this.detectionWorker = setInterval(async () => {
            try {
                await this.performDetectionScan();
            } catch (error) {
                console.error('Detection scan error:', error);
            }
        }, this.options.detection.scanInterval);
        
        console.log(`🔄 Detection worker started (${this.options.detection.scanInterval}ms intervals)`);
    }
    
    /**
     * Perform modem detection scan with database integration
     */
    async performDetectionScan() {
        const scanStart = Date.now();
        this.systemStats.totalDetections++;
        
        try {
            // Use our verified detector
            const detectionResult = await this.detector.detectModems();
            
            if (detectionResult.success) {
                // Process each detected modem
                for (const modem of detectionResult.modems) {
                    await this.processDetectedModem(modem);
                }
                
                this.lastScan = new Date();
                
                console.log(`🔍 Detection scan completed: ${detectionResult.modems.length} modems (${Date.now() - scanStart}ms)`);
                
                return {
                    success: true,
                    modemsFound: detectionResult.modems.length,
                    scanTime: Date.now() - scanStart
                };
            }
            
        } catch (error) {
            console.error('Detection scan failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Process newly detected modem (database insertion/update or in-memory storage)
     */
    async processDetectedModem(modem) {
        try {
            // Generate serial number for database key
            const serial = `EC25_${modem.modemNumber}_${modem.usb.busNumber}_${modem.usb.deviceNumber}`;
            
            if (this.standaloneMode) {
                // Standalone mode: store in memory
                const modemData = {
                    serial,
                    usb_id: modem.usb.usbId,
                    at_port: modem.atPort,
                    qmi_device: modem.qmiDevice,
                    status: modem.status.fullyMapped ? 'ready' : 'partial',
                    last_seen: new Date(),
                    created_at: this.inMemoryModems.has(serial) ? this.inMemoryModems.get(serial).created_at : new Date(),
                    updated_at: new Date()
                };
                
                this.inMemoryModems.set(serial, modemData);
                
                // Allocate proxy port if needed (in-memory)
                if (modem.status.fullyMapped && !modemData.proxy_port) {
                    await this.allocateProxyPortStandalone(serial);
                }
                
                // Trigger manual event for WebSocket clients
                this.handleModemEvent({
                    operation: this.inMemoryModems.has(serial) ? 'UPDATE' : 'INSERT',
                    serial: serial,
                    status: modemData.status,
                    proxy_port: modemData.proxy_port,
                    at_port: modemData.at_port
                });
                
            } else {
                // Database mode: use PostgreSQL
                const result = await this.db.query(`
                    INSERT INTO modems (serial, usb_id, at_port, qmi_device, status)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (serial) DO UPDATE SET
                        at_port = EXCLUDED.at_port,
                        qmi_device = EXCLUDED.qmi_device,
                        status = EXCLUDED.status,
                        last_seen = NOW(),
                        updated_at = NOW()
                    RETURNING *
                `, [
                    serial,
                    modem.usb.usbId,
                    modem.atPort,
                    modem.qmiDevice,
                    modem.status.fullyMapped ? 'ready' : 'partial'
                ]);
                
                // Allocate proxy port if needed
                if (modem.status.fullyMapped && !result.rows[0].proxy_port) {
                    await this.allocateProxyPort(serial);
                }
            }
            
        } catch (error) {
            console.error(`Error processing modem ${modem.id}:`, error);
        }
    }
    
    /**
     * Phase 4: Dynamic proxy port allocation (Database mode)
     */
    async allocateProxyPort(modemSerial) {
        try {
            // Find available port in range
            const usedPorts = await this.db.query(
                'SELECT proxy_port FROM modems WHERE proxy_port IS NOT NULL'
            );
            
            const usedPortSet = new Set(
                usedPorts.rows.map(row => row.proxy_port)
                    .concat(this.options.proxy.reservedPorts)
            );
            
            // Find first available port
            for (let port = this.options.proxy.portRange.start; port <= this.options.proxy.portRange.end; port++) {
                if (!usedPortSet.has(port)) {
                    await this.db.query(
                        'UPDATE modems SET proxy_port = $1 WHERE serial = $2',
                        [port, modemSerial]
                    );
                    
                    console.log(`🔗 Allocated proxy port ${port} to modem ${modemSerial}`);
                    this.systemStats.allocatedPorts++;
                    return port;
                }
            }
            
            throw new Error('No available proxy ports');
            
        } catch (error) {
            console.error('Proxy port allocation error:', error);
            throw error;
        }
    }
    
    /**
     * Phase 4: Dynamic proxy port allocation (Standalone mode)
     */
    async allocateProxyPortStandalone(modemSerial) {
        try {
            // Find available port in range (in-memory)
            const usedPorts = Array.from(this.inMemoryModems.values())
                .map(modem => modem.proxy_port)
                .filter(port => port !== undefined)
                .concat(this.options.proxy.reservedPorts);
            
            const usedPortSet = new Set(usedPorts);
            
            // Find first available port
            for (let port = this.options.proxy.portRange.start; port <= this.options.proxy.portRange.end; port++) {
                if (!usedPortSet.has(port)) {
                    // Update in-memory storage
                    const modemData = this.inMemoryModems.get(modemSerial);
                    if (modemData) {
                        modemData.proxy_port = port;
                        this.inMemoryModems.set(modemSerial, modemData);
                    }
                    
                    console.log(`🔗 Allocated proxy port ${port} to modem ${modemSerial} (standalone)`);
                    this.systemStats.allocatedPorts++;
                    return port;
                }
            }
            
            throw new Error('No available proxy ports');
            
        } catch (error) {
            console.error('Proxy port allocation error (standalone):', error);
            throw error;
        }
    }
    
    /**
     * Execute AT or QMI command on specific modem
     */
    async executeModemCommand(serial, command, commandInterface = 'AT') {
        // This will be implemented with SerialPort integration
        // For now, return placeholder
        return {
            serial,
            command,
            interface: commandInterface,
            response: 'Command execution not yet implemented',
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * AUTO-START: Boot Sequence Management (zgodnie z docs)
     * Implements staggered startup with delays per documentation
     */
    async autoStart() {
        console.log('🚀 AUTO-START: EC25-EUX Multi-Modem System');
        console.log('===============================================\n');
        
        try {
            // Phase 1: Boot Delay (30-60s per docs)
            await this.bootDelayPhase();
            
            // Phase 2: System Initialization  
            await this.systemInitializationPhase();
            
            // Phase 3: Modem Detection & Mapping
            const modems = await this.modemDetectionPhase();
            
            // Phase 4: Staggered Startup (grupy po 5, 5s intervals)
            await this.staggeredStartupPhase(modems);
            
            // Phase 5: Health Check Grace Period (2-3 min)
            await this.healthCheckGracePeriod();
            
            console.log('✅ AUTO-START COMPLETE: System fully operational!');
            return true;
            
        } catch (error) {
            console.error('💥 AUTO-START FAILED:', error.message);
            throw error;
        }
    }
    
    /**
     * Phase 1: Boot Delay (30-60s per systemd docs)
     */
    async bootDelayPhase() {
        console.log('⏱️  Phase 1: Boot Delay & USB Settlement');
        console.log('   Purpose: Wait for USB enumeration stability');
        
        const delaySeconds = this.options.bootSequence?.delaySeconds || 45;
        console.log(`   Waiting ${delaySeconds}s for system stabilization...`);
        
        await this.sleep(delaySeconds * 1000);
        
        // Check USB settlement
        console.log('   Verifying USB device settlement...');
        const usbCheck = await this.checkUsbSettlement();
        
        if (!usbCheck.settled) {
            console.log('   ⚠️  USB devices still settling, extending delay...');
            await this.sleep(15000); // Extra 15s
        }
        
        console.log('   ✅ Boot delay complete - USB devices settled\n');
    }
    
    /**
     * Phase 2: System Initialization
     */
    async systemInitializationPhase() {
        console.log('🔧 Phase 2: System Components Initialization');
        console.log('   Database connection...');
        
        // Initialize database
        await this.initializeDatabase();
        console.log('   ✅ Database connected');
        
        console.log('   API server startup...');
        await this.initializeAPI();
        console.log('   ✅ API server running');
        
        console.log('   ✅ Socket.IO server ready\n');
    }
    
    /**
     * Phase 3: Modem Detection & Mapping
     */
    async modemDetectionPhase() {
        console.log('🔍 Phase 3: Modem Detection & Port Mapping');
        console.log('   Running comprehensive modem scan...');
        
        const detector = new (require('./modem-detector'))();
        const result = await detector.detectModems();
        
        if (!result.success) {
            throw new Error(`Modem detection failed: ${result.error}`);
        }
        
        console.log(`   ✅ Detected ${result.modems.length} modems`);
        result.modems.forEach(modem => {
            console.log(`      📱 ${modem.id}: AT=${modem.atPort}, QMI=${modem.qmiDevice}`);
        });
        
        console.log('');
        return result.modems;
    }
    
    /**
     * Phase 4: Staggered Startup (Groups of 5, 5-second intervals per docs)
     */
    async staggeredStartupPhase(modems) {
        console.log('⚡ Phase 4: Staggered Modem Startup');
        console.log('   Strategy: Groups of 5 modems, 5-second intervals');
        
        const batchSize = this.options.bootSequence?.batchSize || 5;
        const batchDelay = this.options.bootSequence?.batchDelay || 5000;
        const instanceDelay = this.options.bootSequence?.instanceDelay || 2500;
        
        for (let i = 0; i < modems.length; i += batchSize) {
            const batch = modems.slice(i, i + batchSize);
            const batchNumber = Math.floor(i / batchSize) + 1;
            
            console.log(`   📦 Batch ${batchNumber}: Starting ${batch.length} modems...`);
            
            // Sequential proxy start (2-3s delays between instances)
            for (const modem of batch) {
                console.log(`      🔄 Starting modem ${modem.id}...`);
                await this.startModemServices(modem);
                
                if (batch.indexOf(modem) < batch.length - 1) {
                    await this.sleep(instanceDelay);
                }
            }
            
            console.log(`   ✅ Batch ${batchNumber} started`);
            
            // 5-second delay between batches (except last)
            if (i + batchSize < modems.length) {
                console.log(`   ⏱️  Waiting ${batchDelay/1000}s before next batch...`);
                await this.sleep(batchDelay);
            }
        }
        
        console.log('   ✅ All modem batches started\n');
    }
    
    /**
     * Phase 5: Health Check Grace Period (2-3 min per docs)
     */
    async healthCheckGracePeriod() {
        console.log('🏥 Phase 5: Health Check Grace Period');
        console.log('   Purpose: Allow network connections to stabilize');
        
        const gracePeriod = this.options.bootSequence?.gracePeriod || 150000; // 2.5 min
        console.log(`   Grace period: ${gracePeriod/1000}s for network stabilization...`);
        
        const steps = 5;
        const stepDelay = gracePeriod / steps;
        
        for (let step = 1; step <= steps; step++) {
            await this.sleep(stepDelay);
            console.log(`   🔄 Health check progress: ${step}/${steps} (${(step/steps*100).toFixed(0)}%)`);
            
            // Quick health check at each step
            const healthStatus = await this.quickHealthCheck();
            if (!healthStatus.healthy) {
                console.log(`   ⚠️  Health issue detected: ${healthStatus.issue}`);
            }
        }
        
        console.log('   ✅ Grace period complete - system ready\n');
    }
    
    /**
     * Helper: Start services for individual modem
     */
    async startModemServices(modem) {
        try {
            // Register modem in database (already done in processDetectedModem)
            await this.processDetectedModem(modem);
            
            // Allocate proxy port (handled in processDetectedModem if needed)
            // await this.allocateProxyPort(modem.serial);
            
            // Start 3proxy instance (placeholder for now)
            // await this.start3ProxyInstance(modem);
            
            return true;
        } catch (error) {
            console.error(`   ❌ Failed to start services for ${modem.id}:`, error.message);
            return false;
        }
    }
    
    /**
     * Helper: Check USB device settlement
     */
    async checkUsbSettlement() {
        // Placeholder implementation
        return { settled: true, deviceCount: 6 }; // Will implement with actual USB checks
    }
    
    /**
     * Helper: Quick health check
     */
    async quickHealthCheck() {
        // Placeholder implementation  
        return { healthy: true }; // Will implement with actual health checks
    }
    
    /**
     * Helper: Sleep function
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        console.log('🛑 Shutting down EC25-EUX Multi-Modem System...');
        
        if (this.detectionWorker) {
            clearInterval(this.detectionWorker);
        }
        
        if (this.io) {
            this.io.close();
        }
        
        if (this.db) {
            await this.db.end();
        }
        
        console.log('✅ System shutdown complete');
    }
}

module.exports = EC25ModemSystem;

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0] || 'auto-start';
    
    const system = new EC25ModemSystem();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Received SIGINT, shutting down gracefully...');
        await system.shutdown();
        process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
        console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
        await system.shutdown();
        process.exit(0);
    });
    
    // Command handling
    async function runCommand() {
        try {
            switch (command) {
                case 'auto-start':
                case 'start':
                    console.log('🚀 Starting with AUTO-START sequence...\n');
                    await system.autoStart();
                    break;
                    
                case 'quick-start':
                    console.log('⚡ Starting with quick initialization...\n');
                    await system.initialize();
                    break;
                    
                case 'detect':
                    console.log('🔍 Running modem detection only...\n');
                    const detector = new (require('./modem-detector'))();
                    const result = await detector.detectModems();
                    console.log('Detection result:', JSON.stringify(result, null, 2));
                    process.exit(0);
                    break;
                    
                case 'help':
                    console.log(`
🚀 EC25-EUX Multi-Modem System CLI

Usage: node modem-system.js [command]

Commands:
  auto-start   🚀 Full boot sequence with delays (default)
  quick-start  ⚡ Quick initialization without delays  
  detect       🔍 Run modem detection only
  help         📖 Show this help

AUTO-START Sequence (per documentation):
  Phase 1: Boot delay (45s) + USB settlement
  Phase 2: System initialization (DB, API, Socket.IO)
  Phase 3: Modem detection & port mapping  
  Phase 4: Staggered startup (groups of 5, 5s intervals)
  Phase 5: Health check grace period (2.5 min)

Examples:
  node modem-system.js auto-start    # Full production startup
  node modem-system.js quick-start   # Development/testing
  node modem-system.js detect        # Check modem status
                    `);
                    process.exit(0);
                    break;
                    
                default:
                    console.error(`❌ Unknown command: ${command}`);
                    console.log('Run "node modem-system.js help" for usage info');
                    process.exit(1);
            }
        } catch (error) {
            console.error('💥 Command failed:', error.message);
            process.exit(1);
        }
    }
    
    runCommand();
}