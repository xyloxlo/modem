# 🚀 EC25-EUX Auto-Installation Guide

## ⚡ Jedna komenda = gotowy system!

System EC25-EUX z automatyczną instalacją PostgreSQL, konfiguracją systemd i auto-startem z systemem Linux.

---

## 🎯 **Szybka instalacja:**

### 1. Skopiuj projekt na Ubuntu Server
```bash
# Przykład lokalizacji
cd /home/server1/
git clone [repository] EC25-EUX
# lub skopiuj pliki ręcznie
```

### 2. Uruchom auto-instalację
```bash
cd EC25-EUX
chmod +x scripts/install-auto-system.sh
sudo ./scripts/install-auto-system.sh
```

### 3. To wszystko! 🎉

**System automatycznie:**
- ✅ Zainstaluje Node.js 20 LTS
- ✅ Zainstaluje i skonfiguruje PostgreSQL
- ✅ Zainstaluje wszystkie zależności systemowe
- ✅ Skonfiguruje systemd service
- ✅ Skonfiguruje udev rules dla modemów
- ✅ Uruchomi auto-start z systemem Linux

---

## 🎛️ **Zarządzanie systemem:**

### Start/Stop/Status
```bash
# Uruchom system
sudo systemctl start ec25-eux

# Zatrzymaj system  
sudo systemctl stop ec25-eux

# Status systemu
sudo systemctl status ec25-eux

# Restart systemu
sudo systemctl restart ec25-eux
```

### Logi i monitoring
```bash
# Logi w czasie rzeczywistym
sudo journalctl -u ec25-eux -f

# Ostatnie logi
sudo journalctl -u ec25-eux --since "1 hour ago"

# Wszystkie logi systemu
sudo journalctl -u ec25-eux
```

### Test modemów (bez uruchamiania pełnego systemu)
```bash
cd /home/server1/EC25-EUX/src
sudo node modem-detector.js
```

---

## 🌐 **Dostęp do systemu:**

### Web Interface (po uruchomieniu)
- **Web Interface:** `http://localhost:3000` - React/Next.js dashboard
- **Backend API:** `http://localhost:3002/api`
- **WebSocket:** `ws://localhost:3002` - real-time updates

### API Endpoints
```bash
# Lista wszystkich modemów
curl http://localhost:3002/api/modems

# Status systemu
curl http://localhost:3002/api/system/status

# Skanowanie modemów
curl -X POST http://localhost:3002/api/modems/scan
```

---

## ⚙️ **Konfiguracja:**

### Zmiana portów/ustawień
Edytuj plik: `/etc/systemd/system/ec25-eux.service`

```ini
# Przykładowe zmienne środowiskowe:
Environment=API_PORT=3002
Environment=DB_HOST=localhost
Environment=DB_NAME=ec25_modems
Environment=DB_USER=modem_user
```

Po zmianie:
```bash
sudo systemctl daemon-reload
sudo systemctl restart ec25-eux
```

### Database Configuration
- **Host:** localhost:5432
- **Database:** ec25_modems
- **User:** modem_user
- **Password:** secure_password_123

---

## 🔧 **Funkcje systemu:**

### ✅ **Automatyczne wykrywanie modemów**
- Skanowanie co 5 sekund
- Automatyczne mapowanie portów AT/QMI
- Wzór: `AT_Port = 2 + (Modem_Number - 1) × 4`

### ✅ **Dual-mode operation**
- **Z PostgreSQL:** Pełna funkcjonalność, trwałe dane
- **Standalone:** In-memory storage jeśli brak PostgreSQL

### ✅ **Auto-start z systemem**
- Uruchamia się automatycznie po restarcie serwera
- Sekwencja: Network → PostgreSQL → EC25-EUX
- 45s boot delay dla stabilizacji USB

### ✅ **Real-time WebSocket**
- Live updates o statusie modemów
- Event-driven architecture
- Automatyczne powiadomienia o zmianach

### ✅ **Proxy port allocation**
- Dynamiczna alokacja portów 3128-4127
- Automatyczne zarządzanie konfliktami
- Support dla 100+ modemów

---

## 🧪 **Troubleshooting:**

### System nie startuje
```bash
# Sprawdź status
sudo systemctl status ec25-eux

# Sprawdź logi
sudo journalctl -u ec25-eux --no-pager

# Sprawdź zależności
sudo systemctl status postgresql
sudo systemctl status network-online.target
```

### Modemy nie są wykrywane
```bash
# Sprawdź USB
lsusb | grep 2c7c:0125

# Sprawdź porty serial
ls -la /dev/ttyUSB*

# Sprawdź QMI
ls -la /dev/cdc-wdm*

# Test bezpośredni
cd /home/server1/EC25-EUX/src
sudo node modem-detector.js
```

### PostgreSQL problemy
```bash
# Status PostgreSQL
sudo systemctl status postgresql

# Test połączenia
pg_isready -h localhost -p 5432

# Manual database setup
sudo -u postgres createdb ec25_modems
sudo -u postgres createuser modem_user
```

---

## 📋 **System Requirements:**

- **OS:** Ubuntu 24.04 LTS (recommended)
- **Memory:** 2GB RAM minimum
- **Disk:** 10GB free space
- **Network:** Internet for initial setup
- **USB:** 3.0 ports for modems
- **Permissions:** Root access for installation

---

## 🎯 **Development Mode:**

Jeśli chcesz uruchamiać system w trybie rozwoju (bez systemd):

```bash
cd /home/server1/EC25-EUX/src

# Tylko wykrywanie
sudo node modem-detector.js

# Pełny system (quick start)
sudo npm run quick-start

# Pełny system (production mode)
sudo npm run auto-start
```

---

## 🔐 **Security Notes:**

- System działa jako root (wymagane dla dostępu do USB)
- PostgreSQL z lokalnym dostępem
- API bez autentykacji (localhost only)
- Udev rules dla dostępu do urządzeń

**Dla produkcji:** Skonfiguruj firewall i SSL/TLS.

---

## ✅ **Success Indicators:**

Po instalacji i uruchomieniu powinieneś zobaczyć:

```bash
sudo systemctl status ec25-eux
● ec25-eux.service - EC25-EUX Multi-Modem Management System
   Loaded: loaded (/etc/systemd/system/ec25-eux.service; enabled)
   Active: active (running) since ...
```

```bash
curl http://localhost:3002/api/system/status
{
  "success": true,
  "status": "operational",
  "statistics": {
    "activeModems": 3,
    "allocatedPorts": 3
  }
}
```

**🎉 Gratulacje! System EC25-EUX jest gotowy do pracy!** 🚀
