import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { KTIcon } from '../../../_metronic/helpers'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'

interface QuickAddClientProps {
  onClose?: () => void
  onSuccess?: (clientId: string, projectId?: string) => void
}

interface ServiceType {
  id: string
  name: string
  code: string
  default_workflow: any
}

interface FieldConfig {
  name: string
  label: string
  type: string
  required?: boolean
  options?: string[]
  placeholder?: string
}

export const QuickAddClient: React.FC<QuickAddClientProps> = ({ onClose, onSuccess }) => {
  const navigate = useNavigate()
  const { userProfile, tenant } = useSupabaseAuth()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'client' | 'project' | 'complete'>('client')
  const [serviceType, setServiceType] = useState<ServiceType | null>(null)
  const [formFields, setFormFields] = useState<{client: FieldConfig[], project: FieldConfig[]}>({
    client: [],
    project: []
  })
  const [createdClientId, setCreatedClientId] = useState<string | null>(null)
  const [createProject, setCreateProject] = useState(true)

  // Dynamic validation schema based on form fields
  const getValidationSchema = (fields: FieldConfig[]) => {
    const shape: any = {}
    fields.forEach(field => {
      if (field.required) {
        switch (field.type) {
          case 'email':
            shape[field.name] = Yup.string().email('Invalid email').required(`${field.label} is required`)
            break
          case 'tel':
            shape[field.name] = Yup.string().required(`${field.label} is required`)
            break
          case 'number':
            shape[field.name] = Yup.number().required(`${field.label} is required`)
            break
          default:
            shape[field.name] = Yup.string().required(`${field.label} is required`)
        }
      } else {
        shape[field.name] = Yup.string()
      }
    })
    return Yup.object().shape(shape)
  }

  useEffect(() => {
    loadServiceTypeAndTemplate()
  }, [tenant])

  const loadServiceTypeAndTemplate = async () => {
    if (!tenant?.id) return

    try {
      // Get tenant's service type
      if (tenant.service_type) {
        const { data: serviceTypeData } = await supabase
          .from('service_types')
          .select('*')
          .eq('code', tenant.service_type)
          .single()
        
        if (serviceTypeData) {
          setServiceType(serviceTypeData)
        }
      }

      // Get default quick add template
      const { data: template } = await supabase
        .from('quick_add_templates')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('is_default', true)
        .single()

      if (template && template.form_fields) {
        setFormFields(template.form_fields)
      } else {
        // Use default fields if no template
        setFormFields(getDefaultFields(tenant.service_type))
      }
    } catch (error) {
      console.error('Error loading template:', error)
      // Use default fields on error
      setFormFields(getDefaultFields(tenant.service_type))
    }
  }

  const getDefaultFields = (serviceType?: string): {client: FieldConfig[], project: FieldConfig[]} => {
    const defaultClientFields: FieldConfig[] = [
      { name: 'first_name', label: 'First Name', type: 'text', required: true },
      { name: 'last_name', label: 'Last Name', type: 'text', required: true },
      { name: 'phone', label: 'Phone', type: 'tel', required: true, placeholder: '(555) 123-4567' },
      { name: 'email', label: 'Email', type: 'email', required: false },
      { name: 'address_line1', label: 'Service Address', type: 'text', required: true },
      { name: 'city', label: 'City', type: 'text', required: true },
      { name: 'state', label: 'State', type: 'text', required: true },
      { name: 'zip_code', label: 'ZIP Code', type: 'text', required: true }
    ]

    const serviceSpecificFields: Record<string, FieldConfig[]> = {
      hvac: [
        { name: 'system_type', label: 'System Type', type: 'select', options: ['Heating', 'Cooling', 'Both'], required: true },
        { name: 'system_age', label: 'System Age (years)', type: 'number' },
        { name: 'issue_description', label: 'What seems to be the problem?', type: 'textarea', required: true },
        { name: 'preferred_date', label: 'Preferred Service Date', type: 'date', required: true },
        { name: 'urgency', label: 'Urgency', type: 'select', options: ['Emergency', 'Urgent', 'Routine'], required: true }
      ],
      plumbing: [
        { name: 'issue_type', label: 'Issue Type', type: 'select', options: ['Leak', 'Clog', 'Installation', 'Repair', 'Inspection'], required: true },
        { name: 'location', label: 'Location of Issue', type: 'text', required: true, placeholder: 'e.g., Kitchen sink, Main bathroom' },
        { name: 'issue_description', label: 'Describe the Issue', type: 'textarea', required: true },
        { name: 'water_shutoff', label: 'Water Shut Off?', type: 'select', options: ['Yes', 'No', 'Unknown'], required: true },
        { name: 'urgency', label: 'Urgency', type: 'select', options: ['Emergency', 'Today', 'This Week', 'Schedule'], required: true }
      ],
      electrical: [
        { name: 'issue_type', label: 'Service Type', type: 'select', options: ['Repair', 'Installation', 'Inspection', 'Upgrade'], required: true },
        { name: 'circuit_breaker_access', label: 'Circuit Breaker Access', type: 'select', options: ['Yes', 'No', 'Unknown'], required: true },
        { name: 'issue_description', label: 'Describe the Work Needed', type: 'textarea', required: true },
        { name: 'permit_needed', label: 'Permit Required', type: 'select', options: ['Yes', 'No', 'Unknown'] }
      ],
      roofing: [
        { name: 'roof_type', label: 'Roof Type', type: 'select', options: ['Shingle', 'Tile', 'Metal', 'Flat', 'Other'], required: true },
        { name: 'roof_age', label: 'Roof Age (years)', type: 'number' },
        { name: 'issue_type', label: 'Service Needed', type: 'select', options: ['Repair', 'Replacement', 'Inspection', 'Maintenance'], required: true },
        { name: 'leak_active', label: 'Active Leak?', type: 'select', options: ['Yes', 'No'], required: true },
        { name: 'square_footage', label: 'Approx. Square Footage', type: 'number' },
        { name: 'insurance_claim', label: 'Insurance Claim?', type: 'select', options: ['Yes', 'No', 'Maybe'] }
      ],
      general: [
        { name: 'project_type', label: 'Project Type', type: 'text', required: true },
        { name: 'project_description', label: 'Project Description', type: 'textarea', required: true },
        { name: 'timeline', label: 'Desired Timeline', type: 'select', options: ['ASAP', 'This Week', 'This Month', 'Flexible'], required: true },
        { name: 'budget_range', label: 'Budget Range', type: 'select', options: ['Under $1k', '$1k-$5k', '$5k-$10k', '$10k-$25k', 'Over $25k'] }
      ]
    }

    return {
      client: defaultClientFields,
      project: serviceSpecificFields[serviceType || ''] || serviceSpecificFields.general
    }
  }

  const clientFormik = useFormik({
    initialValues: formFields.client.reduce((acc, field) => {
      acc[field.name] = ''
      return acc
    }, {} as Record<string, any>),
    validationSchema: getValidationSchema(formFields.client),
    onSubmit: async (values) => {
      await handleCreateClient(values)
    }
  })

  const projectFormik = useFormik({
    initialValues: formFields.project.reduce((acc, field) => {
      acc[field.name] = ''
      return acc
    }, {} as Record<string, any>),
    validationSchema: getValidationSchema(formFields.project),
    onSubmit: async (values) => {
      await handleCreateProject(values)
    }
  })

  const handleCreateClient = async (values: any) => {
    if (!userProfile?.tenant_id) return

    setLoading(true)
    try {
      // First create an account for the client
      const { data: account, error: accountError } = await supabase
        .from('accounts')
        .insert({
          tenant_id: userProfile.tenant_id,
          name: `${values.first_name} ${values.last_name}`,
          type: 'Residential',
          phone: values.phone,
          email: values.email,
          address_line1: values.address_line1,
          city: values.city,
          state: values.state,
          zip_code: values.zip_code,
          account_status: 'ACTIVE'
        })
        .select()
        .single()

      if (accountError) throw accountError

      // Create the contact
      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          tenant_id: userProfile.tenant_id,
          account_id: account.id,
          first_name: values.first_name,
          last_name: values.last_name,
          name: `${values.first_name} ${values.last_name}`,
          phone: values.phone,
          email: values.email,
          address_line1: values.address_line1,
          city: values.city,
          state: values.state,
          zip_code: values.zip_code,
          source: 'quick_add',
          property_address: values.address_line1,
          property_type: 'Residential'
        })
        .select()
        .single()

      if (contactError) throw contactError

      setCreatedClientId(contact.id)

      if (createProject) {
        setStep('project')
      } else {
        handleComplete(contact.id)
      }
    } catch (error) {
      console.error('Error creating client:', error)
      alert('Error creating client. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateProject = async (values: any) => {
    if (!userProfile?.tenant_id || !createdClientId) return

    setLoading(true)
    try {
      // Get the contact with account info
      const { data: contact } = await supabase
        .from('contacts')
        .select('*, account:accounts(*)')
        .eq('id', createdClientId)
        .single()

      if (!contact) throw new Error('Contact not found')

      // Generate job number
      const jobNumber = `JOB-${Date.now().toString(36).toUpperCase()}`

      // Create the job/project
      const projectData: any = {
        tenant_id: userProfile.tenant_id,
        account_id: contact.account_id,
        contact_id: contact.id,
        job_number: jobNumber,
        title: values.project_type || values.issue_type || 'New Project',
        description: values.project_description || values.issue_description || '',
        status: 'Scheduled',
        priority: values.urgency === 'Emergency' ? 'urgent' : values.urgency === 'Urgent' ? 'high' : 'medium',
        location_address: contact.address_line1,
        location_city: contact.city,
        location_state: contact.state,
        location_zip: contact.zip_code,
        project_data: values, // Store all the custom fields
        created_at: new Date().toISOString()
      }

      // Add preferred date if provided
      if (values.preferred_date) {
        projectData.start_date = values.preferred_date
      }

      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert(projectData)
        .select()
        .single()

      if (jobError) throw jobError

      // Create initial tasks if template exists
      if (serviceType?.default_workflow?.tasks) {
        const tasks = serviceType.default_workflow.tasks.map((task: any, index: number) => ({
          job_id: job.id,
          tenant_id: userProfile.tenant_id,
          name: task.name,
          status: 'pending',
          sort_order: index,
          due_days: task.duration
        }))

        await supabase.from('job_tasks').insert(tasks)
      }

      handleComplete(contact.id, job.id)
    } catch (error) {
      console.error('Error creating project:', error)
      alert('Error creating project. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = (clientId: string, projectId?: string) => {
    setStep('complete')
    setTimeout(() => {
      if (onSuccess) {
        onSuccess(clientId, projectId)
      } else {
        navigate(projectId ? `/jobs/${projectId}` : `/contacts/${clientId}`)
      }
    }, 2000)
  }

  const renderField = (field: FieldConfig, formik: any) => {
    const fieldProps = formik.getFieldProps(field.name)
    const hasError = formik.touched[field.name] && formik.errors[field.name]

    switch (field.type) {
      case 'select':
        return (
          <div key={field.name} className='mb-5'>
            <label className={`form-label ${field.required ? 'required' : ''}`}>
              {field.label}
            </label>
            <select
              className={`form-select form-select-solid ${hasError ? 'is-invalid' : ''}`}
              {...fieldProps}
            >
              <option value=''>Select {field.label}</option>
              {field.options?.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            {hasError && (
              <div className='fv-plugins-message-container'>
                <span role='alert'>{formik.errors[field.name]}</span>
              </div>
            )}
          </div>
        )

      case 'textarea':
        return (
          <div key={field.name} className='mb-5'>
            <label className={`form-label ${field.required ? 'required' : ''}`}>
              {field.label}
            </label>
            <textarea
              className={`form-control form-control-solid ${hasError ? 'is-invalid' : ''}`}
              rows={3}
              placeholder={field.placeholder}
              {...fieldProps}
            />
            {hasError && (
              <div className='fv-plugins-message-container'>
                <span role='alert'>{formik.errors[field.name]}</span>
              </div>
            )}
          </div>
        )

      default:
        return (
          <div key={field.name} className='mb-5'>
            <label className={`form-label ${field.required ? 'required' : ''}`}>
              {field.label}
            </label>
            <input
              type={field.type}
              className={`form-control form-control-solid ${hasError ? 'is-invalid' : ''}`}
              placeholder={field.placeholder}
              {...fieldProps}
            />
            {hasError && (
              <div className='fv-plugins-message-container'>
                <span role='alert'>{formik.errors[field.name]}</span>
              </div>
            )}
          </div>
        )
    }
  }

  return (
    <div className='modal fade show d-block' tabIndex={-1}>
      <div className='modal-dialog modal-dialog-centered modal-xl'>
        <div className='modal-content'>
          <div className='modal-header'>
            <h2 className='modal-title'>Quick Add Client</h2>
            {onClose && (
              <button
                type='button'
                className='btn-close'
                onClick={onClose}
                aria-label='Close'
              ></button>
            )}
          </div>

          <div className='modal-body'>
            {step === 'client' && (
              <form onSubmit={clientFormik.handleSubmit}>
                <div className='row'>
                  <div className='col-12 mb-5'>
                    <h3 className='mb-3'>Client Information</h3>
                    <p className='text-muted'>
                      Enter the homeowner's contact information and service address.
                    </p>
                  </div>

                  {formFields.client.map(field => (
                    <div key={field.name} className={field.type === 'textarea' ? 'col-12' : 'col-md-6'}>
                      {renderField(field, clientFormik)}
                    </div>
                  ))}

                  <div className='col-12'>
                    <div className='form-check form-switch mb-5'>
                      <input
                        className='form-check-input'
                        type='checkbox'
                        id='createProject'
                        checked={createProject}
                        onChange={(e) => setCreateProject(e.target.checked)}
                      />
                      <label className='form-check-label' htmlFor='createProject'>
                        Continue to add project details
                      </label>
                    </div>
                  </div>
                </div>

                <div className='d-flex justify-content-end'>
                  {onClose && (
                    <button
                      type='button'
                      className='btn btn-light me-3'
                      onClick={onClose}
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type='submit'
                    className='btn btn-primary'
                    disabled={loading || !clientFormik.isValid}
                  >
                    {loading && <span className='spinner-border spinner-border-sm align-middle me-2'></span>}
                    {createProject ? 'Continue to Project' : 'Save Client'}
                    {createProject && <KTIcon iconName='arrow-right' className='fs-4 ms-2' />}
                  </button>
                </div>
              </form>
            )}

            {step === 'project' && (
              <form onSubmit={projectFormik.handleSubmit}>
                <div className='row'>
                  <div className='col-12 mb-5'>
                    <h3 className='mb-3'>Project Details</h3>
                    <p className='text-muted'>
                      What work needs to be done for {clientFormik.values.first_name}?
                    </p>
                  </div>

                  {formFields.project.map(field => (
                    <div key={field.name} className={field.type === 'textarea' ? 'col-12' : 'col-md-6'}>
                      {renderField(field, projectFormik)}
                    </div>
                  ))}
                </div>

                <div className='d-flex justify-content-between'>
                  <button
                    type='button'
                    className='btn btn-light'
                    onClick={() => setStep('client')}
                    disabled={loading}
                  >
                    <KTIcon iconName='arrow-left' className='fs-4 me-2' />
                    Back
                  </button>
                  <div>
                    <button
                      type='button'
                      className='btn btn-light me-3'
                      onClick={() => handleComplete(createdClientId!)}
                      disabled={loading}
                    >
                      Skip Project
                    </button>
                    <button
                      type='submit'
                      className='btn btn-primary'
                      disabled={loading || !projectFormik.isValid}
                    >
                      {loading && <span className='spinner-border spinner-border-sm align-middle me-2'></span>}
                      Create Project
                    </button>
                  </div>
                </div>
              </form>
            )}

            {step === 'complete' && (
              <div className='text-center py-10'>
                <div className='symbol symbol-100px mb-5'>
                  <div className='symbol-label bg-light-success'>
                    <KTIcon iconName='check-circle' className='fs-2tx text-success' />
                  </div>
                </div>
                <h3 className='mb-2'>Success!</h3>
                <p className='text-muted fs-5'>
                  Client and project have been created successfully.
                </p>
                <p className='text-muted'>
                  Redirecting to project details...
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}