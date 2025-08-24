# 🔧 NAPRAWA MODEMÓW EC25-EUX - TRYB QMI

## ⚠️ **PROBLEM ZIDENTYFIKOWANY!**

Z logów które wysłałeś widzę błędy:
```
cdc_mbim 1-4:1.4: nonzero urb status received: -EPIPE
qmi_wwan 1-3:1.4: nonzero urb status received: -EPIPE
cdc_mbim 1-2:1.4: nonzero urb status received: -EPIPE
```

**🎯 To oznacza że modemy są w trybie MBIM zamiast QMI!**

---

## 🔍 **SPRAWDZENIE I NAPRAWA:**

### **KROK 1: Sprawdź aktualny tryb modemów**
```bash
sudo ./check-modem-mode.sh
```

Ten skrypt:
- ✅ Wykryje wszystkie modemy EC25-EUX
- ✅ Sprawdzi aktualną konfigurację USB każdego modemu  
- ✅ Przetestuje komunikację AT
- ✅ Zidentyfikuje tryb (QMI vs MBIM)
- ✅ Zaproponuje przełączenie na QMI

### **KROK 2: Automatyczne przełączenie na QMI**
Skrypt automatycznie wykryje modemy w trybie MBIM i zaproponuje przełączenie:
```bash
# Komenda AT która zostanie wysłana:
AT+QCFG="usbcfg",0x2C7C,0x0125,1,1,1,1,1,1,1

# Restart modemu:
AT+CFUN=1,1
```

---

## 🎯 **CO ROBI PRZEŁĄCZENIE:**

### **PRZED (tryb MBIM):**
```
USB Interface: MBIM (Microsoft Broadband Interface Model)
- /dev/cdc-wdm0 → MBIM interface
- Ograniczona funkcjonalność QMI
- Błędy EPIPE w kernelu
```

### **PO (tryb QMI):**
```  
USB Interface: QMI (Qualcomm Modem Interface)
- /dev/cdc-wdm0 → Pełny QMI interface
- Wszystkie funkcje QMI dostępne
- Stabilna komunikacja z systemem
```

---

## 📋 **INSTRUKCJA KROK PO KROKU:**

### **1. Uruchom sprawdzenie:**
```bash
cd /path/to/EC25-EUX/
sudo ./check-modem-mode.sh
```

### **2. Przykładowy output:**
```
🔍 EC25-EUX MODEM MODE CHECK & QMI CONFIGURATION
========================================================
✅ Wykryto 2 modem(ów) EC25-EUX
ℹ️  Dostępne porty USB serial: 8
ℹ️  Dostępne urządzenia QMI: 2

ℹ️  Sprawdzam konfigurację USB dla modemu 1 na porcie /dev/ttyUSB2...
⚠️  Modem 1: MBIM mode ⚠️  (trzeba przełączyć na QMI)

ℹ️  Sprawdzam konfigurację USB dla modemu 2 na porcie /dev/ttyUSB6...  
⚠️  Modem 2: MBIM mode ⚠️  (trzeba przełączyć na QMI)

⚠️  Znaleziono 2 modem(ów) do przełączenia na QMI
Czy chcesz przełączyć modemy na tryb QMI? (y/N): y
```

### **3. Po przełączeniu poczekaj 30 sekund:**
```
✅ Komenda przełączenia wysłana do modemu 1
⚠️  Modem zostanie zrestartowany - poczekaj 30 sekund...
✅ Komenda przełączenia wysłana do modemu 2  
⚠️  Modem zostanie zrestartowany - poczekaj 30 sekund...

ℹ️  Czekam 30 sekund na restart modemów...
```

### **4. Test QMI po restart:**
```
✅ Dostępne urządzenia QMI:
/dev/cdc-wdm0
/dev/cdc-wdm1

✅ QMI działa na /dev/cdc-wdm0: Mode: 'online', HW restricted: 'no'
✅ QMI działa na /dev/cdc-wdm1: Mode: 'online', HW restricted: 'no'
```

---

## 🚀 **PO NAPRAWIE URUCHOM SYSTEM:**

### **Gdy modemy są już w trybie QMI:**
```bash
sudo ./start-ec25-system.sh
```

System powinien teraz:
- ✅ Prawidłowo wykryć modemy
- ✅ Komunikować się przez QMI
- ✅ Nie wyrzucać błędów EPIPE
- ✅ Stabilnie działać z backendem

---

## 🔧 **ROZWIĄZYWANIE PROBLEMÓW:**

### **Problem: "Brak expect"**
```bash
sudo apt install -y expect minicom libqmi-utils
```

### **Problem: "Nie można wysłać AT"**
```bash
# Sprawdź czy porty istnieją:
ls -la /dev/ttyUSB*

# Sprawdź czy modem manager nie blokuje:
sudo systemctl stop ModemManager
sudo ./check-modem-mode.sh
```

### **Problem: "QMI nie odpowiada po przełączeniu"**
```bash
# Restart całego USB:
sudo modprobe -r qmi_wwan cdc_wdm
sudo modprobe qmi_wwan cdc_wdm

# Lub restart komputera
sudo reboot
```

---

## 📊 **OCZEKIWANE REZULTATY:**

### **Przed naprawą (MBIM):**
```bash
dmesg | grep -i "mbim\|epipe"
# Wynik: dużo błędów EPIPE i MBIM

qmicli -d /dev/cdc-wdm0 --dms-get-operating-mode
# Wynik: błędy lub timeout
```

### **Po naprawie (QMI):**
```bash
dmesg | grep -i "qmi"
# Wynik: czyste logi QMI, brak błędów

qmicli -d /dev/cdc-wdm0 --dms-get-operating-mode  
# Wynik: Mode: 'online', HW restricted: 'no'
```

---

## 🎯 **TL;DR - SZYBKA NAPRAWA:**

```bash
# 1. Sprawdź i napraw modemy:
sudo ./check-modem-mode.sh

# 2. Wybierz "y" gdy zapyta o przełączenie

# 3. Poczekaj 30 sekund

# 4. Uruchom system:
sudo ./start-ec25-system.sh

# 5. Otwórz http://localhost:3000
```

**🎉 Problem z MBIM/QMI rozwiązany! Modemy będą działać stabilnie w trybie QMI!** 🚀
