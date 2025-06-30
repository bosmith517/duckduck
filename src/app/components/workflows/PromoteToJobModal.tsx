import React, { useState, useEffect } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import clsx from 'clsx'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'

interface PromoteToJobModalProps {
  isOpen: boolean
  onClose: () => void
  leadId: string
  leadData: any
  onSuccess: (jobId: string) => void
}

interface Technician {
  id: string
  first_name: string
  last_name: string
  role: string
  is_available: boolean
}

const serviceTypes = [
  'Roof Inspection',
  'Roof Repair',
  'Roof Replacement',
  'Gutter Repair',
  'Gutter Installation',
  'Siding Repair',
  'Siding Installation',
  'Emergency Repair',
  'Insurance Inspection',
  'Maintenance Service',
  'Other'
]

const promoteSchema = Yup.object().shape({
  // Account & Contact Info
  property_address: Yup.string().required('Property address is required'),
  property_city: Yup.string().required('City is required'),
  property_state: Yup.string().required('State is required'),
  property_zip: Yup.string().required('ZIP code is required'),
  
  // Service Details
  service_type: Yup.string().required('Service type is required'),
  job_description: Yup.string().required('Job description is required'),
  
  // Scheduling
  estimate_date: Yup.date().required('Estimate date is required'),
  estimate_time: Yup.string().required('Estimate time is required'),
  assigned_technician: Yup.string().required('Please assign a technician'),
  
  // Additional
  estimated_duration: Yup.number().min(1, 'Duration must be at least 1 hour').required('Estimated duration is required'),
  estimated_value: Yup.number().min(0, 'Value must be positive').required('Estimated value is required')
})

export const PromoteToJobModal: React.FC<PromoteToJobModalProps> = ({ 
  isOpen, 
  onClose, 
  leadId,
  leadData,
  onSuccess 
}) => {
  const { userProfile } = useSupabaseAuth()
  const [loading, setLoading] = useState(false)
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [currentStep, setCurrentStep] = useState(1)

  useEffect(() => {
    if (isOpen) {
      fetchTechnicians()
    }
  }, [isOpen])

  const fetchTechnicians = async () => {
    if (!userProfile?.tenant_id) return

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, first_name, last_name, role')
        .eq('tenant_id', userProfile.tenant_id)
        .in('role', ['technician', 'manager', 'admin'])
        .order('first_name', { ascending: true })

      if (!error && data) {
        setTechnicians(data.map(tech => ({
          ...tech,
          is_available: true // We'll enhance this later with real availability
        })))
      }
    } catch (error) {
      console.error('Error fetching technicians:', error)
    }
  }

  const formik = useFormik({
    initialValues: {
      property_address: '',
      property_city: '',
      property_state: '',
      property_zip: '',
      service_type: '',
      job_description: leadData?.initial_request || '',
      estimate_date: '',
      estimate_time: '09:00',
      assigned_technician: '',
      estimated_duration: 2,
      estimated_value: leadData?.estimated_value || 0,
      special_instructions: ''
    },
    validationSchema: promoteSchema,
    onSubmit: async (values) => {
      await handlePromoteToJob(values)
    }
  })

  const handlePromoteToJob = async (values: any) => {
    if (!userProfile?.tenant_id) {
      alert('Authentication error. Please refresh and try again.')
      return
    }

    setLoading(true)
    try {
      // Step 1: Update Lead Status to "Qualified"
      const { error: leadUpdateError } = await supabase
        .from('leads')
        .update({ 
          status: 'qualified',
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId)

      if (leadUpdateError) throw leadUpdateError

      // Step 2: Create Account Record
      const accountData = {
        tenant_id: userProfile.tenant_id,
        name: `${leadData.caller_name} - ${values.property_address}`,
        type: 'residential',
        phone: leadData.phone_number,
        email: leadData.email,
        address_line1: values.property_address,
        city: values.property_city,
        state: values.property_state,
        zip_code: values.property_zip,
        account_status: 'active',
        notes: `Created from lead: ${leadData.initial_request}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { data: account, error: accountError } = await supabase
        .from('accounts')
        .insert(accountData)
        .select()
        .single()

      if (accountError) throw accountError

      // Step 3: Create Contact Record
      const contactData = {
        tenant_id: userProfile.tenant_id,
        account_id: account.id,
        first_name: leadData.caller_name.split(' ')[0] || leadData.caller_name,
        last_name: leadData.caller_name.split(' ').slice(1).join(' ') || '',
        name: leadData.caller_name,
        phone: leadData.phone_number,
        email: leadData.email,
        is_primary: true,
        notes: `Primary contact for ${values.service_type} project`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .insert(contactData)
        .select()
        .single()

      if (contactError) throw contactError

      // Step 4: Create Job Record
      const estimateDateTime = new Date(`${values.estimate_date}T${values.estimate_time}:00`)
      const jobData = {
        tenant_id: userProfile.tenant_id,
        account_id: account.id,
        contact_id: contact.id,
        lead_id: leadId,
        job_number: `JOB-${Date.now()}`,
        title: `${values.service_type} - ${leadData.caller_name}`,
        description: values.job_description,
        status: 'needs_estimate',
        priority: leadData.urgency === 'emergency' ? 'high' : leadData.urgency === 'high' ? 'medium' : 'low',
        start_date: estimateDateTime.toISOString(),
        estimated_hours: values.estimated_duration,
        estimated_cost: values.estimated_value,
        location_address: values.property_address,
        location_city: values.property_city,
        location_state: values.property_state,
        location_zip: values.property_zip,
        assigned_technician_id: values.assigned_technician,
        notes: values.special_instructions || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert(jobData)
        .select()
        .single()

      if (jobError) throw jobError

      // Step 5: Update Lead with converted status and job reference
      await supabase
        .from('leads')
        .update({ 
          status: 'converted',
          converted_to_job_id: job.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId)

      // Step 6: Send Automated SMS/Email Notification (placeholder for now)
      try {
        await sendEstimateNotification(leadData, estimateDateTime, values)
      } catch (notificationError) {
        console.error('Error sending notification:', notificationError)
        // Don't fail the whole process for notification errors
      }

      // Step 7: Create Calendar Event for Technician
      try {
        await createTechnicianCalendarEvent(job, estimateDateTime, values.assigned_technician)
      } catch (calendarError) {
        console.error('Error creating calendar event:', calendarError)
        // Don't fail the whole process for calendar errors
      }

      onSuccess(job.id)
      formik.resetForm()
      
    } catch (error) {
      console.error('Error promoting lead to job:', error)
      alert('Error creating job. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const sendEstimateNotification = async (leadData: any, estimateDateTime: Date, values: any) => {
    // This would integrate with your SMS/email service
    // For now, we'll create a notification record
    const notificationData = {
      tenant_id: userProfile?.tenant_id,
      recipient_phone: leadData.phone_number,
      recipient_email: leadData.email,
      message_type: 'estimate_scheduled',
      message: `Hi ${leadData.caller_name}! Your ${values.service_type} estimate is scheduled for ${estimateDateTime.toLocaleDateString()} at ${estimateDateTime.toLocaleTimeString()}. We'll see you then!`,
      status: 'pending',
      scheduled_send_time: new Date().toISOString()
    }

    await supabase
      .from('notifications')
      .insert(notificationData)
  }

  const createTechnicianCalendarEvent = async (job: any, estimateDateTime: Date, technicianId: string) => {
    // Create calendar event for assigned technician
    const eventData = {
      tenant_id: userProfile?.tenant_id,
      user_id: technicianId,
      job_id: job.id,
      event_type: 'estimate_appointment',
      title: `Estimate: ${job.title}`,
      description: `Estimate appointment for ${job.description}`,
      start_time: estimateDateTime.toISOString(),
      end_time: new Date(estimateDateTime.getTime() + (2 * 60 * 60 * 1000)).toISOString(), // 2 hours
      location: job.location_address,
      status: 'scheduled'
    }

    await supabase
      .from('calendar_events')
      .insert(eventData)
  }

  const nextStep = () => {
    if (currentStep < 3) {
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
              <h6 className="text-gray-700 fw-bold mb-3">Service Details</h6>
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
              <label className="required fw-semibold fs-6 mb-2">Estimated Value ($)</label>
              <input
                type="number"
                className={clsx('form-control form-control-solid', {
                  'is-invalid': formik.touched.estimated_value && formik.errors.estimated_value
                })}
                placeholder="0.00"
                {...formik.getFieldProps('estimated_value')}
              />
            </div>

            <div className="col-12 mb-7">
              <label className="required fw-semibold fs-6 mb-2">Job Description</label>
              <textarea
                className={clsx('form-control form-control-solid', {
                  'is-invalid': formik.touched.job_description && formik.errors.job_description
                })}
                rows={4}
                placeholder="Detailed description of work to be performed..."
                {...formik.getFieldProps('job_description')}
              />
            </div>

            <div className="col-md-6 mb-7">
              <label className="required fw-semibold fs-6 mb-2">Estimated Duration (hours)</label>
              <input
                type="number"
                className={clsx('form-control form-control-solid', {
                  'is-invalid': formik.touched.estimated_duration && formik.errors.estimated_duration
                })}
                placeholder="2"
                min="1"
                step="0.5"
                {...formik.getFieldProps('estimated_duration')}
              />
            </div>

            <div className="col-md-6 mb-7">
              <label className="fw-semibold fs-6 mb-2">Special Instructions</label>
              <textarea
                className="form-control form-control-solid"
                rows={3}
                placeholder="Any special instructions or notes..."
                {...formik.getFieldProps('special_instructions')}
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
              <label className="required fw-semibold fs-6 mb-2">Estimate Date</label>
              <input
                type="date"
                className={clsx('form-control form-control-solid', {
                  'is-invalid': formik.touched.estimate_date && formik.errors.estimate_date
                })}
                min={new Date().toISOString().split('T')[0]}
                {...formik.getFieldProps('estimate_date')}
              />
            </div>

            <div className="col-md-6 mb-7">
              <label className="required fw-semibold fs-6 mb-2">Estimate Time</label>
              <select
                className={clsx('form-select form-select-solid', {
                  'is-invalid': formik.touched.estimate_time && formik.errors.estimate_time
                })}
                {...formik.getFieldProps('estimate_time')}
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

            <div className="col-12 mb-7">
              <label className="required fw-semibold fs-6 mb-2">Assign Technician</label>
              <select
                className={clsx('form-select form-select-solid', {
                  'is-invalid': formik.touched.assigned_technician && formik.errors.assigned_technician
                })}
                {...formik.getFieldProps('assigned_technician')}
              >
                <option value="">Select technician</option>
                {technicians.map(tech => (
                  <option key={tech.id} value={tech.id}>
                    {tech.first_name} {tech.last_name} ({tech.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12">
              <div className="notice d-flex bg-light-success rounded border-success border border-dashed p-6">
                <div className="d-flex flex-stack flex-grow-1">
                  <div className="fw-semibold">
                    <h4 className="text-gray-900 fw-bold">Ready to Create Job</h4>
                    <div className="fs-6 text-gray-700">
                      This will create the account, contact, and job records, then send appointment 
                      confirmation to the customer via SMS/email.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal fade show d-block" tabIndex={-1} role="dialog">
      <div className="modal-dialog modal-dialog-centered modal-xl" role="document">
        <div className="modal-content">
          <div className="modal-header bg-success">
            <h5 className="modal-title text-white">
              <i className="ki-duotone ki-arrow-up-right fs-2 text-white me-2">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              Promote Lead to Job - {leadData?.caller_name}
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
            ></button>
          </div>

          <div className="modal-body">
            {/* Progress Indicator */}
            <div className="d-flex justify-content-center mb-7">
              <div className="stepper stepper-pills stepper-column d-flex flex-row">
                {[1, 2, 3].map(step => (
                  <div key={step} className={clsx('stepper-item me-5', {
                    'current': currentStep === step,
                    'completed': currentStep > step
                  })}>
                    <div className="stepper-wrapper">
                      <div className="stepper-icon">
                        <i className="stepper-check fas fa-check"></i>
                        <span className="stepper-number">{step}</span>
                      </div>
                      <div className="stepper-label">
                        <h3 className="stepper-title">
                          {step === 1 && 'Property'}
                          {step === 2 && 'Service'}
                          {step === 3 && 'Schedule'}
                        </h3>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={formik.handleSubmit}>
              {renderStepContent()}
            </form>
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
                {currentStep < 3 ? (
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
                    type="button"
                    className="btn btn-lg btn-success"
                    disabled={loading || !formik.isValid}
                    onClick={() => formik.handleSubmit()}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm align-middle me-2"></span>
                        Creating Job...
                      </>
                    ) : (
                      <>
                        <i className="ki-duotone ki-check fs-2">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        Create Job & Schedule Estimate
                      </>
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