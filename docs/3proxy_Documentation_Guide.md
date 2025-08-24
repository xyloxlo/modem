# 3proxy Complete Documentation Guide

## Overview

**3proxy** is a lightweight, cross-platform proxy server supporting multiple protocols (HTTP, HTTPS, SOCKS4/5, FTP, POP3, TCP/UDP port mapping). Originally designed for SOHO environments, it can handle substantial loads with proper configuration and system tuning.

### Key Features
- **Multi-Protocol Support**: HTTP, HTTPS, SOCKS4/5, FTP, POP3 proxying
- **Authentication**: Multiple methods (IP-based, NetBIOS, username/password)
- **Access Control**: Comprehensive ACL system with time/bandwidth/traffic limits
- **Proxy Chaining**: Multi-hop proxy configurations with load balancing
- **Traffic Management**: Bandwidth limiting and traffic quotas
- **IPv6 Support**: Full IPv4/IPv6 mixed network proxying
- **Logging**: Multiple formats (file, syslog, ODBC) with rotation

---

## Installation & Compilation

### Ubuntu/Linux Compilation

```bash
# Install dependencies
sudo apt update
sudo apt install build-essential

# For ODBC support (optional)
sudo apt install unixodbc-dev

# Compile 3proxy
make -f Makefile.Linux

# For systems with GNU make as 'gmake'
gmake -f Makefile.Linux
```

### Installation

```bash
# Create directories
sudo mkdir -p /usr/local/3proxy/{sbin,bin}
sudo mkdir -p /usr/local/etc
sudo mkdir -p /var/log/3proxy

# Copy executables
sudo cp 3proxy ftppr pop3p tcppm udppm socks proxy dnspr /usr/local/3proxy/sbin/
sudo cp mycrypt countersutil /usr/local/3proxy/bin/

# Create configuration
sudo touch /usr/local/etc/3proxy.cfg
sudo chmod 600 /usr/local/etc/3proxy.cfg

# Create startup script (systemd service)
sudo tee /etc/systemd/system/3proxy.service > /dev/null << 'EOF'
[Unit]
Description=3proxy Proxy Server
After=network.target

[Service]
Type=forking
ExecStart=/usr/local/3proxy/sbin/3proxy /usr/local/etc/3proxy.cfg
ExecReload=/bin/kill -HUP $MAINPID
PIDFile=/var/run/3proxy.pid
User=proxy
Group=proxy
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

# Create proxy user
sudo useradd -r -s /bin/false -d /var/empty proxy

# Set permissions
sudo chown -R proxy:proxy /var/log/3proxy
sudo chmod 755 /usr/local/3proxy/sbin/*

# Enable service
sudo systemctl enable 3proxy
```

---

## Basic Configuration

### Essential Configuration Structure

```bash
# /usr/local/etc/3proxy.cfg

# Basic settings
daemon
pidfile /var/run/3proxy.pid
log /var/log/3proxy/3proxy.log D
rotate 30

# Network interfaces
internal 127.0.0.1      # Accept connections from localhost
external 0.0.0.0        # Use system-selected external IP

# Authentication
auth iponly

# Basic HTTP proxy
proxy -p3128

# Basic SOCKS5 proxy  
socks -p1080
```

### Service Management

```bash
# Start service
sudo systemctl start 3proxy

# Check status
sudo systemctl status 3proxy

# View logs
sudo journalctl -u 3proxy -f

# Reload configuration
sudo systemctl reload 3proxy

# Stop service
sudo systemctl stop 3proxy
```

---

## Authentication & Security

### Authentication Types

```bash
# No authentication (not recommended for production)
auth none

# IP-based authentication (allows ACL usage)
auth iponly

# NetBIOS name authentication (Windows environments)
auth nbname

# Username/password authentication
auth strong

# Combined authentication (flexible)
auth iponly strong
```

### User Management

```bash
# Create users with different password types
users admin:CL:secretpassword
users "test:CR:$1$lFDGlder$pLRb4cU2D7GAT58YQvY49."
users sysadmin:NT:BD7DFBF29A93F93C63CB84790DA00E63

# External user file
users $/usr/local/etc/3proxy.users

# Generate encrypted passwords
/usr/local/3proxy/bin/mycrypt password
```

### Security Best Practices

```bash
# Secure installation
# 1. Never install suid
chmod 755 /usr/local/3proxy/sbin/3proxy

# 2. Restrict configuration access
chmod 600 /usr/local/etc/3proxy.cfg
chown proxy:proxy /usr/local/etc/3proxy.cfg

# 3. Use unprivileged user
# (Already configured in systemd service)

# 4. Specify interfaces explicitly
internal 192.168.1.1    # LAN interface
external 203.0.113.1    # WAN interface

# 5. Secure logging
chmod 640 /var/log/3proxy/*.log
chown proxy:adm /var/log/3proxy/*.log
```

---

## Service Configuration

### HTTP Proxy Service

```bash
# Basic HTTP proxy
proxy -p3128 -i192.168.1.1

# HTTP proxy with authentication
auth strong
allow admin,user1
proxy -p8080

# HTTP proxy with access restrictions
auth iponly
allow * 192.168.0.0/16 * 80,443,8080
deny *
proxy
```

### SOCKS Proxy Service

```bash
# SOCKS4/5 proxy
socks -p1080

# SOCKS with specific interface
socks -p1080 -i127.0.0.1

# SOCKS with authentication
auth strong
allow validuser
socks
```

### FTP Proxy Service

```bash
# FTP proxy for FTP clients
ftppr -p2121

# FTP over HTTP (browsers) - use HTTP proxy service
proxy -p3128
```

### TCP/UDP Port Mapping

```bash
# TCP port mapping (forward port 8080 to remote server)
tcppm -p8080 remote.server.com 80

# UDP port mapping
udppm -p5353 dns.server.com 53

# Reverse connection (connect-back)
tcppm -R0.0.0.0:1234 3128 external.host.com 3128
```

### SNI Proxy (TLS)

```bash
# SNI proxy for transparent TLS redirection
tlspr -p1443 -P443 -c1

# Combined with SOCKS for hostname detection
allow * * * 80
parent 1000 http 0.0.0.0 0
allow * * * * CONNECT
parent 1000 tls 0.0.0.0 0
socks
```

---

## Access Control Lists (ACLs)

### ACL Syntax

```bash
allow <userlist> <sourcelist> <targetlist> <targetportlist> <commandlist> <weekdaylist> <timeperiodlist>
deny <userlist> <sourcelist> <targetlist> <targetportlist> <commandlist> <weekdaylist> <timeperiodlist>
flush  # Clear existing ACLs
```

### ACL Examples

```bash
# Basic access control
auth iponly
allow * 192.168.0.0/16 * * *           # LAN access
allow * * 192.168.0.0/16 * *           # Access to LAN
deny * * 10.0.0.0/8 * *                # Block private networks
allow * * * 80,443,8080 HTTP,HTTPS     # Web browsing only
deny *                                 # Deny everything else

# Time-based restrictions
allow * 192.168.1.0/24 * * * 1-5 09:00:00-17:00:00  # Work hours only
deny * 192.168.1.0/24 * * * 6-7         # Block weekends

# User-based access
auth strong
allow admin * * * *                     # Admin full access
allow user1,user2 * * 80,443 HTTP       # Limited web access
allow poweruser * * * * * * 08:00:00-20:00:00  # Extended hours
deny *
```

### Protocol-Specific ACLs

```bash
# HTTP-specific controls
allow * * * 80,8080 HTTP_GET,HTTP_POST
allow * * * 443 HTTPS
deny * * * * HTTP_CONNECT              # Block HTTPS tunneling

# SOCKS-specific controls
allow * * * * CONNECT                  # TCP connections
allow * * * * UDPASSOC                 # UDP associations
deny * * * * BIND                      # Block incoming connections

# FTP controls
allow * * * 21 FTP_GET,FTP_LIST       # Read-only FTP
deny * * * * FTP_PUT                   # Block uploads
```

---

## Advanced Features

### Proxy Chaining

```bash
# Single parent proxy
auth iponly
allow *
parent 1000 http proxy.upstream.com 3128
proxy

# Random selection between proxies
allow *
parent 500 socks5 proxy1.com 1080
parent 500 connect proxy2.com 3128
proxy

# Multi-hop chain (3 hops)
allow * * * 80
parent 1000 socks5 hop1.com 1080      # First hop
parent 1000 connect hop2.com 3128     # Second hop  
parent 300 socks4 hop3a.com 1080      # Third hop (30% chance)
parent 700 socks5 hop3b.com 1080      # Third hop (70% chance)
proxy
```

### Load Balancing

```bash
# Balance between multiple external interfaces
auth iponly
allow *
parent 500 http 10.1.1.101 0          # 50% traffic via interface 1
parent 500 http 10.2.1.102 0          # 50% traffic via interface 2
proxy
```

### Local Redirections

```bash
# Redirect different protocols through SOCKS
auth iponly
allow * * * 80
parent 1000 http 0.0.0.0 0            # HTTP to local HTTP proxy
allow * * * 21  
parent 1000 ftp 0.0.0.0 0             # FTP to local FTP proxy
allow * * * 110
parent 1000 pop3 0.0.0.0 0            # POP3 to local POP3 proxy
allow *                               # Direct for everything else
socks
```

---

## Traffic Management

### Bandwidth Limiting

```bash
# Per-client bandwidth limits
bandlimin 57600 * 192.168.10.16      # 56k modem simulation
bandlimin 57600 * 192.168.10.17
bandlimout 115200 * 192.168.10.18    # Upstream limiting

# Shared bandwidth
bandlimin 1048576 * 192.168.1.0/24   # 1Mbps shared by subnet

# Exclude specific traffic from limits
nobandlimin * * * 110                # No limit for POP3
bandlimin 57600 * 192.168.1.0/24     # Limit everything else
```

### Traffic Quotas

```bash
# Daily/Monthly quotas
counter /var/log/3proxy/traffic.bin D /var/log/3proxy/
countin 1 D 100 * 192.168.1.0/24     # 100MB/day for subnet
countout 2 M 1024 user1               # 1GB/month for user1

# Exclude critical services
nocountin * * * 25,110,143            # No counting for email
countin 1 D 50 * 192.168.1.0/24      # Count other traffic
```

---

## Logging & Monitoring

### Log Configuration

```bash
# Basic file logging with rotation
log /var/log/3proxy/3proxy.log D
rotate 30                             # Keep 30 days

# Syslog logging
log @3proxy                           # Log to syslog with ident "3proxy"

# ODBC logging (requires ODBC support)
log &DSN,username,password
logformat "INSERT INTO proxylog VALUES (%t, '%C', '%U', %I, %O)"
```

### Log Format Examples

```bash
# Standard format
logformat "L%t.%. %N.%p %E %U %C:%c %R:%r %O %I %h %T"

# Squid-compatible format
logformat "- +_G%t.%. %D %C TCP_MISS/200 %I %1-1T %2-2T %U DIRECT/%R application/unknown"

# Apache-compatible format
logformat "-""+_L%C - %U [%d/%o/%Y:%H:%M:%S %z] ""%T"" %E %I"

# ISA Server compatible format
logformat "-	+ L%C	%U	Unknown	%Y-%m-%d	%H:%M:%S	3PROXY	-	%n	%R	%r	%D	%O	%I	http	%1-1T	%2-2T	-	%E"
```

### Log Analysis

```bash
# View real-time logs
tail -f /var/log/3proxy/3proxy.log

# Check connection statistics
grep "PROXY" /var/log/3proxy/3proxy.log | wc -l

# Monitor failed connections
grep -E "001|003|010" /var/log/3proxy/3proxy.log

# Traffic analysis
awk '{bytes+=$9} END {print "Total bytes:", bytes}' /var/log/3proxy/3proxy.log
```

---

## Network Configuration

### DNS Configuration

```bash
# Custom DNS servers
nserver 8.8.8.8
nserver 1.1.1.1:53
nserver 192.168.1.1:5353/tcp         # TCP DNS

# DNS caching
nscache 65535                         # IPv4 cache size
nscache6 65535                        # IPv6 cache size

# Static DNS records
nsrecord internal.company.com 192.168.1.100
nsrecord blocked.site.com 127.0.0.2

# Block unwanted sites via DNS
nsrecord malware.site.com 127.0.0.2
deny * * 127.0.0.2                   # Block access to fake IP
```

### IPv6 Support

```bash
# Mixed IPv4/IPv6 configuration
internal [::1]                        # IPv6 localhost
external [2001:db8::1]               # IPv6 external interface

# IPv6 ACLs
allow * [2001:db8::/32] * * *        # Allow IPv6 subnet
deny * * [2001:db8:bad::/48] * *     # Block bad IPv6 range

# Service options for IPv6 priority
proxy -6                             # IPv6 only
proxy -46                            # IPv4 preference
proxy -64                            # IPv6 preference
```

---

## Performance Optimization

### High Load Configuration

```bash
# Increase connection limits
maxconn 2000                         # Max simultaneous connections

# Thread and memory optimization
stacksize 65536                      # Increase stack size if needed

# System limits (add to /etc/security/limits.conf)
proxy soft nofile 65536
proxy hard nofile 65536
proxy soft nproc 4096
proxy hard nproc 4096
```

### System Tuning

```bash
# Kernel parameters (/etc/sysctl.conf)
net.core.somaxconn = 1024
net.ipv4.tcp_max_syn_backlog = 1024
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_keepalive_time = 120
net.ipv4.tcp_tw_reuse = 1

# Apply settings
sudo sysctl -p
```

### Virtual Environment Considerations

```bash
# For VPS/containers with limited resources
maxconn 500
stacksize 32768

# Disable unnecessary services
# proxy
socks -p1080                         # Only SOCKS if HTTP not needed
```

---

## Error Codes Reference

### Authentication Errors (1-9)
- **1**: Access denied by ACL
- **3**: No ACL found, denied by default  
- **4**: Strong auth required, no username
- **5**: Strong auth required, username not found
- **6-8**: Wrong password (cleartext/crypt/NT)

### Connection Errors (11-19)
- **11**: Failed to create socket
- **12**: Failed to bind socket
- **13**: Failed to connect
- **14**: Failed to get peer name

### Traffic Errors
- **10**: Traffic limit exceeded

### Common Errors (20-29)
- **21**: Memory allocation failed

### Timeout/Connection Errors (90-99)
- **92**: Connection timed out
- **93**: Rate limit timeout
- **94-97**: Connection termination errors

### Protocol-Specific Errors
- **100**: Host not found
- **200-299**: UDP portmapper errors
- **300-399**: TCP portmapper errors  
- **400-499**: SOCKS proxy errors
- **500-599**: HTTP proxy errors
- **600-699**: POP3 proxy errors

---

## Troubleshooting

### Common Issues

**Service won't start:**
```bash
# Check configuration syntax
sudo /usr/local/3proxy/sbin/3proxy -t /usr/local/etc/3proxy.cfg

# Check permissions
ls -la /usr/local/etc/3proxy.cfg
sudo chown proxy:proxy /usr/local/etc/3proxy.cfg

# Check logs
sudo journalctl -u 3proxy -n 50
```

**ACLs not working:**
```bash
# Ensure authentication is enabled
auth iponly  # Required for ACLs

# Check ACL order (first match wins)
allow * 192.168.1.0/24 * * *
deny *  # This should be last
```

**High memory usage:**
```bash
# Reduce stack size
stacksize 32768

# Limit connections
maxconn 1000
```

**DNS resolution issues:**
```bash
# Configure custom DNS
nserver 8.8.8.8
nscache 65535

# For systems without working DNS
fakeresolve
```

### Debugging

```bash
# Test configuration
sudo /usr/local/3proxy/sbin/3proxy -t /usr/local/etc/3proxy.cfg

# Run in foreground for debugging
sudo -u proxy /usr/local/3proxy/sbin/3proxy -f /usr/local/etc/3proxy.cfg

# Enable verbose error messages
auth iponly
allow *
# Comment out 'daemon' for console output
```

---

## Complete Example Configurations

### Basic Internet Gateway

```bash
# /usr/local/etc/3proxy.cfg
daemon
pidfile /var/run/3proxy.pid
log /var/log/3proxy/3proxy.log D
rotate 30
stacksize 65536
maxconn 1000

# Network configuration
internal 192.168.1.1
external 0.0.0.0

# Authentication
auth iponly

# Access control
allow * 192.168.1.0/24 * 80,443,993,995,587,25,110 *
allow * 192.168.1.0/24 * 53 *
deny * * 10.0.0.0/8,172.16.0.0/12,192.168.0.0/16 * *
allow *

# Services
proxy -p3128
socks -p1080
```

### Corporate Proxy with Authentication

```bash
daemon
pidfile /var/run/3proxy.pid
log /var/log/3proxy/3proxy.log D
rotate 30

internal 10.0.1.1
external 203.0.113.10

# User authentication
auth strong
users $/usr/local/etc/3proxy.users

# Time-based access control
allow admin * * * * * *
allow employees * * 80,443 HTTP,HTTPS 1-5 08:00:00-18:00:00
allow managers * * 80,443,993,587,25 * 1-5 07:00:00-19:00:00
deny *

# Bandwidth limits
bandlimin 512000 employees
nobandlimin admin,managers

# Services
proxy -p8080
```

### High-Availability Setup with Load Balancing

```bash
daemon
pidfile /var/run/3proxy.pid
log /var/log/3proxy/3proxy.log D
rotate 7
maxconn 5000

# Multiple external interfaces
internal 192.168.100.1

auth iponly

# Load balancing between upstreams
allow * * * 80,443
parent 333 connect proxy1.upstream.com 3128
parent 333 connect proxy2.upstream.com 3128  
parent 334 connect proxy3.upstream.com 3128

# Direct access for internal resources
allow * * 192.168.0.0/16,10.0.0.0/8 * *

# Monitoring and admin access
allow * 127.0.0.1 * * ADMIN
deny * * * * ADMIN

proxy -p3128
```

---

## Security Hardening Checklist

- [ ] Run 3proxy as unprivileged user
- [ ] Restrict configuration file permissions (600)
- [ ] Use authentication (`auth iponly` minimum)
- [ ] Specify internal/external interfaces explicitly
- [ ] Implement proper ACL rules with deny-all fallback
- [ ] Enable comprehensive logging
- [ ] Secure log files location and permissions
- [ ] Regular security updates and monitoring
- [ ] Use encrypted passwords (CR/NT types)
- [ ] Implement traffic and bandwidth limits
- [ ] Block access to private networks from public interfaces
- [ ] Monitor logs for suspicious activity
- [ ] Use fail2ban or similar for brute force protection

---

## Appendix: Service Manual Pages Summary

### Core Services
- **3proxy**: Universal proxy server (main executable)
- **proxy**: HTTP proxy service  
- **socks**: SOCKS4/5 proxy service
- **ftppr**: FTP proxy gateway
- **pop3p**: POP3 proxy gateway
- **tcppm**: TCP port mapper
- **udppm**: UDP port mapper
- **dnspr**: DNS proxy server

### Utilities
- **mycrypt**: Password encryption utility
- **countersutil**: Traffic counter management utility

This comprehensive guide covers all aspects of 3proxy deployment and configuration for Ubuntu Server environments, based on the official documentation provided.