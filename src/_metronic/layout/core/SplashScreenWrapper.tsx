import React, { useEffect } from 'react'
import { WithChildren } from '../../helpers'

const SplashScreenWrapper: React.FC<WithChildren> = ({ children }) => {
  useEffect(() => {
    // Remove splash screen on mount
    const removeSplashScreen = () => {
      document.body.classList.remove('page-loading')
      document.body.removeAttribute('data-kt-app-page-loading')
      
      // Remove any splash screen elements
      const splashElements = document.querySelectorAll(
        '.splash-screen, #splash-screen, .page-loader'
      )
      splashElements.forEach(el => {
        if (el && el.parentNode) {
          el.parentNode.removeChild(el)
        }
      })
    }
    
    // Remove immediately
    removeSplashScreen()
    
    // Also remove after a short delay to ensure it's gone
    const timer = setTimeout(removeSplashScreen, 100)
    
    return () => clearTimeout(timer)
  }, [])
  
  return <>{children}</>
}

export { SplashScreenWrapper }