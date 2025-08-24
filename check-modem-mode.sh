#!/bin/bash

# 🔍 EC25-EUX Modem Mode Check & QMI/MBIM Switch Script
# Sprawdza aktualny tryb USB modemu i przełącza na QMI jeśli potrzeba

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_header() {
    echo -e "${BLUE}"
    echo "========================================================"
    echo "🔍 EC25-EUX MODEM MODE CHECK & QMI CONFIGURATION"
    echo "========================================================"
    echo -e "${NC}"
}

# Check if running as root
check_permissions() {
    if [[ $EUID -ne 0 ]]; then
        print_error "Ten skrypt musi być uruchamiany jako root (sudo)"
        print_info "Użyj: sudo ./check-modem-mode.sh"
        exit 1
    fi
}

# Detect modems
detect_modems() {
    print_info "Wykrywam modemy EC25-EUX..."
    
    # Check USB devices
    local usb_modems=$(lsusb | grep "2c7c:0125" | wc -l)
    if [[ $usb_modems -eq 0 ]]; then
        print_error "Nie wykryto modemów EC25-EUX (2c7c:0125)"
        print_info "Sprawdź połączenia USB i uruchom ponownie"
        exit 1
    fi
    
    print_status "Wykryto $usb_modems modem(ów) EC25-EUX"
    
    # Check serial ports
    local usb_ports=$(ls /dev/ttyUSB* 2>/dev/null | wc -l || echo "0")
    print_info "Dostępne porty USB serial: $usb_ports"
    
    # Check QMI devices
    local qmi_devices=$(ls /dev/cdc-wdm* 2>/dev/null | wc -l || echo "0")
    print_info "Dostępne urządzenia QMI: $qmi_devices"
    
    # Check MBIM devices  
    local mbim_devices=$(ls /dev/cdc-wdm* 2>/dev/null | wc -l || echo "0")
    print_info "Dostępne urządzenia MBIM/CDC: $mbim_devices"
    
    echo ""
}

# Check current USB configuration via AT commands
check_usb_config() {
    local modem_num=$1
    local at_port="/dev/ttyUSB$((2 + (modem_num - 1) * 4))"
    
    print_info "Sprawdzam konfigurację USB dla modemu $modem_num na porcie $at_port..."
    
    if [[ ! -e "$at_port" ]]; then
        print_error "Port $at_port nie istnieje!"
        return 1
    fi
    
    # Test basic AT communication first
    print_info "Test komunikacji AT..."
    
    # Simple AT test using echo and timeout
    timeout 3 bash -c "echo 'AT' > $at_port" 2>/dev/null || {
        print_warning "Nie można wysłać AT przez echo, próbuję minicom..."
        
        # Try with expect if available
        if command -v expect &> /dev/null; then
            print_info "Używam expect do komunikacji AT..."
            local at_result=$(expect -c "
                spawn minicom -D $at_port -b 115200
                set timeout 5
                send \"AT\r\"
                expect \"OK\"
                send \"\x01\"
                send \"x\"
                exit
            " 2>/dev/null | grep -o "OK" || echo "")
            
            if [[ "$at_result" == "OK" ]]; then
                print_status "Komunikacja AT działa"
            else
                print_warning "Problemy z komunikacją AT na $at_port"
                return 1
            fi
        else
            print_warning "Brak expect - nie można przetestować komunikacji AT"
            print_info "Zainstaluj: sudo apt install -y expect"
            return 1
        fi
    }
    
    # Check USB configuration
    print_info "Sprawdzam aktualną konfigurację USB..."
    
    if command -v expect &> /dev/null; then
        local usb_config=$(expect -c "
            spawn minicom -D $at_port -b 115200
            set timeout 10
            send \"AT+QCFG=\\\"usbcfg\\\"\r\"
            expect -re \"\\+QCFG: \\\"usbcfg\\\",(.*)\"
            set config \$expect_out(1,string)
            send \"\x01\"
            send \"x\"
            puts \$config
            exit
        " 2>/dev/null | tail -1 | tr -d '\r\n' || echo "unknown")
        
        print_info "Konfiguracja USB: $usb_config"
        
        # Analyze configuration
        if [[ "$usb_config" =~ "0x2C7C,0x0125,1,1,1,1,1,1,1" ]]; then
            print_status "Modem $modem_num: QMI mode ✅"
            return 0
        elif [[ "$usb_config" =~ "mbim" ]] || [[ "$usb_config" =~ "MBIM" ]]; then
            print_warning "Modem $modem_num: MBIM mode ⚠️  (trzeba przełączyć na QMI)"
            return 2
        else
            print_warning "Modem $modem_num: Nieznany tryb USB: $usb_config"
            return 3
        fi
    else
        print_error "Brak expect - nie można sprawdzić konfiguracji USB"
        return 1
    fi
}

# Switch modem to QMI mode
switch_to_qmi() {
    local modem_num=$1
    local at_port="/dev/ttyUSB$((2 + (modem_num - 1) * 4))"
    
    print_warning "Przełączam modem $modem_num na tryb QMI..."
    
    if command -v expect &> /dev/null; then
        expect -c "
            spawn minicom -D $at_port -b 115200
            set timeout 10
            
            # Switch to QMI mode
            send \"AT+QCFG=\\\"usbcfg\\\",0x2C7C,0x0125,1,1,1,1,1,1,1\r\"
            expect \"OK\"
            
            # Reboot modem to apply changes
            send \"AT+CFUN=1,1\r\"
            expect \"OK\"
            
            send \"\x01\"
            send \"x\"
            exit
        " 2>/dev/null
        
        print_status "Komenda przełączenia wysłana do modemu $modem_num"
        print_warning "Modem zostanie zrestartowany - poczekaj 30 sekund..."
        
        return 0
    else
        print_error "Brak expect - nie można przełączyć trybu"
        return 1
    fi
}

# Test QMI functionality
test_qmi() {
    print_info "Testuję funkcjonalność QMI..."
    
    # Wait for devices to stabilize
    sleep 5
    
    local qmi_devices=$(ls /dev/cdc-wdm* 2>/dev/null || echo "")
    
    if [[ -z "$qmi_devices" ]]; then
        print_error "Brak urządzeń QMI po przełączeniu"
        return 1
    fi
    
    print_status "Dostępne urządzenia QMI:"
    ls -la /dev/cdc-wdm* 2>/dev/null || true
    
    # Test QMI communication if qmicli is available
    if command -v qmicli &> /dev/null; then
        print_info "Testuję komunikację QMI..."
        
        for device in /dev/cdc-wdm*; do
            local result=$(timeout 10 qmicli -d "$device" --dms-get-operating-mode 2>/dev/null | grep "Mode:" || echo "")
            if [[ -n "$result" ]]; then
                print_status "QMI działa na $device: $result"
            else
                print_warning "QMI nie odpowiada na $device"
            fi
        done
    else
        print_warning "qmicli nie jest zainstalowany - nie można przetestować QMI"
        print_info "Zainstaluj: sudo apt install -y libqmi-utils"
    fi
}

# Main execution
main() {
    print_header
    
    check_permissions
    detect_modems
    
    echo ""
    print_info "Sprawdzam konfigurację każdego modemu..."
    
    local modems_to_switch=()
    local total_modems=$(lsusb | grep "2c7c:0125" | wc -l)
    
    # Check each modem
    for ((i=1; i<=total_modems; i++)); do
        echo ""
        check_usb_config $i
        local result=$?
        
        case $result in
            0)
                print_status "Modem $i: QMI mode OK ✅"
                ;;
            2)
                print_warning "Modem $i: Wymaga przełączenia na QMI"
                modems_to_switch+=($i)
                ;;
            *)
                print_error "Modem $i: Problem z konfiguracją"
                ;;
        esac
    done
    
    # Switch modems if needed
    if [[ ${#modems_to_switch[@]} -gt 0 ]]; then
        echo ""
        print_warning "Znaleziono ${#modems_to_switch[@]} modem(ów) do przełączenia na QMI"
        
        read -p "Czy chcesz przełączyć modemy na tryb QMI? (y/N): " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            for modem in "${modems_to_switch[@]}"; do
                echo ""
                switch_to_qmi $modem
            done
            
            echo ""
            print_info "Czekam 30 sekund na restart modemów..."
            sleep 30
            
            # Re-detect after restart
            echo ""
            detect_modems
            test_qmi
        else
            print_info "Przełączenie anulowane"
        fi
    else
        print_status "Wszystkie modemy są już w trybie QMI ✅"
        test_qmi
    fi
    
    echo ""
    print_status "Sprawdzenie zakończone!"
    
    # Final summary
    echo ""
    print_info "PODSUMOWANIE:"
    echo "  • Modemy EC25-EUX: $(lsusb | grep "2c7c:0125" | wc -l)"
    echo "  • Porty serial: $(ls /dev/ttyUSB* 2>/dev/null | wc -l || echo "0")"
    echo "  • Urządzenia QMI: $(ls /dev/cdc-wdm* 2>/dev/null | wc -l || echo "0")"
    echo ""
    print_info "Następny krok: uruchom system EC25-EUX"
    print_info "Komenda: sudo ./start-ec25-system.sh"
}

# Script entry point
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
