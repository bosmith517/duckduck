import React, { useState } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import EmailHealthDashboard from '../../components/email/EmailHealthDashboard'
import DomainSetupWizard from '../../components/email/DomainSetupWizard'
import EmailComposer from '../../components/email/EmailComposer'
import EmailTemplateManager from '../../components/email/EmailTemplateManager'
import EmailDomainManager from '../../components/email/EmailDomainManager'
import SendGridConfiguration from '../../components/email/SendGridConfiguration'

const EmailPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard')

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'compose', label: 'Compose', icon: '✉️' },
    { id: 'templates', label: 'Templates', icon: '📝' },
    { id: 'domains', label: 'Domains', icon: '🌐' },
    { id: 'sendgrid', label: 'SendGrid Config', icon: '🔑' },
    { id: 'setup', label: 'Setup Domain', icon: '⚙️' }
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <EmailHealthDashboard />
      case 'compose':
        return <EmailComposer />
      case 'templates':
        return <EmailTemplateManager />
      case 'domains':
        return <EmailDomainManager />
      case 'sendgrid':
        return <SendGridConfiguration />
      case 'setup':
        return (
          <div className="card">
            <div className="card-body">
              <DomainSetupWizard
                onComplete={(domain) => {
                  console.log('Domain setup complete:', domain)
                  setActiveTab('domains')
                }}
                onCancel={() => setActiveTab('domains')}
              />
            </div>
          </div>
        )
      default:
        return <EmailHealthDashboard />
    }
  }

  return (
    <>
      <PageTitle breadcrumbs={[]}>Email System</PageTitle>
      
      <div className="row g-5 g-xl-8">
        <div className="col-xl-12">
          {/* Navigation Tabs */}
          <div className="card mb-5">
            <div className="card-header border-0 pt-5">
              <h3 className="card-title align-items-start flex-column">
                <span className="card-label fw-bold fs-3 mb-1">Email Management</span>
                <span className="text-muted mt-1 fw-semibold fs-7">
                  Manage email domains, templates, and delivery
                </span>
              </h3>
            </div>
            <div className="card-body py-3">
              <ul className="nav nav-tabs nav-line-tabs nav-line-tabs-2x border-0 fs-4 fw-semibold mb-n2">
                {tabs.map((tab) => (
                  <li key={tab.id} className="nav-item">
                    <a
                      className={`nav-link text-active-primary pb-4 ${
                        activeTab === tab.id ? 'active' : ''
                      }`}
                      onClick={() => setActiveTab(tab.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <span className="me-2">{tab.icon}</span>
                      {tab.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Tab Content */}
          {renderTabContent()}
        </div>
      </div>
    </>
  )
}

export default EmailPage