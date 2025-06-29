import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../supabaseClient'

interface HomeownerFormData {
  firstName: string
  lastName: string
  email: string
  phone: string
  password: string
  confirmPassword: string
  address: string
  city: string
  state: string
  zipCode: string
  homeType: string
  homeAge: string
  hearAboutUs: string
  agreesToTerms: boolean
  agreesToMarketing: boolean
}

const HomeownerSignupPage: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<HomeownerFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    homeType: '',
    homeAge: '',
    hearAboutUs: '',
    agreesToTerms: false,
    agreesToMarketing: false
  })

  const homeTypes = [
    'Single Family Home',
    'Townhouse',
    'Condo/Apartment',
    'Mobile Home',
    'Other'
  ]

  const homeAges = [
    'Less than 5 years',
    '5-10 years',
    '11-20 years',
    '21-30 years',
    'More than 30 years'
  ]

  const hearAboutOptions = [
    'Google Search',
    'Social Media',
    'Friend/Family Referral',
    'Service Company Recommendation',
    'Online Ad',
    'Other'
  ]

  const updateFormData = (field: keyof HomeownerFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const validateForm = (): boolean => {
    return formData.firstName.trim() !== '' && 
           formData.lastName.trim() !== '' && 
           formData.email.trim() !== '' && 
           formData.password.length >= 8 && 
           formData.password === formData.confirmPassword &&
           formData.agreesToTerms
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

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
            user_type: 'homeowner'
          }
        }
      })

      if (authError) throw authError

      // Create homeowner profile
      const { error: profileError } = await supabase
        .from('homeowner_profiles')
        .insert({
          user_id: authData.user?.id,
          first_name: formData.firstName,
          last_name: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zip_code: formData.zipCode,
          home_type: formData.homeType,
          home_age: formData.homeAge,
          settings: {
            hear_about_us: formData.hearAboutUs,
            marketing_consent: formData.agreesToMarketing
          }
        })

      if (profileError) throw profileError

      // Redirect to homeowner portal
      window.location.href = '/homeowner-portal'

    } catch (error) {
      console.error('Signup error:', error)
      alert('Error creating account. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-vh-100 bg-light d-flex align-items-center">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-xl-10">
            <div className="card shadow-lg border-0">
              <div className="row g-0">
                {/* Left Side - Benefits */}
                <div className="col-lg-5 bg-success d-flex flex-column">
                  <div className="p-8 flex-grow-1">
                    <Link to="/" className="d-flex align-items-center mb-8">
                      <div className="symbol symbol-40px me-3">
                        <span className="symbol-label bg-white">
                          <i className="ki-duotone ki-home-2 fs-2 text-success">
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                        </span>
                      </div>
                      <span className="fs-2 fw-bold text-white">TradeWorks Home</span>
                    </Link>

                    <h3 className="text-white fw-bold mb-4">Your Smart Home Assistant</h3>
                    <p className="text-white opacity-75 mb-8">
                      Take control of your home maintenance with AI-powered recommendations, 
                      equipment tracking, and professional service connections.
                    </p>

                    {/* Key Features */}
                    <div className="mb-8">
                      <h6 className="text-white fw-bold mb-4">What you'll get:</h6>
                      
                      <div className="d-flex align-items-start mb-4">
                        <i className="ki-duotone ki-camera fs-2 text-white me-3 mt-1">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        <div>
                          <div className="text-white fw-semibold">AI Equipment Recognition</div>
                          <div className="text-white opacity-75 fs-7">Take photos and get instant equipment identification</div>
                        </div>
                      </div>

                      <div className="d-flex align-items-start mb-4">
                        <i className="ki-duotone ki-notification-on fs-2 text-white me-3 mt-1">
                          <span className="path1"></span>
                          <span className="path2"></span>
                          <span className="path3"></span>
                        </i>
                        <div>
                          <div className="text-white fw-semibold">Smart Maintenance Reminders</div>
                          <div className="text-white opacity-75 fs-7">Never miss important maintenance again</div>
                        </div>
                      </div>

                      <div className="d-flex align-items-start mb-4">
                        <i className="ki-duotone ki-weather-cloudy fs-2 text-white me-3 mt-1">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        <div>
                          <div className="text-white fw-semibold">Climate-Specific Tips</div>
                          <div className="text-white opacity-75 fs-7">Seasonal recommendations for your local climate</div>
                        </div>
                      </div>

                      <div className="d-flex align-items-start mb-4">
                        <i className="ki-duotone ki-profile-user fs-2 text-white me-3 mt-1">
                          <span className="path1"></span>
                          <span className="path2"></span>
                          <span className="path3"></span>
                        </i>
                        <div>
                          <div className="text-white fw-semibold">Find Trusted Professionals</div>
                          <div className="text-white opacity-75 fs-7">Connect with verified service providers in your area</div>
                        </div>
                      </div>
                    </div>

                    {/* Free Features */}
                    <div className="bg-white bg-opacity-10 rounded p-4 mb-8">
                      <h6 className="text-white fw-bold mb-3">🎉 Completely Free for Homeowners</h6>
                      <ul className="list-unstyled mb-0">
                        <li className="d-flex align-items-center mb-2">
                          <i className="ki-duotone ki-check fs-5 text-white me-2">
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                          <span className="text-white">No subscription fees</span>
                        </li>
                        <li className="d-flex align-items-center mb-2">
                          <i className="ki-duotone ki-check fs-5 text-white me-2">
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                          <span className="text-white">No hidden costs</span>
                        </li>
                        <li className="d-flex align-items-center">
                          <i className="ki-duotone ki-check fs-5 text-white me-2">
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                          <span className="text-white">Full access to all features</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Testimonial */}
                  <div className="p-6 bg-white bg-opacity-10">
                    <p className="text-white mb-3">
                      "I love how it reminds me when to change my air filter and gives me tips specific to Texas weather!"
                    </p>
                    <div className="d-flex align-items-center">
                      <div className="symbol symbol-35px me-3">
                        <img src="https://images.unsplash.com/photo-1494790108755-2616b612b47c?w=35&h=35&fit=crop&crop=face" alt="Customer" className="rounded-circle" />
                      </div>
                      <div>
                        <div className="text-white fw-semibold">Sarah M.</div>
                        <div className="text-white opacity-75 fs-7">Austin Homeowner</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Side - Signup Form */}
                <div className="col-lg-7">
                  <div className="p-8">
                    <h4 className="text-dark fw-bold mb-2">Create Your Free Account</h4>
                    <p className="text-muted mb-8">Join thousands of homeowners taking control of their home maintenance</p>

                    {/* Personal Information */}
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

                    <div className="row g-5 mb-5">
                      <div className="col-md-6">
                        <label className="form-label required">Email Address</label>
                        <input
                          type="email"
                          className="form-control form-control-lg"
                          placeholder="your@email.com"
                          value={formData.email}
                          onChange={(e) => updateFormData('email', e.target.value)}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Phone Number</label>
                        <input
                          type="tel"
                          className="form-control form-control-lg"
                          placeholder="(555) 123-4567"
                          value={formData.phone}
                          onChange={(e) => updateFormData('phone', e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Home Address */}
                    <div className="mb-5">
                      <label className="form-label">Home Address</label>
                      <input
                        type="text"
                        className="form-control form-control-lg"
                        placeholder="123 Main Street"
                        value={formData.address}
                        onChange={(e) => updateFormData('address', e.target.value)}
                      />
                    </div>

                    <div className="row g-5 mb-5">
                      <div className="col-md-6">
                        <label className="form-label">City</label>
                        <input
                          type="text"
                          className="form-control form-control-lg"
                          placeholder="City"
                          value={formData.city}
                          onChange={(e) => updateFormData('city', e.target.value)}
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label">State</label>
                        <input
                          type="text"
                          className="form-control form-control-lg"
                          placeholder="TX"
                          value={formData.state}
                          onChange={(e) => updateFormData('state', e.target.value)}
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label">ZIP Code</label>
                        <input
                          type="text"
                          className="form-control form-control-lg"
                          placeholder="12345"
                          value={formData.zipCode}
                          onChange={(e) => updateFormData('zipCode', e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Home Details */}
                    <div className="row g-5 mb-5">
                      <div className="col-md-6">
                        <label className="form-label">Home Type</label>
                        <select
                          className="form-select form-select-lg"
                          value={formData.homeType}
                          onChange={(e) => updateFormData('homeType', e.target.value)}
                        >
                          <option value="">Select home type</option>
                          {homeTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Home Age</label>
                        <select
                          className="form-select form-select-lg"
                          value={formData.homeAge}
                          onChange={(e) => updateFormData('homeAge', e.target.value)}
                        >
                          <option value="">Select home age</option>
                          {homeAges.map(age => (
                            <option key={age} value={age}>{age}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Password */}
                    <div className="row g-5 mb-5">
                      <div className="col-md-6">
                        <label className="form-label required">Password</label>
                        <input
                          type="password"
                          className="form-control form-control-lg"
                          placeholder="Create a password"
                          value={formData.password}
                          onChange={(e) => updateFormData('password', e.target.value)}
                        />
                        <div className="form-text">Must be at least 8 characters</div>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label required">Confirm Password</label>
                        <input
                          type="password"
                          className="form-control form-control-lg"
                          placeholder="Confirm password"
                          value={formData.confirmPassword}
                          onChange={(e) => updateFormData('confirmPassword', e.target.value)}
                        />
                        {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                          <div className="form-text text-danger">Passwords do not match</div>
                        )}
                      </div>
                    </div>

                    {/* How did you hear about us */}
                    <div className="mb-5">
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

                    {/* Terms and Marketing */}
                    <div className="mb-5">
                      <div className="form-check mb-3">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={formData.agreesToTerms}
                          onChange={(e) => updateFormData('agreesToTerms', e.target.checked)}
                          id="homeowner-terms"
                        />
                        <label className="form-check-label" htmlFor="homeowner-terms">
                          I agree to the <a href="#" className="text-primary">Terms of Service</a> and <a href="#" className="text-primary">Privacy Policy</a>
                        </label>
                      </div>
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={formData.agreesToMarketing}
                          onChange={(e) => updateFormData('agreesToMarketing', e.target.checked)}
                          id="homeowner-marketing"
                        />
                        <label className="form-check-label" htmlFor="homeowner-marketing">
                          Send me helpful home maintenance tips and updates (optional)
                        </label>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <div className="d-flex justify-content-between align-items-center">
                      <Link to="/" className="text-muted">
                        ← Back to Home
                      </Link>
                      <button
                        className="btn btn-success btn-lg"
                        onClick={handleSubmit}
                        disabled={!validateForm() || isSubmitting}
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
                            Create Free Account
                          </>
                        )}
                      </button>
                    </div>

                    <div className="text-center mt-6">
                      <small className="text-muted">
                        Already have an account? <Link to="/auth/login" className="text-primary">Sign in here</Link>
                      </small>
                    </div>
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

export default HomeownerSignupPage