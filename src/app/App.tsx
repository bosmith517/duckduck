import {Suspense} from 'react'
import {Outlet} from 'react-router-dom'
import {Toaster} from 'react-hot-toast'
import {I18nProvider} from '../_metronic/i18n/i18nProvider'
import {LayoutProvider} from '../_metronic/layout/core'
import {useSupabaseAuth} from './modules/auth/core/SupabaseAuth'
import {ThemeModeProvider} from '../_metronic/partials/layout/theme-mode/ThemeModeProvider'
import {SoftphoneProvider} from './contexts/SoftphoneContext'
import {BrandingProvider} from './contexts/BrandingContext'
import {useAuthCallback} from './hooks/useAuthCallback'
import TradeWorksSplashScreen from './components/branding/TradeWorksSplashScreen'

const App = () => {
  // Handle auth callbacks from any page
  useAuthCallback();
  const { authLoading } = useSupabaseAuth();
  
  if (authLoading) {
    return <TradeWorksSplashScreen />
  }
  
  return (
    <I18nProvider>
      <LayoutProvider>
        <ThemeModeProvider>
          <BrandingProvider>
            <SoftphoneProvider>
              <Outlet />
              <Toaster />
            </SoftphoneProvider>
          </BrandingProvider>
        </ThemeModeProvider>
      </LayoutProvider>
    </I18nProvider>
  )
}

export {App}
