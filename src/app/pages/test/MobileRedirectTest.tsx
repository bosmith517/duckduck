import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'

const MobileRedirectTest: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, session } = useSupabaseAuth()
  const [logs, setLogs] = useState<string[]>([])
  
  // Detect if running as installed PWA
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                (window.navigator as any).standalone === true ||
                document.referrer.includes('android-app://') ||
                new URLSearchParams(window.location.search).get('source') === 'pwa';
  
  // Detect if on mobile device
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toISOString()}: ${message}`])
  }
  
  useEffect(() => {
    addLog('Component mounted')
    addLog(`Current path: ${location.pathname}`)
    addLog(`Is authenticated: ${!!user}`)
    addLog(`Is PWA: ${isPWA}`)
    addLog(`Is Mobile: ${isMobile}`)
    addLog(`User agent: ${navigator.userAgent}`)
    addLog(`Should redirect to mobile: ${isPWA || isMobile}`)
  }, [])
  
  const testLogin = async () => {
    addLog('Testing login...')
    try {
      const { supabase } = await import('../../../supabaseClient')
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'admin@demo.com',
        password: 'demo'
      })
      
      if (error) {
        addLog(`Login error: ${error.message}`)
      } else {
        addLog('Login successful!')
        addLog(`User: ${data.user?.email}`)
        // Wait a bit to see where navigation goes
        setTimeout(() => {
          addLog(`After login, current path: ${window.location.pathname}`)
        }, 1000)
      }
    } catch (err) {
      addLog(`Exception: ${err}`)
    }
  }
  
  const testMobileNavigation = () => {
    addLog('Testing direct navigation to /mobile/my-day...')
    navigate('/mobile/my-day')
    setTimeout(() => {
      addLog(`After navigation, current path: ${window.location.pathname}`)
    }, 500)
  }
  
  const testLogout = async () => {
    addLog('Testing logout...')
    try {
      const { supabase } = await import('../../../supabaseClient')
      await supabase.auth.signOut()
      addLog('Logged out successfully')
      setTimeout(() => {
        addLog(`After logout, current path: ${window.location.pathname}`)
      }, 500)
    } catch (err) {
      addLog(`Logout error: ${err}`)
    }
  }
  
  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Mobile Redirect Test</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Current Status:</h3>
        <ul>
          <li>Authenticated: {user ? 'Yes' : 'No'}</li>
          <li>User Email: {user?.email || 'Not logged in'}</li>
          <li>Is PWA: {isPWA ? 'Yes' : 'No'}</li>
          <li>Is Mobile: {isMobile ? 'Yes' : 'No'}</li>
          <li>Current Path: {location.pathname}</li>
          <li>Expected Redirect: {(isPWA || isMobile) ? '/mobile/my-day' : '/dashboard'}</li>
        </ul>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={testLogin} 
          style={{ marginRight: '10px', padding: '10px 20px' }}
          disabled={!!user}
        >
          Test Login
        </button>
        <button 
          onClick={testMobileNavigation}
          style={{ marginRight: '10px', padding: '10px 20px' }}
          disabled={!user}
        >
          Navigate to Mobile
        </button>
        <button 
          onClick={testLogout}
          style={{ padding: '10px 20px' }}
          disabled={!user}
        >
          Test Logout
        </button>
      </div>
      
      <div style={{ 
        backgroundColor: '#f5f5f5', 
        padding: '15px', 
        borderRadius: '5px',
        fontFamily: 'monospace',
        fontSize: '12px',
        whiteSpace: 'pre-wrap',
        maxHeight: '400px',
        overflow: 'auto'
      }}>
        <h3>Logs:</h3>
        {logs.map((log, index) => (
          <div key={index}>{log}</div>
        ))}
      </div>
    </div>
  )
}

export default MobileRedirectTest