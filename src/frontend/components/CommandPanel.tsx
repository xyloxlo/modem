'use client'

import { useState, useEffect } from 'react'
import { 
  Terminal, 
  Play, 
  History, 
  Radio,
  AlertCircle,
  CheckCircle,
  Clock,
  Copy,
  Download
} from 'lucide-react'
import { Modem, ModemCommand } from '@/types'
import { executeModemCommand, executeMultiModemCommand } from '@/lib/api'

interface CommandPanelProps {
  modems: Modem[]
  selectedModem: string | null
  onModemSelect: (serial: string | null) => void
}

// Common AT commands
const commonATCommands = [
  { command: 'AT', description: 'Basic AT test' },
  { command: 'AT+CSQ', description: 'Signal quality' },
  { command: 'AT+COPS?', description: 'Current operator' },
  { command: 'AT+CREG?', description: 'Network registration' },
  { command: 'AT+CGDCONT?', description: 'PDP context' },
  { command: 'AT+CGPADDR', description: 'PDP address' },
  { command: 'ATI', description: 'Modem information' },
  { command: 'AT+CFUN?', description: 'Phone functionality' },
  { command: 'AT+CFUN=1,1', description: 'Restart modem' },
]

// Common QMI commands
const commonQMICommands = [
  { command: '--dms-get-operating-mode', description: 'Get operating mode' },
  { command: '--nas-get-signal-strength', description: 'Get signal strength' },
  { command: '--wds-get-current-settings', description: 'Get IP settings' },
  { command: '--nas-get-serving-system', description: 'Get serving system' },
  { command: '--dms-get-device-model', description: 'Get device model' },
  { command: '--dms-get-revision', description: 'Get firmware version' },
]

export const CommandPanel: React.FC<CommandPanelProps> = ({ 
  modems, 
  selectedModem, 
  onModemSelect 
}) => {
  const [command, setCommand] = useState('')
  const [commandInterface, setCommandInterface] = useState<'AT' | 'QMI'>('AT')
  const [target, setTarget] = useState<'single' | 'all'>('single')
  const [isExecuting, setIsExecuting] = useState(false)
  const [commandHistory, setCommandHistory] = useState<ModemCommand[]>([])
  const [selectedModems, setSelectedModems] = useState<string[]>([])

  // Update selected modems when selectedModem changes
  useEffect(() => {
    if (selectedModem) {
      setSelectedModems([selectedModem])
      setTarget('single')
    }
  }, [selectedModem])

  const activeModems = modems.filter(m => m.status === 'ready')

  const handleExecuteCommand = async () => {
    if (!command.trim()) return

    setIsExecuting(true)
    try {
      let response: any
      
      if (target === 'single' && selectedModems.length === 1) {
        response = await executeModemCommand(selectedModems[0], command, commandInterface)
        
        if (response.success && response.data) {
          setCommandHistory(prev => [response.data!, ...prev.slice(0, 49)]) // Keep last 50
        }
      } else if (target === 'all' || selectedModems.length > 1) {
        const targets = target === 'all' ? activeModems.map(m => m.serial) : selectedModems
        response = await executeMultiModemCommand(targets, command, commandInterface)
        
        if (response.success && response.data) {
          setCommandHistory(prev => [...response.data!, ...prev.slice(0, 45)]) // Keep last 50
        }
      }

      // Clear command after successful execution
      setCommand('')
      
    } catch (error) {
      console.error('Failed to execute command:', error)
      // Add error to history
      const errorEntry: ModemCommand = {
        serial: selectedModems[0] || 'unknown',
        command,
        commandInterface,
        response: `Error: ${error}`,
        success: false,
        timestamp: new Date().toISOString()
      }
      setCommandHistory(prev => [errorEntry, ...prev.slice(0, 49)])
    } finally {
      setIsExecuting(false)
    }
  }

  const handleQuickCommand = (cmd: string) => {
    setCommand(cmd)
  }

  const handleModemToggle = (serial: string) => {
    setSelectedModems(prev => {
      if (prev.includes(serial)) {
        return prev.filter(s => s !== serial)
      } else {
        return [...prev, serial]
      }
    })
  }

  const copyResponse = (response: string) => {
    navigator.clipboard.writeText(response)
  }

  const exportHistory = () => {
    const data = commandHistory.map(cmd => ({
      timestamp: cmd.timestamp,
      modem: cmd.serial,
      interface: cmd.commandInterface,
      command: cmd.command,
      response: cmd.response,
      success: cmd.success
    }))
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `command-history-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Command Input Section */}
      <div className="card p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Terminal className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-medium text-gray-900">Command Interface</h3>
        </div>

        {/* Interface Selection */}
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 block mb-2">
            Command Interface
          </label>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                checked={commandInterface === 'AT'}
                onChange={() => setCommandInterface('AT')}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">AT Commands</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                checked={commandInterface === 'QMI'}
                onChange={() => setCommandInterface('QMI')}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">QMI Commands</span>
            </label>
          </div>
        </div>

        {/* Target Selection */}
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 block mb-2">
            Target Modems
          </label>
          <div className="flex space-x-4 mb-3">
            <label className="flex items-center">
              <input
                type="radio"
                checked={target === 'single'}
                onChange={() => setTarget('single')}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">Selected Modems</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                checked={target === 'all'}
                onChange={() => setTarget('all')}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">All Active Modems</span>
            </label>
          </div>

          {/* Modem Selection Grid */}
          {target === 'single' && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {activeModems.map((modem) => (
                <label key={modem.serial} className="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selectedModems.includes(modem.serial)}
                    onChange={() => handleModemToggle(modem.serial)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">
                    {modem.serial.replace('EC25_', 'Modem ')}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Command Input */}
        <div className="mb-4">
          <label htmlFor="command" className="text-sm font-medium text-gray-700 block mb-2">
            Command
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              id="command"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder={commandInterface === 'AT' ? 'Enter AT command (e.g., AT+CSQ)' : 'Enter QMI command (e.g., --nas-get-signal-strength)'}
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              onKeyPress={(e) => e.key === 'Enter' && !isExecuting && handleExecuteCommand()}
            />
            <button
              onClick={handleExecuteCommand}
              disabled={isExecuting || !command.trim() || (target === 'single' && selectedModems.length === 0)}
              className="btn btn-primary"
            >
              {isExecuting ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Execute
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Commands */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">
            Quick Commands
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {(commandInterface === 'AT' ? commonATCommands : commonQMICommands).map((cmd, index) => (
              <button
                key={index}
                onClick={() => handleQuickCommand(cmd.command)}
                className="p-2 text-left border border-gray-200 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                title={cmd.description}
              >
                <div className="text-xs font-mono text-gray-900">{cmd.command}</div>
                <div className="text-xs text-gray-500 truncate">{cmd.description}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Command History */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <History className="h-5 w-5 text-gray-600" />
            <h3 className="text-lg font-medium text-gray-900">Command History</h3>
            <span className="text-sm text-gray-500">({commandHistory.length})</span>
          </div>
          <button
            onClick={exportHistory}
            disabled={commandHistory.length === 0}
            className="btn btn-outline text-sm"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
        </div>

        <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin">
          {commandHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Terminal className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p>No commands executed yet</p>
              <p className="text-sm">Execute your first command to see results here</p>
            </div>
          ) : (
            commandHistory.map((cmd, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Radio className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900">
                      {cmd.serial.replace('EC25_', 'Modem ')}
                    </span>
                    <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                      {cmd.commandInterface}
                    </span>
                    {cmd.success ? (
                      <CheckCircle className="h-4 w-4 text-success-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-danger-500" />
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">
                      {new Date(cmd.timestamp).toLocaleTimeString()}
                    </span>
                    <button
                      onClick={() => copyResponse(cmd.response || '')}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="Copy response"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div>
                    <span className="text-xs font-medium text-gray-500">Command:</span>
                    <div className="font-mono text-sm text-gray-900 bg-gray-50 p-2 rounded">
                      {cmd.command}
                    </div>
                  </div>
                  
                  {cmd.response && (
                    <div>
                      <span className="text-xs font-medium text-gray-500">Response:</span>
                      <div className={`font-mono text-sm p-2 rounded max-h-32 overflow-y-auto scrollbar-thin ${
                        cmd.success ? 'text-gray-900 bg-gray-50' : 'text-danger-700 bg-danger-50'
                      }`}>
                        {cmd.response}
                      </div>
                    </div>
                  )}
                  
                  {cmd.execution_time && (
                    <div className="text-xs text-gray-500">
                      Execution time: {cmd.execution_time}ms
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
