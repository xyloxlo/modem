'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { WebSocketEvent, ModemChangeEvent } from '@/types'

interface WebSocketContextType {
  socket: Socket | null
  isConnected: boolean
  lastEvent: WebSocketEvent | null
  connectionError: string | null
  reconnectAttempts: number
}

const WebSocketContext = createContext<WebSocketContextType>({
  socket: null,
  isConnected: false,
  lastEvent: null,
  connectionError: null,
  reconnectAttempts: 0,
})

export const useWebSocket = () => {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return context
}

interface WebSocketProviderProps {
  children: React.ReactNode
  url?: string
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ 
  children, 
  url = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3002' 
}) => {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<WebSocketEvent | null>(null)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)

  const connectSocket = useCallback(() => {
    try {
      const newSocket = io(url, {
        transports: ['websocket', 'polling'],
        upgrade: true,
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      })

      newSocket.on('connect', () => {
        console.log('WebSocket connected')
        setIsConnected(true)
        setConnectionError(null)
        setReconnectAttempts(0)
      })

      newSocket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason)
        setIsConnected(false)
        if (reason === 'io server disconnect') {
          newSocket.connect()
        }
      })

      newSocket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error)
        setConnectionError(error.message)
        setReconnectAttempts(prev => prev + 1)
      })

      newSocket.on('reconnect', (attemptNumber) => {
        console.log('WebSocket reconnected after', attemptNumber, 'attempts')
        setConnectionError(null)
        setReconnectAttempts(0)
      })

      newSocket.on('reconnect_error', (error) => {
        console.error('WebSocket reconnect error:', error)
        setConnectionError(error.message)
      })

      // Listen for EC25-EUX system events
      newSocket.on('modem_change', (data: ModemChangeEvent) => {
        const event: WebSocketEvent = {
          type: 'modem_change',
          event: data,
          timestamp: new Date().toISOString()
        }
        setLastEvent(event)
      })

      newSocket.on('system_status', (data: any) => {
        const event: WebSocketEvent = {
          type: 'system_status',
          data,
          timestamp: new Date().toISOString()
        }
        setLastEvent(event)
      })

      newSocket.on('command_result', (data: any) => {
        const event: WebSocketEvent = {
          type: 'command_result',
          data,
          timestamp: new Date().toISOString()
        }
        setLastEvent(event)
      })

      newSocket.on('log_entry', (data: any) => {
        const event: WebSocketEvent = {
          type: 'log_entry',
          data,
          timestamp: new Date().toISOString()
        }
        setLastEvent(event)
      })

      newSocket.on('error', (error: any) => {
        console.error('WebSocket error:', error)
        const event: WebSocketEvent = {
          type: 'error',
          data: error,
          timestamp: new Date().toISOString()
        }
        setLastEvent(event)
        setConnectionError(error.message || 'WebSocket error')
      })

      setSocket(newSocket)

      return newSocket
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      setConnectionError('Failed to create WebSocket connection')
      return null
    }
  }, [url])

  useEffect(() => {
    const newSocket = connectSocket()

    return () => {
      if (newSocket) {
        newSocket.disconnect()
      }
    }
  }, [connectSocket])

  const value: WebSocketContextType = {
    socket,
    isConnected,
    lastEvent,
    connectionError,
    reconnectAttempts,
  }

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  )
}
