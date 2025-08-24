# 3proxy Quick Reference Card

## Installation Commands
```bash
# Ubuntu/Linux compilation
make -f Makefile.Linux

# Create directories
sudo mkdir -p /usr/local/3proxy/{sbin,bin} /usr/local/etc /var/log/3proxy

# Install executables
sudo cp 3proxy ftppr pop3p tcppm udppm socks proxy dnspr /usr/local/3proxy/sbin/
sudo cp mycrypt countersutil /usr/local/3proxy/bin/

# Create user and permissions
sudo useradd -r -s /bin/false proxy
sudo chmod 600 /usr/local/etc/3proxy.cfg
sudo chown proxy:proxy /usr/local/etc/3proxy.cfg /var/log/3proxy
```

## Service Management
```bash
# Start/stop/reload
sudo systemctl start 3proxy
sudo systemctl stop 3proxy
sudo systemctl reload 3proxy
sudo systemctl status 3proxy

# Test configuration
sudo /usr/local/3proxy/sbin/3proxy -t /usr/local/etc/3proxy.cfg

# Run in foreground (debugging)
sudo -u proxy /usr/local/3proxy/sbin/3proxy -f /usr/local/etc/3proxy.cfg
```

## Basic Configuration Template
```bash
# Essential settings
daemon
pidfile /var/run/3proxy.pid
log /var/log/3proxy/3proxy.log D
rotate 30

# Network
internal 127.0.0.1          # Accept from
external 0.0.0.0            # Connect via

# Authentication
auth iponly                 # none|iponly|nbname|strong

# Services
proxy -p3128               # HTTP proxy
socks -p1080               # SOCKS proxy
```

## Authentication Types
```bash
auth none                   # No auth (dangerous)
auth iponly                 # IP-based (allows ACLs)
auth nbname                 # NetBIOS name
auth strong                 # Username/password
auth iponly strong          # Combined
```

## User Management
```bash
# Password types
users admin:CL:password                    # Cleartext
users user1:CR:$1$salt$hash               # Crypt (MD5)
users user2:NT:BD7DFBF29A93F93C63CB...    # NT hash

# External file
users $/usr/local/etc/3proxy.users

# Generate passwords
/usr/local/3proxy/bin/mycrypt mypassword
```

## Access Control Lists (ACLs)
```bash
# Syntax
allow <users> <sources> <targets> <ports> <commands> <days> <time>
deny <users> <sources> <targets> <ports> <commands> <days> <time>

# Examples
allow * 192.168.1.0/24 * 80,443 HTTP,HTTPS     # Web access
allow admin * * * *                            # Admin full access
allow * * * 53 *                               # DNS access
deny * * 10.0.0.0/8 * *                       # Block private nets
allow *                                        # Allow rest
```

## Network Addresses
```bash
# IPv4 formats
192.168.1.1                 # Single IP
192.168.1.0/24             # CIDR notation
*                          # Any address

# IPv6 formats  
[2001:db8::1]              # Single IPv6
[2001:db8::/32]            # IPv6 CIDR
[::1]                      # IPv6 localhost
```

## Port Specifications
```bash
80                         # Single port
80,443,8080               # Multiple ports
1024-65535                # Port range
*                         # Any port
```

## Time Controls
```bash
# Days (0=Sunday, 1=Monday, 7=Sunday)
1-5                       # Monday to Friday
6-7                       # Weekend
*                         # Any day

# Time periods
09:00:00-17:00:00         # Business hours
00:00:00-24:00:00         # All day
```

## Service Commands
```bash
# HTTP Proxy
proxy                     # Default port 3128
proxy -p8080              # Custom port
proxy -i192.168.1.1       # Bind to interface

# SOCKS Proxy
socks                     # Default port 1080
socks -p3129 -i127.0.0.1  # Custom port and interface

# FTP Proxy
ftppr -p2121              # FTP proxy (port 2121)

# Port Mapping
tcppm -p8080 server.com 80          # TCP forward
udppm -p5353 dns.server.com 53      # UDP forward
tcppm -R0.0.0.0:1234 3128 host.com 3128  # Reverse

# SNI Proxy
tlspr -p1443 -P443 -c1    # TLS proxy with checking
```

## Proxy Chaining
```bash
# Single parent
allow *
parent 1000 http proxy.upstream.com 3128
proxy

# Load balancing (random selection)
allow *
parent 500 socks5 proxy1.com 1080    # 50% chance
parent 500 connect proxy2.com 3128   # 50% chance
proxy

# Multi-hop chain
allow *
parent 1000 socks5 hop1.com 1080     # Hop 1
parent 1000 connect hop2.com 3128    # Hop 2  
parent 1000 socks4 hop3.com 1080     # Hop 3
proxy
```

## Traffic Management
```bash
# Bandwidth limiting (bits per second)
bandlimin 57600 * 192.168.1.10       # 56k limit for IP
bandlimout 115200 * 192.168.1.0/24   # Upstream limit
nobandlimin * * * 110                # No limit for POP3

# Traffic quotas (MB)
counter /var/log/3proxy/traffic.bin D /var/log/3proxy/
countin 1 D 100 * 192.168.1.0/24     # 100MB/day
countout 2 M 1024 user1               # 1GB/month out
nocountin * * * 25,110,143            # Exclude email
```

## DNS Configuration
```bash
# DNS servers
nserver 8.8.8.8                      # Primary DNS
nserver 1.1.1.1:53                   # Secondary
nserver 192.168.1.1:5353/tcp         # TCP DNS

# DNS caching
nscache 65535                         # IPv4 cache
nscache6 65535                        # IPv6 cache

# Static records
nsrecord internal.company.com 192.168.1.100
nsrecord blocked.site.com 127.0.0.2

# Fake resolution (resolve all to 127.0.0.2)
fakeresolve
```

## Logging
```bash
# Log destinations
log /var/log/3proxy/access.log D      # File with daily rotation
log @3proxy                          # Syslog
log &DSN,user,pass                    # ODBC

# Rotation
rotate 30                             # Keep 30 files

# Format macros
%t - timestamp    %U - username     %C - client IP
%R - target IP    %r - target port  %O - bytes out
%I - bytes in     %E - error code   %T - request text
%N - service name %p - service port %h - hop count

# Common formats
logformat "L%t.%. %N.%p %E %U %C:%c %R:%r %O %I %T"
```

## Performance Tuning
```bash
# Connection limits
maxconn 2000                          # Max connections

# Memory tuning
stacksize 65536                       # Stack size

# Authentication caching
authcache ip 60                       # Cache by IP for 60s
auth cache strong

# System limits (/etc/security/limits.conf)
proxy soft nofile 65536
proxy hard nofile 65536
```

## Common Error Codes
```bash
# Authentication
1 - Access denied by ACL
3 - No ACL found, denied
4 - Strong auth required, no username
5 - Strong auth required, user not found
6-8 - Wrong password

# Connection
10 - Traffic limit exceeded  
11 - Failed to create socket
12 - Failed to bind
13 - Failed to connect
21 - Memory allocation failed
92 - Connection timeout
100 - Host not found
```

## Debugging Commands
```bash
# Test configuration
/usr/local/3proxy/sbin/3proxy -t /usr/local/etc/3proxy.cfg

# Check logs
tail -f /var/log/3proxy/3proxy.log
journalctl -u 3proxy -f

# Monitor connections
ss -tlnp | grep 3proxy
netstat -tlnp | grep 3proxy

# Check authentication
grep "00[1-9]" /var/log/3proxy/3proxy.log

# Traffic analysis  
awk '{sum+=$9} END {print sum/1024/1024 " MB"}' /var/log/3proxy/3proxy.log
```

## Security Checklist
```bash
# File permissions
chmod 600 /usr/local/etc/3proxy.cfg
chown proxy:proxy /usr/local/etc/3proxy.cfg

# Never use
auth none                             # Dangerous!

# Always use
internal 192.168.1.1                  # Specific interface
external 203.0.113.1                  # Specific external
deny *                                # At end of ACLs

# Log security
chmod 640 /var/log/3proxy/*.log
chown proxy:adm /var/log/3proxy/
```

## IPv6 Support
```bash
# Interfaces
internal [::1]                        # IPv6 localhost
external [2001:db8::1]               # IPv6 external

# ACLs
allow * [2001:db8::/32] * * *        # IPv6 subnet
deny * * [fc00::/7] * *              # Block private IPv6

# Service options
proxy -6                             # IPv6 only
proxy -46                            # IPv4 preference
proxy -64                            # IPv6 preference
```

## Systemd Service Template
```ini
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
```

## Useful File Locations
```bash
# Configuration
/usr/local/etc/3proxy.cfg             # Main config
/usr/local/etc/3proxy.users           # User file

# Executables  
/usr/local/3proxy/sbin/3proxy         # Main daemon
/usr/local/3proxy/sbin/proxy          # HTTP proxy
/usr/local/3proxy/sbin/socks          # SOCKS proxy
/usr/local/3proxy/bin/mycrypt         # Password tool

# Logs
/var/log/3proxy/3proxy.log            # Main log
/var/run/3proxy.pid                   # PID file

# Service
/etc/systemd/system/3proxy.service    # Service file
```