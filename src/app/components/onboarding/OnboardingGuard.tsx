import React, { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'

interface OnboardingGuardProps {
  children: React.ReactNode
}

const OnboardingGuard: React.FC<OnboardingGuardProps> = ({ children }) => {
  const { tenant } = useSupabaseAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [showOnboardingPrompt, setShowOnboardingPrompt] = useState(false)
  const [skipExpiry, setSkipExpiry] = useState<number | null>(null)
  
  // Check if onboarding is completed (default to false if field doesn't exist)
  const isOnboardingCompleted = tenant?.onboarding_completed === true
  
  useEffect(() => {
    if (!isOnboardingCompleted) {
      // Check if user has temporarily skipped onboarding
      const skipData = localStorage.getItem('onboarding_skip')
      if (skipData) {
        const { expiry } = JSON.parse(skipData)
        const now = Date.now()
        
        if (now < expiry) {
          setSkipExpiry(expiry)
          return
        } else {
          // Skip period expired, remove from storage
          localStorage.removeItem('onboarding_skip')
        }
      }
      
      // Show onboarding prompt
      setShowOnboardingPrompt(true)
    }
  }, [isOnboardingCompleted])

  // Check if skip period has expired
  useEffect(() => {
    if (skipExpiry) {
      const interval = setInterval(() => {
        if (Date.now() >= skipExpiry) {
          localStorage.removeItem('onboarding_skip')
          setSkipExpiry(null)
          setShowOnboardingPrompt(true)
        }
      }, 60000) // Check every minute

      return () => clearInterval(interval)
    }
  }, [skipExpiry])

  const handleCompleteOnboarding = () => {
    navigate('/onboarding')
  }

  const handleSkipOnboarding = () => {
    // Allow skip for 2 hours
    const expiry = Date.now() + (2 * 60 * 60 * 1000)
    localStorage.setItem('onboarding_skip', JSON.stringify({ expiry }))
    setSkipExpiry(expiry)
    setShowOnboardingPrompt(false)
  }

  // Allow access to onboarding page itself
  if (location.pathname === '/onboarding') {
    return <>{children}</>
  }

  // Show loading while tenant is not loaded
  if (!tenant) {
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
          <p style={{ color: '#666', fontSize: '16px' }}>Loading...</p>
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

  // Show onboarding prompt
  if (showOnboardingPrompt) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '40px',
          maxWidth: '500px',
          margin: '20px',
          textAlign: 'center',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            backgroundColor: '#007bff',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            fontSize: '40px',
            color: 'white'
          }}>
            🚀
          </div>
          
          <h2 style={{ marginBottom: '16px', color: '#333' }}>
            Welcome to TradeWorks Pro!
          </h2>
          
          <p style={{ marginBottom: '24px', color: '#666', lineHeight: '1.5' }}>
            To get the most out of TradeWorks Pro, we recommend completing the quick setup process. 
            This will customize the platform specifically for your business type and workflow.
          </p>
          
          <div style={{ marginBottom: '20px' }}>
            <strong style={{ color: '#007bff' }}>✓ Industry-specific customization</strong><br />
            <strong style={{ color: '#007bff' }}>✓ Workflow optimization</strong><br />
            <strong style={{ color: '#007bff' }}>✓ Quick client onboarding tools</strong>
          </div>
          
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleCompleteOnboarding}
              style={{
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#0056b3'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#007bff'}
            >
              Complete Setup (5 min)
            </button>
            
            <button
              onClick={handleSkipOnboarding}
              style={{
                backgroundColor: 'transparent',
                color: '#666',
                border: '1px solid #ddd',
                padding: '12px 24px',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#f8f9fa'
                e.currentTarget.style.borderColor = '#adb5bd'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.borderColor = '#ddd'
              }}
            >
              Skip for now (2 hours)
            </button>
          </div>
          
          <p style={{ marginTop: '16px', fontSize: '12px', color: '#999' }}>
            You can always complete setup later from Settings
          </p>
        </div>
      </div>
    )
  }

  // Show skip countdown - now handled in sidebar
  if (skipExpiry && !isOnboardingCompleted) {
    return <>{children}</>
  }

  // Allow access if onboarding is completed
  return <>{children}</>
}

export default OnboardingGuard