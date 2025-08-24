'use client'

import { useState, useEffect } from 'react'
import { 
  Menu, 
  Search, 
  Bell, 
  Wifi, 
  WifiOff, 
  Radio,
  Activity,
  RefreshCcw,
  Settings
} from 'lucide-react'
import { useWebSocket } from '@/lib/websocket'
import { getSystemStatus } from '@/lib/api'
import { SystemStatus } from '@/types'

interface HeaderProps {
  onMenuClick: () => void
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { isConnected, reconnectAttempts } = useWebSocket()
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [lastUpdate, setLastUpdate] = useState<string>('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Fetch system status on mount and periodically
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await getSystemStatus()
        if (response.success && response.data) {
          setSystemStatus(response.data)
          setLastUpdate(new Date().toLocaleTimeString())
        }
      } catch (error) {
        console.error('Failed to fetch system status:', error)
      }
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 30000) // Update every 30 seconds

    return () => clearInterval(interval)
  }, [])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      const response = await getSystemStatus()
      if (response.success && response.data) {
        setSystemStatus(response.data)
        setLastUpdate(new Date().toLocaleTimeString())
      }
    } catch (error) {
      console.error('Failed to refresh status:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const formatUptime = (uptimeMs: number) => {
    const hours = Math.floor(uptimeMs / (1000 * 60 * 60))
    const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  return (
    <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      {/* Mobile menu button */}
      <button
        type="button"
        className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
        onClick={onMenuClick}
      >
        <span className="sr-only">Open sidebar</span>
        <Menu className="h-6 w-6" aria-hidden="true" />
      </button>

      {/* Separator */}
      <div className="h-6 w-px bg-gray-200 lg:hidden" aria-hidden="true" />

      <div className="flex flex-1 items-center justify-between">
        {/* Left side - Title and status */}
        <div className="flex items-center space-x-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              Multi-Modem Dashboard
            </h1>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              {systemStatus && (
                <>
                  <span>{systemStatus.statistics.activeModems} modems</span>
                  <span>•</span>
                  <span>Uptime: {formatUptime(systemStatus.statistics.uptime)}</span>
                  <span>•</span>
                  <span className={`capitalize ${
                    systemStatus.mode === 'database' ? 'text-success-600' : 'text-warning-600'
                  }`}>
                    {systemStatus.mode}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right side - Status indicators and controls */}
        <div className="flex items-center space-x-4">
          {/* WebSocket Connection Status */}
          <div className="flex items-center space-x-2">
            {isConnected ? (
              <div className="flex items-center space-x-1 text-success-600">
                <Wifi className="h-4 w-4" />
                <span className="text-sm font-medium hidden sm:inline">Connected</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1 text-danger-600">
                <WifiOff className="h-4 w-4" />
                <span className="text-sm font-medium hidden sm:inline">
                  Disconnected {reconnectAttempts > 0 && `(${reconnectAttempts})`}
                </span>
              </div>
            )}
          </div>

          {/* System Status Indicator */}
          {systemStatus && (
            <div className="flex items-center space-x-1">
              <Activity className={`h-4 w-4 ${
                systemStatus.status === 'operational' ? 'text-success-600' :
                systemStatus.status === 'degraded' ? 'text-warning-600' :
                'text-danger-600'
              }`} />
              <span className={`text-sm font-medium hidden sm:inline capitalize ${
                systemStatus.status === 'operational' ? 'text-success-600' :
                systemStatus.status === 'degraded' ? 'text-warning-600' :
                'text-danger-600'
              }`}>
                {systemStatus.status}
              </span>
            </div>
          )}

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            title="Refresh system status"
          >
            <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* Notifications */}
          <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors relative">
            <Bell className="h-5 w-5" />
            {/* Notification badge */}
            <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-danger-400 ring-2 ring-white" />
          </button>

          {/* Settings */}
          <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
            <Settings className="h-5 w-5" />
          </button>

          {/* Last Update */}
          {lastUpdate && (
            <div className="hidden lg:flex flex-col items-end text-xs text-gray-500">
              <span>Last update</span>
              <span>{lastUpdate}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
