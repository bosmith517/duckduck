import {useIntl} from 'react-intl'
import {PageTitle} from '../../../_metronic/layout/core'
import {
  ListsWidget2,
  ListsWidget3,
  ListsWidget4,
  ListsWidget5,
  ListsWidget6,
  MixedWidget10,
  MixedWidget11,
  MixedWidget2,
  MixedWidget8,
  TablesWidget10,
  TilesWidget1,
  TilesWidget2,
  TilesWidget3,
  TilesWidget4,
  TilesWidget5,
} from '../../../_metronic/partials/widgets'
import NewFeaturesWidget from '../../components/dashboard/NewFeaturesWidget'
import { useSupabaseAuth } from '../../../app/modules/auth/core/SupabaseAuth'
import { KTIcon } from '../../../_metronic/helpers'
import { supabase } from '../../../supabaseClient'
import { NewInquiryButton } from '../../components/workflows/WorkflowLauncher'
import { useUserPermissions } from '../../hooks/useUserPermissions'
import StepTracker from '../../components/journey/StepTracker'
import { useCustomerJourneyStore } from '../../stores/customerJourneyStore'
import { config } from '../../../lib/config'
import { useNavigate } from 'react-router-dom'

const DashboardPage = () => {
  const { tenant } = useSupabaseAuth()
  const { canManageInfrastructure } = useUserPermissions()
  const { leadId, step } = useCustomerJourneyStore()
  const navigate = useNavigate()
  
  // Show quick setup if onboarding not completed
  const showQuickSetup = !tenant?.onboarding_completed
  
  // Show journey tracker if there's an active journey and unified journey is enabled
  const showJourneyTracker = leadId && step !== 'completed' && config.journey.enabled

  const handleQuickSetup = () => {
    // Quick Setup button clicked
    // Signal OnboardingGuard to open its local modal (same as sidebar)
    window.dispatchEvent(new CustomEvent('openOnboardingModal'))
    // openOnboardingModal event dispatched
  }

  // TEMPORARY: Function to create subproject
  const handleCreateSubproject = async () => {
    if (!tenant) return
    
    // Creating subproject for tenant
    try {
      const { data, error } = await supabase.functions.invoke('create-signalwire-subproject', {
        body: {
          tenantId: tenant.id,
          companyName: tenant.company_name
        }
      })
      
      if (error) {
        console.error('Error creating subproject:', error)
        alert('Error creating subproject: ' + error.message)
      } else {
        console.log('Subproject created successfully:', data)
        alert('Subproject created successfully! Check console for details.')
      }
    } catch (err) {
      console.error('Exception creating subproject:', err)
      alert('Exception: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  // TEMPORARY: Function to repair incomplete setup
  const handleRepairSetup = async () => {
    if (!tenant) return
    
    console.log('Repairing setup for tenant:', tenant.id)
    try {
      const { data, error } = await supabase.functions.invoke('repair-tenant-setup', {
        body: {
          tenantId: tenant.id
        }
      })
      
      if (error) {
        console.error('Error repairing setup:', error)
        alert('Error repairing setup: ' + error.message)
      } else {
        console.log('Repair completed:', data)
        alert('Setup repair completed! Check console for details.')
      }
    } catch (err) {
      console.error('Exception repairing setup:', err)
      alert('Exception: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  return (
  <>
    {/* Platform Admin Controls - Only visible to platform users */}
    {canManageInfrastructure() && (
      <div className='row g-5 g-xl-8 mb-4'>
        <div className='col-12'>
          <div className='alert alert-warning d-flex align-items-center justify-content-between p-5'>
            <div>
              <h4 className='mb-1'>PLATFORM ADMIN: SignalWire Management</h4>
              <p className='mb-0'>Platform controls for tenant: {tenant?.company_name}</p>
            </div>
            <div className='d-flex gap-2'>
              <button 
                className='btn btn-warning'
                onClick={handleCreateSubproject}
              >
                Create Subproject
              </button>
              <button 
                className='btn btn-info'
                onClick={handleRepairSetup}
              >
                Repair Setup
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Customer Journey Controls - Visible to all contractor users */}
    <div className='row g-5 g-xl-8 mb-4'>
      <div className='col-12'>
        <div className='alert alert-success d-flex align-items-center justify-content-between p-5'>
          <div>
            <h4 className='mb-1'>Customer Journey</h4>
            <p className='mb-0'>Start your automated customer workflow - from call to completion</p>
          </div>
          <div className='d-flex gap-2'>
            <NewInquiryButton 
              onSuccess={() => window.location.href = '/leads'}
              variant='success'
              size='lg'
            />
            <a href='/leads' className='btn btn-primary'>
              <KTIcon iconName='notepad-edit' className='fs-4 me-2' />
              Manage Leads
            </a>
          </div>
        </div>
      </div>
    </div>

    {/* Active Journey Tracker */}
    {showJourneyTracker && (
      <div className='row g-5 g-xl-8 mb-6'>
        <div className='col-12'>
          <div className='card'>
            <div className='card-header border-0 pt-5'>
              <h3 className='card-title align-items-start flex-column'>
                <span className='card-label fw-bold fs-3 mb-1'>Active Customer Journey</span>
                <span className='text-muted mt-1 fw-semibold fs-7'>Track progress from inquiry to completion</span>
              </h3>
            </div>
            <div className='card-body pt-0'>
              <StepTracker 
                showDescriptions={true}
                showAISuggestions={true}
                onStepClick={(step) => {
                  // Navigate to appropriate page based on step (SPA navigation)
                  switch (step) {
                    case 'new_inquiry':
                      navigate('/leads')
                      break
                    case 'site_visit':
                      navigate('/schedule')
                      break
                    case 'estimate':
                      navigate('/estimates')
                      break
                    case 'conversion':
                      navigate('/estimates')
                      break
                    case 'job_tracking':
                      navigate('/jobs')
                      break
                    case 'portal':
                      navigate('/billing/customer-portal')
                      break
                    default:
                      break
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Quick Setup Banner - For contractor users */}
    {showQuickSetup && !canManageInfrastructure() && (
      <div className='row g-5 g-xl-8 mb-8'>
        <div className='col-12'>
          <div className='alert alert-primary d-flex align-items-center p-5'>
            <div className='symbol symbol-40px me-4'>
              <div className='symbol-label bg-white'>
                <KTIcon iconName='rocket' className='fs-2 text-primary' />
              </div>
            </div>
            <div className='d-flex flex-column flex-grow-1'>
              <h4 className='mb-1 text-dark'>Complete Your Account Setup</h4>
              <span className='fw-semibold fs-6 text-gray-600'>
                Get the most out of TradeWorks Pro by completing your business setup
              </span>
            </div>
            <button 
              className='btn btn-light-primary btn-sm'
              onClick={handleQuickSetup}
            >
              <KTIcon iconName='setting-3' className='fs-6 me-2' />
              Quick Setup
            </button>
          </div>
        </div>
      </div>
    )}

    {/* KPI Cards Row */}
    <div className='row g-5 g-xl-8 mb-8'>
      <div className='col-xl-3'>
        <div className='card card-xl-stretch mb-xl-8'>
          <div className='card-body'>
            <div className='d-flex align-items-center'>
              <div className='symbol symbol-50px me-5'>
                <div className='symbol-label bg-light-primary'>
                  <i className='ki-duotone ki-briefcase fs-2x text-primary'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                  </i>
                </div>
              </div>
              <div className='d-flex flex-column'>
                <span className='fw-bold fs-6 text-gray-800'>12</span>
                <span className='fw-semibold fs-7 text-gray-400'>Active Jobs</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className='col-xl-3'>
        <div className='card card-xl-stretch mb-xl-8'>
          <div className='card-body'>
            <div className='d-flex align-items-center'>
              <div className='symbol symbol-50px me-5'>
                <div className='symbol-label bg-light-warning'>
                  <i className='ki-duotone ki-file-text fs-2x text-warning'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                  </i>
                </div>
              </div>
              <div className='d-flex flex-column'>
                <span className='fw-bold fs-6 text-gray-800'>8</span>
                <span className='fw-semibold fs-7 text-gray-400'>Pending Estimates</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className='col-xl-3'>
        <div className='card card-xl-stretch mb-xl-8'>
          <div className='card-body'>
            <div className='d-flex align-items-center'>
              <div className='symbol symbol-50px me-5'>
                <div className='symbol-label bg-light-danger'>
                  <i className='ki-duotone ki-bill fs-2x text-danger'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                    <span className='path3'></span>
                    <span className='path4'></span>
                    <span className='path5'></span>
                    <span className='path6'></span>
                  </i>
                </div>
              </div>
              <div className='d-flex flex-column'>
                <span className='fw-bold fs-6 text-gray-800'>3</span>
                <span className='fw-semibold fs-7 text-gray-400'>Overdue Invoices</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className='col-xl-3'>
        <div className='card card-xl-stretch mb-xl-8'>
          <div className='card-body'>
            <div className='d-flex align-items-center'>
              <div className='symbol symbol-50px me-5'>
                <div className='symbol-label bg-light-success'>
                  <i className='ki-duotone ki-dollar fs-2x text-success'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                    <span className='path3'></span>
                  </i>
                </div>
              </div>
              <div className='d-flex flex-column'>
                <span className='fw-bold fs-6 text-gray-800'>$45,200</span>
                <span className='fw-semibold fs-7 text-gray-400'>Revenue This Month</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* New Features Showcase */}
    <div className='row g-5 g-xl-8 mb-8'>
      <div className='col-xl-12'>
        <NewFeaturesWidget />
      </div>
    </div>

    {/* Charts and Widgets Row */}
    <div className='row g-5 g-xl-8 mb-8'>
      <div className='col-xl-8'>
        <div className='card card-xl-stretch mb-xl-8'>
          <div className='card-header border-0 pt-5'>
            <h3 className='card-title align-items-start flex-column'>
              <span className='card-label fw-bold fs-3 mb-1'>Monthly Revenue Trend</span>
              <span className='text-muted mt-1 fw-semibold fs-7'>Revenue performance over the last 6 months</span>
            </h3>
          </div>
          <div className='card-body'>
            <MixedWidget8
              className='card-xxl-stretch'
              chartColor='success'
              chartHeight='300px'
            />
          </div>
        </div>
      </div>
      
      <div className='col-xl-4'>
        <div className='card card-xl-stretch mb-xl-8'>
          <div className='card-header border-0 pt-5'>
            <h3 className='card-title align-items-start flex-column'>
              <span className='card-label fw-bold fs-3 mb-1'>Quick Actions</span>
              <span className='text-muted mt-1 fw-semibold fs-7'>Common tasks</span>
            </h3>
          </div>
          <div className='card-body'>
            <div className='d-flex flex-column'>
              <a href='/estimates' className='btn btn-light-primary mb-3'>
                <i className='ki-duotone ki-plus fs-2 me-2'></i>
                Create New Estimate
              </a>
              <a href='/jobs' className='btn btn-light-info mb-3'>
                <i className='ki-duotone ki-briefcase fs-2 me-2'></i>
                View Active Jobs
              </a>
              <a href='/invoices' className='btn btn-light-warning mb-3'>
                <i className='ki-duotone ki-bill fs-2 me-2'></i>
                Review Overdue Invoices
              </a>
              <a href='/reports' className='btn btn-light-success'>
                <i className='ki-duotone ki-chart-simple fs-2 me-2'></i>
                Generate Project Report
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </>
  )
}

const DashboardWrapper = () => {
  const intl = useIntl()
  return (
    <>
      <PageTitle breadcrumbs={[]}>{intl.formatMessage({id: 'MENU.DASHBOARD'})}</PageTitle>
      <DashboardPage />
    </>
  )
}

export {DashboardWrapper}
