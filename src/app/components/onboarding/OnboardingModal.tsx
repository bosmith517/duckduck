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
  const { tenant } = useSupabaseAuth()
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
          <div className='text-center py-6'>
            <div className='symbol symbol-100px mb-6 mx-auto'>
              <div className='symbol-label bg-light-primary'>
                <KTIcon iconName='rocket' className='fs-2x text-primary' />
              </div>
            </div>
            <h2 className='mb-4'>Welcome to TradeWorks Pro!</h2>
            <p className='fs-5 text-muted mb-0'>
              Let's set up your account in just a few quick steps. This will only take 3-4 minutes.
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
    <div className='modal fade show d-block' style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className='modal-dialog modal-lg modal-dialog-centered'>
        <div className='modal-content'>
          <div className='modal-header border-0 pb-0'>
            <div className='d-flex align-items-center w-100'>
              {/* Progress Steps */}
              <div className='d-flex flex-grow-1'>
                {STEPS.map((step, index) => (
                  <div key={step.id} className='d-flex align-items-center'>
                    <div className={`symbol symbol-30px ${index <= currentStep ? 'symbol-circle' : ''}`}>
                      <div className={`symbol-label fs-8 fw-bold ${
                        index < currentStep 
                          ? 'bg-success text-white' 
                          : index === currentStep 
                            ? 'bg-primary text-white'
                            : 'bg-light-muted text-muted'
                      }`}>
                        {index < currentStep ? (
                          <KTIcon iconName='check' className='fs-7' />
                        ) : (
                          index + 1
                        )}
                      </div>
                    </div>
                    {index < STEPS.length - 1 && (
                      <div className={`w-30px h-2px mx-2 ${index < currentStep ? 'bg-success' : 'bg-light-muted'}`}></div>
                    )}
                  </div>
                ))}
              </div>
              <button
                type='button'
                className='btn btn-sm btn-icon btn-light-muted'
                onClick={onClose}
              >
                <KTIcon iconName='cross' className='fs-6' />
              </button>
            </div>
          </div>

          <div className='modal-body px-8 py-6'>
            {renderStepContent()}
          </div>

          <div className='modal-footer border-0 pt-0 px-8 pb-8'>
            <div className='d-flex justify-content-between w-100'>
              <button
                className='btn btn-light'
                onClick={handleBack}
                disabled={currentStep === 0}
              >
                <KTIcon iconName='arrow-left' className='fs-6 me-2' />
                Back
              </button>

              <button
                className='btn btn-primary'
                onClick={handleNext}
                disabled={!canContinue() || loading}
              >
                {loading && <span className='spinner-border spinner-border-sm me-2'></span>}
                {currentStep === STEPS.length - 1 ? 'Complete Setup' : 'Continue'}
                {currentStep < STEPS.length - 1 && (
                  <KTIcon iconName='arrow-right' className='fs-6 ms-2' />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OnboardingModal