# 3proxy Security Configuration Guide

## Security Fundamentals

### Core Security Principles
1. **Principle of Least Privilege**: Grant minimum necessary access
2. **Defense in Depth**: Multiple security layers
3. **Secure by Default**: Start with restrictive configuration
4. **Regular Monitoring**: Continuous security assessment

---

## Installation Security

### User Account Security
```bash
# Create dedicated unprivileged user
sudo useradd -r -s /bin/false -d /var/empty -c "3proxy service" proxy

# Never install with suid bit
chmod 755 /usr/local/3proxy/sbin/3proxy

# Verify no suid/sgid bits
find /usr/local/3proxy -perm /6000 -ls
```

### File System Security
```bash
# Configuration file permissions
sudo chmod 600 /usr/local/etc/3proxy.cfg
sudo chown proxy:proxy /usr/local/etc/3proxy.cfg

# Executable permissions
sudo chmod 755 /usr/local/3proxy/sbin/*
sudo chown root:root /usr/local/3proxy/sbin/*

# Log directory permissions
sudo chmod 750 /var/log/3proxy
sudo chown proxy:adm /var/log/3proxy

# Log file permissions
sudo chmod 640 /var/log/3proxy/*.log
sudo chown proxy:adm /var/log/3proxy/*.log
```

### Chroot Environment (Advanced)
```bash
# Create chroot jail
sudo mkdir -p /var/lib/3proxy/jail/{etc,tmp,var/log}
sudo chroot /var/lib/3proxy/jail

# Configuration in chroot context
chroot /var/lib/3proxy/jail
daemon
pidfile /var/run/3proxy.pid
log /var/log/3proxy.log D
# ... rest of configuration
```

---

## Authentication Security

### Strong Authentication Setup
```bash
# Use strong authentication
auth strong

# Create users with encrypted passwords
users admin:CR:$1$salt$encrypted_password_hash
users user1:NT:BD7DFBF29A93F93C63CB84790DA00E63

# External user file with restricted permissions
users $/usr/local/etc/3proxy.users
sudo chmod 600 /usr/local/etc/3proxy.users
sudo chown proxy:proxy /usr/local/etc/3proxy.users
```

### Password Security Best Practices
```bash
# Generate strong passwords
/usr/local/3proxy/bin/mycrypt "StrongPassword123!"

# Use NT hashes for Windows compatibility
# Extract from Windows: pwdump or similar tools

# Avoid cleartext passwords in production
# users admin:CL:password  # NEVER in production
users admin:CR:$1$AbCdEf$encrypted_hash  # Better
```

### Authentication Caching Security
```bash
# Secure caching with session binding
authcache ip,user,pass,limit 300    # 5-minute cache with IP binding
auth cache strong

# Monitor for session hijacking
# Log format should include client IP (%C) for audit
logformat "L%t.%. %N.%p %E %U %C:%c %R:%r %O %I %T"
```

---

## Network Security

### Interface Binding
```bash
# Explicitly bind to specific interfaces
internal 192.168.1.1    # LAN interface only
external 203.0.113.1    # Specific WAN interface

# NEVER use 0.0.0.0 for internal in production
# internal 0.0.0.0      # DANGEROUS - binds to all
```

### Access Control Lists (Security-Focused)
```bash
# Start with deny-all approach
auth iponly

# Allow specific networks/users only
allow * 192.168.1.0/24 * 80,443 HTTP,HTTPS
allow * 192.168.1.0/24 * 53 *                    # DNS
allow * 192.168.1.0/24 * 25,587,993,995 *       # Email

# Block dangerous protocols/ports
deny * * * 23 *                                  # Telnet
deny * * * 135,139,445 *                         # SMB/NetBIOS
deny * * * 1433,3306,5432 *                      # Database ports

# Block private network access from external
deny * * 10.0.0.0/8,172.16.0.0/12,192.168.0.0/16 * *

# Block known malicious networks (example)
deny * * 198.51.100.0/24 * *                     # Documented test network

# Default deny at end
deny *
```

### Time-Based Access Control
```bash
# Restrict access to business hours
allow employees * * 80,443 HTTP,HTTPS 1-5 08:00:00-18:00:00
allow managers * * * * * 1-5 07:00:00-20:00:00

# Weekend restrictions
deny * * * * * 6-7                               # Block weekends
allow admin * * * * * *                          # Admin always allowed
```

---

## Content Filtering & URL Security

### Hostname-Based Blocking
```bash
# DNS-based content filtering
nsrecord malware.example.com 127.0.0.2
nsrecord phishing.badsite.com 127.0.0.2
nsrecord *.gambling.com 127.0.0.2

# Block access to blocked IPs
deny * * 127.0.0.2 * *

# Use external DNS filtering service
nserver 208.67.222.222    # OpenDNS
nserver 208.67.220.220
```

### Protocol-Specific Security
```bash
# HTTP security
allow * * * 80,8080 HTTP_GET,HTTP_POST          # Allow safe methods
deny * * * * HTTP_PUT,HTTP_DELETE               # Block dangerous methods

# HTTPS tunneling control
allow trusted_users * * 443 HTTPS              # Trusted users only
deny * * * 443 HTTPS                           # Block for others

# SOCKS security
allow * * * * CONNECT                          # TCP connections
deny * * * * BIND                              # Block incoming connections
deny * * * * UDPASSOC                          # Block UDP if not needed
```

---

## Traffic Security & Monitoring

### Bandwidth Security
```bash
# Prevent DoS through bandwidth limits
bandlimin 1048576 * 192.168.1.0/24             # 1Mbps per subnet
bandlimout 512000 * 192.168.1.0/24             # 512Kbps upstream

# Priority for critical services
nobandlimin * * * 22,80,443                    # No limit for SSH, HTTP/S
bandlimin 256000 * * * *                       # Limit everything else
```

### Traffic Quota Security
```bash
# Daily traffic limits to prevent abuse
counter /var/log/3proxy/traffic.bin D /var/log/3proxy/
countin 1 D 500 * 192.168.1.0/24               # 500MB/day limit

# User-specific limits
countout 2 M 2048 user1                        # 2GB/month for user1
countout 3 M 5120 power_user                   # 5GB/month for power user

# Exclude critical services from counting
nocountin * * * 22,53                          # SSH, DNS not counted
```

---

## Logging Security

### Secure Logging Configuration
```bash
# Comprehensive logging with security focus
log /var/log/3proxy/security.log D
rotate 90                                       # Keep 90 days for audit

# Security-focused log format
logformat "-+_L%t.%. %N.%p %E %U %C:%c %R:%r %O %I %h %T"

# Additional logging to syslog for centralization
log @3proxy-security
```

### Log Analysis for Security
```bash
# Monitor authentication failures
grep -E "00[1-9]" /var/log/3proxy/*.log | tail -20

# Check for brute force attempts
awk '$5 ~ /00[1-9]/ {print $6}' /var/log/3proxy/*.log | sort | uniq -c | sort -nr

# Monitor high-traffic users
awk '{user[$5]++; bytes[$5]+=$9} END {for(u in user) print user[u], bytes[u]/1024/1024 "MB", u}' /var/log/3proxy/*.log | sort -nr

# Check blocked connections
grep "001" /var/log/3proxy/*.log | tail -10

# Monitor for scanning behavior
awk '$7 != $8 {print $6, $7, $8}' /var/log/3proxy/*.log | sort | uniq -c | sort -nr | head -10
```

### Log Security & Integrity
```bash
# Secure log rotation with compression
archiver gz gzip
rotate 90

# Log file permissions
find /var/log/3proxy -name "*.log" -exec chmod 640 {} \;
find /var/log/3proxy -name "*.log" -exec chown proxy:adm {} \;

# Centralized logging for security (rsyslog example)
echo "local0.*    @@logserver.company.com:514" >> /etc/rsyslog.conf
systemctl restart rsyslog
```

---

## Advanced Security Features

### Proxy Chaining for Anonymity
```bash
# Multi-hop anonymous chain
auth iponly
allow * 192.168.1.0/24 * 80,443 *

# 3-hop chain through different countries
parent 1000 socks5 proxy-country1.tor.com 9050
parent 1000 socks5 proxy-country2.anon.com 1080  
parent 1000 connect proxy-country3.vpn.com 3128

proxy
```

### DNS Security
```bash
# Use secure DNS providers
nserver 1.1.1.1                    # Cloudflare
nserver 8.8.8.8                    # Google
nserver 208.67.222.222             # OpenDNS

# DNS over TLS (if supported by system)
nserver 1.1.1.1:853/tls

# Local DNS filtering
nsrecord tracker.ads.com 127.0.0.2
nsrecord malware.badsite.org 127.0.0.2
```

### Connection Security Monitoring
```bash
# Monitor connection patterns
# Log unusual connection volumes
logformat "SECURITY: %t %C connected to %R:%r via %N (user: %U, bytes: %I/%O)"

# Rate limiting to prevent abuse
# (Implemented via iptables or fail2ban)
```

---

## Incident Response

### Security Incident Detection
```bash
# Real-time monitoring
tail -f /var/log/3proxy/*.log | grep -E "00[1-9]|001|003"

# Automated alerts (example script)
#!/bin/bash
# /usr/local/bin/3proxy-security-monitor.sh
while read line; do
    if echo "$line" | grep -qE "00[1-9]"; then
        echo "SECURITY ALERT: $line" | mail -s "3proxy Security Alert" admin@company.com
    fi
done < <(tail -f /var/log/3proxy/security.log)
```

### Emergency Response Procedures
```bash
# Immediate threat response
# 1. Block suspicious IP
iptables -A INPUT -s 203.0.113.100 -j DROP

# 2. Add emergency ACL rule
echo "deny * 203.0.113.100 * * *" >> /usr/local/etc/3proxy.cfg
systemctl reload 3proxy

# 3. Force disconnect all sessions
systemctl restart 3proxy

# 4. Analyze logs
grep "203.0.113.100" /var/log/3proxy/*.log > /tmp/incident-analysis.log
```

### Security Audit Commands
```bash
# Check configuration security
/usr/local/3proxy/sbin/3proxy -t /usr/local/etc/3proxy.cfg

# Verify file permissions
find /usr/local/3proxy -ls
find /usr/local/etc -name "*3proxy*" -ls
find /var/log/3proxy -ls

# Check for open proxy configuration
netstat -tlnp | grep 3proxy
ss -tlnp | grep 3proxy

# Verify user privileges
id proxy
groups proxy
```

---

## Security Hardening Checklist

### Installation Security
- [ ] 3proxy runs as unprivileged user (`proxy`)
- [ ] No suid/sgid bits on executables
- [ ] Configuration file permissions 600
- [ ] Log directory properly secured
- [ ] Consider chroot deployment for high-security environments

### Authentication Security  
- [ ] Strong authentication enabled (`auth strong`)
- [ ] No cleartext passwords in production
- [ ] User file properly secured (600 permissions)
- [ ] Authentication caching configured securely
- [ ] Regular password rotation policy

### Network Security
- [ ] Specific interface binding (no 0.0.0.0 for internal)
- [ ] Comprehensive ACL rules with deny-all fallback
- [ ] Private network access blocked from external
- [ ] Time-based access controls implemented
- [ ] Dangerous protocols/ports blocked

### Content Security
- [ ] DNS-based content filtering active
- [ ] Protocol-specific restrictions in place
- [ ] HTTP method filtering configured
- [ ] HTTPS tunneling controlled

### Monitoring Security
- [ ] Comprehensive logging enabled
- [ ] Log rotation and archiving configured
- [ ] Security-focused log analysis in place
- [ ] Real-time monitoring for threats
- [ ] Incident response procedures documented

### System Security
- [ ] Regular security updates applied
- [ ] System-level firewall configured
- [ ] Intrusion detection system in place
- [ ] Backup and recovery procedures tested
- [ ] Security audit performed regularly

---

## Security Configuration Examples

### High-Security Corporate Environment
```bash
daemon
pidfile /var/run/3proxy.pid
log /var/log/3proxy/security.log D
rotate 180                          # 6 months retention
maxconn 1000
stacksize 65536

# Secure interfaces
internal 10.0.1.1
external 203.0.113.10

# Strong authentication with caching
auth strong
authcache ip,user,pass,limit 600    # 10-minute secure cache
users $/usr/local/etc/3proxy.users

# Time and role-based access
allow admin * * * * * *
allow managers * * 80,443,993,587,25 * 1-5 07:00:00-19:00:00
allow employees * * 80,443 HTTP,HTTPS 1-5 08:30:00-17:30:00

# Security restrictions
deny * * 10.0.0.0/8,172.16.0.0/12,192.168.0.0/16 * *
deny * * * 23,135,139,445,1433,3306 *
deny *

# Traffic controls
bandlimin 2097152 managers        # 2Mbps for managers  
bandlimin 1048576 employees       # 1Mbps for employees
nobandlimin admin                 # No limit for admin

# Security logging
logformat "-+_L%t.%. SEC %N.%p %E %U %C:%c %R:%r %O %I %T"

proxy -p8080
```

### DMZ Proxy with Maximum Security
```bash
daemon
pidfile /var/run/3proxy.pid
log /var/log/3proxy/dmz-security.log D
log @3proxy-dmz                    # Also to syslog
rotate 365                         # 1 year retention

chroot /var/lib/3proxy/jail        # Chroot jail
internal 192.168.100.1
external 203.0.113.20

# IP-only authentication for DMZ
auth iponly

# Strict DMZ access - only specific servers
allow * 192.168.100.0/24 203.0.113.0/24 80,443 HTTP,HTTPS
allow * 192.168.100.0/24 203.0.113.50 25,587 *
deny *

# Very conservative bandwidth
bandlimin 512000 * 192.168.100.0/24

# Enhanced security logging
logformat "DMZ-SEC: %t %C->%R:%r [%U] %E %O/%I %T"

proxy -p3128
```

This security guide provides comprehensive protection measures for 3proxy deployments, ensuring robust security posture in enterprise environments.