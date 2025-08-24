'use client'

import { useState } from 'react'
import { 
  Radio, 
  Wifi, 
  Activity, 
  AlertTriangle, 
  CheckCircle,
  Power,
  RefreshCcw,
  ExternalLink,
  Signal,
  MapPin,
  Clock,
  Zap
} from 'lucide-react'
import { Modem } from '@/types'
import { restartModem, getModemSignalStrength } from '@/lib/api'

interface ModemCardProps {
  modem: Modem
  isSelected: boolean
  onSelect: () => void
}

export const ModemCard: React.FC<ModemCardProps> = ({ modem, isSelected, onSelect }) => {
  const [isRestarting, setIsRestarting] = useState(false)
  const [isCheckingSignal, setIsCheckingSignal] = useState(false)
  const [lastAction, setLastAction] = useState<string | null>(null)

  const getStatusIcon = () => {
    switch (modem.status) {
      case 'ready':
        return <CheckCircle className="h-5 w-5 text-success-500" />
      case 'partial':
        return <AlertTriangle className="h-5 w-5 text-warning-500" />
      case 'offline':
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-danger-500" />
      case 'connecting':
        return <RefreshCcw className="h-5 w-5 text-blue-500 animate-spin" />
      default:
        return <Radio className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusColor = () => {
    switch (modem.status) {
      case 'ready':
        return 'bg-success-50 text-success-700 ring-success-600/20'
      case 'partial':
        return 'bg-warning-50 text-warning-700 ring-warning-600/20'
      case 'offline':
      case 'error':
        return 'bg-danger-50 text-danger-700 ring-danger-600/20'
      case 'connecting':
        return 'bg-blue-50 text-blue-700 ring-blue-600/20'
      default:
        return 'bg-gray-50 text-gray-700 ring-gray-600/20'
    }
  }

  const getSignalStrength = () => {
    if (!modem.signal_strength) return 0
    // Convert RSSI to percentage (rough approximation)
    const rssi = modem.signal_strength
    if (rssi >= 25) return 100
    if (rssi >= 20) return 75
    if (rssi >= 15) return 50
    if (rssi >= 10) return 25
    return 10
  }

  const getSignalBars = () => {
    const strength = getSignalStrength()
    const bars = []
    for (let i = 0; i < 4; i++) {
      const isActive = strength > (i + 1) * 25
      bars.push(
        <div
          key={i}
          className={`signal-strength-bar ${
            isActive 
              ? strength >= 75 ? 'active' 
                : strength >= 50 ? 'bg-warning-500' 
                : 'bg-danger-500'
              : ''
          }`}
          style={{ height: `${(i + 1) * 25}%` }}
        />
      )
    }
    return bars
  }

  const handleRestart = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsRestarting(true)
    try {
      const response = await restartModem(modem.serial)
      if (response.success) {
        setLastAction('Restart command sent successfully')
      } else {
        setLastAction('Failed to restart modem')
      }
    } catch (error) {
      console.error('Failed to restart modem:', error)
      setLastAction('Error: Failed to restart modem')
    } finally {
      setIsRestarting(false)
    }
  }

  const handleCheckSignal = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsCheckingSignal(true)
    try {
      const response = await getModemSignalStrength(modem.serial)
      if (response.success) {
        setLastAction('Signal check completed')
      } else {
        setLastAction('Failed to check signal')
      }
    } catch (error) {
      console.error('Failed to check signal:', error)
      setLastAction('Error: Failed to check signal')
    } finally {
      setIsCheckingSignal(false)
    }
  }

  const formatLastSeen = () => {
    if (!modem.last_seen) return 'Never'
    const lastSeen = new Date(modem.last_seen)
    const now = new Date()
    const diff = now.getTime() - lastSeen.getTime()
    
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return lastSeen.toLocaleDateString()
  }

  return (
    <div
      onClick={onSelect}
      className={`
        card p-6 cursor-pointer transition-all duration-200 hover:shadow-md
        ${isSelected ? 'ring-2 ring-primary-500 shadow-md' : ''}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          {getStatusIcon()}
          <div>
            <h3 className="text-sm font-medium text-gray-900">
              {modem.serial.replace('EC25_', 'Modem ')}
            </h3>
            <p className="text-xs text-gray-500">{modem.usb_id}</p>
          </div>
        </div>
        <span className={`
          inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset
          ${getStatusColor()}
        `}>
          {modem.status}
        </span>
      </div>

      {/* Connection Details */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">AT Port:</span>
          <span className="font-mono text-gray-900">{modem.at_port}</span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">QMI Device:</span>
          <span className="font-mono text-gray-900">{modem.qmi_device}</span>
        </div>
        
        {modem.proxy_port && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Proxy Port:</span>
            <span className="font-mono text-gray-900">:{modem.proxy_port}</span>
          </div>
        )}
      </div>

      {/* Network Information */}
      {(modem.wan_ip || modem.operator || modem.signal_strength) && (
        <div className="border-t border-gray-200 pt-4 mb-4">
          <div className="space-y-2">
            {modem.wan_ip && (
              <div className="flex items-center space-x-2 text-sm">
                <Wifi className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600">IP:</span>
                <span className="font-mono text-gray-900">{modem.wan_ip}</span>
              </div>
            )}
            
            {modem.operator && (
              <div className="flex items-center space-x-2 text-sm">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600">Operator:</span>
                <span className="text-gray-900">{modem.operator}</span>
              </div>
            )}
            
            {modem.signal_strength && (
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  <Signal className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">Signal:</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-0.5 items-end">
                    {getSignalBars()}
                  </div>
                  <span className="text-gray-900">{modem.signal_strength}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Last Seen */}
      <div className="flex items-center space-x-2 text-xs text-gray-500 mb-4">
        <Clock className="h-3 w-3" />
        <span>Last seen: {formatLastSeen()}</span>
      </div>

      {/* Last Action */}
      {lastAction && (
        <div className="mb-4 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
          {lastAction}
        </div>
      )}

      {/* Actions */}
      <div className="flex space-x-2">
        <button
          onClick={handleRestart}
          disabled={isRestarting || modem.status === 'offline'}
          className="flex-1 btn btn-outline text-xs py-1 px-2"
          title="Restart modem"
        >
          {isRestarting ? (
            <RefreshCcw className="h-3 w-3 animate-spin" />
          ) : (
            <Power className="h-3 w-3" />
          )}
        </button>
        
        <button
          onClick={handleCheckSignal}
          disabled={isCheckingSignal || modem.status === 'offline'}
          className="flex-1 btn btn-outline text-xs py-1 px-2"
          title="Check signal strength"
        >
          {isCheckingSignal ? (
            <RefreshCcw className="h-3 w-3 animate-spin" />
          ) : (
            <Signal className="h-3 w-3" />
          )}
        </button>
        
        {modem.proxy_port && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              window.open(`http://localhost:${modem.proxy_port}`, '_blank')
            }}
            className="btn btn-outline text-xs py-1 px-2"
            title="Open proxy interface"
          >
            <ExternalLink className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Selection Indicator */}
      {isSelected && (
        <div className="mt-4 p-2 bg-primary-50 border border-primary-200 rounded text-xs text-primary-700">
          <div className="flex items-center space-x-1">
            <Zap className="h-3 w-3" />
            <span>Selected for commands</span>
          </div>
        </div>
      )}
    </div>
  )
}
