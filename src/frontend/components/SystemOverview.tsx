'use client'

import { 
  Activity, 
  Radio, 
  Wifi, 
  Database,
  Clock,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  XCircle
} from 'lucide-react'
import { Modem, SystemStatus } from '@/types'

interface SystemOverviewProps {
  modems: Modem[]
  systemStatus: SystemStatus | null
  isConnected: boolean
}

export const SystemOverview: React.FC<SystemOverviewProps> = ({ 
  modems, 
  systemStatus, 
  isConnected 
}) => {
  const activeModems = modems.filter(m => m.status === 'ready')
  const partialModems = modems.filter(m => m.status === 'partial')
  const offlineModems = modems.filter(m => m.status === 'offline' || m.status === 'error')

  const formatUptime = (uptimeMs: number) => {
    const hours = Math.floor(uptimeMs / (1000 * 60 * 60))
    const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((uptimeMs % (1000 * 60)) / 1000)
    
    if (hours > 0) return `${hours}h ${minutes}m`
    if (minutes > 0) return `${minutes}m ${seconds}s`
    return `${seconds}s`
  }

  const getSystemHealthScore = () => {
    const total = modems.length
    if (total === 0) return 0
    const healthy = activeModems.length
    return Math.round((healthy / total) * 100)
  }

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-success-600'
    if (score >= 60) return 'text-warning-600'
    return 'text-danger-600'
  }

  return (
    <div className="space-y-6">
      {/* System Health Summary */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900">System Health</h3>
          <div className="flex items-center space-x-2">
            <Activity className={`h-5 w-5 ${
              systemStatus?.status === 'operational' ? 'text-success-500' :
              systemStatus?.status === 'degraded' ? 'text-warning-500' :
              'text-danger-500'
            }`} />
            <span className={`text-sm font-medium capitalize ${
              systemStatus?.status === 'operational' ? 'text-success-600' :
              systemStatus?.status === 'degraded' ? 'text-warning-600' :
              'text-danger-600'
            }`}>
              {systemStatus?.status || 'Unknown'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Health Score */}
          <div className="text-center">
            <div className={`text-3xl font-bold ${getHealthColor(getSystemHealthScore())}`}>
              {getSystemHealthScore()}%
            </div>
            <p className="text-sm text-gray-600 mt-1">System Health</p>
            <p className="text-xs text-gray-500 mt-1">
              {activeModems.length} of {modems.length} modems active
            </p>
          </div>

          {/* Uptime */}
          <div className="text-center">
            <div className="text-3xl font-bold text-primary-600">
              {systemStatus ? formatUptime(systemStatus.statistics.uptime) : '--'}
            </div>
            <p className="text-sm text-gray-600 mt-1">System Uptime</p>
            <p className="text-xs text-gray-500 mt-1">
              Since last restart
            </p>
          </div>

          {/* Success Rate */}
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">
              {systemStatus?.statistics.successRate || 0}%
            </div>
            <p className="text-sm text-gray-600 mt-1">Detection Rate</p>
            <p className="text-xs text-gray-500 mt-1">
              {systemStatus?.statistics.totalDetections || 0} total scans
            </p>
          </div>
        </div>
      </div>

      {/* Modem Status Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircle className="h-8 w-8 text-success-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Active Modems
                </dt>
                <dd className="flex items-baseline">
                  <div className="text-2xl font-semibold text-gray-900">
                    {activeModems.length}
                  </div>
                  <div className="ml-2 flex items-baseline text-sm text-success-600">
                    <span className="sr-only">Ready modems</span>
                    Ready
                  </div>
                </dd>
              </dl>
            </div>
          </div>
          {activeModems.length > 0 && (
            <div className="mt-4">
              <div className="text-xs text-gray-500 space-y-1">
                {activeModems.slice(0, 3).map(modem => (
                  <div key={modem.serial} className="flex justify-between">
                    <span>{modem.serial.replace('EC25_', 'Modem ')}</span>
                    {modem.proxy_port && (
                      <span className="font-mono">:{modem.proxy_port}</span>
                    )}
                  </div>
                ))}
                {activeModems.length > 3 && (
                  <div className="text-center">+{activeModems.length - 3} more</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-8 w-8 text-warning-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Partial Modems
                </dt>
                <dd className="flex items-baseline">
                  <div className="text-2xl font-semibold text-gray-900">
                    {partialModems.length}
                  </div>
                  <div className="ml-2 flex items-baseline text-sm text-warning-600">
                    <span className="sr-only">Partial modems</span>
                    Issues
                  </div>
                </dd>
              </dl>
            </div>
          </div>
          {partialModems.length > 0 && (
            <div className="mt-4">
              <div className="text-xs text-gray-500 space-y-1">
                {partialModems.slice(0, 3).map(modem => (
                  <div key={modem.serial} className="flex justify-between">
                    <span>{modem.serial.replace('EC25_', 'Modem ')}</span>
                    <span className="text-warning-600">Partial</span>
                  </div>
                ))}
                {partialModems.length > 3 && (
                  <div className="text-center">+{partialModems.length - 3} more</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <XCircle className="h-8 w-8 text-danger-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Offline Modems
                </dt>
                <dd className="flex items-baseline">
                  <div className="text-2xl font-semibold text-gray-900">
                    {offlineModems.length}
                  </div>
                  <div className="ml-2 flex items-baseline text-sm text-danger-600">
                    <span className="sr-only">Offline modems</span>
                    Offline
                  </div>
                </dd>
              </dl>
            </div>
          </div>
          {offlineModems.length > 0 && (
            <div className="mt-4">
              <div className="text-xs text-gray-500 space-y-1">
                {offlineModems.slice(0, 3).map(modem => (
                  <div key={modem.serial} className="flex justify-between">
                    <span>{modem.serial.replace('EC25_', 'Modem ')}</span>
                    <span className="text-danger-600">
                      {modem.status === 'error' ? 'Error' : 'Offline'}
                    </span>
                  </div>
                ))}
                {offlineModems.length > 3 && (
                  <div className="text-center">+{offlineModems.length - 3} more</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* System Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connection Status */}
        <div className="card p-6">
          <h4 className="text-sm font-medium text-gray-900 mb-4">Connection Status</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Wifi className={`h-4 w-4 ${isConnected ? 'text-success-500' : 'text-danger-500'}`} />
                <span className="text-sm text-gray-600">WebSocket</span>
              </div>
              <span className={`text-sm font-medium ${
                isConnected ? 'text-success-600' : 'text-danger-600'
              }`}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Database className={`h-4 w-4 ${
                  systemStatus?.mode === 'database' ? 'text-success-500' : 'text-warning-500'
                }`} />
                <span className="text-sm text-gray-600">Database</span>
              </div>
              <span className={`text-sm font-medium capitalize ${
                systemStatus?.mode === 'database' ? 'text-success-600' : 'text-warning-600'
              }`}>
                {systemStatus?.mode || 'Unknown'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Radio className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-gray-600">Detection System</span>
              </div>
              <span className="text-sm font-medium text-success-600">
                Active
              </span>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="card p-6">
          <h4 className="text-sm font-medium text-gray-900 mb-4">Performance Metrics</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Avg Scan Time</span>
              <span className="text-sm font-medium text-gray-900">
                {systemStatus?.statistics.averageScanTime || '--'}ms
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Detections</span>
              <span className="text-sm font-medium text-gray-900">
                {systemStatus?.statistics.totalDetections || 0}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Allocated Ports</span>
              <span className="text-sm font-medium text-gray-900">
                {systemStatus?.statistics.allocatedPorts || 0}
              </span>
            </div>

            {systemStatus?.statistics.lastScan && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Last Scan</span>
                <span className="text-sm font-medium text-gray-900">
                  {new Date(systemStatus.statistics.lastScan).toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-6">
        <h4 className="text-sm font-medium text-gray-900 mb-4">Quick Actions</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="btn btn-outline text-sm">
            <Radio className="w-4 h-4 mr-2" />
            Scan All
          </button>
          <button className="btn btn-outline text-sm">
            <Activity className="w-4 h-4 mr-2" />
            Health Check
          </button>
          <button className="btn btn-outline text-sm">
            <TrendingUp className="w-4 h-4 mr-2" />
            View Analytics
          </button>
          <button className="btn btn-outline text-sm">
            <Clock className="w-4 h-4 mr-2" />
            Export Logs
          </button>
        </div>
      </div>
    </div>
  )
}
