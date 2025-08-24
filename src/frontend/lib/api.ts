import axios from 'axios'
import { Modem, SystemStatus, ModemCommand, ApiResponse } from '@/types'

// API Client Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api'

// Debug logging
console.log('🔗 API_BASE_URL:', API_BASE_URL)

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for logging
apiClient.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`)
    return config
  },
  (error) => {
    console.error('API Request Error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    console.error('API Response Error:', error.response?.data || error.message)
    
    // Handle specific error cases
    if (error.response?.status === 401) {
      // Handle unauthorized access
      console.warn('Unauthorized access - redirect to login')
    } else if (error.response?.status >= 500) {
      // Handle server errors
      console.error('Server error - system may be unavailable')
    }
    
    return Promise.reject(error)
  }
)

// API Functions

/**
 * Get all modems with current status
 */
export const getModems = async (): Promise<ApiResponse<Modem[]>> => {
  try {
    const response = await apiClient.get('/modems')
    return response.data
  } catch (error) {
    throw new Error(`Failed to fetch modems: ${error}`)
  }
}

/**
 * Get system status and statistics
 */
export const getSystemStatus = async (): Promise<ApiResponse<SystemStatus>> => {
  try {
    const response = await apiClient.get('/system/status')
    return response.data
  } catch (error) {
    throw new Error(`Failed to fetch system status: ${error}`)
  }
}

/**
 * Trigger manual modem detection scan
 */
export const triggerModemScan = async (): Promise<ApiResponse> => {
  try {
    const response = await apiClient.post('/modems/scan')
    return response.data
  } catch (error) {
    throw new Error(`Failed to trigger modem scan: ${error}`)
  }
}

/**
 * Execute command on specific modem
 */
export const executeModemCommand = async (
  serial: string,
  command: string,
  commandInterface: 'AT' | 'QMI' = 'AT'
): Promise<ApiResponse<ModemCommand>> => {
  try {
    const response = await apiClient.post(`/modems/${serial}/command`, {
      command,
      commandInterface,
    })
    return response.data
  } catch (error) {
    throw new Error(`Failed to execute command: ${error}`)
  }
}

/**
 * Execute command on multiple modems
 */
export const executeMultiModemCommand = async (
  serials: string[],
  command: string,
  commandInterface: 'AT' | 'QMI' = 'AT'
): Promise<ApiResponse<ModemCommand[]>> => {
  try {
    const promises = serials.map(serial => 
      executeModemCommand(serial, command, commandInterface)
    )
    const results = await Promise.allSettled(promises)
    
    const successful = results
      .filter((result): result is PromiseFulfilledResult<ApiResponse<ModemCommand>> => 
        result.status === 'fulfilled'
      )
      .map(result => result.value.data!)
    
    const failed = results
      .filter((result): result is PromiseRejectedResult => 
        result.status === 'rejected'
      )
      .map(result => result.reason)
    
    if (failed.length > 0) {
      console.warn('Some commands failed:', failed)
    }
    
    return {
      success: successful.length > 0,
      data: successful,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    throw new Error(`Failed to execute multi-modem command: ${error}`)
  }
}

/**
 * Restart specific modem
 */
export const restartModem = async (serial: string): Promise<ApiResponse> => {
  try {
    // Send AT command to restart modem
    const response = await executeModemCommand(serial, 'AT+CFUN=1,1', 'AT')
    return response
  } catch (error) {
    throw new Error(`Failed to restart modem: ${error}`)
  }
}

/**
 * Get modem signal strength
 */
export const getModemSignalStrength = async (serial: string): Promise<ApiResponse> => {
  try {
    const response = await executeModemCommand(serial, 'AT+CSQ', 'AT')
    return response
  } catch (error) {
    throw new Error(`Failed to get signal strength: ${error}`)
  }
}

/**
 * Get modem network info
 */
export const getModemNetworkInfo = async (serial: string): Promise<ApiResponse> => {
  try {
    const response = await executeModemCommand(serial, 'AT+COPS?', 'AT')
    return response
  } catch (error) {
    throw new Error(`Failed to get network info: ${error}`)
  }
}

/**
 * Get modem IP address via QMI
 */
export const getModemIPAddress = async (serial: string): Promise<ApiResponse> => {
  try {
    // This would need the QMI device path, which we can get from modem data
    const response = await executeModemCommand(serial, '--wds-get-current-settings', 'QMI')
    return response
  } catch (error) {
    throw new Error(`Failed to get IP address: ${error}`)
  }
}

/**
 * Health check - ping the API
 */
export const healthCheck = async (): Promise<boolean> => {
  try {
    const response = await apiClient.get('/system/status')
    return response.status === 200
  } catch (error) {
    return false
  }
}

/**
 * Get API client instance for custom requests
 */
export const getApiClient = () => apiClient

export default {
  getModems,
  getSystemStatus,
  triggerModemScan,
  executeModemCommand,
  executeMultiModemCommand,
  restartModem,
  getModemSignalStrength,
  getModemNetworkInfo,
  getModemIPAddress,
  healthCheck,
  getApiClient,
}
