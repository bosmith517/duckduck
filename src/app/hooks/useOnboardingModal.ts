import { useState, useEffect } from 'react'
import { useSupabaseAuth } from '../modules/auth/core/SupabaseAuth'

export const useOnboardingModal = () => {
  const { currentUser, tenant } = useSupabaseAuth()
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [hasCheckedOnboarding, setHasCheckedOnboarding] = useState(false)
  

  useEffect(() => {
    checkOnboardingStatus()
  }, [currentUser, tenant])

  const checkOnboardingStatus = async () => {
    // Don't mark as checked until we have both user and tenant
    if (!currentUser || !tenant) {
      setHasCheckedOnboarding(false)
      return
    }

    try {
      // Don't auto-show modal - only show when explicitly called
      setShowOnboarding(false)
    } catch (error) {
      console.error('Error checking onboarding status:', error)
      setShowOnboarding(false)
    } finally {
      setHasCheckedOnboarding(true)
    }
  }

  const openOnboarding = () => {
    console.log('useOnboardingModal: openOnboarding called')
    setShowOnboarding(true)
    console.log('useOnboardingModal: showOnboarding set to true')
  }

  const closeOnboarding = () => {
    setShowOnboarding(false)
    
    // Remove onboarding URL param if present
    const url = new URL(window.location.href)
    url.searchParams.delete('onboarding')
    window.history.replaceState({}, '', url.toString())
  }

  const completeOnboarding = () => {
    setShowOnboarding(false)
    
    // Remove onboarding URL param if present
    const url = new URL(window.location.href)
    url.searchParams.delete('onboarding')
    window.history.replaceState({}, '', url.toString())
    
    // Optionally refresh the page or trigger a data refresh
    window.location.reload()
  }

  return {
    showOnboarding,
    hasCheckedOnboarding,
    openOnboarding,
    closeOnboarding,
    completeOnboarding
  }
}