# Linux Network Stack Multi-Interface Guide

> **⚠️ GENERATED DOCUMENTATION**: This document was created by Claude based on Linux networking expertise and system requirements analysis, not from provided source materials.

## Overview

This guide covers Linux network stack configuration and optimization for managing **30+ concurrent network interfaces** from EC25-EUX modems, including policy routing, interface management, kernel tuning, and performance optimization.

**Context**: Multiple wwanX interfaces, individual routing tables per modem, policy-based routing, network namespace isolation, high-density networking requirements.

---

## 1. Network Interface Architecture

### Multi-Interface Design Pattern
```
┌─────────────────────────────────────────────────────────────┐
│                    Linux Network Stack                     │
├─────────────────────────────────────────────────────────────┤
│  Interface Layer                                           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐     ┌─────────┐      │
│  │ wwan0   │ │ wwan1   │ │ wwan2   │ ... │ wwan29  │      │
│  │ Modem 1 │ │ Modem 2 │ │ Modem 3 │     │ Modem 30│      │
│  └─────────┘ └─────────┘ └─────────┘     └─────────┘      │
├─────────────────────────────────────────────────────────────┤
│  Routing Layer (Policy-based)                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐     ┌─────────┐      │
│  │ Table 1 │ │ Table 2 │ │ Table 3 │ ... │ Table 30│      │
│  │ wwan0   │ │ wwan1   │ │ wwan2   │     │ wwan29  │      │
│  └─────────┘ └─────────┘ └─────────┘     └─────────┘      │
├─────────────────────────────────────────────────────────────┤
│  3proxy Layer                                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐     ┌─────────┐      │
│  │Port 3128│ │Port 3129│ │Port 3130│ ... │Port 3157│      │
│  │→ wwan0  │ │→ wwan1  │ │→ wwan2  │     │→ wwan29 │      │
│  └─────────┘ └─────────┘ └─────────┘     └─────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Interface Naming Strategy
```bash
# Predictable interface naming for modems
# Pattern: wwan{index} where index = modem sequence

# udev rule for consistent naming
cat > /etc/udev/rules.d/99-modem-interfaces.rules << 'EOF'
# EC25-EUX QMI interface naming
SUBSYSTEM=="net", ACTION=="add", \
ATTRS{idVendor}=="2c7c", ATTRS{idProduct}=="0125", \
KERNEL=="wwan*", \
PROGRAM="/usr/local/bin/assign-modem-interface.sh %k", \
NAME="wwan%c"
EOF

# Script to assign consistent interface numbers
cat > /usr/local/bin/assign-modem-interface.sh << 'EOF'
#!/bin/bash
KERNEL_NAME=$1

# Extract serial number from device path
SERIAL=$(udevadm info -q property -p /sys/class/net/$KERNEL_NAME | grep ID_SERIAL_SHORT | cut -d= -f2)

# Assign interface number based on database sequence (truly dynamic)
if [ -n "$SERIAL" ]; then
    # Check if modem already has assigned interface number
    EXISTING_NUM=$(psql -t -h localhost -U modems_user -d modems_db \
        -c "SELECT interface_id FROM modems WHERE serial='$SERIAL'" 2>/dev/null | tr -d ' ')
    
    if [ -n "$EXISTING_NUM" ] && [ "$EXISTING_NUM" != "" ]; then
        echo $EXISTING_NUM
    else
        # Assign next available interface number
        NEXT_NUM=$(psql -t -h localhost -U modems_user -d modems_db \
            -c "SELECT COALESCE(MAX(interface_id), -1) + 1 FROM modems" 2>/dev/null | tr -d ' ')
        echo ${NEXT_NUM:-0}
    fi
else
    echo 0
fi
EOF

chmod +x /usr/local/bin/assign-modem-interface.sh
```

---

## 2. Policy Routing Implementation

### Routing Table Structure
```bash
# Create dedicated routing tables for modems (dynamic allocation)
# Tables 100-999 reserved for modems (900 possible tables)

cat > /etc/iproute2/rt_tables.d/modems.conf << 'EOF'
# Dynamic modem routing tables (100-999 range)
# Tables created on-demand by modem management system
# Format: {100+interface_id} modem{interface_id}
# 
# Example entries (created automatically):
# 100 modem0
# 101 modem1
# 102 modem2
# ... up to 999 modem899
#
# Note: Tables are created dynamically via:
# echo "{table_id} modem{interface_id}" >> /etc/iproute2/rt_tables
EOF

# Apply routing table configuration
systemctl restart systemd-networkd
```

### Dynamic Routing Configuration
```bash
#!/bin/bash
# configure-modem-routing.sh - Dynamic routing setup per modem

setup_modem_routing() {
    local MODEM_ID=$1
    local INTERFACE=$2
    local GATEWAY=$3
    local LOCAL_IP=$4
    local TABLE_ID=$((100 + MODEM_ID))
    local TABLE_NAME="modem${MODEM_ID}"
    
    echo "Configuring routing for modem ${MODEM_ID} (${INTERFACE})"
    
    # 1. Create interface-specific routing table
    ip route flush table ${TABLE_NAME} 2>/dev/null || true
    
    # 2. Add local network route
    ip route add ${LOCAL_IP}/32 dev ${INTERFACE} scope link table ${TABLE_NAME}
    
    # 3. Add default route through modem gateway
    ip route add default via ${GATEWAY} dev ${INTERFACE} table ${TABLE_NAME}
    
    # 4. Add policy rule to use this table for traffic from this IP
    ip rule del from ${LOCAL_IP} table ${TABLE_NAME} 2>/dev/null || true
    ip rule add from ${LOCAL_IP} table ${TABLE_NAME} priority $((1000 + MODEM_ID))
    
    # 5. Add policy rule for traffic TO this IP (return path)
    ip rule del to ${LOCAL_IP} table ${TABLE_NAME} 2>/dev/null || true
    ip rule add to ${LOCAL_IP} table ${TABLE_NAME} priority $((2000 + MODEM_ID))
    
    # 6. Add rule for 3proxy to use specific interface
    local PROXY_PORT=$((3128 + MODEM_ID))
    ip rule del sport ${PROXY_PORT} table ${TABLE_NAME} 2>/dev/null || true
    ip rule add sport ${PROXY_PORT} table ${TABLE_NAME} priority $((3000 + MODEM_ID))
    
    # 7. Configure interface parameters
    echo 1 > /proc/sys/net/ipv4/conf/${INTERFACE}/rp_filter
    echo 1 > /proc/sys/net/ipv4/conf/${INTERFACE}/arp_filter
    echo 0 > /proc/sys/net/ipv4/conf/${INTERFACE}/send_redirects
    echo 0 > /proc/sys/net/ipv4/conf/${INTERFACE}/accept_redirects
    
    echo "Routing configured for modem ${MODEM_ID}: ${LOCAL_IP} via ${GATEWAY} on ${INTERFACE}"
}

# Load balancing configuration (optional)
setup_load_balancing() {
    local ACTIVE_MODEMS=("$@")
    
    echo "Setting up load balancing for ${#ACTIVE_MODEMS[@]} modems"
    
    # Create weighted multipath route
    local MULTIPATH_ROUTE="default"
    for modem_id in "${ACTIVE_MODEMS[@]}"; do
        local interface="wwan${modem_id}"
        local table_name="modem${modem_id}"
        
        # Get gateway from modem's routing table
        local gateway=$(ip route show table ${table_name} | grep default | awk '{print $3}')
        
        if [ -n "$gateway" ]; then
            MULTIPATH_ROUTE="${MULTIPATH_ROUTE} nexthop via ${gateway} dev ${interface} weight 1"
        fi
    done
    
    # Apply multipath route to main table (for load balancing)
    ip route del default table main 2>/dev/null || true
    ip route add ${MULTIPATH_ROUTE} table main
    
    echo "Load balancing configured for modems: ${ACTIVE_MODEMS[*]}"
}

# Failover configuration
setup_failover() {
    local PRIMARY_MODEM=$1
    local BACKUP_MODEMS=("${@:2}")
    
    echo "Setting up failover: primary=${PRIMARY_MODEM}, backup=[${BACKUP_MODEMS[*]}]"
    
    # Create failover monitoring script
    cat > /usr/local/bin/modem-failover-monitor.sh << 'EOF'
#!/bin/bash
PRIMARY_MODEM=$1
BACKUP_MODEMS=("${@:2}")

check_modem_connectivity() {
    local modem_id=$1
    local interface="wwan${modem_id}"
    local table_name="modem${modem_id}"
    
    # Get gateway from routing table
    local gateway=$(ip route show table ${table_name} | grep default | awk '{print $3}')
    
    if [ -n "$gateway" ]; then
        # Test connectivity via this interface
        ping -c 1 -W 2 -I ${interface} 8.8.8.8 >/dev/null 2>&1
        return $?
    fi
    
    return 1
}

# Main monitoring loop
while true; do
    if ! check_modem_connectivity ${PRIMARY_MODEM}; then
        echo "Primary modem ${PRIMARY_MODEM} failed, switching to backup"
        
        # Find working backup
        for backup in "${BACKUP_MODEMS[@]}"; do
            if check_modem_connectivity ${backup}; then
                echo "Switching to backup modem ${backup}"
                
                # Update main routing table
                local backup_gateway=$(ip route show table modem${backup} | grep default | awk '{print $3}')
                local backup_interface="wwan${backup}"
                
                ip route del default table main 2>/dev/null || true
                ip route add default via ${backup_gateway} dev ${backup_interface} table main
                
                break
            fi
        done
    fi
    
    sleep 30  # Check every 30 seconds
done
EOF
    
    chmod +x /usr/local/bin/modem-failover-monitor.sh
    
    # Start failover monitor as systemd service
    cat > /etc/systemd/system/modem-failover.service << 'EOF'
[Unit]
Description=Modem Failover Monitor
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/modem-failover-monitor.sh PRIMARY_MODEM BACKUP_MODEMS
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
    
    # Replace placeholders
    sed -i "s/PRIMARY_MODEM/${PRIMARY_MODEM}/" /etc/systemd/system/modem-failover.service
    sed -i "s/BACKUP_MODEMS/${BACKUP_MODEMS[*]}/" /etc/systemd/system/modem-failover.service
    
    systemctl daemon-reload
    systemctl enable modem-failover.service
}
```

---

## 3. Kernel Network Stack Tuning

### System-wide Network Parameters
```bash
# /etc/sysctl.d/99-modem-network-optimization.conf
# Network stack optimization for 30+ interfaces

# Core networking
net.core.rmem_default = 262144
net.core.rmem_max = 16777216
net.core.wmem_default = 262144  
net.core.wmem_max = 16777216
net.core.netdev_max_backlog = 5000
net.core.netdev_budget = 600
net.core.dev_weight = 64

# TCP optimization
net.ipv4.tcp_rmem = 4096 65536 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
net.ipv4.tcp_mem = 786432 1048576 26777216
net.ipv4.tcp_congestion_control = bbr
net.ipv4.tcp_slow_start_after_idle = 0
net.ipv4.tcp_mtu_probing = 1

# Connection tracking for multiple interfaces
net.netfilter.nf_conntrack_max = 262144
net.netfilter.nf_conntrack_buckets = 65536
net.netfilter.nf_conntrack_tcp_timeout_established = 7200

# Routing and forwarding
net.ipv4.ip_forward = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.conf.all.log_martians = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.all.accept_source_route = 0

# ARP optimization for multiple interfaces
net.ipv4.neigh.default.gc_thresh1 = 1024
net.ipv4.neigh.default.gc_thresh2 = 4096
net.ipv4.neigh.default.gc_thresh3 = 8192
net.ipv4.neigh.default.base_reachable_time_ms = 30000

# File system limits for network operations
fs.file-max = 2097152
fs.nr_open = 2097152

# Process limits
kernel.pid_max = 4194304
kernel.threads-max = 1048576

# Apply immediately
sysctl -p /etc/sysctl.d/99-modem-network-optimization.conf
```

### Per-Interface Optimization
```bash
#!/bin/bash
# optimize-interface.sh - Per-interface optimization

optimize_interface() {
    local INTERFACE=$1
    local MODEM_ID=$2
    
    echo "Optimizing interface ${INTERFACE} for modem ${MODEM_ID}"
    
    # Interface-specific parameters
    echo 1 > /proc/sys/net/ipv4/conf/${INTERFACE}/rp_filter
    echo 1 > /proc/sys/net/ipv4/conf/${INTERFACE}/arp_filter
    echo 0 > /proc/sys/net/ipv4/conf/${INTERFACE}/send_redirects
    echo 0 > /proc/sys/net/ipv4/conf/${INTERFACE}/accept_redirects
    echo 0 > /proc/sys/net/ipv4/conf/${INTERFACE}/accept_source_route
    echo 1 > /proc/sys/net/ipv4/conf/${INTERFACE}/arp_announce
    echo 2 > /proc/sys/net/ipv4/conf/${INTERFACE}/arp_ignore
    
    # Set interface queue length (for high throughput)
    ip link set ${INTERFACE} txqueuelen 2000
    
    # Enable TCP window scaling
    echo 1 > /proc/sys/net/ipv4/tcp_window_scaling
    
    # Interface-specific routing optimization
    echo 0 > /proc/sys/net/ipv4/conf/${INTERFACE}/disable_policy
    
    # MTU optimization for mobile connections
    ip link set ${INTERFACE} mtu 1500
    
    echo "Interface ${INTERFACE} optimization complete"
}

# Apply to all modem interfaces
for i in $(seq 0 29); do
    INTERFACE="wwan${i}"
    
    if ip link show ${INTERFACE} >/dev/null 2>&1; then
        optimize_interface ${INTERFACE} ${i}
    fi
done
```

---

## 4. Network Namespace Isolation (Advanced)

### Namespace Management for Modems
```bash
#!/bin/bash
# namespace-manager.sh - Network namespace isolation

create_modem_namespace() {
    local MODEM_ID=$1
    local INTERFACE=$2
    local NAMESPACE="modem${MODEM_ID}"
    
    echo "Creating network namespace for modem ${MODEM_ID}"
    
    # Create namespace
    ip netns add ${NAMESPACE}
    
    # Move interface to namespace
    ip link set ${INTERFACE} netns ${NAMESPACE}
    
    # Configure interface in namespace
    ip netns exec ${NAMESPACE} ip link set lo up
    ip netns exec ${NAMESPACE} ip link set ${INTERFACE} up
    
    # Get IP configuration from QMI
    local IP_INFO=$(qmicli -d /dev/cdc-wdm${MODEM_ID} --wds-get-current-settings)
    local IP_ADDR=$(echo "$IP_INFO" | grep "IPv4 address" | awk '{print $3}')
    local GATEWAY=$(echo "$IP_INFO" | grep "IPv4 gateway" | awk '{print $3}')
    local NETMASK=$(echo "$IP_INFO" | grep "IPv4 subnet mask" | awk '{print $4}')
    
    if [ -n "$IP_ADDR" ] && [ -n "$GATEWAY" ]; then
        # Configure IP in namespace
        ip netns exec ${NAMESPACE} ip addr add ${IP_ADDR}/${NETMASK} dev ${INTERFACE}
        ip netns exec ${NAMESPACE} ip route add default via ${GATEWAY} dev ${INTERFACE}
        
        echo "Namespace ${NAMESPACE} configured: ${IP_ADDR} via ${GATEWAY}"
    else
        echo "Failed to get IP configuration for modem ${MODEM_ID}"
        return 1
    fi
    
    # Create 3proxy configuration for this namespace
    create_namespace_proxy_config ${MODEM_ID} ${NAMESPACE}
}

create_namespace_proxy_config() {
    local MODEM_ID=$1
    local NAMESPACE=$2
    local PROXY_PORT=$((3128 + MODEM_ID))
    
    cat > /etc/3proxy/namespace-${NAMESPACE}.cfg << EOF
# 3proxy configuration for namespace ${NAMESPACE}
daemon
pidfile /var/run/3proxy-${NAMESPACE}.pid
log /var/log/3proxy/3proxy-${NAMESPACE}.log D
rotate 30

# Network configuration (namespace-aware)
internal 127.0.0.1
external 0.0.0.0

# Security
auth iponly
allow * 192.168.1.0/24 * * *
deny *

# HTTP proxy
proxy -p${PROXY_PORT}
EOF

    # Create systemd service for namespace proxy
    cat > /etc/systemd/system/3proxy-${NAMESPACE}.service << EOF
[Unit]
Description=3proxy for namespace ${NAMESPACE}
After=network.target
BindTo=netns-${NAMESPACE}.service

[Service]
Type=forking
ExecStartPre=/usr/bin/ip netns exec ${NAMESPACE} /bin/true
ExecStart=/usr/bin/ip netns exec ${NAMESPACE} /usr/local/3proxy/sbin/3proxy /etc/3proxy/namespace-${NAMESPACE}.cfg
ExecReload=/bin/kill -HUP \$MAINPID
PIDFile=/var/run/3proxy-${NAMESPACE}.pid
User=proxy
Group=proxy
Restart=on-failure
NetworkNamespacePath=/var/run/netns/${NAMESPACE}

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable 3proxy-${NAMESPACE}.service
}

# Namespace monitoring and health checks
monitor_namespace_connectivity() {
    local NAMESPACE=$1
    
    # Test connectivity from within namespace
    ip netns exec ${NAMESPACE} ping -c 1 -W 2 8.8.8.8 >/dev/null 2>&1
    return $?
}

# Cleanup namespace
destroy_modem_namespace() {
    local MODEM_ID=$1
    local NAMESPACE="modem${MODEM_ID}"
    
    echo "Destroying namespace ${NAMESPACE}"
    
    # Stop services
    systemctl stop 3proxy-${NAMESPACE}.service 2>/dev/null || true
    systemctl disable 3proxy-${NAMESPACE}.service 2>/dev/null || true
    
    # Remove systemd service file
    rm -f /etc/systemd/system/3proxy-${NAMESPACE}.service
    rm -f /etc/3proxy/namespace-${NAMESPACE}.cfg
    
    # Delete namespace (automatically moves interfaces back)
    ip netns del ${NAMESPACE} 2>/dev/null || true
    
    systemctl daemon-reload
    
    echo "Namespace ${NAMESPACE} destroyed"
}
```

---

## 5. Performance Monitoring & Troubleshooting

### Network Performance Monitoring
```bash
#!/bin/bash
# network-monitor.sh - Comprehensive network monitoring

monitor_network_performance() {
    echo "=== Network Performance Monitor ==="
    echo "Timestamp: $(date)"
    echo
    
    # 1. Interface statistics
    echo "=== Interface Statistics ==="
    for i in $(seq 0 29); do
        INTERFACE="wwan${i}"
        
        if ip link show ${INTERFACE} >/dev/null 2>&1; then
            echo "Interface: ${INTERFACE}"
            
            # Get interface statistics
            local STATS=$(cat /proc/net/dev | grep ${INTERFACE})
            if [ -n "$STATS" ]; then
                local RX_BYTES=$(echo $STATS | awk '{print $2}')
                local TX_BYTES=$(echo $STATS | awk '{print $10}')
                local RX_PACKETS=$(echo $STATS | awk '{print $3}')
                local TX_PACKETS=$(echo $STATS | awk '{print $11}')
                local RX_ERRORS=$(echo $STATS | awk '{print $4}')
                local TX_ERRORS=$(echo $STATS | awk '{print $12}')
                
                echo "  RX: ${RX_BYTES} bytes, ${RX_PACKETS} packets, ${RX_ERRORS} errors"
                echo "  TX: ${TX_BYTES} bytes, ${TX_PACKETS} packets, ${TX_ERRORS} errors"
            fi
            
            # Check link status
            local CARRIER=$(cat /sys/class/net/${INTERFACE}/carrier 2>/dev/null || echo "0")
            local OPERSTATE=$(cat /sys/class/net/${INTERFACE}/operstate 2>/dev/null || echo "unknown")
            echo "  Link: carrier=${CARRIER}, operstate=${OPERSTATE}"
            
            # Check IP configuration
            local IP=$(ip addr show ${INTERFACE} | grep "inet " | awk '{print $2}' | head -1)
            echo "  IP: ${IP:-"not configured"}"
            echo
        fi
    done
    
    # 2. Routing table statistics
    echo "=== Routing Statistics ==="
    echo "Main routing table entries: $(ip route show table main | wc -l)"
    
    for i in $(seq 0 29); do
        local TABLE_NAME="modem${i}"
        local ROUTES=$(ip route show table ${TABLE_NAME} 2>/dev/null | wc -l)
        
        if [ $ROUTES -gt 0 ]; then
            echo "Table ${TABLE_NAME}: ${ROUTES} routes"
        fi
    done
    echo
    
    # 3. Connection tracking
    echo "=== Connection Tracking ==="
    local CONNTRACK_COUNT=$(cat /proc/sys/net/netfilter/nf_conntrack_count 2>/dev/null || echo "0")
    local CONNTRACK_MAX=$(cat /proc/sys/net/netfilter/nf_conntrack_max 2>/dev/null || echo "0")
    echo "Active connections: ${CONNTRACK_COUNT}/${CONNTRACK_MAX}"
    echo
    
    # 4. Network buffer usage
    echo "=== Network Buffer Usage ==="
    echo "Receive buffer pressure: $(cat /proc/net/core_stats | awk '/rmem_alloc/ {print $2}')"
    echo "Send buffer pressure: $(cat /proc/net/core_stats | awk '/wmem_alloc/ {print $2}')"
    echo
    
    # 5. Interface queue statistics
    echo "=== Queue Statistics ==="
    for i in $(seq 0 29); do
        INTERFACE="wwan${i}"
        
        if [ -d "/sys/class/net/${INTERFACE}/queues" ]; then
            local QUEUE_COUNT=$(ls /sys/class/net/${INTERFACE}/queues/tx-* 2>/dev/null | wc -l)
            echo "${INTERFACE}: ${QUEUE_COUNT} TX queues"
        fi
    done
    echo
}

# Real-time bandwidth monitoring
monitor_bandwidth() {
    local INTERFACE=$1
    local DURATION=${2:-10}
    
    echo "Monitoring bandwidth for ${INTERFACE} for ${DURATION} seconds..."
    
    # Get initial values
    local INITIAL_RX=$(cat /sys/class/net/${INTERFACE}/statistics/rx_bytes)
    local INITIAL_TX=$(cat /sys/class/net/${INTERFACE}/statistics/tx_bytes)
    local START_TIME=$(date +%s)
    
    sleep ${DURATION}
    
    # Get final values
    local FINAL_RX=$(cat /sys/class/net/${INTERFACE}/statistics/rx_bytes)
    local FINAL_TX=$(cat /sys/class/net/${INTERFACE}/statistics/tx_bytes)
    local END_TIME=$(date +%s)
    
    # Calculate bandwidth
    local RX_BYTES=$((FINAL_RX - INITIAL_RX))
    local TX_BYTES=$((FINAL_TX - INITIAL_TX))
    local TIME_DIFF=$((END_TIME - START_TIME))
    
    local RX_MBPS=$(echo "scale=2; ${RX_BYTES} * 8 / ${TIME_DIFF} / 1000000" | bc)
    local TX_MBPS=$(echo "scale=2; ${TX_BYTES} * 8 / ${TIME_DIFF} / 1000000" | bc)
    
    echo "Bandwidth for ${INTERFACE}:"
    echo "  RX: ${RX_MBPS} Mbps (${RX_BYTES} bytes)"
    echo "  TX: ${TX_MBPS} Mbps (${TX_BYTES} bytes)"
}

# Network latency testing
test_network_latency() {
    echo "=== Network Latency Testing ==="
    
    for i in $(seq 0 29); do
        INTERFACE="wwan${i}"
        
        if ip link show ${INTERFACE} >/dev/null 2>&1; then
            # Test latency via this interface
            local LATENCY=$(ping -c 1 -W 2 -I ${INTERFACE} 8.8.8.8 2>/dev/null | grep 'time=' | awk -F'time=' '{print $2}' | awk '{print $1}')
            
            if [ -n "$LATENCY" ]; then
                echo "${INTERFACE}: ${LATENCY}ms"
            else
                echo "${INTERFACE}: timeout/unreachable"
            fi
        fi
    done
}
```

### Troubleshooting Tools
```bash
#!/bin/bash
# network-troubleshoot.sh - Network troubleshooting utilities

# Diagnose routing issues
diagnose_routing() {
    local MODEM_ID=$1
    local INTERFACE="wwan${MODEM_ID}"
    local TABLE_NAME="modem${MODEM_ID}"
    
    echo "=== Routing Diagnosis for Modem ${MODEM_ID} ==="
    
    # Check interface status
    echo "1. Interface Status:"
    ip link show ${INTERFACE}
    echo
    
    # Check IP configuration
    echo "2. IP Configuration:"
    ip addr show ${INTERFACE}
    echo
    
    # Check routing table
    echo "3. Routing Table (${TABLE_NAME}):"
    ip route show table ${TABLE_NAME}
    echo
    
    # Check policy rules
    echo "4. Policy Rules:"
    ip rule show | grep -E "(${TABLE_NAME}|${MODEM_ID})"
    echo
    
    # Test connectivity
    echo "5. Connectivity Test:"
    local IP=$(ip addr show ${INTERFACE} | grep "inet " | awk '{print $2}' | cut -d/ -f1 | head -1)
    if [ -n "$IP" ]; then
        echo "Testing from IP ${IP}:"
        ping -c 3 -I ${INTERFACE} 8.8.8.8
    else
        echo "No IP address configured on ${INTERFACE}"
    fi
    echo
}

# Check for interface conflicts
check_interface_conflicts() {
    echo "=== Interface Conflict Detection ==="
    
    # Check for duplicate IP addresses
    echo "1. Duplicate IP Check:"
    ip addr show | grep "inet " | awk '{print $2}' | sort | uniq -d
    echo
    
    # Check for routing conflicts
    echo "2. Routing Conflict Check:"
    for i in $(seq 100 129); do
        local TABLE_NAME="modem$((i-100))"
        local DEFAULT_ROUTES=$(ip route show table ${TABLE_NAME} | grep "^default" | wc -l)
        
        if [ $DEFAULT_ROUTES -gt 1 ]; then
            echo "WARNING: Multiple default routes in table ${TABLE_NAME}"
            ip route show table ${TABLE_NAME} | grep "^default"
        fi
    done
    echo
    
    # Check for policy rule conflicts
    echo "3. Policy Rule Conflicts:"
    ip rule show | awk '{print $3}' | grep -E "^[0-9]+$" | sort -n | uniq -d
    echo
}

# Performance bottleneck detection
detect_bottlenecks() {
    echo "=== Performance Bottleneck Detection ==="
    
    # Check CPU usage for network interrupts
    echo "1. Network Interrupt CPU Usage:"
    grep -E "(eth|wwan)" /proc/interrupts | while read line; do
        local IRQ=$(echo $line | awk '{print $1}' | tr -d ':')
        local DEVICE=$(echo $line | awk '{print $NF}')
        local CPU_AFFINITY=$(cat /proc/irq/${IRQ}/smp_affinity 2>/dev/null || echo "unknown")
        echo "  ${DEVICE}: IRQ ${IRQ}, CPU affinity ${CPU_AFFINITY}"
    done
    echo
    
    # Check network buffer overruns
    echo "2. Buffer Overrun Detection:"
    local OVERRUNS=$(cat /proc/net/dev | awk 'NR>2 {print $1, $5, $13}' | grep -E "wwan" | while read iface rx_overruns tx_overruns; do
        if [ "$rx_overruns" -gt 0 ] || [ "$tx_overruns" -gt 0 ]; then
            echo "  ${iface}: RX overruns=${rx_overruns}, TX overruns=${tx_overruns}"
        fi
    done)
    
    if [ -z "$OVERRUNS" ]; then
        echo "  No buffer overruns detected"
    else
        echo "$OVERRUNS"
    fi
    echo
    
    # Check connection tracking table usage
    echo "3. Connection Tracking Usage:"
    local CONNTRACK_USAGE=$(awk 'BEGIN {print int(conntrack_count/conntrack_max*100)}' \
        conntrack_count=$(cat /proc/sys/net/netfilter/nf_conntrack_count) \
        conntrack_max=$(cat /proc/sys/net/netfilter/nf_conntrack_max))
    echo "  Connection tracking table: ${CONNTRACK_USAGE}% full"
    
    if [ $CONNTRACK_USAGE -gt 80 ]; then
        echo "  WARNING: Connection tracking table >80% full"
    fi
    echo
}
```

This Linux Network Stack Multi-Interface Guide provides comprehensive configuration and optimization for managing 30+ concurrent modem interfaces with policy routing, performance optimization, and robust troubleshooting capabilities.
