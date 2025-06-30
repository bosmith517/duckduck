import React, { useState } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import clsx from 'clsx'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'

interface NewInquiryModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (leadId: string) => void
}

interface Lead {
  id: string
  tenant_id: string
  caller_name: string
  phone_number: string
  email?: string
  lead_source: string
  initial_request: string
  status: 'new' | 'qualified' | 'unqualified' | 'converted'
  urgency: 'low' | 'medium' | 'high' | 'emergency'
  estimated_value?: number
  follow_up_date?: string
  notes?: string
  created_at: string
  updated_at: string
}

const leadSources = [
  'Google Search',
  'Facebook/Social Media', 
  'Referral - Past Customer',
  'Referral - Trade Partner',
  'Door Hanger/Flyer',
  'Yard Sign',
  'Truck/Vehicle Wrap',
  'Word of Mouth',
  'Insurance Company',
  'Home Show/Event',
  'Angie\'s List/HomeAdvisor',
  'Yellow Pages',
  'Radio/TV Ad',
  'Direct Mail',
  'Walk-in',
  'Other'
]

const urgencyLevels = [
  { value: 'low', label: 'Standard (1-2 weeks)', color: 'success' },
  { value: 'medium', label: 'Priority (3-5 days)', color: 'warning' },
  { value: 'high', label: 'Urgent (24-48 hours)', color: 'danger' },
  { value: 'emergency', label: 'Emergency (Same day)', color: 'dark' }
]

const inquirySchema = Yup.object().shape({
  caller_name: Yup.string()
    .min(2, 'Minimum 2 characters')
    .max(100, 'Maximum 100 characters')
    .required('Caller name is required'),
  phone_number: Yup.string()
    .matches(/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number')
    .required('Phone number is required'),
  email: Yup.string().email('Invalid email format'),
  lead_source: Yup.string().required('Please specify how they heard about you'),
  initial_request: Yup.string()
    .min(10, 'Please provide more detail about their request')
    .max(500, 'Maximum 500 characters')
    .required('Initial request is required'),
  urgency: Yup.string().required('Please specify urgency level'),
  estimated_value: Yup.number().min(0, 'Value must be positive').nullable(),
  follow_up_date: Yup.date().nullable(),
  notes: Yup.string().max(1000, 'Maximum 1000 characters')
})

export const NewInquiryModal: React.FC<NewInquiryModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess 
}) => {
  const { userProfile } = useSupabaseAuth()
  const [loading, setLoading] = useState(false)

  const formik = useFormik({
    initialValues: {
      caller_name: '',
      phone_number: '',
      email: '',
      lead_source: '',
      initial_request: '',
      urgency: 'medium',
      estimated_value: '',
      follow_up_date: '',
      notes: ''
    },
    validationSchema: inquirySchema,
    onSubmit: async (values) => {
      await handleCreateInquiry(values)
    }
  })

  const handleCreateInquiry = async (values: any) => {
    if (!userProfile?.tenant_id) {
      alert('Authentication error. Please refresh and try again.')
      return
    }

    setLoading(true)
    try {
      // 1. Create Lead Record with error handling for schema mismatches
      const leadData = {
        tenant_id: userProfile.tenant_id,
        caller_name: values.caller_name,
        phone_number: values.phone_number,
        email: values.email || null,
        lead_source: values.lead_source,
        initial_request: values.initial_request,
        status: 'new' as const,
        urgency: values.urgency,
        estimated_value: values.estimated_value ? parseFloat(values.estimated_value) : null,
        follow_up_date: values.follow_up_date || null,
        notes: values.notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      console.log('Attempting to create lead with data:', leadData)

      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .insert(leadData)
        .select()
        .single()

      if (leadError) {
        console.error('Error creating lead:', leadError)
        
        // Handle specific schema errors gracefully
        if (leadError.message?.includes('column') && leadError.message?.includes('does not exist')) {
          throw new Error(
            'Database schema mismatch detected. Please run the FINAL_SCHEMA_FIX.sql script in your Supabase SQL editor, then restart your development server and try again.'
          )
        }
        
        if (leadError.message?.includes('schema cache')) {
          throw new Error(
            'Schema cache issue detected. Please wait 2-3 minutes and try again, or restart your development server.'
          )
        }
        
        throw leadError
      }

      // 2. Create Call Log Record
      const callLogData = {
        tenant_id: userProfile.tenant_id,
        lead_id: lead.id,
        caller_name: values.caller_name,
        caller_phone: values.phone_number,
        call_type: 'inbound',
        call_direction: 'inbound',
        duration: 300, // Default 5 minutes
        status: 'completed',
        notes: `Initial inquiry: ${values.initial_request.substring(0, 200)}${values.initial_request.length > 200 ? '...' : ''}`,
        created_at: new Date().toISOString()
      }

      const { error: callError } = await supabase
        .from('call_logs')
        .insert(callLogData)

      if (callError) {
        console.error('Error creating call log:', callError)
        // Don't throw - call log is supplementary
      }

      // 3. Schedule Follow-up if specified
      if (values.follow_up_date) {
        const reminderData = {
          tenant_id: userProfile.tenant_id,
          lead_id: lead.id,
          reminder_type: 'follow_up_call',
          scheduled_date: values.follow_up_date,
          status: 'pending',
          message: `Follow up on ${values.initial_request.substring(0, 100)}`,
          created_at: new Date().toISOString()
        }

        const { error: reminderError } = await supabase
          .from('lead_reminders')
          .insert(reminderData)

        if (reminderError) {
          console.error('Error creating reminder:', reminderError)
          // Don't throw - reminder is optional
        }
      }

      // Success - close modal and return lead ID
      onSuccess(lead.id)
      formik.resetForm()
      
    } catch (error) {
      console.error('Error creating inquiry:', error)
      
      // Show more helpful error messages
      if (error instanceof Error) {
        alert(error.message)
      } else {
        alert('Error creating inquiry. Please check the console for details and try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal fade show d-block" tabIndex={-1} role="dialog">
      <div className="modal-dialog modal-dialog-centered modal-lg" role="document">
        <div className="modal-content">
          <div className="modal-header bg-primary">
            <h5 className="modal-title text-white">
              <i className="ki-duotone ki-phone fs-2 text-white me-2">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              New Customer Inquiry
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
              aria-label="Close"
            ></button>
          </div>

          <form onSubmit={formik.handleSubmit} noValidate>
            <div className="modal-body">
              <div className="notice d-flex bg-light-info rounded border-info border border-dashed p-6 mb-7">
                <div className="d-flex flex-stack flex-grow-1">
                  <div className="fw-semibold">
                    <h6 className="text-gray-900 fw-bold">Capture the Call</h6>
                    <div className="fs-7 text-gray-700">
                      This starts the automated customer journey. Get the basics here, 
                      then we'll guide you through qualification and scheduling.
                    </div>
                  </div>
                </div>
              </div>

              <div className="row">
                {/* Caller Information */}
                <div className="col-12 mb-5">
                  <h6 className="text-gray-700 fw-bold mb-3">
                    <i className="ki-duotone ki-user fs-2 text-primary me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    Caller Information
                  </h6>
                </div>

                <div className="col-md-6 mb-7">
                  <label className="required fw-semibold fs-6 mb-2">Caller Name</label>
                  <input
                    type="text"
                    className={clsx('form-control form-control-solid', {
                      'is-invalid': formik.touched.caller_name && formik.errors.caller_name
                    })}
                    placeholder="Enter caller's name"
                    {...formik.getFieldProps('caller_name')}
                  />
                  {formik.touched.caller_name && formik.errors.caller_name && (
                    <div className="fv-plugins-message-container">
                      <span role="alert">{formik.errors.caller_name}</span>
                    </div>
                  )}
                </div>

                <div className="col-md-6 mb-7">
                  <label className="required fw-semibold fs-6 mb-2">Phone Number</label>
                  <input
                    type="tel"
                    className={clsx('form-control form-control-solid', {
                      'is-invalid': formik.touched.phone_number && formik.errors.phone_number
                    })}
                    placeholder="(555) 123-4567"
                    {...formik.getFieldProps('phone_number')}
                  />
                  {formik.touched.phone_number && formik.errors.phone_number && (
                    <div className="fv-plugins-message-container">
                      <span role="alert">{formik.errors.phone_number}</span>
                    </div>
                  )}
                </div>

                <div className="col-md-6 mb-7">
                  <label className="fw-semibold fs-6 mb-2">Email (Optional)</label>
                  <input
                    type="email"
                    className={clsx('form-control form-control-solid', {
                      'is-invalid': formik.touched.email && formik.errors.email
                    })}
                    placeholder="email@example.com"
                    {...formik.getFieldProps('email')}
                  />
                  {formik.touched.email && formik.errors.email && (
                    <div className="fv-plugins-message-container">
                      <span role="alert">{formik.errors.email}</span>
                    </div>
                  )}
                </div>

                <div className="col-md-6 mb-7">
                  <label className="required fw-semibold fs-6 mb-2">How did they hear about you?</label>
                  <select
                    className={clsx('form-select form-select-solid', {
                      'is-invalid': formik.touched.lead_source && formik.errors.lead_source
                    })}
                    {...formik.getFieldProps('lead_source')}
                  >
                    <option value="">Select lead source</option>
                    {leadSources.map(source => (
                      <option key={source} value={source}>{source}</option>
                    ))}
                  </select>
                  {formik.touched.lead_source && formik.errors.lead_source && (
                    <div className="fv-plugins-message-container">
                      <span role="alert">{formik.errors.lead_source}</span>
                    </div>
                  )}
                </div>

                {/* Request Details */}
                <div className="col-12 mb-5 mt-5">
                  <h6 className="text-gray-700 fw-bold mb-3">
                    <i className="ki-duotone ki-notepad-edit fs-2 text-warning me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    Request Details
                  </h6>
                </div>

                <div className="col-12 mb-7">
                  <label className="required fw-semibold fs-6 mb-2">What do they need?</label>
                  <textarea
                    className={clsx('form-control form-control-solid', {
                      'is-invalid': formik.touched.initial_request && formik.errors.initial_request
                    })}
                    rows={4}
                    placeholder="Describe their initial request, problem, or need..."
                    {...formik.getFieldProps('initial_request')}
                  />
                  {formik.touched.initial_request && formik.errors.initial_request && (
                    <div className="fv-plugins-message-container">
                      <span role="alert">{formik.errors.initial_request}</span>
                    </div>
                  )}
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
                  {formik.touched.urgency && formik.errors.urgency && (
                    <div className="fv-plugins-message-container">
                      <span role="alert">{formik.errors.urgency}</span>
                    </div>
                  )}
                </div>

                <div className="col-md-6 mb-7">
                  <label className="fw-semibold fs-6 mb-2">Estimated Value ($)</label>
                  <input
                    type="number"
                    className="form-control form-control-solid"
                    placeholder="0.00"
                    {...formik.getFieldProps('estimated_value')}
                  />
                  <div className="form-text">Optional - your initial estimate of job value</div>
                </div>

                <div className="col-md-6 mb-7">
                  <label className="fw-semibold fs-6 mb-2">Follow-up Date</label>
                  <input
                    type="datetime-local"
                    className="form-control form-control-solid"
                    min={new Date().toISOString().slice(0, 16)}
                    {...formik.getFieldProps('follow_up_date')}
                  />
                  <div className="form-text">Optional - schedule a reminder to follow up</div>
                </div>

                <div className="col-md-6 mb-7">
                  <label className="fw-semibold fs-6 mb-2">Call Notes</label>
                  <textarea
                    className="form-control form-control-solid"
                    rows={3}
                    placeholder="Additional notes about the call..."
                    {...formik.getFieldProps('notes')}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-light"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || !formik.isValid}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm align-middle me-2"></span>
                    Creating Lead...
                  </>
                ) : (
                  <>
                    <i className="ki-duotone ki-arrow-right fs-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    Create Lead
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}