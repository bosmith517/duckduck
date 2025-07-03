import React, { useState, useEffect } from 'react'
import { useSupabaseAuth } from '../../../modules/auth/core/SupabaseAuth'
import { supabase } from '../../../../supabaseClient'
import { showToast } from '../../../utils/toast'

interface NotificationPreferences {
  email_new_jobs: boolean
  email_job_updates: boolean
  email_estimates: boolean
  email_invoices: boolean
  email_marketing: boolean
  sms_new_jobs: boolean
  sms_job_updates: boolean
  sms_estimates: boolean
  sms_invoices: boolean
  push_new_jobs: boolean
  push_job_updates: boolean
  push_estimates: boolean
  push_invoices: boolean
  quiet_hours_enabled: boolean
  quiet_hours_start: string
  quiet_hours_end: string
  timezone: string
}

export const NotificationSettings: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  const [loading, setLoading] = useState(false)
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email_new_jobs: true,
    email_job_updates: true,
    email_estimates: true,
    email_invoices: true,
    email_marketing: false,
    sms_new_jobs: false,
    sms_job_updates: false,
    sms_estimates: false,
    sms_invoices: false,
    push_new_jobs: true,
    push_job_updates: true,
    push_estimates: true,
    push_invoices: true,
    quiet_hours_enabled: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '08:00',
    timezone: 'America/New_York'
  })

  useEffect(() => {
    if (userProfile?.id) {
      loadNotificationPreferences()
    }
  }, [userProfile?.id])

  const loadNotificationPreferences = async () => {
    if (!userProfile?.id) return

    try {
      const { data, error } = await supabase
        .from('user_notification_preferences')
        .select('*')
        .eq('user_id', userProfile.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading notification preferences:', error)
        return
      }

      if (data) {
        setPreferences(data)
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error)
    }
  }

  const handleToggle = (key: keyof NotificationPreferences) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const handleTimeChange = (key: 'quiet_hours_start' | 'quiet_hours_end', value: string) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleTimezoneChange = (value: string) => {
    setPreferences(prev => ({
      ...prev,
      timezone: value
    }))
  }

  const savePreferences = async () => {
    if (!userProfile?.id) return

    setLoading(true)
    const loadingToast = showToast.loading('Updating notification preferences...')

    try {
      const { error } = await supabase
        .from('user_notification_preferences')
        .upsert({
          user_id: userProfile.id,
          ...preferences,
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      showToast.dismiss(loadingToast)
      showToast.success('Notification preferences updated successfully!')

    } catch (error: any) {
      console.error('Error updating notification preferences:', error)
      showToast.dismiss(loadingToast)
      showToast.error(error.message || 'Failed to update notification preferences')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='card'>
      <div className='card-header border-0 cursor-pointer'>
        <div className='card-title m-0'>
          <h3 className='fw-bolder m-0'>Notification Preferences</h3>
        </div>
      </div>

      <div className='card-body border-top p-9'>
        {/* Email Notifications */}
        <div className='mb-10'>
          <h4 className='fw-bolder text-dark mb-7'>Email Notifications</h4>
          
          <div className='d-flex flex-stack mb-5'>
            <div className='d-flex align-items-center me-3'>
              <div className='symbol symbol-50px me-5'>
                <span className='symbol-label bg-light-primary'>
                  <i className='ki-duotone ki-sms fs-2x text-primary'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                  </i>
                </span>
              </div>
              <div className='d-flex flex-column'>
                <span className='fw-bolder fs-6'>New Jobs</span>
                <span className='fs-7 text-muted'>Get notified when new jobs are created</span>
              </div>
            </div>
            <div className='form-check form-switch form-check-custom form-check-solid'>
              <input
                className='form-check-input'
                type='checkbox'
                checked={preferences.email_new_jobs}
                onChange={() => handleToggle('email_new_jobs')}
              />
            </div>
          </div>

          <div className='d-flex flex-stack mb-5'>
            <div className='d-flex align-items-center me-3'>
              <div className='symbol symbol-50px me-5'>
                <span className='symbol-label bg-light-warning'>
                  <i className='ki-duotone ki-notification-status fs-2x text-warning'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                    <span className='path3'></span>
                    <span className='path4'></span>
                  </i>
                </span>
              </div>
              <div className='d-flex flex-column'>
                <span className='fw-bolder fs-6'>Job Updates</span>
                <span className='fs-7 text-muted'>Get notified when job status changes</span>
              </div>
            </div>
            <div className='form-check form-switch form-check-custom form-check-solid'>
              <input
                className='form-check-input'
                type='checkbox'
                checked={preferences.email_job_updates}
                onChange={() => handleToggle('email_job_updates')}
              />
            </div>
          </div>

          <div className='d-flex flex-stack mb-5'>
            <div className='d-flex align-items-center me-3'>
              <div className='symbol symbol-50px me-5'>
                <span className='symbol-label bg-light-success'>
                  <i className='ki-duotone ki-document fs-2x text-success'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                  </i>
                </span>
              </div>
              <div className='d-flex flex-column'>
                <span className='fw-bolder fs-6'>Estimates & Quotes</span>
                <span className='fs-7 text-muted'>Get notified about estimate updates</span>
              </div>
            </div>
            <div className='form-check form-switch form-check-custom form-check-solid'>
              <input
                className='form-check-input'
                type='checkbox'
                checked={preferences.email_estimates}
                onChange={() => handleToggle('email_estimates')}
              />
            </div>
          </div>

          <div className='d-flex flex-stack mb-5'>
            <div className='d-flex align-items-center me-3'>
              <div className='symbol symbol-50px me-5'>
                <span className='symbol-label bg-light-info'>
                  <i className='ki-duotone ki-dollar fs-2x text-info'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                    <span className='path3'></span>
                  </i>
                </span>
              </div>
              <div className='d-flex flex-column'>
                <span className='fw-bolder fs-6'>Invoices & Payments</span>
                <span className='fs-7 text-muted'>Get notified about billing updates</span>
              </div>
            </div>
            <div className='form-check form-switch form-check-custom form-check-solid'>
              <input
                className='form-check-input'
                type='checkbox'
                checked={preferences.email_invoices}
                onChange={() => handleToggle('email_invoices')}
              />
            </div>
          </div>

          <div className='d-flex flex-stack mb-5'>
            <div className='d-flex align-items-center me-3'>
              <div className='symbol symbol-50px me-5'>
                <span className='symbol-label bg-light-dark'>
                  <i className='ki-duotone ki-rocket fs-2x text-dark'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                  </i>
                </span>
              </div>
              <div className='d-flex flex-column'>
                <span className='fw-bolder fs-6'>Marketing & Promotions</span>
                <span className='fs-7 text-muted'>Receive marketing emails and promotions</span>
              </div>
            </div>
            <div className='form-check form-switch form-check-custom form-check-solid'>
              <input
                className='form-check-input'
                type='checkbox'
                checked={preferences.email_marketing}
                onChange={() => handleToggle('email_marketing')}
              />
            </div>
          </div>
        </div>

        {/* SMS Notifications */}
        <div className='mb-10'>
          <h4 className='fw-bolder text-dark mb-7'>SMS Notifications</h4>
          
          <div className='d-flex flex-stack mb-5'>
            <div className='d-flex align-items-center me-3'>
              <div className='d-flex flex-column'>
                <span className='fw-bolder fs-6'>New Jobs</span>
                <span className='fs-7 text-muted'>Get SMS when new jobs are created</span>
              </div>
            </div>
            <div className='form-check form-switch form-check-custom form-check-solid'>
              <input
                className='form-check-input'
                type='checkbox'
                checked={preferences.sms_new_jobs}
                onChange={() => handleToggle('sms_new_jobs')}
              />
            </div>
          </div>

          <div className='d-flex flex-stack mb-5'>
            <div className='d-flex align-items-center me-3'>
              <div className='d-flex flex-column'>
                <span className='fw-bolder fs-6'>Job Updates</span>
                <span className='fs-7 text-muted'>Get SMS when job status changes</span>
              </div>
            </div>
            <div className='form-check form-switch form-check-custom form-check-solid'>
              <input
                className='form-check-input'
                type='checkbox'
                checked={preferences.sms_job_updates}
                onChange={() => handleToggle('sms_job_updates')}
              />
            </div>
          </div>
        </div>

        {/* Quiet Hours */}
        <div className='mb-10'>
          <h4 className='fw-bolder text-dark mb-7'>Quiet Hours</h4>
          
          <div className='d-flex flex-stack mb-5'>
            <div className='d-flex align-items-center me-3'>
              <div className='d-flex flex-column'>
                <span className='fw-bolder fs-6'>Enable Quiet Hours</span>
                <span className='fs-7 text-muted'>No notifications during specified hours</span>
              </div>
            </div>
            <div className='form-check form-switch form-check-custom form-check-solid'>
              <input
                className='form-check-input'
                type='checkbox'
                checked={preferences.quiet_hours_enabled}
                onChange={() => handleToggle('quiet_hours_enabled')}
              />
            </div>
          </div>

          {preferences.quiet_hours_enabled && (
            <div className='row mb-5'>
              <div className='col-lg-4'>
                <label className='fw-bold fs-6 mb-2'>Quiet Hours Start</label>
                <input
                  type='time'
                  className='form-control form-control-solid'
                  value={preferences.quiet_hours_start}
                  onChange={(e) => handleTimeChange('quiet_hours_start', e.target.value)}
                />
              </div>

              <div className='col-lg-4'>
                <label className='fw-bold fs-6 mb-2'>Quiet Hours End</label>
                <input
                  type='time'
                  className='form-control form-control-solid'
                  value={preferences.quiet_hours_end}
                  onChange={(e) => handleTimeChange('quiet_hours_end', e.target.value)}
                />
              </div>

              <div className='col-lg-4'>
                <label className='fw-bold fs-6 mb-2'>Timezone</label>
                <select
                  className='form-select form-select-solid'
                  value={preferences.timezone}
                  onChange={(e) => handleTimezoneChange(e.target.value)}
                >
                  <option value='America/New_York'>Eastern Time</option>
                  <option value='America/Chicago'>Central Time</option>
                  <option value='America/Denver'>Mountain Time</option>
                  <option value='America/Los_Angeles'>Pacific Time</option>
                  <option value='America/Phoenix'>Arizona Time</option>
                  <option value='America/Anchorage'>Alaska Time</option>
                  <option value='Pacific/Honolulu'>Hawaii Time</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div className='card-footer d-flex justify-content-end py-6 px-9'>
          <button
            type='button'
            className='btn btn-light btn-active-light-primary me-2'
            onClick={loadNotificationPreferences}
          >
            Reset
          </button>
          <button
            type='button'
            className='btn btn-primary'
            disabled={loading}
            onClick={savePreferences}
          >
            {loading && <span className='spinner-border spinner-border-sm align-middle me-2'></span>}
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  )
}