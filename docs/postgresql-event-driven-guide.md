# PostgreSQL Event-Driven Architecture Guide

> **⚠️ GENERATED DOCUMENTATION**: This document was created by Claude based on system requirements analysis, not from provided source materials.

## Overview

This guide covers PostgreSQL event-driven architecture implementation for our **multi-modem LTE proxy system**. It focuses on LISTEN/NOTIFY mechanisms, connection pooling strategies, and database design patterns optimized for real-time modem management.

**Context**: 30+ EC25-EUX modems, real-time status updates, event-driven proxy management, WebSocket streaming to frontend.

---

## 1. Event-Driven Architecture Fundamentals

### Core Concept
Traditional polling-based systems query the database repeatedly to check for changes. Event-driven systems use PostgreSQL's LISTEN/NOTIFY to receive immediate notifications when data changes, eliminating polling overhead and providing real-time responsiveness.

### Our Implementation Pattern
```
Modem Detection → Database Trigger → NOTIFY → Node.js Worker → WebSocket → Frontend
```

### Performance Characteristics
- **Latency**: ~1-5ms for local notifications
- **Throughput**: 8000+ notifications/second on modern hardware  
- **Memory**: ~100 bytes per active listener
- **Connection Overhead**: Minimal (uses existing connections)

---

## 2. Database Schema Design for Events

### Core Tables (Enhanced)
```sql
-- Modems table with optimized indexing for events
CREATE TABLE modems (
    serial VARCHAR(50) PRIMARY KEY,           -- Stable identifier
    path_at VARCHAR(255),                     -- AT command interface
    path_qmi VARCHAR(255),                    -- QMI interface  
    interface VARCHAR(50),                    -- Network interface (wwanX)
    interface_id INTEGER UNIQUE,             -- Dynamic interface number (0,1,2...)
    proxy_port INTEGER UNIQUE,               -- Dynamically allocated 3proxy port
    routing_table_id INTEGER UNIQUE,         -- Dynamic routing table (100+interface_id)
    status VARCHAR(20) DEFAULT 'offline',    -- online/offline/error/initializing
    last_seen TIMESTAMP DEFAULT NOW(),       -- Last activity
    operator VARCHAR(100),                   -- Network operator
    signal_strength INTEGER,                 -- 0-31 range
    wan_ip INET,                             -- Current WAN IP
    
    -- Event optimization fields
    status_changed_at TIMESTAMP DEFAULT NOW(),
    event_sequence BIGSERIAL,               -- For ordering events
    metadata JSONB DEFAULT '{}',            -- Flexible event data
    
    -- Performance indexes
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for event-driven queries
CREATE INDEX idx_modems_status_changed ON modems(status_changed_at);
CREATE INDEX idx_modems_event_sequence ON modems(event_sequence);
CREATE INDEX idx_modems_status_active ON modems(status) WHERE status = 'online';
CREATE INDEX idx_modems_metadata_gin ON modems USING GIN(metadata);
CREATE INDEX idx_modems_interface_id ON modems(interface_id);
CREATE INDEX idx_modems_proxy_port ON modems(proxy_port);
CREATE INDEX idx_modems_routing_table ON modems(routing_table_id);

-- Event log table for audit and replay
CREATE TABLE modem_events (
    id BIGSERIAL PRIMARY KEY,
    modem_serial VARCHAR(50) REFERENCES modems(serial),
    event_type VARCHAR(50) NOT NULL,        -- INSERT, UPDATE, DELETE, HEARTBEAT
    old_data JSONB,                         -- Previous state
    new_data JSONB,                         -- New state  
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP,                 -- When worker processed
    processing_duration_ms INTEGER          -- Performance tracking
);

CREATE INDEX idx_events_created_at ON modem_events(created_at);
CREATE INDEX idx_events_type_serial ON modem_events(event_type, modem_serial);
CREATE INDEX idx_events_unprocessed ON modem_events(processed_at) WHERE processed_at IS NULL;
```

### Event Channels Strategy
```sql
-- Multiple channels for different event types
-- This allows selective listening and reduces noise

-- Primary channel for status changes
NOTIFY modem_status_change, '{"serial":"EC25_12345","status":"online","port":3128}';

-- Dedicated channel for health events  
NOTIFY modem_health, '{"serial":"EC25_12345","signal":25,"operator":"Vodafone"}';

-- System-level events
NOTIFY system_events, '{"type":"boot_complete","modems_online":28}';

-- Critical alerts
NOTIFY modem_alerts, '{"serial":"EC25_12345","level":"critical","message":"Connection lost"}';
```

---

## 3. Advanced Trigger Implementation

### Optimized Event Trigger Function
```sql
CREATE OR REPLACE FUNCTION notify_modem_events()
RETURNS TRIGGER AS $$
DECLARE
    channel_name TEXT;
    payload JSONB;
    old_payload JSONB;
    event_data JSONB;
BEGIN
    -- Determine event type and channel
    IF TG_OP = 'INSERT' THEN
        channel_name := 'modem_status_change';
        payload := jsonb_build_object(
            'operation', 'INSERT',
            'serial', NEW.serial,
            'status', NEW.status,
            'proxy_port', NEW.proxy_port,
            'timestamp', extract(epoch from NEW.updated_at),
            'sequence', NEW.event_sequence
        );
        
        -- Log event for audit
        INSERT INTO modem_events (modem_serial, event_type, new_data)
        VALUES (NEW.serial, 'INSERT', row_to_json(NEW)::jsonb);
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Only notify if significant fields changed
        IF (OLD.status IS DISTINCT FROM NEW.status OR 
            OLD.proxy_port IS DISTINCT FROM NEW.proxy_port OR
            OLD.wan_ip IS DISTINCT FROM NEW.wan_ip OR
            OLD.signal_strength IS DISTINCT FROM NEW.signal_strength) THEN
            
            -- Determine appropriate channel based on change type
            IF OLD.status IS DISTINCT FROM NEW.status THEN
                channel_name := 'modem_status_change';
            ELSIF OLD.signal_strength IS DISTINCT FROM NEW.signal_strength THEN
                channel_name := 'modem_health';
            ELSE
                channel_name := 'modem_config_change';
            END IF;
            
            payload := jsonb_build_object(
                'operation', 'UPDATE',
                'serial', NEW.serial,
                'old_status', OLD.status,
                'new_status', NEW.status,
                'proxy_port', NEW.proxy_port,
                'wan_ip', NEW.wan_ip,
                'signal_strength', NEW.signal_strength,
                'operator', NEW.operator,
                'timestamp', extract(epoch from NEW.updated_at),
                'sequence', NEW.event_sequence
            );
            
            -- Log detailed change
            INSERT INTO modem_events (modem_serial, event_type, old_data, new_data)
            VALUES (NEW.serial, 'UPDATE', row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
        ELSE
            -- Minor update, no notification needed
            RETURN NEW;
        END IF;
        
    ELSIF TG_OP = 'DELETE' THEN
        channel_name := 'modem_status_change';
        payload := jsonb_build_object(
            'operation', 'DELETE',
            'serial', OLD.serial,
            'proxy_port', OLD.proxy_port,
            'timestamp', extract(epoch from now())
        );
        
        -- Log deletion
        INSERT INTO modem_events (modem_serial, event_type, old_data)
        VALUES (OLD.serial, 'DELETE', row_to_json(OLD)::jsonb);
    END IF;
    
    -- Send notification (async, non-blocking)
    PERFORM pg_notify(channel_name, payload::text);
    
    -- Update sequence and timestamp for UPDATE
    IF TG_OP = 'UPDATE' THEN
        NEW.updated_at := NOW();
        NEW.status_changed_at := CASE 
            WHEN OLD.status IS DISTINCT FROM NEW.status THEN NOW()
            ELSE OLD.status_changed_at
        END;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS modems_change_trigger ON modems;
CREATE TRIGGER modems_change_trigger
    AFTER INSERT OR UPDATE OR DELETE ON modems
    FOR EACH ROW EXECUTE FUNCTION notify_modem_events();
```

### Batching Support for High-Frequency Events
```sql
-- Function to batch multiple events (useful during boot)
CREATE OR REPLACE FUNCTION batch_modem_updates(
    modem_data JSONB[]
) RETURNS INTEGER AS $$
DECLARE
    rec JSONB;
    affected_count INTEGER := 0;
BEGIN
    -- Temporarily disable triggers for batch operation
    ALTER TABLE modems DISABLE TRIGGER modems_change_trigger;
    
    -- Process batch updates
    FOREACH rec IN ARRAY modem_data LOOP
        INSERT INTO modems (serial, status, proxy_port, wan_ip, signal_strength, operator)
        VALUES (
            rec->>'serial',
            rec->>'status', 
            (rec->>'proxy_port')::integer,
            (rec->>'wan_ip')::inet,
            (rec->>'signal_strength')::integer,
            rec->>'operator'
        )
        ON CONFLICT (serial) DO UPDATE SET
            status = EXCLUDED.status,
            proxy_port = EXCLUDED.proxy_port,
            wan_ip = EXCLUDED.wan_ip,
            signal_strength = EXCLUDED.signal_strength,
            operator = EXCLUDED.operator,
            updated_at = NOW(),
            event_sequence = nextval('modems_event_sequence_seq');
            
        affected_count := affected_count + 1;
    END LOOP;
    
    -- Re-enable triggers
    ALTER TABLE modems ENABLE TRIGGER modems_change_trigger;
    
    -- Send single batch notification
    PERFORM pg_notify('modem_batch_update', jsonb_build_object(
        'operation', 'BATCH_UPDATE',
        'count', affected_count,
        'timestamp', extract(epoch from now())
    )::text);
    
    RETURN affected_count;
END;
$$ LANGUAGE plpgsql;
```

---

## 4. Connection Pooling Strategy

### Pool Configuration for Event-Driven Architecture
```javascript
// optimized-pool-config.js
const { Pool } = require('pg');

class EventDrivenPool {
    constructor() {
        // Main connection pool for regular queries
        this.queryPool = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'modems_db',
            user: process.env.DB_USER || 'modems_user',
            password: process.env.DB_PASSWORD,
            
            // Optimized for high-frequency operations
            max: 20,                    // Max connections
            min: 5,                     // Always keep 5 connections open
            idleTimeoutMillis: 30000,   // Close idle connections after 30s
            connectionTimeoutMillis: 5000, // Timeout for new connections
            maxUses: 7500,              // Retire connections after 7500 queries
            
            // Event-driven optimizations
            keepAlive: true,
            keepAliveInitialDelayMillis: 10000,
            
            // Error handling
            statement_timeout: 30000,   // 30s statement timeout
            query_timeout: 25000,       // 25s query timeout
        });
        
        // Dedicated connection for LISTEN operations (never pooled)
        this.listenConnection = null;
        this.eventHandlers = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        
        this.setupEventConnection();
    }
    
    async setupEventConnection() {
        try {
            this.listenConnection = new Pool({
                host: process.env.DB_HOST || 'localhost',
                port: process.env.DB_PORT || 5432,
                database: process.env.DB_NAME || 'modems_db',
                user: process.env.DB_USER || 'modems_user',
                password: process.env.DB_PASSWORD,
                
                // Dedicated for LISTEN - single persistent connection
                max: 1,
                min: 1,
                idleTimeoutMillis: 0,   // Never timeout
                connectionTimeoutMillis: 10000,
                
                // Keep connection alive aggressively
                keepAlive: true,
                keepAliveInitialDelayMillis: 1000,
            });
            
            const client = await this.listenConnection.connect();
            
            // Setup all our LISTEN channels
            await client.query('LISTEN modem_status_change');
            await client.query('LISTEN modem_health');
            await client.query('LISTEN modem_config_change');
            await client.query('LISTEN modem_batch_update');
            await client.query('LISTEN system_events');
            await client.query('LISTEN modem_alerts');
            
            // Setup notification handler
            client.on('notification', this.handleNotification.bind(this));
            
            // Setup connection error handling
            client.on('error', this.handleConnectionError.bind(this));
            
            console.log('PostgreSQL LISTEN connection established');
            this.reconnectAttempts = 0;
            
        } catch (error) {
            console.error('Failed to setup event connection:', error);
            await this.reconnectEventConnection();
        }
    }
    
    async reconnectEventConnection() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached. Manual intervention required.');
            process.exit(1);
        }
        
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        
        console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        
        setTimeout(() => {
            this.setupEventConnection();
        }, delay);
    }
    
    handleNotification(notification) {
        try {
            const { channel, payload } = notification;
            const data = JSON.parse(payload);
            
            // Route to appropriate handlers
            const handlers = this.eventHandlers.get(channel) || [];
            handlers.forEach(handler => {
                try {
                    handler(data, channel);
                } catch (handlerError) {
                    console.error(`Event handler error for ${channel}:`, handlerError);
                }
            });
            
            // Global event logging
            console.log(`Event received: ${channel}`, {
                serial: data.serial,
                operation: data.operation,
                timestamp: data.timestamp
            });
            
        } catch (parseError) {
            console.error('Failed to parse notification payload:', parseError);
        }
    }
    
    handleConnectionError(error) {
        console.error('PostgreSQL LISTEN connection error:', error);
        this.listenConnection = null;
        this.reconnectEventConnection();
    }
    
    // Register event handler
    on(channel, handler) {
        if (!this.eventHandlers.has(channel)) {
            this.eventHandlers.set(channel, []);
        }
        this.eventHandlers.get(channel).push(handler);
    }
    
    // Remove event handler
    off(channel, handler) {
        const handlers = this.eventHandlers.get(channel);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }
    
    // Standard query method
    async query(text, params) {
        const start = Date.now();
        try {
            const result = await this.queryPool.query(text, params);
            const duration = Date.now() - start;
            
            // Log slow queries
            if (duration > 1000) {
                console.warn(`Slow query (${duration}ms):`, text.substring(0, 100));
            }
            
            return result;
        } catch (error) {
            console.error('Query error:', error);
            throw error;
        }
    }
    
    // Transaction support
    async transaction(callback) {
        const client = await this.queryPool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
    
    // Graceful shutdown
    async close() {
        console.log('Closing PostgreSQL connections...');
        
        if (this.listenConnection) {
            await this.listenConnection.end();
        }
        
        await this.queryPool.end();
        console.log('PostgreSQL connections closed');
    }
}

module.exports = EventDrivenPool;
```

---

## 5. Event Processing Patterns

### Event Router Implementation
```javascript
// event-router.js
class ModemEventRouter {
    constructor(database, webSocketManager, proxyManager) {
        this.db = database;
        this.wsManager = webSocketManager;
        this.proxyManager = proxyManager;
        
        // Setup event handlers
        this.setupEventHandlers();
        
        // Performance tracking
        this.eventStats = {
            processed: 0,
            errors: 0,
            averageProcessingTime: 0
        };
    }
    
    setupEventHandlers() {
        // Status change events
        this.db.on('modem_status_change', this.handleStatusChange.bind(this));
        
        // Health monitoring events
        this.db.on('modem_health', this.handleHealthUpdate.bind(this));
        
        // Configuration changes
        this.db.on('modem_config_change', this.handleConfigChange.bind(this));
        
        // Batch updates (during boot)
        this.db.on('modem_batch_update', this.handleBatchUpdate.bind(this));
        
        // System events
        this.db.on('system_events', this.handleSystemEvent.bind(this));
        
        // Critical alerts
        this.db.on('modem_alerts', this.handleCriticalAlert.bind(this));
    }
    
    async handleStatusChange(event, channel) {
        const startTime = Date.now();
        
        try {
            console.log(`Status change: ${event.serial} ${event.old_status} → ${event.new_status}`);
            
            // 1. Update proxy configuration if needed
            if (event.operation === 'INSERT' && event.proxy_port) {
                await this.proxyManager.createInstance(event.serial, event.proxy_port);
            } else if (event.operation === 'DELETE') {
                await this.proxyManager.removeInstance(event.serial);
            }
            
            // 2. Broadcast to WebSocket clients
            this.wsManager.broadcast('modem_status', {
                serial: event.serial,
                status: event.new_status,
                proxyPort: event.proxy_port,
                timestamp: event.timestamp
            });
            
            // 3. Update system metrics
            await this.updateSystemMetrics(event);
            
            // 4. Log processing completion
            await this.markEventProcessed(event, Date.now() - startTime);
            
        } catch (error) {
            console.error(`Error processing status change for ${event.serial}:`, error);
            await this.handleEventError(event, error);
        }
    }
    
    async handleHealthUpdate(event, channel) {
        const startTime = Date.now();
        
        try {
            // Health updates are high-frequency, batch them
            await this.batchHealthUpdate(event);
            
            // Send to monitoring dashboard
            this.wsManager.broadcast('modem_health', {
                serial: event.serial,
                signalStrength: event.signal_strength,
                operator: event.operator,
                timestamp: event.timestamp
            });
            
            await this.markEventProcessed(event, Date.now() - startTime);
            
        } catch (error) {
            console.error(`Error processing health update for ${event.serial}:`, error);
        }
    }
    
    async handleCriticalAlert(event, channel) {
        console.error(`CRITICAL ALERT: ${event.serial} - ${event.message}`);
        
        // Immediate WebSocket broadcast
        this.wsManager.broadcast('critical_alert', event);
        
        // Log to system alerts
        await this.db.query(`
            INSERT INTO system_alerts (modem_serial, level, message, created_at)
            VALUES ($1, $2, $3, NOW())
        `, [event.serial, event.level, event.message]);
        
        // Trigger emergency procedures if needed
        if (event.level === 'critical') {
            await this.triggerEmergencyResponse(event);
        }
    }
    
    async batchHealthUpdate(event) {
        // Batch health updates to reduce database load
        if (!this.healthUpdateBatch) {
            this.healthUpdateBatch = [];
            
            // Process batch every 5 seconds
            setTimeout(() => this.processHealthBatch(), 5000);
        }
        
        this.healthUpdateBatch.push(event);
    }
    
    async processHealthBatch() {
        if (!this.healthUpdateBatch || this.healthUpdateBatch.length === 0) {
            return;
        }
        
        const batch = this.healthUpdateBatch;
        this.healthUpdateBatch = [];
        
        try {
            // Bulk update health metrics
            const values = batch.map(event => 
                `('${event.serial}', ${event.signal_strength}, '${event.operator}', NOW())`
            ).join(',');
            
            await this.db.query(`
                INSERT INTO modem_health_history (serial, signal_strength, operator, recorded_at)
                VALUES ${values}
            `);
            
            console.log(`Processed ${batch.length} health updates in batch`);
            
        } catch (error) {
            console.error('Error processing health batch:', error);
        }
    }
    
    async markEventProcessed(event, processingTime) {
        // Update event log with processing completion
        await this.db.query(`
            UPDATE modem_events 
            SET processed_at = NOW(), processing_duration_ms = $1
            WHERE modem_serial = $2 AND created_at = to_timestamp($3)
        `, [processingTime, event.serial, event.timestamp]);
        
        // Update statistics
        this.eventStats.processed++;
        this.eventStats.averageProcessingTime = 
            (this.eventStats.averageProcessingTime + processingTime) / 2;
    }
    
    // Get processing statistics
    getStats() {
        return {
            ...this.eventStats,
            queueLength: this.healthUpdateBatch?.length || 0
        };
    }
}

module.exports = ModemEventRouter;
```

---

## 6. Performance Optimization

### Query Optimization Patterns
```sql
-- Optimized queries for common operations

-- 1. Get all online modems with minimal data transfer
CREATE OR REPLACE FUNCTION get_online_modems()
RETURNS TABLE(serial VARCHAR, proxy_port INTEGER, wan_ip INET) AS $$
BEGIN
    RETURN QUERY
    SELECT m.serial, m.proxy_port, m.wan_ip
    FROM modems m
    WHERE m.status = 'online'
    ORDER BY m.event_sequence DESC;  -- Most recent first
END;
$$ LANGUAGE plpgsql;

-- 2. Health check with aggregated statistics
CREATE OR REPLACE FUNCTION get_system_health()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_modems', COUNT(*),
        'online_modems', COUNT(*) FILTER (WHERE status = 'online'),
        'offline_modems', COUNT(*) FILTER (WHERE status = 'offline'),
        'error_modems', COUNT(*) FILTER (WHERE status = 'error'),
        'average_signal', AVG(signal_strength) FILTER (WHERE status = 'online'),
        'last_update', MAX(updated_at)
    )
    INTO result
    FROM modems;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 3. Event replay for system recovery
CREATE OR REPLACE FUNCTION replay_events_since(since_timestamp TIMESTAMP)
RETURNS TABLE(event_data JSONB) AS $$
BEGIN
    RETURN QUERY
    SELECT new_data
    FROM modem_events
    WHERE created_at >= since_timestamp
    ORDER BY created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- 4. Dynamic resource allocation functions
CREATE OR REPLACE FUNCTION allocate_interface_id()
RETURNS INTEGER AS $$
DECLARE
    next_id INTEGER;
BEGIN
    -- Find next available interface ID
    SELECT COALESCE(MIN(t.id), 0)
    INTO next_id
    FROM (
        SELECT generate_series(0, 999) AS id
        EXCEPT 
        SELECT interface_id FROM modems WHERE interface_id IS NOT NULL
    ) t;
    
    RETURN next_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION allocate_proxy_port()
RETURNS INTEGER AS $$
DECLARE
    next_port INTEGER;
BEGIN
    -- Find next available port in range 3128-4127
    SELECT COALESCE(MIN(t.port), 3128)
    INTO next_port
    FROM (
        SELECT generate_series(3128, 4127) AS port
        EXCEPT 
        SELECT proxy_port FROM modems WHERE proxy_port IS NOT NULL
    ) t;
    
    RETURN next_port;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION allocate_routing_table()
RETURNS INTEGER AS $$
DECLARE
    next_table INTEGER;
BEGIN
    -- Find next available routing table in range 100-999
    SELECT COALESCE(MIN(t.table_id), 100)
    INTO next_table
    FROM (
        SELECT generate_series(100, 999) AS table_id
        EXCEPT 
        SELECT routing_table_id FROM modems WHERE routing_table_id IS NOT NULL
    ) t;
    
    RETURN next_table;
END;
$$ LANGUAGE plpgsql;
```

### Connection Pool Monitoring
```javascript
// pool-monitor.js
class PoolMonitor {
    constructor(pool) {
        this.pool = pool;
        this.metrics = {
            totalConnections: 0,
            idleConnections: 0,
            waitingClients: 0,
            errors: 0
        };
        
        this.startMonitoring();
    }
    
    startMonitoring() {
        setInterval(() => {
            this.collectMetrics();
        }, 10000); // Every 10 seconds
    }
    
    collectMetrics() {
        const pool = this.pool.queryPool;
        
        this.metrics = {
            totalConnections: pool.totalCount,
            idleConnections: pool.idleCount,
            waitingClients: pool.waitingCount,
            errors: pool.errorCount || 0
        };
        
        // Log warnings for potential issues
        if (this.metrics.waitingClients > 5) {
            console.warn(`High waiting clients: ${this.metrics.waitingClients}`);
        }
        
        if (this.metrics.idleConnections === 0 && this.metrics.totalConnections > 15) {
            console.warn('Pool exhaustion risk - consider increasing pool size');
        }
    }
    
    getMetrics() {
        return {
            ...this.metrics,
            utilizationPercent: Math.round(
                ((this.metrics.totalConnections - this.metrics.idleConnections) / 
                 this.metrics.totalConnections) * 100
            )
        };
    }
}
```

---

## 7. Error Recovery & Failover

### Connection Recovery Strategy
```javascript
// connection-recovery.js
class ConnectionRecovery {
    constructor(database) {
        this.db = database;
        this.healthCheckInterval = null;
        this.eventBuffer = [];
        this.maxBufferSize = 1000;
    }
    
    startHealthChecking() {
        this.healthCheckInterval = setInterval(async () => {
            try {
                await this.db.query('SELECT 1');
                
                // Process any buffered events
                if (this.eventBuffer.length > 0) {
                    await this.processBufferedEvents();
                }
                
            } catch (error) {
                console.error('Database health check failed:', error);
                await this.handleConnectionFailure();
            }
        }, 30000); // Every 30 seconds
    }
    
    async handleConnectionFailure() {
        console.log('Database connection failure detected, entering recovery mode');
        
        // Buffer events instead of processing them
        this.bufferMode = true;
        
        // Attempt reconnection
        await this.db.reconnectEventConnection();
    }
    
    bufferEvent(event) {
        if (this.eventBuffer.length >= this.maxBufferSize) {
            // Remove oldest event to make room
            this.eventBuffer.shift();
        }
        
        this.eventBuffer.push({
            ...event,
            bufferedAt: Date.now()
        });
    }
    
    async processBufferedEvents() {
        console.log(`Processing ${this.eventBuffer.length} buffered events`);
        
        const events = this.eventBuffer.splice(0); // Clear buffer
        
        for (const event of events) {
            try {
                // Process with timeout to prevent hanging
                await this.processEventWithTimeout(event, 5000);
            } catch (error) {
                console.error('Error processing buffered event:', error);
            }
        }
        
        this.bufferMode = false;
    }
    
    async processEventWithTimeout(event, timeoutMs) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Event processing timeout'));
            }, timeoutMs);
            
            this.processEvent(event)
                .then(resolve)
                .catch(reject)
                .finally(() => clearTimeout(timeout));
        });
    }
}
```

This PostgreSQL Event-Driven Architecture provides the foundation for real-time modem management with optimized performance, reliable event processing, and robust error recovery mechanisms.
