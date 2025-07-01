import React, { useState, useEffect } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import clsx from 'clsx'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'

interface EditLeadModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  leadId: string
}

interface Lead {
  id: string
  tenant_id: string
  caller_name: string
  caller_type?: 'business' | 'individual'
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

const statusOptions = [
  { value: 'new', label: 'New Lead', color: 'primary' },
  { value: 'qualified', label: 'Qualified', color: 'warning' },
  { value: 'unqualified', label: 'Unqualified', color: 'secondary' },
  { value: 'converted', label: 'Converted to Job', color: 'success' }
]

const editLeadSchema = Yup.object().shape({
  caller_name: Yup.string()
    .min(2, 'Minimum 2 characters')
    .max(100, 'Maximum 100 characters')
    .required('Caller name is required'),
  caller_type: Yup.string()
    .oneOf(['business', 'individual'], 'Please select caller type')
    .required('Caller type is required'),
  phone_number: Yup.string()
    .matches(/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number')
    .required('Phone number is required'),
  email: Yup.string().email('Invalid email format'),
  lead_source: Yup.string().required('Please specify how they heard about you'),
  initial_request: Yup.string()
    .min(10, 'Please provide more detail about their request')
    .max(500, 'Maximum 500 characters')
    .required('Initial request is required'),
  status: Yup.string().required('Status is required'),
  urgency: Yup.string().required('Please specify urgency level'),
  estimated_value: Yup.number().min(0, 'Value must be positive').nullable(),
  follow_up_date: Yup.date().nullable(),
  notes: Yup.string().max(1000, 'Maximum 1000 characters')
})

export const EditLeadModal: React.FC<EditLeadModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess,
  leadId
}) => {
  const { userProfile } = useSupabaseAuth()
  const [loading, setLoading] = useState(false)
  const [fetchingLead, setFetchingLead] = useState(false)
  const [lead, setLead] = useState<Lead | null>(null)

  const formik = useFormik({
    initialValues: {
      caller_name: '',
      caller_type: 'individual' as const,
      phone_number: '',
      email: '',
      lead_source: '',
      initial_request: '',
      status: 'new' as const,
      urgency: 'medium' as const,
      estimated_value: '',
      follow_up_date: '',
      notes: ''
    },
    validationSchema: editLeadSchema,
    onSubmit: async (values) => {
      await handleUpdateLead(values)
    }
  })

  // Fetch lead data when modal opens
  useEffect(() => {
    if (isOpen && leadId) {
      fetchLeadData()
    }
  }, [isOpen, leadId])

  const fetchLeadData = async () => {
    if (!userProfile?.tenant_id) return

    setFetchingLead(true)
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .eq('tenant_id', userProfile.tenant_id)
        .single()

      if (error) {
        console.error('Error fetching lead:', error)
        alert('Error loading lead data')
        onClose()
        return
      }

      setLead(data)
      
      // Populate form with existing data
      formik.setValues({
        caller_name: data.caller_name || '',
        caller_type: data.caller_type || 'individual',
        phone_number: data.phone_number || '',
        email: data.email || '',
        lead_source: data.lead_source || '',
        initial_request: data.initial_request || '',
        status: data.status || 'new',
        urgency: data.urgency || 'medium',
        estimated_value: data.estimated_value ? data.estimated_value.toString() : '',
        follow_up_date: data.follow_up_date ? new Date(data.follow_up_date).toISOString().slice(0, 16) : '',
        notes: data.notes || ''
      })
    } catch (error) {
      console.error('Error fetching lead:', error)
      alert('Error loading lead data')
      onClose()
    } finally {
      setFetchingLead(false)
    }
  }

  const handleUpdateLead = async (values: any) => {
    if (!userProfile?.tenant_id || !leadId) {
      alert('Authentication error. Please refresh and try again.')
      return
    }

    setLoading(true)
    try {
      const updateData = {
        caller_name: values.caller_name,
        caller_type: values.caller_type,
        phone_number: values.phone_number,
        email: values.email || null,
        lead_source: values.lead_source,
        initial_request: values.initial_request,
        status: values.status,
        urgency: values.urgency,
        estimated_value: values.estimated_value ? parseFloat(values.estimated_value) : null,
        follow_up_date: values.follow_up_date || null,
        notes: values.notes || null,
        updated_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', leadId)
        .eq('tenant_id', userProfile.tenant_id)

      if (error) {
        console.error('Error updating lead:', error)
        throw error
      }

      // Success
      onSuccess()
      formik.resetForm()
      
    } catch (error) {
      console.error('Error updating lead:', error)
      
      if (error instanceof Error) {
        alert(error.message)
      } else {
        alert('Error updating lead. Please try again.')
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
          <div className="modal-header bg-warning">
            <h5 className="modal-title text-white">
              <i className="ki-duotone ki-pencil fs-2 text-white me-2">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              Edit Lead
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
              aria-label="Close"
            ></button>
          </div>

          {fetchingLead ? (
            <div className="modal-body d-flex justify-content-center py-10">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading lead...</span>
              </div>
            </div>
          ) : (
            <form onSubmit={formik.handleSubmit} noValidate>
              <div className="modal-body">
                <div className="notice d-flex bg-light-warning rounded border-warning border border-dashed p-6 mb-7">
                  <div className="d-flex flex-stack flex-grow-1">
                    <div className="fw-semibold">
                      <h6 className="text-gray-900 fw-bold">Update Lead Information</h6>
                      <div className="fs-7 text-gray-700">
                        Make changes to this lead's details. Changes will be saved immediately.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="row">
                  {/* Contact Information */}
                  <div className="col-12 mb-5">
                    <h6 className="text-gray-700 fw-bold mb-3">
                      <i className="ki-duotone ki-user fs-2 text-warning me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Contact Information
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
                    <label className="required fw-semibold fs-6 mb-2">Caller Type</label>
                    <select
                      className={clsx('form-select form-select-solid', {
                        'is-invalid': formik.touched.caller_type && formik.errors.caller_type
                      })}
                      {...formik.getFieldProps('caller_type')}
                    >
                      <option value="individual">Individual Customer</option>
                      <option value="business">Business Client</option>
                    </select>
                    {formik.touched.caller_type && formik.errors.caller_type && (
                      <div className="fv-plugins-message-container">
                        <span role="alert">{formik.errors.caller_type}</span>
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
                    <label className="fw-semibold fs-6 mb-2">Email</label>
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
                    <label className="required fw-semibold fs-6 mb-2">Lead Source</label>
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

                  {/* Lead Details */}
                  <div className="col-12 mb-5 mt-5">
                    <h6 className="text-gray-700 fw-bold mb-3">
                      <i className="ki-duotone ki-notepad-edit fs-2 text-warning me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Lead Details
                    </h6>
                  </div>

                  <div className="col-12 mb-7">
                    <label className="required fw-semibold fs-6 mb-2">Initial Request</label>
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

                  <div className="col-md-4 mb-7">
                    <label className="required fw-semibold fs-6 mb-2">Status</label>
                    <select
                      className={clsx('form-select form-select-solid', {
                        'is-invalid': formik.touched.status && formik.errors.status
                      })}
                      {...formik.getFieldProps('status')}
                    >
                      {statusOptions.map(status => (
                        <option key={status.value} value={status.value}>{status.label}</option>
                      ))}
                    </select>
                    {formik.touched.status && formik.errors.status && (
                      <div className="fv-plugins-message-container">
                        <span role="alert">{formik.errors.status}</span>
                      </div>
                    )}
                  </div>

                  <div className="col-md-4 mb-7">
                    <label className="required fw-semibold fs-6 mb-2">Urgency</label>
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

                  <div className="col-md-4 mb-7">
                    <label className="fw-semibold fs-6 mb-2">Estimated Value ($)</label>
                    <input
                      type="number"
                      className="form-control form-control-solid"
                      placeholder="0.00"
                      {...formik.getFieldProps('estimated_value')}
                    />
                  </div>

                  <div className="col-md-6 mb-7">
                    <label className="fw-semibold fs-6 mb-2">Follow-up Date</label>
                    <input
                      type="datetime-local"
                      className="form-control form-control-solid"
                      {...formik.getFieldProps('follow_up_date')}
                    />
                  </div>

                  <div className="col-md-6 mb-7">
                    <label className="fw-semibold fs-6 mb-2">Notes</label>
                    <textarea
                      className="form-control form-control-solid"
                      rows={3}
                      placeholder="Additional notes..."
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
                  className="btn btn-warning"
                  disabled={loading || !formik.isValid}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm align-middle me-2"></span>
                      Updating...
                    </>
                  ) : (
                    <>
                      <i className="ki-duotone ki-check fs-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Update Lead
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}