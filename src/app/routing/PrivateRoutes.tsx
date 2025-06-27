import {lazy, FC, Suspense} from 'react'
import {Route, Routes, Navigate} from 'react-router-dom'
import {MasterLayout} from '../../_metronic/layout/MasterLayout'
import TopBarProgress from 'react-topbar-progress-indicator'
import {DashboardWrapper} from '../pages/dashboard/DashboardWrapper'
import {getCSSVariableValue} from '../../_metronic/assets/ts/_utils'
import {WithChildren} from '../../_metronic/helpers'

const PrivateRoutes = () => {
  // TradeWorks Pro Pages
  const JobsPage = lazy(() => import('../pages/jobs/JobsPage'))
  const JobDetailsPage = lazy(() => import('../pages/jobs/JobDetailsPage'))
  const ClientsPage = lazy(() => import('../pages/clients/ClientsPage'))
  const AccountsPage = lazy(() => import('../pages/accounts/AccountsPage'))
  const ContactsPage = lazy(() => import('../pages/contacts/ContactsPage'))
  const ContactDetailsPage = lazy(() => import('../pages/contacts/ContactDetailsPage'))
  const EstimatesPage = lazy(() => import('../pages/estimates/EstimatesPage'))
  const InvoicesPage = lazy(() => import('../pages/invoices/InvoicesPage'))
  const InventoryPage = lazy(() => import('../pages/inventory/InventoryPage'))
  const SchedulePage = lazy(() => import('../pages/schedule/SchedulePage'))
  const ReportsPage = lazy(() => import('../pages/reports/ReportsPage'))
  const TeamPage = lazy(() => import('../pages/team/TeamPage'))
  const SettingsPage = lazy(() => import('../pages/settings/SettingsPage'))
  const CallCenterPage = lazy(() => import('../pages/communications/CallCenterPage'))
  const VideoPage = lazy(() => import('../pages/communications/VideoPage'))
  const TestPage = lazy(() => import('../pages/test/TestPage'))
  const SimpleTestPage = lazy(() => import('../pages/test/SimpleTestPage'))
  
  // Profile and Account Pages
  const ProfilePage = lazy(() => import('../modules/profile/ProfilePage'))
  const AccountPage = lazy(() => import('../modules/accounts/AccountPage'))

  return (
    <Routes>
      <Route element={<MasterLayout />}>
        {/* Redirect to Dashboard after success login/registartion */}
        <Route path='auth/*' element={<Navigate to='/dashboard' />} />
        
        {/* Main Dashboard */}
        <Route path='dashboard' element={<DashboardWrapper />} />
        
        {/* TradeWorks Pro Core Pages */}
        <Route
          path='jobs'
          element={
            <SuspensedView>
              <JobsPage />
            </SuspensedView>
          }
        />
        <Route
          path='jobs/:id'
          element={
            <SuspensedView>
              <JobDetailsPage />
            </SuspensedView>
          }
        />
        <Route
          path='clients/*'
          element={
            <SuspensedView>
              <ClientsPage />
            </SuspensedView>
          }
        />
        <Route
          path='accounts/*'
          element={
            <SuspensedView>
              <AccountsPage />
            </SuspensedView>
          }
        />
        <Route
          path='contacts'
          element={
            <SuspensedView>
              <ContactsPage />
            </SuspensedView>
          }
        />
        <Route
          path='contacts/:id'
          element={
            <SuspensedView>
              <ContactDetailsPage />
            </SuspensedView>
          }
        />
        <Route
          path='estimates/*'
          element={
            <SuspensedView>
              <EstimatesPage />
            </SuspensedView>
          }
        />
        <Route
          path='invoices/*'
          element={
            <SuspensedView>
              <InvoicesPage />
            </SuspensedView>
          }
        />
        <Route
          path='inventory/*'
          element={
            <SuspensedView>
              <InventoryPage />
            </SuspensedView>
          }
        />
        <Route
          path='schedule/*'
          element={
            <SuspensedView>
              <SchedulePage />
            </SuspensedView>
          }
        />
        <Route
          path='reports/*'
          element={
            <SuspensedView>
              <ReportsPage />
            </SuspensedView>
          }
        />
        <Route
          path='team/*'
          element={
            <SuspensedView>
              <TeamPage />
            </SuspensedView>
          }
        />
        <Route
          path='settings/*'
          element={
            <SuspensedView>
              <SettingsPage />
            </SuspensedView>
          }
        />
        {/* Communications Hub */}
        <Route
          path='communications/call-center'
          element={
            <SuspensedView>
              <CallCenterPage />
            </SuspensedView>
          }
        />
        <Route
          path='communications/voicemail'
          element={
            <SuspensedView>
              <CallCenterPage />
            </SuspensedView>
          }
        />
        <Route
          path='communications/sms'
          element={
            <SuspensedView>
              <CallCenterPage />
            </SuspensedView>
          }
        />
        <Route
          path='communications/video'
          element={
            <SuspensedView>
              <VideoPage />
            </SuspensedView>
          }
        />
        {/* Legacy route redirect */}
        <Route path='call-center' element={<Navigate to='/communications/call-center' />} />
        
        {/* Test Page */}
        <Route
          path='test/*'
          element={
            <SuspensedView>
              <TestPage />
            </SuspensedView>
          }
        />
        
        {/* Simple Test Page - No Layout */}
        <Route
          path='simple-test'
          element={
            <SuspensedView>
              <SimpleTestPage />
            </SuspensedView>
          }
        />
        
        {/* Profile and Account */}
        <Route
          path='profile/*'
          element={
            <SuspensedView>
              <ProfilePage />
            </SuspensedView>
          }
        />
        <Route
          path='account/*'
          element={
            <SuspensedView>
              <AccountPage />
            </SuspensedView>
          }
        />
        
        {/* Page Not Found */}
        <Route path='*' element={<Navigate to='/error/404' />} />
      </Route>
    </Routes>
  )
}

const SuspensedView: FC<WithChildren> = ({children}) => {
  const baseColor = getCSSVariableValue('--bs-primary')
  TopBarProgress.config({
    barColors: {
      '0': baseColor,
    },
    barThickness: 1,
    shadowBlur: 5,
  })
  return <Suspense fallback={<TopBarProgress />}>{children}</Suspense>
}

export {PrivateRoutes}
