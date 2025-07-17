import React from 'react'
import { WithChildren } from '../../helpers'

const SplashScreenWrapper: React.FC<WithChildren> = ({ children }) => {
  // Simple wrapper - splash screen removal is handled in main.tsx
  return <>{children}</>
}

export { SplashScreenWrapper }