import React, { useState, useEffect } from 'react'
import { useFormik, FieldArray, FormikProvider, useFormikContext } from 'formik'
import * as Yup from 'yup'
import clsx from 'clsx'
import { EstimateWithAccount, LineItem } from '../../../services/estimatesService'
import PhotoCapture from '../../../components/shared/PhotoCapture'
import { LineItemUploader } from '../../../components/estimates/LineItemUploader'
import { supabase } from '../../../../supabaseClient'
import { useSupabaseAuth } from '../../../modules/auth/core/SupabaseAuth'
import { showToast } from '../../../utils/toast'

// LineItem interface is now imported from estimatesService

interface EstimatePhoto {
  id: string
  file_url: string
  description: string
  photo_type: 'general' | 'reference' | 'before' | 'after'
  taken_at: string
}

interface Account {
  id: string
  name: string
  type: 'business' | 'residential'
}

interface EstimateFormValues {
  clientCustomer: string // Display name for client/customer
  accountId: string
  jobId: string // Changed from projectTitle to jobId
  projectTitle: string // Auto-filled from selected job
  description: string
  status: string
  lineItems: LineItem[]
  totalAmount: number
  validUntil: string
  notes: string
}

interface Job {
  id: string
  title: string
  job_number?: string
  account_id: string | null
  contact_id: string | null
  accounts?: { name: string } | null
  contacts?: { first_name: string; last_name: string } | null
  status: string
}

interface EstimateFormProps {
  estimate?: EstimateWithAccount | null
  onSave: (data: any) => void
  onCancel: () => void
  jobId?: string // Optional job ID to filter photos for job-specific estimates
  accountId?: string // Optional account ID to filter photos for account-level estimates
}

const lineItemSchema = Yup.object().shape({
  description: Yup.string()
    .min(2, 'Minimum 2 characters')
    .max(200, 'Maximum 200 characters')
    .required('Description is required'),
  quantity: Yup.number()
    .min(0.01, 'Quantity must be greater than 0')
    .max(9999, 'Maximum 9999')
    .required('Quantity is required'),
  unit_price: Yup.number()
    .min(0, 'Price must be positive')
    .max(999999, 'Maximum $999,999')
    .required('Unit price is required'),
})

const estimateSchema = Yup.object().shape({
  clientCustomer: Yup.string()
    .min(2, 'Minimum 2 characters')
    .max(100, 'Maximum 100 characters')
    .required('Client/Customer name is required'),
  accountId: Yup.string()
    .required('Client/Customer selection is required'),
  jobId: Yup.string()
    .required('Job selection is required'),
  projectTitle: Yup.string()
    .min(2, 'Minimum 2 characters')
    .max(200, 'Maximum 200 characters')
    .required('Project title is required'),
  description: Yup.string()
    .max(1000, 'Maximum 1000 characters')
    .required('Description is required'),
  status: Yup.string()
    .oneOf(['draft', 'sent', 'approved', 'rejected', 'expired'])
    .required('Status is required'),
  lineItems: Yup.array()
    .of(lineItemSchema)
    .min(1, 'At least one line item is required'),
  totalAmount: Yup.number()
    .min(0, 'Amount must be positive'),
  validUntil: Yup.date()
    .min(new Date(new Date().setHours(0, 0, 0, 0)), 'Valid until date cannot be in the past')
    .required('Valid until date is required'),
  notes: Yup.string().max(1000, 'Maximum 1000 characters'),
})

// Component to handle auto-calculation
const TotalCalculator: React.FC = () => {
  const { values, setFieldValue } = useFormikContext<EstimateFormValues>()

  useEffect(() => {
    const total = values.lineItems.reduce((sum, item) => {
      return sum + (item.quantity * item.unit_price)
    }, 0)
    setFieldValue('totalAmount', total)
  }, [values.lineItems, setFieldValue])

  return null
}

export const EstimateForm: React.FC<EstimateFormProps> = ({ estimate, onSave, onCancel, jobId, accountId }) => {
  const { userProfile } = useSupabaseAuth()
  const [loading, setLoading] = useState(false)
  const [photos, setPhotos] = useState<EstimatePhoto[]>([])
  const [showPhotoCapture, setShowPhotoCapture] = useState(false)
  const [selectedPhotoType, setSelectedPhotoType] = useState<'general' | 'reference' | 'before' | 'after'>('general')
  const [availablePhotos, setAvailablePhotos] = useState<EstimatePhoto[]>([])
  const [showPhotoLibrary, setShowPhotoLibrary] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccountType, setSelectedAccountType] = useState<'business' | 'residential' | null>(
    estimate ? (estimate.account_id ? 'business' : estimate.contact_id ? 'residential' : null) : null
  )
  const [availableJobs, setAvailableJobs] = useState<Job[]>([])
  
  // Debug: log when availableJobs changes
  useEffect(() => {
    console.log('Available jobs updated:', availableJobs.length, 'jobs', availableJobs)
  }, [availableJobs])
  const [showNewJobForm, setShowNewJobForm] = useState(false)
  const [newJobTitle, setNewJobTitle] = useState('')
  const [creatingJob, setCreatingJob] = useState(false)
  const [showLineItemUploader, setShowLineItemUploader] = useState(false)

  const formik = useFormik<EstimateFormValues>({
    initialValues: {
      clientCustomer: estimate?.accounts?.name || 
                      (estimate?.contacts ? (
                        estimate.contacts.name || 
                        `${estimate.contacts.first_name || ''} ${estimate.contacts.last_name || ''}`.trim()
                      ) : '') || 
                      '',
      accountId: estimate?.account_id || estimate?.contact_id || '',
      jobId: jobId || estimate?.job_id || '', // Use provided jobId, or estimate's job_id, or empty
      projectTitle: estimate?.project_title || '',
      description: estimate?.description || '',
      status: estimate?.status || 'draft',
      lineItems: estimate?.lineItems && estimate.lineItems.length > 0 
        ? estimate.lineItems 
        : [{ description: '', quantity: 1, unit_price: 0 }],
      totalAmount: estimate?.total_amount || 0,
      validUntil: estimate?.valid_until ? estimate.valid_until.split('T')[0] : '',
      notes: estimate?.notes || '',
    },
    validationSchema: estimateSchema,
    onSubmit: async (values) => {
      setLoading(true)
      try {
        // Determine if this is a business client (account) or residential client (contact)
        const selectedAccount = accounts.find(acc => acc.id === values.accountId)
        const isResidentialClient = selectedAccount?.type === 'residential'
        
        const submitData = {
          account_id: isResidentialClient ? null : values.accountId,
          contact_id: isResidentialClient ? values.accountId : null,  // Using accountId which contains the contact ID for residential
          job_id: values.jobId, // Include the selected job ID
          project_title: values.projectTitle,
          description: values.description,
          status: values.status,
          total_amount: values.totalAmount,
          valid_until: values.validUntil,
          notes: values.notes,
          lineItems: values.lineItems,
        }
        await onSave(submitData)
      } catch (error) {
        console.error('Error saving estimate:', error)
      } finally {
        setLoading(false)
      }
    },
  })

  // Load accounts only once when component mounts with tenant_id
  useEffect(() => {
    if (userProfile?.tenant_id) {
      loadAccounts()
    }
  }, [userProfile?.tenant_id])

  // Simple effect to load jobs when we have an estimate
  useEffect(() => {
    if (estimate && userProfile?.tenant_id) {
      // Small delay to ensure component is mounted
      const timer = setTimeout(() => {
        console.log('Auto-loading jobs for estimate:', estimate.estimate_number)
        if (estimate.account_id) {
          loadJobsForAccount(estimate.account_id, 'business')
        } else if (estimate.contact_id) {
          loadJobsForAccount(estimate.contact_id, 'residential')
        }
      }, 100)
      
      return () => clearTimeout(timer)
    }
  }, [estimate?.id, userProfile?.tenant_id])

  // Load job details and photos separately
  useEffect(() => {
    if (userProfile?.tenant_id) {
      if (jobId) {
        loadJobDetails()
      }
      if (jobId || accountId || estimate?.account_id) {
        loadAvailablePhotos()
      }
    }
  }, [userProfile?.tenant_id, jobId, accountId, estimate?.account_id])


  const loadJobDetails = async () => {
    if (!jobId) return
    
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          id,
          account_id,
          contact_id,
          accounts(id, name, type),
          contacts(id, first_name, last_name, contact_type)
        `)
        .eq('id', jobId)
        .single()

      if (error) throw error
      
      if (data) {
        // Handle business account
        if (data.account_id && data.accounts && Array.isArray(data.accounts) && data.accounts.length > 0) {
          formik.setFieldValue('accountId', data.account_id)
          formik.setFieldValue('clientCustomer', data.accounts[0].name || '')
          setSelectedAccountType('business')
        }
        // Handle residential client
        else if (data.contact_id && data.contacts && Array.isArray(data.contacts) && data.contacts.length > 0) {
          formik.setFieldValue('accountId', data.contact_id)
          formik.setFieldValue('clientCustomer', `${data.contacts[0].first_name || ''} ${data.contacts[0].last_name || ''}`.trim())
          setSelectedAccountType('residential')
        }
      }
    } catch (error) {
      console.error('Error loading job details:', error)
    }
  }

  const loadAccounts = async () => {
    try {
      console.log('Loading accounts with userProfile:', userProfile)
      console.log('Tenant ID:', userProfile?.tenant_id)
      
      if (!userProfile?.tenant_id) {
        console.error('No tenant_id found in user profile')
        showToast.error('Unable to load clients. Please ensure you are properly logged in.')
        return
      }

      // Load business clients (accounts table)
      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select('id, name')
        .eq('tenant_id', userProfile.tenant_id)
        .order('name')

      if (accountsError) {
        console.error('Error loading business accounts:', accountsError)
        throw accountsError
      }

      // Load residential clients (contacts table - those without account_id are residential)
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, name')
        .eq('tenant_id', userProfile.tenant_id)
        .is('account_id', null)  // Residential clients don't have an associated business account
        .order('last_name')

      if (contactsError) {
        console.error('Error loading residential contacts:', contactsError)
        throw contactsError
      }

      // Combine business and residential clients
      const businessClients = (accountsData || []).map(account => ({
        id: account.id,
        name: account.name || '',
        type: 'business' as const
      }))

      const residentialClients = (contactsData || []).map(contact => ({
        id: contact.id,
        name: contact.name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unnamed Contact',
        type: 'residential' as const
      }))

      const combined = [...businessClients, ...residentialClients]
      console.log('Accounts loaded:', combined.length, 'total accounts')
      setAccounts(combined)
    } catch (error) {
      console.error('Error loading accounts and customers:', error)
      showToast.error('Failed to load clients. Please refresh and try again.')
      setAccounts([]) // Ensure accounts is set even on error
    }
  }


  const handleClientChange = (accountId: string) => {
    const selectedAccount = accounts.find(acc => acc.id === accountId)
    if (selectedAccount) {
      formik.setFieldValue('accountId', accountId)
      formik.setFieldValue('clientCustomer', selectedAccount.name)
      setSelectedAccountType(selectedAccount.type)
      
      // Clear job selection and load jobs for this client
      formik.setFieldValue('jobId', '')
      formik.setFieldValue('projectTitle', '')
      loadJobsForAccount(accountId, selectedAccount.type)
    }
  }

  const loadJobsForAccount = async (accountId: string, accountType: 'business' | 'residential') => {
    try {
      console.log('Loading jobs for:', { accountId, accountType, tenantId: userProfile?.tenant_id })
      
      let query = supabase
        .from('jobs')
        .select(`
          id,
          title,
          job_number,
          account_id,
          contact_id,
          status
        `)
        .eq('tenant_id', userProfile?.tenant_id)
        .order('created_at', { ascending: false })

      // Filter by client type
      if (accountType === 'business') {
        query = query.eq('account_id', accountId)
      } else {
        // Residential client
        query = query.eq('contact_id', accountId)
      }

      const { data, error } = await query

      if (error) throw error

      console.log('Jobs loaded:', data?.length || 0, 'jobs found')
      console.log('Jobs data:', data)

      setAvailableJobs(data || [])
    } catch (error) {
      console.error('Error loading jobs:', error)
      setAvailableJobs([])
    }
  }

  const handleJobChange = (jobId: string) => {
    const selectedJob = availableJobs.find(job => job.id === jobId)
    if (selectedJob) {
      formik.setFieldValue('jobId', jobId)
      formik.setFieldValue('projectTitle', selectedJob.title)
    }
  }

  const handleCreateNewJob = async () => {
    if (!newJobTitle.trim() || !userProfile?.tenant_id || !formik.values.accountId) return

    setCreatingJob(true)
    try {
      // Determine job data based on client type
      const isResidentialClient = selectedAccountType === 'residential'
      
      const jobData = {
        title: newJobTitle.trim(),
        tenant_id: userProfile.tenant_id,
        account_id: isResidentialClient ? null : formik.values.accountId,
        contact_id: isResidentialClient ? formik.values.accountId : null,
        status: 'Scheduled',
        description: `Job created from estimate for: ${formik.values.clientCustomer}`
      }

      const { data, error } = await supabase
        .from('jobs')
        .insert(jobData)
        .select()
        .single()

      if (error) throw error

      // Add to jobs list and select it
      const newJob: Job = {
        id: data.id,
        title: data.title,
        account_id: data.account_id,
        contact_id: data.contact_id,
        status: data.status,
        accounts: isResidentialClient ? undefined : { name: formik.values.clientCustomer },
        contacts: isResidentialClient ? { first_name: formik.values.clientCustomer.split(' ')[0] || '', last_name: formik.values.clientCustomer.split(' ').slice(1).join(' ') || '' } : undefined
      }
      
      setAvailableJobs(prev => [newJob, ...prev])
      
      // Select the new job
      formik.setFieldValue('jobId', data.id)
      formik.setFieldValue('projectTitle', data.title)
      
      // Reset form
      setNewJobTitle('')
      setShowNewJobForm(false)
      
    } catch (error) {
      console.error('Error creating job:', error)
      alert('Error creating job. Please try again.')
    } finally {
      setCreatingJob(false)
    }
  }

  // Helper function to get appropriate label
  const getClientCustomerLabel = () => {
    if (selectedAccountType === 'residential') return 'Residential Client'
    if (selectedAccountType === 'business') return 'Business Client' 
    return 'Client'
  }

  const getClientCustomerPlaceholder = () => {
    if (selectedAccountType === 'residential') return 'Select a residential client...'
    if (selectedAccountType === 'business') return 'Select a business client...'
    return 'Select a client...'
  }


  const loadAvailablePhotos = async () => {
    try {
      let query = supabase
        .from('job_photos')
        .select(`
          id, 
          file_url, 
          description, 
          photo_type, 
          taken_at,
          job_id,
          jobs!inner(account_id)
        `)
        .eq('tenant_id', userProfile?.tenant_id)

      // Filter by job ID if provided (most specific)
      if (jobId) {
        query = query.eq('job_id', jobId)
      } 
      // Otherwise filter by account ID (less specific but still relevant)
      else if (accountId || estimate?.account_id) {
        const filterAccountId = accountId || estimate?.account_id
        query = query.eq('jobs.account_id', filterAccountId)
      }
      // If no job or account context, don't load any photos
      else {
        setAvailablePhotos([])
        return
      }

      const { data, error } = await query
        .order('taken_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setAvailablePhotos(data || [])
    } catch (error) {
      console.error('Error loading available photos:', error)
      setAvailablePhotos([])
    }
  }

  const handlePhotoCapture = async (photoUrl: string, photoId: string) => {
    try {
      // If we have a jobId, save the photo to the job_photos table
      if (jobId && userProfile?.id) {
        await supabase
          .from('job_photos')
          .insert({
            id: photoId,
            tenant_id: userProfile.tenant_id,
            job_id: jobId,
            photo_type: selectedPhotoType,
            file_path: photoUrl,
            file_url: photoUrl,
            description: '',
            taken_by: userProfile.id
          })
      }

      const newPhoto: EstimatePhoto = {
        id: photoId,
        file_url: photoUrl,
        description: '',
        photo_type: selectedPhotoType,
        taken_at: new Date().toISOString()
      }
      setPhotos(prev => [...prev, newPhoto])
      setShowPhotoCapture(false)
      
      // Refresh available photos to include the new one
      loadAvailablePhotos()
    } catch (error) {
      console.error('Error saving photo:', error)
      // Still add to local state even if save failed
      const newPhoto: EstimatePhoto = {
        id: photoId,
        file_url: photoUrl,
        description: '',
        photo_type: selectedPhotoType,
        taken_at: new Date().toISOString()
      }
      setPhotos(prev => [...prev, newPhoto])
      setShowPhotoCapture(false)
    }
  }

  const addPhotoFromLibrary = (photo: EstimatePhoto) => {
    if (!photos.find(p => p.id === photo.id)) {
      setPhotos(prev => [...prev, photo])
    }
  }

  const removePhoto = (photoId: string) => {
    setPhotos(prev => prev.filter(p => p.id !== photoId))
  }

  const updatePhotoDescription = (photoId: string, description: string) => {
    setPhotos(prev => prev.map(p => 
      p.id === photoId ? { ...p, description } : p
    ))
  }

  const handleLineItemsImport = (importedLineItems: LineItem[]) => {
    // Replace existing line items with imported ones
    formik.setFieldValue('lineItems', importedLineItems)
    setShowLineItemUploader(false)
  }

  return (
    <div className='modal fade show d-block' tabIndex={-1} role='dialog'>
      <div className='modal-dialog modal-dialog-centered modal-xl' role='document'>
        <div className='modal-content'>
          <div className='modal-header'>
            <h5 className='modal-title'>
              {estimate ? 'Edit Estimate' : 'Create New Estimate'}
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
              <div className='row'>
                {/* Client/Customer */}
                <div className='col-md-6 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>{getClientCustomerLabel()}</label>
                  <select
                    className={clsx(
                      'form-select form-select-solid',
                      {'is-invalid': formik.touched.accountId && formik.errors.accountId},
                      {'is-valid': formik.touched.accountId && !formik.errors.accountId}
                    )}
                    value={formik.values.accountId}
                    onChange={(e) => handleClientChange(e.target.value)}
                    onBlur={formik.handleBlur}
                    name="accountId"
                  >
                    <option value=''>{getClientCustomerPlaceholder()}</option>
                    {accounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.name} {account.type === 'business' ? '(Business)' : '(Residential)'}
                      </option>
                    ))}
                  </select>
                  {formik.touched.accountId && formik.errors.accountId && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.accountId}</span>
                    </div>
                  )}
                  {accounts.length === 0 && (
                    <div className='form-text text-muted'>
                      No clients found. Please create business clients in the Accounts section or residential clients in the Contacts section first.
                    </div>
                  )}
                </div>

                {/* Status */}
                <div className='col-md-6 mb-7'>
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
                    <option value='sent'>Sent</option>
                    <option value='approved'>Approved</option>
                    <option value='rejected'>Rejected</option>
                    <option value='expired'>Expired</option>
                  </select>
                  {formik.touched.status && formik.errors.status && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.status}</span>
                    </div>
                  )}
                </div>

                {/* Job Selection */}
                <div className='col-md-12 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>
                    Select Job
                    {estimate && availableJobs.length === 0 && (
                      <button
                        type='button'
                        className='btn btn-link btn-sm ms-2'
                        onClick={() => {
                          console.log('Manual job load triggered')
                          if (estimate.account_id) {
                            loadJobsForAccount(estimate.account_id, 'business')
                          } else if (estimate.contact_id) {
                            loadJobsForAccount(estimate.contact_id, 'residential')
                          }
                        }}
                      >
                        (Load Jobs)
                      </button>
                    )}
                  </label>
                  {!showNewJobForm ? (
                    <div className='d-flex gap-2'>
                      <select
                        className={clsx(
                          'form-select form-select-solid flex-grow-1',
                          {'is-invalid': formik.touched.jobId && formik.errors.jobId},
                          {'is-valid': formik.touched.jobId && !formik.errors.jobId}
                        )}
                        value={formik.values.jobId}
                        onChange={(e) => handleJobChange(e.target.value)}
                        onBlur={formik.handleBlur}
                        name="jobId"
                        disabled={!formik.values.accountId}
                      >
                        <option value=''>
                          {!formik.values.accountId 
                            ? 'Please select a client first' 
                            : availableJobs.length === 0 
                            ? 'No jobs found for this client'
                            : 'Select a job...'}
                        </option>
                        {availableJobs.map(job => (
                          <option key={job.id} value={job.id}>
                            {job.job_number ? `${job.job_number} - ` : ''}{job.title} ({job.status})
                          </option>
                        ))}
                      </select>
                      {formik.values.accountId && (
                        <button
                          type='button'
                          className='btn btn-light-primary btn-sm'
                          onClick={() => setShowNewJobForm(true)}
                          title='Create new job'
                        >
                          <i className='ki-duotone ki-plus fs-3'></i>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className='d-flex flex-column gap-2'>
                      <input
                        type='text'
                        className='form-control form-control-solid'
                        placeholder='Enter job title'
                        value={newJobTitle}
                        onChange={(e) => setNewJobTitle(e.target.value)}
                      />
                      <div className='d-flex gap-2'>
                        <button
                          type='button'
                          className='btn btn-primary btn-sm'
                          onClick={handleCreateNewJob}
                          disabled={!newJobTitle.trim() || creatingJob}
                        >
                          {creatingJob ? (
                            <>
                              <span className='spinner-border spinner-border-sm align-middle me-2'></span>
                              Creating...
                            </>
                          ) : (
                            <>
                              <i className='ki-duotone ki-check fs-3 me-1'></i>
                              Create Job
                            </>
                          )}
                        </button>
                        <button
                          type='button'
                          className='btn btn-light btn-sm'
                          onClick={() => {
                            setShowNewJobForm(false)
                            setNewJobTitle('')
                          }}
                        >
                          <i className='ki-duotone ki-cross fs-3 me-1'></i>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  {formik.touched.jobId && formik.errors.jobId && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.jobId}</span>
                    </div>
                  )}
                  
                  {/* Display selected job title (read-only) */}
                  {formik.values.jobId && formik.values.projectTitle && (
                    <div className='mt-3'>
                      <label className='fw-semibold fs-6 mb-2'>Project Title</label>
                      <input
                        type='text'
                        className='form-control form-control-solid bg-light'
                        value={formik.values.projectTitle}
                        readOnly
                      />
                      <div className='form-text text-muted'>
                        Project title is automatically filled from the selected job
                      </div>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div className='col-md-12 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>Description</label>
                  <textarea
                    className={clsx(
                      'form-control form-control-solid',
                      {'is-invalid': formik.touched.description && formik.errors.description},
                      {'is-valid': formik.touched.description && !formik.errors.description}
                    )}
                    rows={4}
                    placeholder='Enter project description'
                    {...formik.getFieldProps('description')}
                  />
                  {formik.touched.description && formik.errors.description && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.description}</span>
                    </div>
                  )}
                </div>

                {/* Line Items Section */}
                <div className='col-md-12 mb-7'>
                  <FormikProvider value={formik}>
                    <TotalCalculator />
                    <div className='card card-bordered'>
                      <div className='card-header'>
                        <h6 className='card-title'>Line Items</h6>
                        <div className='card-toolbar d-flex gap-2 align-items-center'>
                          <button
                            type='button'
                            className='btn btn-sm btn-light-success'
                            onClick={() => setShowLineItemUploader(true)}
                          >
                            <i className='ki-duotone ki-document-up fs-6 me-1'>
                              <span className='path1'></span>
                              <span className='path2'></span>
                            </i>
                            Import from File
                          </button>
                          <span className='text-muted fs-7'>
                            {formik.values.lineItems.length} item{formik.values.lineItems.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <div className='card-body'>
                        <FieldArray name='lineItems'>
                          {({ push, remove }) => (
                            <div>
                              {formik.values.lineItems.map((item, index) => (
                                <div key={index} className='row align-items-end mb-4 border-bottom pb-4'>
                                  {/* Description */}
                                  <div className='col-md-5'>
                                    <label className='required fw-semibold fs-6 mb-2'>Description</label>
                                    <input
                                      type='text'
                                      className={clsx(
                                        'form-control form-control-solid',
                                        {
                                          'is-invalid': formik.touched.lineItems?.[index]?.description && 
                                                        formik.errors.lineItems?.[index] && 
                                                        typeof formik.errors.lineItems[index] === 'object' && 
                                                        'description' in formik.errors.lineItems[index]
                                        }
                                      )}
                                      placeholder='Enter item description'
                                      {...formik.getFieldProps(`lineItems.${index}.description`)}
                                    />
                                  </div>

                                  {/* Quantity */}
                                  <div className='col-md-2'>
                                    <label className='required fw-semibold fs-6 mb-2'>Qty</label>
                                    <input
                                      type='number'
                                      step='0.01'
                                      min='0'
                                      className={clsx(
                                        'form-control form-control-solid',
                                        {
                                          'is-invalid': formik.touched.lineItems?.[index]?.quantity && 
                                                        formik.errors.lineItems?.[index] && 
                                                        typeof formik.errors.lineItems[index] === 'object' && 
                                                        'quantity' in formik.errors.lineItems[index]
                                        }
                                      )}
                                      placeholder='1'
                                      {...formik.getFieldProps(`lineItems.${index}.quantity`)}
                                    />
                                  </div>

                                  {/* Unit Price */}
                                  <div className='col-md-2'>
                                    <label className='required fw-semibold fs-6 mb-2'>Unit Price</label>
                                    <div className='input-group'>
                                      <span className='input-group-text'>$</span>
                                      <input
                                        type='number'
                                        step='0.01'
                                        min='0'
                                        className={clsx(
                                          'form-control form-control-solid',
                                          {
                                            'is-invalid': formik.touched.lineItems?.[index]?.unit_price && 
                                                          formik.errors.lineItems?.[index] && 
                                                          typeof formik.errors.lineItems[index] === 'object' && 
                                                          'unit_price' in formik.errors.lineItems[index]
                                          }
                                        )}
                                        placeholder='0.00'
                                        {...formik.getFieldProps(`lineItems.${index}.unit_price`)}
                                      />
                                    </div>
                                  </div>

                                  {/* Total */}
                                  <div className='col-md-2'>
                                    <label className='fw-semibold fs-6 mb-2'>Total</label>
                                    <div className='form-control form-control-solid bg-light'>
                                      ${(item.quantity * item.unit_price).toFixed(2)}
                                    </div>
                                  </div>

                                  {/* Remove Button */}
                                  <div className='col-md-1'>
                                    <button
                                      type='button'
                                      className='btn btn-icon btn-bg-light btn-active-color-danger btn-sm'
                                      onClick={() => remove(index)}
                                      disabled={formik.values.lineItems.length === 1}
                                      title='Remove item'
                                    >
                                      <i className='ki-duotone ki-trash fs-3'>
                                        <span className='path1'></span>
                                        <span className='path2'></span>
                                        <span className='path3'></span>
                                        <span className='path4'></span>
                                        <span className='path5'></span>
                                      </i>
                                    </button>
                                  </div>
                                </div>
                              ))}

                              {/* Add Line Item Button */}
                              <div className='d-flex justify-content-center mt-4'>
                                <button
                                  type='button'
                                  className='btn btn-light-primary'
                                  onClick={() => push({ description: '', quantity: 1, unit_price: 0 })}
                                >
                                  <i className='ki-duotone ki-plus fs-2'></i>
                                  Add Line Item
                                </button>
                              </div>
                            </div>
                          )}
                        </FieldArray>

                        {/* Line Items Validation Error */}
                        {formik.touched.lineItems && formik.errors.lineItems && typeof formik.errors.lineItems === 'string' && (
                          <div className='fv-plugins-message-container mt-3'>
                            <span role='alert' className='text-danger'>{formik.errors.lineItems}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </FormikProvider>
                </div>

                {/* Total Amount (Read-only) */}
                <div className='col-md-6 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Total Amount</label>
                  <div className='input-group'>
                    <span className='input-group-text'>$</span>
                    <input
                      type='text'
                      className='form-control form-control-solid bg-light'
                      value={formik.values.totalAmount.toFixed(2)}
                      readOnly
                    />
                  </div>
                  <div className='form-text text-muted'>
                    Automatically calculated from line items
                  </div>
                </div>

                {/* Valid Until */}
                <div className='col-md-6 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>Valid Until</label>
                  <input
                    type='date'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.validUntil && formik.errors.validUntil},
                      {'is-valid': formik.touched.validUntil && !formik.errors.validUntil}
                    )}
                    {...formik.getFieldProps('validUntil')}
                  />
                  {formik.touched.validUntil && formik.errors.validUntil && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.validUntil}</span>
                    </div>
                  )}
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
                    rows={3}
                    placeholder='Enter additional notes'
                    {...formik.getFieldProps('notes')}
                  />
                  {formik.touched.notes && formik.errors.notes && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.notes}</span>
                    </div>
                  )}
                </div>

                {/* Photos Section */}
                <div className='col-md-12 mb-7'>
                  <div className='card'>
                    <div className='card-header'>
                      <h3 className='card-title'>Photos</h3>
                      <div className='card-toolbar'>
                        <button
                          type='button'
                          className='btn btn-sm btn-light-primary me-2'
                          onClick={() => setShowPhotoLibrary(!showPhotoLibrary)}
                        >
                          <i className='ki-duotone ki-picture fs-6 me-1'></i>
                          Browse Photos
                        </button>
                        <div className='btn-group'>
                          <button
                            type='button'
                            className='btn btn-sm btn-primary dropdown-toggle'
                            data-bs-toggle='dropdown'
                          >
                            <i className='ki-duotone ki-camera fs-6 me-1'></i>
                            Add Photo
                          </button>
                          <ul className='dropdown-menu'>
                            {(['general', 'reference', 'before', 'after'] as const).map(type => (
                              <li key={type}>
                                <a
                                  className='dropdown-item'
                                  href='#'
                                  onClick={(e) => {
                                    e.preventDefault()
                                    setSelectedPhotoType(type)
                                    setShowPhotoCapture(true)
                                  }}
                                >
                                  {type.charAt(0).toUpperCase() + type.slice(1)} Photo
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                    <div className='card-body'>
                      {/* Photo Library */}
                      {showPhotoLibrary && (
                        <div className='mb-4'>
                          <h6 className='mb-3'>Available Photos</h6>
                          <div className='row g-3'>
                            {availablePhotos.length === 0 ? (
                              <div className='col-12'>
                                <div className='alert alert-info'>
                                  No photos available. Take some photos first!
                                </div>
                              </div>
                            ) : (
                              availablePhotos.map(photo => (
                                <div key={photo.id} className='col-md-3'>
                                  <div className='card card-bordered h-100'>
                                    <div className='card-body p-2'>
                                      <img
                                        src={photo.file_url}
                                        alt={photo.description}
                                        className='w-100 rounded mb-2'
                                        style={{ height: '120px', objectFit: 'cover' }}
                                      />
                                      <div className='text-truncate small mb-2'>
                                        {photo.description || 'No description'}
                                      </div>
                                      <button
                                        type='button'
                                        className='btn btn-sm btn-light-primary w-100'
                                        onClick={() => addPhotoFromLibrary(photo)}
                                        disabled={photos.some(p => p.id === photo.id)}
                                      >
                                        {photos.some(p => p.id === photo.id) ? 'Added' : 'Add to Estimate'}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}

                      {/* Selected Photos */}
                      <div>
                        <h6 className='mb-3'>Selected Photos ({photos.length})</h6>
                        {photos.length === 0 ? (
                          <div className='alert alert-light border-dashed border-gray-300'>
                            <div className='text-center py-3'>
                              <i className='ki-duotone ki-picture fs-3x text-gray-400 mb-3'></i>
                              <div className='text-gray-600'>No photos selected</div>
                              <div className='text-gray-400 fs-7'>Add photos to support your estimate</div>
                            </div>
                          </div>
                        ) : (
                          <div className='row g-3'>
                            {photos.map(photo => (
                              <div key={photo.id} className='col-md-4'>
                                <div className='card card-bordered h-100'>
                                  <div className='card-body p-3'>
                                    <div className='position-relative mb-3'>
                                      <img
                                        src={photo.file_url}
                                        alt={photo.description}
                                        className='w-100 rounded'
                                        style={{ height: '150px', objectFit: 'cover' }}
                                      />
                                      <button
                                        type='button'
                                        className='btn btn-icon btn-circle btn-sm btn-danger position-absolute top-0 end-0 mt-2 me-2'
                                        onClick={() => removePhoto(photo.id)}
                                        title='Remove photo'
                                      >
                                        <i className='ki-duotone ki-cross fs-6'></i>
                                      </button>
                                      <span className={`badge badge-light-primary position-absolute top-0 start-0 mt-2 ms-2`}>
                                        {photo.photo_type}
                                      </span>
                                    </div>
                                    <textarea
                                      className='form-control form-control-sm'
                                      rows={2}
                                      placeholder='Add description...'
                                      value={photo.description}
                                      onChange={(e) => updatePhotoDescription(photo.id, e.target.value)}
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className='modal-footer'>
              <button
                type='button'
                className='btn btn-light'
                onClick={onCancel}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type='submit'
                className='btn btn-primary'
                disabled={loading || !formik.isValid}
                onClick={() => {
                  if (!formik.isValid) {
                    console.log('Form validation errors:', formik.errors)
                    console.log('Form values:', formik.values)
                  }
                }}
              >
                {loading ? (
                  <>
                    <span className='spinner-border spinner-border-sm align-middle me-2'></span>
                    Saving...
                  </>
                ) : (
                  <>Save Estimate</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      
      {/* Photo Capture Modal */}
      {showPhotoCapture && (
        <PhotoCapture
          isOpen={showPhotoCapture}
          onClose={() => setShowPhotoCapture(false)}
          onPhotoSaved={handlePhotoCapture}
          photoType={selectedPhotoType}
          title={`Capture ${selectedPhotoType} Photo`}
        />
      )}

      {/* Line Item Uploader Modal */}
      {showLineItemUploader && (
        <LineItemUploader
          onLineItemsImported={handleLineItemsImport}
          onCancel={() => setShowLineItemUploader(false)}
        />
      )}
    </div>
  )
}
