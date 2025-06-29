import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { KTIcon } from '../../../_metronic/helpers'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'

interface ServiceType {
  id: string
  name: string
  code: string
  description: string
  icon: string
  default_workflow: any
}

interface OnboardingStep {
  id: string
  title: string
  description: string
  icon: string
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    description: 'Let\'s get your business set up',
    icon: 'handshake'
  },
  {
    id: 'business_info',
    title: 'Business Information',
    description: 'Tell us about your company',
    icon: 'briefcase'
  },
  {
    id: 'phone_setup',
    title: 'Business Phone',
    description: 'Get your dedicated business line',
    icon: 'phone'
  },
  {
    id: 'service_type',
    title: 'Service Type',
    description: 'What type of work do you do?',
    icon: 'category'
  },
  {
    id: 'customization',
    title: 'Customization',
    description: 'Tailor the system to your needs',
    icon: 'setting-2'
  },
  {
    id: 'company_branding',
    title: 'Company Branding',
    description: 'Make it yours with your logo',
    icon: 'color-swatch'
  },
  {
    id: 'payment_setup',
    title: 'Payment Setup',
    description: 'Get paid seamlessly',
    icon: 'dollar'
  },
  {
    id: 'team_setup',
    title: 'Team Setup',
    description: 'Add your team members',
    icon: 'people'
  },
  {
    id: 'complete',
    title: 'All Set!',
    description: 'You\'re ready to start',
    icon: 'check-circle'
  }
]

const ContractorOnboarding: React.FC = () => {
  const navigate = useNavigate()
  const { userProfile, tenant } = useSupabaseAuth()
  const [currentStep, setCurrentStep] = useState(0)
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    businessName: tenant?.company_name || '',
    businessPhone: '',
    businessEmail: '',
    businessAddress: '',
    businessWebsite: '',
    licenseNumber: '',
    insuranceNumber: '',
    // Phone provisioning
    desiredAreaCode: '',
    selectedPhoneNumber: '',
    sipConfiguration: null as any,
    // Service type
    selectedServiceType: '',
    selectedSubtypes: [] as string[],
    // Branding
    companyLogo: null as File | null,
    companyLogoUrl: '',
    brandColors: {
      primary: '#1b84ff',
      secondary: '#7239ea'
    },
    // Payment setup
    stripeConnected: false,
    stripeAccountId: '',
    // Preferences
    preferences: {
      requirePermits: false,
      trackWarranties: false,
      useSubcontractors: false,
      recurringServices: false,
      requireDeposits: false,
      photoDocumentation: true,
      clientPortal: true,
      automaticReminders: true
    },
    teamMembers: [] as any[]
  })
  
  // Phone number search state
  const [availableNumbers, setAvailableNumbers] = useState<any[]>([])
  const [searchingNumbers, setSearchingNumbers] = useState(false)
  const [provisioningPhone, setProvisioningPhone] = useState(false)

  useEffect(() => {
    loadServiceTypes()
    checkOnboardingProgress()
  }, [])

  const loadServiceTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('service_types')
        .select('*')
        .is('parent_id', null)
        .order('sort_order')

      if (error) throw error
      setServiceTypes(data || [])
    } catch (error) {
      console.error('Error loading service types:', error)
    }
  }

  const checkOnboardingProgress = async () => {
    if (!tenant?.id) return

    try {
      const { data, error } = await supabase
        .from('onboarding_progress')
        .select('*')
        .eq('tenant_id', tenant.id)
        .single()

      if (data) {
        const stepIndex = ONBOARDING_STEPS.findIndex(s => s.id === data.current_step)
        setCurrentStep(stepIndex >= 0 ? stepIndex : 0)
        
        if (data.onboarding_data) {
          setFormData(prev => ({ ...prev, ...data.onboarding_data }))
        }
      }
    } catch (error) {
      console.error('Error checking onboarding progress:', error)
    }
  }

  const searchAvailableNumbers = async () => {
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
      if (data.numbers.length === 0) {
        alert('No numbers available in this area code. Try a different one.')
      }
    } catch (error) {
      console.error('Error searching numbers:', error)
      alert('Failed to search for phone numbers. Please try again.')
    } finally {
      setSearchingNumbers(false)
    }
  }

  const provisionPhoneNumber = async () => {
    if (!formData.selectedPhoneNumber) {
      alert('Please select a phone number')
      return
    }

    setProvisioningPhone(true)
    try {
      const { data, error } = await supabase.functions.invoke('purchase-phone-number', {
        body: { 
          phoneNumber: formData.selectedPhoneNumber,
          tenantId: tenant?.id 
        }
      })

      if (error) throw error
      
      // Update form data with provisioned number
      setFormData(prev => ({
        ...prev,
        businessPhone: formData.selectedPhoneNumber,
        sipConfiguration: data.sipConfig
      }))

      // Move to next step automatically
      handleNext()
    } catch (error) {
      console.error('Error provisioning phone:', error)
      alert('Failed to provision phone number. Please try again.')
    } finally {
      setProvisioningPhone(false)
    }
  }

  const handleLogoUpload = async (file: File) => {
    setFormData(prev => ({ ...prev, companyLogo: file }))
    
    // Create preview URL
    const reader = new FileReader()
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, companyLogoUrl: reader.result as string }))
    }
    reader.readAsDataURL(file)
  }

  const connectStripe = async () => {
    try {
      // In real implementation, this would redirect to Stripe Connect OAuth
      const { data, error } = await supabase.functions.invoke('create-stripe-connect-account', {
        body: { tenantId: tenant?.id }
      })

      if (error) throw error
      
      // Redirect to Stripe OAuth
      window.location.href = data.url
    } catch (error) {
      console.error('Error connecting Stripe:', error)
      alert('Failed to connect payment processing. You can set this up later.')
    }
  }

  const saveProgress = async () => {
    if (!tenant?.id) return

    try {
      await supabase
        .from('onboarding_progress')
        .upsert({
          tenant_id: tenant.id,
          current_step: ONBOARDING_STEPS[currentStep].id,
          completed_steps: ONBOARDING_STEPS.slice(0, currentStep).map(s => s.id),
          onboarding_data: formData,
          completed_at: currentStep === ONBOARDING_STEPS.length - 1 ? new Date().toISOString() : null
        })
    } catch (error) {
      console.error('Error saving progress:', error)
    }
  }

  const handleNext = async () => {
    setLoading(true)
    await saveProgress()

    if (currentStep === ONBOARDING_STEPS.length - 1) {
      // Complete onboarding
      await completeOnboarding()
    } else {
      setCurrentStep(prev => prev + 1)
    }
    setLoading(false)
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
      // Call the centralized onboarding function
      const { data, error } = await supabase.functions.invoke('complete-full-onboarding', {
        body: {
          tenantId: tenant.id,
          onboardingData: {
            ...formData,
            companyLogo: formData.companyLogoUrl // Send base64 URL instead of File object
          }
        }
      })

      if (error) throw error

      // Show success message with their new phone number
      if (formData.selectedPhoneNumber) {
        alert(`🎉 Congratulations! Your business is all set up. Your new business line ${formData.selectedPhoneNumber} is active and ready to use!`)
      }

      // Navigate to dashboard with guided tour flag
      navigate('/dashboard?firstTime=true')
    } catch (error) {
      console.error('Error completing onboarding:', error)
      alert('There was an error completing setup. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const createDefaultTemplates = async () => {
    if (!tenant?.id || !formData.selectedServiceType) return

    const selectedType = serviceTypes.find(t => t.code === formData.selectedServiceType)
    if (!selectedType) return

    try {
      // Create quick add template
      await supabase
        .from('quick_add_templates')
        .insert({
          tenant_id: tenant.id,
          service_type_id: selectedType.id,
          name: 'Default Client & Project',
          template_type: 'both',
          is_default: true,
          form_fields: getDefaultFormFields(selectedType.code)
        })

      // Create project template
      await supabase
        .from('project_templates')
        .insert({
          tenant_id: tenant.id,
          service_type_id: selectedType.id,
          name: `Standard ${selectedType.name} Project`,
          default_tasks: getDefaultTasks(selectedType.code),
          default_milestones: getDefaultMilestones(selectedType.code),
          default_duration_days: 7,
          required_fields: getRequiredFields(selectedType.code)
        })
    } catch (error) {
      console.error('Error creating default templates:', error)
    }
  }

  const getDefaultFormFields = (serviceType: string) => {
    const commonFields = [
      { name: 'name', label: 'Client Name', type: 'text', required: true },
      { name: 'phone', label: 'Phone', type: 'tel', required: true },
      { name: 'email', label: 'Email', type: 'email', required: false },
      { name: 'property_address', label: 'Property Address', type: 'address', required: true }
    ]

    const serviceSpecificFields: Record<string, any[]> = {
      hvac: [
        { name: 'system_type', label: 'System Type', type: 'select', options: ['Heating', 'Cooling', 'Both'], required: true },
        { name: 'system_age', label: 'System Age', type: 'number', required: false },
        { name: 'issue_description', label: 'Issue Description', type: 'textarea', required: true }
      ],
      plumbing: [
        { name: 'issue_type', label: 'Issue Type', type: 'select', options: ['Leak', 'Clog', 'Installation', 'Repair'], required: true },
        { name: 'urgency', label: 'Urgency', type: 'select', options: ['Emergency', 'Urgent', 'Routine'], required: true }
      ],
      roofing: [
        { name: 'roof_type', label: 'Roof Type', type: 'select', options: ['Shingle', 'Tile', 'Metal', 'Flat'], required: true },
        { name: 'square_footage', label: 'Approx. Square Footage', type: 'number', required: false },
        { name: 'roof_age', label: 'Roof Age (years)', type: 'number', required: false }
      ]
    }

    return {
      client: commonFields,
      project: serviceSpecificFields[serviceType] || []
    }
  }

  const getDefaultTasks = (serviceType: string) => {
    const taskTemplates: Record<string, any[]> = {
      hvac: [
        { name: 'Initial Inspection', duration: 1 },
        { name: 'Diagnose Issue', duration: 1 },
        { name: 'Order Parts', duration: 2 },
        { name: 'Complete Repair/Installation', duration: 1 },
        { name: 'System Testing', duration: 1 },
        { name: 'Customer Walkthrough', duration: 1 }
      ],
      plumbing: [
        { name: 'Site Assessment', duration: 1 },
        { name: 'Prepare Work Area', duration: 1 },
        { name: 'Complete Plumbing Work', duration: 2 },
        { name: 'Test & Inspect', duration: 1 },
        { name: 'Clean Up', duration: 1 }
      ],
      roofing: [
        { name: 'Roof Inspection', duration: 1 },
        { name: 'Measurements & Material Calculation', duration: 1 },
        { name: 'Material Delivery', duration: 1 },
        { name: 'Remove Old Roofing', duration: 2 },
        { name: 'Install New Roofing', duration: 3 },
        { name: 'Final Inspection & Cleanup', duration: 1 }
      ]
    }

    return taskTemplates[serviceType] || []
  }

  const getDefaultMilestones = (serviceType: string) => {
    return [
      { name: 'Project Started', percentage: 0 },
      { name: 'Materials Ordered', percentage: 25 },
      { name: 'Work In Progress', percentage: 50 },
      { name: 'Work Complete', percentage: 90 },
      { name: 'Final Approval', percentage: 100 }
    ]
  }

  const getRequiredFields = (serviceType: string) => {
    const fields: Record<string, string[]> = {
      hvac: ['system_type', 'issue_description'],
      plumbing: ['issue_type', 'urgency'],
      electrical: ['permit_required', 'circuit_details'],
      roofing: ['roof_type', 'square_footage']
    }

    return fields[serviceType] || []
  }

  const renderStepContent = () => {
    const step = ONBOARDING_STEPS[currentStep]

    switch (step.id) {
      case 'welcome':
        return (
          <div className='text-center py-10'>
            <h1 className='mb-5'>Welcome to TradeWorks Pro!</h1>
            <p className='fs-4 text-muted mb-10'>
              Let's set up your account to match your business needs. This will only take a few minutes.
            </p>
            <div className='symbol symbol-150px mb-10'>
              <div className='symbol-label bg-light-primary'>
                <KTIcon iconName='rocket' className='fs-2tx text-primary' />
              </div>
            </div>
            <p className='fs-5'>
              We'll customize TradeWorks Pro specifically for your {formData.businessName || 'business'}.
            </p>
          </div>
        )

      case 'business_info':
        return (
          <div>
            <h3 className='mb-5'>Business Information</h3>
            <div className='row'>
              <div className='col-md-6 mb-5'>
                <label className='form-label required'>Business Name</label>
                <input
                  type='text'
                  className='form-control form-control-solid'
                  value={formData.businessName}
                  onChange={(e) => setFormData(prev => ({ ...prev, businessName: e.target.value }))}
                />
              </div>
              <div className='col-md-6 mb-5'>
                <label className='form-label'>Current Phone (optional)</label>
                <input
                  type='tel'
                  className='form-control form-control-solid'
                  placeholder="We'll set up a new business line for you"
                  value={formData.businessPhone}
                  onChange={(e) => setFormData(prev => ({ ...prev, businessPhone: e.target.value }))}
                />
                <div className='form-text'>You'll get a dedicated business line in the next step</div>
              </div>
              <div className='col-md-6 mb-5'>
                <label className='form-label'>Business Email</label>
                <input
                  type='email'
                  className='form-control form-control-solid'
                  value={formData.businessEmail}
                  onChange={(e) => setFormData(prev => ({ ...prev, businessEmail: e.target.value }))}
                />
              </div>
              <div className='col-md-6 mb-5'>
                <label className='form-label'>Website</label>
                <input
                  type='url'
                  className='form-control form-control-solid'
                  value={formData.businessWebsite}
                  onChange={(e) => setFormData(prev => ({ ...prev, businessWebsite: e.target.value }))}
                />
              </div>
              <div className='col-md-12 mb-5'>
                <label className='form-label'>Business Address</label>
                <input
                  type='text'
                  className='form-control form-control-solid'
                  value={formData.businessAddress}
                  onChange={(e) => setFormData(prev => ({ ...prev, businessAddress: e.target.value }))}
                />
              </div>
              <div className='col-md-6 mb-5'>
                <label className='form-label'>License Number</label>
                <input
                  type='text'
                  className='form-control form-control-solid'
                  value={formData.licenseNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, licenseNumber: e.target.value }))}
                />
              </div>
              <div className='col-md-6 mb-5'>
                <label className='form-label'>Insurance Number</label>
                <input
                  type='text'
                  className='form-control form-control-solid'
                  value={formData.insuranceNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, insuranceNumber: e.target.value }))}
                />
              </div>
            </div>
          </div>
        )

      case 'phone_setup':
        return (
          <div>
            <h3 className='mb-5'>Get Your Dedicated Business Phone</h3>
            <p className='text-muted mb-8'>
              Your professional phone line with VoIP calling, SMS, and call management - all integrated into TradeWorks Pro.
            </p>

            {!formData.selectedPhoneNumber ? (
              <div>
                {/* Area Code Selection */}
                <div className='row mb-6'>
                  <div className='col-md-4'>
                    <label className='form-label required'>Preferred Area Code</label>
                    <input
                      type='text'
                      className='form-control form-control-solid form-control-lg'
                      placeholder='Enter 3 digits (e.g., 708)'
                      value={formData.desiredAreaCode}
                      maxLength={3}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '')
                        setFormData(prev => ({ ...prev, desiredAreaCode: value }))
                      }}
                    />
                    <div className='form-text'>We'll find available numbers in your area</div>
                  </div>
                  <div className='col-md-4 d-flex align-items-end'>
                    <button
                      type='button'
                      className='btn btn-primary btn-lg'
                      onClick={searchAvailableNumbers}
                      disabled={!formData.desiredAreaCode || formData.desiredAreaCode.length !== 3 || searchingNumbers}
                    >
                      {searchingNumbers ? (
                        <>
                          <span className='spinner-border spinner-border-sm me-2' />
                          Searching...
                        </>
                      ) : (
                        <>
                          <KTIcon iconName='magnifier' className='fs-6 me-2' />
                          Search Numbers
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Available Numbers */}
                {availableNumbers.length > 0 && (
                  <div className='mb-8'>
                    <h4 className='mb-4'>Available Numbers</h4>
                    <div className='row'>
                      {availableNumbers.slice(0, 6).map((number, index) => (
                        <div key={index} className='col-md-4 mb-4'>
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
                              <div className='card-body text-center py-4'>
                                <div className='fs-4 fw-bold text-primary mb-2'>
                                  {number.friendly_name || number.phone_number}
                                </div>
                                <div className='text-muted fs-7'>
                                  {number.locality}, {number.region}
                                </div>
                                {formData.selectedPhoneNumber === number.phone_number && (
                                  <div className='mt-2'>
                                    <KTIcon iconName='check-circle' className='fs-4 text-success' />
                                  </div>
                                )}
                              </div>
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>

                    {formData.selectedPhoneNumber && (
                      <div className='text-center mt-6'>
                        <button
                          type='button'
                          className='btn btn-success btn-lg'
                          onClick={provisionPhoneNumber}
                          disabled={provisioningPhone}
                        >
                          {provisioningPhone ? (
                            <>
                              <span className='spinner-border spinner-border-sm me-2' />
                              Setting up your phone line...
                            </>
                          ) : (
                            <>
                              <KTIcon iconName='phone' className='fs-6 me-2' />
                              Get This Number - {formData.selectedPhoneNumber}
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {availableNumbers.length === 0 && formData.desiredAreaCode && (
                  <div className='alert alert-info d-flex align-items-center'>
                    <KTIcon iconName='information-5' className='fs-2 text-info me-4' />
                    <div>
                      <h4 className='alert-heading mb-1'>Start by searching for numbers</h4>
                      <p className='mb-0'>Enter your preferred area code above and click "Search Numbers" to see available business phone numbers.</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Phone Successfully Provisioned */
              <div className='text-center py-10'>
                <div className='symbol symbol-150px mb-8'>
                  <div className='symbol-label bg-light-success'>
                    <KTIcon iconName='phone' className='fs-2tx text-success' />
                  </div>
                </div>
                <h2 className='text-success mb-4'>🎉 Your Business Line is Ready!</h2>
                <div className='fs-1 fw-bold text-primary mb-4'>{formData.selectedPhoneNumber}</div>
                <p className='fs-4 text-muted mb-8'>
                  Your new business phone number is active and ready to use. You can make and receive calls, send SMS, and manage everything from TradeWorks Pro.
                </p>
                
                <div className='row text-center'>
                  <div className='col-md-4'>
                    <div className='card border-0 bg-light-primary'>
                      <div className='card-body'>
                        <KTIcon iconName='phone' className='fs-2x text-primary mb-3' />
                        <h5>VoIP Calling</h5>
                        <p className='text-muted fs-7 mb-0'>Make calls directly from your browser</p>
                      </div>
                    </div>
                  </div>
                  <div className='col-md-4'>
                    <div className='card border-0 bg-light-primary'>
                      <div className='card-body'>
                        <KTIcon iconName='sms' className='fs-2x text-primary mb-3' />
                        <h5>SMS Integration</h5>
                        <p className='text-muted fs-7 mb-0'>Text customers and track conversations</p>
                      </div>
                    </div>
                  </div>
                  <div className='col-md-4'>
                    <div className='card border-0 bg-light-primary'>
                      <div className='card-body'>
                        <KTIcon iconName='chart-line' className='fs-2x text-primary mb-3' />
                        <h5>Call Analytics</h5>
                        <p className='text-muted fs-7 mb-0'>Track calls and performance metrics</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className='alert alert-success d-flex align-items-center mt-8'>
                  <KTIcon iconName='check-circle' className='fs-2 text-success me-4' />
                  <div className='text-start'>
                    <h4 className='alert-heading mb-1'>Professional Image Complete</h4>
                    <p className='mb-0'>Customers will see your dedicated business number on all communications. No more personal phone mixing with business!</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )

      case 'service_type':
        return (
          <div>
            <h3 className='mb-5'>What type of services do you provide?</h3>
            <p className='text-muted mb-8'>
              Select your primary service type. This helps us customize TradeWorks Pro for your specific needs.
            </p>
            <div className='row'>
              {serviceTypes.map((type) => (
                <div key={type.id} className='col-md-4 mb-5'>
                  <label className='d-flex flex-column cursor-pointer'>
                    <input
                      type='radio'
                      className='d-none'
                      name='serviceType'
                      value={type.code}
                      checked={formData.selectedServiceType === type.code}
                      onChange={(e) => setFormData(prev => ({ ...prev, selectedServiceType: e.target.value }))}
                    />
                    <div className={`card ${formData.selectedServiceType === type.code ? 'border-primary' : ''}`}>
                      <div className='card-body text-center'>
                        <div className='symbol symbol-50px mb-5'>
                          <div className={`symbol-label ${formData.selectedServiceType === type.code ? 'bg-primary' : 'bg-light-primary'}`}>
                            <KTIcon 
                              iconName={type.icon} 
                              className={`fs-2x ${formData.selectedServiceType === type.code ? 'text-white' : 'text-primary'}`} 
                            />
                          </div>
                        </div>
                        <h4 className='mb-2'>{type.name}</h4>
                        <p className='text-muted fs-7'>{type.description}</p>
                      </div>
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )

      case 'customization':
        return (
          <div>
            <h3 className='mb-5'>Customize Your Workflow</h3>
            <p className='text-muted mb-8'>
              Tell us how you work so we can set up TradeWorks Pro to match your business processes.
            </p>
            <div className='row'>
              <div className='col-md-6'>
                <h4 className='mb-5'>Project Management</h4>
                <div className='form-check form-switch mb-5'>
                  <input
                    className='form-check-input'
                    type='checkbox'
                    id='requirePermits'
                    checked={formData.preferences.requirePermits}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      preferences: { ...prev.preferences, requirePermits: e.target.checked }
                    }))}
                  />
                  <label className='form-check-label' htmlFor='requirePermits'>
                    Track permits and inspections
                  </label>
                </div>
                <div className='form-check form-switch mb-5'>
                  <input
                    className='form-check-input'
                    type='checkbox'
                    id='trackWarranties'
                    checked={formData.preferences.trackWarranties}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      preferences: { ...prev.preferences, trackWarranties: e.target.checked }
                    }))}
                  />
                  <label className='form-check-label' htmlFor='trackWarranties'>
                    Track warranties and guarantees
                  </label>
                </div>
                <div className='form-check form-switch mb-5'>
                  <input
                    className='form-check-input'
                    type='checkbox'
                    id='useSubcontractors'
                    checked={formData.preferences.useSubcontractors}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      preferences: { ...prev.preferences, useSubcontractors: e.target.checked }
                    }))}
                  />
                  <label className='form-check-label' htmlFor='useSubcontractors'>
                    Work with subcontractors
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
                    Require photo documentation
                  </label>
                </div>
              </div>
              <div className='col-md-6'>
                <h4 className='mb-5'>Client Management</h4>
                <div className='form-check form-switch mb-5'>
                  <input
                    className='form-check-input'
                    type='checkbox'
                    id='recurringServices'
                    checked={formData.preferences.recurringServices}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      preferences: { ...prev.preferences, recurringServices: e.target.checked }
                    }))}
                  />
                  <label className='form-check-label' htmlFor='recurringServices'>
                    Offer recurring services
                  </label>
                </div>
                <div className='form-check form-switch mb-5'>
                  <input
                    className='form-check-input'
                    type='checkbox'
                    id='requireDeposits'
                    checked={formData.preferences.requireDeposits}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      preferences: { ...prev.preferences, requireDeposits: e.target.checked }
                    }))}
                  />
                  <label className='form-check-label' htmlFor='requireDeposits'>
                    Require deposits
                  </label>
                </div>
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
                    Enable client portal
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
                    Send automatic reminders
                  </label>
                </div>
              </div>
            </div>
          </div>
        )

      case 'company_branding':
        return (
          <div>
            <h3 className='mb-5'>Brand Your Business</h3>
            <p className='text-muted mb-8'>
              Add your company logo and customize colors to make TradeWorks Pro reflect your brand.
            </p>

            <div className='row'>
              <div className='col-md-6'>
                <h4 className='mb-5'>Company Logo</h4>
                <div className='d-flex flex-column align-items-center'>
                  {formData.companyLogoUrl ? (
                    <div className='symbol symbol-150px mb-5'>
                      <img src={formData.companyLogoUrl} alt='Company Logo' className='w-100 h-100 object-fit-cover' />
                    </div>
                  ) : (
                    <div className='symbol symbol-150px mb-5'>
                      <div className='symbol-label bg-light-primary'>
                        <KTIcon iconName='picture' className='fs-2tx text-primary' />
                      </div>
                    </div>
                  )}
                  
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
                  <label htmlFor='logoUpload' className='btn btn-primary btn-sm'>
                    <KTIcon iconName='cloud-upload' className='fs-6 me-2' />
                    {formData.companyLogoUrl ? 'Change Logo' : 'Upload Logo'}
                  </label>
                  <div className='form-text mt-2 text-center'>
                    Recommended: Square image, PNG or JPG, max 2MB
                  </div>
                </div>
              </div>

              <div className='col-md-6'>
                <h4 className='mb-5'>Brand Colors</h4>
                <div className='mb-5'>
                  <label className='form-label'>Primary Color</label>
                  <div className='d-flex align-items-center gap-3'>
                    <input
                      type='color'
                      className='form-control form-control-solid w-75px h-40px p-1'
                      value={formData.brandColors.primary}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        brandColors: { ...prev.brandColors, primary: e.target.value }
                      }))}
                    />
                    <input
                      type='text'
                      className='form-control form-control-solid'
                      value={formData.brandColors.primary}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        brandColors: { ...prev.brandColors, primary: e.target.value }
                      }))}
                    />
                  </div>
                  <div className='form-text'>Main brand color for buttons and highlights</div>
                </div>

                <div className='mb-5'>
                  <label className='form-label'>Secondary Color</label>
                  <div className='d-flex align-items-center gap-3'>
                    <input
                      type='color'
                      className='form-control form-control-solid w-75px h-40px p-1'
                      value={formData.brandColors.secondary}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        brandColors: { ...prev.brandColors, secondary: e.target.value }
                      }))}
                    />
                    <input
                      type='text'
                      className='form-control form-control-solid'
                      value={formData.brandColors.secondary}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        brandColors: { ...prev.brandColors, secondary: e.target.value }
                      }))}
                    />
                  </div>
                  <div className='form-text'>Accent color for secondary elements</div>
                </div>

                <div className='alert alert-info d-flex align-items-center'>
                  <KTIcon iconName='information-5' className='fs-2 text-info me-4' />
                  <div>
                    <h5 className='alert-heading mb-1'>Professional Appearance</h5>
                    <p className='mb-0'>Your logo and colors will appear on invoices, estimates, and the customer portal.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Brand Preview */}
            <div className='mt-8'>
              <h4 className='mb-5'>Preview</h4>
              <div className='card border-2' style={{ borderColor: formData.brandColors.primary }}>
                <div className='card-header' style={{ backgroundColor: formData.brandColors.primary, color: 'white' }}>
                  <div className='d-flex align-items-center'>
                    {formData.companyLogoUrl && (
                      <img src={formData.companyLogoUrl} alt='Logo' className='me-3' style={{ width: '32px', height: '32px', objectFit: 'cover' }} />
                    )}
                    <h5 className='mb-0'>{formData.businessName || 'Your Business Name'}</h5>
                  </div>
                </div>
                <div className='card-body'>
                  <p className='text-muted mb-3'>Sample invoice or estimate header</p>
                  <button 
                    className='btn btn-sm me-3' 
                    style={{ backgroundColor: formData.brandColors.primary, borderColor: formData.brandColors.primary, color: 'white' }}
                  >
                    Primary Button
                  </button>
                  <button 
                    className='btn btn-sm' 
                    style={{ backgroundColor: formData.brandColors.secondary, borderColor: formData.brandColors.secondary, color: 'white' }}
                  >
                    Secondary Button
                  </button>
                </div>
              </div>
            </div>
          </div>
        )

      case 'payment_setup':
        return (
          <div>
            <h3 className='mb-5'>Payment Processing</h3>
            <p className='text-muted mb-8'>
              Set up secure payment processing to get paid faster. Accept credit cards, ACH, and online payments.
            </p>

            {!formData.stripeConnected ? (
              <div>
                <div className='row mb-8'>
                  <div className='col-md-4'>
                    <div className='card h-100 border-primary'>
                      <div className='card-body text-center'>
                        <div className='symbol symbol-60px mb-4 mx-auto'>
                          <div className='symbol-label bg-light-primary'>
                            <KTIcon iconName='credit-cart' className='fs-2x text-primary' />
                          </div>
                        </div>
                        <h5>Credit Cards</h5>
                        <p className='text-muted fs-7'>Accept Visa, Mastercard, American Express, and Discover</p>
                        <div className='badge badge-light-primary'>2.9% + 30¢</div>
                      </div>
                    </div>
                  </div>
                  <div className='col-md-4'>
                    <div className='card h-100 border-success'>
                      <div className='card-body text-center'>
                        <div className='symbol symbol-60px mb-4 mx-auto'>
                          <div className='symbol-label bg-light-success'>
                            <KTIcon iconName='bank' className='fs-2x text-success' />
                          </div>
                        </div>
                        <h5>ACH/Bank Transfer</h5>
                        <p className='text-muted fs-7'>Direct bank transfers for larger amounts</p>
                        <div className='badge badge-light-success'>0.8% (max $5)</div>
                      </div>
                    </div>
                  </div>
                  <div className='col-md-4'>
                    <div className='card h-100 border-info'>
                      <div className='card-body text-center'>
                        <div className='symbol symbol-60px mb-4 mx-auto'>
                          <div className='symbol-label bg-light-info'>
                            <KTIcon iconName='wallet' className='fs-2x text-info' />
                          </div>
                        </div>
                        <h5>Digital Wallets</h5>
                        <p className='text-muted fs-7'>Apple Pay, Google Pay, and more</p>
                        <div className='badge badge-light-info'>2.9% + 30¢</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className='text-center mb-8'>
                  <button
                    type='button'
                    className='btn btn-primary btn-lg'
                    onClick={connectStripe}
                  >
                    <KTIcon iconName='connect' className='fs-6 me-2' />
                    Connect Stripe Account
                  </button>
                  <div className='form-text mt-3'>
                    Secure setup powered by Stripe. Takes 2-3 minutes to complete.
                  </div>
                </div>

                <div className='alert alert-warning d-flex align-items-center'>
                  <KTIcon iconName='information-5' className='fs-2 text-warning me-4' />
                  <div>
                    <h5 className='alert-heading mb-1'>Optional Setup</h5>
                    <p className='mb-0'>You can skip this step and set up payments later. However, connecting now means you'll be ready to accept payments immediately.</p>
                  </div>
                </div>

                <div className='text-center'>
                  <button
                    type='button'
                    className='btn btn-light-secondary'
                    onClick={() => {
                      setFormData(prev => ({ ...prev, stripeConnected: false }))
                      handleNext()
                    }}
                  >
                    Skip for Now
                  </button>
                </div>
              </div>
            ) : (
              /* Stripe Connected */
              <div className='text-center py-10'>
                <div className='symbol symbol-150px mb-8 mx-auto'>
                  <div className='symbol-label bg-light-success'>
                    <KTIcon iconName='check-circle' className='fs-2tx text-success' />
                  </div>
                </div>
                <h2 className='text-success mb-4'>🎉 Payment Processing Connected!</h2>
                <p className='fs-4 text-muted mb-8'>
                  Your Stripe account is connected and ready to process payments. You can now accept credit cards, ACH, and digital wallet payments.
                </p>
                
                <div className='row text-center mb-8'>
                  <div className='col-md-3'>
                    <div className='card border-0 bg-light-success'>
                      <div className='card-body'>
                        <KTIcon iconName='check-circle' className='fs-2x text-success mb-3' />
                        <h6>Credit Cards</h6>
                        <p className='text-muted fs-8 mb-0'>Ready</p>
                      </div>
                    </div>
                  </div>
                  <div className='col-md-3'>
                    <div className='card border-0 bg-light-success'>
                      <div className='card-body'>
                        <KTIcon iconName='check-circle' className='fs-2x text-success mb-3' />
                        <h6>ACH Transfers</h6>
                        <p className='text-muted fs-8 mb-0'>Ready</p>
                      </div>
                    </div>
                  </div>
                  <div className='col-md-3'>
                    <div className='card border-0 bg-light-success'>
                      <div className='card-body'>
                        <KTIcon iconName='check-circle' className='fs-2x text-success mb-3' />
                        <h6>Digital Wallets</h6>
                        <p className='text-muted fs-8 mb-0'>Ready</p>
                      </div>
                    </div>
                  </div>
                  <div className='col-md-3'>
                    <div className='card border-0 bg-light-success'>
                      <div className='card-body'>
                        <KTIcon iconName='check-circle' className='fs-2x text-success mb-3' />
                        <h6>Invoicing</h6>
                        <p className='text-muted fs-8 mb-0'>Ready</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className='alert alert-success d-flex align-items-center'>
                  <KTIcon iconName='check-circle' className='fs-2 text-success me-4' />
                  <div className='text-start'>
                    <h4 className='alert-heading mb-1'>Get Paid Faster</h4>
                    <p className='mb-0'>Customers can now pay invoices online, reducing your collection time from weeks to days!</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )

      case 'team_setup':
        return (
          <div>
            <h3 className='mb-5'>Add Your Team</h3>
            <p className='text-muted mb-8'>
              Add team members who will be using TradeWorks Pro. You can always add more later.
            </p>
            
            {formData.teamMembers.map((member, index) => (
              <div key={index} className='card mb-5'>
                <div className='card-body'>
                  <div className='d-flex justify-content-between align-items-center mb-3'>
                    <h5 className='mb-0'>Team Member {index + 1}</h5>
                    {formData.teamMembers.length > 1 && (
                      <button
                        type='button'
                        className='btn btn-sm btn-light-danger'
                        onClick={() => {
                          const newMembers = formData.teamMembers.filter((_, i) => i !== index)
                          setFormData(prev => ({ ...prev, teamMembers: newMembers }))
                        }}
                      >
                        <KTIcon iconName='trash' className='fs-7' />
                      </button>
                    )}
                  </div>
                  
                  <div className='row'>
                    <div className='col-md-6 mb-4'>
                      <label className='form-label required'>Full Name</label>
                      <input
                        type='text'
                        className='form-control form-control-solid'
                        placeholder='Enter full name'
                        value={member.name}
                        onChange={(e) => {
                          const newMembers = [...formData.teamMembers]
                          newMembers[index].name = e.target.value
                          setFormData(prev => ({ ...prev, teamMembers: newMembers }))
                        }}
                      />
                    </div>
                    
                    <div className='col-md-6 mb-4'>
                      <label className='form-label required'>Email</label>
                      <input
                        type='email'
                        className='form-control form-control-solid'
                        placeholder='Enter email address'
                        value={member.email}
                        onChange={(e) => {
                          const newMembers = [...formData.teamMembers]
                          newMembers[index].email = e.target.value
                          setFormData(prev => ({ ...prev, teamMembers: newMembers }))
                        }}
                      />
                    </div>
                    
                    <div className='col-md-6 mb-4'>
                      <label className='form-label'>Phone</label>
                      <input
                        type='tel'
                        className='form-control form-control-solid'
                        placeholder='(555) 123-4567'
                        value={member.phone}
                        onChange={(e) => {
                          const newMembers = [...formData.teamMembers]
                          newMembers[index].phone = e.target.value
                          setFormData(prev => ({ ...prev, teamMembers: newMembers }))
                        }}
                      />
                    </div>
                    
                    <div className='col-md-6 mb-4'>
                      <label className='form-label required'>Role</label>
                      <select
                        className='form-select form-select-solid'
                        value={member.role}
                        onChange={(e) => {
                          const newMembers = [...formData.teamMembers]
                          newMembers[index].role = e.target.value
                          setFormData(prev => ({ ...prev, teamMembers: newMembers }))
                        }}
                      >
                        <option value=''>Select role</option>
                        <option value='Project Manager'>Project Manager</option>
                        <option value='Lead Technician'>Lead Technician</option>
                        <option value='Field Technician'>Field Technician</option>
                        <option value='Estimator'>Estimator</option>
                        <option value='Office Administrator'>Office Administrator</option>
                        <option value='Sales Representative'>Sales Representative</option>
                        <option value='Foreman'>Foreman</option>
                        <option value='Helper'>Helper</option>
                      </select>
                    </div>
                    
                    <div className='col-md-6 mb-4'>
                      <label className='form-label'>Department</label>
                      <select
                        className='form-select form-select-solid'
                        value={member.department}
                        onChange={(e) => {
                          const newMembers = [...formData.teamMembers]
                          newMembers[index].department = e.target.value
                          setFormData(prev => ({ ...prev, teamMembers: newMembers }))
                        }}
                      >
                        <option value=''>Select department</option>
                        <option value='Operations'>Operations</option>
                        <option value='Construction'>Construction</option>
                        <option value='Sales'>Sales</option>
                        <option value='Administration'>Administration</option>
                        <option value='Service'>Service</option>
                        <option value='Maintenance'>Maintenance</option>
                      </select>
                    </div>
                    
                    <div className='col-md-6 mb-4'>
                      <label className='form-label'>Access Level</label>
                      <select
                        className='form-select form-select-solid'
                        value={member.accessLevel || 'agent'}
                        onChange={(e) => {
                          const newMembers = [...formData.teamMembers]
                          newMembers[index].accessLevel = e.target.value
                          setFormData(prev => ({ ...prev, teamMembers: newMembers }))
                        }}
                      >
                        <option value='agent'>Agent - Full access to jobs and customers</option>
                        <option value='viewer'>Viewer - Read-only access</option>
                        <option value='admin'>Admin - Full system access</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            <div className='d-flex justify-content-between mb-8'>
              <button
                type='button'
                className='btn btn-light-primary'
                onClick={() => {
                  const newMember = {
                    name: '',
                    email: '',
                    phone: '',
                    role: '',
                    department: '',
                    accessLevel: 'agent'
                  }
                  setFormData(prev => ({ ...prev, teamMembers: [...prev.teamMembers, newMember] }))
                }}
              >
                <KTIcon iconName='plus' className='fs-6 me-2' />
                Add Another Team Member
              </button>
              
              <div className='text-muted'>
                <small>💡 Team members will receive invitation emails after setup</small>
              </div>
            </div>
            
            {formData.teamMembers.length === 0 && (
              <div className='text-center py-10'>
                <KTIcon iconName='people' className='fs-4x text-muted mb-5' />
                <p className='fs-5 text-muted mb-5'>
                  No team members added yet
                </p>
                <button
                  type='button'
                  className='btn btn-primary'
                  onClick={() => {
                    const newMember = {
                      name: '',
                      email: '',
                      phone: '',
                      role: '',
                      department: '',
                      accessLevel: 'agent'
                    }
                    setFormData(prev => ({ ...prev, teamMembers: [newMember] }))
                  }}
                >
                  <KTIcon iconName='plus' className='fs-6 me-2' />
                  Add First Team Member
                </button>
              </div>
            )}
          </div>
        )

      case 'complete':
        return (
          <div className='text-center py-10'>
            <div className='symbol symbol-150px mb-10'>
              <div className='symbol-label bg-light-success'>
                <KTIcon iconName='check-circle' className='fs-2tx text-success' />
              </div>
            </div>
            <h1 className='mb-5'>You're All Set!</h1>
            <p className='fs-4 text-muted mb-10'>
              TradeWorks Pro has been customized for your {formData.selectedServiceType} business.
            </p>
            <div className='d-flex flex-column align-items-center'>
              <p className='fs-5 mb-2'>Here's what we've set up for you:</p>
              <ul className='text-start fs-6 text-muted'>
                <li>Custom forms for {formData.selectedServiceType} projects</li>
                <li>Industry-specific project templates</li>
                <li>Workflow automation based on your preferences</li>
                <li>Quick client & project creation tools</li>
              </ul>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className='card'>
      <div className='card-body'>
        {/* Progress Steps */}
        <div className='stepper stepper-pills stepper-column d-flex flex-column flex-xl-row flex-row-fluid'>
          <div className='d-flex flex-row-auto w-100 w-xl-300px'>
            <div className='stepper-nav flex-column'>
              {ONBOARDING_STEPS.map((step, index) => (
                <div
                  key={step.id}
                  className={`stepper-item ${index === currentStep ? 'current' : ''} ${index < currentStep ? 'completed' : ''}`}
                >
                  <div className='stepper-wrapper d-flex align-items-center'>
                    <div className='stepper-icon w-40px h-40px'>
                      <i className='stepper-check fas fa-check'></i>
                      <span className='stepper-number'>{index + 1}</span>
                    </div>
                    <div className='stepper-label'>
                      <h3 className='stepper-title'>{step.title}</h3>
                      <div className='stepper-desc'>{step.description}</div>
                    </div>
                  </div>
                  {index < ONBOARDING_STEPS.length - 1 && (
                    <div className='stepper-line h-40px'></div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className='flex-row-fluid px-lg-15'>
            <div className='w-100'>
              {renderStepContent()}

              <div className='d-flex flex-stack pt-10'>
                <button
                  className='btn btn-light btn-active-light-primary me-2'
                  onClick={handleBack}
                  disabled={currentStep === 0}
                >
                  <KTIcon iconName='arrow-left' className='fs-4 me-1' />
                  Back
                </button>

                <button
                  className='btn btn-primary'
                  onClick={handleNext}
                  disabled={loading}
                >
                  {loading && <span className='spinner-border spinner-border-sm align-middle me-2'></span>}
                  {currentStep === ONBOARDING_STEPS.length - 1 ? 'Complete Setup' : 'Continue'}
                  {currentStep < ONBOARDING_STEPS.length - 1 && (
                    <KTIcon iconName='arrow-right' className='fs-4 ms-1' />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ContractorOnboarding
