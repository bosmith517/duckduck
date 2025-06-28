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
  const ModernVideoPage = lazy(() => import('../pages/communications/ModernVideoPage'))
  
  // New Video Meeting Components
  const MeetingCreationWizard = lazy(() => import('../components/video/MeetingCreationWizard'))
  const PreCallLobby = lazy(() => import('../components/video/PreCallLobby'))
  const InCallWorkspace = lazy(() => import('../components/video/InCallWorkspace'))
  const PostCallSummary = lazy(() => import('../components/video/PostCallSummary'))
  const TestPage = lazy(() => import('../pages/test/TestPage'))
  const SimpleTestPage = lazy(() => import('../pages/test/SimpleTestPage'))
  
  // Hidden Settings Pages (Now Accessible!)
  const CompanyConfigurationPage = lazy(() => import('../pages/settings/CompanyConfigurationPage'))
  const ServiceLibraryPage = lazy(() => import('../pages/settings/ServiceLibraryPage'))
  const TechnicianProfilesPage = lazy(() => import('../pages/settings/TechnicianProfilesPage'))
  const PhoneNumbersPage = lazy(() => import('../pages/settings/PhoneNumbersPage'))
  const PhoneNumbersSettingsPage = lazy(() => import('../pages/settings/PhoneNumbersSettingsPage'))
  
  // New Hub Pages
  const BillingDashboardPage = lazy(() => import('../pages/billing/BillingDashboardPage'))
  const CommunicationsHubPage = lazy(() => import('../pages/communications/CommunicationsHubPage'))
  const CustomersPage = lazy(() => import('../pages/customers/CustomersPage'))
  
  // Hidden Advanced Modules (Now Accessible!)
  const BuilderPage = lazy(() => import('../pages/layout-builder/BuilderPage'))
  const ProfitabilityPage = lazy(() => import('../pages/reports/ProfitabilityPage'))
  const CustomerPortalPage = lazy(() => import('../pages/customer-portal/CustomerPortalPage'))
  
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
          path='communications/video/*'
          element={
            <SuspensedView>
              <ModernVideoPage />
            </SuspensedView>
          }
        />
        {/* New Video Meeting Workflow */}
        <Route
          path='video-meeting/create'
          element={
            <SuspensedView>
              <MeetingCreationWizard />
            </SuspensedView>
          }
        />
        <Route
          path='video-meeting/:meetingId/lobby'
          element={
            <SuspensedView>
              <PreCallLobby />
            </SuspensedView>
          }
        />
        <Route
          path='video-meeting/:meetingId/room'
          element={
            <SuspensedView>
              <InCallWorkspace />
            </SuspensedView>
          }
        />
        <Route
          path='video-meeting/:meetingId/summary'
          element={
            <SuspensedView>
              <PostCallSummary />
            </SuspensedView>
          }
        />
        {/* Legacy video routes */}
        <Route
          path='video-meeting/*'
          element={
            <SuspensedView>
              <ModernVideoPage />
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
        
        {/* BILLING & PAYMENTS ROUTES - The Revenue Engine! */}
        <Route
          path='billing'
          element={
            <SuspensedView>
              <BillingDashboardPage />
            </SuspensedView>
          }
        />
        <Route
          path='billing/invoices'
          element={
            <SuspensedView>
              <InvoicesPage />
            </SuspensedView>
          }
        />
        <Route
          path='billing/estimates'
          element={
            <SuspensedView>
              <EstimatesPage />
            </SuspensedView>
          }
        />
        <Route
          path='billing/customer-portal'
          element={
            <SuspensedView>
              <CustomerPortalPage />
            </SuspensedView>
          }
        />

        {/* COMMUNICATIONS HUB ROUTES */}
        <Route
          path='communications'
          element={
            <SuspensedView>
              <CommunicationsHubPage />
            </SuspensedView>
          }
        />
        <Route
          path='communications/numbers'
          element={
            <SuspensedView>
              <PhoneNumbersSettingsPage />
            </SuspensedView>
          }
        />

        {/* CUSTOMER MANAGEMENT ROUTES */}
        <Route
          path='customers'
          element={
            <SuspensedView>
              <CustomersPage />
            </SuspensedView>
          }
        />
        <Route
          path='customers/accounts'
          element={
            <SuspensedView>
              <AccountsPage />
            </SuspensedView>
          }
        />
        <Route
          path='customers/contacts'
          element={
            <SuspensedView>
              <ContactsPage />
            </SuspensedView>
          }
        />
        <Route
          path='customers/portal-preview'
          element={
            <SuspensedView>
              <CustomerPortalPage />
            </SuspensedView>
          }
        />

        {/* ENHANCED SETTINGS ROUTES */}
        <Route
          path='settings/company'
          element={
            <SuspensedView>
              <CompanyConfigurationPage />
            </SuspensedView>
          }
        />
        <Route
          path='settings/billing'
          element={
            <SuspensedView>
              <ServiceLibraryPage />
            </SuspensedView>
          }
        />
        <Route
          path='settings/communications'
          element={
            <SuspensedView>
              <PhoneNumbersSettingsPage />
            </SuspensedView>
          }
        />
        <Route
          path='settings/layout'
          element={
            <SuspensedView>
              <BuilderPage />
            </SuspensedView>
          }
        />

        {/* ENHANCED SERVICES ROUTES */}
        <Route
          path='services/inventory'
          element={
            <SuspensedView>
              <InventoryPage />
            </SuspensedView>
          }
        />
        <Route
          path='services/catalog'
          element={
            <SuspensedView>
              <ServiceLibraryPage />
            </SuspensedView>
          }
        />

        {/* ENHANCED TEAM ROUTES */}
        <Route
          path='team/members'
          element={
            <SuspensedView>
              <TeamPage />
            </SuspensedView>
          }
        />
        <Route
          path='team/profiles'
          element={
            <SuspensedView>
              <TechnicianProfilesPage />
            </SuspensedView>
          }
        />

        {/* ENHANCED REPORTS ROUTES */}
        <Route
          path='reports/financial'
          element={
            <SuspensedView>
              <ProfitabilityPage />
            </SuspensedView>
          }
        />
        
        {/* MISSING NAVIGATION ROUTES - Redirect to existing pages */}
        <Route path='jobs/costing' element={<Navigate to='/jobs' />} />
        <Route path='jobs/analytics' element={<Navigate to='/jobs' />} />
        <Route path='jobs/templates' element={<Navigate to='/jobs' />} />
        <Route path='jobs/planning' element={<Navigate to='/jobs' />} />
        
        <Route path='customers/analytics' element={<Navigate to='/customers' />} />
        <Route path='customers/communications' element={<Navigate to='/customers' />} />
        <Route path='customers/feedback' element={<Navigate to='/customers' />} />
        
        <Route path='schedule/tracking' element={<Navigate to='/schedule' />} />
        <Route path='schedule/routes' element={<Navigate to='/schedule' />} />
        <Route path='schedule/mobile' element={<Navigate to='/schedule' />} />
        <Route path='schedule/automation' element={<Navigate to='/schedule' />} />
        
        <Route path='services/equipment' element={<Navigate to='/services/inventory' />} />
        <Route path='services/smart-devices' element={<Navigate to='/services/inventory' />} />
        <Route path='services/analytics' element={<Navigate to='/services/inventory' />} />
        
        <Route path='billing/payments' element={<Navigate to='/billing' />} />
        <Route path='billing/reports' element={<Navigate to='/billing' />} />
        <Route path='billing/automation' element={<Navigate to='/billing' />} />
        <Route path='billing/signatures' element={<Navigate to='/billing' />} />
        
        <Route path='communications/team-chat' element={<Navigate to='/team' />} />
        <Route path='communications/users' element={<Navigate to='/communications' />} />
        <Route path='communications/analytics' element={<Navigate to='/communications' />} />
        
        <Route path='team/users' element={<Navigate to='/team' />} />
        <Route path='team/performance' element={<Navigate to='/team' />} />
        <Route path='team/training' element={<Navigate to='/team' />} />
        <Route path='team/analytics' element={<Navigate to='/team' />} />
        
        <Route path='reports/executive' element={<Navigate to='/reports' />} />
        <Route path='reports/operations' element={<Navigate to='/reports' />} />
        <Route path='reports/customers' element={<Navigate to='/reports' />} />
        <Route path='reports/communications' element={<Navigate to='/reports' />} />
        <Route path='reports/custom' element={<Navigate to='/reports' />} />
        
        <Route path='settings/users' element={<Navigate to='/settings' />} />
        <Route path='settings/notifications' element={<Navigate to='/settings' />} />
        <Route path='settings/security' element={<Navigate to='/settings' />} />
        <Route path='settings/integrations' element={<Navigate to='/settings' />} />
        <Route path='settings/system' element={<Navigate to='/settings' />} />
        
        <Route path='profile/overview' element={<Navigate to='/profile' />} />
        <Route path='profile/projects' element={<Navigate to='/profile' />} />
        <Route path='profile/campaigns' element={<Navigate to='/profile' />} />
        <Route path='profile/documents' element={<Navigate to='/profile' />} />
        <Route path='profile/connections' element={<Navigate to='/profile' />} />
        
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
