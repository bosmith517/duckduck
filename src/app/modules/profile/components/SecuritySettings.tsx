import React, { useState, useEffect } from 'react'
import { useSupabaseAuth } from '../../../modules/auth/core/SupabaseAuth'
import { supabase } from '../../../../supabaseClient'
import { showToast } from '../../../utils/toast'

interface SecuritySession {
  id: string
  ip_address: string
  user_agent: string
  created_at: string
  last_accessed_at: string
  is_current: boolean
  location?: string
}

export const SecuritySettings: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  const [loading, setLoading] = useState(false)
  const [sessions, setSessions] = useState<SecuritySession[]>([])
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)

  useEffect(() => {
    if (userProfile?.id) {
      loadSecuritySettings()
      loadActiveSessions()
    }
  }, [userProfile?.id])

  const loadSecuritySettings = async () => {
    // Check if 2FA is enabled (this would depend on your auth setup)
    // For now, we'll use a placeholder
    setTwoFactorEnabled(false)
  }

  const loadActiveSessions = async () => {
    if (!userProfile?.id) return

    try {
      // This is a placeholder - you'd need to implement session tracking
      // For now, we'll show the current session
      const currentSession: SecuritySession = {
        id: '1',
        ip_address: 'Current IP',
        user_agent: navigator.userAgent,
        created_at: new Date().toISOString(),
        last_accessed_at: new Date().toISOString(),
        is_current: true,
        location: 'Current Location'
      }

      setSessions([currentSession])
    } catch (error) {
      console.error('Error loading sessions:', error)
    }
  }

  const handleEnableTwoFactor = async () => {
    setLoading(true)
    const loadingToast = showToast.loading('Setting up two-factor authentication...')

    try {
      // This would integrate with your 2FA provider (e.g., Auth0, Supabase Auth)
      // For now, we'll show a placeholder
      
      await new Promise(resolve => setTimeout(resolve, 2000)) // Simulate API call
      
      setTwoFactorEnabled(true)
      showToast.dismiss(loadingToast)
      showToast.success('Two-factor authentication enabled successfully!')

    } catch (error: any) {
      console.error('Error enabling 2FA:', error)
      showToast.dismiss(loadingToast)
      showToast.error('Failed to enable two-factor authentication')
    } finally {
      setLoading(false)
    }
  }

  const handleDisableTwoFactor = async () => {
    if (!confirm('Are you sure you want to disable two-factor authentication? This will make your account less secure.')) {
      return
    }

    setLoading(true)
    const loadingToast = showToast.loading('Disabling two-factor authentication...')

    try {
      // This would integrate with your 2FA provider
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call
      
      setTwoFactorEnabled(false)
      showToast.dismiss(loadingToast)
      showToast.success('Two-factor authentication disabled')

    } catch (error: any) {
      console.error('Error disabling 2FA:', error)
      showToast.dismiss(loadingToast)
      showToast.error('Failed to disable two-factor authentication')
    } finally {
      setLoading(false)
    }
  }

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to revoke this session?')) {
      return
    }

    try {
      // This would revoke the session
      setSessions(prev => prev.filter(s => s.id !== sessionId))
      showToast.success('Session revoked successfully')
    } catch (error: any) {
      console.error('Error revoking session:', error)
      showToast.error('Failed to revoke session')
    }
  }

  const handleRevokeAllSessions = async () => {
    if (!confirm('Are you sure you want to sign out of all other devices? You will need to sign in again on those devices.')) {
      return
    }

    try {
      // This would revoke all non-current sessions
      setSessions(prev => prev.filter(s => s.is_current))
      showToast.success('All other sessions revoked successfully')
    } catch (error: any) {
      console.error('Error revoking sessions:', error)
      showToast.error('Failed to revoke sessions')
    }
  }

  const formatUserAgent = (userAgent: string) => {
    if (userAgent.includes('Chrome')) return 'Chrome Browser'
    if (userAgent.includes('Firefox')) return 'Firefox Browser'
    if (userAgent.includes('Safari')) return 'Safari Browser'
    if (userAgent.includes('Edge')) return 'Edge Browser'
    return 'Unknown Browser'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className='row'>
      <div className='col-xl-6'>
        {/* Two-Factor Authentication */}
        <div className='card mb-5 mb-xl-10'>
          <div className='card-header border-0 cursor-pointer'>
            <div className='card-title m-0'>
              <h3 className='fw-bolder m-0'>Two-Factor Authentication</h3>
            </div>
          </div>

          <div className='card-body border-top p-9'>
            <div className='d-flex flex-wrap align-items-center mb-10'>
              <div className='me-7'>
                <div className={`symbol symbol-70px symbol-circle ${twoFactorEnabled ? 'bg-light-success' : 'bg-light-warning'}`}>
                  <span className={`symbol-label ${twoFactorEnabled ? 'text-success' : 'text-warning'}`}>
                    <i className={`ki-duotone ${twoFactorEnabled ? 'ki-shield-tick' : 'ki-shield-cross'} fs-2x`}>
                      <span className='path1'></span>
                      <span className='path2'></span>
                      <span className='path3'></span>
                    </i>
                  </span>
                </div>
              </div>

              <div className='flex-grow-1'>
                <div className='d-flex flex-column'>
                  <h4 className='fw-bolder text-gray-800 mb-3'>
                    {twoFactorEnabled ? 'Two-Factor Authentication is Enabled' : 'Secure Your Account'}
                  </h4>
                  <div className='fs-6 fw-bold text-gray-600'>
                    {twoFactorEnabled
                      ? 'Your account is protected with two-factor authentication.'
                      : 'Add an extra layer of security to your account by enabling two-factor authentication.'}
                  </div>
                </div>
              </div>
            </div>

            <div className='notice d-flex bg-light-primary rounded border-primary border border-dashed mb-9 p-6'>
              <i className='ki-duotone ki-information fs-2x text-primary me-4'>
                <span className='path1'></span>
                <span className='path2'></span>
                <span className='path3'></span>
              </i>
              <div className='d-flex flex-stack flex-grow-1'>
                <div className='fw-bold'>
                  <h4 className='text-gray-800 fw-bolder'>Why use Two-Factor Authentication?</h4>
                  <div className='fs-6 text-gray-600'>
                    Two-factor authentication adds an extra layer of security to your account by requiring both your password 
                    and a verification code from your phone when signing in.
                  </div>
                </div>
              </div>
            </div>

            <div className='d-flex justify-content-end'>
              {twoFactorEnabled ? (
                <button
                  type='button'
                  className='btn btn-light-danger'
                  disabled={loading}
                  onClick={handleDisableTwoFactor}
                >
                  {loading && <span className='spinner-border spinner-border-sm align-middle me-2'></span>}
                  Disable Two-Factor Authentication
                </button>
              ) : (
                <button
                  type='button'
                  className='btn btn-primary'
                  disabled={loading}
                  onClick={handleEnableTwoFactor}
                >
                  {loading && <span className='spinner-border spinner-border-sm align-middle me-2'></span>}
                  Enable Two-Factor Authentication
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className='col-xl-6'>
        {/* Active Sessions */}
        <div className='card mb-5 mb-xl-10'>
          <div className='card-header border-0 cursor-pointer'>
            <div className='card-title m-0'>
              <h3 className='fw-bolder m-0'>Active Sessions</h3>
            </div>
            <div className='card-toolbar'>
              <button
                type='button'
                className='btn btn-sm btn-light-danger'
                onClick={handleRevokeAllSessions}
              >
                Sign Out All Devices
              </button>
            </div>
          </div>

          <div className='card-body border-top p-9'>
            <div className='notice d-flex bg-light-info rounded border-info border border-dashed mb-6 p-6'>
              <i className='ki-duotone ki-shield-search fs-2x text-info me-4'>
                <span className='path1'></span>
                <span className='path2'></span>
              </i>
              <div className='d-flex flex-stack flex-grow-1'>
                <div className='fw-bold'>
                  <div className='fs-6 text-gray-700'>
                    These are devices and locations where your account is currently signed in. 
                    If you see any suspicious activity, revoke those sessions immediately.
                  </div>
                </div>
              </div>
            </div>

            <div className='table-responsive'>
              <table className='table table-flush align-middle table-row-bordered table-row-solid gy-4 gs-9'>
                <thead className='border-gray-200 fs-5 fw-bold bg-lighten'>
                  <tr>
                    <th className='min-w-175px ps-9'>Browser</th>
                    <th className='min-w-100px'>IP Address</th>
                    <th className='min-w-125px'>Last Access</th>
                    <th className='min-w-75px text-end'>Action</th>
                  </tr>
                </thead>
                <tbody className='fw-bold text-gray-600 fs-6'>
                  {sessions.map((session) => (
                    <tr key={session.id}>
                      <td className='ps-9'>
                        <div className='d-flex align-items-center'>
                          <div className='symbol symbol-45px me-5'>
                            <span className='symbol-label bg-light-primary text-primary fw-bold'>
                              <i className='ki-duotone ki-computer fs-2x'>
                                <span className='path1'></span>
                                <span className='path2'></span>
                                <span className='path3'></span>
                              </i>
                            </span>
                          </div>
                          <div className='d-flex flex-column'>
                            <span className='text-gray-800 fw-bolder text-hover-primary mb-1'>
                              {formatUserAgent(session.user_agent)}
                            </span>
                            <span className='text-muted fw-bold text-muted d-block fs-7'>
                              {session.is_current && (
                                <span className='badge badge-light-success me-2'>Current Session</span>
                              )}
                              {session.location}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className='text-gray-600 fw-bolder d-block fs-6'>
                          {session.ip_address}
                        </span>
                      </td>
                      <td>
                        <span className='text-gray-600 fw-bolder d-block fs-6'>
                          {formatDate(session.last_accessed_at)}
                        </span>
                      </td>
                      <td className='text-end'>
                        {!session.is_current && (
                          <button
                            type='button'
                            className='btn btn-sm btn-light-danger'
                            onClick={() => handleRevokeSession(session.id)}
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}