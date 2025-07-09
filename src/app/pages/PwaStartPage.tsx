import React, { useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useSupabaseAuth } from '../modules/auth/core/SupabaseAuth'

const PwaStartPage: React.FC = () => {
  const navigate = useNavigate()
  const { user, authLoading } = useSupabaseAuth()
  
  // Detect if on mobile device
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  
  useEffect(() => {
    // Log for debugging
    console.log('PWA Start Page - Handling redirect', {
      isMobile,
      isAuthenticated: !!user,
      authLoading
    })
    
    // If auth is still loading, wait
    if (authLoading) return
    
    // If not authenticated, go to login
    if (!user) {
      navigate('/auth/login')
      return
    }
    
    // If authenticated, redirect based on device
    if (isMobile) {
      navigate('/mobile/my-day', { replace: true })
    } else {
      navigate('/dashboard', { replace: true })
    }
  }, [user, authLoading, isMobile, navigate])
  
  // Show loading while determining where to redirect
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      backgroundColor: '#f8f9fa'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #e3e3e3',
          borderTop: '4px solid #007bff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 20px'
        }}></div>
        <p style={{ color: '#666', fontSize: '16px' }}>Starting TradeWorks Pro...</p>
      </div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default PwaStartPage