/* eslint-disable react-refresh/only-export-components */
import {FC, createContext, useContext, useState, useEffect} from 'react'
import {DefaultLayoutConfig} from './DefaultLayoutConfig'
import {
  getEmptyCssClasses,
  getEmptyCSSVariables,
  getEmptyHTMLAttributes,
  LayoutSetup,
} from './LayoutSetup'
import {
  ILayout,
  ILayoutCSSVariables,
  ILayoutCSSClasses,
  ILayoutHTMLAttributes,
} from './LayoutModels'
import {WithChildren} from '../../helpers'

// Create a context for splash screen coordination
const MetronicSplashScreenContext = createContext<{visible: boolean}>({visible: false})

export interface LayoutContextModel {
  config: ILayout
  classes: ILayoutCSSClasses
  attributes: ILayoutHTMLAttributes
  cssVariables: ILayoutCSSVariables
  setLayout: (config: LayoutSetup) => void
}

const LayoutContext = createContext<LayoutContextModel>({
  config: DefaultLayoutConfig,
  classes: getEmptyCssClasses(),
  attributes: getEmptyHTMLAttributes(),
  cssVariables: getEmptyCSSVariables(),
  setLayout: (config: LayoutSetup) => {},
})

const enableSplashScreen = () => {
  const splashScreen = document.getElementById('splash-screen')
  if (splashScreen) {
    splashScreen.style.setProperty('display', 'flex')
  }
}

const disableSplashScreen = () => {
  const splashScreen = document.getElementById('splash-screen')
  if (splashScreen) {
    splashScreen.style.setProperty('display', 'none')
  }
}

const LayoutProvider: FC<WithChildren> = ({children}) => {
  const [config, setConfig] = useState(LayoutSetup.config)
  const [classes, setClasses] = useState(LayoutSetup.classes)
  const [attributes, setAttributes] = useState(LayoutSetup.attributes)
  const [cssVariables, setCSSVariables] = useState(LayoutSetup.cssVariables)
  const [splashScreenShown, setSplashScreenShown] = useState(false)
  
  // Try to get splash screen context (may not exist)
  let splashScreenVisible = false
  try {
    const splashContext = useContext(MetronicSplashScreenContext)
    splashScreenVisible = splashContext.visible
  } catch (e) {
    // Context not available, default to false
  }

  const setLayout = (_themeConfig: Partial<ILayout>) => {
    enableSplashScreen()
    const bodyClasses = Array.from(document.body.classList)
    bodyClasses.forEach((cl) => document.body.classList.remove(cl))
    LayoutSetup.updatePartialConfig(_themeConfig)
    setConfig(Object.assign({}, LayoutSetup.config))
    setClasses(LayoutSetup.classes)
    setAttributes(LayoutSetup.attributes)
    setCSSVariables(LayoutSetup.cssVariables)
    setTimeout(() => {
      disableSplashScreen()
    }, 500)
  }
  
  const value: LayoutContextModel = {
    config,
    classes,
    attributes,
    cssVariables,
    setLayout,
  }

  // Coordinate with splash screen context
  useEffect(() => {
    if (splashScreenVisible && !splashScreenShown) {
      setSplashScreenShown(true)
    } else if (!splashScreenVisible && splashScreenShown) {
      disableSplashScreen()
      setSplashScreenShown(false)
    } else if (!splashScreenVisible && !splashScreenShown) {
      // No splash screen context, disable by default
      disableSplashScreen()
    }
  }, [splashScreenVisible, splashScreenShown])

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
}

export {LayoutContext, LayoutProvider}

export function useLayout() {
  return useContext(LayoutContext)
}
