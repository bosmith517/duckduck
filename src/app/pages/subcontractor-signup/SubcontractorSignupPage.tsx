import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { SubcontractorService, SubcontractorCompany } from '../../services/subcontractorService'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'

const SubcontractorSignupPage: React.FC = () => {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [company, setCompany] = useState<SubcontractorCompany | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedTrades, setSelectedTrades] = useState<string[]>([])

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
    if (token) {
      validateToken()
    }
  }, [token])

  const validateToken = async () => {
    if (!token) {
      setLoading(false)
      return
    }

    try {
      const companyData = await SubcontractorService.validateSignupToken(token)
      if (companyData) {
        setCompany(companyData)
        setSelectedTrades(companyData.trade_specialties || [])
      }
    } catch (error) {
      console.error('Error validating token:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!token || !company) return

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    setSubmitting(true)

    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: formData.get('first_name') as string,
            last_name: formData.get('last_name') as string,
            user_type: 'subcontractor'
          }
        }
      })

      if (authError) throw authError

      if (!authData.user) {
        throw new Error('Failed to create user account')
      }

      // Complete subcontractor signup
      await SubcontractorService.completeSubcontractorSignup(token, {
        user_id: authData.user.id,
        first_name: formData.get('first_name') as string,
        last_name: formData.get('last_name') as string,
        phone: formData.get('phone') as string || undefined,
        role: 'owner',
        trade_specialties: selectedTrades,
        hourly_rate: Number(formData.get('hourly_rate')) || undefined
      })

      showToast.success('Welcome to the subcontractor network! Your account has been created.')
      
      // Redirect to subcontractor dashboard (would need to be created)
      navigate('/subcontractor-dashboard')

    } catch (error: any) {
      console.error('Error completing signup:', error)
      showToast.error(error.message || 'Failed to complete signup')
    } finally {
      setSubmitting(false)
    }
  }

  const handleTradeToggle = (trade: string) => {
    setSelectedTrades(prev => 
      prev.includes(trade) 
        ? prev.filter(t => t !== trade)
        : [...prev, trade]
    )
  }

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  if (!company) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="text-center">
          <i className="ki-duotone ki-cross-circle fs-3x text-danger mb-3">
            <span className="path1"></span>
            <span className="path2"></span>
          </i>
          <h2>Invalid or Expired Invitation</h2>
          <p className="text-muted">This invitation link is no longer valid.</p>
          <p className="text-muted">Please contact the contractor who invited you for a new invitation.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-vh-100 bg-light">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-8">
            <div className="card shadow-sm my-5">
              <div className="card-header bg-primary text-white">
                <h2 className="card-title mb-0">Join as a Subcontractor</h2>
                <p className="card-text mb-0">Complete your signup to start collaborating</p>
              </div>
              
              <div className="card-body p-8">
                <div className="alert alert-info">
                  <h5 className="alert-heading">You've been invited by:</h5>
                  <p className="mb-2">
                    <strong>{company.company_name}</strong> has invited you to join their subcontractor network.
                  </p>
                  <p className="mb-0">
                    Your company: <strong>{company.company_name}</strong>
                  </p>
                </div>

                <form onSubmit={handleSignup}>
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-4">
                        <label className="form-label required">First Name</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          name="first_name" 
                          required 
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-4">
                        <label className="form-label required">Last Name</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          name="last_name"
                          required 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="form-label required">Email Address</label>
                    <input 
                      type="email" 
                      className="form-control" 
                      name="email"
                      defaultValue={company.email}
                      required 
                    />
                    <div className="form-text">This will be your login email</div>
                  </div>

                  <div className="mb-4">
                    <label className="form-label required">Password</label>
                    <input 
                      type="password" 
                      className="form-control" 
                      name="password"
                      minLength={6}
                      required 
                    />
                    <div className="form-text">Minimum 6 characters</div>
                  </div>

                  <div className="mb-4">
                    <label className="form-label">Phone Number</label>
                    <input 
                      type="tel" 
                      className="form-control" 
                      name="phone"
                      defaultValue={company.phone || ''}
                    />
                  </div>

                  <div className="mb-4">
                    <label className="form-label">Your Trade Specialties</label>
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
                    <div className="form-text">Select the trades you specialize in</div>
                  </div>

                  <div className="mb-4">
                    <label className="form-label">Your Hourly Rate</label>
                    <div className="input-group">
                      <span className="input-group-text">$</span>
                      <input 
                        type="number" 
                        className="form-control" 
                        name="hourly_rate"
                        step="0.01"
                        placeholder="0.00"
                      />
                      <span className="input-group-text">/hour</span>
                    </div>
                    <div className="form-text">Optional - you can set this later</div>
                  </div>

                  <div className="alert alert-success">
                    <h6 className="alert-heading">Free Account Benefits</h6>
                    <p className="mb-2">Your free subcontractor account includes:</p>
                    <ul className="mb-0">
                      <li>Accept and manage job assignments</li>
                      <li>Communicate with your main contractor</li>
                      <li>Track job progress and timesheets</li>
                      <li>Basic project management tools</li>
                      <li>Up to 2 team members</li>
                    </ul>
                    <hr />
                    <p className="mb-0">
                      <strong>Limitations:</strong> You cannot add your own customers or create independent jobs. 
                      Upgrade anytime to unlock full business features.
                    </p>
                  </div>

                  <div className="d-grid">
                    <button 
                      type="submit" 
                      className="btn btn-primary btn-lg"
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                          Creating Account...
                        </>
                      ) : (
                        'Complete Signup'
                      )}
                    </button>
                  </div>
                </form>

                <div className="text-center mt-4">
                  <small className="text-muted">
                    By signing up, you agree to collaborate as a subcontractor under the terms 
                    set by the inviting contractor.
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SubcontractorSignupPage