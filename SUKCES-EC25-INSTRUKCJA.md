# 🎉 EC25-EUX KOMUNIKACJA - INSTRUKCJA SUKCESU

## ✅ **CO DZIAŁA:**
- **2 modemy EC25-EUX** połączone przez USB
- **QMI komunikacja** przez /dev/cdc-wdm0 i /dev/cdc-wdm1
- **AT komunikacja** przez /dev/ttyUSB6 (minicom)

## 📱 **MAPOWANIE PORTÓW EC25-EUX:**

### **Modem 1 (Bus 001 Device 003):**
```
/dev/ttyUSB0 = Diagnostics port
/dev/ttyUSB1 = NMEA GPS port  
/dev/ttyUSB2 = AT Commands port (NIE DZIAŁA bezpośrednio)
/dev/ttyUSB3 = Modem port
/dev/cdc-wdm0 = QMI interface ✅ DZIAŁA
```

### **Modem 2 (Bus 001 Device 004):**
```
/dev/ttyUSB4 = Diagnostics port
/dev/ttyUSB5 = NMEA GPS port
/dev/ttyUSB6 = AT Commands port ✅ DZIAŁA z minicom
/dev/ttyUSB7 = Modem port
/dev/cdc-wdm1 = QMI interface
```

## 🔧 **KROKI DO SUKCESU:**

### **1. Sprawdź hardware:**
```bash
lsusb | grep 2c7c:0125                    # 2 modemy EC25
ls -la /dev/ttyUSB*                       # 8 portów serial (0-7)
ls -la /dev/cdc-wdm*                      # 2 urządzenia QMI (0-1)
```

### **2. Test QMI (zawsze działa):**
```bash
sudo qmicli -d /dev/cdc-wdm0 --dms-get-operating-mode
# Wynik: Mode: 'online', HW restricted: 'no'
```

### **3. KLUCZOWE: Zainstaluj brakujące dependencies**
```bash
sudo apt update
sudo apt install -y minicom expect libqmi-glib5 setserial
# Te pakiety są NIEZBĘDNE dla komunikacji AT
# minicom - terminal komunikacji serial
# expect - automatyzacja AT commands  
# setserial - konfiguracja portów
```

### **4. ModemManager może pozostać włączony**
```bash
# ModemManager NIE jest problemem po zainstalowaniu dependencies!
# Może zostać włączony: sudo systemctl start ModemManager
```

### **5. Test AT komunikacji:**
```bash
# DZIAŁA:
sudo minicom -D /dev/ttyUSB6 -b 115200
# W minicom: wpisz "AT", dostaniesz "OK"
# Wyjście: Ctrl+A, potem X

# NIE DZIAŁA (przynajmniej nie echo/cat):
echo "AT" > /dev/ttyUSB2    # timeout, brak odpowiedzi
echo "AT" > /dev/ttyUSB6    # timeout, brak odpowiedzi (bez minicom)
```

## 🎯 **KLUCZOWE ODKRYCIA:**

### **1. Brakujące dependencies = GŁÓWNY PROBLEM**
- Problem NIE był z ModemManager
- Brakowało: minicom, expect, setserial, libqmi-glib5
- Po zainstalowaniu - wszystko działa nawet z ModemManager!

### **2. minicom = KLUCZOWE NARZĘDZIE**
- Standardowe echo/cat NIE DZIAŁAJĄ z AT portami
- minicom z właściwymi ustawieniami DZIAŁA
- Baudrate 115200 jest prawidłowy

### **3. Mapowanie portów:**
- **ttyUSB6** działa lepiej niż ttyUSB2
- Może być różnica w konfiguracji portów między modemami
- QMI zawsze działa (/dev/cdc-wdm0, /dev/cdc-wdm1)

## 🚀 **NASTĘPNE KROKI:**

### **1. Test drugiego modemu:**
```bash
sudo minicom -D /dev/ttyUSB2 -b 115200   # sprawdź pierwszy modem
```

### **2. Node.js integration:**
```bash
cd src/
npm install
sudo node test-modems.js
```

### **3. Automatyzacja:**
- Integracja z Node.js SerialPort
- Automatyczne zatrzymywanie ModemManager
- Queue AT commands z timeout

## 📊 **STATUS KOŃCOWY:**
```
✅ Hardware detection (2x EC25-EUX)
✅ QMI communication (/dev/cdc-wdm0, /dev/cdc-wdm1)  
✅ AT communication (/dev/ttyUSB6 przez minicom)
⏳ Node.js integration
⏳ 3proxy setup
⏳ Multi-modem management
```

## 🔑 **FORMULA SUKCESU:**
```bash
# 1. Zainstaluj KLUCZOWE pakiety
sudo apt update
sudo apt install -y minicom expect libqmi-glib5 setserial

# 2. Użyj minicom do AT komunikacji
sudo minicom -D /dev/ttyUSB6 -b 115200

# 3. W minicom: AT → OK ✅

# 4. ModemManager może zostać włączony (nie przeszkadza!)
sudo systemctl start ModemManager
```

Data utworzenia: $(date)
Konfiguracja: Ubuntu 24.04.3 LTS + 2x EC25-EUX + VirtualBox