

import {FC} from 'react'
import clsx from 'clsx'
import {useLayout} from '../../core'
import {KTIcon} from '../../../helpers'
import {AsideMenu} from './AsideMenu'
import {useSupabaseAuth} from '../../../../app/modules/auth/core/SupabaseAuth'
import {useNavigate} from 'react-router-dom'
import {useOnboardingModal} from '../../../../app/hooks/useOnboardingModal'

const AsideDefault: FC = () => {
  const {config, classes} = useLayout()
  const {aside} = config
  const {tenant} = useSupabaseAuth()
  const navigate = useNavigate()
  const {openOnboarding} = useOnboardingModal()

  // Check if user has skipped onboarding temporarily
  const getSkipStatus = () => {
    const skipData = localStorage.getItem('onboarding_skip')
    if (skipData) {
      const { expiry } = JSON.parse(skipData)
      const now = Date.now()
      if (now < expiry) {
        return {
          isSkipped: true,
          expiry,
          remaining: expiry - now
        }
      } else {
        localStorage.removeItem('onboarding_skip')
      }
    }
    return { isSkipped: false }
  }

  // Calculate onboarding completion percentage
  const getOnboardingProgress = () => {
    if (!tenant) return 0
    
    let completed = 0
    const total = 5 // Total onboarding steps
    
    // Basic info (company name, service type)
    if (tenant.company_name && tenant.service_type) completed += 1
    
    // Business info 
    if (tenant.business_info && Object.keys(tenant.business_info).length > 0) completed += 1
    
    // Service preferences
    if (tenant.service_subtypes && tenant.service_subtypes.length > 0) completed += 1
    
    // Workflow preferences
    if (tenant.workflow_preferences && Object.keys(tenant.workflow_preferences).length > 0) completed += 1
    
    // Complete flag
    if (tenant.onboarding_completed) completed += 1
    
    return Math.round((completed / total) * 100)
  }

  const skipStatus = getSkipStatus()
  const isOnboardingCompleted = tenant?.onboarding_completed === true
  const completionPercentage = getOnboardingProgress()
  const shouldShowReminder = !isOnboardingCompleted && (skipStatus.isSkipped || completionPercentage >= 0)
  

  const handleCompleteOnboarding = () => {
    // Signal OnboardingGuard to open its local modal
    window.dispatchEvent(new CustomEvent('openOnboardingModal'))
  }

  return (
    <div
      id='kt_aside'
      className={clsx('aside card', classes.aside.join(' '), {'d-none': !aside.display})}
      data-kt-drawer='true'
      data-kt-drawer-name='aside'
      data-kt-drawer-activate='{default: true, lg: false}'
      data-kt-drawer-overlay='true'
      data-kt-drawer-width="{default:'200px', '300px': '250px'}"
      data-kt-drawer-direction='start'
      data-kt-drawer-toggle='#kt_aside_mobile_toggle'
    >
      {/* begin::Aside menu */}
      <div className='aside-menu flex-column-fluid'>
        <AsideMenu asideMenuCSSClasses={classes.asideMenu} />
      </div>
      {/* end::Aside menu */}

      {/* begin::Footer */}
      <div className='aside-footer flex-column-auto pt-5 pb-7 px-5' id='kt_aside_footer'>
        {/* begin::Setup Reminder */}
        {shouldShowReminder && (
          <div className='bg-light-primary border border-primary rounded p-3 mb-4'>
            <div className='d-flex align-items-center justify-content-between mb-2'>
              <div className='d-flex align-items-center'>
                <KTIcon iconName='chart-pie-simple' className='fs-6 text-primary me-2' />
                <span className='text-primary fw-bold fs-7'>Setup Progress</span>
              </div>
              <span className='badge badge-light-primary fs-8 fw-bold'>{completionPercentage}%</span>
            </div>
            
            {/* Progress Bar */}
            <div className='bg-light rounded mb-2' style={{ height: '6px' }}>
              <div 
                className='bg-primary rounded' 
                style={{ 
                  height: '6px', 
                  width: `${completionPercentage}%`,
                  transition: 'width 0.3s ease'
                }}
              ></div>
            </div>
            
            {skipStatus.isSkipped ? (
              <p className='text-dark fs-8 mb-2 lh-sm'>
                Time remaining: {Math.floor((skipStatus.remaining || 0) / (60 * 60 * 1000))}h {Math.floor(((skipStatus.remaining || 0) % (60 * 60 * 1000)) / (60 * 1000))}m
              </p>
            ) : (
              <p className='text-dark fs-8 mb-2 lh-sm'>
                {completionPercentage < 50 
                  ? 'Complete setup to unlock all features'
                  : 'Almost done! Finish your setup'
                }
              </p>
            )}
            
            <button
              onClick={handleCompleteOnboarding}
              className='btn btn-primary btn-sm w-100 fs-8'
            >
              {completionPercentage < 50 ? 'Continue Setup' : 'Finish Setup'}
            </button>
          </div>
        )}
        {/* end::Setup Reminder */}
        
        <a
          href='mailto:support@tradeworkspro.com'
          className='btn btn-custom btn-primary w-100'
          data-bs-toggle='tooltip'
          data-bs-trigger='hover'
          data-bs-dismiss-='click'
          title='Get help with TradeWorks Pro features and technical support'
        >
          <span className='btn-label'>Help & Support</span>
          <span className='btn-icon fs-2'>
            <KTIcon iconName='message-text-2' />
          </span>
        </a>
      </div>
      {/* end::Footer */}
    </div>
  )
}

export {AsideDefault}
