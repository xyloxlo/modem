# Node.js Multi-Serial Production Guide

> **⚠️ GENERATED DOCUMENTATION**: This document was created by Claude based on system requirements analysis and Node.js production patterns, not from provided source materials.

## Overview

This guide covers Node.js production patterns for managing **30+ concurrent serial connections** to EC25-EUX modems, with focus on memory management, error handling, async/await optimization, and resource leak prevention.

**Context**: AT command interfaces, QMI protocol integration, real-time health monitoring, concurrent serial operations, production stability.

---

## 1. Memory Management for Long-Running Serial Operations

### Memory Leak Prevention Strategy

#### Buffer Management
```javascript
// optimized-serial-manager.js
class OptimizedSerialManager {
    constructor() {
        this.connections = new Map();
        this.bufferPool = new BufferPool(1024, 50); // Pre-allocated buffers
        this.circularBuffers = new Map(); // Per-modem circular buffers
        
        // Memory monitoring
        this.memoryStats = {
            heapUsed: 0,
            heapTotal: 0,
            external: 0,
            bufferCount: 0
        };
        
        this.startMemoryMonitoring();
    }
    
    createModemConnection(serial, devicePath) {
        // Pre-allocate circular buffer for this modem
        const circularBuffer = new CircularBuffer(4096); // 4KB per modem
        this.circularBuffers.set(serial, circularBuffer);
        
        const connection = {
            serial,
            devicePath,
            port: null,
            parser: null,
            commandQueue: new Queue(),
            responseBuffer: circularBuffer,
            
            // Memory management
            lastGC: Date.now(),
            bufferStats: {
                allocated: 0,
                freed: 0,
                peak: 0
            }
        };
        
        this.connections.set(serial, connection);
        return connection;
    }
    
    destroyModemConnection(serial) {
        const connection = this.connections.get(serial);
        if (!connection) return;
        
        // Explicit cleanup
        if (connection.port) {
            connection.port.close();
            connection.port.removeAllListeners();
        }
        
        if (connection.parser) {
            connection.parser.removeAllListeners();
        }
        
        // Release circular buffer
        const circularBuffer = this.circularBuffers.get(serial);
        if (circularBuffer) {
            circularBuffer.destroy();
            this.circularBuffers.delete(serial);
        }
        
        // Clear command queue
        connection.commandQueue.clear();
        
        this.connections.delete(serial);
        
        // Force garbage collection hint
        if (global.gc && (Date.now() - connection.lastGC) > 60000) {
            global.gc();
            connection.lastGC = Date.now();
        }
    }
    
    startMemoryMonitoring() {
        setInterval(() => {
            const memUsage = process.memoryUsage();
            
            this.memoryStats = {
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
                external: Math.round(memUsage.external / 1024 / 1024),
                bufferCount: this.circularBuffers.size
            };
            
            // Memory leak detection
            if (this.memoryStats.heapUsed > 500) { // > 500MB
                console.warn('High memory usage detected:', this.memoryStats);
                this.performMemoryOptimization();
            }
            
            // Log memory stats every 5 minutes
            if (Date.now() % 300000 < 10000) {
                console.log('Memory stats:', this.memoryStats);
            }
            
        }, 10000); // Every 10 seconds
    }
    
    performMemoryOptimization() {
        console.log('Performing memory optimization...');
        
        // 1. Clear old command queues
        for (const [serial, connection] of this.connections) {
            connection.commandQueue.removeOld(30000); // Remove commands older than 30s
        }
        
        // 2. Compress circular buffers
        for (const [serial, buffer] of this.circularBuffers) {
            buffer.compact();
        }
        
        // 3. Force garbage collection if available
        if (global.gc) {
            global.gc();
            console.log('Garbage collection triggered');
        }
    }
}

// Circular buffer implementation for efficient memory usage
class CircularBuffer {
    constructor(size) {
        this.buffer = Buffer.allocUnsafe(size);
        this.size = size;
        this.head = 0;
        this.tail = 0;
        this.count = 0;
    }
    
    write(data) {
        const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
        const writeLength = Math.min(dataBuffer.length, this.size - this.count);
        
        if (writeLength === 0) return 0; // Buffer full
        
        // Handle wrap-around
        if (this.head + writeLength <= this.size) {
            dataBuffer.copy(this.buffer, this.head, 0, writeLength);
        } else {
            const firstChunk = this.size - this.head;
            dataBuffer.copy(this.buffer, this.head, 0, firstChunk);
            dataBuffer.copy(this.buffer, 0, firstChunk, writeLength);
        }
        
        this.head = (this.head + writeLength) % this.size;
        this.count += writeLength;
        
        return writeLength;
    }
    
    read(length) {
        const readLength = Math.min(length, this.count);
        if (readLength === 0) return Buffer.alloc(0);
        
        const result = Buffer.allocUnsafe(readLength);
        
        // Handle wrap-around
        if (this.tail + readLength <= this.size) {
            this.buffer.copy(result, 0, this.tail, this.tail + readLength);
        } else {
            const firstChunk = this.size - this.tail;
            this.buffer.copy(result, 0, this.tail, this.size);
            this.buffer.copy(result, firstChunk, 0, readLength - firstChunk);
        }
        
        this.tail = (this.tail + readLength) % this.size;
        this.count -= readLength;
        
        return result;
    }
    
    compact() {
        if (this.count < this.size / 4) {
            // If buffer is less than 25% full, create smaller buffer
            const newSize = Math.max(this.count * 2, 1024);
            const newBuffer = Buffer.allocUnsafe(newSize);
            const data = this.read(this.count);
            
            this.buffer = newBuffer;
            this.size = newSize;
            this.head = 0;
            this.tail = 0;
            this.count = 0;
            
            this.write(data);
        }
    }
    
    destroy() {
        this.buffer = null;
        this.size = 0;
        this.head = 0;
        this.tail = 0;
        this.count = 0;
    }
}
```

---

## 2. Async/Await Patterns for Concurrent Serial Operations

### Optimized Concurrency Control
```javascript
// concurrency-controller.js
class SerialConcurrencyController {
    constructor(maxConcurrent = null) {
        // Auto-detect optimal concurrency based on system resources
        this.maxConcurrent = maxConcurrent || this.calculateOptimalConcurrency();
        this.activeTasks = new Set();
        this.pendingQueue = [];
        this.semaphore = new Semaphore(this.maxConcurrent);
        
        // Performance tracking
        this.stats = {
            totalRequests: 0,
            completedRequests: 0,
            failedRequests: 0,
            averageLatency: 0,
            queueLength: 0
        };
        
        console.log(`Concurrency controller initialized with max ${this.maxConcurrent} concurrent operations`);
    }
    
    calculateOptimalConcurrency() {
        const os = require('os');
        
        // Calculate based on available system resources
        const totalMemMB = Math.floor(os.totalmem() / 1024 / 1024);
        const cpuCores = os.cpus().length;
        
        // Conservative estimates:
        // - ~128MB RAM per modem (with buffers and overhead)
        // - ~2 modems per CPU core for AT command processing
        const memoryBasedLimit = Math.floor(totalMemMB / 128);
        const cpuBasedLimit = cpuCores * 2;
        
        // Use the more conservative limit, but cap at reasonable bounds
        const calculated = Math.min(memoryBasedLimit, cpuBasedLimit);
        const optimal = Math.max(10, Math.min(calculated, 100)); // Between 10-100
        
        console.log(`System resources: ${totalMemMB}MB RAM, ${cpuCores} CPU cores`);
        console.log(`Calculated optimal concurrency: ${optimal} (mem-based: ${memoryBasedLimit}, cpu-based: ${cpuBasedLimit})`);
        
        return optimal;
    }
    
    // Execute AT command with concurrency control
    async executeCommand(serial, command, timeout = 5000) {
        const startTime = Date.now();
        this.stats.totalRequests++;
        
        try {
            // Acquire semaphore (wait if max concurrent reached)
            await this.semaphore.acquire();
            
            const taskId = `${serial}-${command}-${startTime}`;
            this.activeTasks.add(taskId);
            
            try {
                // Execute with timeout and abort signal
                const result = await this.executeWithTimeout(serial, command, timeout);
                
                this.stats.completedRequests++;
                const latency = Date.now() - startTime;
                this.updateAverageLatency(latency);
                
                return result;
                
            } finally {
                this.activeTasks.delete(taskId);
                this.semaphore.release();
            }
            
        } catch (error) {
            this.stats.failedRequests++;
            throw error;
        }
    }
    
    async executeWithTimeout(serial, command, timeout) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const connection = this.getConnection(serial);
            if (!connection) {
                throw new Error(`No connection for modem ${serial}`);
            }
            
            return await this.sendATCommand(connection, command, controller.signal);
            
        } finally {
            clearTimeout(timeoutId);
        }
    }
    
    async sendATCommand(connection, command, abortSignal) {
        return new Promise((resolve, reject) => {
            if (abortSignal.aborted) {
                reject(new Error('Command aborted'));
                return;
            }
            
            const commandId = Math.random().toString(36).substr(2, 9);
            const responsePattern = this.getResponsePattern(command);
            
            let responseBuffer = '';
            let timeoutHandle;
            
            const cleanup = () => {
                if (timeoutHandle) clearTimeout(timeoutHandle);
                connection.parser.removeListener('data', dataHandler);
                abortSignal.removeEventListener('abort', abortHandler);
            };
            
            const dataHandler = (data) => {
                responseBuffer += data.toString();
                
                // Check for command completion
                if (this.isCommandComplete(responseBuffer, responsePattern)) {
                    cleanup();
                    const result = this.parseATResponse(command, responseBuffer);
                    resolve(result);
                }
            };
            
            const abortHandler = () => {
                cleanup();
                reject(new Error('Command aborted by timeout'));
            };
            
            // Setup listeners
            connection.parser.on('data', dataHandler);
            abortSignal.addEventListener('abort', abortHandler);
            
            // Send command
            const commandToSend = command.endsWith('\r\n') ? command : command + '\r\n';
            connection.port.write(commandToSend, (writeError) => {
                if (writeError) {
                    cleanup();
                    reject(writeError);
                }
            });
        });
    }
    
    // Batch execution for efficiency
    async executeBatch(commands) {
        const results = new Map();
        const errors = new Map();
        
        // Group commands by modem for better efficiency
        const commandsByModem = new Map();
        commands.forEach(({ serial, command, timeout }) => {
            if (!commandsByModem.has(serial)) {
                commandsByModem.set(serial, []);
            }
            commandsByModem.get(serial).push({ command, timeout });
        });
        
        // Execute all modems concurrently, but commands per modem sequentially
        const promises = Array.from(commandsByModem.entries()).map(
            async ([serial, modemCommands]) => {
                for (const { command, timeout } of modemCommands) {
                    try {
                        const result = await this.executeCommand(serial, command, timeout);
                        results.set(`${serial}:${command}`, result);
                    } catch (error) {
                        errors.set(`${serial}:${command}`, error);
                    }
                }
            }
        );
        
        await Promise.allSettled(promises);
        
        return { results, errors };
    }
    
    updateAverageLatency(latency) {
        if (this.stats.averageLatency === 0) {
            this.stats.averageLatency = latency;
        } else {
            // Exponential moving average
            this.stats.averageLatency = (this.stats.averageLatency * 0.9) + (latency * 0.1);
        }
    }
    
    getStats() {
        return {
            ...this.stats,
            activeTasks: this.activeTasks.size,
            successRate: this.stats.completedRequests / 
                        (this.stats.completedRequests + this.stats.failedRequests),
            queueUtilization: (this.activeTasks.size / this.maxConcurrent) * 100
        };
    }
}

// Semaphore implementation for concurrency control
class Semaphore {
    constructor(count) {
        this.count = count;
        this.waiting = [];
    }
    
    async acquire() {
        if (this.count > 0) {
            this.count--;
            return;
        }
        
        return new Promise(resolve => {
            this.waiting.push(resolve);
        });
    }
    
    release() {
        this.count++;
        
        if (this.waiting.length > 0) {
            this.count--;
            const resolve = this.waiting.shift();
            resolve();
        }
    }
}
```

---

## 3. Error Handling & Retry Strategies

### Robust Error Recovery System
```javascript
// error-recovery-system.js
class SerialErrorRecovery {
    constructor() {
        this.errorCounts = new Map(); // Track errors per modem
        this.retryStrategies = new Map();
        this.circuitBreakers = new Map();
        
        this.setupRetryStrategies();
    }
    
    setupRetryStrategies() {
        // Different strategies for different error types
        this.retryStrategies.set('timeout', {
            maxRetries: 3,
            baseDelay: 1000,
            maxDelay: 10000,
            backoffMultiplier: 2,
            jitter: true
        });
        
        this.retryStrategies.set('device_error', {
            maxRetries: 5,
            baseDelay: 2000,
            maxDelay: 30000,
            backoffMultiplier: 1.5,
            jitter: true
        });
        
        this.retryStrategies.set('parse_error', {
            maxRetries: 2,
            baseDelay: 500,
            maxDelay: 2000,
            backoffMultiplier: 2,
            jitter: false
        });
    }
    
    async executeWithRetry(serial, command, operation) {
        const errorType = this.determineErrorType(command);
        const strategy = this.retryStrategies.get(errorType) || 
                        this.retryStrategies.get('timeout');
        
        let lastError;
        
        for (let attempt = 0; attempt <= strategy.maxRetries; attempt++) {
            try {
                // Check circuit breaker
                if (this.isCircuitOpen(serial)) {
                    throw new Error(`Circuit breaker open for ${serial}`);
                }
                
                const result = await operation();
                
                // Success - reset error count and close circuit
                this.resetErrorCount(serial);
                this.closeCircuit(serial);
                
                return result;
                
            } catch (error) {
                lastError = error;
                
                console.warn(`Attempt ${attempt + 1} failed for ${serial}:${command}`, error.message);
                
                // Track error
                this.incrementErrorCount(serial, error);
                
                // Don't retry on final attempt or non-retryable errors
                if (attempt === strategy.maxRetries || !this.isRetryableError(error)) {
                    break;
                }
                
                // Calculate delay with exponential backoff and jitter
                const delay = this.calculateDelay(attempt, strategy);
                await this.sleep(delay);
                
                // Check if we should open circuit breaker
                this.checkCircuitBreaker(serial);
            }
        }
        
        // All retries exhausted
        this.openCircuit(serial);
        throw new Error(`Command failed after ${strategy.maxRetries + 1} attempts: ${lastError.message}`);
    }
    
    calculateDelay(attempt, strategy) {
        let delay = strategy.baseDelay * Math.pow(strategy.backoffMultiplier, attempt);
        delay = Math.min(delay, strategy.maxDelay);
        
        if (strategy.jitter) {
            // Add ±25% jitter to prevent thundering herd
            const jitterRange = delay * 0.25;
            delay += (Math.random() - 0.5) * 2 * jitterRange;
        }
        
        return Math.max(delay, 100); // Minimum 100ms
    }
    
    incrementErrorCount(serial, error) {
        if (!this.errorCounts.has(serial)) {
            this.errorCounts.set(serial, {
                total: 0,
                recent: [],
                firstError: Date.now()
            });
        }
        
        const errors = this.errorCounts.get(serial);
        errors.total++;
        errors.recent.push({
            timestamp: Date.now(),
            type: error.constructor.name,
            message: error.message
        });
        
        // Keep only recent errors (last 5 minutes)
        const fiveMinutesAgo = Date.now() - 300000;
        errors.recent = errors.recent.filter(e => e.timestamp > fiveMinutesAgo);
    }
    
    checkCircuitBreaker(serial) {
        const errors = this.errorCounts.get(serial);
        if (!errors) return;
        
        // Open circuit if too many recent errors
        if (errors.recent.length >= 10) {
            this.openCircuit(serial);
        }
    }
    
    openCircuit(serial) {
        console.warn(`Opening circuit breaker for ${serial}`);
        this.circuitBreakers.set(serial, {
            state: 'open',
            openedAt: Date.now(),
            nextAttemptAt: Date.now() + 60000 // Try again in 1 minute
        });
    }
    
    closeCircuit(serial) {
        if (this.circuitBreakers.has(serial)) {
            console.log(`Closing circuit breaker for ${serial}`);
            this.circuitBreakers.delete(serial);
        }
    }
    
    isCircuitOpen(serial) {
        const circuit = this.circuitBreakers.get(serial);
        if (!circuit) return false;
        
        if (circuit.state === 'open' && Date.now() > circuit.nextAttemptAt) {
            // Try half-open state
            circuit.state = 'half-open';
            return false;
        }
        
        return circuit.state === 'open';
    }
    
    isRetryableError(error) {
        const nonRetryablePatterns = [
            /invalid command/i,
            /syntax error/i,
            /device not found/i,
            /permission denied/i
        ];
        
        return !nonRetryablePatterns.some(pattern => 
            pattern.test(error.message)
        );
    }
    
    determineErrorType(command) {
        if (command.includes('AT+CSQ')) return 'timeout';
        if (command.includes('AT+QCFG')) return 'device_error';
        return 'timeout';
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // Get error statistics
    getErrorStats() {
        const stats = {};
        
        for (const [serial, errors] of this.errorCounts) {
            stats[serial] = {
                totalErrors: errors.total,
                recentErrors: errors.recent.length,
                firstErrorAt: errors.firstError,
                circuitState: this.circuitBreakers.get(serial)?.state || 'closed'
            };
        }
        
        return stats;
    }
}
```

---

## 4. Resource Leak Prevention

### Comprehensive Resource Management
```javascript
// resource-manager.js
class ResourceManager {
    constructor() {
        this.resources = new Map();
        this.leakDetector = new LeakDetector();
        this.cleanupScheduled = false;
        
        this.startResourceMonitoring();
        this.setupGracefulShutdown();
    }
    
    registerResource(id, resource, type) {
        const resourceInfo = {
            id,
            resource,
            type,
            createdAt: Date.now(),
            lastUsed: Date.now(),
            useCount: 0
        };
        
        this.resources.set(id, resourceInfo);
        this.leakDetector.track(id, resource);
        
        // Schedule cleanup if not already scheduled
        if (!this.cleanupScheduled) {
            this.scheduleCleanup();
        }
        
        return resourceInfo;
    }
    
    useResource(id) {
        const resource = this.resources.get(id);
        if (resource) {
            resource.lastUsed = Date.now();
            resource.useCount++;
        }
        return resource?.resource;
    }
    
    releaseResource(id) {
        const resourceInfo = this.resources.get(id);
        if (!resourceInfo) return false;
        
        try {
            this.cleanupResource(resourceInfo);
            this.resources.delete(id);
            this.leakDetector.untrack(id);
            return true;
        } catch (error) {
            console.error(`Error releasing resource ${id}:`, error);
            return false;
        }
    }
    
    cleanupResource(resourceInfo) {
        const { resource, type } = resourceInfo;
        
        switch (type) {
            case 'serial-port':
                if (resource.isOpen) {
                    resource.close();
                }
                resource.removeAllListeners();
                break;
                
            case 'parser':
                resource.removeAllListeners();
                break;
                
            case 'timer':
                clearInterval(resource);
                clearTimeout(resource);
                break;
                
            case 'stream':
                if (!resource.destroyed) {
                    resource.destroy();
                }
                break;
                
            case 'websocket':
                if (resource.readyState === 1) { // OPEN
                    resource.close();
                }
                break;
                
            default:
                if (typeof resource.close === 'function') {
                    resource.close();
                } else if (typeof resource.destroy === 'function') {
                    resource.destroy();
                }
        }
    }
    
    scheduleCleanup() {
        this.cleanupScheduled = true;
        
        setTimeout(() => {
            this.performCleanup();
            this.cleanupScheduled = false;
        }, 30000); // Cleanup every 30 seconds
    }
    
    performCleanup() {
        const now = Date.now();
        const staleThreshold = 300000; // 5 minutes
        const staleCandidates = [];
        
        for (const [id, resourceInfo] of this.resources) {
            const age = now - resourceInfo.lastUsed;
            
            if (age > staleThreshold && resourceInfo.useCount === 0) {
                staleCandidates.push(id);
            }
        }
        
        if (staleCandidates.length > 0) {
            console.log(`Cleaning up ${staleCandidates.length} stale resources`);
            
            for (const id of staleCandidates) {
                this.releaseResource(id);
            }
        }
        
        // Check for memory leaks
        this.leakDetector.checkForLeaks();
        
        // Schedule next cleanup if we still have resources
        if (this.resources.size > 0) {
            this.scheduleCleanup();
        }
    }
    
    startResourceMonitoring() {
        setInterval(() => {
            const stats = this.getResourceStats();
            
            if (stats.totalResources > 100) {
                console.warn('High resource count detected:', stats);
            }
            
            // Force cleanup if resource count is very high
            if (stats.totalResources > 200) {
                console.error('Emergency resource cleanup triggered');
                this.performEmergencyCleanup();
            }
            
        }, 60000); // Every minute
    }
    
    performEmergencyCleanup() {
        const now = Date.now();
        const emergencyThreshold = 60000; // 1 minute
        
        for (const [id, resourceInfo] of this.resources) {
            const age = now - resourceInfo.lastUsed;
            
            if (age > emergencyThreshold) {
                console.warn(`Emergency cleanup of resource ${id} (age: ${age}ms)`);
                this.releaseResource(id);
            }
        }
        
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }
    }
    
    setupGracefulShutdown() {
        const gracefulShutdown = () => {
            console.log('Performing graceful shutdown...');
            
            // Release all resources
            for (const id of this.resources.keys()) {
                this.releaseResource(id);
            }
            
            console.log('All resources released');
            process.exit(0);
        };
        
        process.on('SIGTERM', gracefulShutdown);
        process.on('SIGINT', gracefulShutdown);
        process.on('SIGUSR2', gracefulShutdown); // For nodemon
    }
    
    getResourceStats() {
        const stats = {
            totalResources: this.resources.size,
            byType: {},
            oldestResource: null,
            averageAge: 0
        };
        
        let totalAge = 0;
        let oldestAge = 0;
        
        for (const [id, resourceInfo] of this.resources) {
            const type = resourceInfo.type;
            stats.byType[type] = (stats.byType[type] || 0) + 1;
            
            const age = Date.now() - resourceInfo.createdAt;
            totalAge += age;
            
            if (age > oldestAge) {
                oldestAge = age;
                stats.oldestResource = { id, age };
            }
        }
        
        if (this.resources.size > 0) {
            stats.averageAge = Math.round(totalAge / this.resources.size);
        }
        
        return stats;
    }
}

// Memory leak detector
class LeakDetector {
    constructor() {
        this.tracked = new WeakMap();
        this.references = new Map();
    }
    
    track(id, resource) {
        this.tracked.set(resource, id);
        this.references.set(id, {
            resource: new WeakRef(resource),
            createdAt: Date.now()
        });
    }
    
    untrack(id) {
        this.references.delete(id);
    }
    
    checkForLeaks() {
        const leaks = [];
        
        for (const [id, ref] of this.references) {
            if (ref.resource.deref() === undefined) {
                // Resource was garbage collected but not untracked
                leaks.push({
                    id,
                    age: Date.now() - ref.createdAt
                });
            }
        }
        
        if (leaks.length > 0) {
            console.warn(`Detected ${leaks.length} potential memory leaks:`, leaks);
            
            // Clean up leaked references
            for (const leak of leaks) {
                this.references.delete(leak.id);
            }
        }
    }
}
```

---

## 5. Performance Monitoring & Optimization

### Real-time Performance Tracking
```javascript
// performance-monitor.js
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            commandLatency: new LatencyTracker(),
            throughput: new ThroughputTracker(),
            errorRates: new ErrorRateTracker(),
            memory: new MemoryTracker(),
            cpu: new CPUTracker()
        };
        
        this.startMonitoring();
    }
    
    startMonitoring() {
        // Collect metrics every 10 seconds
        setInterval(() => {
            this.collectMetrics();
        }, 10000);
        
        // Generate performance report every 5 minutes
        setInterval(() => {
            this.generatePerformanceReport();
        }, 300000);
    }
    
    collectMetrics() {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage(this.lastCpuUsage);
        this.lastCpuUsage = process.cpuUsage();
        
        this.metrics.memory.record({
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external,
            rss: memUsage.rss
        });
        
        this.metrics.cpu.record({
            user: cpuUsage.user,
            system: cpuUsage.system
        });
    }
    
    recordCommandLatency(serial, command, latency) {
        this.metrics.commandLatency.record(serial, command, latency);
        this.metrics.throughput.recordOperation(serial);
    }
    
    recordError(serial, command, error) {
        this.metrics.errorRates.recordError(serial, command, error);
    }
    
    generatePerformanceReport() {
        const report = {
            timestamp: new Date().toISOString(),
            latency: this.metrics.commandLatency.getStats(),
            throughput: this.metrics.throughput.getStats(),
            errors: this.metrics.errorRates.getStats(),
            memory: this.metrics.memory.getStats(),
            cpu: this.metrics.cpu.getStats()
        };
        
        console.log('Performance Report:', JSON.stringify(report, null, 2));
        
        // Check for performance issues
        this.checkPerformanceAlerts(report);
        
        return report;
    }
    
    checkPerformanceAlerts(report) {
        const alerts = [];
        
        // High latency alert
        if (report.latency.average > 5000) {
            alerts.push({
                type: 'high_latency',
                value: report.latency.average,
                threshold: 5000
            });
        }
        
        // Low throughput alert
        if (report.throughput.operationsPerSecond < 10) {
            alerts.push({
                type: 'low_throughput',
                value: report.throughput.operationsPerSecond,
                threshold: 10
            });
        }
        
        // High error rate alert
        if (report.errors.errorRate > 0.1) {
            alerts.push({
                type: 'high_error_rate',
                value: report.errors.errorRate,
                threshold: 0.1
            });
        }
        
        // Memory usage alert
        if (report.memory.heapUsedMB > 512) {
            alerts.push({
                type: 'high_memory_usage',
                value: report.memory.heapUsedMB,
                threshold: 512
            });
        }
        
        if (alerts.length > 0) {
            console.warn('Performance alerts triggered:', alerts);
        }
    }
}

class LatencyTracker {
    constructor() {
        this.measurements = [];
        this.maxSamples = 1000;
    }
    
    record(serial, command, latency) {
        this.measurements.push({
            serial,
            command,
            latency,
            timestamp: Date.now()
        });
        
        // Keep only recent measurements
        if (this.measurements.length > this.maxSamples) {
            this.measurements.shift();
        }
    }
    
    getStats() {
        if (this.measurements.length === 0) {
            return { average: 0, min: 0, max: 0, p95: 0, p99: 0 };
        }
        
        const latencies = this.measurements.map(m => m.latency).sort((a, b) => a - b);
        
        return {
            average: latencies.reduce((a, b) => a + b, 0) / latencies.length,
            min: latencies[0],
            max: latencies[latencies.length - 1],
            p95: latencies[Math.floor(latencies.length * 0.95)],
            p99: latencies[Math.floor(latencies.length * 0.99)]
        };
    }
}
```

This Node.js Multi-Serial Production Guide provides comprehensive patterns for managing 30+ concurrent serial connections with optimal performance, memory efficiency, and robust error handling.
