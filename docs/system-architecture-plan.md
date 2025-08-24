# System Architecture Plan

## Executive Summary

This document outlines the architecture for a multi-modem LTE proxy system that manages multiple EC25-EUX LTE modems connected via USB, providing individualized proxy services for each modem with dynamic configuration and monitoring capabilities.

### Related Documentation
This architecture plan references and should be used together with the following technical documentation:
- `docs/3proxy_Documentation_Guide.md` - Complete 3proxy configuration and deployment guide
- `docs/EC25-EUX_AT_Commands_Reference.md` - Comprehensive AT command reference for EC25-EUX modems
- `docs/QMI_Complete_Documentation_Guide.md` - QMI protocol implementation guide for Ubuntu 24.04.3 LTS (native support)
- `docs/uncertain-info.md` - Areas requiring validation and testing before production deployment
- `docs/3proxy_Configuration_Examples.md` - Practical configuration examples
- `docs/3proxy_Security_Guide.md` - Security hardening procedures
- `docs/QMI_Port_Configuration_Guide.md` - QMI port management and configuration
- `docs/QMI_Scaling_Guide.md` - Multi-modem scaling considerations

## 1. Hardware and Network Infrastructure

### Physical Setup
- **Linux Server**: Deployed in LAN network (192.168.1.100)
- **LTE Modems**: Multiple EC25-EUX units connected via USB/USB hub
- **Network Topology**: Same LAN as Windows clients
- **WAN Connectivity**: Each modem maintains its own WAN IP address

### Network Requirements
- LAN connectivity between Linux server and Windows clients
- Individual WAN connections per modem
- Policy routing support for multiple default routes
- Persistent network interface naming

## 2. Proxy Infrastructure

### 3proxy Configuration
- **Platform**: 3proxy lightweight proxy server (see `docs/3proxy_Documentation_Guide.md`)
- **Installation**: Compiled from source using `make -f Makefile.Linux`
- **Directory Structure**: 
  - `/usr/local/3proxy/sbin/` - 3proxy executables
  - `/usr/local/etc/` - Configuration files
  - `/var/log/3proxy/` - Log files
- **Port Assignment**: Dynamic port allocation per modem (e.g., 3128, 3129, 3130...)
- **Client Access**: Windows clients connect using server IP + specific proxy port
- **Instance Management**: Individual 3proxy instances per modem using systemd templates

### Proxy Features
- **Multi-Protocol Support**: HTTP, HTTPS, SOCKS4/5
- **Authentication**: IP-based authentication (`auth iponly`)
- **Access Control**: Comprehensive ACL system for LAN restrictions
- **Traffic Management**: Bandwidth limiting and connection quotas
- **Logging**: Configurable log formats with rotation (30 days recommended)
- **Security**: Unprivileged user execution, restricted file permissions

### systemd Template Configuration
```bash
# /etc/systemd/system/3proxy@.service template for per-modem instances
[Unit]
Description=3proxy Proxy Server for Modem %i
After=network.target postgresql.service

[Service]
Type=forking
ExecStart=/usr/local/3proxy/sbin/3proxy /etc/3proxy-%i.cfg
ExecReload=/bin/kill -HUP $MAINPID
PIDFile=/var/run/3proxy-%i.pid
User=proxy
Group=proxy
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

## 3. Modem Management

### Hardware Interfaces (Reference: `docs/EC25-EUX_AT_Commands_Reference.md`, `docs/QMI_Complete_Documentation_Guide.md`)
- **AT Commands Interface**: `/dev/ttyUSBx` for modem control
  - Commands: `ATI`, `AT+CSQ`, `AT+COPS`, `AT+CREG`, `AT+CFUN`
  - Error handling: `AT+CMEE=2` for verbose error reporting
  - Status monitoring: Signal quality, network registration, operator info
- **QMI Interface**: `/dev/cdc-wdm*` for network management
  - Services: DMS (Device Management), WDS (Wireless Data), NAS (Network Access), UIM (SIM)
  - Tools: `qmicli`, ModemManager integration
  - Data bearer technology detection and packet statistics
- **Device Detection**: Automatic discovery via udev rules based on serial numbers
- **Stable Addressing**: Symlinks `/dev/modems/<serial>` for consistent access

### EC25-EUX Specific Features
- **LTE Cat 4**: Up to 150 Mbps DL / 50 Mbps UL
- **Multi-mode Support**: LTE, WCDMA, GSM with automatic fallback
- **Voice Support**: VoLTE and Circuit Switched Fallback (CSFB)
- **SMS Capabilities**: Full SMS support including concatenated messages
- **USB Interfaces**: Multiple endpoints (AT, QMI, DIAG, audio)

### Device Management
- **Identification**: Serial number-based (not IMEI dependent) using `AT+CGSN`
- **Hot-plug Support**: 5-second scanning intervals of `/dev/serial/by-id/`
- **Initialization Sequence**:
  ```bash
  AT                    # Test communication
  AT+CFUN=1            # Enable full functionality
  AT+CPIN="1234"       # Enter PIN if required
  AT+CREG=2            # Enable network registration URC
  AT+COPS=0            # Automatic operator selection
  ```
- **Mutex/semaphore protection** for serial port access
- **Dynamic proxy port assignment** upon device detection

### QMI Protocol Integration
- **Package Requirements**: libqmi-utils, libqmi-glib0, modemmanager
- **Device Detection**: `qmicli -L` for listing QMI devices
- **Status Monitoring**: Network registration, signal strength, data bearer info
- **ModemManager Integration**: High-level modem management daemon

## 4. Backend Services

### Technology Stack
- **Platform**: Node.js with Express or Next.js API routes
- **Database**: PostgreSQL for persistent configuration and logging
- **Architecture**: Event-driven with real-time updates

### Core API Endpoints
- `GET /api/modems` - Retrieve modem status (AT/QMI, WAN IP, signal strength)
- `POST /api/modems/:id/command` - Execute AT/QMI commands on specific modem

### Health Monitoring
- **Interval**: 30-60 second status checks using AT+CSQ
- **Failure Handling**: Restart modems after 3 failed attempts with exponential backoff
- **Watchdog Service**: Continuous proxy availability monitoring

### Data Management
- Dynamic mapping: modem ↔ proxy port ↔ API
- Centralized logging of all commands and responses
- PostgreSQL as single source of truth

## 5. Database Schema

### Core Tables

#### `modems` Table
- `serial` (PRIMARY KEY) - Unique modem identifier
- `path` - Stable device paths (AT/QMI interfaces)
- `interface` - Assigned network interface (wwanX)
- `proxy_port` - Assigned 3proxy port
- `status` - Current state (online/offline/error)
- `last_seen` - Last activity timestamp

#### `modem_logs` Table
- Complete AT/QMI command and response logging
- Integration with centralized logging system
- Historical connection and error tracking

### Database Operations
- `ON CONFLICT (serial) DO UPDATE` for seamless device management
- Automatic status updates on device connect/disconnect
- Event triggers for real-time system updates

## 6. Frontend Interface

### Technology Stack
- **Framework**: React/Next.js web application
- **Target Platform**: Windows browser clients
- **Communication**: WebSocket connections for real-time updates

### User Interface Features
- Modem list view with status, WAN IP, operator, signal strength
- Interactive controls for modem restart and AT/QMI command execution
- Real-time status updates and log streaming
- Offline/error state handling

### Real-time Features
- WebSocket integration for live status updates
- Real-time log streaming
- Immediate notification of modem state changes

## 7. Security Framework

### Authentication and Authorization
- **JWT Tokens**: Secure API access
- **HTTPS**: Encrypted communication
- **CORS Restrictions**: Limited to LAN/specific IP addresses

### Audit and Monitoring
- Comprehensive user action logging
- Security event monitoring
- Access pattern analysis

## 8. Advanced Features

### Automatic Device Management
- **Detection Method**: udev rules + daemon service (Node.js worker/systemd)
- **Identification**: Serial number-based (stable, unique identifier)
- **Hot-plug Support**: 5-second interval scanning of `/dev/serial/by-id/`
- **Auto-registration**: Automatic database entry creation

### Event-Driven Architecture
- **Database Events**: PostgreSQL LISTEN/NOTIFY for `modem_change`
- **Triggers**: `AFTER INSERT OR UPDATE ON modems` → `NOTIFY modem_change`
- **Worker Response**: Dynamic port allocation and proxy instance management
- **Zero-downtime**: Individual proxy instance management without affecting others

### Boot Sequence Management
- **Staggered Startup**: Delayed worker initialization (30-60s)
- **Batch Processing**: Groups of 5 modems with 5-second intervals
- **USB Settlement**: Wait for device enumeration stability
- **Sequential Proxy Start**: 2-3 second delays between instances
- **Health Check Delay**: 2-3 minute grace period for network connection

### Process Management
- **System Integration**: systemd templates or PM2 for 3proxy instances
- **Individual Management**: `systemctl reload 3proxy@<serial>`
- **Dependency Management**: Proper service startup ordering

## 9. Event Processing and Reliability

### Batching and Debounce
- **Event Aggregation**: 2-second window for collecting multiple events
- **Anti-flapping**: Single reload operation for clustered changes
- **Queue Management**: Controlled processing of event bursts

### Error Scenarios and Recovery

#### Hot-Plug Overload
- **Prevention**: Rate-limited event processing with batching
- **Detection**: CPU spike monitoring and event queue alerts
- **Recovery**: Retry failed modems with rollback capabilities

#### Proxy Instance Crashes
- **Prevention**: Per-modem isolation with connection limits
- **Detection**: 30-second health checks with 60-second alert threshold
- **Recovery**: Staged restart of affected instances only

#### Network Interface Collision
- **Prevention**: Persistent interface names with udev symlinks
- **Detection**: Correlation checks between DB and system state
- **Recovery**: Dynamic interface reassignment and routing table rebuild

## 10. System Tuning and Optimization

### Network Stack Optimization
- **Interface Management**: Support for 30+ simultaneous network interfaces
- **Routing Tables**: Individual routing entries per modem
- **Buffer Tuning**: Enhanced network buffers for high connection counts
- **File Descriptor Limits**: Increased system limits for Node.js operations

### Container Orchestration (Optional)
- **Isolation**: Individual containers per modem + proxy
- **Scaling**: Simplified management and resource isolation
- **Technology**: Docker/Podman with shared volume for device access

## 11. Backup and Recovery Strategies

### Configuration Backup
- **Proxy Configuration**: File-based backup in case of database failure
- **Manual Override**: CLI-based manual configuration capabilities
- **Export/Import**: Modem configuration backup and restore functionality

### Disaster Recovery
- **Database Recovery**: Automated backup and restore procedures
- **System State**: Complete system configuration snapshots
- **Manual Intervention**: Emergency manual override capabilities

## Implementation Timeline

### Phase 1: Core Infrastructure
1. Database schema implementation
2. Basic modem detection and registration
3. 3proxy instance management
4. Basic API endpoints

### Phase 2: Advanced Features
1. Event-driven architecture
2. Hot-plug support
3. Health monitoring and recovery
4. Frontend development

### Phase 3: Optimization and Reliability
1. Boot sequence optimization
2. Error scenario handling
3. Performance tuning
4. Backup and recovery implementation

## Potential Issues / Risks for Later Verification

### Critical Boot Sequence Risks (Reference: `docs/uncertain-info.md`)
1. **USB Enumeration Chaos**: During power outage recovery, 30 modems connecting simultaneously may cause:
   - System load average 15-20+ 
   - Incorrect device mapping and port assignments
   - udev timeout during symlink creation
   - QMI interface availability delays (15-20 seconds needed)
2. **Database Overload**: PostgreSQL overwhelmed by 30 simultaneous INSERT operations and trigger events
3. **Worker Queue Explosion**: Event-driven worker receiving 30 events within seconds
4. **3proxy Instance Collision**: Attempting to start 30 proxy instances simultaneously

### Network Stack and Resource Limitations
5. **Linux Network Stack Tuning Required**:
   - 30+ simultaneous network interfaces (wwanX)
   - Individual routing tables per modem
   - Increased network buffers needed: `net.core.netdev_max_backlog = 5000`
6. **File Descriptor Exhaustion**: Node.js managing 30 serial ports + WebSocket connections
7. **Memory and CPU Constraints**: System resource limits for concurrent serial communication

### QMI and ModemManager Integration Issues (Reference: `docs/QMI_Complete_Documentation_Guide.md`)
8. **QMI Interface Timing**: QMI devices (`/dev/cdc-wdm*`) not immediately available after USB enumeration
9. **ModemManager Conflicts**: Potential interference with direct QMI operations
10. **USB Device Path Stability**: Need for persistent device naming based on serial numbers

### 3proxy Configuration Risks (Reference: `docs/3proxy_Documentation_Guide.md`)
11. **3proxy Security Configuration**:
    - Proper unprivileged user execution (`proxy:proxy`)
    - Configuration file permissions (600)
    - ACL rules for LAN-only access
    - Log file rotation and storage management
12. **Port Collision and Management**: Race conditions during dynamic port allocation
13. **Instance Monitoring**: Health checks for individual 3proxy instances

### AT Command and Modem Communication Issues (Reference: `docs/EC25-EUX_AT_Commands_Reference.md`)
14. **Serial Port Mutex/Concurrency**: Multiple processes accessing same AT interface
15. **Modem Initialization Timing**: Proper AT command sequence during startup
16. **URC (Unsolicited Result Code) Handling**: Processing network registration and status events
17. **Error Handling**: CME/CMS error processing and recovery

### Areas Requiring Validation (From `docs/uncertain-info.md`)
18. **systemd Service Configuration**: Real QMI-specific systemd service files need development
19. **udev Rules Testing**: EC25-EUX device detection rules require hardware validation
20. **Automation Script Development**: All shell scripts need real-world testing
21. **Performance Monitoring**: Actual multi-modem scaling benchmarks needed
22. **Hardware Requirements**: CPU, memory, and USB hub capacity validation

### Operational and Recovery Risks
23. **Event Storm Handling**: System behavior under rapid connect/disconnect events
24. **Graceful Degradation**: Partial system failure scenarios
25. **Database Connection Loss**: PostgreSQL availability and recovery procedures
26. **Hot-plug Overload**: Rate limiting for rapid modem connect/disconnect events
27. **Backup and Recovery**: Manual override capabilities when automation fails

### Security and Monitoring Gaps
28. **Comprehensive Logging Strategy**: AT/QMI command logging, rotation, and storage
29. **Access Control**: User authentication and role-based permissions
30. **Audit Trail**: Complete system action logging and monitoring
31. **Security Hardening**: Following 3proxy security checklist and best practices

### Integration Dependencies
32. **Package Compatibility**: Ubuntu 24.04.3 LTS native EC25-EUX support (VALIDATED - no custom drivers needed)
33. **systemd Dependencies**: Service startup ordering and dependency management
34. **Network Interface Naming**: Persistent interface configuration
35. **Container Orchestration**: Docker/Podman integration for scaling (optional feature)

### Questions Requiring Hardware Testing
1. **Maximum Modem Count**: Practical limit before performance degradation
2. **USB Hub Configuration**: Power delivery and enumeration capacity for 30 modems
3. **Thermal Management**: Heat dissipation in high-density modem deployment
4. **Network Performance**: Actual throughput and latency with multiple active connections
5. **Boot Sequence Timing**: Real-world startup time and stabilization period
6. **Failure Recovery**: System behavior during individual modem failures
7. **Power Outage Recovery**: Complete system restoration procedures and timing

### Documentation and Testing Status
- ✅ **Ubuntu 24.04.3 LTS Native EC25-EUX Support**: Validated - No custom drivers needed
- ✅ **QMI File System Paths**: Confirmed
- ✅ **Kernel Parameter Analysis**: Completed
- ⏳ **systemd Service Configuration**: Requires development
- ⏳ **udev Rules**: Requires hardware testing
- ⏳ **Automation Scripts**: Requires real environment validation
- ⏳ **Multi-modem Scaling**: Requires performance benchmarking
