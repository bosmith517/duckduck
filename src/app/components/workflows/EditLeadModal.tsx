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
  // Address fields
  street_address?: string
  city?: string
  state?: string
  zip_code?: string
  property_type?: 'residential' | 'commercial' | 'industrial' | 'other'
  property_size?: string
  lot_size?: string
  year_built?: number
  additional_property_info?: Record<string, any>
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
  notes: Yup.string().max(1000, 'Maximum 1000 characters'),
  // Address validation
  street_address: Yup.string().max(200, 'Maximum 200 characters'),
  city: Yup.string().max(100, 'Maximum 100 characters'),
  state: Yup.string().max(50, 'Maximum 50 characters'),
  zip_code: Yup.string().max(20, 'Maximum 20 characters'),
  property_type: Yup.string().oneOf(['residential', 'commercial', 'industrial', 'other']),
  property_size: Yup.string().max(100, 'Maximum 100 characters'),
  lot_size: Yup.string().max(100, 'Maximum 100 characters'),
  year_built: Yup.number().min(1800, 'Year must be after 1800').max(new Date().getFullYear() + 5, 'Year cannot be too far in future').nullable()
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
      notes: '',
      // Address fields
      street_address: '',
      city: '',
      state: '',
      zip_code: '',
      property_type: 'residential' as const,
      property_size: '',
      lot_size: '',
      year_built: ''
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
        notes: data.notes || '',
        // Address fields
        street_address: data.street_address || '',
        city: data.city || '',
        state: data.state || '',
        zip_code: data.zip_code || '',
        property_type: data.property_type || 'residential',
        property_size: data.property_size || '',
        lot_size: data.lot_size || '',
        year_built: data.year_built ? data.year_built.toString() : ''
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
        // Address fields
        street_address: values.street_address || null,
        city: values.city || null,
        state: values.state || null,
        zip_code: values.zip_code || null,
        property_type: values.property_type || null,
        property_size: values.property_size || null,
        lot_size: values.lot_size || null,
        year_built: values.year_built ? parseInt(values.year_built) : null,
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

                  {/* Property Address Information */}
                  <div className="col-12 mb-5 mt-5">
                    <h6 className="text-gray-700 fw-bold mb-3">
                      <i className="ki-duotone ki-geolocation fs-2 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Property Address
                    </h6>
                    <div className="form-text mb-3">
                      Update the property location information for accurate site visits and estimates.
                    </div>
                  </div>

                  <div className="col-12 mb-7">
                    <label className="fw-semibold fs-6 mb-2">Street Address</label>
                    <input
                      type="text"
                      className={clsx('form-control form-control-solid', {
                        'is-invalid': formik.touched.street_address && formik.errors.street_address
                      })}
                      placeholder="123 Main Street"
                      {...formik.getFieldProps('street_address')}
                    />
                    {formik.touched.street_address && formik.errors.street_address && (
                      <div className="fv-plugins-message-container">
                        <span role="alert">{formik.errors.street_address}</span>
                      </div>
                    )}
                  </div>

                  <div className="col-md-4 mb-7">
                    <label className="fw-semibold fs-6 mb-2">City</label>
                    <input
                      type="text"
                      className={clsx('form-control form-control-solid', {
                        'is-invalid': formik.touched.city && formik.errors.city
                      })}
                      placeholder="City"
                      {...formik.getFieldProps('city')}
                    />
                    {formik.touched.city && formik.errors.city && (
                      <div className="fv-plugins-message-container">
                        <span role="alert">{formik.errors.city}</span>
                      </div>
                    )}
                  </div>

                  <div className="col-md-4 mb-7">
                    <label className="fw-semibold fs-6 mb-2">State</label>
                    <input
                      type="text"
                      className={clsx('form-control form-control-solid', {
                        'is-invalid': formik.touched.state && formik.errors.state
                      })}
                      placeholder="State"
                      {...formik.getFieldProps('state')}
                    />
                    {formik.touched.state && formik.errors.state && (
                      <div className="fv-plugins-message-container">
                        <span role="alert">{formik.errors.state}</span>
                      </div>
                    )}
                  </div>

                  <div className="col-md-4 mb-7">
                    <label className="fw-semibold fs-6 mb-2">ZIP Code</label>
                    <input
                      type="text"
                      className={clsx('form-control form-control-solid', {
                        'is-invalid': formik.touched.zip_code && formik.errors.zip_code
                      })}
                      placeholder="12345"
                      {...formik.getFieldProps('zip_code')}
                    />
                    {formik.touched.zip_code && formik.errors.zip_code && (
                      <div className="fv-plugins-message-container">
                        <span role="alert">{formik.errors.zip_code}</span>
                      </div>
                    )}
                  </div>

                  <div className="col-md-6 mb-7">
                    <label className="fw-semibold fs-6 mb-2">Property Type</label>
                    <select
                      className={clsx('form-select form-select-solid', {
                        'is-invalid': formik.touched.property_type && formik.errors.property_type
                      })}
                      {...formik.getFieldProps('property_type')}
                    >
                      <option value="residential">Residential</option>
                      <option value="commercial">Commercial</option>
                      <option value="industrial">Industrial</option>
                      <option value="other">Other</option>
                    </select>
                    {formik.touched.property_type && formik.errors.property_type && (
                      <div className="fv-plugins-message-container">
                        <span role="alert">{formik.errors.property_type}</span>
                      </div>
                    )}
                  </div>

                  <div className="col-md-6 mb-7">
                    <label className="fw-semibold fs-6 mb-2">Year Built (Optional)</label>
                    <input
                      type="number"
                      className={clsx('form-control form-control-solid', {
                        'is-invalid': formik.touched.year_built && formik.errors.year_built
                      })}
                      placeholder="2020"
                      min="1800"
                      max={new Date().getFullYear() + 5}
                      {...formik.getFieldProps('year_built')}
                    />
                    {formik.touched.year_built && formik.errors.year_built && (
                      <div className="fv-plugins-message-container">
                        <span role="alert">{formik.errors.year_built}</span>
                      </div>
                    )}
                  </div>

                  <div className="col-md-6 mb-7">
                    <label className="fw-semibold fs-6 mb-2">Property Size (Optional)</label>
                    <input
                      type="text"
                      className="form-control form-control-solid"
                      placeholder="e.g., 2,500 sq ft, 3 bed/2 bath"
                      {...formik.getFieldProps('property_size')}
                    />
                    <div className="form-text">Square footage, rooms, or other size details</div>
                  </div>

                  <div className="col-md-6 mb-7">
                    <label className="fw-semibold fs-6 mb-2">Lot Size (Optional)</label>
                    <input
                      type="text"
                      className="form-control form-control-solid"
                      placeholder="e.g., 0.25 acres, 50x100 ft"
                      {...formik.getFieldProps('lot_size')}
                    />
                    <div className="form-text">Lot dimensions or acreage</div>
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