import React, { useState, useEffect } from 'react'
import { SubcontractorService, SubcontractorCompany, SubcontractorJobAssignment } from '../../services/subcontractorService'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { showToast } from '../../utils/toast'

interface SubcontractorManagerProps {
  onSubcontractorUpdate?: () => void
}

export const SubcontractorManager: React.FC<SubcontractorManagerProps> = ({ onSubcontractorUpdate }) => {
  const { userProfile } = useSupabaseAuth()
  const [subcontractors, setSubcontractors] = useState<SubcontractorCompany[]>([])
  const [assignments, setAssignments] = useState<SubcontractorJobAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('subcontractors')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [selectedTrades, setSelectedTrades] = useState<string[]>([])
  const [hourlyRates, setHourlyRates] = useState<Record<string, number>>({})

  const tradeOptions = [
    { value: 'electrical', label: 'Electrical' },
    { value: 'plumbing', label: 'Plumbing' },
    { value: 'hvac', label: 'HVAC' },
    { value: 'general', label: 'General Construction' },
    { value: 'roofing', label: 'Roofing' },
    { value: 'flooring', label: 'Flooring' },
    { value: 'painting', label: 'Painting' },
    { value: 'landscaping', label: 'Landscaping' }
  ]

  useEffect(() => {
    if (userProfile?.tenant_id) {
      loadSubcontractors()
      loadAssignments()
    }
  }, [userProfile?.tenant_id])

  const loadSubcontractors = async () => {
    if (!userProfile?.tenant_id) return

    try {
      setLoading(true)
      const data = await SubcontractorService.getSubcontractors(userProfile.tenant_id)
      setSubcontractors(data)
    } catch (error) {
      console.error('Error loading subcontractors:', error)
      showToast.error('Failed to load subcontractors')
    } finally {
      setLoading(false)
    }
  }

  const loadAssignments = async () => {
    if (!userProfile?.tenant_id) return

    try {
      const data = await SubcontractorService.getJobAssignments(userProfile.tenant_id)
      setAssignments(data)
    } catch (error) {
      console.error('Error loading assignments:', error)
    }
  }

  const handleInviteSubcontractor = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    try {
      const inviteData = {
        company_name: formData.get('company_name') as string,
        contact_name: formData.get('contact_name') as string,
        email: formData.get('email') as string,
        phone: formData.get('phone') as string || undefined,
        trade_specialties: selectedTrades,
        estimated_hourly_rates: hourlyRates,
        invitation_message: formData.get('invitation_message') as string || undefined
      }

      const newSubcontractor = await SubcontractorService.inviteSubcontractor(inviteData)
      
      showToast.success(`Invitation sent to ${newSubcontractor.company_name}`)
      setShowInviteModal(false)
      resetInviteForm()
      loadSubcontractors()
      onSubcontractorUpdate?.()

      // Show signup URL for development/testing
      const signupUrl = SubcontractorService.generateSignupUrl(newSubcontractor.signup_token!)
      console.log('Signup URL:', signupUrl)
      
      // Copy to clipboard for convenience
      navigator.clipboard.writeText(signupUrl)
      showToast.info('Signup URL copied to clipboard (for testing)')

    } catch (error: any) {
      console.error('Error inviting subcontractor:', error)
      showToast.error(error.message || 'Failed to invite subcontractor')
    }
  }

  const handleTradeToggle = (trade: string) => {
    setSelectedTrades(prev => 
      prev.includes(trade) 
        ? prev.filter(t => t !== trade)
        : [...prev, trade]
    )
  }

  const handleHourlyRateChange = (trade: string, rate: number) => {
    setHourlyRates(prev => ({ ...prev, [trade]: rate }))
  }

  const resetInviteForm = () => {
    setSelectedTrades([])
    setHourlyRates({})
    setShowInviteModal(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'invited': return 'badge-light-info'
      case 'accepted': return 'badge-light-success'
      case 'declined': return 'badge-light-danger'
      case 'in_progress': return 'badge-light-warning'
      case 'completed': return 'badge-light-primary'
      case 'cancelled': return 'badge-light-secondary'
      default: return 'badge-light-secondary'
    }
  }

  const getSubscriptionColor = (tier: string) => {
    switch (tier) {
      case 'free': return 'badge-light-secondary'
      case 'basic': return 'badge-light-info'
      case 'pro': return 'badge-light-success'
      case 'enterprise': return 'badge-light-primary'
      default: return 'badge-light-secondary'
    }
  }

  if (loading) {
    return <div className="text-center">Loading subcontractors...</div>
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Subcontractor Network</h3>
        <div className="card-toolbar">
          <ul className="nav nav-tabs nav-line-tabs nav-stretch fs-6 border-0 me-4">
            <li className="nav-item">
              <a
                className={`nav-link ${activeTab === 'subcontractors' ? 'active' : ''}`}
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  setActiveTab('subcontractors')
                }}
              >
                <i className="ki-duotone ki-people fs-6 me-1">
                  <span className="path1"></span>
                  <span className="path2"></span>
                  <span className="path3"></span>
                  <span className="path4"></span>
                  <span className="path5"></span>
                </i>
                Subcontractors
              </a>
            </li>
            <li className="nav-item">
              <a
                className={`nav-link ${activeTab === 'assignments' ? 'active' : ''}`}
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  setActiveTab('assignments')
                }}
              >
                <i className="ki-duotone ki-briefcase fs-6 me-1">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                Job Assignments
              </a>
            </li>
          </ul>
          
          {activeTab === 'subcontractors' && (
            <button 
              className="btn btn-primary btn-sm"
              onClick={() => setShowInviteModal(true)}
            >
              <i className="ki-duotone ki-plus fs-2 me-1">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              Invite Subcontractor
            </button>
          )}
        </div>
      </div>
      
      <div className="card-body">
        {activeTab === 'subcontractors' && (
          <>
            {subcontractors.length === 0 ? (
              <div className="text-center text-muted py-10">
                <i className="ki-duotone ki-people fs-3x text-muted mb-3">
                  <span className="path1"></span>
                  <span className="path2"></span>
                  <span className="path3"></span>
                  <span className="path4"></span>
                  <span className="path5"></span>
                </i>
                <div className="mb-3">No subcontractors in your network yet.</div>
                <div className="fs-7">Invite subcontractors to expand your service capabilities.</div>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-row-bordered">
                  <thead>
                    <tr className="fw-semibold fs-6 text-gray-800">
                      <th>Company</th>
                      <th>Contact</th>
                      <th>Trade Specialties</th>
                      <th>Subscription</th>
                      <th>Status</th>
                      <th>Invited</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subcontractors.map((subcontractor) => (
                      <tr key={subcontractor.id}>
                        <td>
                          <div className="fw-bold">{subcontractor.company_name}</div>
                          {subcontractor.license_number && (
                            <div className="text-muted fs-7">
                              License: {subcontractor.license_number}
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="fw-bold">{subcontractor.contact_name}</div>
                          <div className="text-muted fs-7">{subcontractor.email}</div>
                          {subcontractor.phone && (
                            <div className="text-muted fs-7">{subcontractor.phone}</div>
                          )}
                        </td>
                        <td>
                          <div className="d-flex flex-wrap gap-1">
                            {subcontractor.trade_specialties.map(trade => (
                              <span key={trade} className="badge badge-light-primary badge-sm">
                                {trade.replace('_', ' ').toUpperCase()}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${getSubscriptionColor(subcontractor.subscription_tier)}`}>
                            {subcontractor.subscription_tier.toUpperCase()}
                          </span>
                          {subcontractor.subscription_tier === 'free' && (
                            <div className="text-muted fs-8">Limited features</div>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${subcontractor.signup_completed ? 'badge-light-success' : 'badge-light-warning'}`}>
                            {subcontractor.signup_completed ? 'Active' : 'Pending Signup'}
                          </span>
                        </td>
                        <td>
                          <span className="fw-bold">
                            {new Date(subcontractor.invited_at).toLocaleDateString()}
                          </span>
                          {subcontractor.signup_completed_at && (
                            <div className="text-success fs-7">
                              Joined: {new Date(subcontractor.signup_completed_at).toLocaleDateString()}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {activeTab === 'assignments' && (
          <>
            {assignments.length === 0 ? (
              <div className="text-center text-muted py-10">
                <i className="ki-duotone ki-briefcase fs-3x text-muted mb-3">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                <div className="mb-3">No job assignments yet.</div>
                <div className="fs-7">Assign subcontractors to jobs from the job details page.</div>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-row-bordered">
                  <thead>
                    <tr className="fw-semibold fs-6 text-gray-800">
                      <th>Job</th>
                      <th>Subcontractor</th>
                      <th>Trade</th>
                      <th>Rate</th>
                      <th>Status</th>
                      <th>Start Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((assignment) => (
                      <tr key={assignment.id}>
                        <td>
                          <div className="fw-bold">{assignment.job?.title || 'Unknown Job'}</div>
                          {assignment.job?.location_address && (
                            <div className="text-muted fs-7">{assignment.job.location_address}</div>
                          )}
                        </td>
                        <td>
                          <div className="fw-bold">{assignment.subcontractor_company?.company_name}</div>
                          <div className="text-muted fs-7">{assignment.subcontractor_company?.contact_name}</div>
                        </td>
                        <td>
                          {assignment.trade ? (
                            <span className="badge badge-light-primary">
                              {assignment.trade.replace('_', ' ').toUpperCase()}
                            </span>
                          ) : (
                            <span className="text-muted">General</span>
                          )}
                        </td>
                        <td>
                          {assignment.hourly_rate ? (
                            <span className="fw-bold text-success">
                              ${assignment.hourly_rate}/hr
                            </span>
                          ) : (
                            <span className="text-muted">TBD</span>
                          )}
                          {assignment.estimated_hours && (
                            <div className="text-muted fs-7">
                              Est: {assignment.estimated_hours}h
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${getStatusColor(assignment.status)}`}>
                            {assignment.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td>
                          {assignment.start_date ? 
                            new Date(assignment.start_date).toLocaleDateString() :
                            'TBD'
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Invite Subcontractor Modal */}
      {showInviteModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Invite Subcontractor</h5>
                <button 
                  className="btn-close"
                  onClick={resetInviteForm}
                />
              </div>
              <form onSubmit={handleInviteSubcontractor}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label required">Company Name</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          name="company_name" 
                          required 
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label required">Contact Name</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          name="contact_name"
                          required 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label required">Email</label>
                        <input 
                          type="email" 
                          className="form-control" 
                          name="email"
                          required 
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Phone</label>
                        <input 
                          type="tel" 
                          className="form-control" 
                          name="phone"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Trade Specialties</label>
                    <div className="d-flex flex-wrap gap-3">
                      {tradeOptions.map(trade => (
                        <div key={trade.value} className="form-check">
                          <input 
                            className="form-check-input" 
                            type="checkbox" 
                            checked={selectedTrades.includes(trade.value)}
                            onChange={() => handleTradeToggle(trade.value)}
                          />
                          <label className="form-check-label">
                            {trade.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedTrades.length > 0 && (
                    <div className="mb-3">
                      <label className="form-label">Estimated Hourly Rates</label>
                      <div className="row">
                        {selectedTrades.map(trade => (
                          <div key={trade} className="col-md-4 mb-2">
                            <div className="input-group">
                              <span className="input-group-text">
                                {tradeOptions.find(t => t.value === trade)?.label}
                              </span>
                              <span className="input-group-text">$</span>
                              <input 
                                type="number" 
                                className="form-control" 
                                value={hourlyRates[trade] || ''}
                                onChange={(e) => handleHourlyRateChange(trade, Number(e.target.value))}
                                placeholder="0.00"
                                step="0.01"
                              />
                              <span className="input-group-text">/hr</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="form-label">Invitation Message</label>
                    <textarea 
                      className="form-control" 
                      name="invitation_message" 
                      rows={3}
                      placeholder="Personal message to include with the invitation..."
                    ></textarea>
                  </div>

                  <div className="alert alert-info">
                    <h6 className="alert-heading">Free Tier Account</h6>
                    <p className="mb-0">
                      Subcontractors will start with a free account that allows them to:
                    </p>
                    <ul className="mb-0 mt-2">
                      <li>Accept and manage job assignments from you</li>
                      <li>Basic communication features</li>
                      <li>Limited to 2 users</li>
                    </ul>
                    <p className="mb-0 mt-2">
                      <strong>They cannot:</strong> Add their own customers, create jobs, or access advanced features.
                    </p>
                  </div>
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={resetInviteForm}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Send Invitation
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}