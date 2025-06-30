import React from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'
import PhoneNumbersPage from './PhoneNumbersPage'

const SettingsMainPage: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  
  const getActiveTab = () => {
    const path = location.pathname
    if (path.includes('/phone-numbers')) return 'phone-numbers'
    if (path.includes('/billing')) return 'billing'
    if (path.includes('/notifications')) return 'notifications'
    if (path.includes('/security')) return 'security'
    if (path.includes('/integrations')) return 'integrations'
    return 'general'
  }

  const handleTabClick = (tab: string) => {
    if (tab === 'general') {
      navigate('/settings')
    } else {
      navigate(`/settings/${tab}`)
    }
  }

  const renderGeneralSettings = () => (
    <div className='row'>
      <div className='col-md-6'>
        <div className='mb-10'>
          <label className='form-label'>Company Name</label>
          <input type='text' className='form-control' defaultValue='TradeWorks Pro' />
        </div>
        <div className='mb-10'>
          <label className='form-label'>Business Address</label>
          <textarea className='form-control' rows={3} defaultValue='123 Business St, Springfield, IL 62701' />
        </div>
        <div className='mb-10'>
          <label className='form-label'>Phone Number</label>
          <input type='text' className='form-control' defaultValue='(555) 123-4567' />
        </div>
        <div className='mb-10'>
          <label className='form-label'>Email</label>
          <input type='email' className='form-control' defaultValue='info@tradeworkspro.com' />
        </div>
      </div>
      <div className='col-md-6'>
        <div className='mb-10'>
          <label className='form-label'>Tax ID</label>
          <input type='text' className='form-control' defaultValue='12-3456789' />
        </div>
        <div className='mb-10'>
          <label className='form-label'>License Number</label>
          <input type='text' className='form-control' defaultValue='LIC-123456' />
        </div>
        <div className='mb-10'>
          <label className='form-label'>Website</label>
          <input type='url' className='form-control' defaultValue='https://tradeworkspro.com' />
        </div>
        <div className='mb-10'>
          <label className='form-label'>Time Zone</label>
          <select className='form-select' defaultValue='America/Chicago'>
            <option value='America/New_York'>Eastern Time</option>
            <option value='America/Chicago'>Central Time</option>
            <option value='America/Denver'>Mountain Time</option>
            <option value='America/Los_Angeles'>Pacific Time</option>
          </select>
        </div>
      </div>
    </div>
  )

  const renderBillingSettings = () => (
    <div className='row'>
      <div className='col-md-6'>
        <div className='mb-10'>
          <label className='form-label'>Default Payment Terms</label>
          <select className='form-select' defaultValue='30'>
            <option value='15'>Net 15</option>
            <option value='30'>Net 30</option>
            <option value='45'>Net 45</option>
            <option value='60'>Net 60</option>
          </select>
        </div>
        <div className='mb-10'>
          <label className='form-label'>Late Fee Percentage</label>
          <input type='number' className='form-control' defaultValue='1.5' step='0.1' />
        </div>
        <div className='mb-10'>
          <label className='form-label'>Tax Rate (%)</label>
          <input type='number' className='form-control' defaultValue='8.25' step='0.01' />
        </div>
      </div>
      <div className='col-md-6'>
        <div className='mb-10'>
          <label className='form-label'>Invoice Prefix</label>
          <input type='text' className='form-control' defaultValue='INV-' />
        </div>
        <div className='mb-10'>
          <label className='form-label'>Estimate Prefix</label>
          <input type='text' className='form-control' defaultValue='EST-' />
        </div>
        <div className='mb-10'>
          <label className='form-label'>Currency</label>
          <select className='form-select' defaultValue='USD'>
            <option value='USD'>US Dollar ($)</option>
            <option value='CAD'>Canadian Dollar (C$)</option>
            <option value='EUR'>Euro (€)</option>
          </select>
        </div>
      </div>
    </div>
  )

  const renderNotificationSettings = () => (
    <div className='row'>
      <div className='col-md-6'>
        <h5 className='mb-5'>Email Notifications</h5>
        <div className='form-check form-switch mb-5'>
          <input className='form-check-input' type='checkbox' defaultChecked />
          <label className='form-check-label'>New job assignments</label>
        </div>
        <div className='form-check form-switch mb-5'>
          <input className='form-check-input' type='checkbox' defaultChecked />
          <label className='form-check-label'>Invoice payments received</label>
        </div>
        <div className='form-check form-switch mb-5'>
          <input className='form-check-input' type='checkbox' defaultChecked />
          <label className='form-check-label'>Overdue invoices</label>
        </div>
        <div className='form-check form-switch mb-5'>
          <input className='form-check-input' type='checkbox' />
          <label className='form-check-label'>Low inventory alerts</label>
        </div>
      </div>
      <div className='col-md-6'>
        <h5 className='mb-5'>System Notifications</h5>
        <div className='form-check form-switch mb-5'>
          <input className='form-check-input' type='checkbox' defaultChecked />
          <label className='form-check-label'>Schedule reminders</label>
        </div>
        <div className='form-check form-switch mb-5'>
          <input className='form-check-input' type='checkbox' defaultChecked />
          <label className='form-check-label'>Estimate expiration warnings</label>
        </div>
        <div className='form-check form-switch mb-5'>
          <input className='form-check-input' type='checkbox' />
          <label className='form-check-label'>Weekly reports</label>
        </div>
        <div className='form-check form-switch mb-5'>
          <input className='form-check-input' type='checkbox' />
          <label className='form-check-label'>System maintenance alerts</label>
        </div>
      </div>
    </div>
  )

  const renderSecuritySettings = () => (
    <div className='row'>
      <div className='col-md-6'>
        <div className='mb-10'>
          <label className='form-label'>Password Requirements</label>
          <div className='form-check mb-3'>
            <input className='form-check-input' type='checkbox' defaultChecked />
            <label className='form-check-label'>Minimum 8 characters</label>
          </div>
          <div className='form-check mb-3'>
            <input className='form-check-input' type='checkbox' defaultChecked />
            <label className='form-check-label'>Require uppercase letters</label>
          </div>
          <div className='form-check mb-3'>
            <input className='form-check-input' type='checkbox' defaultChecked />
            <label className='form-check-label'>Require numbers</label>
          </div>
          <div className='form-check mb-3'>
            <input className='form-check-input' type='checkbox' />
            <label className='form-check-label'>Require special characters</label>
          </div>
        </div>
      </div>
      <div className='col-md-6'>
        <div className='mb-10'>
          <label className='form-label'>Session Timeout (minutes)</label>
          <select className='form-select' defaultValue='60'>
            <option value='30'>30 minutes</option>
            <option value='60'>1 hour</option>
            <option value='120'>2 hours</option>
            <option value='240'>4 hours</option>
            <option value='480'>8 hours</option>
          </select>
        </div>
        <div className='mb-10'>
          <label className='form-label'>Two-Factor Authentication</label>
          <div className='form-check form-switch'>
            <input className='form-check-input' type='checkbox' />
            <label className='form-check-label'>Enable 2FA for all users</label>
          </div>
        </div>
        <div className='mb-10'>
          <label className='form-label'>Login Attempts</label>
          <select className='form-select' defaultValue='5'>
            <option value='3'>3 attempts</option>
            <option value='5'>5 attempts</option>
            <option value='10'>10 attempts</option>
          </select>
        </div>
      </div>
    </div>
  )

  const renderIntegrationsSettings = () => (
    <div className='row'>
      <div className='col-md-6'>
        <h5 className='mb-5'>Communication Integrations</h5>
        <div className='card mb-5'>
          <div className='card-body d-flex align-items-center justify-content-between'>
            <div className='d-flex align-items-center'>
              <div className='symbol symbol-50px me-3'>
                <span className='symbol-label bg-primary'>
                  <i className='ki-duotone ki-phone fs-2 text-white'></i>
                </span>
              </div>
              <div>
                <h6 className='mb-1'>SignalWire VoIP</h6>
                <span className='text-muted fs-7'>Voice and SMS services</span>
              </div>
            </div>
            <div className='form-check form-switch'>
              <input className='form-check-input' type='checkbox' defaultChecked />
            </div>
          </div>
        </div>
        <div className='card mb-5'>
          <div className='card-body d-flex align-items-center justify-content-between'>
            <div className='d-flex align-items-center'>
              <div className='symbol symbol-50px me-3'>
                <span className='symbol-label bg-success'>
                  <i className='ki-duotone ki-message-text fs-2 text-white'></i>
                </span>
              </div>
              <div>
                <h6 className='mb-1'>SMS Gateway</h6>
                <span className='text-muted fs-7'>Text messaging service</span>
              </div>
            </div>
            <div className='form-check form-switch'>
              <input className='form-check-input' type='checkbox' defaultChecked />
            </div>
          </div>
        </div>
      </div>
      <div className='col-md-6'>
        <h5 className='mb-5'>Business Integrations</h5>
        <div className='card mb-5'>
          <div className='card-body d-flex align-items-center justify-content-between'>
            <div className='d-flex align-items-center'>
              <div className='symbol symbol-50px me-3'>
                <span className='symbol-label bg-warning'>
                  <i className='ki-duotone ki-profile-user fs-2 text-white'></i>
                </span>
              </div>
              <div>
                <h6 className='mb-1'>Supabase Database</h6>
                <span className='text-muted fs-7'>Real-time database</span>
              </div>
            </div>
            <div className='form-check form-switch'>
              <input className='form-check-input' type='checkbox' defaultChecked />
            </div>
          </div>
        </div>
        <div className='card mb-5'>
          <div className='card-body d-flex align-items-center justify-content-between'>
            <div className='d-flex align-items-center'>
              <div className='symbol symbol-50px me-3'>
                <span className='symbol-label bg-info'>
                  <i className='ki-duotone ki-chart-simple fs-2 text-white'></i>
                </span>
              </div>
              <div>
                <h6 className='mb-1'>Analytics Platform</h6>
                <span className='text-muted fs-7'>Business intelligence</span>
              </div>
            </div>
            <div className='form-check form-switch'>
              <input className='form-check-input' type='checkbox' />
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const activeTab = getActiveTab()

  return (
    <>
      <PageTitle breadcrumbs={[]}>Settings</PageTitle>
      
      <div className='row g-5 g-xl-8'>
        <div className='col-xl-12'>
          <KTCard>
            <div className='card-header border-0 pt-5'>
              <h3 className='card-title align-items-start flex-column'>
                <span className='card-label fw-bold fs-3 mb-1'>System Settings</span>
                <span className='text-muted mt-1 fw-semibold fs-7'>Configure your application preferences</span>
              </h3>
            </div>
            <KTCardBody className='py-3'>
              {/* Navigation Tabs */}
              <ul className='nav nav-tabs nav-line-tabs mb-5 fs-6'>
                <li className='nav-item'>
                  <a
                    className={`nav-link ${activeTab === 'general' ? 'active' : ''}`}
                    onClick={() => handleTabClick('general')}
                    style={{ cursor: 'pointer' }}
                  >
                    General
                  </a>
                </li>
                <li className='nav-item'>
                  <a
                    className={`nav-link ${activeTab === 'billing' ? 'active' : ''}`}
                    onClick={() => handleTabClick('billing')}
                    style={{ cursor: 'pointer' }}
                  >
                    Billing
                  </a>
                </li>
                <li className='nav-item'>
                  <a
                    className={`nav-link ${activeTab === 'notifications' ? 'active' : ''}`}
                    onClick={() => handleTabClick('notifications')}
                    style={{ cursor: 'pointer' }}
                  >
                    Notifications
                  </a>
                </li>
                <li className='nav-item'>
                  <a
                    className={`nav-link ${activeTab === 'security' ? 'active' : ''}`}
                    onClick={() => handleTabClick('security')}
                    style={{ cursor: 'pointer' }}
                  >
                    Security
                  </a>
                </li>
                <li className='nav-item'>
                  <a
                    className={`nav-link ${activeTab === 'integrations' ? 'active' : ''}`}
                    onClick={() => handleTabClick('integrations')}
                    style={{ cursor: 'pointer' }}
                  >
                    Integrations
                  </a>
                </li>
                <li className='nav-item'>
                  <a
                    className={`nav-link ${activeTab === 'phone-numbers' ? 'active' : ''}`}
                    onClick={() => handleTabClick('phone-numbers')}
                    style={{ cursor: 'pointer' }}
                  >
                    <i className='ki-duotone ki-phone fs-2 me-2'></i>
                    Phone Numbers
                  </a>
                </li>
              </ul>

              {/* Tab Content */}
              <div className='tab-content'>
                {activeTab === 'general' && renderGeneralSettings()}
                {activeTab === 'billing' && renderBillingSettings()}
                {activeTab === 'notifications' && renderNotificationSettings()}
                {activeTab === 'security' && renderSecuritySettings()}
                {activeTab === 'integrations' && renderIntegrationsSettings()}
              </div>

              {/* Save Button - Only show for non-phone-numbers tabs */}
              {activeTab !== 'phone-numbers' && (
                <div className='d-flex justify-content-end mt-10'>
                  <button className='btn btn-light me-3'>Cancel</button>
                  <button className='btn btn-primary'>
                    <i className='ki-duotone ki-check fs-2'></i>
                    Save Changes
                  </button>
                </div>
              )}
            </KTCardBody>
          </KTCard>
        </div>
      </div>
    </>
  )
}

const SettingsPage: React.FC = () => {
  return (
    <Routes>
      <Route path='phone-numbers' element={<PhoneNumbersPage />} />
      <Route path='billing' element={<SettingsMainPage />} />
      <Route path='notifications' element={<SettingsMainPage />} />
      <Route path='security' element={<SettingsMainPage />} />
      <Route path='integrations' element={<SettingsMainPage />} />
      <Route path='*' element={<SettingsMainPage />} />
    </Routes>
  )
}

export default SettingsPage
