'use client'

import { useState, useEffect } from 'react'
import { 
  Radio, 
  Wifi, 
  Activity, 
  RefreshCcw, 
  Terminal,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp
} from 'lucide-react'
import { useWebSocket } from '@/lib/websocket'
import { getModems, getSystemStatus, triggerModemScan, forceCleanupModems } from '@/lib/api'
import { Modem, SystemStatus } from '@/types'
import { ModemCard } from '@/components/ModemCard'
import { CommandPanel } from '@/components/CommandPanel'
import { SystemOverview } from '@/components/SystemOverview'
import { LogsPanel } from '@/components/LogsPanel'

export const Dashboard = () => {
  const { isConnected, lastEvent } = useWebSocket()
  const [modems, setModems] = useState<Modem[]>([])
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedModem, setSelectedModem] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'modems' | 'commands' | 'logs'>('overview')
  const [error, setError] = useState<string | null>(null)

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const [modemsResponse, statusResponse] = await Promise.all([
          getModems(),
          getSystemStatus()
        ])

        if (modemsResponse.success) {
          setModems(modemsResponse.data || [])
        }

        if (statusResponse.success) {
          setSystemStatus(statusResponse.data || null)
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
        setError('Failed to load system data. Please check your connection.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  // Handle WebSocket events
  useEffect(() => {
    if (!lastEvent) return

    switch (lastEvent.type) {
      case 'modem_change':
        // Refresh modems data when changes occur
        refreshModems()
        break
      case 'system_status':
        if (lastEvent.data) {
          setSystemStatus(lastEvent.data)
        }
        break
      case 'error':
        setError(`System error: ${lastEvent.data?.message || 'Unknown error'}`)
        break
    }
  }, [lastEvent])

  const refreshModems = async () => {
    try {
      const response = await getModems()
      if (response.success) {
        setModems(response.data || [])
      }
    } catch (error) {
      console.error('Failed to refresh modems:', error)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([
        refreshModems(),
        getSystemStatus().then(response => {
          if (response.success) {
            setSystemStatus(response.data || null)
          }
        })
      ])
      setError(null)
    } catch (error) {
      console.error('Failed to refresh:', error)
      setError('Failed to refresh data')
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleScanModems = async () => {
    try {
      setIsRefreshing(true)
      const response = await triggerModemScan()
      if (response.success) {
        // Wait a moment then refresh the modems list
        setTimeout(refreshModems, 2000)
      }
    } catch (error) {
      console.error('Failed to trigger scan:', error)
      setError('Failed to trigger modem scan')
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleCleanupModems = async () => {
    try {
      setIsRefreshing(true)
      const response = await forceCleanupModems()
      if (response.success) {
        // Immediately refresh after cleanup
        await refreshModems()
        setError(null)
      }
    } catch (error) {
      console.error('Failed to cleanup modems:', error)
      setError('Failed to cleanup disconnected modems')
    } finally {
      setIsRefreshing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCcw className="w-8 h-8 text-primary-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  const activeModems = modems.filter(m => m.status === 'ready')
  const offlineModems = modems.filter(m => m.status === 'offline' || m.status === 'error')
  const partialModems = modems.filter(m => m.status === 'partial')

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {error && (
        <div className="bg-danger-50 border border-danger-200 rounded-md p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-danger-400" />
            <div className="ml-3">
              <p className="text-sm text-danger-800">{error}</p>
              <button 
                onClick={() => setError(null)}
                className="mt-2 text-sm text-danger-600 hover:text-danger-500 underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">System Dashboard</h2>
          <p className="text-gray-600">
            Manage your EC25-EUX modems and monitor system performance
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleScanModems}
            disabled={isRefreshing}
            className="btn btn-outline"
          >
            <Radio className="w-4 h-4 mr-2" />
            Scan Modems
          </button>
          <button
            onClick={handleCleanupModems}
            disabled={isRefreshing}
            className="btn btn-warning"
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Cleanup
          </button>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="btn btn-primary"
          >
            <RefreshCcw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircle className="h-6 w-6 text-success-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Active Modems</dt>
                <dd className="text-lg font-medium text-gray-900">{activeModems.length}</dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-6 w-6 text-warning-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Partial/Offline</dt>
                <dd className="text-lg font-medium text-gray-900">
                  {partialModems.length + offlineModems.length}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Wifi className={`h-6 w-6 ${isConnected ? 'text-success-600' : 'text-danger-600'}`} />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Connection</dt>
                <dd className={`text-lg font-medium ${isConnected ? 'text-success-600' : 'text-danger-600'}`}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Activity className={`h-6 w-6 ${
                systemStatus?.status === 'operational' ? 'text-success-600' :
                systemStatus?.status === 'degraded' ? 'text-warning-600' :
                'text-danger-600'
              }`} />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">System Status</dt>
                <dd className={`text-lg font-medium capitalize ${
                  systemStatus?.status === 'operational' ? 'text-success-600' :
                  systemStatus?.status === 'degraded' ? 'text-warning-600' :
                  'text-danger-600'
                }`}>
                  {systemStatus?.status || 'Unknown'}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: TrendingUp },
            { id: 'modems', label: 'Modems', icon: Radio },
            { id: 'commands', label: 'Commands', icon: Terminal },
            { id: 'logs', label: 'Logs', icon: Clock },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`
                group inline-flex items-center border-b-2 py-4 px-1 text-sm font-medium
                ${activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }
              `}
            >
              <tab.icon className={`
                -ml-0.5 mr-2 h-5 w-5
                ${activeTab === tab.id
                  ? 'text-primary-500'
                  : 'text-gray-400 group-hover:text-gray-500'
                }
              `} />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <SystemOverview 
            modems={modems}
            systemStatus={systemStatus}
            isConnected={isConnected}
          />
        )}

        {activeTab === 'modems' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {modems.map((modem) => (
                <ModemCard
                  key={modem.serial}
                  modem={modem}
                  isSelected={selectedModem === modem.serial}
                  onSelect={() => setSelectedModem(
                    selectedModem === modem.serial ? null : modem.serial
                  )}
                />
              ))}
            </div>
            {modems.length === 0 && (
              <div className="text-center py-12">
                <Radio className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No modems detected</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Connect your EC25-EUX modems and click scan to detect them.
                </p>
                <div className="mt-6">
                  <button
                    onClick={handleScanModems}
                    disabled={isRefreshing}
                    className="btn btn-primary"
                  >
                    <Radio className="w-4 h-4 mr-2" />
                    Scan for Modems
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'commands' && (
          <CommandPanel 
            modems={modems}
            selectedModem={selectedModem}
            onModemSelect={setSelectedModem}
          />
        )}

        {activeTab === 'logs' && (
          <LogsPanel />
        )}
      </div>
    </div>
  )
}
