import React, {
  createContext,
  Dispatch,
  FC,
  SetStateAction,
  useContext,
  useEffect,
  useState,
} from 'react'
import {WithChildren} from '../../helpers'

const MetronicSplashScreenContext = createContext<Dispatch<SetStateAction<number>> | undefined>(
  undefined
)

const MetronicSplashScreenProvider: React.FC<WithChildren> = ({children}) => {
  const [count, setCount] = useState(0)
  const visible = count > 0

  useEffect(() => {
    // Show SplashScreen
    if (visible) {
      document.body.classList.add('page-loading')

      return () => {
        document.body.classList.remove('page-loading')
      }
    }

    // Hide SplashScreen
    if (!visible) {
      document.body.classList.remove('page-loading')
    }
  }, [visible])

  return (
    <MetronicSplashScreenContext.Provider value={setCount}>
      {children}
    </MetronicSplashScreenContext.Provider>
  )
}

const LayoutSplashScreen: React.FC<{visible?: boolean}> = ({visible = true}) => {
  // Everything are ready - remove splashscreen
  const setCount = useContext(MetronicSplashScreenContext)

  useEffect(() => {
    if (!visible) {
      return
    }

    if (setCount) {
      setCount((prev) => {
        return prev + 1
      })
    }

    return () => {
      if (setCount) {
        setCount((prev) => {
          return prev - 1
        })
      }
    }
  }, [setCount, visible])

  return null
}

export {MetronicSplashScreenProvider, LayoutSplashScreen}
