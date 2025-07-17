import React, { useState, useEffect } from 'react'
import { useFormik, FieldArray, FormikProvider, useFormikContext } from 'formik'
import * as Yup from 'yup'
import clsx from 'clsx'
import { QuoteWithRelations, QuoteLineItem } from '../../../services/quotesService'
import { StandaloneEstimateReminder } from '../../../components/estimates/StandaloneEstimateReminder'
import { supabase } from '../../../../supabaseClient'
import { useSupabaseAuth } from '../../../modules/auth/core/SupabaseAuth'
import { showToast } from '../../../utils/toast'
import { useCustomerJourneyStore } from '../../../stores/customerJourneyStore'
import { useQuoteStore } from '../../../stores/useQuoteStore'

interface Lead {
  id: string
  name: string
  caller_name?: string
  service_type: string
  phone?: string
  email?: string
  full_address?: string
  notes?: string
  urgency?: 'low' | 'medium' | 'high'
  status: 'new' | 'qualified' | 'converted'
  account_id?: string | null
  contact_id?: string | null
  accounts?: { name: string } | null
  contacts?: { first_name: string; last_name: string } | null
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

interface Account {
  id: string
  name: string
  type: 'business' | 'residential'
}

interface QuoteFormValues {
  quoteContext: 'journey' | 'job' | 'standalone'
  selectedLeadId?: string
  selectedJobId?: string
  selectedClientId?: string
  title: string
  description: string
  status: string
  lineItems: QuoteLineItem[]
  subtotal: number
  taxRate: number
  taxAmount: number
  totalAmount: number
  validUntil: string
  notes: string
  version: number
}

interface QuoteFormProps {
  quote?: QuoteWithRelations | null
  onSave: (data: any) => void
  onCancel: () => void
  leadId?: string
  jobId?: string
  accountId?: string
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

const quoteSchema = Yup.object().shape({
  quoteContext: Yup.string()
    .oneOf(['journey', 'job', 'standalone'])
    .required('Please select how this quote is being created'),
  selectedLeadId: Yup.string()
    .when('quoteContext', (quoteContext, schema) => {
      const contextValue = Array.isArray(quoteContext) ? quoteContext[0] : quoteContext
      return contextValue === 'journey' 
        ? schema.required('Please select a lead')
        : schema.nullable()
    }),
  selectedJobId: Yup.string()
    .when('quoteContext', (quoteContext, schema) => {
      const contextValue = Array.isArray(quoteContext) ? quoteContext[0] : quoteContext
      return contextValue === 'job'
        ? schema.required('Please select a job')
        : schema.nullable()
    }),
  selectedClientId: Yup.string()
    .when('quoteContext', (quoteContext, schema) => {
      const contextValue = Array.isArray(quoteContext) ? quoteContext[0] : quoteContext
      return contextValue === 'standalone'
        ? schema.required('Please select a client')
        : schema.nullable()
    }),
  title: Yup.string()
    .min(2, 'Minimum 2 characters')
    .max(200, 'Maximum 200 characters')
    .required('Title is required'),
  description: Yup.string()
    .max(1000, 'Maximum 1000 characters'),
  status: Yup.string()
    .oneOf(['draft', 'sent', 'viewed', 'approved', 'rejected', 'expired'])
    .required('Status is required'),
  lineItems: Yup.array()
    .of(lineItemSchema)
    .min(1, 'At least one line item is required'),
  taxRate: Yup.number()
    .min(0, 'Tax rate must be positive')
    .max(30, 'Maximum 30%'),
  validUntil: Yup.date()
    .min(new Date(new Date().setHours(0, 0, 0, 0)), 'Valid until date cannot be in the past')
    .required('Valid until date is required'),
  notes: Yup.string().max(1000, 'Maximum 1000 characters'),
  version: Yup.number().min(1),
})

// Component to handle auto-calculation
const TotalCalculator: React.FC = () => {
  const { values, setFieldValue } = useFormikContext<QuoteFormValues>()

  useEffect(() => {
    const subtotal = values.lineItems.reduce((sum, item) => {
      return sum + (item.quantity * item.unit_price)
    }, 0)
    
    const taxAmount = subtotal * (values.taxRate / 100)
    const total = subtotal + taxAmount
    
    setFieldValue('subtotal', subtotal)
    setFieldValue('taxAmount', taxAmount)
    setFieldValue('totalAmount', total)
  }, [values.lineItems, values.taxRate, setFieldValue])

  return null
}

export const QuoteForm: React.FC<QuoteFormProps> = ({ 
  quote, 
  onSave, 
  onCancel, 
  leadId: propLeadId, 
  jobId, 
  accountId 
}) => {
  const { userProfile } = useSupabaseAuth()
  const { lead, leadId: journeyLeadId } = useCustomerJourneyStore()
  const { setQuote } = useQuoteStore()
  
  const [loading, setLoading] = useState(false)
  const [currentVersion, setCurrentVersion] = useState(1)
  
  // Get effective lead ID
  const effectiveLeadId = propLeadId || journeyLeadId || quote?.lead_id
  
  // Determine smart default context
  const getDefaultContext = (): 'journey' | 'job' | 'standalone' => {
    if (effectiveLeadId || lead) return 'journey'
    if (jobId && !effectiveLeadId) return 'job'
    return 'standalone'
  }
  
  // Form state
  const [availableLeads, setAvailableLeads] = useState<Lead[]>([])
  const [availableJobs, setAvailableJobs] = useState<Job[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  
  // Selected context info
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [selectedClient, setSelectedClient] = useState<Account | null>(null)
  
  const getDefaultValidUntil = () => {
    const date = new Date()
    date.setDate(date.getDate() + 30) // 30 days validity
    return date.toISOString().split('T')[0]
  }

  const formik = useFormik<QuoteFormValues>({
    initialValues: {
      quoteContext: getDefaultContext(),
      selectedLeadId: effectiveLeadId || '',
      selectedJobId: jobId || quote?.job_id || '',
      selectedClientId: '',
      title: quote?.title || '',
      description: quote?.description || '',
      status: quote?.status || 'draft',
      lineItems: quote?.line_items && quote.line_items.length > 0 
        ? quote.line_items 
        : [{ description: '', quantity: 1, unit_price: 0 }],
      subtotal: quote?.subtotal || 0,
      taxRate: quote?.tax_rate || 0,
      taxAmount: quote?.tax_amount || 0,
      totalAmount: quote?.total_amount || 0,
      validUntil: quote?.valid_until ? quote.valid_until.split('T')[0] : getDefaultValidUntil(),
      notes: quote?.notes || '',
      version: quote?.version || currentVersion,
    },
    validationSchema: quoteSchema,
    onSubmit: async (values) => {
      setLoading(true)
      try {
        let submitData: any = {
          title: values.title,
          description: values.description,
          status: values.status,
          subtotal: values.subtotal,
          tax_rate: values.taxRate,
          tax_amount: values.taxAmount,
          total_amount: values.totalAmount,
          valid_until: values.validUntil,
          notes: values.notes,
          line_items: values.lineItems,
          version: values.version,
          context_type: values.quoteContext,
        }
        
        // Handle based on selected context
        switch (values.quoteContext) {
          case 'journey':
            submitData.lead_id = values.selectedLeadId
            if (selectedLead) {
              submitData.account_id = selectedLead.account_id || null
              submitData.contact_id = selectedLead.contact_id || null
            }
            submitData.job_id = null
            break
            
          case 'job':
            submitData.job_id = values.selectedJobId
            submitData.lead_id = null
            if (selectedJob) {
              submitData.account_id = selectedJob.account_id || null
              submitData.contact_id = selectedJob.contact_id || null
            }
            submitData.notes = (submitData.notes ? submitData.notes + '\n\n' : '') + '🔧 Job Quote'
            break
            
          case 'standalone':
            if (selectedClient) {
              const isResidential = selectedClient.type === 'residential'
              submitData.account_id = isResidential ? null : selectedClient.id
              submitData.contact_id = isResidential ? selectedClient.id : null
            }
            submitData.lead_id = null
            submitData.job_id = null
            submitData.notes = (submitData.notes ? submitData.notes + '\n\n' : '') + '📋 Standalone Quote'
            break
        }
        
        await onSave(submitData)
      } catch (error) {
        console.error('Error saving quote:', error)
      } finally {
        setLoading(false)
      }
    },
  })

  // Update form values when context selections change
  useEffect(() => {
    if (formik.values.quoteContext === 'journey' && selectedLead && !quote) {
      formik.setFieldValue('title', `${selectedLead.service_type || 'Service'} Quote - ${selectedLead.name || selectedLead.caller_name || 'Customer'}`)
      if (selectedLead.service_type) {
        formik.setFieldValue('description', `Quote for ${selectedLead.service_type} services`)
      }
    }
  }, [selectedLead, formik.values.quoteContext, quote])
  
  useEffect(() => {
    if (formik.values.quoteContext === 'job' && selectedJob && !quote) {
      formik.setFieldValue('title', `Additional Work - ${selectedJob.title}`)
      formik.setFieldValue('description', 'Quote for additional work requested')
    }
  }, [selectedJob, formik.values.quoteContext, quote])
  
  // Load data based on context
  useEffect(() => {
    if (userProfile?.tenant_id) {
      loadAccounts()
      loadLeads()
      loadJobs()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.tenant_id])
  
  // Load functions (similar to EstimateForm)
  const loadLeads = async () => {
    if (!userProfile?.tenant_id) return
    
    try {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          id,
          name,
          caller_name,
          service_type,
          phone,
          email,
          full_address,
          notes,
          urgency,
          status,
          account_id,
          contact_id,
          accounts!left(name),
          contacts!left(first_name, last_name)
        `)
        .eq('tenant_id', userProfile.tenant_id)
        .in('status', ['new', 'qualified'])
        .order('created_at', { ascending: false })
        
      if (error) throw error
      setAvailableLeads((data || []).map(item => ({
        id: item.id,
        name: item.name,
        caller_name: item.caller_name,
        service_type: item.service_type,
        phone: item.phone,
        email: item.email,
        full_address: item.full_address,
        notes: item.notes,
        urgency: item.urgency,
        status: item.status,
        account_id: item.account_id,
        contact_id: item.contact_id,
        accounts: Array.isArray(item.accounts) ? item.accounts[0] : item.accounts,
        contacts: Array.isArray(item.contacts) ? item.contacts[0] : item.contacts
      })))
      
      // Auto-select if we have a leadId
      if (effectiveLeadId && data) {
        const lead = data.find(l => l.id === effectiveLeadId)
        if (lead) setSelectedLead({
          id: lead.id,
          name: lead.name,
          caller_name: lead.caller_name,
          service_type: lead.service_type,
          phone: lead.phone,
          email: lead.email,
          full_address: lead.full_address,
          notes: lead.notes,
          urgency: lead.urgency,
          status: lead.status,
          account_id: lead.account_id,
          contact_id: lead.contact_id,
          accounts: Array.isArray(lead.accounts) ? lead.accounts[0] : lead.accounts,
          contacts: Array.isArray(lead.contacts) ? lead.contacts[0] : lead.contacts
        })
      }
    } catch (error) {
      console.error('Error loading leads:', error)
    }
  }
  
  const loadJobs = async () => {
    if (!userProfile?.tenant_id) return
    
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          id,
          title,
          job_number,
          status,
          account_id,
          contact_id,
          accounts!left(name),
          contacts!left(first_name, last_name)
        `)
        .eq('tenant_id', userProfile.tenant_id)
        .in('status', ['draft', 'scheduled', 'in_progress'])
        .order('created_at', { ascending: false })
        
      if (error) throw error
      setAvailableJobs((data || []).map(item => ({
        id: item.id,
        title: item.title,
        job_number: item.job_number,
        status: item.status,
        account_id: item.account_id,
        contact_id: item.contact_id,
        accounts: Array.isArray(item.accounts) ? item.accounts[0] : item.accounts,
        contacts: Array.isArray(item.contacts) ? item.contacts[0] : item.contacts
      })))
      
      // Auto-select if we have a jobId
      if (jobId && data) {
        const job = data.find(j => j.id === jobId)
        if (job) setSelectedJob({
          id: job.id,
          title: job.title,
          job_number: job.job_number,
          status: job.status,
          account_id: job.account_id,
          contact_id: job.contact_id,
          accounts: Array.isArray(job.accounts) ? job.accounts[0] : job.accounts,
          contacts: Array.isArray(job.contacts) ? job.contacts[0] : job.contacts
        })
      }
    } catch (error) {
      console.error('Error loading jobs:', error)
    }
  }
  
  const loadAccounts = async () => {
    if (!userProfile?.tenant_id) return
    
    try {
      // Load business accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select('id, name')
        .eq('tenant_id', userProfile.tenant_id)
        .order('name')
        
      if (accountsError) throw accountsError
      
      // Load residential contacts
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, name')
        .eq('tenant_id', userProfile.tenant_id)
        .is('account_id', null)
        .order('last_name')
        
      if (contactsError) throw contactsError
      
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
      
      setAccounts([...businessClients, ...residentialClients])
    } catch (error) {
      console.error('Error loading accounts:', error)
      showToast.error('Failed to load clients')
    }
  }
  
  const handleLeadChange = (leadId: string) => {
    const lead = availableLeads.find(l => l.id === leadId)
    if (lead) {
      setSelectedLead(lead)
      formik.setFieldValue('selectedLeadId', leadId)
    }
  }
  
  const handleJobChange = (jobId: string) => {
    const job = availableJobs.find(j => j.id === jobId)
    if (job) {
      setSelectedJob(job)
      formik.setFieldValue('selectedJobId', jobId)
    }
  }
  
  const handleClientChange = (clientId: string) => {
    const client = accounts.find(a => a.id === clientId)
    if (client) {
      setSelectedClient(client)
      formik.setFieldValue('selectedClientId', clientId)
    }
  }

  return (
    <div className='modal fade show d-block' tabIndex={-1} role='dialog'>
      <div className='modal-dialog modal-dialog-centered modal-xl' role='document'>
        <div className='modal-content'>
          <div className='modal-header'>
            <h5 className='modal-title'>
              {quote 
                ? `Edit Quote${quote.version ? ` v${quote.version}` : ''}`
                : 'Create New Quote'
              }
              {currentVersion > 1 && !quote && (
                <span className='badge badge-light-warning ms-2'>Version {currentVersion}</span>
              )}
            </h5>
            <button
              type='button'
              className='btn-close'
              onClick={onCancel}
              aria-label='Close'
            />
          </div>

          <form onSubmit={formik.handleSubmit} noValidate>
            <div className='modal-body'>
              {/* Quote Context Selector */}
              <div className='card mb-6'>
                <div className='card-body'>
                  <h6 className='mb-4'>How is this quote being created? <span className='text-danger'>*</span></h6>
                  <div className='d-flex flex-column gap-4'>
                    {/* Journey Option */}
                    <label className={clsx('d-flex align-items-start cursor-pointer', {
                      'opacity-50': availableLeads.length === 0 && formik.values.quoteContext !== 'journey'
                    })}>
                      <input
                        type='radio'
                        className='form-check-input me-3 mt-1'
                        name='quoteContext'
                        value='journey'
                        checked={formik.values.quoteContext === 'journey'}
                        onChange={formik.handleChange}
                        disabled={availableLeads.length === 0 && !effectiveLeadId}
                      />
                      <div className='flex-grow-1'>
                        <div className='fw-bold text-gray-800'>
                          <i className='ki-duotone ki-route fs-6 me-1 text-primary'>
                            <span className='path1'></span>
                            <span className='path2'></span>
                          </i>
                          Linked to a customer lead
                          <span className='badge badge-light-success ms-2'>Recommended</span>
                        </div>
                        <div className='text-muted fs-7 mt-1'>
                          This quote will progress the customer journey from lead to job.
                        </div>
                      </div>
                    </label>
                    
                    {/* Job Option */}
                    <label className={clsx('d-flex align-items-start cursor-pointer', {
                      'opacity-50': availableJobs.length === 0 && formik.values.quoteContext !== 'job'
                    })}>
                      <input
                        type='radio'
                        className='form-check-input me-3 mt-1'
                        name='quoteContext'
                        value='job'
                        checked={formik.values.quoteContext === 'job'}
                        onChange={formik.handleChange}
                        disabled={availableJobs.length === 0}
                      />
                      <div className='flex-grow-1'>
                        <div className='fw-bold text-gray-800'>
                          <i className='ki-duotone ki-layers fs-6 me-1 text-info'>
                            <span className='path1'></span>
                            <span className='path2'></span>
                          </i>
                          Linked to an existing job
                        </div>
                        <div className='text-muted fs-7 mt-1'>
                          This quote will be attached to an existing job for additional work.
                        </div>
                      </div>
                    </label>
                    
                    {/* Standalone Option */}
                    <label className='d-flex align-items-start cursor-pointer'>
                      <input
                        type='radio'
                        className='form-check-input me-3 mt-1'
                        name='quoteContext'
                        value='standalone'
                        checked={formik.values.quoteContext === 'standalone'}
                        onChange={formik.handleChange}
                      />
                      <div className='flex-grow-1'>
                        <div className='fw-bold text-gray-800'>
                          <i className='ki-duotone ki-document fs-6 me-1 text-warning'>
                            <span className='path1'></span>
                            <span className='path2'></span>
                          </i>
                          Standalone quote
                        </div>
                        <div className='text-muted fs-7 mt-1'>
                          This quote will not be linked to a journey or job.
                        </div>
                      </div>
                    </label>
                  </div>
                  
                  {formik.touched.quoteContext && formik.errors.quoteContext && (
                    <div className='fv-plugins-message-container mt-2'>
                      <span role='alert' className='text-danger'>{formik.errors.quoteContext}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Context-specific selectors */}
              {formik.values.quoteContext === 'journey' && (
                <>
                  <div className='alert alert-light-primary d-flex align-items-center p-5 mb-6'>
                    <i className='ki-duotone ki-information-5 fs-2hx text-primary me-4'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                      <span className='path3'></span>
                    </i>
                    <div className='d-flex flex-column'>
                      <h4 className='mb-1'>Customer Journey Quote</h4>
                      <span>This quote will progress the customer journey. Upon approval, it can be converted to a job.</span>
                    </div>
                  </div>
                  
                  <div className='row mb-4'>
                    <div className='col-md-12'>
                      <label className='required fw-semibold fs-6 mb-2'>Select Lead</label>
                      <select
                        className={clsx(
                          'form-select form-select-solid',
                          {'is-invalid': formik.touched.selectedLeadId && formik.errors.selectedLeadId},
                          {'is-valid': formik.touched.selectedLeadId && !formik.errors.selectedLeadId}
                        )}
                        name='selectedLeadId'
                        value={formik.values.selectedLeadId}
                        onChange={(e) => handleLeadChange(e.target.value)}
                        onBlur={formik.handleBlur}
                      >
                        <option value=''>Choose a lead...</option>
                        {availableLeads.map(lead => (
                          <option key={lead.id} value={lead.id}>
                            {lead.name || lead.caller_name} - {lead.service_type} ({lead.status})
                          </option>
                        ))}
                      </select>
                      {formik.touched.selectedLeadId && formik.errors.selectedLeadId && (
                        <div className='fv-plugins-message-container'>
                          <span role='alert'>{formik.errors.selectedLeadId}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
              
              {formik.values.quoteContext === 'job' && (
                <>
                  <div className='alert alert-light-info d-flex align-items-center p-5 mb-6'>
                    <i className='ki-duotone ki-information-5 fs-2hx text-info me-4'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                      <span className='path3'></span>
                    </i>
                    <div className='d-flex flex-column'>
                      <h4 className='mb-1'>Job Quote</h4>
                      <span>This quote is for additional work on an existing job.</span>
                    </div>
                  </div>
                  
                  <div className='row mb-4'>
                    <div className='col-md-12'>
                      <label className='required fw-semibold fs-6 mb-2'>Select Job</label>
                      <select
                        className={clsx(
                          'form-select form-select-solid',
                          {'is-invalid': formik.touched.selectedJobId && formik.errors.selectedJobId},
                          {'is-valid': formik.touched.selectedJobId && !formik.errors.selectedJobId}
                        )}
                        name='selectedJobId'
                        value={formik.values.selectedJobId}
                        onChange={(e) => handleJobChange(e.target.value)}
                        onBlur={formik.handleBlur}
                      >
                        <option value=''>Choose a job...</option>
                        {availableJobs.map(job => (
                          <option key={job.id} value={job.id}>
                            {job.job_number ? `${job.job_number} - ` : ''}{job.title} ({job.status})
                          </option>
                        ))}
                      </select>
                      {formik.touched.selectedJobId && formik.errors.selectedJobId && (
                        <div className='fv-plugins-message-container'>
                          <span role='alert'>{formik.errors.selectedJobId}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
              
              {formik.values.quoteContext === 'standalone' && (
                <>
                  <div className='alert alert-light-warning d-flex align-items-center p-5 mb-6'>
                    <i className='ki-duotone ki-information-5 fs-2hx text-warning me-4'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                      <span className='path3'></span>
                    </i>
                    <div className='d-flex flex-column'>
                      <h4 className='mb-1'>Standalone Quote</h4>
                      <span>This quote will not be linked to a customer journey or job.</span>
                    </div>
                  </div>
                  
                  <div className='row mb-4'>
                    <div className='col-md-12'>
                      <label className='required fw-semibold fs-6 mb-2'>Select Client</label>
                      <select
                        className={clsx(
                          'form-select form-select-solid',
                          {'is-invalid': formik.touched.selectedClientId && formik.errors.selectedClientId},
                          {'is-valid': formik.touched.selectedClientId && !formik.errors.selectedClientId}
                        )}
                        name='selectedClientId'
                        value={formik.values.selectedClientId}
                        onChange={(e) => handleClientChange(e.target.value)}
                        onBlur={formik.handleBlur}
                      >
                        <option value=''>Choose a client...</option>
                        <optgroup label='Business Clients'>
                          {accounts.filter(a => a.type === 'business').map(account => (
                            <option key={account.id} value={account.id}>{account.name}</option>
                          ))}
                        </optgroup>
                        <optgroup label='Residential Clients'>
                          {accounts.filter(a => a.type === 'residential').map(account => (
                            <option key={account.id} value={account.id}>{account.name}</option>
                          ))}
                        </optgroup>
                      </select>
                      {formik.touched.selectedClientId && formik.errors.selectedClientId && (
                        <div className='fv-plugins-message-container'>
                          <span role='alert'>{formik.errors.selectedClientId}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Show reminder for standalone quotes if editing */}
                  {quote && (
                    <StandaloneEstimateReminder
                      estimateId={quote.id}
                      isStandalone={true}
                      onLinkToJourney={() => {
                        showToast.info('Please use the "Link to Journey" option from the quotes list')
                        onCancel()
                      }}
                    />
                  )}
                </>
              )}

              {/* Quote Details */}
              <div className='row'>
                <div className='col-md-8 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>Title</label>
                  <input
                    type='text'
                    className={clsx(
                      'form-control form-control-solid',
                      {'is-invalid': formik.touched.title && formik.errors.title},
                      {'is-valid': formik.touched.title && !formik.errors.title}
                    )}
                    placeholder='Enter quote title'
                    {...formik.getFieldProps('title')}
                  />
                  {formik.touched.title && formik.errors.title && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.title}</span>
                    </div>
                  )}
                </div>

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
                    <option value='sent'>Sent</option>
                    <option value='viewed'>Viewed</option>
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
              </div>

              <div className='row'>
                <div className='col-md-12 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Description</label>
                  <textarea
                    className={clsx(
                      'form-control form-control-solid',
                      {'is-invalid': formik.touched.description && formik.errors.description},
                      {'is-valid': formik.touched.description && !formik.errors.description}
                    )}
                    rows={3}
                    placeholder='Enter quote description'
                    {...formik.getFieldProps('description')}
                  />
                  {formik.touched.description && formik.errors.description && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.description}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Line Items */}
              <div className='mb-7'>
                <h4 className='mb-4'>Line Items</h4>
                <FormikProvider value={formik}>
                  <FieldArray name='lineItems'>
                    {({ push, remove }) => (
                      <>
                        <div className='table-responsive'>
                          <table className='table table-row-dashed'>
                            <thead>
                              <tr className='fw-bold text-muted'>
                                <th className='min-w-200px'>Description</th>
                                <th className='min-w-100px'>Quantity</th>
                                <th className='min-w-150px'>Unit Price</th>
                                <th className='min-w-150px'>Total</th>
                                <th className='min-w-50px'></th>
                              </tr>
                            </thead>
                            <tbody>
                              {formik.values.lineItems.map((item, index) => (
                                <tr key={index}>
                                  <td>
                                    <input
                                      type='text'
                                      className='form-control form-control-solid'
                                      {...formik.getFieldProps(`lineItems.${index}.description`)}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type='number'
                                      className='form-control form-control-solid'
                                      {...formik.getFieldProps(`lineItems.${index}.quantity`)}
                                    />
                                  </td>
                                  <td>
                                    <div className='input-group'>
                                      <span className='input-group-text'>$</span>
                                      <input
                                        type='number'
                                        className='form-control form-control-solid'
                                        {...formik.getFieldProps(`lineItems.${index}.unit_price`)}
                                      />
                                    </div>
                                  </td>
                                  <td>
                                    <span className='fw-bold'>
                                      ${(item.quantity * item.unit_price).toFixed(2)}
                                    </span>
                                  </td>
                                  <td>
                                    {formik.values.lineItems.length > 1 && (
                                      <button
                                        type='button'
                                        className='btn btn-icon btn-sm btn-light-danger'
                                        onClick={() => remove(index)}
                                      >
                                        <i className='ki-duotone ki-trash fs-5'>
                                          <span className='path1'></span>
                                          <span className='path2'></span>
                                          <span className='path3'></span>
                                          <span className='path4'></span>
                                          <span className='path5'></span>
                                        </i>
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <button
                          type='button'
                          className='btn btn-light-primary btn-sm'
                          onClick={() => push({ description: '', quantity: 1, unit_price: 0 })}
                        >
                          <i className='ki-duotone ki-plus fs-3'></i>
                          Add Line Item
                        </button>
                      </>
                    )}
                  </FieldArray>
                  <TotalCalculator />
                </FormikProvider>
              </div>

              {/* Totals Section */}
              <div className='row'>
                <div className='col-md-6 offset-md-6'>
                  <div className='card bg-light'>
                    <div className='card-body'>
                      <div className='d-flex justify-content-between mb-3'>
                        <span>Subtotal:</span>
                        <span className='fw-bold'>${formik.values.subtotal.toFixed(2)}</span>
                      </div>
                      <div className='d-flex justify-content-between align-items-center mb-3'>
                        <span>Tax Rate:</span>
                        <div className='input-group w-100px'>
                          <input
                            type='number'
                            className='form-control form-control-sm'
                            {...formik.getFieldProps('taxRate')}
                          />
                          <span className='input-group-text'>%</span>
                        </div>
                      </div>
                      <div className='d-flex justify-content-between mb-3'>
                        <span>Tax Amount:</span>
                        <span>${formik.values.taxAmount.toFixed(2)}</span>
                      </div>
                      <hr />
                      <div className='d-flex justify-content-between'>
                        <span className='fs-4 fw-bold'>Total:</span>
                        <span className='fs-4 fw-bold text-primary'>
                          ${formik.values.totalAmount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Valid Until and Notes */}
              <div className='row mt-7'>
                <div className='col-md-6 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>Valid Until</label>
                  <input
                    type='date'
                    className={clsx(
                      'form-control form-control-solid',
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

                <div className='col-md-6 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Internal Notes</label>
                  <textarea
                    className={clsx(
                      'form-control form-control-solid',
                      {'is-invalid': formik.touched.notes && formik.errors.notes},
                      {'is-valid': formik.touched.notes && !formik.errors.notes}
                    )}
                    rows={3}
                    placeholder='Add any internal notes...'
                    {...formik.getFieldProps('notes')}
                  />
                  {formik.touched.notes && formik.errors.notes && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.notes}</span>
                    </div>
                  )}
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
              >
                {loading ? (
                  <>
                    <span className='spinner-border spinner-border-sm me-2' />
                    Saving...
                  </>
                ) : (
                  <>
                    <i className='ki-duotone ki-check fs-3 me-2'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                    </i>
                    {quote ? 'Update Quote' : 'Create Quote'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className='modal-backdrop fade show' />
    </div>
  )
}