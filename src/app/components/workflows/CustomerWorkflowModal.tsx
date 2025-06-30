import React, { useState } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import clsx from 'clsx'
import { Contact, Account, Job } from '../../../supabaseClient'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'

interface CustomerWorkflowModalProps {
  contact: Contact
  onClose: () => void
  onWorkflowComplete: (job: Job) => void
}

interface WorkflowStep {
  id: number
  title: string
  description: string
  completed: boolean
}

const serviceTypes = [
  'Roof Repair',
  'Roof Replacement', 
  'Roof Inspection',
  'Gutter Repair',
  'Gutter Installation',
  'Emergency Repair',
  'Insurance Claim',
  'Maintenance',
  'Other'
]

const urgencyLevels = [
  { value: 'low', label: 'Standard (7-14 days)', multiplier: 1.0 },
  { value: 'medium', label: 'Priority (3-5 days)', multiplier: 1.1 },
  { value: 'high', label: 'Urgent (1-2 days)', multiplier: 1.25 },
  { value: 'emergency', label: 'Emergency (Same day)', multiplier: 1.5 }
]

const workflowSchema = Yup.object().shape({
  // Account Info
  account_name: Yup.string().required('Account name is required'),
  property_address: Yup.string().required('Property address is required'),
  property_city: Yup.string().required('City is required'),
  property_state: Yup.string().required('State is required'),
  property_zip: Yup.string().required('ZIP code is required'),
  
  // Service Request
  service_type: Yup.string().required('Service type is required'),
  service_description: Yup.string().required('Service description is required'),
  urgency: Yup.string().required('Urgency level is required'),
  
  // Scheduling
  preferred_date: Yup.date().required('Preferred date is required'),
  preferred_time: Yup.string().required('Preferred time is required'),
  
  // Estimate
  estimated_cost: Yup.number().min(0, 'Cost must be positive'),
  estimated_hours: Yup.number().min(0, 'Hours must be positive')
})

export const CustomerWorkflowModal: React.FC<CustomerWorkflowModalProps> = ({ 
  contact, 
  onClose, 
  onWorkflowComplete 
}) => {
  const { userProfile } = useSupabaseAuth()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [createdAccount, setCreatedAccount] = useState<Account | null>(null)
  const [createdJob, setCreatedJob] = useState<Job | null>(null)

  const steps: WorkflowStep[] = [
    { id: 1, title: 'Account Setup', description: 'Create customer account with property details', completed: false },
    { id: 2, title: 'Service Request', description: 'Capture service requirements and urgency', completed: false },
    { id: 3, title: 'Schedule Estimate', description: 'Book estimate appointment', completed: false },
    { id: 4, title: 'Review & Create', description: 'Review all details and create job', completed: false }
  ]

  const formik = useFormik({
    initialValues: {
      // Account Info
      account_name: `${contact.first_name} ${contact.last_name}`.trim() || 'Homeowner',
      property_address: '',
      property_city: '',
      property_state: '',
      property_zip: '',
      
      // Service Request
      service_type: '',
      service_description: '',
      urgency: 'low',
      
      // Scheduling
      preferred_date: '',
      preferred_time: '09:00',
      
      // Estimate
      estimated_cost: 0,
      estimated_hours: 2
    },
    validationSchema: workflowSchema,
    onSubmit: async (values) => {
      await handleCompleteWorkflow(values)
    }
  })

  const handleCompleteWorkflow = async (values: any) => {
    if (!userProfile) return
    
    setLoading(true)
    try {
      // Step 1: Create Account if not exists
      let account = createdAccount
      if (!account) {
        const { data: accountData, error: accountError } = await supabase
          .from('accounts')
          .insert({
            tenant_id: userProfile.tenant_id,
            name: values.account_name,
            type: 'residential',
            address_line1: values.property_address,
            city: values.property_city,
            state: values.property_state,
            zip_code: values.property_zip,
            phone: contact.phone,
            email: contact.email,
            notes: `Created from contact workflow for ${contact.first_name} ${contact.last_name}`
          })
          .select()
          .single()

        if (accountError) throw accountError
        account = accountData
        setCreatedAccount(account)

        // Update contact with account_id
        if (account) {
          await supabase
            .from('contacts')
            .update({ account_id: account.id })
            .eq('id', contact.id)
        }
      }

      // Step 2: Create Job
      const urgencyInfo = urgencyLevels.find(u => u.value === values.urgency)
      const adjustedCost = values.estimated_cost * (urgencyInfo?.multiplier || 1.0)

      if (!account) {
        throw new Error('Account creation failed')
      }

      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .insert({
          tenant_id: userProfile.tenant_id,
          account_id: account.id,
          contact_id: contact.id,
          title: `${values.service_type} - ${values.account_name}`,
          description: values.service_description,
          status: 'estimate_scheduled',
          priority: values.urgency,
          start_date: values.preferred_date,
          estimated_hours: values.estimated_hours,
          estimated_cost: adjustedCost,
          location_address: values.property_address,
          location_city: values.property_city,
          location_state: values.property_state,
          location_zip: values.property_zip,
          notes: `Service Type: ${values.service_type}\nPreferred Time: ${values.preferred_time}\nUrgency: ${urgencyInfo?.label}\nOriginal Estimate: $${values.estimated_cost}\nAdjusted for Urgency: $${adjustedCost}`,
          job_number: `JOB-${Date.now()}`
        })
        .select()
        .single()

      if (jobError) throw jobError
      setCreatedJob(jobData)

      // Step 3: Create initial call log
      if (account) {
        await supabase
          .from('calls')
          .insert({
            tenant_id: userProfile.tenant_id,
            contact_id: contact.id,
            account_id: account.id,
          call_type: 'inbound',
          status: 'completed',
          duration: 300, // 5 minutes default
          notes: `Initial service request call - ${values.service_type}`,
          created_at: new Date().toISOString()
        })
      }

      onWorkflowComplete(jobData)
      
    } catch (error) {
      console.error('Error completing workflow:', error)
      alert('Error creating workflow. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const nextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="row">
            <div className="col-12 mb-5">
              <h6 className="text-gray-700 fw-bold mb-3">Property Information</h6>
            </div>
            
            <div className="col-12 mb-7">
              <label className="required fw-semibold fs-6 mb-2">Account Name</label>
              <input
                type="text"
                className={clsx('form-control form-control-solid', {
                  'is-invalid': formik.touched.account_name && formik.errors.account_name
                })}
                placeholder="Enter account name"
                {...formik.getFieldProps('account_name')}
              />
              {formik.touched.account_name && formik.errors.account_name && (
                <div className="fv-plugins-message-container">
                  <span role="alert">{formik.errors.account_name}</span>
                </div>
              )}
            </div>

            <div className="col-12 mb-7">
              <label className="required fw-semibold fs-6 mb-2">Property Address</label>
              <input
                type="text"
                className={clsx('form-control form-control-solid', {
                  'is-invalid': formik.touched.property_address && formik.errors.property_address
                })}
                placeholder="Enter property address"
                {...formik.getFieldProps('property_address')}
              />
              {formik.touched.property_address && formik.errors.property_address && (
                <div className="fv-plugins-message-container">
                  <span role="alert">{formik.errors.property_address}</span>
                </div>
              )}
            </div>

            <div className="col-md-4 mb-7">
              <label className="required fw-semibold fs-6 mb-2">City</label>
              <input
                type="text"
                className={clsx('form-control form-control-solid', {
                  'is-invalid': formik.touched.property_city && formik.errors.property_city
                })}
                placeholder="City"
                {...formik.getFieldProps('property_city')}
              />
            </div>

            <div className="col-md-4 mb-7">
              <label className="required fw-semibold fs-6 mb-2">State</label>
              <input
                type="text"
                className={clsx('form-control form-control-solid', {
                  'is-invalid': formik.touched.property_state && formik.errors.property_state
                })}
                placeholder="State"
                {...formik.getFieldProps('property_state')}
              />
            </div>

            <div className="col-md-4 mb-7">
              <label className="required fw-semibold fs-6 mb-2">ZIP Code</label>
              <input
                type="text"
                className={clsx('form-control form-control-solid', {
                  'is-invalid': formik.touched.property_zip && formik.errors.property_zip
                })}
                placeholder="ZIP"
                {...formik.getFieldProps('property_zip')}
              />
            </div>
          </div>
        )

      case 2:
        return (
          <div className="row">
            <div className="col-12 mb-5">
              <h6 className="text-gray-700 fw-bold mb-3">Service Request Details</h6>
            </div>

            <div className="col-md-6 mb-7">
              <label className="required fw-semibold fs-6 mb-2">Service Type</label>
              <select
                className={clsx('form-select form-select-solid', {
                  'is-invalid': formik.touched.service_type && formik.errors.service_type
                })}
                {...formik.getFieldProps('service_type')}
              >
                <option value="">Select service type</option>
                {serviceTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="col-md-6 mb-7">
              <label className="required fw-semibold fs-6 mb-2">Urgency Level</label>
              <select
                className={clsx('form-select form-select-solid', {
                  'is-invalid': formik.touched.urgency && formik.errors.urgency
                })}
                {...formik.getFieldProps('urgency')}
              >
                {urgencyLevels.map(level => (
                  <option key={level.value} value={level.value}>{level.label}</option>
                ))}
              </select>
            </div>

            <div className="col-12 mb-7">
              <label className="required fw-semibold fs-6 mb-2">Service Description</label>
              <textarea
                className={clsx('form-control form-control-solid', {
                  'is-invalid': formik.touched.service_description && formik.errors.service_description
                })}
                rows={4}
                placeholder="Describe the service needed..."
                {...formik.getFieldProps('service_description')}
              />
            </div>

            <div className="col-md-6 mb-7">
              <label className="fw-semibold fs-6 mb-2">Estimated Cost</label>
              <input
                type="number"
                className="form-control form-control-solid"
                placeholder="0.00"
                {...formik.getFieldProps('estimated_cost')}
              />
            </div>

            <div className="col-md-6 mb-7">
              <label className="fw-semibold fs-6 mb-2">Estimated Hours</label>
              <input
                type="number"
                className="form-control form-control-solid"
                placeholder="2"
                {...formik.getFieldProps('estimated_hours')}
              />
            </div>
          </div>
        )

      case 3:
        return (
          <div className="row">
            <div className="col-12 mb-5">
              <h6 className="text-gray-700 fw-bold mb-3">Schedule Estimate Appointment</h6>
            </div>

            <div className="col-md-6 mb-7">
              <label className="required fw-semibold fs-6 mb-2">Preferred Date</label>
              <input
                type="date"
                className={clsx('form-control form-control-solid', {
                  'is-invalid': formik.touched.preferred_date && formik.errors.preferred_date
                })}
                min={new Date().toISOString().split('T')[0]}
                {...formik.getFieldProps('preferred_date')}
              />
            </div>

            <div className="col-md-6 mb-7">
              <label className="required fw-semibold fs-6 mb-2">Preferred Time</label>
              <select
                className={clsx('form-select form-select-solid', {
                  'is-invalid': formik.touched.preferred_time && formik.errors.preferred_time
                })}
                {...formik.getFieldProps('preferred_time')}
              >
                <option value="08:00">8:00 AM</option>
                <option value="09:00">9:00 AM</option>
                <option value="10:00">10:00 AM</option>
                <option value="11:00">11:00 AM</option>
                <option value="13:00">1:00 PM</option>
                <option value="14:00">2:00 PM</option>
                <option value="15:00">3:00 PM</option>
                <option value="16:00">4:00 PM</option>
              </select>
            </div>

            <div className="col-12">
              <div className="notice d-flex bg-light-primary rounded border-primary border border-dashed p-6">
                <div className="d-flex flex-stack flex-grow-1">
                  <div className="fw-semibold">
                    <h4 className="text-gray-900 fw-bold">Estimate Scheduling</h4>
                    <div className="fs-6 text-gray-700">
                      An estimate appointment will be automatically scheduled for{' '}
                      <span className="fw-bold">
                        {formik.values.preferred_date ? new Date(formik.values.preferred_date).toLocaleDateString() : 'selected date'}
                      </span>{' '}
                      at <span className="fw-bold">{formik.values.preferred_time}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      case 4:
        return (
          <div className="row">
            <div className="col-12 mb-5">
              <h6 className="text-gray-700 fw-bold mb-3">Review & Confirm</h6>
            </div>

            <div className="col-12">
              <div className="card mb-5">
                <div className="card-body">
                  <h6 className="card-title">Customer Information</h6>
                  <p><strong>Contact:</strong> {contact.first_name} {contact.last_name}</p>
                  <p><strong>Phone:</strong> {contact.phone}</p>
                  <p><strong>Email:</strong> {contact.email}</p>
                  <p><strong>Account:</strong> {formik.values.account_name}</p>
                  <p><strong>Property:</strong> {formik.values.property_address}, {formik.values.property_city}, {formik.values.property_state} {formik.values.property_zip}</p>
                </div>
              </div>

              <div className="card mb-5">
                <div className="card-body">
                  <h6 className="card-title">Service Details</h6>
                  <p><strong>Service:</strong> {formik.values.service_type}</p>
                  <p><strong>Urgency:</strong> {urgencyLevels.find(u => u.value === formik.values.urgency)?.label}</p>
                  <p><strong>Description:</strong> {formik.values.service_description}</p>
                  <p><strong>Estimated Cost:</strong> ${formik.values.estimated_cost}</p>
                  <p><strong>Estimated Hours:</strong> {formik.values.estimated_hours}</p>
                </div>
              </div>

              <div className="card">
                <div className="card-body">
                  <h6 className="card-title">Appointment</h6>
                  <p><strong>Date:</strong> {formik.values.preferred_date ? new Date(formik.values.preferred_date).toLocaleDateString() : 'Not set'}</p>
                  <p><strong>Time:</strong> {formik.values.preferred_time}</p>
                </div>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="modal fade show d-block" tabIndex={-1} role="dialog">
      <div className="modal-dialog modal-dialog-centered modal-xl" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Customer Workflow - {contact.first_name} {contact.last_name}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>

          <div className="modal-body">
            {/* Progress Steps */}
            <div className="stepper stepper-pills stepper-column d-flex flex-column flex-xl-row flex-row-fluid gap-10" id="kt_create_account_stepper">
              <div className="card d-flex justify-content-center justify-content-xl-start flex-row-auto w-100 w-xl-300px w-xxl-400px">
                <div className="card-body px-6 px-lg-10 px-xxl-15 py-20">
                  <div className="stepper-nav">
                    {steps.map((step, index) => (
                      <div 
                        key={step.id}
                        className={clsx('stepper-item', {
                          'current': currentStep === step.id,
                          'completed': currentStep > step.id
                        })}
                      >
                        <div className="stepper-wrapper">
                          <div className="stepper-icon">
                            <i className="stepper-check fas fa-check"></i>
                            <span className="stepper-number">{step.id}</span>
                          </div>
                          <div className="stepper-label">
                            <h3 className="stepper-title">{step.title}</h3>
                            <div className="stepper-desc fw-semibold">{step.description}</div>
                          </div>
                        </div>
                        {index < steps.length - 1 && <div className="stepper-line h-40px"></div>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="card d-flex flex-row-fluid flex-center">
                <form onSubmit={formik.handleSubmit} className="card-body py-20 w-100 mw-xl-700px px-9">
                  {renderStepContent()}
                </form>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <div className="d-flex justify-content-between w-100">
              <div>
                {currentStep > 1 && (
                  <button
                    type="button"
                    className="btn btn-lg btn-light-primary me-3"
                    onClick={prevStep}
                    disabled={loading}
                  >
                    Previous
                  </button>
                )}
              </div>
              
              <div>
                {currentStep < 4 ? (
                  <button
                    type="button"
                    className="btn btn-lg btn-primary"
                    onClick={nextStep}
                    disabled={loading}
                  >
                    Next Step
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="btn btn-lg btn-success"
                    disabled={loading || !formik.isValid}
                    onClick={() => formik.handleSubmit()}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm align-middle me-2"></span>
                        Creating...
                      </>
                    ) : (
                      'Complete Workflow'
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}