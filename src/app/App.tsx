import {Suspense} from 'react'
import {Outlet} from 'react-router-dom'
import {Toaster} from 'react-hot-toast'
import {I18nProvider} from '../_metronic/i18n/i18nProvider'
import {LayoutProvider} from '../_metronic/layout/core'
import {SupabaseAuthInit} from './modules/auth/core/SupabaseAuth'
import {ThemeModeProvider} from '../_metronic/partials/layout/theme-mode/ThemeModeProvider'
import {SoftphoneProvider} from './contexts/SoftphoneContext'

const App = () => {
  return (
    <I18nProvider>
      <LayoutProvider>
        <ThemeModeProvider>
          <SupabaseAuthInit>
            <SoftphoneProvider>
              <Outlet />
              <Toaster />
            </SoftphoneProvider>
          </SupabaseAuthInit>
        </ThemeModeProvider>
      </LayoutProvider>
    </I18nProvider>
  )
}

export {App}
