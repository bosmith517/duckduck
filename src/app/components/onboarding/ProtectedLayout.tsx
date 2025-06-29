import React from 'react'
import { Outlet } from 'react-router-dom'
import OnboardingGuard from './OnboardingGuard'

const ProtectedLayout: React.FC = () => {
  return (
    <OnboardingGuard>
      <Outlet />
    </OnboardingGuard>
  )
}

export default ProtectedLayout