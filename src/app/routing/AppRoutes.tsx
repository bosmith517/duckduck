/**
 * High level router.
 *
 * Note: It's recommended to compose related routes in internal router
 * components (e.g: `src/app/modules/Auth/pages/AuthPage`, `src/app/BasePage`).
 */

import {FC, useEffect} from 'react'
import {Routes, Route, BrowserRouter, Navigate} from 'react-router-dom'
import PrivateRoutes from './PrivateRoutes'
import {ErrorsPage} from '../modules/errors/ErrorsPage'
import {Logout, AuthPage} from '../modules/auth'
import {useSupabaseAuth} from '../modules/auth/core/SupabaseAuth'
import {App} from '../App'
import {supabase} from '../../supabaseClient'
import UITestPage from '../pages/test/UITestPage'
import VideoTestPage from '../pages/test/VideoTestPage'
import SignalWireTestPage from '../pages/test/SignalWireTestPage'
import AutomationDemoPage from '../pages/test/AutomationDemoPage'
import TrackingPage from '../pages/tracking/TrackingPage'
import CustomerPortalPage from '../pages/customer-portal/CustomerPortalPage'
import  SignalWireSyncTestPage from '../pages/test/SignalWireSyncTestPage'
import SignalWireDebugPage from '../pages/test/SignalWireDebugPage'
import DatabaseTestPage from '../pages/test/DatabaseTestPage'
import TrackingMigrationPage from '../pages/test/TrackingMigrationPage'
import SimpleTrackingTest from '../pages/test/SimpleTrackingTest'
import LandingPage from '../pages/marketing/LandingPage'
import SignupPage from '../pages/marketing/SignupPage'
import HomeownerSignupPage from '../pages/marketing/HomeownerSignupPage'
import CustomerPortalLandingPage from '../pages/marketing/CustomerPortalLandingPage'
import {ResetPasswordPage} from '../pages/auth/ResetPasswordPage'
import {AuthCallbackPage} from '../pages/auth/AuthCallbackPage'
import {AcceptInvitationPage} from '../pages/auth/AcceptInvitationPage'
import {PasswordSetupPage} from '../pages/auth/PasswordSetupPage'
import {PasswordResetTestPage} from '../pages/test/PasswordResetTestPage'
import {SimplePasswordResetTest} from '../pages/test/SimplePasswordResetTest'
import {SupabaseVerifyProxy} from '../pages/auth/SupabaseVerifyProxy'
import MobileRedirectTest from '../pages/test/MobileRedirectTest'
import PwaStartPage from '../pages/PwaStartPage'
import PublicBookingPage from '../pages/bookings/PublicBookingPageV3'
import TestAvailabilityPage from '../pages/bookings/TestAvailabilityPage'


/**
 * Base URL of the website.
 *
 * @see https://facebook.github.io/create-react-app/docs/using-the-public-folder
 */
const {VITE_BASE_URL} = import.meta.env

const AppRoutes: FC = () => {
  const {currentUser, authLoading, user} = useSupabaseAuth() // Use the new authLoading state
  
  // Detect if running as installed PWA
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                (window.navigator as any).standalone === true ||
                document.referrer.includes('android-app://') ||
                new URLSearchParams(window.location.search).get('source') === 'pwa';
  
  // Detect if on mobile device
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  // Add PWA class to body if needed
  useEffect(() => {
    if (isPWA) {
      document.body.classList.add('is-pwa');
    }
  }, [isPWA]);
  
  // Removed password reset detection - now handled directly by Supabase redirect
  
  // Only show the main loading screen during the initial auth check
  if (authLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e3e3e3',
            borderTop: '4px solid #007bff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          <p style={{ color: '#666', fontSize: '16px' }}>Loading TradeWorks Pro...</p>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }
  
  return (
    <BrowserRouter basename={VITE_BASE_URL}>
      <Routes>
        {/* Public routes - accessible without authentication */}
        <Route path='track/:trackingToken' element={<TrackingPage />} />
        <Route path='customer-tracking/:trackingToken' element={<TrackingPage />} />
        <Route path='customer/:customerId' element={<CustomerPortalPage />} />
        <Route path='customer/:customerId/track/:trackingToken' element={<CustomerPortalPage />} />
        <Route path='portal/:token' element={<CustomerPortalPage />} />
        
        {/* Public booking routes */}
        <Route path='book/:slug' element={<PublicBookingPage />} />
        <Route path='test-availability/:slug' element={<TestAvailabilityPage />} />
        
        {/* Marketing routes - always accessible */}
        <Route path='/' element={
          new URLSearchParams(window.location.search).get('source') === 'pwa' 
            ? <PwaStartPage /> 
            : <Navigate to='/auth/login' />
        } />
        <Route path='home' element={<LandingPage />} />
        <Route path='signup' element={<SignupPage />} />
        <Route path='homeowner-signup' element={<HomeownerSignupPage />} />
        <Route path='customer-portal' element={<CustomerPortalLandingPage />} />
        
        {/* Auth routes - accessible without login */}
        <Route path='auth/reset-password' element={<ResetPasswordPage />} />
        <Route path='reset-password' element={<ResetPasswordPage />} />
        <Route path='auth/callback' element={<AuthCallbackPage />} />
        <Route path='auth/v1/verify' element={<SupabaseVerifyProxy />} />
        <Route path='auth/accept-invitation' element={<AcceptInvitationPage />} />
        <Route path='auth/password-setup' element={<PasswordSetupPage />} />
        
        {/* Test routes - accessible without login */}
        <Route path='test-ui' element={<UITestPage />} />
        <Route path='test-video' element={<VideoTestPage />} />
        <Route path='test-signalwire' element={<SignalWireTestPage />} />
        <Route path='test-signalwire-sync' element={<SignalWireSyncTestPage />} />
        <Route path='test-signalwire-debug' element={<SignalWireDebugPage />} />
        <Route path='test-database' element={<DatabaseTestPage />} />
        <Route path='test-tracking-migration' element={<TrackingMigrationPage />} />
        <Route path='test-tracking-simple' element={<SimpleTrackingTest />} />
        <Route path='test-password-reset' element={<SimplePasswordResetTest />} />
        <Route path='automation-demo' element={<AutomationDemoPage />} />
        <Route path='test-mobile-redirect' element={<MobileRedirectTest />} />
        
        {/* Error pages and logout - wrapped in App for consistent layout */}
        <Route element={<App />}>
          <Route path='error/*' element={<ErrorsPage />} />
          <Route path='logout' element={<Logout />} />
        </Route>
        
        {/* Auth and private routes - wrapped in App for providers */}
        {user ? (
          <Route element={<App />}>
            <Route path='/*' element={<PrivateRoutes />} />
            <Route path='auth/*' element={<Navigate to={(isPWA || isMobile) ? '/mobile/my-day' : '/dashboard'} />} />
          </Route>
        ) : (
          <Route element={<App />}>
            <Route path='auth/*' element={<AuthPage />} />
            {/* Removed the catch-all redirect that was interfering with public routes */}
          </Route>
        )}
        
        {/* Final catch-all for truly unmatched routes */}
        <Route path='*' element={<Navigate to='/auth/login' />} />
      </Routes>
    </BrowserRouter>
  )
}

export {AppRoutes}
