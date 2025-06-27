import React, { createContext, useContext, useState, ReactNode } from 'react'

interface CallInfo {
  name: string
  number: string
  contactId?: string
}

interface SoftphoneContextType {
  isVisible: boolean
  callInfo: CallInfo | null
  startCall: (name: string, number: string, contactId?: string) => void
  hideDialer: () => void
  showDialer: () => void
}

const SoftphoneContext = createContext<SoftphoneContextType | undefined>(undefined)

interface SoftphoneProviderProps {
  children: ReactNode
}

export const SoftphoneProvider: React.FC<SoftphoneProviderProps> = ({ children }) => {
  const [isVisible, setIsVisible] = useState(false)
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null)

  const startCall = (name: string, number: string, contactId?: string) => {
    setCallInfo({ name, number, contactId })
    setIsVisible(true)
  }

  const hideDialer = () => {
    setIsVisible(false)
  }

  const showDialer = () => {
    setIsVisible(true)
  }

  const value: SoftphoneContextType = {
    isVisible,
    callInfo,
    startCall,
    hideDialer,
    showDialer
  }

  return (
    <SoftphoneContext.Provider value={value}>
      {children}
    </SoftphoneContext.Provider>
  )
}

export const useSoftphoneContext = (): SoftphoneContextType => {
  const context = useContext(SoftphoneContext)
  if (context === undefined) {
    throw new Error('useSoftphoneContext must be used within a SoftphoneProvider')
  }
  return context
}
