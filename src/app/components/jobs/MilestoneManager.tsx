import React, { useState, useEffect } from 'react'
import { MilestoneService, JobMilestone } from '../../services/milestoneService'
import { showToast } from '../../utils/toast'

interface MilestoneManagerProps {
  jobId: string
  jobValue?: number
  startDate?: string
  onMilestoneUpdate?: () => void
}

export const MilestoneManager: React.FC<MilestoneManagerProps> = ({
  jobId,
  jobValue,
  startDate,
  onMilestoneUpdate
}) => {
  const [milestones, setMilestones] = useState<JobMilestone[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [selectedMilestone, setSelectedMilestone] = useState<JobMilestone | null>(null)
  const [projectType, setProjectType] = useState('standard_construction')
  const [progress, setProgress] = useState<{
    total_milestones: number
    completed_milestones: number
    progress_percentage: number
    next_milestone?: JobMilestone
  }>({
    total_milestones: 0,
    completed_milestones: 0,
    progress_percentage: 0,
    next_milestone: undefined
  })

  useEffect(() => {
    loadMilestones()
  }, [jobId])

  const loadMilestones = async () => {
    try {
      setLoading(true)
      const data = await MilestoneService.getMilestonesForJob(jobId)
      setMilestones(data)
      
      // Calculate progress
      const progressData = await MilestoneService.calculateJobProgress(jobId)
      setProgress(progressData)
    } catch (error) {
      console.error('Error loading milestones:', error)
      showToast.error('Failed to load milestones')
    } finally {
      setLoading(false)
    }
  }

  const createMilestones = async () => {
    try {
      await MilestoneService.createMilestonesForJob(jobId, projectType, jobValue, startDate)
      showToast.success('Milestones created successfully')
      setShowCreateModal(false)
      loadMilestones()
      onMilestoneUpdate?.()
    } catch (error: any) {
      console.error('Error creating milestones:', error)
      showToast.error(error.message || 'Failed to create milestones')
    }
  }

  const updateMilestoneStatus = async (status: string, notes?: string) => {
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
      onMilestoneUpdate?.()
    } catch (error) {
      console.error('Error updating milestone:', error)
      showToast.error('Failed to update milestone')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-warning'
      case 'in_progress': return 'text-info'
      case 'completed': return 'text-success'
      case 'skipped': return 'text-muted'
      default: return 'text-secondary'
    }
  }

  const getStatusBadge = (status: string) => {
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

  if (loading) {
    return <div className="text-center">Loading milestones...</div>
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Payment & Progress Milestones</h3>
        {milestones.length === 0 && (
          <button 
            className="btn btn-primary btn-sm"
            onClick={() => setShowCreateModal(true)}
          >
            Create Milestone Schedule
          </button>
        )}
      </div>
      
      <div className="card-body">
        {milestones.length === 0 ? (
          <div className="text-center text-muted">
            No milestones created yet. Click "Create Milestone Schedule" to generate them based on project type.
          </div>
        ) : (
          <>
            {/* Progress Overview */}
            <div className="row mb-6">
              <div className="col-12">
                <div className="bg-light-primary p-4 rounded">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h4 className="text-primary mb-0">Project Progress</h4>
                    <span className="badge badge-primary fs-6">{progress.progress_percentage}% Complete</span>
                  </div>
                  
                  <div className="progress mb-3" style={{ height: '8px' }}>
                    <div 
                      className="progress-bar bg-primary" 
                      style={{ width: `${progress.progress_percentage}%` }}
                    />
                  </div>
                  
                  <div className="row">
                    <div className="col-md-4">
                      <div className="d-flex align-items-center">
                        <i className="ki-duotone ki-check-circle fs-2 text-success me-2">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        <div>
                          <div className="fw-bold">{progress.completed_milestones}</div>
                          <div className="text-muted fs-7">Completed</div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="d-flex align-items-center">
                        <i className="ki-duotone ki-abstract-26 fs-2 text-primary me-2">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        <div>
                          <div className="fw-bold">{progress.total_milestones}</div>
                          <div className="text-muted fs-7">Total Milestones</div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      {progress.next_milestone && (
                        <div className="d-flex align-items-center">
                          <i className={`ki-duotone ${getMilestoneIcon(progress.next_milestone.milestone_type)} fs-2 ${getMilestoneIconColor(progress.next_milestone.milestone_type)} me-2`}>
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                          <div>
                            <div className="fw-bold fs-7">{progress.next_milestone.milestone_name}</div>
                            <div className="text-muted fs-8">Next Milestone</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Milestones Timeline */}
            <div className="timeline">
              {milestones.map((milestone, index) => (
                <div key={milestone.id} className="timeline-item">
                  <div className="timeline-line w-40px"></div>
                  <div className={`timeline-icon symbol symbol-circle symbol-40px ${
                    milestone.status === 'completed' ? 'symbol-success' :
                    milestone.status === 'in_progress' ? 'symbol-info' :
                    milestone.status === 'skipped' ? 'symbol-secondary' :
                    'symbol-warning'
                  }`}>
                    <div className="symbol-label">
                      <i className={`ki-duotone ${getMilestoneIcon(milestone.milestone_type)} fs-2 ${
                        milestone.status === 'completed' ? 'text-white' : getMilestoneIconColor(milestone.milestone_type)
                      }`}>
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                    </div>
                  </div>
                  
                  <div className="timeline-content mb-10 mt-n1">
                    <div className="pe-3 mb-5">
                      <div className="fs-5 fw-semibold mb-2">
                        {milestone.milestone_name}
                        <span className={`badge ${getStatusBadge(milestone.status)} ms-2`}>
                          {milestone.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      
                      <div className="d-flex align-items-center mt-1 fs-6">
                        <div className="text-muted me-2">
                          <i className="ki-duotone ki-calendar fs-7 me-1">
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                          Target: {milestone.target_date ? new Date(milestone.target_date).toLocaleDateString() : 'TBD'}
                        </div>
                        
                        {milestone.milestone_type === 'payment' && (
                          <div className="text-success me-2">
                            <i className="ki-duotone ki-dollar fs-7 me-1">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                            {formatCurrency(milestone.amount)}
                            {milestone.percentage_of_total && ` (${milestone.percentage_of_total}%)`}
                          </div>
                        )}
                      </div>
                      
                      {milestone.requirements && (
                        <div className="text-gray-600 fs-7 mt-2">
                          <i className="ki-duotone ki-information fs-7 me-1">
                            <span className="path1"></span>
                            <span className="path2"></span>
                            <span className="path3"></span>
                          </i>
                          {milestone.requirements}
                        </div>
                      )}
                      
                      {milestone.notes && (
                        <div className="bg-light-info p-3 rounded mt-3">
                          <div className="text-info fs-8 fw-bold mb-1">Notes:</div>
                          <div className="text-gray-700 fs-7">{milestone.notes}</div>
                        </div>
                      )}
                      
                      {milestone.completed_at && (
                        <div className="text-success fs-7 mt-2">
                          <i className="ki-duotone ki-check-circle fs-7 me-1">
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                          Completed {new Date(milestone.completed_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    
                    <div className="d-flex align-items-center mt-1">
                      {milestone.status === 'pending' && (
                        <button
                          className="btn btn-sm btn-light-primary me-2"
                          onClick={() => {
                            setSelectedMilestone(milestone)
                            setShowUpdateModal(true)
                          }}
                        >
                          Mark In Progress
                        </button>
                      )}
                      
                      {milestone.status === 'in_progress' && (
                        <button
                          className="btn btn-sm btn-light-success me-2"
                          onClick={() => {
                            setSelectedMilestone(milestone)
                            setShowUpdateModal(true)
                          }}
                        >
                          Mark Complete
                        </button>
                      )}
                      
                      {milestone.status !== 'completed' && milestone.status !== 'skipped' && (
                        <button
                          className="btn btn-sm btn-light-secondary"
                          onClick={() => updateMilestoneStatus('skipped', 'Milestone skipped')}
                        >
                          Skip
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Create Milestones Modal */}
      {showCreateModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Create Milestone Schedule</h5>
                <button 
                  className="btn-close"
                  onClick={() => setShowCreateModal(false)}
                />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Project Type</label>
                  <select 
                    className="form-select" 
                    value={projectType}
                    onChange={(e) => setProjectType(e.target.value)}
                  >
                    <option value="standard_construction">Standard Construction</option>
                    <option value="electrical_service">Electrical Service Call</option>
                    <option value="large_project">Large Project</option>
                  </select>
                  <div className="form-text">
                    Choose the project type to generate appropriate milestone templates.
                  </div>
                </div>
                
                <div className="alert alert-info">
                  <div className="fw-bold">Template Preview:</div>
                  <div className="text-muted fs-7">
                    {projectType === 'standard_construction' && '11 milestones: Contract → Deposit → Permits → Materials → Progress payments → Inspections → Completion'}
                    {projectType === 'electrical_service' && '5 milestones: Schedule → Diagnostic → Authorization → Work → Payment'}
                    {projectType === 'large_project' && '15 milestones: Contract → Engineering → Permits → Multiple progress payments → Inspections → Closeout'}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={createMilestones}
                >
                  Create Milestones
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Update Milestone Modal */}
      {showUpdateModal && selectedMilestone && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Update Milestone: {selectedMilestone.milestone_name}</h5>
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
                updateMilestoneStatus(status, notes)
              }}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">New Status</label>
                    <select className="form-select" name="status" required>
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
    </div>
  )
}