import React, { useState, useEffect } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import clsx from 'clsx'
import { Job, Account, Contact } from '../../../../supabaseClient'
import JobCostingDashboard from '../../../components/billing/JobCostingDashboard'
import JobPhotoGallery from '../../../components/shared/JobPhotoGallery'
import { AddressInput } from '../../../components/shared/AddressInput'
import { FormattedAddress } from '../../../utils/addressUtils'
import { useSupabaseAuth } from '../../../modules/auth/core/SupabaseAuth'
import { supabase } from '../../../../supabaseClient'

interface ClientCustomer {
  id: string
  name: string
  type: 'business' | 'individual'
}

interface JobFormProps {
  job?: Job | null
  accounts: Pick<Account, 'id' | 'name'>[]
  contacts: Pick<Contact, 'id' | 'first_name' | 'last_name' | 'account_id'>[]
  onSave: (data: Partial<Job>) => void
  onCancel: () => void
}

const jobSchema = Yup.object().shape({
  title: Yup.string()
    .min(2, 'Minimum 2 characters')
    .max(200, 'Maximum 200 characters')
    .required('Job title is required'),
  clientCustomerId: Yup.string().required('Client/Customer selection is required'),
  clientCustomerName: Yup.string().required('Client/Customer name is required'),
  account_id: Yup.string(), // Optional now
  contact_id: Yup.string(), // Optional now
  description: Yup.string().max(2000, 'Maximum 2000 characters'),
  status: Yup.string().required('Status is required'),
  priority: Yup.string().required('Priority is required'),
  start_date: Yup.date(),
  due_date: Yup.date(),
  estimated_hours: Yup.number().min(0, 'Must be positive').max(9999, 'Maximum 9999 hours'),
  actual_hours: Yup.number().min(0, 'Must be positive').max(9999, 'Maximum 9999 hours'),
  estimated_cost: Yup.number().min(0, 'Must be positive').max(999999, 'Maximum $999,999'),
  actual_cost: Yup.number().min(0, 'Must be positive').max(999999, 'Maximum $999,999'),
  location_address: Yup.string().max(200, 'Maximum 200 characters'),
  location_city: Yup.string().max(100, 'Maximum 100 characters'),
  location_state: Yup.string().max(50, 'Maximum 50 characters'),
  location_zip: Yup.string().max(20, 'Maximum 20 characters'),
  notes: Yup.string().max(2000, 'Maximum 2000 characters'),
})

export const JobForm: React.FC<JobFormProps> = ({ job, accounts, contacts, onSave, onCancel }) => {
  const { userProfile } = useSupabaseAuth()
  const [loading, setLoading] = useState(false)
  const [filteredContacts, setFilteredContacts] = useState<typeof contacts>([])
  const [activeTab, setActiveTab] = useState('details')
  const [allClientCustomers, setAllClientCustomers] = useState<ClientCustomer[]>([])
  const [selectedClientType, setSelectedClientType] = useState<'business' | 'individual' | null>(null)

  const formik = useFormik({
    initialValues: {
      title: job?.title || '',
      clientCustomerId: job?.account_id || job?.contact_id || '',
      clientCustomerName: '', // Will be set when component loads
      account_id: job?.account_id || '',
      contact_id: job?.contact_id || '',
      description: job?.description || '',
      status: job?.status || 'draft',
      priority: job?.priority || 'medium',
      start_date: job?.start_date ? job.start_date.split('T')[0] : '',
      due_date: job?.due_date ? job.due_date.split('T')[0] : '',
      estimated_hours: job?.estimated_hours || '',
      actual_hours: job?.actual_hours || '',
      estimated_cost: job?.estimated_cost || '',
      actual_cost: job?.actual_cost || '',
      location_address: job?.location_address || '',
      location_city: job?.location_city || '',
      location_state: job?.location_state || '',
      location_zip: job?.location_zip || '',
      notes: job?.notes || '',
    },
    validationSchema: jobSchema,
    onSubmit: async (values) => {
      setLoading(true)
      try {
        // Determine if this is a business client (account) or individual customer (contact)
        const selectedClient = allClientCustomers.find(c => c.id === values.clientCustomerId)
        const isIndividualCustomer = selectedClient?.type === 'individual'
        
        const submitData = {
          title: values.title,
          account_id: isIndividualCustomer ? undefined : values.clientCustomerId,
          contact_id: isIndividualCustomer ? values.clientCustomerId : undefined,
          description: values.description || undefined,
          status: values.status,
          priority: values.priority,
          start_date: values.start_date || undefined,
          due_date: values.due_date || undefined,
          estimated_hours: values.estimated_hours ? Number(values.estimated_hours) : undefined,
          actual_hours: values.actual_hours ? Number(values.actual_hours) : undefined,
          estimated_cost: values.estimated_cost ? Number(values.estimated_cost) : undefined,
          actual_cost: values.actual_cost ? Number(values.actual_cost) : undefined,
          location_address: values.location_address || undefined,
          location_city: values.location_city || undefined,
          location_state: values.location_state || undefined,
          location_zip: values.location_zip || undefined,
          notes: values.notes || undefined,
        }
        
        console.log('Submitting job data:', submitData)
        console.log('Selected client:', selectedClient)
        console.log('Is individual customer:', isIndividualCustomer)
        
        await onSave(submitData)
      } catch (error) {
        console.error('Error saving job:', error)
        // Show user-friendly error message
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
        alert(`Failed to save job: ${errorMessage}`)
      } finally {
        setLoading(false)
      }
    },
  })

  // Load combined client/customer list on component mount
  useEffect(() => {
    if (userProfile?.tenant_id) {
      loadClientCustomers()
    }
  }, [userProfile?.tenant_id])

  // Set initial client/customer name for existing jobs
  useEffect(() => {
    if (job && allClientCustomers.length > 0) {
      const selectedClient = allClientCustomers.find(c => c.id === formik.values.clientCustomerId)
      if (selectedClient) {
        formik.setFieldValue('clientCustomerName', selectedClient.name)
        setSelectedClientType(selectedClient.type)
      }
    }
  }, [job, allClientCustomers])

  // Update client fields when job prop changes (after save)
  useEffect(() => {
    if (job && allClientCustomers.length > 0) {
      const newClientId = job.account_id || job.contact_id
      if (newClientId && newClientId !== formik.values.clientCustomerId) {
        const selectedClient = allClientCustomers.find(c => c.id === newClientId)
        if (selectedClient) {
          formik.setFieldValue('clientCustomerId', newClientId)
          formik.setFieldValue('clientCustomerName', selectedClient.name)
          formik.setFieldValue('account_id', job.account_id || '')
          formik.setFieldValue('contact_id', job.contact_id || '')
          setSelectedClientType(selectedClient.type)
        }
      }
    }
  }, [job?.account_id, job?.contact_id, allClientCustomers])

  const loadClientCustomers = async () => {
    try {
      // Load business accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select('id, name, type')
        .eq('tenant_id', userProfile?.tenant_id)
        .order('name')

      if (accountsError) throw accountsError

      // Load individual customers (contacts without accounts)
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, contact_type')
        .eq('tenant_id', userProfile?.tenant_id)
        .eq('contact_type', 'individual')
        .is('account_id', null)
        .order('last_name')

      if (contactsError) throw contactsError

      // Combine accounts and individual customers
      const businessClients = (accountsData || []).map(account => ({
        id: account.id,
        name: account.name,
        type: 'business' as const
      }))

      const individualCustomers = (contactsData || []).map(contact => ({
        id: contact.id,
        name: `${contact.first_name} ${contact.last_name}`.trim(),
        type: 'individual' as const
      }))

      const combined = [...businessClients, ...individualCustomers]
      setAllClientCustomers(combined)
    } catch (error) {
      console.error('Error loading clients and customers:', error)
    }
  }

  const handleClientCustomerChange = (clientCustomerId: string) => {
    const selectedClient = allClientCustomers.find(c => c.id === clientCustomerId)
    if (selectedClient) {
      formik.setFieldValue('clientCustomerId', clientCustomerId)
      formik.setFieldValue('clientCustomerName', selectedClient.name)
      setSelectedClientType(selectedClient.type)
      
      // Set appropriate account_id or contact_id based on type
      if (selectedClient.type === 'business') {
        formik.setFieldValue('account_id', clientCustomerId)
        formik.setFieldValue('contact_id', '')
      } else {
        formik.setFieldValue('account_id', '')
        formik.setFieldValue('contact_id', clientCustomerId)
      }
    }
  }

  // Helper function to get appropriate label
  const getClientCustomerLabel = () => {
    if (selectedClientType === 'individual') return 'Customer'
    if (selectedClientType === 'business') return 'Client' 
    return 'Client/Customer'
  }

  const getClientCustomerPlaceholder = () => {
    if (selectedClientType === 'individual') return 'Select a customer...'
    if (selectedClientType === 'business') return 'Select a client...'
    return 'Select a client or customer...'
  }

  const handleLocationAddressChange = (address: FormattedAddress) => {
    formik.setFieldValue('location_address', address.street_address)
    formik.setFieldValue('location_city', address.city)
    formik.setFieldValue('location_state', address.state)
    formik.setFieldValue('location_zip', address.zip)
  }

  return (
    <div className='modal fade show d-block' tabIndex={-1} role='dialog'>
      <div className='modal-dialog modal-dialog-centered modal-xl' role='document'>
        <div className='modal-content'>
          <div className='modal-header'>
            <h5 className='modal-title'>
              {job ? 'Edit Job' : 'Create New Job'}
            </h5>
            <button
              type='button'
              className='btn-close'
              onClick={onCancel}
              aria-label='Close'
            ></button>
          </div>

          <form onSubmit={formik.handleSubmit} noValidate>
            <div className='modal-body'>
              {/* Tab Navigation */}
              <ul className='nav nav-tabs nav-line-tabs nav-line-tabs-2x border-0 fs-4 fw-semibold mb-6'>
                <li className='nav-item'>
                  <a
                    className={`nav-link text-active-primary pb-4 ${activeTab === 'details' ? 'active' : ''}`}
                    href='#'
                    onClick={(e) => {
                      e.preventDefault()
                      setActiveTab('details')
                    }}
                  >
                    Job Details
                  </a>
                </li>
                {job?.id && (
                  <>
                    <li className='nav-item'>
                      <a
                        className={`nav-link text-active-primary pb-4 ${activeTab === 'costing' ? 'active' : ''}`}
                        href='#'
                        onClick={(e) => {
                          e.preventDefault()
                          setActiveTab('costing')
                        }}
                      >
                        Job Costing
                      </a>
                    </li>
                    <li className='nav-item'>
                      <a
                        className={`nav-link text-active-primary pb-4 ${activeTab === 'photos' ? 'active' : ''}`}
                        href='#'
                        onClick={(e) => {
                          e.preventDefault()
                          setActiveTab('photos')
                        }}
                      >
                        Photos
                      </a>
                    </li>
                  </>
                )}
              </ul>

              {/* Tab Content */}
              {activeTab === 'details' && (
              <div className='row'>
                {/* Job Title */}
                <div className='col-md-8 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>Job Title</label>
                  <input
                    type='text'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.title && formik.errors.title},
                      {'is-valid': formik.touched.title && !formik.errors.title}
                    )}
                    placeholder='Enter job title'
                    {...formik.getFieldProps('title')}
                  />
                  {formik.touched.title && formik.errors.title && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.title}</span>
                    </div>
                  )}
                </div>

                {/* Priority */}
                <div className='col-md-4 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>Priority</label>
                  <select
                    className={clsx(
                      'form-select form-select-solid',
                      {'is-invalid': formik.touched.priority && formik.errors.priority},
                      {'is-valid': formik.touched.priority && !formik.errors.priority}
                    )}
                    {...formik.getFieldProps('priority')}
                  >
                    <option value='low'>Low</option>
                    <option value='medium'>Medium</option>
                    <option value='high'>High</option>
                    <option value='urgent'>Urgent</option>
                  </select>
                  {formik.touched.priority && formik.errors.priority && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.priority}</span>
                    </div>
                  )}
                </div>

                {/* Client/Customer Selection */}
                <div className='col-md-12 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>{getClientCustomerLabel()}</label>
                  <select
                    className={clsx(
                      'form-select form-select-solid',
                      {'is-invalid': formik.touched.clientCustomerId && formik.errors.clientCustomerId},
                      {'is-valid': formik.touched.clientCustomerId && !formik.errors.clientCustomerId}
                    )}
                    value={formik.values.clientCustomerId}
                    onChange={(e) => handleClientCustomerChange(e.target.value)}
                    onBlur={formik.handleBlur}
                    name="clientCustomerId"
                  >
                    <option value=''>{getClientCustomerPlaceholder()}</option>
                    {allClientCustomers.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.name} {client.type === 'business' ? '(Client)' : '(Customer)'}
                      </option>
                    ))}
                  </select>
                  {formik.touched.clientCustomerId && formik.errors.clientCustomerId && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.clientCustomerId}</span>
                    </div>
                  )}
                  {allClientCustomers.length === 0 && (
                    <div className='form-text text-muted'>
                      No clients or customers found. Please create clients/customers in the Contacts section first.
                    </div>
                  )}
                </div>

                {/* Status */}
                <div className='col-md-4 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>Status</label>
                  <select
                    className={clsx(
                      'form-select form-select-solid',
                      {'is-invalid': formik.touched.status && formik.errors.status},
                      {'is-valid': formik.touched.status && !formik.errors.status}
                    )}
                    {...formik.getFieldProps('status')}
                  >
                    <option value='draft'>Draft</option>
                    <option value='scheduled'>Scheduled</option>
                    <option value='in_progress'>In Progress</option>
                    <option value='completed'>Completed</option>
                    <option value='on_hold'>On Hold</option>
                    <option value='cancelled'>Cancelled</option>
                  </select>
                  {formik.touched.status && formik.errors.status && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.status}</span>
                    </div>
                  )}
                </div>

                {/* Start Date */}
                <div className='col-md-4 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Start Date</label>
                  <input
                    type='date'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.start_date && formik.errors.start_date},
                      {'is-valid': formik.touched.start_date && !formik.errors.start_date}
                    )}
                    {...formik.getFieldProps('start_date')}
                  />
                  {formik.touched.start_date && formik.errors.start_date && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.start_date}</span>
                    </div>
                  )}
                </div>

                {/* Due Date */}
                <div className='col-md-4 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Due Date</label>
                  <input
                    type='date'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.due_date && formik.errors.due_date},
                      {'is-valid': formik.touched.due_date && !formik.errors.due_date}
                    )}
                    {...formik.getFieldProps('due_date')}
                  />
                  {formik.touched.due_date && formik.errors.due_date && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.due_date}</span>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div className='col-md-12 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Description</label>
                  <textarea
                    className={clsx(
                      'form-control form-control-solid',
                      {'is-invalid': formik.touched.description && formik.errors.description},
                      {'is-valid': formik.touched.description && !formik.errors.description}
                    )}
                    rows={4}
                    placeholder='Enter job description'
                    {...formik.getFieldProps('description')}
                  />
                  {formik.touched.description && formik.errors.description && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.description}</span>
                    </div>
                  )}
                </div>

                {/* Estimated Hours */}
                <div className='col-md-3 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Estimated Hours</label>
                  <input
                    type='number'
                    step='0.5'
                    min='0'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.estimated_hours && formik.errors.estimated_hours},
                      {'is-valid': formik.touched.estimated_hours && !formik.errors.estimated_hours}
                    )}
                    placeholder='0.0'
                    {...formik.getFieldProps('estimated_hours')}
                  />
                  {formik.touched.estimated_hours && formik.errors.estimated_hours && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.estimated_hours}</span>
                    </div>
                  )}
                </div>

                {/* Actual Hours */}
                <div className='col-md-3 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Actual Hours</label>
                  <input
                    type='number'
                    step='0.5'
                    min='0'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.actual_hours && formik.errors.actual_hours},
                      {'is-valid': formik.touched.actual_hours && !formik.errors.actual_hours}
                    )}
                    placeholder='0.0'
                    {...formik.getFieldProps('actual_hours')}
                  />
                  {formik.touched.actual_hours && formik.errors.actual_hours && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.actual_hours}</span>
                    </div>
                  )}
                </div>

                {/* Estimated Cost */}
                <div className='col-md-3 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Estimated Cost</label>
                  <input
                    type='number'
                    step='0.01'
                    min='0'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.estimated_cost && formik.errors.estimated_cost},
                      {'is-valid': formik.touched.estimated_cost && !formik.errors.estimated_cost}
                    )}
                    placeholder='0.00'
                    {...formik.getFieldProps('estimated_cost')}
                  />
                  {formik.touched.estimated_cost && formik.errors.estimated_cost && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.estimated_cost}</span>
                    </div>
                  )}
                </div>

                {/* Actual Cost */}
                <div className='col-md-3 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Actual Cost</label>
                  <input
                    type='number'
                    step='0.01'
                    min='0'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.actual_cost && formik.errors.actual_cost},
                      {'is-valid': formik.touched.actual_cost && !formik.errors.actual_cost}
                    )}
                    placeholder='0.00'
                    {...formik.getFieldProps('actual_cost')}
                  />
                  {formik.touched.actual_cost && formik.errors.actual_cost && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.actual_cost}</span>
                    </div>
                  )}
                </div>

                {/* Location Address with Autocomplete */}
                <div className='col-md-12 mb-7'>
                  <AddressInput
                    value={formik.values.location_address}
                    onChange={handleLocationAddressChange}
                    onInputChange={(value) => formik.setFieldValue('location_address', value)}
                    label='Job Location'
                    placeholder='Enter job location address...'
                    error={formik.touched.location_address && formik.errors.location_address ? formik.errors.location_address : undefined}
                  />
                </div>

                {/* Address Details (Auto-populated from autocomplete) */}
                <div className='col-md-5 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>City</label>
                  <input
                    type='text'
                    className='form-control form-control-solid'
                    placeholder='City (auto-filled)'
                    value={formik.values.location_city}
                    onChange={(e) => formik.setFieldValue('location_city', e.target.value)}
                    readOnly={false}
                  />
                </div>

                <div className='col-md-4 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>State</label>
                  <input
                    type='text'
                    className='form-control form-control-solid'
                    placeholder='State (auto-filled)'
                    value={formik.values.location_state}
                    onChange={(e) => formik.setFieldValue('location_state', e.target.value)}
                    readOnly={false}
                  />
                </div>

                <div className='col-md-3 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>ZIP Code</label>
                  <input
                    type='text'
                    className='form-control form-control-solid'
                    placeholder='ZIP (auto-filled)'
                    value={formik.values.location_zip}
                    onChange={(e) => formik.setFieldValue('location_zip', e.target.value)}
                    readOnly={false}
                  />
                </div>

                {/* Notes */}
                <div className='col-md-12 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Notes</label>
                  <textarea
                    className={clsx(
                      'form-control form-control-solid',
                      {'is-invalid': formik.touched.notes && formik.errors.notes},
                      {'is-valid': formik.touched.notes && !formik.errors.notes}
                    )}
                    rows={4}
                    placeholder='Enter additional notes'
                    {...formik.getFieldProps('notes')}
                  />
                  {formik.touched.notes && formik.errors.notes && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.notes}</span>
                    </div>
                  )}
                </div>
              </div>
              )}

              {/* Job Costing Tab */}
              {activeTab === 'costing' && job?.id && (
                <div className="h-400px overflow-auto">
                  <JobCostingDashboard jobId={job.id} />
                </div>
              )}

              {/* Photos Tab */}
              {activeTab === 'photos' && job?.id && (
                <div className="h-400px overflow-auto">
                  <JobPhotoGallery 
                    jobId={job.id} 
                    showTitle={false}
                    photoTypes={['job_progress', 'before', 'after', 'general', 'receipt']}
                    allowCapture={true}
                    compactView={false}
                  />
                </div>
              )}
            </div>

            <div className='modal-footer'>
              <button
                type='button'
                className='btn btn-light'
                onClick={onCancel}
                disabled={loading}
              >
                {activeTab === 'details' ? 'Cancel' : 'Close'}
              </button>
              {activeTab === 'details' && (
                <button
                  type='submit'
                  className='btn btn-primary'
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className='spinner-border spinner-border-sm align-middle me-2'></span>
                      Saving...
                    </>
                  ) : (
                    <>Save Job</>
                  )}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
