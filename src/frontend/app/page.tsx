'use client'

import { useState } from 'react'
import { WebSocketProvider } from '@/lib/websocket'
import { Dashboard, Header, Sidebar } from '@/components'

export default function HomePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <WebSocketProvider>
      <div className="h-full">
        {/* Static sidebar for desktop */}
        <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
          <Sidebar />
        </div>

        {/* Mobile sidebar */}
        <div className="lg:hidden">
          <Sidebar 
            open={sidebarOpen} 
            onClose={() => setSidebarOpen(false)} 
          />
        </div>

        <div className="lg:pl-72">
          <Header 
            onMenuClick={() => setSidebarOpen(true)}
          />
          
          <main className="py-6">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <Dashboard />
            </div>
          </main>
        </div>
      </div>
    </WebSocketProvider>
  )
}
