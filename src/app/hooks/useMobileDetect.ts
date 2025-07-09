import { useState, useEffect } from 'react'

export const useMobileDetect = () => {
  const [isMobile, setIsMobile] = useState(false)
  const [isPWA, setIsPWA] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }

    const checkPWA = () => {
      // Check if running as PWA
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches
      const isMinimalUI = window.matchMedia('(display-mode: minimal-ui)').matches
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      const isInStandaloneMode = 'standalone' in navigator && (navigator as any).standalone
      
      setIsPWA(isStandalone || isFullscreen || isMinimalUI || (isIOS && isInStandaloneMode))
    }

    // Initial check
    checkMobile()
    checkPWA()

    // Listen for resize events
    window.addEventListener('resize', checkMobile)

    // Listen for display mode changes
    const mediaQueryList = window.matchMedia('(display-mode: standalone)')
    mediaQueryList.addEventListener('change', checkPWA)

    return () => {
      window.removeEventListener('resize', checkMobile)
      mediaQueryList.removeEventListener('change', checkPWA)
    }
  }, [])

  return { isMobile, isPWA }
}