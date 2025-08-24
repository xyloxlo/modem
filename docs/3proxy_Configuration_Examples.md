# 3proxy Practical Configuration Examples

## Basic Configurations

### 1. Simple Home/SOHO Proxy
**Use case**: Basic internet sharing for home network

```bash
# /usr/local/etc/3proxy.cfg
daemon
pidfile /var/run/3proxy.pid
log /var/log/3proxy/3proxy.log D
rotate 7

# Network setup
internal 192.168.1.1           # Router IP
external 0.0.0.0               # Auto-detect external IP

# Simple IP-based authentication
auth iponly

# Allow home network access
allow * 192.168.1.0/24 * * *

# Services
proxy -p3128                   # HTTP proxy on port 3128
socks -p1080                   # SOCKS proxy on port 1080
```

### 2. Small Office with User Authentication
**Use case**: Small office with individual user accounts

```bash
daemon
pidfile /var/run/3proxy.pid
log /var/log/3proxy/office.log D
rotate 30

internal 10.0.1.1
external 203.0.113.10

# User authentication
auth strong
users boss:CL:bosspassword
users alice:CL:alicepassword
users bob:CL:bobpassword
users intern:CL:internpassword

# Access control by user
allow boss * * * *                               # Boss gets everything
allow alice,bob * * 80,443,993,995,587,25 *     # Staff get web+email
allow intern * * 80,443 HTTP,HTTPS              # Intern gets web only
deny *

# Bandwidth control
nobandlimin boss                                 # No limit for boss
bandlimin 2097152 alice,bob                     # 2Mbps for staff
bandlimin 1048576 intern                        # 1Mbps for intern

proxy -p8080
```

---

## Corporate Environments

### 3. Medium Enterprise with Departments
**Use case**: Company with different departments and access policies

```bash
daemon
pidfile /var/run/3proxy.pid
log /var/log/3proxy/corporate.log D
rotate 90
maxconn 2000

internal 172.16.1.1
external 203.0.113.50

# Department-based authentication
auth strong
users $/usr/local/etc/3proxy.users

# IT Department - Full access
allow admin_john,admin_sarah * * * * * *

# Management - Business hours + extended
allow mgr_* * * * * 1-5 07:00:00-20:00:00
allow mgr_* * * 80,443,993,995,587,25 * 6-7     # Limited weekend

# Sales Department - Web + CRM access
allow sales_* * * 80,443 HTTP,HTTPS 1-5 08:00:00-18:00:00
allow sales_* * 203.0.113.100 443,8080 *        # CRM server

# HR Department - Restricted access
allow hr_* * * 80,443 HTTP,HTTPS 1-5 09:00:00-17:00:00
allow hr_* * 203.0.113.200 443 HTTPS            # HR system

# General employees - Basic web
allow emp_* * * 80,443 HTTP,HTTPS 1-5 09:00:00-17:00:00

# Block social media during work hours  
deny * * *.facebook.com,*.twitter.com,*.instagram.com * * 1-5 09:00:00-17:00:00

# Default deny
deny *

# Traffic quotas
countin 1 D 100 emp_*                           # 100MB/day for employees
countin 2 D 500 sales_*,hr_*                    # 500MB/day for dept staff
nocountin mgr_*,admin_*                         # No limit for mgmt/admin

proxy -p3128
```

### 4. High-Security Corporate Gateway
**Use case**: Security-conscious organization with strict controls

```bash
daemon
pidfile /var/run/3proxy.pid

# Comprehensive logging
log /var/log/3proxy/security.log D
log @3proxy-security                            # Also to syslog
rotate 180                                      # 6 months retention

# Performance settings
maxconn 5000
stacksize 65536

# Network configuration
internal 10.0.10.1
external 203.0.113.100

# Strong authentication with session binding
auth strong
authcache ip,user,pass,limit 900               # 15-minute cache with IP binding
users $/usr/local/etc/3proxy.users

# Security-first ACLs
# Executive level - monitored access
allow exec_* * * * * * *
logformat "EXEC: %t %U %C->%R:%r %T"

# IT Security - full access  
allow security_* * * * * * *

# IT Operations - technical access
allow itops_* * * 22,80,443,993,995,587,25,53 * 1-5 07:00:00-19:00:00

# Regular employees - restricted and monitored
allow user_* * * 80,443 HTTP,HTTPS 1-5 08:30:00-17:30:00

# Block dangerous protocols
deny * * * 23,135,139,445,1433,3306,5432 *     # Telnet, SMB, DB ports

# Block private network access
deny * * 10.0.0.0/8,172.16.0.0/12,192.168.0.0/16 * *

# Content filtering via DNS
nsrecord *.gambling.com 127.0.0.2
nsrecord *.adult.com 127.0.0.2
nsrecord malware.badsite.org 127.0.0.2
deny * * 127.0.0.2 * *

# Default deny with logging
deny *
logformat "DENIED: %t %C attempted %R:%r"

# Bandwidth management
nobandlimin exec_*,security_*                  # No limits for executives/security
bandlimin 4194304 itops_*                     # 4Mbps for IT ops
bandlimin 2097152 user_*                      # 2Mbps for users

proxy -p8080
```

---

## Specialized Configurations

### 5. ISP/Hosting Provider Setup
**Use case**: Internet service provider customer proxy

```bash
daemon
pidfile /var/run/3proxy.pid
log /var/log/3proxy/isp.log D
rotate 30
maxconn 10000
stacksize 32768

# Multiple internal interfaces for different customer networks
internal 192.168.1.1                           # Residential customers
internal 192.168.10.1                          # Business customers  
internal 192.168.100.1                         # Premium customers

external 203.0.113.10

# IP-based authentication for ISP use
auth iponly

# Residential customers - basic limits
allow * 192.168.1.0/24 * * *
bandlimin 10485760 * 192.168.1.0/24           # 10Mbps
countin 1 M 50000 * 192.168.1.0/24            # 50GB/month

# Business customers - higher limits
allow * 192.168.10.0/24 * * *  
bandlimin 52428800 * 192.168.10.0/24          # 50Mbps
countin 2 M 200000 * 192.168.10.0/24          # 200GB/month

# Premium customers - no limits
allow * 192.168.100.0/24 * * *
nobandlimin * 192.168.100.0/24
nocountin * 192.168.100.0/24

# Block abuse
deny * * 203.0.113.200/29 * *                 # Known spam networks

proxy -p3128
socks -p1080
```

### 6. School/University Network
**Use case**: Educational institution with student/staff separation

```bash
daemon
pidfile /var/run/3proxy.pid
log /var/log/3proxy/university.log D
rotate 30

internal 172.20.1.1
external 203.0.113.200

# Mixed authentication for different user types
auth iponly strong

# User accounts for staff
users prof_smith:CR:$1$salt$hash
users admin_jones:CR:$1$salt$hash
users $/usr/local/etc/3proxy.staff

# Student network (IP-based)
allow * 172.20.10.0/24 * 80,443 HTTP,HTTPS 1-5 08:00:00-22:00:00  # Student dorms
allow * 172.20.10.0/24 * 80,443 HTTP,HTTPS 6-7 10:00:00-24:00:00  # Weekend hours

# Library computers (unrestricted research)
allow * 172.20.20.0/26 * 80,443,993,995 * 1-7 06:00:00-24:00:00

# Staff network (authenticated)
allow prof_*,admin_* * * * * * *               # Full access for staff

# Lab computers - technical access
allow * 172.20.30.0/24 * 22,80,443,8080-8090 * 1-5 08:00:00-20:00:00

# Content filtering for educational environment
nsrecord *.gambling.com 127.0.0.2
nsrecord *.adult.com 127.0.0.2
nsrecord *.gaming.com 127.0.0.2              # Block gaming during class hours
deny * * 127.0.0.2 * * 1-5 08:00:00-17:00:00

# Bandwidth management for fair usage
bandlimin 1048576 * 172.20.10.0/24           # 1Mbps for students
bandlimin 5242880 * 172.20.20.0/26           # 5Mbps for library
nobandlimin prof_*,admin_*                    # No limit for staff

proxy -p8080
```

---

## Advanced Configurations

### 7. Load Balancing Proxy Chain
**Use case**: High availability with multiple upstream proxies

```bash
daemon
pidfile /var/run/3proxy.pid
log /var/log/3proxy/loadbalancer.log D
rotate 7

internal 10.0.1.1
external 203.0.113.50

auth iponly
allow * 10.0.0.0/16 * * *

# Load balancing between 3 upstream proxies
# Each gets 33.3% of traffic randomly
allow * * * 80,443
parent 333 connect upstream1.proxy.com 3128
parent 333 connect upstream2.proxy.com 3128  
parent 334 connect upstream3.proxy.com 3128

# Failover chain for critical services
allow * * critical.service.com *
parent 1000 connect primary.proxy.com 3128
parent 1000 connect backup.proxy.com 3128

# Direct access to local services
allow * * 10.0.0.0/8,172.16.0.0/12,192.168.0.0/16 * *

proxy -p3128
```

### 8. Multi-Protocol Gateway with Local Redirections
**Use case**: Single SOCKS entry point for multiple protocols

```bash
daemon
pidfile /var/run/3proxy.pid
log /var/log/3proxy/gateway.log D
rotate 30

internal 192.168.1.1
external 203.0.113.75

auth strong
users $/usr/local/etc/3proxy.users

# HTTP traffic through local HTTP proxy
allow * * * 80,8080-8088
parent 1000 http 0.0.0.0 0
allow * * * 80,8080-8088                       # Second allow for HTTP proxy

# HTTPS traffic through local HTTP proxy  
allow * * * 443
parent 1000 http 0.0.0.0 0
allow * * * 443

# FTP traffic through local FTP proxy
allow * * * 21,2121
parent 1000 ftp 0.0.0.0 0
allow * * * 21,2121

# POP3 traffic through local POP3 proxy
allow * * * 110,995
parent 1000 pop3 0.0.0.0 0
allow * * * 110,995

# Everything else direct
allow *

# Single SOCKS interface for all protocols
socks -p1080
```

### 9. Transparent Proxy with Content Filtering
**Use case**: Transparent web filtering for network

```bash
daemon
pidfile /var/run/3proxy.pid
log /var/log/3proxy/transparent.log D
rotate 30

# Transparent operation
internal 192.168.1.1
external 203.0.113.80

auth iponly

# Content filtering through DNS
nserver 208.67.222.222                        # OpenDNS Family Shield
nserver 208.67.220.220
nscache 65535

# Static blocking of known bad sites
nsrecord malware.example.com 127.0.0.2
nsrecord phishing.badsite.org 127.0.0.2
nsrecord *.adult.com 127.0.0.2

# Time-based social media blocking
nsrecord *.facebook.com 127.0.0.2
nsrecord *.twitter.com 127.0.0.2
nsrecord *.instagram.com 127.0.0.2
deny * * 127.0.0.2 * * 1-5 09:00:00-17:00:00  # Work hours only

# Allow everything else
allow *

proxy -p3128

# Note: Requires iptables rules for transparent redirection:
# iptables -t nat -A OUTPUT -p tcp --dport 80 -j REDIRECT --to-port 3128
```

### 10. VPN Exit Node Proxy
**Use case**: Proxy server as VPN exit point

```bash
daemon
pidfile /var/run/3proxy.pid
log /var/log/3proxy/vpn-exit.log D
rotate 30

# VPN interface
internal 10.8.0.1                             # OpenVPN server IP
external 203.0.113.90                         # Public exit IP

# Client certificate authentication simulation
auth strong
users $/usr/local/etc/3proxy.vpnusers

# VPN users get full access
allow * 10.8.0.0/24 * * *

# Geographic restrictions simulation
allow * * 203.0.113.0/24 * *                  # Local country access
deny * * 198.51.100.0/24 * *                  # Blocked region

# No bandwidth limits for VPN users
nobandlimin *

# High connection limit for VPN concentrator
maxconn 5000

proxy -p3128
socks -p1080
```

---

## Service-Specific Configurations

### 11. FTP Proxy Server
**Use case**: Dedicated FTP proxy for file transfer

```bash
daemon
pidfile /var/run/3proxy.pid
log /var/log/3proxy/ftp.log D

internal 192.168.1.1
external 203.0.113.100

auth strong
users ftpuser1:CL:password1
users ftpuser2:CL:password2

# FTP-specific access control
allow ftpuser1 * ftp.server1.com 21 FTP_GET,FTP_LIST
allow ftpuser2 * ftp.server2.com 21 FTP_GET,FTP_PUT,FTP_LIST
deny * * * * FTP_PUT                           # No uploads for others

# Bandwidth control for file transfers
bandlimin 4194304 ftpuser1                    # 4Mbps download
bandlimout 1048576 ftpuser2                   # 1Mbps upload

ftppr -p2121
```

### 12. Email Proxy Gateway
**Use case**: POP3/IMAP proxy for email security

```bash
daemon
pidfile /var/run/3proxy.pid
log /var/log/3proxy/email.log D

internal 192.168.1.1
external 0.0.0.0

auth strong
users $/usr/local/etc/3proxy.emailusers

# Email servers access only
allow * * mail.company.com 110,143,993,995 *
allow * * smtp.company.com 25,587 *

# Log all email proxy connections
logformat "EMAIL: %t %U %C->%R:%r %O/%I bytes"

pop3p -p1110                                  # POP3 proxy
```

### 13. DNS Proxy with Caching
**Use case**: DNS proxy with local caching and filtering

```bash
daemon
pidfile /var/run/3proxy.pid
log /var/log/3proxy/dns.log D

internal 192.168.1.1

# DNS configuration
nserver 8.8.8.8
nserver 1.1.1.1
nscache 65535

# Local DNS overrides
nsrecord internal.company.com 192.168.1.100
nsrecord printer.local 192.168.1.50

# Block malicious domains
nsrecord malware.example.com 127.0.0.2
nsrecord phishing.site.org 127.0.0.2

auth iponly
allow * 192.168.1.0/24 * 53 *

dnspr -p5353                                  # DNS proxy on port 5353
```

---

## Performance-Optimized Configurations

### 14. High-Performance Proxy
**Use case**: Maximum throughput proxy server

```bash
daemon
pidfile /var/run/3proxy.pid

# Minimal logging for performance
log /var/log/3proxy/perf.log
# No daily rotation to reduce I/O

# High performance settings
maxconn 20000
stacksize 32768

# Network optimization
internal 10.0.1.1
external 203.0.113.120

# Minimal authentication overhead
auth iponly

# Simple allow-all for performance
allow *

# No bandwidth limits
nobandlimin *

# No traffic counting
nocountin *
nocountout *

proxy -p3128
```

### 15. Memory-Optimized Configuration
**Use case**: Proxy for resource-constrained systems

```bash
daemon
pidfile /var/run/3proxy.pid

# Minimal logging
log @3proxy                                   # Syslog only, no files

# Conservative resource usage
maxconn 500
stacksize 16384

# Small DNS cache
nscache 1024

internal 192.168.1.1
external 0.0.0.0

auth iponly
allow * 192.168.1.0/24 * * *

# Single service to minimize memory
proxy -p3128
```

---

## Testing and Development Configurations

### 16. Development Proxy with Debugging
**Use case**: Proxy for development and testing

```bash
# Do not run as daemon for console output
pidfile /var/run/3proxy.pid

# Verbose logging to console and file
log /var/log/3proxy/debug.log
logformat "DEBUG: %t.%. %N.%p [%E] %U %C:%c->%R:%r %O/%I %h '%T'"

# Allow everything for testing
auth none
allow *

internal 127.0.0.1
external 0.0.0.0

# All services for testing
proxy -p3128
socks -p1080
ftppr -p2121
tcppm -p8080 httpbin.org 80

# Note: Run with: 3proxy -f 3proxy.cfg (foreground mode)
```

### 17. Content Analysis Proxy
**Use case**: Proxy for monitoring and analyzing web traffic

```bash
daemon
pidfile /var/run/3proxy.pid

# Detailed logging for analysis
log /var/log/3proxy/analysis.log D
rotate 7

# Comprehensive log format for analysis
logformat "ANALYSIS|%t|%C|%U|%R|%r|%T|%O|%I|%E"

internal 192.168.1.1
external 203.0.113.130

auth iponly
allow * 192.168.1.0/24 * * *

# Monitor specific sites
allow * * *.company.com * *
logformat "COMPANY|%t|%C|%U|%R|%r|%T|%O|%I"

allow * * * * *
logformat "EXTERNAL|%t|%C|%U|%R|%r|%T|%O|%I"

proxy -p3128
```

---

## Integration Examples

### 18. Proxy with fail2ban Integration
**Use case**: Automatic IP blocking for security

```bash
daemon
pidfile /var/run/3proxy.pid

# Structured logging for fail2ban parsing
log /var/log/3proxy/security.log D
logformat "3PROXY: %t %C %U %E %R:%r"

internal 192.168.1.1
external 203.0.113.140

auth strong
users $/usr/local/etc/3proxy.users

# Log authentication failures prominently
allow authenticated_users * * * *
deny *

proxy -p3128

# fail2ban filter would parse log for error codes 004,005,006,007,008
# /etc/fail2ban/filter.d/3proxy.conf:
# [Definition]
# failregex = 3PROXY: .* <HOST> .* 00[4-8] .*
```

### 19. Proxy with External Authentication
**Use case**: Integration with LDAP/AD authentication

```bash
daemon
pidfile /var/run/3proxy.pid
log /var/log/3proxy/ldap.log D

internal 10.0.1.1
external 203.0.113.150

# Use external authentication helper
# (This would require custom plugin development)
auth strong
users $/usr/local/etc/3proxy.ldapusers

# Group-based access (simulated with naming convention)
allow ldap_admins * * * * * *
allow ldap_users * * 80,443 HTTP,HTTPS 1-5 08:00:00-18:00:00
deny *

proxy -p3128
```

Each configuration example includes specific use cases, detailed comments, and can be adapted to your specific network requirements. Remember to test configurations in a non-production environment first and adjust security settings according to your organization's policies.