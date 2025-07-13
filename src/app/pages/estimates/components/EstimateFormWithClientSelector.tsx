import React, { useState, useEffect } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { EstimateWithAccount } from '../../../services/estimatesService'
import { ClientSelector } from '../../../components/shared/ClientSelector'
import { supabase } from '../../../../supabaseClient'
import { useSupabaseAuth } from '../../../modules/auth/core/SupabaseAuth'

// Example of how to use ClientSelector in a form

interface EstimateFormProps {
  estimate?: EstimateWithAccount | null
  onSave: (data: any) => void
  onCancel: () => void
}

const EstimateFormExample: React.FC<EstimateFormProps> = ({
  estimate,
  onSave,
  onCancel
}) => {
  const { userProfile } = useSupabaseAuth()
  const [jobs, setJobs] = useState<any[]>([])
  
  // Initialize unified client ID from existing estimate
  const getUnifiedClientId = () => {
    if (estimate?.account_id) return `account_${estimate.account_id}`
    if (estimate?.contact_id) return `contact_${estimate.contact_id}`
    return ''
  }

  const formik = useFormik({
    initialValues: {
      unifiedClientId: getUnifiedClientId(),
      jobId: estimate?.job_id || '',
      projectTitle: estimate?.project_title || '',
      description: estimate?.description || '',
      totalAmount: estimate?.total_amount || 0,
      status: estimate?.status || 'draft'
    },
    validationSchema: Yup.object({
      unifiedClientId: Yup.string().required('Client is required'),
      projectTitle: Yup.string().required('Project title is required'),
      totalAmount: Yup.number().min(0).required('Amount is required')
    }),
    onSubmit: async (values) => {
      // Extract client type and ID from unified client ID
      const [clientType, clientId] = values.unifiedClientId.split('_')
      
      const submitData = {
        ...values,
        account_id: clientType === 'account' ? clientId : null,
        contact_id: clientType === 'contact' ? clientId : null
      }
      
      onSave(submitData)
    }
  })

  // Handle client selection - this is called by ClientSelector
  const handleClientChange = (unifiedId: string, accountId?: string, contactId?: string) => {
    formik.setFieldValue('unifiedClientId', unifiedId)
    formik.setFieldValue('account_id', accountId || null)
    formik.setFieldValue('contact_id', contactId || null)
    
    // Load jobs for the selected client
    if (accountId || contactId) {
      loadJobsForClient(accountId, contactId)
    }
  }

  const loadJobsForClient = async (accountId?: string, contactId?: string) => {
    if (!userProfile?.tenant_id) return

    try {
      let query = supabase
        .from('jobs')
        .select('id, title, job_number')
        .eq('tenant_id', userProfile.tenant_id)
        .order('created_at', { ascending: false })

      // Filter by client
      if (accountId) {
        query = query.eq('account_id', accountId)
      } else if (contactId) {
        query = query.eq('contact_id', contactId)
      }

      const { data, error } = await query
      
      if (error) throw error
      setJobs(data || [])
    } catch (error) {
      console.error('Error loading jobs:', error)
    }
  }

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              {estimate ? 'Edit Estimate' : 'Create New Estimate'}
            </h5>
            <button type="button" className="btn-close" onClick={onCancel}></button>
          </div>
          
          <form onSubmit={formik.handleSubmit}>
            <div className="modal-body">
              {/* Client Selection using the new ClientSelector */}
              <ClientSelector
                value={formik.values.unifiedClientId}
                onChange={handleClientChange}
                required
                label="Client/Customer"
                error={formik.touched.unifiedClientId && formik.errors.unifiedClientId ? String(formik.errors.unifiedClientId) : undefined}
                showType={true}
                placeholder="Select a client..."
              />

              {/* Job Selection - only shows jobs for selected client */}
              {formik.values.unifiedClientId && (
                <div className="mb-5">
                  <label className="required form-label">Job</label>
                  <select
                    className="form-select form-select-solid"
                    {...formik.getFieldProps('jobId')}
                  >
                    <option value="">Select a job...</option>
                    {jobs.map(job => (
                      <option key={job.id} value={job.id}>
                        {job.job_number} - {job.title}
                      </option>
                    ))}
                  </select>
                  {formik.touched.jobId && formik.errors.jobId && (
                    <div className="text-danger fs-7 mt-1">{formik.errors.jobId}</div>
                  )}
                </div>
              )}

              {/* Other form fields */}
              <div className="mb-5">
                <label className="required form-label">Project Title</label>
                <input
                  type="text"
                  className="form-control form-control-solid"
                  {...formik.getFieldProps('projectTitle')}
                />
                {formik.touched.projectTitle && formik.errors.projectTitle && (
                  <div className="text-danger fs-7 mt-1">{formik.errors.projectTitle}</div>
                )}
              </div>

              <div className="mb-5">
                <label className="required form-label">Total Amount</label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control form-control-solid"
                    {...formik.getFieldProps('totalAmount')}
                  />
                </div>
                {formik.touched.totalAmount && formik.errors.totalAmount && (
                  <div className="text-danger fs-7 mt-1">{formik.errors.totalAmount}</div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-light" onClick={onCancel}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={formik.isSubmitting || !formik.isValid}
              >
                {formik.isSubmitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Saving...
                  </>
                ) : (
                  'Save Estimate'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default EstimateFormExample