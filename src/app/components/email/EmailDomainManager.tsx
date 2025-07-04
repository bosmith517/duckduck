import React, { useState, useEffect } from 'react'
import { emailService, EmailDomain } from '../../services/emailService'

interface EmailDomainManagerProps {
  className?: string
}

const EmailDomainManager: React.FC<EmailDomainManagerProps> = ({ className = '' }) => {
  const [domains, setDomains] = useState<EmailDomain[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkingDomain, setCheckingDomain] = useState<string | null>(null)

  useEffect(() => {
    loadDomains()
  }, [])

  const loadDomains = async () => {
    setLoading(true)
    try {
      const result = await emailService.getDomains()
      setDomains(result.domains)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load domains')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyDomain = async (domainId: string) => {
    setCheckingDomain(domainId)
    try {
      await emailService.verifyDomain(domainId)
      await loadDomains()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify domain')
    } finally {
      setCheckingDomain(null)
    }
  }

  const handleDeleteDomain = async (domainId: string) => {
    if (!confirm('Are you sure you want to delete this domain? This action cannot be undone.')) {
      return
    }

    setLoading(true)
    try {
      await emailService.deleteDomain(domainId)
      await loadDomains()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete domain')
    } finally {
      setLoading(false)
    }
  }

  const handleSetDefault = async (domainId: string) => {
    setLoading(true)
    try {
      await emailService.setDefaultDomain(domainId)
      await loadDomains()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set default domain')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return <span className="badge badge-success">✅ Verified</span>
      case 'pending':
        return <span className="badge badge-warning">⏳ Pending</span>
      case 'failed':
        return <span className="badge badge-danger">❌ Failed</span>
      default:
        return <span className="badge badge-secondary">❓ Unknown</span>
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      // Could add toast notification here
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className={`email-domain-manager ${className}`}>
      <div className="card">
        <div className="card-header border-0 pt-5">
          <h3 className="card-title align-items-start flex-column">
            <span className="card-label fw-bold fs-3 mb-1">
              <span className="me-2">🌐</span>
              Email Domains
            </span>
            <span className="text-muted mt-1 fw-semibold fs-7">
              Manage your custom email domains
            </span>
          </h3>
          <div className="card-toolbar">
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => window.location.hash = '#setup'}
            >
              <span className="me-2">➕</span>
              Add Domain
            </button>
          </div>
        </div>

        <div className="card-body py-3">
          {error && (
            <div className="alert alert-danger">
              <span>❌ {error}</span>
            </div>
          )}

          {loading ? (
            <div className="d-flex justify-content-center py-10">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4">
                <thead>
                  <tr className="fw-bold text-muted">
                    <th className="min-w-150px">Domain</th>
                    <th className="min-w-140px">Status</th>
                    <th className="min-w-120px">From Email</th>
                    <th className="min-w-120px">From Name</th>
                    <th className="min-w-100px">Default</th>
                    <th className="min-w-100px text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {domains.map(domain => (
                    <tr key={domain.id}>
                      <td>
                        <div className="d-flex align-items-center">
                          <div className="d-flex justify-content-start flex-column">
                            <span className="text-dark fw-bold text-hover-primary fs-6">
                              {domain.domain_name}
                            </span>
                            <span className="text-muted fw-semibold text-muted d-block fs-7">
                              Added {new Date(domain.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          {getStatusBadge(domain.status)}
                          {domain.status === 'verified' && domain.verified_at && (
                            <span className="text-muted fs-7 ms-2">
                              {new Date(domain.verified_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="text-dark fw-semibold d-block fs-7">
                          {domain.default_from_email}
                        </span>
                      </td>
                      <td>
                        <span className="text-dark fw-semibold d-block fs-7">
                          {domain.default_from_name}
                        </span>
                      </td>
                      <td>
                        {domain.is_default ? (
                          <span className="badge badge-light-primary">⭐ Default</span>
                        ) : (
                          <button
                            className="btn btn-sm btn-light"
                            onClick={() => handleSetDefault(domain.id)}
                            disabled={loading || domain.status !== 'verified'}
                          >
                            Set Default
                          </button>
                        )}
                      </td>
                      <td>
                        <div className="d-flex justify-content-end flex-shrink-0">
                          {domain.status === 'pending' && (
                            <button
                              className={`btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1 ${
                                checkingDomain === domain.id ? 'loading' : ''
                              }`}
                              onClick={() => handleVerifyDomain(domain.id)}
                              disabled={checkingDomain === domain.id}
                            >
                              🔍
                            </button>
                          )}
                          
                          <div className="dropdown">
                            <button
                              className="btn btn-icon btn-bg-light btn-active-color-primary btn-sm"
                              data-bs-toggle="dropdown"
                            >
                              ⋮
                            </button>
                            <div className="dropdown-menu dropdown-menu-end">
                              {domain.status === 'pending' && (
                                <a
                                  className="dropdown-item"
                                  href="#"
                                  onClick={() => handleVerifyDomain(domain.id)}
                                >
                                  🔍 Check Verification
                                </a>
                              )}
                              <a
                                className="dropdown-item"
                                href="#"
                                onClick={() => copyToClipboard(domain.domain_name)}
                              >
                                📋 Copy Domain
                              </a>
                              <div className="dropdown-divider"></div>
                              <a
                                className="dropdown-item text-danger"
                                href="#"
                                onClick={() => handleDeleteDomain(domain.id)}
                              >
                                🗑️ Delete
                              </a>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {domains.length === 0 && (
                <div className="text-center py-10">
                  <h4>No domains configured</h4>
                  <p className="text-muted mb-4">
                    Set up your first custom email domain to start sending emails from your own domain.
                  </p>
                  <button
                    className="btn btn-primary"
                    onClick={() => window.location.hash = '#setup'}
                  >
                    <span className="me-2">➕</span>
                    Add Your First Domain
                  </button>
                </div>
              )}
            </div>
          )}

          {/* DNS Records Display for Pending Domains */}
          {domains.filter(d => d.status === 'pending').map(domain => (
            <div key={`dns-${domain.id}`} className="card border-warning mt-6">
              <div className="card-header">
                <h5 className="card-title">
                  DNS Records for {domain.domain_name}
                </h5>
              </div>
              <div className="card-body">
                <p className="text-muted mb-4">
                  Add these DNS records to your domain provider to verify ownership:
                </p>
                
                <div className="table-responsive">
                  <table className="table table-bordered">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Name</th>
                        <th>Value</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {domain.dns_records && domain.dns_records.map((record: any, index: number) => (
                        <tr key={index}>
                          <td>
                            <span className={`badge ${ 
                              record.type === 'TXT' ? 'badge-primary' :
                              record.type === 'CNAME' ? 'badge-secondary' :
                              record.type === 'MX' ? 'badge-success' : 'badge-info'
                            }`}>
                              {record.type}
                            </span>
                          </td>
                          <td>
                            <code className="small">{record.name}</code>
                          </td>
                          <td>
                            <code className="small text-break">{record.value}</code>
                          </td>
                          <td>
                            <button
                              className="btn btn-sm btn-light"
                              onClick={() => copyToClipboard(record.value)}
                            >
                              📋 Copy
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="alert alert-info mt-4">
                  <strong>Next Steps:</strong>
                  <ol className="mb-0 mt-2">
                    <li>Add all DNS records to your domain provider</li>
                    <li>Wait for DNS propagation (can take up to 24 hours)</li>
                    <li>Click "Check Verification" to verify your domain</li>
                  </ol>
                </div>
              </div>
            </div>
          ))}

          {/* Usage Statistics */}
          {domains.filter(d => d.status === 'verified').length > 0 && (
            <div className="card mt-6">
              <div className="card-header">
                <h5 className="card-title">Domain Usage</h5>
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-md-3">
                    <div className="d-flex align-items-center">
                      <div className="symbol symbol-40px me-3">
                        <span className="symbol-label bg-light-success text-success">
                          ✅
                        </span>
                      </div>
                      <div className="d-flex justify-content-start flex-column">
                        <span className="text-dark fw-bold fs-6">
                          {domains.filter(d => d.status === 'verified').length}
                        </span>
                        <span className="text-muted fw-semibold fs-7">Verified Domains</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="d-flex align-items-center">
                      <div className="symbol symbol-40px me-3">
                        <span className="symbol-label bg-light-warning text-warning">
                          ⏳
                        </span>
                      </div>
                      <div className="d-flex justify-content-start flex-column">
                        <span className="text-dark fw-bold fs-6">
                          {domains.filter(d => d.status === 'pending').length}
                        </span>
                        <span className="text-muted fw-semibold fs-7">Pending Verification</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="d-flex align-items-center">
                      <div className="symbol symbol-40px me-3">
                        <span className="symbol-label bg-light-primary text-primary">
                          ⭐
                        </span>
                      </div>
                      <div className="d-flex justify-content-start flex-column">
                        <span className="text-dark fw-bold fs-6">
                          {domains.filter(d => d.is_default).length}
                        </span>
                        <span className="text-muted fw-semibold fs-7">Default Domain</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="d-flex align-items-center">
                      <div className="symbol symbol-40px me-3">
                        <span className="symbol-label bg-light-info text-info">
                          🌐
                        </span>
                      </div>
                      <div className="d-flex justify-content-start flex-column">
                        <span className="text-dark fw-bold fs-6">
                          {domains.length}
                        </span>
                        <span className="text-muted fw-semibold fs-7">Total Domains</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default EmailDomainManager