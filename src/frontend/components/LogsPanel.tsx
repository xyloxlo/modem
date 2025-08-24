'use client'

import { useState, useEffect } from 'react'
import { 
  FileText, 
  Filter, 
  Download, 
  RefreshCcw,
  Search,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Radio,
  Activity
} from 'lucide-react'
import { useWebSocket } from '@/lib/websocket'

interface LogEntry {
  id: string
  timestamp: string
  level: 'info' | 'warning' | 'error' | 'debug'
  type: 'SYSTEM' | 'MODEM' | 'COMMAND' | 'NETWORK'
  modem_serial?: string
  message: string
  details?: any
}

export const LogsPanel = () => {
  const { lastEvent } = useWebSocket()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [filters, setFilters] = useState({
    level: 'all',
    type: 'all',
    modem: 'all',
    search: '',
    timeRange: '1h'
  })
  const [isAutoScroll, setIsAutoScroll] = useState(true)

  // Generate sample logs for demonstration
  useEffect(() => {
    const generateSampleLogs = () => {
      const sampleLogs: LogEntry[] = [
        {
          id: '1',
          timestamp: new Date(Date.now() - 60000).toISOString(),
          level: 'info',
          type: 'SYSTEM',
          message: 'System initialization completed successfully',
          details: { uptime: '1h 23m', modems: 3 }
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 120000).toISOString(),
          level: 'info',
          type: 'MODEM',
          modem_serial: 'EC25_1_1_5',
          message: 'Modem detection completed - status: ready',
          details: { at_port: '/dev/ttyUSB2', qmi_device: '/dev/cdc-wdm0' }
        },
        {
          id: '3',
          timestamp: new Date(Date.now() - 180000).toISOString(),
          level: 'info',
          type: 'COMMAND',
          modem_serial: 'EC25_2_1_6',
          message: 'AT command executed successfully: AT+CSQ',
          details: { response: '+CSQ: 18,99', execution_time: 234 }
        },
        {
          id: '4',
          timestamp: new Date(Date.now() - 240000).toISOString(),
          level: 'warning',
          type: 'MODEM',
          modem_serial: 'EC25_3_1_7',
          message: 'Modem signal strength low',
          details: { rssi: 8, threshold: 15 }
        },
        {
          id: '5',
          timestamp: new Date(Date.now() - 300000).toISOString(),
          level: 'error',
          type: 'NETWORK',
          message: 'QMI device access failed',
          details: { device: '/dev/cdc-wdm2', error: 'Device is closed' }
        }
      ]
      setLogs(sampleLogs)
    }

    generateSampleLogs()
  }, [])

  // Add new logs from WebSocket events
  useEffect(() => {
    if (!lastEvent) return

    const newLog: LogEntry = {
      id: Date.now().toString(),
      timestamp: lastEvent.timestamp,
      level: lastEvent.type === 'error' ? 'error' : 'info',
      type: lastEvent.type === 'modem_change' ? 'MODEM' : 'SYSTEM',
      message: `WebSocket event: ${lastEvent.type}`,
      details: lastEvent.data || lastEvent.event
    }

    setLogs(prev => [newLog, ...prev.slice(0, 999)]) // Keep last 1000 logs
  }, [lastEvent])

  // Apply filters
  useEffect(() => {
    let filtered = [...logs]

    // Level filter
    if (filters.level !== 'all') {
      filtered = filtered.filter(log => log.level === filters.level)
    }

    // Type filter
    if (filters.type !== 'all') {
      filtered = filtered.filter(log => log.type === filters.type)
    }

    // Modem filter
    if (filters.modem !== 'all') {
      filtered = filtered.filter(log => log.modem_serial === filters.modem)
    }

    // Search filter
    if (filters.search) {
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(filters.search.toLowerCase()) ||
        log.modem_serial?.toLowerCase().includes(filters.search.toLowerCase())
      )
    }

    // Time range filter
    const timeRangeMs = {
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    }[filters.timeRange] || 60 * 60 * 1000

    const cutoffTime = new Date(Date.now() - timeRangeMs)
    filtered = filtered.filter(log => new Date(log.timestamp) > cutoffTime)

    setFilteredLogs(filtered)
  }, [logs, filters])

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-danger-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-warning-500" />
      case 'info':
        return <CheckCircle className="h-4 w-4 text-success-500" />
      case 'debug':
        return <Activity className="h-4 w-4 text-gray-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'MODEM':
        return <Radio className="h-4 w-4 text-blue-500" />
      case 'SYSTEM':
        return <Activity className="h-4 w-4 text-green-500" />
      case 'COMMAND':
        return <FileText className="h-4 w-4 text-purple-500" />
      case 'NETWORK':
        return <Activity className="h-4 w-4 text-orange-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'border-l-danger-500 bg-danger-50'
      case 'warning':
        return 'border-l-warning-500 bg-warning-50'
      case 'info':
        return 'border-l-success-500 bg-success-50'
      case 'debug':
        return 'border-l-gray-500 bg-gray-50'
      default:
        return 'border-l-gray-300 bg-white'
    }
  }

  const exportLogs = () => {
    const data = filteredLogs.map(log => ({
      timestamp: log.timestamp,
      level: log.level,
      type: log.type,
      modem: log.modem_serial,
      message: log.message,
      details: log.details
    }))
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `system-logs-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const uniqueModems = Array.from(new Set(logs.map(log => log.modem_serial).filter(Boolean)))

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-gray-600" />
            <h3 className="text-lg font-medium text-gray-900">System Logs</h3>
            <span className="text-sm text-gray-500">({filteredLogs.length} entries)</span>
          </div>
          <div className="flex items-center space-x-2">
            <label className="flex items-center text-sm">
              <input
                type="checkbox"
                checked={isAutoScroll}
                onChange={(e) => setIsAutoScroll(e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded mr-2"
              />
              Auto-scroll
            </label>
            <button
              onClick={exportLogs}
              disabled={filteredLogs.length === 0}
              className="btn btn-outline text-sm"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="text-xs font-medium text-gray-700 block mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                placeholder="Search logs..."
                className="pl-9 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Level Filter */}
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Level</label>
            <select
              value={filters.level}
              onChange={(e) => setFilters(prev => ({ ...prev, level: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="all">All Levels</option>
              <option value="error">Error</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Type</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="all">All Types</option>
              <option value="SYSTEM">System</option>
              <option value="MODEM">Modem</option>
              <option value="COMMAND">Command</option>
              <option value="NETWORK">Network</option>
            </select>
          </div>

          {/* Modem Filter */}
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Modem</label>
            <select
              value={filters.modem}
              onChange={(e) => setFilters(prev => ({ ...prev, modem: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="all">All Modems</option>
              {uniqueModems.map(modem => (
                <option key={modem} value={modem}>
                  {modem?.replace('EC25_', 'Modem ')}
                </option>
              ))}
            </select>
          </div>

          {/* Time Range Filter */}
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Time Range</label>
            <select
              value={filters.timeRange}
              onChange={(e) => setFilters(prev => ({ ...prev, timeRange: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="15m">Last 15 minutes</option>
              <option value="1h">Last hour</option>
              <option value="6h">Last 6 hours</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Logs List */}
      <div className="card">
        <div className="max-h-96 overflow-y-auto scrollbar-thin">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-sm font-medium text-gray-900">No logs found</h3>
              <p className="text-sm text-gray-500 mt-1">
                Adjust your filters to see more log entries
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className={`p-4 border-l-4 ${getLevelColor(log.level)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="flex items-center space-x-2 mt-0.5">
                        {getLevelIcon(log.level)}
                        {getTypeIcon(log.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-xs font-medium text-gray-500 uppercase">
                            {log.type}
                          </span>
                          {log.modem_serial && (
                            <span className="text-xs text-gray-500">
                              • {log.modem_serial.replace('EC25_', 'Modem ')}
                            </span>
                          )}
                        </div>
                        
                        <p className="text-sm text-gray-900 mb-2">
                          {log.message}
                        </p>
                        
                        {log.details && (
                          <details className="text-xs text-gray-600">
                            <summary className="cursor-pointer hover:text-gray-800">
                              Show details
                            </summary>
                            <pre className="mt-2 p-2 bg-gray-100 rounded overflow-x-auto">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-500 whitespace-nowrap ml-4">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
