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
    if (!currentUser || !tenant) {
      setHasCheckedOnboarding(true)
      return
    }

    try {
      // Check if tenant has completed onboarding
      const needsOnboarding = !tenant.onboarding_completed

      // Also check URL params for forced onboarding
      const urlParams = new URLSearchParams(window.location.search)
      const forceOnboarding = urlParams.get('onboarding') === 'true'

      setShowOnboarding(needsOnboarding || forceOnboarding)
    } catch (error) {
      console.error('Error checking onboarding status:', error)
      // Default to showing onboarding if we can't determine status
      setShowOnboarding(true)
    } finally {
      setHasCheckedOnboarding(true)
    }
  }

  const openOnboarding = () => {
    setShowOnboarding(true)
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