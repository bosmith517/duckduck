import React, { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../../supabaseClient'

interface CompanyFormData {
  companyName: string
  businessType: string
  employeeCount: string
  firstName: string
  lastName: string
  email: string
  phone: string
  password: string
  confirmPassword: string
  plan: string
  hearAboutUs: string
  agreesToTerms: boolean
  agreesToMarketing: boolean
}

const SignupPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const selectedPlan = searchParams.get('plan') || 'professional'
  
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<CompanyFormData>({
    companyName: '',
    businessType: '',
    employeeCount: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    plan: selectedPlan,
    hearAboutUs: '',
    agreesToTerms: false,
    agreesToMarketing: false
  })

  const businessTypes = [
    'HVAC',
    'Plumbing',
    'Electrical',
    'General Contractor',
    'Landscaping',
    'Cleaning Services',
    'Appliance Repair',
    'Handyman Services',
    'Other'
  ]

  const employeeCounts = [
    '1-5 employees',
    '6-15 employees',
    '16-50 employees',
    '51-100 employees',
    '100+ employees'
  ]

  const hearAboutOptions = [
    'Google Search',
    'Social Media',
    'Referral from colleague',
    'Industry publication',
    'Trade show/event',
    'Partner recommendation',
    'Other'
  ]

  const updateFormData = (field: keyof CompanyFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return formData.companyName.trim() !== '' && 
               formData.businessType !== '' && 
               formData.employeeCount !== ''
      case 2:
        return formData.firstName.trim() !== '' && 
               formData.lastName.trim() !== '' && 
               formData.email.trim() !== '' && 
               formData.phone.trim() !== ''
      case 3:
        return formData.password.length >= 8 && 
               formData.password === formData.confirmPassword &&
               formData.agreesToTerms
      default:
        return false
    }
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 3))
    }
  }

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
  }

  const handleSubmit = async () => {
    if (!validateStep(3)) return

    setIsSubmitting(true)
    try {
      // Create user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            phone: formData.phone,
            user_type: 'company_admin'
          }
        }
      })

      if (authError) throw authError

      // Create company record
      const { error: companyError } = await supabase
        .from('companies')
        .insert({
          name: formData.companyName,
          business_type: formData.businessType,
          employee_count: formData.employeeCount,
          subscription_plan: formData.plan,
          subscription_status: 'trial',
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          owner_id: authData.user?.id,
          settings: {
            hear_about_us: formData.hearAboutUs,
            marketing_consent: formData.agreesToMarketing
          }
        })

      if (companyError) throw companyError

      // Redirect to onboarding
      window.location.href = '/onboarding'

    } catch (error) {
      console.error('Signup error:', error)
      alert('Error creating account. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getPlanDetails = (planName: string) => {
    switch (planName) {
      case 'starter':
        return { price: '$99', features: ['Up to 5 technicians', 'Customer portals', 'Basic AI', 'VoIP & SMS'] }
      case 'professional':
        return { price: '$249', features: ['Up to 25 technicians', 'Advanced AI', 'Video calls', 'Analytics'] }
      case 'enterprise':
        return { price: 'Custom', features: ['Unlimited technicians', 'Custom integrations', 'White-label', '24/7 support'] }
      default:
        return { price: '$249', features: ['Professional features'] }
    }
  }

  const planDetails = getPlanDetails(formData.plan)

  return (
    <div className="min-vh-100 bg-light d-flex align-items-center">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-xl-10">
            <div className="card shadow-lg border-0">
              <div className="row g-0">
                {/* Left Side - Plan Summary */}
                <div className="col-lg-5 bg-primary d-flex flex-column">
                  <div className="p-8 flex-grow-1">
                    <Link to="/" className="d-flex align-items-center mb-8">
                      <div className="symbol symbol-40px me-3">
                        <span className="symbol-label bg-white">
                          <i className="ki-duotone ki-technology-4 fs-2 text-primary">
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                        </span>
                      </div>
                      <span className="fs-2 fw-bold text-white">TradeWorks Pro</span>
                    </Link>

                    <h3 className="text-white fw-bold mb-4">Start Your Free Trial</h3>
                    <p className="text-white opacity-75 mb-8">
                      Join thousands of service companies transforming their customer experience
                    </p>

                    {/* Selected Plan */}
                    <div className="bg-white bg-opacity-10 rounded p-6 mb-8">
                      <h5 className="text-white fw-bold mb-3">
                        {formData.plan.charAt(0).toUpperCase() + formData.plan.slice(1)} Plan
                      </h5>
                      <div className="d-flex align-items-center mb-4">
                        <span className="fs-2 fw-bold text-white">{planDetails.price}</span>
                        {planDetails.price !== 'Custom' && <span className="text-white opacity-75">/month</span>}
                      </div>
                      <ul className="list-unstyled">
                        {planDetails.features.map((feature, index) => (
                          <li key={index} className="d-flex align-items-center mb-2">
                            <i className="ki-duotone ki-check fs-5 text-white me-2">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                            <span className="text-white">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Benefits */}
                    <div className="mb-8">
                      <h6 className="text-white fw-bold mb-4">What you get:</h6>
                      <div className="d-flex align-items-center mb-3">
                        <i className="ki-duotone ki-verify fs-4 text-white me-3">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        <span className="text-white">14-day free trial</span>
                      </div>
                      <div className="d-flex align-items-center mb-3">
                        <i className="ki-duotone ki-verify fs-4 text-white me-3">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        <span className="text-white">No setup fees</span>
                      </div>
                      <div className="d-flex align-items-center mb-3">
                        <i className="ki-duotone ki-verify fs-4 text-white me-3">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        <span className="text-white">Cancel anytime</span>
                      </div>
                    </div>
                  </div>

                  {/* Customer Testimonial */}
                  <div className="p-6 bg-white bg-opacity-10">
                    <p className="text-white mb-3">
                      "TradeWorks Pro transformed how we interact with customers. Our satisfaction scores increased 40% in just 3 months."
                    </p>
                    <div className="d-flex align-items-center">
                      <div className="symbol symbol-35px me-3">
                        <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=35&h=35&fit=crop&crop=face" alt="Customer" className="rounded-circle" />
                      </div>
                      <div>
                        <div className="text-white fw-semibold">Mike Johnson</div>
                        <div className="text-white opacity-75 fs-7">Owner, Johnson HVAC</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Side - Signup Form */}
                <div className="col-lg-7">
                  <div className="p-8">
                    {/* Progress Indicator */}
                    <div className="d-flex justify-content-center mb-8">
                      <div className="d-flex align-items-center">
                        <div className={`w-30px h-30px rounded-circle d-flex align-items-center justify-content-center fw-bold ${currentStep >= 1 ? 'bg-primary text-white' : 'bg-light text-muted'}`}>
                          1
                        </div>
                        <div className={`w-50px h-2px ${currentStep > 1 ? 'bg-primary' : 'bg-light'}`}></div>
                        <div className={`w-30px h-30px rounded-circle d-flex align-items-center justify-content-center fw-bold ${currentStep >= 2 ? 'bg-primary text-white' : 'bg-light text-muted'}`}>
                          2
                        </div>
                        <div className={`w-50px h-2px ${currentStep > 2 ? 'bg-primary' : 'bg-light'}`}></div>
                        <div className={`w-30px h-30px rounded-circle d-flex align-items-center justify-content-center fw-bold ${currentStep >= 3 ? 'bg-primary text-white' : 'bg-light text-muted'}`}>
                          3
                        </div>
                      </div>
                    </div>

                    {/* Step 1: Company Information */}
                    {currentStep === 1 && (
                      <div>
                        <h4 className="text-dark fw-bold mb-2">Company Information</h4>
                        <p className="text-muted mb-6">Tell us about your business</p>

                        <div className="mb-5">
                          <label className="form-label required">Company Name</label>
                          <input
                            type="text"
                            className="form-control form-control-lg"
                            placeholder="Enter your company name"
                            value={formData.companyName}
                            onChange={(e) => updateFormData('companyName', e.target.value)}
                          />
                        </div>

                        <div className="mb-5">
                          <label className="form-label required">Business Type</label>
                          <select
                            className="form-select form-select-lg"
                            value={formData.businessType}
                            onChange={(e) => updateFormData('businessType', e.target.value)}
                          >
                            <option value="">Select your business type</option>
                            {businessTypes.map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>

                        <div className="mb-8">
                          <label className="form-label required">Company Size</label>
                          <select
                            className="form-select form-select-lg"
                            value={formData.employeeCount}
                            onChange={(e) => updateFormData('employeeCount', e.target.value)}
                          >
                            <option value="">Select company size</option>
                            {employeeCounts.map(count => (
                              <option key={count} value={count}>{count}</option>
                            ))}
                          </select>
                        </div>

                        <div className="d-flex justify-content-between">
                          <Link to="/" className="btn btn-light-secondary">
                            Back to Home
                          </Link>
                          <button
                            className="btn btn-primary"
                            onClick={nextStep}
                            disabled={!validateStep(1)}
                          >
                            Continue
                            <i className="ki-duotone ki-right fs-5 ms-2">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Step 2: Personal Information */}
                    {currentStep === 2 && (
                      <div>
                        <h4 className="text-dark fw-bold mb-2">Your Information</h4>
                        <p className="text-muted mb-6">We'll use this to set up your account</p>

                        <div className="row g-5 mb-5">
                          <div className="col-md-6">
                            <label className="form-label required">First Name</label>
                            <input
                              type="text"
                              className="form-control form-control-lg"
                              placeholder="First name"
                              value={formData.firstName}
                              onChange={(e) => updateFormData('firstName', e.target.value)}
                            />
                          </div>
                          <div className="col-md-6">
                            <label className="form-label required">Last Name</label>
                            <input
                              type="text"
                              className="form-control form-control-lg"
                              placeholder="Last name"
                              value={formData.lastName}
                              onChange={(e) => updateFormData('lastName', e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="mb-5">
                          <label className="form-label required">Email Address</label>
                          <input
                            type="email"
                            className="form-control form-control-lg"
                            placeholder="your@company.com"
                            value={formData.email}
                            onChange={(e) => updateFormData('email', e.target.value)}
                          />
                        </div>

                        <div className="mb-5">
                          <label className="form-label required">Phone Number</label>
                          <input
                            type="tel"
                            className="form-control form-control-lg"
                            placeholder="(555) 123-4567"
                            value={formData.phone}
                            onChange={(e) => updateFormData('phone', e.target.value)}
                          />
                        </div>

                        <div className="mb-8">
                          <label className="form-label">How did you hear about us?</label>
                          <select
                            className="form-select form-select-lg"
                            value={formData.hearAboutUs}
                            onChange={(e) => updateFormData('hearAboutUs', e.target.value)}
                          >
                            <option value="">Select an option</option>
                            {hearAboutOptions.map(option => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        </div>

                        <div className="d-flex justify-content-between">
                          <button className="btn btn-light-secondary" onClick={prevStep}>
                            <i className="ki-duotone ki-left fs-5 me-2">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                            Back
                          </button>
                          <button
                            className="btn btn-primary"
                            onClick={nextStep}
                            disabled={!validateStep(2)}
                          >
                            Continue
                            <i className="ki-duotone ki-right fs-5 ms-2">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Step 3: Security & Terms */}
                    {currentStep === 3 && (
                      <div>
                        <h4 className="text-dark fw-bold mb-2">Secure Your Account</h4>
                        <p className="text-muted mb-6">Create a strong password to protect your data</p>

                        <div className="mb-5">
                          <label className="form-label required">Password</label>
                          <input
                            type="password"
                            className="form-control form-control-lg"
                            placeholder="Create a strong password"
                            value={formData.password}
                            onChange={(e) => updateFormData('password', e.target.value)}
                          />
                          <div className="form-text">Password must be at least 8 characters long</div>
                        </div>

                        <div className="mb-8">
                          <label className="form-label required">Confirm Password</label>
                          <input
                            type="password"
                            className="form-control form-control-lg"
                            placeholder="Confirm your password"
                            value={formData.confirmPassword}
                            onChange={(e) => updateFormData('confirmPassword', e.target.value)}
                          />
                          {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                            <div className="form-text text-danger">Passwords do not match</div>
                          )}
                        </div>

                        <div className="mb-5">
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={formData.agreesToTerms}
                              onChange={(e) => updateFormData('agreesToTerms', e.target.checked)}
                              id="terms"
                            />
                            <label className="form-check-label" htmlFor="terms">
                              I agree to the <a href="#" className="text-primary">Terms of Service</a> and <a href="#" className="text-primary">Privacy Policy</a>
                            </label>
                          </div>
                        </div>

                        <div className="mb-8">
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={formData.agreesToMarketing}
                              onChange={(e) => updateFormData('agreesToMarketing', e.target.checked)}
                              id="marketing"
                            />
                            <label className="form-check-label" htmlFor="marketing">
                              Send me product updates and marketing emails (optional)
                            </label>
                          </div>
                        </div>

                        <div className="d-flex justify-content-between">
                          <button className="btn btn-light-secondary" onClick={prevStep}>
                            <i className="ki-duotone ki-left fs-5 me-2">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                            Back
                          </button>
                          <button
                            className="btn btn-success btn-lg"
                            onClick={handleSubmit}
                            disabled={!validateStep(3) || isSubmitting}
                          >
                            {isSubmitting ? (
                              <>
                                <span className="spinner-border spinner-border-sm me-2"></span>
                                Creating Account...
                              </>
                            ) : (
                              <>
                                <i className="ki-duotone ki-check fs-5 me-2">
                                  <span className="path1"></span>
                                  <span className="path2"></span>
                                </i>
                                Start Free Trial
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SignupPage