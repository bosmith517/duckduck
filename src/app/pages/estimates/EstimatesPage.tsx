import React, { useState, useEffect } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'
import { estimatesService, EstimateWithAccount } from '../../services/estimatesService'
import { ConvertToJobModal } from './components/ConvertToJobModal'
import { EstimateForm } from './components/EstimateForm'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { jobActivityService } from '../../services/jobActivityService'

const EstimatesPage: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  const [estimates, setEstimates] = useState<EstimateWithAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showEstimateForm, setShowEstimateForm] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [selectedEstimate, setSelectedEstimate] = useState<EstimateWithAccount | null>(null)
  const [editingEstimate, setEditingEstimate] = useState<EstimateWithAccount | null>(null)

  useEffect(() => {
    loadEstimates()
  }, [searchTerm, statusFilter])

  const loadEstimates = async () => {
    try {
      setLoading(true)
      const data = await estimatesService.getEstimates(searchTerm, statusFilter)
      setEstimates(data)
    } catch (error) {
      console.error('Error loading estimates:', error)
      // Show toast notification
    } finally {
      setLoading(false)
    }
  }

  const handleCreateEstimate = async (estimateData: any) => {
    if (!userProfile?.tenant_id) {
      alert('Authentication error. Please refresh and try again.')
      return
    }

    try {
      const estimateWithTenant = {
        ...estimateData,
        tenant_id: userProfile.tenant_id
      }
      const createdEstimate = await estimatesService.createEstimate(estimateWithTenant)
      
      // Log estimate creation activity if job_id exists
      if (userProfile?.id && estimateData.job_id) {
        try {
          await jobActivityService.logEstimateCreated(
            estimateData.job_id,
            userProfile.tenant_id,
            userProfile.id,
            createdEstimate.id,
            estimateData.total_amount || 0
          )
        } catch (logError) {
          console.error('Failed to log estimate creation activity:', logError)
        }
      }
      
      setShowEstimateForm(false)
      loadEstimates()
      // Show success toast
    } catch (error) {
      console.error('Error creating estimate:', error)
      // Show error toast
    }
  }

  const handleUpdateEstimate = async (estimateData: any) => {
    if (!editingEstimate) return
    
    try {
      await estimatesService.updateEstimate(editingEstimate.id, estimateData)
      setShowEstimateForm(false)
      setEditingEstimate(null)
      loadEstimates()
      // Show success toast
    } catch (error) {
      console.error('Error updating estimate:', error)
      // Show error toast
    }
  }

  const handleDeleteEstimate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this estimate?')) return
    
    try {
      await estimatesService.deleteEstimate(id)
      loadEstimates()
      // Show success toast
    } catch (error) {
      console.error('Error deleting estimate:', error)
      // Show error toast
    }
  }

  const handleConvertToJob = async (jobData: any, paymentSchedule: any[]) => {
    if (!selectedEstimate) return
    
    try {
      await estimatesService.convertEstimateToJob(selectedEstimate.id, jobData, paymentSchedule)
      setShowConvertModal(false)
      setSelectedEstimate(null)
      loadEstimates()
      // Show success toast
      alert('Estimate successfully converted to job with payment schedule!')
    } catch (error) {
      console.error('Error converting estimate to job:', error)
      throw error
    }
  }

  const handleStatusChange = async (estimateId: string, newStatus: string) => {
    try {
      await estimatesService.updateEstimateStatus(estimateId, newStatus)
      loadEstimates()
      alert(`✅ Estimate status updated to ${newStatus}`)
    } catch (error) {
      console.error('Error updating estimate status:', error)
      alert('Failed to update estimate status')
    }
  }


  const handleCreateRevision = async (estimate: EstimateWithAccount) => {
    try {
      const fullEstimate = await estimatesService.getEstimateById(estimate.id)
      if (fullEstimate) {
        const revisionData = {
          ...fullEstimate,
          id: undefined,
          estimate_number: undefined,
          status: 'draft' as const,
          version: (fullEstimate.version || 1) + 1,
          parent_estimate_id: estimate.id,
          created_at: undefined,
          updated_at: undefined
        }
        
        const revision = await estimatesService.createEstimate(revisionData)
        await handleStatusChange(estimate.id, 'revised')
        setEditingEstimate(revision as EstimateWithAccount)
        setShowEstimateForm(true)
        alert(`✅ Revision created: ${revision.estimate_number}`)
      }
    } catch (error) {
      console.error('Error creating revision:', error)
      alert('Failed to create revision')
    }
  }

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      'draft': 'badge-light-secondary',
      'sent': 'badge-light-info',
      'pending_review': 'badge-light-primary',
      'under_negotiation': 'badge-light-warning',
      'revised': 'badge-light-primary',
      'approved': 'badge-light-success',
      'rejected': 'badge-light-danger',
      'expired': 'badge-light-warning'
    }
    return `badge ${statusClasses[status as keyof typeof statusClasses] || 'badge-light-secondary'}`
  }

  const isExpiringSoon = (validUntil: string) => {
    const today = new Date()
    const expiryDate = new Date(validUntil)
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 3600 * 24))
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0
  }

  const filteredEstimates = estimates

  return (
    <>
      <PageTitle breadcrumbs={[]}>Estimates Management</PageTitle>
      
      <div className='row g-5 g-xl-8'>
        <div className='col-xl-12'>
          <KTCard>
            <div className='card-header border-0 pt-5'>
              <h3 className='card-title align-items-start flex-column'>
                <span className='card-label fw-bold fs-3 mb-1'>Project Estimates</span>
                <span className='text-muted mt-1 fw-semibold fs-7'>Manage project estimates and proposals</span>
              </h3>
              <div className='card-toolbar'>
                <div className='d-flex gap-2'>
                  <a 
                    href='/estimates/templates'
                    className='btn btn-sm btn-light-success'
                  >
                    <i className='ki-duotone ki-flash fs-2'></i>
                    Template Estimates (80% Faster)
                  </a>
                  <button 
                    className='btn btn-sm btn-primary'
                    onClick={() => setShowEstimateForm(true)}
                  >
                    <i className='ki-duotone ki-plus fs-2'></i>
                    New Custom Estimate
                  </button>
                </div>
              </div>
            </div>
            <KTCardBody className='py-3'>
              {/* Search and Filter Controls */}
              <div className='row mb-5'>
                <div className='col-md-6'>
                  <div className='position-relative'>
                    <i className='ki-duotone ki-magnifier fs-3 position-absolute ms-4 mt-3'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                    </i>
                    <input
                      type='text'
                      className='form-control form-control-solid ps-12'
                      placeholder='Search estimates...'
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className='col-md-3'>
                  <select
                    className='form-select form-select-solid'
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value='all'>All Statuses</option>
                    <option value='draft'>Draft</option>
                    <option value='sent'>Sent</option>
                    <option value='pending_review'>Pending Review</option>
                    <option value='under_negotiation'>Under Negotiation</option>
                    <option value='revised'>Revised</option>
                    <option value='approved'>Approved</option>
                    <option value='rejected'>Rejected</option>
                    <option value='expired'>Expired</option>
                  </select>
                </div>
              </div>

              {loading ? (
                <div className='text-center py-10'>
                  <div className='spinner-border text-primary' role='status'>
                    <span className='visually-hidden'>Loading...</span>
                  </div>
                </div>
              ) : filteredEstimates.length === 0 ? (
                <div className='text-center py-10'>
                  <div className='text-muted'>
                    {searchTerm || statusFilter !== 'all' 
                      ? 'No estimates found matching your criteria.' 
                      : 'No estimates created yet. Create your first estimate to get started.'}
                  </div>
                </div>
              ) : (
                <div className='table-responsive'>
                  <table className='table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4'>
                    <thead>
                      <tr className='fw-bold text-muted'>
                        <th className='min-w-120px'>Estimate #</th>
                        <th className='min-w-150px'>Client</th>
                        <th className='min-w-150px'>Project</th>
                        <th className='min-w-120px'>Status</th>
                        <th className='min-w-120px'>Amount</th>
                        <th className='min-w-120px'>Valid Until</th>
                        <th className='min-w-120px'>Created</th>
                        <th className='min-w-100px text-end'>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEstimates.map((estimate) => (
                        <tr key={estimate.id}>
                          <td>
                            <a href='#' className='text-dark fw-bold text-hover-primary fs-6'>
                              {estimate.estimate_number}
                            </a>
                          </td>
                          <td>
                            <div className='d-flex flex-column'>
                              <span className='text-dark fw-bold d-block fs-6'>
                                {estimate.accounts?.name || estimate.contact?.name || 'Unknown Client'}
                              </span>
                              {estimate.contact && (
                                <span className='badge badge-light-info fs-8'>Customer</span>
                              )}
                              {estimate.accounts && (
                                <span className='badge badge-light-primary fs-8'>Business Client</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className='text-dark fw-bold fs-6'>{estimate.project_title}</span>
                          </td>
                          <td>
                            <span className={getStatusBadge(estimate.status)}>
                              {estimate.status}
                            </span>
                            {estimate.valid_until && isExpiringSoon(estimate.valid_until) && (
                              <span className='badge badge-light-warning ms-2'>expiring soon</span>
                            )}
                          </td>
                          <td>
                            <span className='text-dark fw-bold d-block fs-6'>
                              ${estimate.total_amount.toLocaleString()}
                            </span>
                          </td>
                          <td>
                            <span className={`text-dark fw-bold d-block fs-6 ${estimate.valid_until && isExpiringSoon(estimate.valid_until) ? 'text-warning' : ''}`}>
                              {estimate.valid_until ? new Date(estimate.valid_until).toLocaleDateString() : 'N/A'}
                            </span>
                          </td>
                          <td>
                            <span className='text-dark fw-bold d-block fs-6'>
                              {new Date(estimate.created_at).toLocaleDateString()}
                            </span>
                          </td>
                          <td>
                            <div className='d-flex justify-content-end flex-shrink-0'>
                              {/* Always show edit button */}
                              <a
                                href='#'
                                className='btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1'
                                title='Edit Estimate'
                                onClick={async (e) => {
                                  e.preventDefault()
                                  try {
                                    const fullEstimate = await estimatesService.getEstimateById(estimate.id)
                                    if (fullEstimate) {
                                      setEditingEstimate(fullEstimate as EstimateWithAccount)
                                      setShowEstimateForm(true)
                                    }
                                  } catch (error) {
                                    console.error('Error loading estimate for editing:', error)
                                  }
                                }}
                              >
                                <i className='ki-duotone ki-pencil fs-3'>
                                  <span className='path1'></span>
                                  <span className='path2'></span>
                                </i>
                              </a>

                              {/* Workflow-specific actions */}
                              {estimate.status === 'draft' && (
                                <a
                                  href='#'
                                  className='btn btn-icon btn-bg-light btn-active-color-success btn-sm me-1'
                                  title='Send to Client'
                                  onClick={(e) => {
                                    e.preventDefault()
                                    handleStatusChange(estimate.id, 'sent')
                                  }}
                                >
                                  <i className='ki-duotone ki-send fs-3'>
                                    <span className='path1'></span>
                                    <span className='path2'></span>
                                  </i>
                                </a>
                              )}

                              {(estimate.status === 'sent' || estimate.status === 'pending_review') && (
                                <a
                                  href='#'
                                  className='btn btn-icon btn-bg-light btn-active-color-success btn-sm me-1'
                                  title='Mark Approved'
                                  onClick={(e) => {
                                    e.preventDefault()
                                    handleStatusChange(estimate.id, 'approved')
                                  }}
                                >
                                  <i className='ki-duotone ki-check fs-3'>
                                    <span className='path1'></span>
                                    <span className='path2'></span>
                                  </i>
                                </a>
                              )}


                              {estimate.status === 'under_negotiation' && (
                                <>
                                  <a
                                    href='#'
                                    className='btn btn-icon btn-bg-light btn-active-color-warning btn-sm me-1'
                                    title='Create Revision'
                                    onClick={(e) => {
                                      e.preventDefault()
                                      handleCreateRevision(estimate)
                                    }}
                                  >
                                    <i className='ki-duotone ki-document fs-3'>
                                      <span className='path1'></span>
                                      <span className='path2'></span>
                                    </i>
                                  </a>
                                  <a
                                    href='#'
                                    className='btn btn-icon btn-bg-light btn-active-color-success btn-sm me-1'
                                    title='Mark Approved'
                                    onClick={(e) => {
                                      e.preventDefault()
                                      handleStatusChange(estimate.id, 'approved')
                                    }}
                                  >
                                    <i className='ki-duotone ki-check fs-3'>
                                      <span className='path1'></span>
                                      <span className='path2'></span>
                                    </i>
                                  </a>
                                </>
                              )}

                              {estimate.status === 'approved' && (
                                <a
                                  href='#'
                                  className='btn btn-icon btn-bg-light btn-active-color-success btn-sm me-1'
                                  title='Convert to Job & Schedule'
                                  onClick={(e) => {
                                    e.preventDefault()
                                    setSelectedEstimate(estimate)
                                    setShowConvertModal(true)
                                  }}
                                >
                                  <i className='ki-duotone ki-briefcase fs-3'>
                                    <span className='path1'></span>
                                    <span className='path2'></span>
                                  </i>
                                </a>
                              )}

                              {/* Delete button - always available */}
                              <a
                                href='#'
                                className='btn btn-icon btn-bg-light btn-active-color-danger btn-sm'
                                title='Delete'
                                onClick={(e) => {
                                  e.preventDefault()
                                  handleDeleteEstimate(estimate.id)
                                }}
                              >
                                <i className='ki-duotone ki-trash fs-3'>
                                  <span className='path1'></span>
                                  <span className='path2'></span>
                                  <span className='path3'></span>
                                  <span className='path4'></span>
                                  <span className='path5'></span>
                                </i>
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </KTCardBody>
          </KTCard>
        </div>
      </div>

      {/* Estimate Form Modal */}
      {showEstimateForm && (
        <EstimateForm
          estimate={editingEstimate}
          onSave={editingEstimate ? handleUpdateEstimate : handleCreateEstimate}
          onCancel={() => {
            setShowEstimateForm(false)
            setEditingEstimate(null)
          }}
          accountId={editingEstimate?.account_id || editingEstimate?.contact_id || undefined}
        />
      )}

      {/* Convert to Job Modal */}
      {showConvertModal && selectedEstimate && (
        <ConvertToJobModal
          estimate={selectedEstimate}
          onConvert={handleConvertToJob}
          onCancel={() => {
            setShowConvertModal(false)
            setSelectedEstimate(null)
          }}
        />
      )}
    </>
  )
}

export default EstimatesPage
