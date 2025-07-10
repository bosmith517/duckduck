import {createRoot} from 'react-dom/client'
// Bootstrap
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
// Metronic
import {MenuComponent} from './_metronic/assets/ts/components'
// Axios
import axios from 'axios'
import {Chart, registerables} from 'chart.js'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {ReactQueryDevtools} from '@tanstack/react-query-devtools'
// Apps
import {MetronicI18nProvider} from './_metronic/i18n/Metronici18n'
import './_metronic/assets/sass/style.react.scss'
import './_metronic/assets/fonticon/fonticon.css'
import './_metronic/assets/keenicons/duotone/style.css'
import './_metronic/assets/keenicons/outline/style.css'
import './_metronic/assets/keenicons/solid/style.css'
/**
 * TIP: Replace this style import with rtl styles to enable rtl mode
 *
 * import './_metronic/assets/css/style.rtl.css'
 **/
import './_metronic/assets/sass/style.scss'
import './app/override-splash.css'
import './app/tradeworks-branding.css'
// import './app/mobile-pwa-safe.css' // Disabled - causing issues
import {AppRoutes} from './app/routing/AppRoutes'
import {SupabaseAuthProvider} from './app/modules/auth/core/SupabaseAuth'
import {setupAxios} from './app/modules/auth'
import {SplashScreenWrapper} from './_metronic/layout/core/SplashScreenWrapper'
/**
 * Creates `axios-mock-adapter` instance for provided `axios` instance, add
 * basic Metronic mocks and returns it.
 *
 * @see https://github.com/ctimmerm/axios-mock-adapter
 */
/**
 * Inject Metronic interceptors for axios.
 *
 * @see https://github.com/axios/axios#interceptors
 */
setupAxios(axios)
Chart.register(...registerables)

// Initialize Metronic components
MenuComponent.bootstrap()

const queryClient = new QueryClient()
const container = document.getElementById('root')
if (container) {
  createRoot(container).render(
    <QueryClientProvider client={queryClient}>
      <MetronicI18nProvider>
        <SplashScreenWrapper>
          <SupabaseAuthProvider>
            <AppRoutes />
          </SupabaseAuthProvider>
        </SplashScreenWrapper>
      </MetronicI18nProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
  
  // Aggressively remove splash screen elements and classes
  const removeSplashScreen = () => {
    // Remove loading classes from body
    document.body.classList.remove('page-loading')
    document.body.removeAttribute('data-kt-app-page-loading')
    
    // Remove any splash screen elements
    const splashElements = document.querySelectorAll(
      '.splash-screen, #splash-screen, .page-loader, [class*="splash"], [id*="splash"]'
    )
    splashElements.forEach(el => {
      if (el && el.parentNode) {
        el.parentNode.removeChild(el)
      }
    })
    
    // Force hide any remaining elements
    const style = document.createElement('style')
    style.id = 'force-hide-splash'
    style.textContent = `
      .splash-screen, #splash-screen, .page-loader { display: none !important; visibility: hidden !important; }
      body.page-loading, body[data-kt-app-page-loading="on"] { overflow: visible !important; }
      .page-loading .splash-screen, .page-loading #splash-screen { display: none !important; }
    `
    document.head.appendChild(style)
    
    // Also ensure root is visible
    const root = document.getElementById('root')
    if (root) {
      root.style.display = 'block'
      root.style.visibility = 'visible'
    }
  }
  
  // Run immediately and after delays
  removeSplashScreen()
  setTimeout(removeSplashScreen, 50)
  setTimeout(removeSplashScreen, 100)
  setTimeout(removeSplashScreen, 200)
  setTimeout(removeSplashScreen, 500)
  setTimeout(removeSplashScreen, 1000)
  
  // Also run on DOM content loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removeSplashScreen)
  }
  
  // Register Service Worker for PWA functionality
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('TradeWorks Pro: Service Worker registered successfully:', registration.scope)
          
          // Check for updates periodically
          setInterval(() => {
            registration.update()
          }, 60 * 60 * 1000) // Check every hour
          
          // Handle updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New update available
                  console.log('TradeWorks Pro: New version available! Refresh to update.')
                  // You could show a notification to the user here
                }
              })
            }
          })
        })
        .catch((error) => {
          console.error('TradeWorks Pro: Service Worker registration failed:', error)
        })
    })
  }
}
