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
  caller_type: 'business' | 'individual'
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

const inquirySchema = Yup.object().shape({
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

export const NewInquiryModal: React.FC<NewInquiryModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess 
}) => {
  const { userProfile } = useSupabaseAuth()
  const [loading, setLoading] = useState(false)

  // Helper functions for dynamic labels
  const getCallerLabel = (callerType: string) => {
    return callerType === 'business' ? 'Client Name (Business/Company)' : 'Customer Name (Individual)'
  }

  const getCallerPlaceholder = (callerType: string) => {
    return callerType === 'business' ? 'Enter business/company name' : 'Enter customer name'
  }

  const getModalTitle = (callerType: string) => {
    return callerType === 'business' ? 'New Client Inquiry' : 'New Customer Inquiry'
  }

  const formik = useFormik({
    initialValues: {
      caller_name: '',
      caller_type: 'individual', // 'business' for clients, 'individual' for customers
      phone_number: '',
      email: '',
      lead_source: '',
      initial_request: '',
      urgency: 'medium',
      estimated_value: '',
      follow_up_date: '',
      notes: '',
      // Address fields
      street_address: '',
      city: '',
      state: '',
      zip_code: '',
      property_type: 'residential',
      property_size: '',
      lot_size: '',
      year_built: ''
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
        caller_type: values.caller_type, // 'business' for clients, 'individual' for customers
        phone_number: values.phone_number,
        email: values.email || null,
        lead_source: values.lead_source,
        initial_request: values.initial_request,
        status: 'new' as const,
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
        additional_property_info: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      console.log('Attempting to create lead with data:', leadData)

      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .insert(leadData)
        .select()
        .single()
      
      console.log('Lead creation result:', { lead, leadError })

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

      // 2. Create Contact or Account based on caller type
      let contactId = null
      let accountId = null

      console.log('Starting contact/account creation for caller_type:', values.caller_type)

      if (values.caller_type === 'individual') {
        // Create Contact for residential customers
        const contactData = {
          tenant_id: userProfile.tenant_id,
          first_name: values.caller_name.split(' ')[0] || values.caller_name,
          last_name: values.caller_name.split(' ').slice(1).join(' ') || '',
          name: values.caller_name, // Adding full name field
          email: values.email || null,
          phone: values.phone_number,
          // lead_id: lead.id, // Remove - field doesn't exist in contacts table
          // contact_type: 'individual', // Remove - field doesn't exist
          address_line1: values.street_address || null, // Changed from address
          city: values.city || null,
          state: values.state || null,
          zip_code: values.zip_code || null, // Changed from zip
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        console.log('Creating contact with data:', contactData)

        const { data: contact, error: contactError } = await supabase
          .from('contacts')
          .insert(contactData)
          .select()
          .single()

        console.log('Contact creation result:', { contact, contactError })

        if (contactError) {
          console.error('Error creating contact:', contactError)
          console.error('Contact data that failed:', contactData)
          throw new Error(`Failed to create contact record: ${contactError.message}`)
        }

        contactId = contact.id

        // Update lead with contact reference
        console.log('Updating lead with converted_contact_id:', contactId)
        const { error: updateContactError } = await supabase
          .from('leads')
          .update({ converted_contact_id: contactId })
          .eq('id', lead.id)
        
        if (updateContactError) {
          console.error('Error updating lead with contact reference:', updateContactError)
          // Don't throw - this is a nice-to-have link
        }

      } else {
        // Create Account for business clients
        const accountData = {
          tenant_id: userProfile.tenant_id,
          name: values.caller_name,
          type: 'customer', // Changed from account_type
          email: values.email || null,
          phone: values.phone_number,
          billing_address: values.street_address || null,
          city: values.city || null, // Changed from billing_city
          state: values.state || null, // Changed from billing_state
          zip_code: values.zip_code || null, // Changed from billing_zip
          created_at: new Date().toISOString()
          // updated_at field doesn't exist in accounts table
        }
        
        console.log('Creating account with data:', accountData)

        const { data: account, error: accountError } = await supabase
          .from('accounts')
          .insert(accountData)
          .select()
          .single()

        console.log('Account creation result:', { account, accountError })

        if (accountError) {
          console.error('Error creating account:', accountError)
          console.error('Account data that failed:', accountData)
          throw new Error(`Failed to create account record: ${accountError.message}`)
        }

        accountId = account.id

        // Update lead with account reference
        console.log('Updating lead with converted_account_id:', accountId)
        const { error: updateAccountError } = await supabase
          .from('leads')
          .update({ converted_account_id: accountId })
          .eq('id', lead.id)
        
        if (updateAccountError) {
          console.error('Error updating lead with account reference:', updateAccountError)
          // Don't throw - this is a nice-to-have link
        }

        // Also create a primary contact for the business
        const primaryContactData = {
          tenant_id: userProfile.tenant_id,
          account_id: accountId,
          name: values.caller_name, // Adding full name field
          first_name: values.caller_name.split(' ')[0] || values.caller_name,
          last_name: values.caller_name.split(' ').slice(1).join(' ') || '',
          email: values.email || null,
          phone: values.phone_number,
          is_primary: true,
          // contact_type: 'business', // Remove - field doesn't exist
          // lead_id: lead.id, // Remove - field doesn't exist
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        console.log('Creating primary contact with data:', primaryContactData)

        const { data: primaryContact, error: primaryContactError } = await supabase
          .from('contacts')
          .insert(primaryContactData)
          .select()
          .single()

        console.log('Primary contact creation result:', { primaryContact, primaryContactError })

        if (primaryContactError) {
          console.error('Error creating primary contact:', primaryContactError)
          console.error('Primary contact data that failed:', primaryContactData)
          // Don't throw - primary contact is helpful but not critical
        } else {
          contactId = primaryContact.id
        }
      }

      // 3. Create Call Record
      const callData = {
        tenant_id: userProfile.tenant_id,
        contact_id: contactId,
        from_number: values.phone_number,
        to_number: 'Main Line', // or get from tenant settings
        direction: 'inbound',
        status: 'completed',
        duration: 300, // Default 5 minutes
        user_id: userProfile.id,
        created_at: new Date().toISOString(),
        answered_at: new Date().toISOString(),
        ended_at: new Date(Date.now() + 300000).toISOString() // 5 minutes later
      }

      const { error: callError } = await supabase
        .from('calls')
        .insert(callData)

      if (callError) {
        console.error('Error creating call record:', callError)
        // Don't throw - call record is supplementary
      }

      // 4. Create Activity Log Entry
      const activityData = {
        tenant_id: userProfile.tenant_id,
        entity_type: 'lead',
        entity_id: lead.id,
        activity_type: 'lead_created',
        description: `New ${values.caller_type === 'business' ? 'business' : 'residential'} lead created: ${values.caller_name}`,
        metadata: {
          lead_source: values.lead_source,
          urgency: values.urgency,
          contact_id: contactId,
          account_id: accountId
        },
        user_id: userProfile.id,
        created_at: new Date().toISOString()
      }

      const { error: activityError } = await supabase
        .from('activity_logs')
        .insert(activityData)

      if (activityError) {
        console.error('Error creating activity log:', activityError)
        // Don't throw - activity log is supplementary
      }

      // 5. Schedule Follow-up if specified
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
{getModalTitle(formik.values.caller_type)}
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
                  <label className="required fw-semibold fs-6 mb-2">Caller Type</label>
                  <select
                    className={clsx('form-select form-select-solid', {
                      'is-invalid': formik.touched.caller_type && formik.errors.caller_type
                    })}
                    {...formik.getFieldProps('caller_type')}
                  >
                    <option value="individual">Customer (Individual)</option>
                    <option value="business">Client (Business/Company)</option>
                  </select>
                  {formik.touched.caller_type && formik.errors.caller_type && (
                    <div className="fv-plugins-message-container">
                      <span role="alert">{formik.errors.caller_type}</span>
                    </div>
                  )}
                </div>

                <div className="col-md-6 mb-7">
                  <label className="required fw-semibold fs-6 mb-2">{getCallerLabel(formik.values.caller_type)}</label>
                  <input
                    type="text"
                    className={clsx('form-control form-control-solid', {
                      'is-invalid': formik.touched.caller_name && formik.errors.caller_name
                    })}
                    placeholder={getCallerPlaceholder(formik.values.caller_type)}
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
                    Where is the work needed? This helps us schedule site visits and provide accurate estimates.
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