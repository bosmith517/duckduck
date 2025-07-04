import React, { useState, useEffect } from 'react'
import { emailService } from '../../services/emailService'

interface SendGridConfigurationProps {
  className?: string
}

interface SendGridConfig {
  is_configured: boolean
  domains_count: number
  last_email_sent?: string
  total_emails_sent: number
  status: 'active' | 'inactive' | 'error'
}

const SendGridConfiguration: React.FC<SendGridConfigurationProps> = ({ className = '' }) => {
  const [config, setConfig] = useState<SendGridConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadSendGridConfig()
  }, [])

  const loadSendGridConfig = async () => {
    setLoading(true)
    try {
      // Check if SendGrid is configured by testing email health
      const health = await emailService.getSystemHealth()
      const usage = await emailService.getCurrentMonthUsage()
      
      setConfig({
        is_configured: health.length > 0,
        domains_count: 0, // Would be set by domain count
        last_email_sent: usage?.month_year,
        total_emails_sent: usage?.emails_sent || 0,
        status: health.length > 0 ? 'active' : 'inactive'
      })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load SendGrid configuration')
      setConfig({
        is_configured: false,
        domains_count: 0,
        total_emails_sent: 0,
        status: 'error'
      })
    } finally {
      setLoading(false)
    }
  }

  const testSendGridConnection = async () => {
    setLoading(true)
    try {
      // Test SendGrid by attempting to send a test email through the Edge Function
      await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'SendGrid Configuration Test',
        text: 'This is a test email to verify SendGrid configuration.'
      })
      setError(null)
      await loadSendGridConfig()
    } catch (err) {
      setError('SendGrid connection test failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; icon: string }> = {
      'active': { label: 'Active', color: 'badge-success', icon: '✅' },
      'inactive': { label: 'Not Configured', color: 'badge-warning', icon: '⚠️' },
      'error': { label: 'Error', color: 'badge-error', icon: '❌' }
    }

    const statusConfig = statusMap[status] || { label: status, color: 'badge-light', icon: '❓' }
    return (
      <span className={`badge ${statusConfig.color} gap-2`}>
        {statusConfig.icon}
        {statusConfig.label}
      </span>
    )
  }

  return (
    <div className={`sendgrid-configuration ${className}`}>
      <div className="card">
        <div className="card-header border-0 pt-5">
          <h3 className="card-title align-items-start flex-column">
            <span className="card-label fw-bold fs-3 mb-1">
              <span className="me-2">📧</span>
              SendGrid Configuration
            </span>
            <span className="text-muted mt-1 fw-semibold fs-7">
              SendGrid email service status and configuration
            </span>
          </h3>
          <div className="card-toolbar">
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => loadSendGridConfig()}
              disabled={loading}
            >
              <span className="me-2">🔄</span>
              Refresh Status
            </button>
          </div>
        </div>

        <div className="card-body py-3">
          {error && (
            <div className="alert alert-danger">
              <span>❌ {error}</span>
            </div>
          )}

          {/* Configuration Status */}
          {loading ? (
            <div className="d-flex justify-content-center py-10">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : (
            <div className="row g-4">
              {/* Status Card */}
              <div className="col-md-6">
                <div className="card border-2">
                  <div className="card-body text-center">
                    <h5 className="card-title">SendGrid Status</h5>
                    {config && getStatusBadge(config.status)}
                    <p className="text-muted mt-2">
                      {config?.is_configured ? 'SendGrid is configured and ready' : 'SendGrid API key not configured in Edge Secrets'}
                    </p>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={testSendGridConnection}
                      disabled={loading}
                    >
                      Test Connection
                    </button>
                  </div>
                </div>
              </div>

              {/* Usage Stats */}
              <div className="col-md-6">
                <div className="card">
                  <div className="card-body">
                    <h5 className="card-title">Usage Statistics</h5>
                    <div className="d-flex justify-content-between mb-2">
                      <span>Total Emails Sent:</span>
                      <strong>{config?.total_emails_sent || 0}</strong>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span>Current Month:</span>
                      <strong>{config?.last_email_sent || 'N/A'}</strong>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span>Domains Configured:</span>
                      <strong>{config?.domains_count || 0}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Configuration Instructions */}
          <div className="mt-8">
            <div className="alert alert-info">
              <h5 className="alert-heading">📝 Configuration Instructions</h5>
              <p className="mb-2">
                <strong>To configure SendGrid:</strong>
              </p>
              <ol className="mb-0">
                <li>Create a SendGrid API key with <code>mail.send</code> permissions</li>
                <li>Set the API key as an Edge Function secret: <code>SENDGRID_API_KEY</code></li>
                <li>Deploy the SendGrid Edge Functions</li>
                <li>Test the connection using the button above</li>
              </ol>
              <p className="mt-3 mb-0">
                <strong>Note:</strong> API keys are stored securely in Edge Function secrets and never exposed to the frontend.
              </p>
            </div>
          </div>

          {/* SendGrid Features Overview */}
          <div className="row mt-6">
            <div className="col-md-4">
              <div className="d-flex align-items-center">
                <div className="symbol symbol-40px me-3">
                  <span className="symbol-label bg-light-success text-success">
                    📧
                  </span>
                </div>
                <div className="d-flex justify-content-start flex-column">
                  <span className="text-dark fw-bold fs-6">Outbound Email</span>
                  <span className="text-muted fw-semibold fs-7">Transactional & Marketing</span>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="d-flex align-items-center">
                <div className="symbol symbol-40px me-3">
                  <span className="symbol-label bg-light-info text-info">
                    📨
                  </span>
                </div>
                <div className="d-flex justify-content-start flex-column">
                  <span className="text-dark fw-bold fs-6">Inbound Email</span>
                  <span className="text-muted fw-semibold fs-7">Parse & Process</span>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="d-flex align-items-center">
                <div className="symbol symbol-40px me-3">
                  <span className="symbol-label bg-light-primary text-primary">
                    📊
                  </span>
                </div>
                <div className="d-flex justify-content-start flex-column">
                  <span className="text-dark fw-bold fs-6">Analytics</span>
                  <span className="text-muted fw-semibold fs-7">Delivery & Engagement</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}

export default SendGridConfiguration