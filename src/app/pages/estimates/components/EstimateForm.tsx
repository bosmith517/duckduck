import React, { useState, useEffect } from 'react'
import { useFormik, FieldArray, FormikProvider, useFormikContext } from 'formik'
import * as Yup from 'yup'
import clsx from 'clsx'
import { EstimateWithAccount, LineItem } from '../../../services/estimatesService'
import PhotoCapture from '../../../components/shared/PhotoCapture'
import { LineItemUploader } from '../../../components/estimates/LineItemUploader'
import { StandaloneEstimateReminder } from '../../../components/estimates/StandaloneEstimateReminder'
import { supabase } from '../../../../supabaseClient'
import { useSupabaseAuth } from '../../../modules/auth/core/SupabaseAuth'
import { showToast } from '../../../utils/toast'
import { useCustomerJourneyStore } from '../../../stores/customerJourneyStore'
import { config } from '../../../../lib/config'

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
  estimateContext: 'journey' | 'job' | 'standalone' // How the estimate is being created
  selectedLeadId?: string // For journey context
  selectedJobId?: string // For change order context
  selectedClientId?: string // For standalone context
  projectTitle: string // Project title for the estimate
  description: string
  status: string
  lineItems: LineItem[]
  totalAmount: number
  validUntil: string
  notes: string
  version: number // Version tracking for estimates
}

interface Lead {
  id: string
  name: string
  caller_name?: string
  service_type: string
  phone_number?: string
  email?: string
  full_address?: string
  notes?: string
  urgency?: 'low' | 'medium' | 'high'
  status: 'new' | 'qualified' | 'converted'
  account_id?: string | null
  contact_id?: string | null
  contact_type?: 'residential' | 'business' | null
  accounts?: { id: string; name: string } | null
  contacts?: { id: string; first_name: string; last_name: string } | null
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
  leadId?: string // Optional lead ID for lead-based estimates
  jobId?: string // Optional job ID (only for approved estimates)
  accountId?: string // Optional account ID to filter photos for account-level estimates
  estimateContext?: 'journey' | 'job' | 'standalone' // Optional context override
  onSuccess?: (estimateId: string) => void // Optional success callback
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
  estimateContext: Yup.string()
    .oneOf(['journey', 'job', 'standalone'])
    .required('Please select how this estimate is being created'),
  selectedLeadId: Yup.string()
    .when('estimateContext', (estimateContext, schema) => {
      const contextValue = Array.isArray(estimateContext) ? estimateContext[0] : estimateContext
      return contextValue === 'journey' 
        ? schema.required('Please select a lead')
        : schema.nullable()
    }),
  selectedJobId: Yup.string()
    .when('estimateContext', (estimateContext, schema) => {
      const contextValue = Array.isArray(estimateContext) ? estimateContext[0] : estimateContext
      return contextValue === 'job'
        ? schema.required('Please select a job')
        : schema.nullable()
    }),
  selectedClientId: Yup.string()
    .when('estimateContext', (estimateContext, schema) => {
      const contextValue = Array.isArray(estimateContext) ? estimateContext[0] : estimateContext
      return contextValue === 'standalone'
        ? schema.required('Please select a client')
        : schema.nullable()
    }),
  projectTitle: Yup.string()
    .min(2, 'Minimum 2 characters')
    .max(200, 'Maximum 200 characters')
    .required('Project title is required'),
  description: Yup.string()
    .max(1000, 'Maximum 1000 characters')
    .required('Description is required'),
  status: Yup.string()
    .oneOf(['draft', 'sent', 'revised', 'approved', 'rejected', 'expired'])
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
  version: Yup.number().min(1),
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

export const EstimateForm: React.FC<EstimateFormProps> = ({ estimate, onSave, onCancel, leadId: propLeadId, jobId, accountId, estimateContext: propEstimateContext, onSuccess }) => {
  const { userProfile } = useSupabaseAuth()
  const [loading, setLoading] = useState(false)
  const [photos, setPhotos] = useState<EstimatePhoto[]>([])
  const [showPhotoCapture, setShowPhotoCapture] = useState(false)
  const [selectedPhotoType, setSelectedPhotoType] = useState<'general' | 'reference' | 'before' | 'after'>('general')
  const [availablePhotos, setAvailablePhotos] = useState<EstimatePhoto[]>([])
  const [showPhotoLibrary, setShowPhotoLibrary] = useState(false)
  const [currentVersion, setCurrentVersion] = useState(1)
  
  // Get journey context
  const { lead, siteVisit, leadId: journeyLeadId, step } = useCustomerJourneyStore()
  const effectiveLeadId = propLeadId || journeyLeadId || estimate?.lead_id
  
  // Determine smart default context based on how modal was opened
  const getDefaultContext = (): 'journey' | 'job' | 'standalone' => {
    if (propEstimateContext) return propEstimateContext
    if (effectiveLeadId || lead) return 'journey'
    if (jobId && !effectiveLeadId) return 'job'
    return 'standalone'
  }
  
  // Helper variables for UI display
  const isChangeOrder = jobId && !effectiveLeadId
  const isStandalone = !effectiveLeadId && !jobId
  const isJourney = !!effectiveLeadId // Force rebuild
  
  // Form state
  const [availableLeads, setAvailableLeads] = useState<Lead[]>([])
  const [availableJobs, setAvailableJobs] = useState<Job[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  
  // Selected context info
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [selectedClient, setSelectedClient] = useState<Account | null>(null)
  
  const [showLineItemUploader, setShowLineItemUploader] = useState(false)
  
  const getDefaultValidUntil = () => {
    const date = new Date()
    date.setDate(date.getDate() + 30) // 30 days validity
    return date.toISOString().split('T')[0]
  }

  // Define load functions before useFormik
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
          phone_number,
          email,
          full_address,
          notes,
          urgency,
          status,
          account_id,
          contact_id,
          contact_type,
          accounts:account_id(id, name),
          contacts:contact_id(id, first_name, last_name)
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
        phone_number: item.phone_number,
        email: item.email,
        full_address: item.full_address,
        notes: item.notes,
        urgency: item.urgency,
        status: item.status,
        account_id: item.account_id,
        contact_id: item.contact_id,
        contact_type: item.contact_type,
        accounts: Array.isArray(item.accounts) ? item.accounts[0] : item.accounts,
        contacts: Array.isArray(item.contacts) ? item.contacts[0] : item.contacts
      })))
      
      // Auto-select if we have a leadId
      if (effectiveLeadId && data) {
        const lead = data.find(l => l.id === effectiveLeadId)
        if (lead) {
          setSelectedLead({
            id: lead.id,
            name: lead.name,
            caller_name: lead.caller_name,
            service_type: lead.service_type,
            phone_number: lead.phone_number,
            email: lead.email,
            full_address: lead.full_address,
            notes: lead.notes,
            urgency: lead.urgency,
            status: lead.status,
            account_id: lead.account_id,
            contact_id: lead.contact_id,
            contact_type: lead.contact_type,
            accounts: Array.isArray(lead.accounts) ? lead.accounts[0] : lead.accounts,
            contacts: Array.isArray(lead.contacts) ? lead.contacts[0] : lead.contacts
          })
        }
      }
    } catch (error) {
      console.error('Error loading leads:', error)
    }
  }
  
  // Load jobs
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

  // Load estimate version history if editing
  useEffect(() => {
    if (effectiveLeadId && userProfile?.tenant_id) {
      loadEstimateVersions()
    }
  }, [effectiveLeadId, userProfile?.tenant_id])

  // Load photos based on lead/job context
  useEffect(() => {
    if (userProfile?.tenant_id && (effectiveLeadId || jobId || estimate?.job_id)) {
      loadAvailablePhotos()
    }
  }, [userProfile?.tenant_id, effectiveLeadId, jobId, estimate?.job_id])

  // Handle context selection changes
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


  const loadEstimateVersions = async () => {
    // Since estimates don't have lead_id, we can't check for versions by lead
    // In journey context, this will be the first estimate for the lead
    // Version tracking would need to be implemented differently
    setCurrentVersion(1)
    formik.setFieldValue('version', 1)
  }

  // Load accounts for standalone mode
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

      // Filter by lead ID (primary)
      if (effectiveLeadId) {
        query = query.eq('lead_id', effectiveLeadId)
      } 
      // Otherwise filter by job ID if available (for approved estimates)
      else if (jobId || estimate?.job_id) {
        query = query.eq('job_id', jobId || estimate?.job_id)
      }
      // If no context, don't load any photos
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
      // Save photo with lead or job reference
      if (userProfile?.id && userProfile?.tenant_id) {
        const photoData: any = {
          id: photoId,
          tenant_id: userProfile.tenant_id,
          photo_type: selectedPhotoType,
          file_path: photoUrl,
          file_url: photoUrl,
          description: '',
          taken_by: userProfile.id
        }
        
        // Add lead or job reference
        if (effectiveLeadId) {
          photoData.lead_id = effectiveLeadId
        }
        if (jobId || estimate?.job_id) {
          photoData.job_id = jobId || estimate?.job_id
        }
        
        await supabase
          .from('job_photos')
          .insert(photoData)
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

  // Create formik instance
  const formik = useFormik<EstimateFormValues>({
    initialValues: {
      estimateContext: getDefaultContext(),
      selectedLeadId: effectiveLeadId || '',
      selectedJobId: jobId || estimate?.job_id || '',
      selectedClientId: '',
      projectTitle: estimate?.project_title || '',
      description: estimate?.description || '',
      status: estimate?.status || 'draft',
      lineItems: estimate?.lineItems && estimate.lineItems.length > 0 
        ? estimate.lineItems 
        : [{ description: '', quantity: 1, unit_price: 0 }],
      totalAmount: estimate?.total_amount || 0,
      validUntil: estimate?.valid_until ? estimate.valid_until.split('T')[0] : getDefaultValidUntil(),
      notes: estimate?.notes || '',
      version: estimate?.version || currentVersion,
    },
    validationSchema: estimateSchema,
    onSubmit: async (values) => {
      setLoading(true)
      try {
        let submitData: any = {
          tenant_id: userProfile?.tenant_id,
          project_title: values.projectTitle,
          description: values.description,
          status: values.status,
          total_amount: values.totalAmount,
          valid_until: values.validUntil,
          notes: values.notes,
          lineItems: values.lineItems,
          version: values.version,
          context_type: values.estimateContext, // Track for analytics
        }
        
        // Handle based on selected context
        switch (values.estimateContext) {
          case 'journey':
            // Journey mode - use selected lead
            submitData.lead_id = values.selectedLeadId || effectiveLeadId
            
            // First try to get data from the store's lead object
            const storeLead = lead && lead.id === submitData.lead_id ? lead : null
            const leadToUse = storeLead || selectedLead
            
            // In journey context with effectiveLeadId but no lead data, we can still proceed
            if (leadToUse || (effectiveLeadId && submitData.lead_id)) {
              if (leadToUse) {
                // Use the proper foreign key relationships
                submitData.account_id = leadToUse.account_id || null
                submitData.contact_id = leadToUse.contact_id || null
                
                // Log for debugging
                console.log('Lead customer relationships:', {
                  lead_id: leadToUse.id,
                  account_id: submitData.account_id,
                  contact_id: submitData.contact_id,
                  contact_type: leadToUse.contact_type
                })
              } else {
                // No lead data but we have lead_id - create with just lead_id
                console.log('Creating estimate with lead_id only - no lead data available')
                submitData.account_id = null
                submitData.contact_id = null
              }
            } else {
              // CRITICAL: We should NEVER create an estimate without client info
              showToast.error('Cannot create estimate: Lead is missing customer information')
              throw new Error('Lead is missing required customer relationships')
            }
            
            submitData.job_id = null // Jobs created after approval
            break
            
          case 'job':
            // Change order mode - link to job only
            submitData.job_id = values.selectedJobId
            submitData.lead_id = null
            if (selectedJob) {
              submitData.account_id = selectedJob.account_id || null
              submitData.contact_id = selectedJob.contact_id || null
            }
            submitData.notes = (submitData.notes ? submitData.notes + '\n\n' : '') + '⚡ Change Order Estimate'
            break
            
          case 'standalone':
            // Standalone mode - use selected client
            if (selectedClient) {
              const isResidential = selectedClient.type === 'residential'
              submitData.account_id = isResidential ? null : selectedClient.id
              submitData.contact_id = isResidential ? selectedClient.id : null
            }
            submitData.lead_id = null
            submitData.job_id = null
            submitData.notes = (submitData.notes ? submitData.notes + '\n\n' : '') + '📋 Standalone Estimate'
            break
        }
        
        await onSave(submitData)
        // onSuccess is called separately after onSave completes
      } catch (error) {
        console.error('Error saving estimate:', error)
      } finally {
        setLoading(false)
      }
    },
  })

  // Update form values when context selections change
  useEffect(() => {
    if (formik.values.estimateContext === 'journey' && selectedLead && !estimate) {
      formik.setFieldValue('projectTitle', `${selectedLead.service_type || 'Service'} - ${selectedLead.name || selectedLead.caller_name || 'Customer'}`)
      if (selectedLead.notes) {
        formik.setFieldValue('description', `Initial Request: ${selectedLead.notes}`)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLead, formik.values.estimateContext, estimate])
  
  useEffect(() => {
    if (formik.values.estimateContext === 'job' && selectedJob && !estimate) {
      formik.setFieldValue('projectTitle', `Change Order - ${selectedJob.title}`)
      formik.setFieldValue('description', 'Additional work requested by customer')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJob, formik.values.estimateContext, estimate])
  
  // Load data based on context
  useEffect(() => {
    if (userProfile?.tenant_id) {
      // Always load these for flexibility
      loadAccounts()
      loadLeads()
      loadJobs()
    }
    // Intentionally only running on tenant_id change to avoid infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.tenant_id])
  
  // In journey context, if we have a leadId but no lead data, fetch it
  useEffect(() => {
    const fetchLeadIfNeeded = async () => {
      if (effectiveLeadId && !lead && userProfile?.tenant_id) {
        try {
          const { data, error } = await supabase
            .from('leads')
            .select(`
              id,
              name,
              caller_name,
              service_type,
              phone_number,
              email,
              full_address,
              notes,
              urgency,
              status,
              account_id,
              contact_id,
              contact_type,
              accounts:account_id(id, name),
              contacts:contact_id(id, first_name, last_name)
            `)
            .eq('id', effectiveLeadId)
            .eq('tenant_id', userProfile.tenant_id)
            .single()
          
          if (data && !error) {
            // Update the selected lead so the form can use it
            setSelectedLead({
              id: data.id,
              name: data.name,
              caller_name: data.caller_name,
              service_type: data.service_type,
              phone_number: data.phone_number,
              email: data.email,
              full_address: data.full_address,
              notes: data.notes,
              urgency: data.urgency,
              status: data.status,
              account_id: data.account_id,
              contact_id: data.contact_id,
              contact_type: data.contact_type,
              accounts: Array.isArray(data.accounts) ? data.accounts[0] : data.accounts,
              contacts: Array.isArray(data.contacts) ? data.contacts[0] : data.contacts
            })
            // Also update the form value
            formik.setFieldValue('selectedLeadId', effectiveLeadId)
          }
        } catch (error) {
          console.error('Error fetching lead for journey context:', error)
        }
      }
    }
    
    fetchLeadIfNeeded()
  }, [effectiveLeadId, lead, userProfile?.tenant_id])

  // Auto-select lead when component mounts with effectiveLeadId
  useEffect(() => {
    if (effectiveLeadId && availableLeads.length > 0 && !selectedLead) {
      const lead = availableLeads.find(l => l.id === effectiveLeadId)
      if (lead) {
        setSelectedLead(lead)
        // Also ensure form field is set
        formik.setFieldValue('selectedLeadId', effectiveLeadId)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveLeadId, availableLeads])

  // Use lead from journey store if available and no lead is loaded yet
  useEffect(() => {
    if (lead && !selectedLead && formik.values.estimateContext === 'journey') {
      // Convert journey lead to form lead format
      const formLead: Lead = {
        id: lead.id,
        name: lead.name,
        caller_name: lead.name,
        service_type: lead.service_type || '',
        phone_number: lead.contact?.phone,
        email: lead.contact?.email,
        full_address: lead.full_address || '',
        status: 'qualified',
        account_id: null,
        contact_id: null
      }
      setSelectedLead(formLead)
      formik.setFieldValue('selectedLeadId', lead.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead, formik.values.estimateContext])
  
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
              {estimate 
                ? `Edit Estimate${estimate.version ? ` v${estimate.version}` : ''}`
                : isChangeOrder 
                  ? 'Create Change Order Estimate'
                  : isStandalone
                    ? 'Create Standalone Estimate'
                    : 'Create New Estimate'
              }
              {currentVersion > 1 && !estimate && (
                <span className='badge badge-light-warning ms-2'>Version {currentVersion}</span>
              )}
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
              {/* Lead Info Banner for Journey Context */}
              {effectiveLeadId && lead && (
                <div className="alert alert-primary d-flex align-items-center mb-4">
                  <i className="ki-duotone ki-user fs-2 me-3">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  <div>
                    <h6 className="mb-0">Creating estimate for: <strong>{lead.name}</strong></h6>
                    <p className="mb-0 text-muted small">
                      {lead.service_type} • {lead.phone_number || 'No phone'} • {lead.full_address || 'No address'}
                    </p>
                  </div>
                </div>
              )}
              
              {/* Estimate Context Selector */}
              <div className='card mb-6'>
                <div className='card-body'>
                  <h6 className='mb-4'>How is this estimate being created? <span className='text-danger'>*</span></h6>
                  <div className='d-flex flex-column gap-4'>
                    {/* Journey Option */}
                    <label className={clsx('d-flex align-items-start cursor-pointer', {
                      'opacity-50': availableLeads.length === 0 && formik.values.estimateContext !== 'journey'
                    })}>
                      <input
                        type='radio'
                        className='form-check-input me-3 mt-1'
                        name='estimateContext'
                        value='journey'
                        checked={formik.values.estimateContext === 'journey'}
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
                          This estimate will progress the customer journey from lead to job.
                        </div>
                      </div>
                    </label>
                    
                    {/* Change Order Option */}
                    <label className={clsx('d-flex align-items-start cursor-pointer', {
                      'opacity-50': availableJobs.length === 0 && formik.values.estimateContext !== 'job'
                    })}>
                      <input
                        type='radio'
                        className='form-check-input me-3 mt-1'
                        name='estimateContext'
                        value='job'
                        checked={formik.values.estimateContext === 'job'}
                        onChange={formik.handleChange}
                        disabled={availableJobs.length === 0}
                      />
                      <div className='flex-grow-1'>
                        <div className='fw-bold text-gray-800'>
                          <i className='ki-duotone ki-layers fs-6 me-1 text-info'>
                            <span className='path1'></span>
                            <span className='path2'></span>
                          </i>
                          Linked to an existing job (change order)
                        </div>
                        <div className='text-muted fs-7 mt-1'>
                          This estimate will be attached to an existing job. It will not impact the journey.
                        </div>
                      </div>
                    </label>
                    
                    {/* Standalone Option */}
                    <label className='d-flex align-items-start cursor-pointer'>
                      <input
                        type='radio'
                        className='form-check-input me-3 mt-1'
                        name='estimateContext'
                        value='standalone'
                        checked={formik.values.estimateContext === 'standalone'}
                        onChange={formik.handleChange}
                      />
                      <div className='flex-grow-1'>
                        <div className='fw-bold text-gray-800'>
                          <i className='ki-duotone ki-document fs-6 me-1 text-warning'>
                            <span className='path1'></span>
                            <span className='path2'></span>
                          </i>
                          Standalone estimate (internal or bulk request)
                        </div>
                        <div className='text-muted fs-7 mt-1'>
                          This estimate will not be linked to a journey or job.
                        </div>
                      </div>
                    </label>
                  </div>
                  
                  {formik.touched.estimateContext && formik.errors.estimateContext && (
                    <div className='fv-plugins-message-container mt-2'>
                      <span role='alert' className='text-danger'>{formik.errors.estimateContext}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Context-specific selectors and banners */}
              {formik.values.estimateContext === 'journey' && (
                <>
                  <div className='alert alert-light-primary d-flex align-items-center p-5 mb-6'>
                    <i className='ki-duotone ki-information-5 fs-2hx text-primary me-4'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                      <span className='path3'></span>
                    </i>
                    <div className='d-flex flex-column'>
                      <h4 className='mb-1'>Customer Journey Estimate</h4>
                      <span>This estimate will progress the customer journey. Upon approval, it will automatically convert to a job.</span>
                    </div>
                  </div>
                  
                  {/* Only show lead selector if we don't have a pre-selected lead from journey */}
                  {!propLeadId && (
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
                  )}
                  
                  {selectedLead && (
                    <div className='card bg-light-primary mb-6'>
                      <div className='card-body'>
                        <h6 className='mb-3'>Lead Details</h6>
                        <div className='row'>
                          <div className='col-md-6'>
                            <div className='mb-2'><strong>Customer:</strong> {selectedLead.name || selectedLead.caller_name}</div>
                            <div className='mb-2'><strong>Service:</strong> {selectedLead.service_type}</div>
                            {selectedLead.urgency && (
                              <div className='mb-2'>
                                <strong>Priority:</strong> 
                                <span className={`badge ms-2 badge-light-${selectedLead.urgency === 'high' ? 'danger' : selectedLead.urgency === 'medium' ? 'warning' : 'success'}`}>
                                  {selectedLead.urgency}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className='col-md-6'>
                            {selectedLead.phone_number && <div className='mb-2'><strong>Phone:</strong> {selectedLead.phone_number}</div>}
                            {selectedLead.email && <div className='mb-2'><strong>Email:</strong> {selectedLead.email}</div>}
                            {selectedLead.full_address && <div className='mb-2'><strong>Location:</strong> {selectedLead.full_address}</div>}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              
              {formik.values.estimateContext === 'job' && (
                <>
                  <div className='alert alert-light-info d-flex align-items-center p-5 mb-6'>
                    <i className='ki-duotone ki-information-5 fs-2hx text-info me-4'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                      <span className='path3'></span>
                    </i>
                    <div className='d-flex flex-column'>
                      <h4 className='mb-1'>Change Order Estimate</h4>
                      <span>This estimate is for additional work on an existing job. It will not impact the customer journey.</span>
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
              
              {formik.values.estimateContext === 'standalone' && (
                <>
                  <div className='alert alert-light-warning d-flex align-items-center p-5 mb-6'>
                    <i className='ki-duotone ki-information-5 fs-2hx text-warning me-4'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                      <span className='path3'></span>
                    </i>
                    <div className='d-flex flex-column'>
                      <h4 className='mb-1'>Standalone Estimate</h4>
                      <span>This estimate will not be linked to a customer journey or job.</span>
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

                  {/* Show reminder for standalone estimates if it's an existing estimate */}
                  {estimate && (
                    <StandaloneEstimateReminder
                      estimateId={estimate.id}
                      isStandalone={true}
                      onLinkToJourney={() => {
                        // Close this form and potentially open the link modal
                        showToast.info('Please use the "Link to Journey" option from the estimates list')
                        onCancel()
                      }}
                    />
                  )}
                </>
              )}

              <div className='row'>

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
                    <option value='revised'>Revised</option>
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

                {/* Project Title */}
                <div className='col-md-12 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>Project Title</label>
                  <input
                    type='text'
                    className={clsx(
                      'form-control form-control-solid',
                      {'is-invalid': formik.touched.projectTitle && formik.errors.projectTitle},
                      {'is-valid': formik.touched.projectTitle && !formik.errors.projectTitle}
                    )}
                    placeholder='Enter project title'
                    {...formik.getFieldProps('projectTitle')}
                  />
                  {formik.touched.projectTitle && formik.errors.projectTitle && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.projectTitle}</span>
                    </div>
                  )}
                  <div className='form-text text-muted'>
                    This estimate will be linked to the current customer lead. Once approved, it will convert into a job automatically.
                  </div>
                </div>
                
                {/* Show job info if estimate is approved */}
                {formik.values.status === 'approved' && (jobId || estimate?.job_id) && (
                  <div className='col-md-12 mb-7'>
                    <div className='alert alert-light-success d-flex align-items-center p-5'>
                      <i className='ki-duotone ki-check-circle fs-2hx text-success me-4'>
                        <span className='path1'></span>
                        <span className='path2'></span>
                      </i>
                      <div className='d-flex flex-column'>
                        <h4 className='mb-1 text-success'>Estimate Approved</h4>
                        <span>This estimate has been converted to a job.</span>
                        {(jobId || estimate?.job_id) && (
                          <a href={`/jobs/${jobId || estimate?.job_id}`} className='btn btn-sm btn-light-success mt-2'>
                            View Job Details
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}

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
                      <h3 className='card-title'>
                        Photos
                        {siteVisit && availablePhotos.length > 0 && (
                          <span className='badge badge-light-primary ms-2'>
                            {availablePhotos.length} from site visit
                          </span>
                        )}
                      </h3>
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
