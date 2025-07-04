import React, { useState, useEffect } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { MilestoneService, JobMilestone } from '../../services/milestoneService'
import { showToast } from '../../utils/toast'

const MilestonesPage: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  const [milestones, setMilestones] = useState<JobMilestone[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<string>('upcoming')
  const [selectedMilestone, setSelectedMilestone] = useState<JobMilestone | null>(null)
  const [showUpdateModal, setShowUpdateModal] = useState(false)

  useEffect(() => {
    if (userProfile?.tenant_id) {
      loadMilestones()
    }
  }, [userProfile?.tenant_id, activeFilter])

  const loadMilestones = async () => {
    if (!userProfile?.tenant_id) return

    try {
      setLoading(true)
      let data: JobMilestone[]

      switch (activeFilter) {
        case 'upcoming':
          data = await MilestoneService.getUpcomingMilestones(userProfile.tenant_id, 14)
          break
        case 'overdue':
          data = await MilestoneService.getOverdueMilestones(userProfile.tenant_id)
          break
        case 'payments':
          data = await MilestoneService.getPaymentMilestones(userProfile.tenant_id)
          break
        case 'pending':
        case 'in_progress':
        case 'completed':
          data = await MilestoneService.getMilestonesByStatus(userProfile.tenant_id, activeFilter)
          break
        default:
          data = await MilestoneService.getUpcomingMilestones(userProfile.tenant_id, 7)
      }

      setMilestones(data)
    } catch (error) {
      console.error('Error loading milestones:', error)
      showToast.error('Failed to load milestones')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateMilestone = async (status: string, notes?: string) => {
    if (!selectedMilestone) return

    try {
      await MilestoneService.updateMilestoneStatus(
        selectedMilestone.id, 
        status as any, 
        notes
      )
      showToast.success('Milestone updated successfully')
      setShowUpdateModal(false)
      setSelectedMilestone(null)
      loadMilestones()
    } catch (error) {
      console.error('Error updating milestone:', error)
      showToast.error('Failed to update milestone')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'badge-light-warning'
      case 'in_progress': return 'badge-light-info'
      case 'completed': return 'badge-light-success'
      case 'skipped': return 'badge-light-secondary'
      default: return 'badge-light-secondary'
    }
  }

  const getMilestoneIcon = (type: string) => {
    switch (type) {
      case 'payment': return 'ki-dollar'
      case 'progress': return 'ki-chart-line-up'
      case 'inspection': return 'ki-verify'
      case 'approval': return 'ki-check-circle'
      default: return 'ki-abstract-26'
    }
  }

  const getMilestoneIconColor = (type: string) => {
    switch (type) {
      case 'payment': return 'text-success'
      case 'progress': return 'text-primary'
      case 'inspection': return 'text-warning'
      case 'approval': return 'text-info'
      default: return 'text-secondary'
    }
  }

  const formatCurrency = (amount?: number) => {
    if (!amount) return '-'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const isOverdue = (milestone: JobMilestone) => {
    if (!milestone.target_date) return false
    return new Date(milestone.target_date) < new Date() && 
           (milestone.status === 'pending' || milestone.status === 'in_progress')
  }

  const filterCounts = {
    upcoming: milestones.filter(m => 
      m.target_date && 
      new Date(m.target_date) >= new Date() && 
      (m.status === 'pending' || m.status === 'in_progress')
    ).length,
    overdue: milestones.filter(m => isOverdue(m)).length,
    payments: milestones.filter(m => m.milestone_type === 'payment').length,
    pending: milestones.filter(m => m.status === 'pending').length,
    in_progress: milestones.filter(m => m.status === 'in_progress').length,
    completed: milestones.filter(m => m.status === 'completed').length
  }

  if (loading) {
    return (
      <div className='d-flex justify-content-center align-items-center' style={{ minHeight: '400px' }}>
        <div className='spinner-border text-primary' role='status'>
          <span className='visually-hidden'>Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <>
      <PageTitle breadcrumbs={[]}>Milestones Dashboard</PageTitle>

      <div className='row g-5 g-xl-8'>
        {/* Filter Tabs */}
        <div className='col-12'>
          <div className='card'>
            <div className='card-header border-0 pt-5'>
              <h3 className='card-title align-items-start flex-column'>
                <span className='card-label fw-bold fs-3 mb-1'>Milestone Management</span>
                <span className='text-muted mt-1 fw-semibold fs-7'>Track payment and progress milestones across all jobs</span>
              </h3>
            </div>
            <div className='card-body py-3'>
              <ul className='nav nav-tabs nav-line-tabs nav-line-tabs-2x border-0 fs-4 fw-semibold mb-n2'>
                {[
                  { key: 'upcoming', label: 'Upcoming (14 days)', count: filterCounts.upcoming },
                  { key: 'overdue', label: 'Overdue', count: filterCounts.overdue },
                  { key: 'payments', label: 'Payment Milestones', count: filterCounts.payments },
                  { key: 'pending', label: 'Pending', count: filterCounts.pending },
                  { key: 'in_progress', label: 'In Progress', count: filterCounts.in_progress },
                  { key: 'completed', label: 'Completed', count: filterCounts.completed }
                ].map(filter => (
                  <li key={filter.key} className='nav-item'>
                    <a
                      className={`nav-link text-active-primary pb-4 ${activeFilter === filter.key ? 'active' : ''}`}
                      href='#'
                      onClick={(e) => {
                        e.preventDefault()
                        setActiveFilter(filter.key)
                      }}
                    >
                      {filter.label}
                      {filter.count > 0 && (
                        <span className={`badge ms-2 ${
                          filter.key === 'overdue' ? 'badge-light-danger' : 
                          filter.key === 'payments' ? 'badge-light-success' :
                          'badge-light-primary'
                        }`}>
                          {filter.count}
                        </span>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Milestones List */}
        <div className='col-12'>
          <KTCard>
            <KTCardBody>
              {milestones.length === 0 ? (
                <div className='text-center py-10'>
                  <div className='text-muted'>No milestones found for the selected filter.</div>
                </div>
              ) : (
                <div className='table-responsive'>
                  <table className='table table-row-bordered table-row-gray-100 align-middle gs-0 gy-3'>
                    <thead>
                      <tr className='fw-bold text-muted'>
                        <th className='min-w-200px'>Milestone</th>
                        <th className='min-w-120px'>Job</th>
                        <th className='min-w-80px'>Type</th>
                        <th className='min-w-100px'>Status</th>
                        <th className='min-w-120px'>Target Date</th>
                        <th className='min-w-100px'>Amount</th>
                        <th className='min-w-100px text-end'>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {milestones.map((milestone: any) => (
                        <tr key={milestone.id} className={isOverdue(milestone) ? 'bg-light-danger' : ''}>
                          <td>
                            <div className='d-flex align-items-center'>
                              <i className={`ki-duotone ${getMilestoneIcon(milestone.milestone_type)} fs-2 ${getMilestoneIconColor(milestone.milestone_type)} me-3`}>
                                <span className='path1'></span>
                                <span className='path2'></span>
                              </i>
                              <div className='d-flex justify-content-start flex-column'>
                                <div className='text-dark fw-bold fs-6'>
                                  {milestone.milestone_name}
                                </div>
                                {milestone.requirements && (
                                  <span className='text-muted fw-semibold text-muted d-block fs-7'>
                                    {milestone.requirements}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className='d-flex justify-content-start flex-column'>
                              <a href={`/jobs/${milestone.job_id}`} className='text-dark fw-bold text-hover-primary fs-6'>
                                {milestone.jobs?.title || `Job ${milestone.job_id.slice(0, 8)}`}
                              </a>
                              <span className='text-muted fw-semibold d-block fs-7'>
                                {milestone.jobs?.account?.name || milestone.jobs?.location_address}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className={`badge badge-light-${
                              milestone.milestone_type === 'payment' ? 'success' :
                              milestone.milestone_type === 'progress' ? 'primary' :
                              milestone.milestone_type === 'inspection' ? 'warning' :
                              'info'
                            }`}>
                              {milestone.milestone_type}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${getStatusColor(milestone.status)}`}>
                              {milestone.status.replace('_', ' ').toUpperCase()}
                            </span>
                            {isOverdue(milestone) && (
                              <div className='text-danger fs-8 fw-bold mt-1'>OVERDUE</div>
                            )}
                          </td>
                          <td>
                            <span className='text-gray-800 fw-bold'>
                              {milestone.target_date ? 
                                new Date(milestone.target_date).toLocaleDateString() : 
                                'TBD'
                              }
                            </span>
                          </td>
                          <td>
                            <span className='text-success fw-bold'>
                              {milestone.milestone_type === 'payment' ? (
                                <>
                                  {formatCurrency(milestone.amount)}
                                  {milestone.percentage_of_total && (
                                    <div className='text-muted fs-8'>
                                      ({milestone.percentage_of_total}%)
                                    </div>
                                  )}
                                </>
                              ) : '-'}
                            </span>
                          </td>
                          <td className='text-end'>
                            <div className='d-flex justify-content-end flex-shrink-0'>
                              {milestone.status === 'pending' && (
                                <button
                                  className='btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1'
                                  onClick={() => {
                                    setSelectedMilestone(milestone)
                                    setShowUpdateModal(true)
                                  }}
                                  title='Update Status'
                                >
                                  <i className='ki-duotone ki-pencil fs-2'>
                                    <span className='path1'></span>
                                    <span className='path2'></span>
                                  </i>
                                </button>
                              )}
                              {milestone.status === 'in_progress' && (
                                <button
                                  className='btn btn-icon btn-bg-light btn-active-color-success btn-sm me-1'
                                  onClick={() => handleUpdateMilestone('completed', 'Milestone completed')}
                                  title='Mark Complete'
                                >
                                  <i className='ki-duotone ki-check fs-2'>
                                    <span className='path1'></span>
                                    <span className='path2'></span>
                                  </i>
                                </button>
                              )}
                              <a
                                href={`/jobs/${milestone.job_id}`}
                                className='btn btn-icon btn-bg-light btn-active-color-primary btn-sm'
                                title='View Job'
                              >
                                <i className='ki-duotone ki-eye fs-2'>
                                  <span className='path1'></span>
                                  <span className='path2'></span>
                                  <span className='path3'></span>
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

      {/* Update Milestone Modal */}
      {showUpdateModal && selectedMilestone && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Update Milestone: {selectedMilestone.milestone_name}
                </h5>
                <button 
                  className="btn-close"
                  onClick={() => setShowUpdateModal(false)}
                />
              </div>
              <form onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                const status = formData.get('status') as string
                const notes = formData.get('notes') as string
                handleUpdateMilestone(status, notes)
              }}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">New Status</label>
                    <select className="form-select" name="status" required>
                      <option value="">Select status...</option>
                      {selectedMilestone.status === 'pending' && (
                        <>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="skipped">Skip</option>
                        </>
                      )}
                      {selectedMilestone.status === 'in_progress' && (
                        <>
                          <option value="completed">Completed</option>
                          <option value="pending">Back to Pending</option>
                          <option value="skipped">Skip</option>
                        </>
                      )}
                    </select>
                  </div>
                  
                  <div className="mb-3">
                    <label className="form-label">Notes</label>
                    <textarea 
                      className="form-control" 
                      name="notes"
                      rows={3}
                      placeholder="Add any notes about this milestone update..."
                    />
                  </div>
                  
                  {selectedMilestone.milestone_type === 'payment' && (
                    <div className="alert alert-info">
                      <strong>Payment Amount:</strong> {formatCurrency(selectedMilestone.amount)}
                      {selectedMilestone.percentage_of_total && (
                        <span> ({selectedMilestone.percentage_of_total}% of total)</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => setShowUpdateModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Update Milestone
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default MilestonesPage