import React, { useState, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { KTIcon } from '../../../_metronic/helpers'

interface OnboardingModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
}

interface OnboardingData {
  businessName: string
  businessEmail: string
  businessPhone: string
  businessAddress: string
  serviceType: string
  desiredAreaCode: string
  selectedPhoneNumber: string
  companyLogo: File | null
  companyLogoUrl: string
  preferences: {
    clientPortal: boolean
    automaticReminders: boolean
    photoDocumentation: boolean
  }
}

const STEPS = [
  { id: 'welcome', title: 'Welcome', icon: 'rocket' },
  { id: 'business', title: 'Business Info', icon: 'office-bag' },
  { id: 'service', title: 'Service Type', icon: 'abstract-26' },
  { id: 'phone', title: 'Business Phone', icon: 'phone' },
  { id: 'preferences', title: 'Preferences', icon: 'setting-3' },
  { id: 'complete', title: 'Complete', icon: 'check-circle' }
]

const SERVICE_TYPES = [
  { code: 'hvac', name: 'HVAC', icon: 'temperature', description: 'Heating, Ventilation & AC' },
  { code: 'plumbing', name: 'Plumbing', icon: 'water', description: 'Plumbing Services' },
  { code: 'electrical', name: 'Electrical', icon: 'flash', description: 'Electrical Services' },
  { code: 'roofing', name: 'Roofing', icon: 'home-2', description: 'Roofing Services' },
  { code: 'general', name: 'General Contractor', icon: 'abstract-26', description: 'General Contracting' },
  { code: 'landscaping', name: 'Landscaping', icon: 'flower', description: 'Landscaping & Lawn Care' }
]

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose, onComplete }) => {
  const { tenant, userProfile } = useSupabaseAuth()
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [availableNumbers, setAvailableNumbers] = useState<any[]>([])
  const [searchingNumbers, setSearchingNumbers] = useState(false)
  
  const [formData, setFormData] = useState<OnboardingData>({
    businessName: '',
    businessEmail: '',
    businessPhone: '',
    businessAddress: '',
    serviceType: '',
    desiredAreaCode: '',
    selectedPhoneNumber: '',
    companyLogo: null,
    companyLogoUrl: '',
    preferences: {
      clientPortal: true,
      automaticReminders: true,
      photoDocumentation: true
    }
  })

  // Prepopulate form data when modal opens and tenant/userProfile are available
  useEffect(() => {
    if (isOpen && tenant && userProfile) {
      console.log('OnboardingModal: Prepopulating form data', { tenant, userProfile })
      
      // Map business type from signup to service type
      const mapBusinessTypeToServiceType = (businessType: string): string => {
        const mapping: { [key: string]: string } = {
          'HVAC': 'hvac',
          'Plumbing': 'plumbing',
          'Electrical': 'electrical',
          'General Contractor': 'general',
          'Landscaping': 'landscaping',
          'Roofing': 'roofing',
          'Handyman Services': 'general',
          'Appliance Repair': 'hvac',
          'Cleaning Services': 'general',
          'Other': 'general'
        }
        return mapping[businessType] || ''
      }

      setFormData(prev => ({
        ...prev,
        businessName: tenant.company_name || tenant.name || prev.businessName,
        businessEmail: userProfile.email || prev.businessEmail,
        serviceType: tenant.service_type ? mapBusinessTypeToServiceType(tenant.service_type) : prev.serviceType
      }))
    }
  }, [isOpen, tenant, userProfile])

  const searchPhoneNumbers = async () => {
    if (!formData.desiredAreaCode || formData.desiredAreaCode.length !== 3) {
      alert('Please enter a valid 3-digit area code')
      return
    }

    setSearchingNumbers(true)
    try {
      const { data, error } = await supabase.functions.invoke('search-available-numbers', {
        body: { areaCode: formData.desiredAreaCode }
      })

      if (error) throw error
      setAvailableNumbers(data.numbers || [])
    } catch (error) {
      console.error('Error searching numbers:', error)
      // Mock data for demo
      const mockNumbers = [
        { phone_number: `+1${formData.desiredAreaCode}5551234`, friendly_name: `(${formData.desiredAreaCode}) 555-1234`, locality: 'Demo City', region: 'Demo State' },
        { phone_number: `+1${formData.desiredAreaCode}5555678`, friendly_name: `(${formData.desiredAreaCode}) 555-5678`, locality: 'Demo City', region: 'Demo State' },
        { phone_number: `+1${formData.desiredAreaCode}5559012`, friendly_name: `(${formData.desiredAreaCode}) 555-9012`, locality: 'Demo City', region: 'Demo State' }
      ]
      setAvailableNumbers(mockNumbers)
    } finally {
      setSearchingNumbers(false)
    }
  }

  const handleLogoUpload = (file: File) => {
    setFormData(prev => ({ ...prev, companyLogo: file }))
    const reader = new FileReader()
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, companyLogoUrl: reader.result as string }))
    }
    reader.readAsDataURL(file)
  }

  const handleNext = async () => {
    if (currentStep === STEPS.length - 1) {
      await completeOnboarding()
    } else {
      setCurrentStep(prev => prev + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const completeOnboarding = async () => {
    if (!tenant?.id) return

    setLoading(true)
    try {
      const { error } = await supabase.functions.invoke('complete-full-onboarding', {
        body: {
          tenantId: tenant.id,
          onboardingData: {
            ...formData,
            companyLogo: formData.companyLogoUrl
          }
        }
      })

      if (error) throw error

      // Mark tenant as onboarded
      await supabase
        .from('tenants')
        .update({ onboarding_completed: true })
        .eq('id', tenant.id)

      onComplete()
    } catch (error) {
      console.error('Error completing onboarding:', error)
      alert('There was an error completing setup. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const renderStepContent = () => {
    const step = STEPS[currentStep]

    switch (step.id) {
      case 'welcome':
        return (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <h3 style={{ marginBottom: '20px', color: '#333', fontSize: '20px' }}>
              Let's Get Your Business Set Up!
            </h3>
            
            <p style={{ marginBottom: '32px', color: '#666', lineHeight: '1.6', fontSize: '16px' }}>
              We'll customize TradeWorks Pro specifically for your business type and workflow. 
              This quick setup will only take 3-4 minutes.
            </p>
            
            <div style={{ marginBottom: '24px', textAlign: 'left', maxWidth: '400px', margin: '0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ color: '#007bff', marginRight: '8px', fontSize: '16px' }}>✓</span>
                <strong style={{ color: '#007bff' }}>Industry-specific customization</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ color: '#007bff', marginRight: '8px', fontSize: '16px' }}>✓</span>
                <strong style={{ color: '#007bff' }}>Workflow optimization</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ color: '#007bff', marginRight: '8px', fontSize: '16px' }}>✓</span>
                <strong style={{ color: '#007bff' }}>Professional business phone setup</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ color: '#007bff', marginRight: '8px', fontSize: '16px' }}>✓</span>
                <strong style={{ color: '#007bff' }}>Client communication tools</strong>
              </div>
            </div>
            
            <p style={{ fontSize: '14px', color: '#999', fontStyle: 'italic' }}>
              You can always customize these settings later from your dashboard
            </p>
          </div>
        )

      case 'business':
        return (
          <div>
            <h3 className='mb-5'>Business Information</h3>
            <div className='row'>
              <div className='col-12 mb-4'>
                <label className='form-label required'>Business Name</label>
                <input
                  type='text'
                  className='form-control form-control-lg'
                  placeholder='Enter your business name'
                  value={formData.businessName}
                  onChange={(e) => setFormData(prev => ({ ...prev, businessName: e.target.value }))}
                />
              </div>
              <div className='col-12 mb-4'>
                <label className='form-label'>Business Email</label>
                <input
                  type='email'
                  className='form-control form-control-lg'
                  placeholder='business@example.com'
                  value={formData.businessEmail}
                  onChange={(e) => setFormData(prev => ({ ...prev, businessEmail: e.target.value }))}
                />
              </div>
              <div className='col-12 mb-4'>
                <label className='form-label'>Business Address</label>
                <input
                  type='text'
                  className='form-control form-control-lg'
                  placeholder='Street address, City, State'
                  value={formData.businessAddress}
                  onChange={(e) => setFormData(prev => ({ ...prev, businessAddress: e.target.value }))}
                />
              </div>
            </div>
          </div>
        )

      case 'service':
        return (
          <div>
            <h3 className='mb-5'>What services do you provide?</h3>
            <p className='text-muted mb-6'>Select your primary service type to customize the platform.</p>
            <div className='row'>
              {SERVICE_TYPES.map((type) => (
                <div key={type.code} className='col-md-6 mb-4'>
                  <label className='d-flex cursor-pointer'>
                    <input
                      type='radio'
                      className='d-none'
                      name='serviceType'
                      value={type.code}
                      checked={formData.serviceType === type.code}
                      onChange={(e) => setFormData(prev => ({ ...prev, serviceType: e.target.value }))}
                    />
                    <div className={`card w-100 ${formData.serviceType === type.code ? 'border-primary bg-light-primary' : 'border-gray-300'}`}>
                      <div className='card-body text-center py-4'>
                        <div className='symbol symbol-50px mb-3 mx-auto'>
                          <div className={`symbol-label ${formData.serviceType === type.code ? 'bg-primary' : 'bg-light-primary'}`}>
                            <KTIcon 
                              iconName={type.icon} 
                              className={`fs-2x ${formData.serviceType === type.code ? 'text-white' : 'text-primary'}`} 
                            />
                          </div>
                        </div>
                        <h5 className='mb-1'>{type.name}</h5>
                        <p className='text-muted fs-7 mb-0'>{type.description}</p>
                      </div>
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )

      case 'phone':
        return (
          <div>
            <h3 className='mb-5'>Get Your Business Phone Number</h3>
            <p className='text-muted mb-6'>
              Get a professional phone line with VoIP calling, SMS, and call management.
            </p>

            {!formData.selectedPhoneNumber ? (
              <div>
                <div className='row mb-5'>
                  <div className='col-md-6'>
                    <label className='form-label required'>Preferred Area Code</label>
                    <input
                      type='text'
                      className='form-control form-control-lg'
                      placeholder='Enter 3 digits (e.g., 312)'
                      value={formData.desiredAreaCode}
                      maxLength={3}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '')
                        setFormData(prev => ({ ...prev, desiredAreaCode: value }))
                      }}
                    />
                  </div>
                  <div className='col-md-6 d-flex align-items-end'>
                    <button
                      type='button'
                      className='btn btn-primary btn-lg'
                      onClick={searchPhoneNumbers}
                      disabled={!formData.desiredAreaCode || formData.desiredAreaCode.length !== 3 || searchingNumbers}
                    >
                      {searchingNumbers ? (
                        <>
                          <span className='spinner-border spinner-border-sm me-2' />
                          Searching...
                        </>
                      ) : (
                        'Search Numbers'
                      )}
                    </button>
                  </div>
                </div>

                {availableNumbers.length > 0 && (
                  <div>
                    <h5 className='mb-4'>Available Numbers</h5>
                    <div className='row'>
                      {availableNumbers.slice(0, 3).map((number, index) => (
                        <div key={index} className='col-12 mb-3'>
                          <label className='d-flex cursor-pointer'>
                            <input
                              type='radio'
                              className='d-none'
                              name='phoneNumber'
                              value={number.phone_number}
                              checked={formData.selectedPhoneNumber === number.phone_number}
                              onChange={(e) => setFormData(prev => ({ ...prev, selectedPhoneNumber: e.target.value }))}
                            />
                            <div className={`card w-100 ${formData.selectedPhoneNumber === number.phone_number ? 'border-primary bg-light-primary' : 'border-gray-300'}`}>
                              <div className='card-body d-flex align-items-center py-3'>
                                <div className='symbol symbol-40px me-3'>
                                  <div className='symbol-label bg-light-success'>
                                    <KTIcon iconName='phone' className='fs-4 text-success' />
                                  </div>
                                </div>
                                <div className='flex-grow-1'>
                                  <div className='fs-4 fw-bold text-primary'>
                                    {number.friendly_name || number.phone_number}
                                  </div>
                                  <div className='text-muted fs-7'>
                                    {number.locality}, {number.region}
                                  </div>
                                </div>
                                {formData.selectedPhoneNumber === number.phone_number && (
                                  <KTIcon iconName='check-circle' className='fs-3 text-success' />
                                )}
                              </div>
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className='text-center py-6'>
                <div className='symbol symbol-100px mb-5 mx-auto'>
                  <div className='symbol-label bg-light-success'>
                    <KTIcon iconName='phone' className='fs-2x text-success' />
                  </div>
                </div>
                <h4 className='text-success mb-3'>Phone Number Selected!</h4>
                <div className='fs-2 fw-bold text-primary mb-4'>{formData.selectedPhoneNumber}</div>
                <p className='text-muted mb-0'>Your business phone will be provisioned during setup completion.</p>
              </div>
            )}
          </div>
        )

      case 'preferences':
        return (
          <div>
            <h3 className='mb-5'>Setup Preferences</h3>
            <p className='text-muted mb-6'>Configure your workflow preferences.</p>
            
            <div className='row'>
              <div className='col-12'>
                <div className='form-check form-switch mb-5'>
                  <input
                    className='form-check-input'
                    type='checkbox'
                    id='clientPortal'
                    checked={formData.preferences.clientPortal}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      preferences: { ...prev.preferences, clientPortal: e.target.checked }
                    }))}
                  />
                  <label className='form-check-label' htmlFor='clientPortal'>
                    <div className='fw-bold'>Enable Client Portal</div>
                    <div className='text-muted fs-7'>Let customers view projects and invoices online</div>
                  </label>
                </div>

                <div className='form-check form-switch mb-5'>
                  <input
                    className='form-check-input'
                    type='checkbox'
                    id='automaticReminders'
                    checked={formData.preferences.automaticReminders}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      preferences: { ...prev.preferences, automaticReminders: e.target.checked }
                    }))}
                  />
                  <label className='form-check-label' htmlFor='automaticReminders'>
                    <div className='fw-bold'>Automatic Reminders</div>
                    <div className='text-muted fs-7'>Send follow-up emails and appointment reminders</div>
                  </label>
                </div>

                <div className='form-check form-switch mb-5'>
                  <input
                    className='form-check-input'
                    type='checkbox'
                    id='photoDocumentation'
                    checked={formData.preferences.photoDocumentation}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      preferences: { ...prev.preferences, photoDocumentation: e.target.checked }
                    }))}
                  />
                  <label className='form-check-label' htmlFor='photoDocumentation'>
                    <div className='fw-bold'>Photo Documentation</div>
                    <div className='text-muted fs-7'>Require photos for job completion</div>
                  </label>
                </div>
              </div>
            </div>

            {/* Logo Upload */}
            <div className='separator my-6'></div>
            <h4 className='mb-4'>Company Logo (Optional)</h4>
            <div className='d-flex align-items-center'>
              {formData.companyLogoUrl ? (
                <div className='symbol symbol-75px me-4'>
                  <img src={formData.companyLogoUrl} alt='Company Logo' className='w-100 h-100 object-fit-cover' />
                </div>
              ) : (
                <div className='symbol symbol-75px me-4'>
                  <div className='symbol-label bg-light-primary'>
                    <KTIcon iconName='picture' className='fs-2x text-primary' />
                  </div>
                </div>
              )}
              
              <div>
                <input
                  type='file'
                  id='logoUpload'
                  className='d-none'
                  accept='image/*'
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleLogoUpload(file)
                  }}
                />
                <label htmlFor='logoUpload' className='btn btn-light-primary btn-sm'>
                  <KTIcon iconName='cloud-upload' className='fs-6 me-2' />
                  {formData.companyLogoUrl ? 'Change Logo' : 'Upload Logo'}
                </label>
                <div className='form-text mt-1'>Square image, PNG or JPG, max 2MB</div>
              </div>
            </div>
          </div>
        )

      case 'complete':
        return (
          <div className='text-center py-6'>
            <div className='symbol symbol-100px mb-6 mx-auto'>
              <div className='symbol-label bg-light-success'>
                <KTIcon iconName='check-circle' className='fs-2x text-success' />
              </div>
            </div>
            <h2 className='mb-4'>You're All Set!</h2>
            <p className='fs-5 text-muted mb-6'>
              TradeWorks Pro is now customized for your {formData.serviceType} business.
            </p>
            <div className='alert alert-light-success d-flex align-items-center p-4'>
              <KTIcon iconName='check-circle' className='fs-2 text-success me-3' />
              <div className='text-start'>
                <div className='fw-bold fs-6'>Ready to start!</div>
                <div className='fs-7 text-muted'>Your account is configured and ready to use</div>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  const canContinue = () => {
    const step = STEPS[currentStep]
    switch (step.id) {
      case 'welcome':
        return true
      case 'business':
        return formData.businessName.trim().length > 0
      case 'service':
        return formData.serviceType.length > 0
      case 'phone':
        return true // Optional step
      case 'preferences':
        return true
      case 'complete':
        return true
      default:
        return false
    }
  }

  if (!isOpen) return null

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999
      }}
    >
      <div 
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '0px',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '90vh',
          overflowY: 'auto',
          margin: '20px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
        }}
      >
        {/* Header with current step info */}
        <div 
          style={{
            background: 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)',
            color: 'white',
            padding: '24px 32px',
            borderTopLeftRadius: '12px',
            borderTopRightRadius: '12px',
            position: 'relative'
          }}
        >
          <button
            type='button'
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
          >
            <span style={{ fontSize: '14px', fontWeight: 'bold' }}>×</span>
          </button>
          
          <div style={{ textAlign: 'center' }}>
            <div 
              style={{
                width: '60px',
                height: '60px',
                backgroundColor: 'rgba(255,255,255,0.2)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                fontSize: '24px'
              }}
            >
              {currentStep === 0 && '🚀'}
              {currentStep === 1 && '🏢'}
              {currentStep === 2 && '🔧'}
              {currentStep === 3 && '📞'}
              {currentStep === 4 && '⚙️'}
              {currentStep === 5 && '✅'}
            </div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 'bold' }}>
              {STEPS[currentStep]?.title}
            </h3>
            <div style={{ fontSize: '14px', opacity: '0.9' }}>
              Step {currentStep + 1} of {STEPS.length}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div style={{ padding: '32px' }}>
          {renderStepContent()}
        </div>

        {/* Footer with navigation */}
        <div 
          style={{
            padding: '24px 32px',
            borderTop: '1px solid #f0f0f0',
            borderBottomLeftRadius: '12px',
            borderBottomRightRadius: '12px',
            backgroundColor: '#f8f9fa'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={handleBack}
              disabled={currentStep === 0}
              style={{
                backgroundColor: currentStep === 0 ? 'transparent' : '#f8f9fa',
                color: currentStep === 0 ? '#ccc' : '#666',
                border: currentStep === 0 ? 'none' : '1px solid #ddd',
                padding: '10px 20px',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseOver={(e) => {
                if (currentStep !== 0) {
                  e.currentTarget.style.backgroundColor = '#e9ecef'
                  e.currentTarget.style.borderColor = '#adb5bd'
                }
              }}
              onMouseOut={(e) => {
                if (currentStep !== 0) {
                  e.currentTarget.style.backgroundColor = '#f8f9fa'
                  e.currentTarget.style.borderColor = '#ddd'
                }
              }}
            >
              <span>←</span> Back
            </button>

            <button
              onClick={handleNext}
              disabled={!canContinue() || loading}
              style={{
                backgroundColor: (!canContinue() || loading) ? '#ccc' : '#007bff',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: (!canContinue() || loading) ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseOver={(e) => {
                if (canContinue() && !loading) {
                  e.currentTarget.style.backgroundColor = '#0056b3'
                }
              }}
              onMouseOut={(e) => {
                if (canContinue() && !loading) {
                  e.currentTarget.style.backgroundColor = '#007bff'
                }
              }}
            >
              {loading && (
                <div 
                  style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}
                />
              )}
              {currentStep === STEPS.length - 1 ? 'Complete Setup' : 'Continue'}
              {currentStep < STEPS.length - 1 && <span>→</span>}
            </button>
          </div>
        </div>
        
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  )
}

export default OnboardingModal