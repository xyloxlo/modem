// EC25-EUX System Types
export interface Modem {
  serial: string
  usb_id: string
  at_port: string
  qmi_device: string
  proxy_port?: number
  status: 'ready' | 'partial' | 'offline' | 'error' | 'connecting'
  wan_ip?: string
  signal_strength?: number
  operator?: string
  last_seen: string
  created_at: string
  updated_at: string
  
  // Extended properties
  connection_state?: 'connected' | 'disconnected' | 'connecting'
  data_usage?: {
    rx_bytes: number
    tx_bytes: number
    rx_packets: number
    tx_packets: number
  }
  network_info?: {
    network_type: string
    rssi: number
    rsrp?: number
    rsrq?: number
    sinr?: number
  }
}

export interface SystemStatus {
  success: boolean
  status: 'operational' | 'degraded' | 'error'
  statistics: {
    totalDetections: number
    activeModems: number
    allocatedPorts: number
    uptime: number
    lastScan?: string
    averageScanTime?: number
    successRate?: number
  }
  mode: 'database' | 'standalone'
  timestamp: string
}

export interface ModemCommand {
  serial: string
  command: string
  commandInterface: 'AT' | 'QMI'
  response?: string
  success?: boolean
  timestamp: string
  execution_time?: number
}

export interface ModemLog {
  id: number
  modem_serial: string
  command_type: 'AT' | 'QMI' | 'SYSTEM'
  command: string
  response: string
  success: boolean
  execution_time: number
  error_code?: string
  timestamp: string
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  timestamp: string
  mode?: 'database' | 'standalone'
}

// WebSocket Event Types
export interface WebSocketEvent {
  type: 'modem_change' | 'system_status' | 'command_result' | 'log_entry' | 'error'
  event?: any
  data?: any
  timestamp: string
}

export interface ModemChangeEvent {
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
  serial: string
  old_status?: string
  new_status?: string
  status?: string
  proxy_port?: number
  at_port?: string
}

// UI State Types
export interface DashboardState {
  modems: Modem[]
  systemStatus: SystemStatus | null
  selectedModem: string | null
  commandHistory: ModemCommand[]
  logs: ModemLog[]
  filters: {
    status: string[]
    operator: string[]
    search: string
  }
  isConnected: boolean
  lastUpdate: string | null
}

export interface CommandFormData {
  command: string
  interface: 'AT' | 'QMI'
  target: 'single' | 'all'
  selectedModems: string[]
}

// Network Interface Types
export interface NetworkInterface {
  name: string
  type: 'wwan' | 'ethernet' | 'wifi'
  status: 'up' | 'down'
  ip_address?: string
  gateway?: string
  dns?: string[]
  rx_bytes: number
  tx_bytes: number
  modem_serial?: string
}

// 3proxy Configuration Types
export interface ProxyConfig {
  port: number
  modem_serial: string
  interface: string
  auth_required: boolean
  allowed_ips: string[]
  status: 'active' | 'inactive' | 'error'
  connections: number
  bandwidth_limit?: number
}

// Chart Data Types
export interface ChartDataPoint {
  timestamp: string
  value: number
  label?: string
}

export interface SignalStrengthData {
  modem_serial: string
  rssi: number
  rsrp?: number
  rsrq?: number
  sinr?: number
  timestamp: string
}

// Configuration Types
export interface AppConfig {
  api_url: string
  websocket_url: string
  refresh_interval: number
  max_logs: number
  auto_reconnect: boolean
  debug_mode: boolean
}
