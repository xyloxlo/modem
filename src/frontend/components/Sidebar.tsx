'use client'

import { useState, useEffect } from 'react'
import { 
  Home,
  Radio,
  Network,
  Terminal,
  BarChart3,
  Settings,
  LogOut,
  X,
  Activity,
  Wifi,
  AlertTriangle
} from 'lucide-react'
import { useWebSocket } from '@/lib/websocket'
import { getSystemStatus } from '@/lib/api'
import { SystemStatus } from '@/types'

interface SidebarProps {
  open?: boolean
  onClose?: () => void
}

const navigation = [
  { name: 'Dashboard', href: '#', icon: Home, current: true },
  { name: 'Modems', href: '#modems', icon: Radio, current: false },
  { name: 'Network', href: '#network', icon: Network, current: false },
  { name: 'Commands', href: '#commands', icon: Terminal, current: false },
  { name: 'Analytics', href: '#analytics', icon: BarChart3, current: false },
  { name: 'Settings', href: '#settings', icon: Settings, current: false },
]

export const Sidebar: React.FC<SidebarProps> = ({ open = true, onClose }) => {
  const { isConnected, lastEvent } = useWebSocket()
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [activeTab, setActiveTab] = useState('Dashboard')

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await getSystemStatus()
        if (response.success && response.data) {
          setSystemStatus(response.data)
        }
      } catch (error) {
        console.error('Failed to fetch system status:', error)
      }
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  // Update status from WebSocket events
  useEffect(() => {
    if (lastEvent?.type === 'system_status' && lastEvent.data) {
      setSystemStatus(lastEvent.data)
    }
  }, [lastEvent])

  const handleNavClick = (name: string) => {
    setActiveTab(name)
    if (onClose) onClose()
  }

  const sidebarContent = (
    <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 pb-4 ring-1 ring-gray-200">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center">
        <div className="flex items-center space-x-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
            <Radio className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">EC25-EUX</div>
            <div className="text-xs text-gray-500">Management</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          <li>
            <ul role="list" className="-mx-2 space-y-1">
              {navigation.map((item) => (
                <li key={item.name}>
                  <button
                    onClick={() => handleNavClick(item.name)}
                    className={`
                      group flex w-full gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold transition-colors
                      ${activeTab === item.name
                        ? 'bg-primary-50 text-primary-600'
                        : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                      }
                    `}
                  >
                    <item.icon
                      className={`h-6 w-6 shrink-0 ${
                        activeTab === item.name ? 'text-primary-600' : 'text-gray-400 group-hover:text-primary-600'
                      }`}
                      aria-hidden="true"
                    />
                    {item.name}
                  </button>
                </li>
              ))}
            </ul>
          </li>

          {/* System Status Section */}
          <li>
            <div className="text-xs font-semibold leading-6 text-gray-400">System Status</div>
            <div className="mt-2 space-y-3">
              {/* Connection Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Wifi className={`h-4 w-4 ${isConnected ? 'text-success-500' : 'text-danger-500'}`} />
                  <span className="text-sm text-gray-600">WebSocket</span>
                </div>
                <span className={`text-xs font-medium ${
                  isConnected ? 'text-success-600' : 'text-danger-600'
                }`}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              {/* System Health */}
              {systemStatus && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Activity className={`h-4 w-4 ${
                      systemStatus.status === 'operational' ? 'text-success-500' :
                      systemStatus.status === 'degraded' ? 'text-warning-500' :
                      'text-danger-500'
                    }`} />
                    <span className="text-sm text-gray-600">System</span>
                  </div>
                  <span className={`text-xs font-medium capitalize ${
                    systemStatus.status === 'operational' ? 'text-success-600' :
                    systemStatus.status === 'degraded' ? 'text-warning-600' :
                    'text-danger-600'
                  }`}>
                    {systemStatus.status}
                  </span>
                </div>
              )}

              {/* Active Modems */}
              {systemStatus && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Radio className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">Modems</span>
                  </div>
                  <span className="text-xs font-medium text-gray-900">
                    {systemStatus.statistics.activeModems}
                  </span>
                </div>
              )}

              {/* Mode Indicator */}
              {systemStatus && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={`h-4 w-4 rounded-full ${
                      systemStatus.mode === 'database' ? 'bg-success-500' : 'bg-warning-500'
                    }`} />
                    <span className="text-sm text-gray-600">Mode</span>
                  </div>
                  <span className={`text-xs font-medium capitalize ${
                    systemStatus.mode === 'database' ? 'text-success-600' : 'text-warning-600'
                  }`}>
                    {systemStatus.mode}
                  </span>
                </div>
              )}
            </div>
          </li>

          {/* Recent Events */}
          {lastEvent && (
            <li>
              <div className="text-xs font-semibold leading-6 text-gray-400">Recent Event</div>
              <div className="mt-2 p-3 bg-gray-50 rounded-md">
                <div className="flex items-center space-x-2 mb-1">
                  {lastEvent.type === 'modem_change' && <Radio className="h-3 w-3 text-blue-500" />}
                  {lastEvent.type === 'system_status' && <Activity className="h-3 w-3 text-green-500" />}
                  {lastEvent.type === 'error' && <AlertTriangle className="h-3 w-3 text-red-500" />}
                  <span className="text-xs font-medium text-gray-700 capitalize">
                    {lastEvent.type.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(lastEvent.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </li>
          )}

          {/* User section */}
          <li className="mt-auto">
            <button className="group -mx-2 flex w-full gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-gray-700 hover:bg-gray-50 hover:text-primary-600">
              <LogOut className="h-6 w-6 shrink-0 text-gray-400 group-hover:text-primary-600" aria-hidden="true" />
              Logout
            </button>
          </li>
        </ul>
      </nav>
    </div>
  )

  // Mobile sidebar with overlay
  if (onClose) {
    return (
      <>
        {/* Backdrop */}
        {open && (
          <div 
            className="fixed inset-0 z-50 bg-gray-900/80 lg:hidden"
            onClick={onClose}
          />
        )}
        
        {/* Sidebar */}
        <div className={`
          fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out lg:hidden
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="relative">
            {/* Close button */}
            <div className="absolute right-0 top-0 -mr-12 pt-2">
              <button
                type="button"
                className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-white"
                onClick={onClose}
              >
                <span className="sr-only">Close sidebar</span>
                <X className="h-6 w-6 text-white" aria-hidden="true" />
              </button>
            </div>
            {sidebarContent}
          </div>
        </div>
      </>
    )
  }

  // Desktop sidebar
  return (
    <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 pb-4 ring-1 ring-gray-200">
      {sidebarContent}
    </div>
  )
}
