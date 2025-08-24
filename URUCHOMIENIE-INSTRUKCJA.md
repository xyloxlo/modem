# 🚀 EC25-EUX - INSTRUKCJA URUCHOMIENIA

## ⚡ Jedna komenda = gotowy system!

**Naprawiłem wszystkie problemy z portami i stworzyłem prosty skrypt uruchomieniowy!**

---

## 🎯 **SZYBKIE URUCHOMIENIE**

### **Windows (obecny system):**
```bash
# Przejdź do katalogu projektu
cd src/

# Uruchom backend i frontend jednocześnie
npm run dev:all
```

### **Linux Ubuntu Server:**
```bash
# Jedna komenda uruchamia WSZYSTKO
sudo ./start-ec25-system.sh

# Aby zatrzymać
sudo ./stop-ec25-system.sh
```

---

## 🔧 **CO ZOSTAŁO NAPRAWIONE:**

### ✅ **Porty:**
- **Frontend:** `http://localhost:3000` (React/Next.js)
- **Backend API:** `http://localhost:3002/api` (Node.js/Express)
- **WebSocket:** `ws://localhost:3002` (Socket.IO)
- **Port 3001** dodany do listy zastrzeżonych (nie będzie używany)

### ✅ **Połączenia:**
- Frontend ➡️ Backend API: `http://localhost:3002/api` ✅
- Frontend ➡️ WebSocket: `ws://localhost:3002` ✅
- CORS Origin: `http://localhost:3000` (frontend) ✅
- Socket.IO zamiast raw WebSocket ✅

### ✅ **Dokumentacja:**
- Wszystkie pliki README/docs zaktualizowane
- Konfiguracje Next.js naprawione
- systemd services gotowe

---

## 🌐 **DOSTĘP PO URUCHOMIENIU:**

```
🎯 Web Interface:    http://localhost:3000
🔌 Backend API:      http://localhost:3002/api
📊 Modems API:       http://localhost:3002/api/modems
🔍 System Status:    http://localhost:3002/api/system/status
📡 WebSocket:        ws://localhost:3002
```

---

## 📋 **SPRAWDZENIE DZIAŁANIA:**

### 1. **Test Backend API:**
```bash
curl http://localhost:3002/api/system/status
```

### 2. **Test Frontend:**
```bash
# Otwórz w przeglądarce
http://localhost:3000
```

### 3. **Test WebSocket (w konsoli przeglądarki):**
```javascript
const socket = io('ws://localhost:3002');
socket.on('connect', () => console.log('WebSocket OK!'));
```

---

## 🐛 **ROZWIĄZANIE PROBLEMÓW:**

### **Port zajęty (EADDRINUSE):**
```bash
# Windows
netstat -ano | findstr ":3002"
taskkill /PID [PID_NUMBER] /F

# Linux
sudo ./stop-ec25-system.sh
sudo ./start-ec25-system.sh
```

### **Frontend nie łączy się z backend:**
1. Sprawdź czy backend działa: `curl http://localhost:3002/api/system/status`
2. Sprawdź CORS w konsoli przeglądarki
3. Sprawdź WebSocket w Network tab

### **Brak modemów:**
```bash
# Sprawdź hardware
lsusb | grep 2c7c:0125
ls /dev/ttyUSB*
ls /dev/cdc-wdm*
```

---

## 📁 **STRUKTURA PLIKÓW:**

```
EC25-EUX/
├── start-ec25-system.sh      # 🚀 GŁÓWNY SKRYPT URUCHOMIENIA
├── stop-ec25-system.sh       # 🛑 Zatrzymanie systemu
├── src/
│   ├── modem-system.js        # Backend (port 3002)
│   ├── package.json           # npm run dev:all
│   └── frontend/              # Frontend (port 3000)
│       ├── lib/api.ts         # API client (→ 3002)
│       └── lib/websocket.tsx  # WebSocket (→ 3002)
└── logs/                      # Logi systemowe
```

---

## 🎯 **NASTĘPNE KROKI:**

Po uruchomieniu możesz przejść do implementacji:
1. **3proxy integration** - kluczowa funkcjonalność proxy
2. **AT/QMI commands** - pełna kontrola modemów
3. **Network management** - routing i interfejsy
4. **Performance monitoring** - alerty i statystyki

---

## 🏆 **GOTOWE FUNKCJE:**

✅ **Automatic PostgreSQL** - Auto-install lub standalone mode  
✅ **Real-time WebSocket** - Socket.IO z live updates  
✅ **Modem Detection** - Wzór portów `AT_Port = 2 + (Modem_Number - 1) × 4`  
✅ **Web Dashboard** - React/Next.js interface  
✅ **systemd Auto-start** - Boot z systemem Linux  
✅ **Hot-plug Support** - Automatyczne wykrywanie USB  
✅ **Error Recovery** - Graceful degradation  

---

## 🚀 **UŻYCIE:**

```bash
# WINDOWS (rozwój):
cd src && npm run dev:all

# LINUX (produkcja):
sudo ./start-ec25-system.sh prod

# LINUX (rozwój z auto-restart):
sudo ./start-ec25-system.sh
```

**🎉 System gotowy do działania! Wszystko automatyczne, wszystko połączone!** 🚀
