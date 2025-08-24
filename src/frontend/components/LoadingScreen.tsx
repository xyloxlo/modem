'use client'

import { useEffect, useState } from 'react'
import { Loader2, Radio, Wifi } from 'lucide-react'

export const LoadingScreen = () => {
  const [loadingText, setLoadingText] = useState('Initializing system...')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const steps = [
      { text: 'Initializing system...', duration: 300 },
      { text: 'Connecting to backend...', duration: 400 },
      { text: 'Detecting modems...', duration: 500 },
      { text: 'Establishing WebSocket connection...', duration: 400 },
      { text: 'Loading dashboard...', duration: 300 },
    ]

    let currentStep = 0
    let currentProgress = 0

    const updateProgress = () => {
      if (currentStep < steps.length) {
        setLoadingText(steps[currentStep].text)
        
        const stepProgress = 100 / steps.length
        const targetProgress = (currentStep + 1) * stepProgress
        
        const progressInterval = setInterval(() => {
          currentProgress += 2
          setProgress(Math.min(currentProgress, targetProgress))
          
          if (currentProgress >= targetProgress) {
            clearInterval(progressInterval)
            currentStep++
            setTimeout(updateProgress, 100)
          }
        }, steps[currentStep].duration / 50)
      }
    }

    updateProgress()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="text-center">
          {/* Logo/Icon Area */}
          <div className="mb-8 relative">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full shadow-lg mb-4">
              <div className="relative">
                <Radio className="w-8 h-8 text-primary-600" />
                <Wifi className="w-4 h-4 text-success-500 absolute -top-1 -right-1 animate-pulse" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              EC25-EUX Management
            </h1>
            <p className="text-gray-600">
              Multi-Modem LTE Proxy System
            </p>
          </div>

          {/* Loading Spinner */}
          <div className="mb-6">
            <Loader2 className="w-8 h-8 text-primary-600 animate-spin mx-auto" />
          </div>

          {/* Loading Text */}
          <div className="mb-6">
            <p className="text-gray-700 text-sm font-medium">
              {loadingText}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div 
              className="bg-primary-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          
          {/* Progress Percentage */}
          <div className="text-xs text-gray-500">
            {Math.round(progress)}% Complete
          </div>

          {/* Feature Icons */}
          <div className="mt-8 flex justify-center space-x-4 opacity-60">
            <div className="flex flex-col items-center space-y-1">
              <div className="w-8 h-8 bg-white rounded-lg shadow-sm flex items-center justify-center">
                <Radio className="w-4 h-4 text-gray-600" />
              </div>
              <span className="text-xs text-gray-500">Modems</span>
            </div>
            <div className="flex flex-col items-center space-y-1">
              <div className="w-8 h-8 bg-white rounded-lg shadow-sm flex items-center justify-center">
                <Wifi className="w-4 h-4 text-gray-600" />
              </div>
              <span className="text-xs text-gray-500">Network</span>
            </div>
            <div className="flex flex-col items-center space-y-1">
              <div className="w-8 h-8 bg-white rounded-lg shadow-sm flex items-center justify-center">
                <div className="w-2 h-2 bg-gray-600 rounded-full" />
              </div>
              <span className="text-xs text-gray-500">Proxy</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
