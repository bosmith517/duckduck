import {lazy, FC, Suspense} from 'react'
import {Route, Routes, Navigate} from 'react-router-dom'
import {MasterLayout} from '../../_metronic/layout/MasterLayout'
import TopBarProgress from 'react-topbar-progress-indicator'
import {DashboardWrapper} from '../pages/dashboard/DashboardWrapper'
import {getCSSVariableValue} from '../../_metronic/assets/ts/_utils'
import {WithChildren} from '../../_metronic/helpers'
import {useSupabaseAuth} from '../modules/auth/core/SupabaseAuth'
import ProtectedLayout from '../components/onboarding/ProtectedLayout'

const PrivateRoutes = () => {
  const { currentUser } = useSupabaseAuth()
  
  // Redirect to login if not authenticated
  if (!currentUser) {
    return <Navigate to='/auth/login' replace />
  }

  // TradeWorks Pro Pages
  const JobsPage = lazy(() => import('../pages/jobs/JobsPage'))
  const JobDetailsPage = lazy(() => import('../pages/jobs/JobDetailsPage'))
  const ClientsPage = lazy(() => import('../pages/clients/ClientsPage'))
  const AccountsPage = lazy(() => import('../pages/accounts/AccountsPage'))
  const ContactsPage = lazy(() => import('../pages/contacts/ContactsPage'))
  const ContactDetailsPage = lazy(() => import('../pages/contacts/ContactDetailsPage'))
  const EstimatesPage = lazy(() => import('../pages/estimates/EstimatesPage'))
  const TemplateDrivenEstimatesPage = lazy(() => import('../pages/estimates/TemplateDrivenEstimatesPage'))
  const RealTimeJobCostingPage = lazy(() => import('../pages/job-costing/RealTimeJobCostingPage'))
  const InvoicesPage = lazy(() => import('../pages/invoices/InvoicesPage'))
  const InventoryPage = lazy(() => import('../pages/inventory/InventoryPage'))
  const SchedulePage = lazy(() => import('../pages/schedule/SchedulePage'))
  const ReportsPage = lazy(() => import('../pages/reports/ReportsPage'))
  const TeamPage = lazy(() => import('../pages/team/TeamPage'))
  const PerformancePage = lazy(() => import('../pages/team/PerformancePage'))
  const TrainingPage = lazy(() => import('../pages/team/TrainingPage'))
  const TeamAnalyticsPage = lazy(() => import('../pages/team/TeamAnalyticsPage'))
  const LeadsPage = lazy(() => import('../pages/leads/LeadsPage'))
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
  const BackendConnectivityTest = lazy(() => import('../components/test/BackendConnectivityTest'))
  
  // Hidden Settings Pages (Now Accessible!)
  const CompanyConfigurationPage = lazy(() => import('../pages/settings/CompanyConfigurationPage'))
  const ServiceLibraryPage = lazy(() => import('../pages/settings/ServiceLibraryPage'))
  const TechnicianProfilesPage = lazy(() => import('../pages/settings/TechnicianProfilesPage'))
  const PhoneNumbersPage = lazy(() => import('../pages/settings/PhoneNumbersPage'))
  const PhoneNumbersSettingsPage = lazy(() => import('../pages/settings/PhoneNumbersSettingsPage'))
  const SubprojectManagementPage = lazy(() => import('../pages/settings/SubprojectManagementPage'))
  
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
  
  // Missing Critical Pages
  const BrandingSettingsPage = lazy(() => import('../pages/settings/BrandingSettingsPage'))
  const SupplierBrandingPage = lazy(() => import('../pages/settings/SupplierBrandingPage'))
  const BillingPage = lazy(() => import('../pages/settings/BillingPage'))
  const MobileTrackingPage = lazy(() => import('../pages/mobile/MobileTrackingPage'))
  const HomeownerPortalPage = lazy(() => import('../pages/homeowner/HomeownerPortalPage'))
  const MenuTestPage = lazy(() => import('../pages/MenuTestPage'))
  const AutomationDemoPage = lazy(() => import('../pages/test/AutomationDemoPage'))
  const DatabaseTestPage = lazy(() => import('../pages/test/DatabaseTestPage'))
  const SignalWireTestPage = lazy(() => import('../pages/test/SignalWireTestPage'))
  const SignalWireSyncTestPage = lazy(() => import('../pages/test/SignalWireSyncTestPage'))
  const TrackingMigrationPage = lazy(() => import('../pages/test/TrackingMigrationPage'))
  const UITestPage = lazy(() => import('../pages/test/UITestPage'))
  const VideoTestPage = lazy(() => import('../pages/test/VideoTestPage'))
  const TrackingPage = lazy(() => import('../pages/tracking/TrackingPage'))
  const TrackingOverviewPage = lazy(() => import('../pages/tracking/TrackingOverviewPage'))
  const LandingPage = lazy(() => import('../pages/marketing/LandingPage'))
  const HomeownerSignupPage = lazy(() => import('../pages/marketing/HomeownerSignupPage'))
  const CustomerPortalLandingPage = lazy(() => import('../pages/marketing/CustomerPortalLandingPage'))
  const SignupPage = lazy(() => import('../pages/marketing/SignupPage'))

  // Note: Onboarding is now handled via modal in MasterLayout

  return (
    <Routes>
      {/* Main application */}
      <Route element={<MasterLayout />}>
        <Route element={<ProtectedLayout />}>
        {/* Redirect to Dashboard after success login/registartion */}
        <Route path='auth/*' element={<Navigate to='/' />} />
        <Route index element={<DashboardWrapper />} />
        
          {/* Main Dashboard - accessible via index route */}
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
          path='jobs/costing'
          element={
            <SuspensedView>
              <RealTimeJobCostingPage />
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
            path='leads'
            element={
              <SuspensedView>
                <LeadsPage />
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
          path='estimates/templates'
          element={
            <SuspensedView>
              <TemplateDrivenEstimatesPage />
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
              <VideoPage />
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
        
        {/* Backend Connectivity Test */}
        <Route
          path='test-backend'
          element={
            <SuspensedView>
              <BackendConnectivityTest />
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
        <Route path='profile' element={<Navigate to='/profile/overview' />} />
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
          path='billing/estimates/templates'
          element={
            <SuspensedView>
              <TemplateDrivenEstimatesPage />
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
          path='settings/branding'
          element={
            <SuspensedView>
              <BrandingSettingsPage />
            </SuspensedView>
          }
        />
        <Route
          path='settings/supplier-branding'
          element={
            <SuspensedView>
              <SupplierBrandingPage />
            </SuspensedView>
          }
        />
        <Route
          path='settings/billing'
          element={
            <SuspensedView>
              <BillingPage />
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
          path='settings/subprojects'
          element={
            <SuspensedView>
              <SubprojectManagementPage />
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
        
        {/* MOBILE & FIELD OPERATIONS ROUTES */}
        <Route
          path='mobile/tracking'
          element={
            <SuspensedView>
              <MobileTrackingPage />
            </SuspensedView>
          }
        />
        
        {/* TRACKING & FLEET MANAGEMENT ROUTES */}
        <Route
          path='tracking/*'
          element={
            <SuspensedView>
              <TrackingOverviewPage />
            </SuspensedView>
          }
        />
        
        {/* HOMEOWNER & CUSTOMER PORTAL ROUTES */}
        <Route
          path='homeowner-portal'
          element={
            <SuspensedView>
              <HomeownerPortalPage />
            </SuspensedView>
          }
        />
        
        {/* ADVANCED TEST PAGES */}
        <Route
          path='test/menu'
          element={
            <SuspensedView>
              <MenuTestPage />
            </SuspensedView>
          }
        />
        <Route
          path='test/automation'
          element={
            <SuspensedView>
              <AutomationDemoPage />
            </SuspensedView>
          }
        />
        <Route
          path='test/database'
          element={
            <SuspensedView>
              <DatabaseTestPage />
            </SuspensedView>
          }
        />
        <Route
          path='test/signalwire'
          element={
            <SuspensedView>
              <SignalWireTestPage />
            </SuspensedView>
          }
        />
        <Route
          path='test/signalwire-sync'
          element={
            <SuspensedView>
              <SignalWireSyncTestPage />
            </SuspensedView>
          }
        />
        <Route
          path='test/tracking-migration'
          element={
            <SuspensedView>
              <TrackingMigrationPage />
            </SuspensedView>
          }
        />
        <Route
          path='test/ui'
          element={
            <SuspensedView>
              <UITestPage />
            </SuspensedView>
          }
        />
        <Route
          path='test/video'
          element={
            <SuspensedView>
              <VideoTestPage />
            </SuspensedView>
          }
        />
        
        {/* MISSING NAVIGATION ROUTES - Redirect to existing pages */}
        <Route path='jobs/analytics' element={<Navigate to='/jobs' />} />
        <Route path='jobs/templates' element={<Navigate to='/jobs' />} />
        <Route path='jobs/planning' element={<Navigate to='/jobs' />} />
        
        <Route path='customers/analytics' element={<Navigate to='/customers' />} />
        <Route path='customers/communications' element={<Navigate to='/customers' />} />
        <Route path='customers/feedback' element={<Navigate to='/customers' />} />
        
        <Route path='schedule/tracking' element={<Navigate to='/mobile/tracking' />} />
        <Route path='schedule/routes' element={<Navigate to='/schedule' />} />
        <Route path='schedule/mobile' element={<Navigate to='/mobile/tracking' />} />
        <Route path='schedule/automation' element={<Navigate to='/schedule' />} />
        
        <Route path='services/equipment' element={<Navigate to='/services/inventory' />} />
        <Route path='services/smart-devices' element={<Navigate to='/services/inventory' />} />
        <Route path='services/analytics' element={<Navigate to='/services/inventory' />} />
        
        <Route path='billing/payments' element={<Navigate to='/billing' />} />
        <Route path='billing/reports' element={<Navigate to='/reports/financial' />} />
        <Route path='billing/automation' element={<Navigate to='/billing' />} />
        <Route path='billing/signatures' element={<Navigate to='/billing' />} />
        
        <Route path='communications/team-chat' element={<Navigate to='/team' />} />
        <Route path='communications/users' element={<Navigate to='/communications' />} />
        <Route path='communications/analytics' element={<Navigate to='/communications' />} />
        
        <Route path='team/users' element={<Navigate to='/team' />} />
        <Route
          path='team/performance'
          element={
            <SuspensedView>
              <PerformancePage />
            </SuspensedView>
          }
        />
        <Route
          path='team/training'
          element={
            <SuspensedView>
              <TrainingPage />
            </SuspensedView>
          }
        />
        <Route
          path='team/analytics'
          element={
            <SuspensedView>
              <TeamAnalyticsPage />
            </SuspensedView>
          }
        />
        
        <Route path='reports/executive' element={<Navigate to='/reports' />} />
        <Route path='reports/operations' element={<Navigate to='/reports' />} />
        <Route path='reports/customers' element={<Navigate to='/reports' />} />
        <Route path='reports/communications' element={<Navigate to='/reports' />} />
        <Route path='reports/custom' element={<Navigate to='/reports' />} />
        
        <Route path='settings/users' element={<Navigate to='/team/profiles' />} />
        <Route path='settings/system' element={<Navigate to='/test/database' />} />
        
        {/* Profile sub-routes are handled by ProfilePage internally */}
        
          {/* Page Not Found */}
          <Route path='*' element={<Navigate to='/error/404' />} />
        </Route>
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

export default PrivateRoutes
