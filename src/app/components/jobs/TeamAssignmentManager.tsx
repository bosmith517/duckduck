import React, { useState, useEffect } from 'react'
import { TeamAssignmentService, JobTeamAssignment } from '../../services/teamAssignmentService'
import { showToast } from '../../utils/toast'

interface TeamAssignmentManagerProps {
  jobId: string
  onTeamUpdate?: () => void
}

export const TeamAssignmentManager: React.FC<TeamAssignmentManagerProps> = ({
  jobId,
  onTeamUpdate
}) => {
  const [assignments, setAssignments] = useState<JobTeamAssignment[]>([])
  const [availableTeamMembers, setAvailableTeamMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignmentType, setAssignmentType] = useState('')

  useEffect(() => {
    loadTeamAssignments()
    loadAvailableTeamMembers()
  }, [jobId])

  const loadTeamAssignments = async () => {
    try {
      setLoading(true)
      const data = await TeamAssignmentService.getTeamAssignmentsForJob(jobId)
      setAssignments(data)
    } catch (error) {
      console.error('Error loading team assignments:', error)
      showToast.error('Failed to load team assignments')
    } finally {
      setLoading(false)
    }
  }

  const loadAvailableTeamMembers = async () => {
    try {
      // Get tenant ID from user profile (simplified)
      const teamMembers = await TeamAssignmentService.getAvailableTeamMembers('')
      setAvailableTeamMembers(teamMembers)
    } catch (error) {
      console.error('Error loading team members:', error)
    }
  }

  const handleAssignTeamMember = async (assignmentData: any) => {
    try {
      await TeamAssignmentService.assignTeamMember({
        ...assignmentData,
        job_id: jobId
      })
      showToast.success('Team member assigned successfully')
      setShowAssignModal(false)
      setAssignmentType('')
      loadTeamAssignments()
      onTeamUpdate?.()
    } catch (error: any) {
      console.error('Error assigning team member:', error)
      showToast.error(error.message || 'Failed to assign team member')
    }
  }

  const handleUpdateAssignmentStatus = async (
    assignmentId: string, 
    status: string
  ) => {
    try {
      await TeamAssignmentService.updateAssignmentStatus(
        assignmentId, 
        status as any,
        status === 'completed' ? new Date().toISOString().split('T')[0] : undefined
      )
      showToast.success('Assignment status updated')
      loadTeamAssignments()
      onTeamUpdate?.()
    } catch (error) {
      console.error('Error updating assignment status:', error)
      showToast.error('Failed to update assignment status')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned': return 'badge-light-info'
      case 'active': return 'badge-light-success'
      case 'completed': return 'badge-light-primary'
      case 'removed': return 'badge-light-danger'
      default: return 'badge-light-secondary'
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'project_manager': return 'ki-user-tick'
      case 'lead_tech': return 'ki-crown'
      case 'electrician': return 'ki-electricity'
      case 'plumber': return 'ki-drop'
      case 'hvac_tech': return 'ki-wind'
      default: return 'ki-user'
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'project_manager': return 'text-primary'
      case 'lead_tech': return 'text-warning'
      case 'electrician': return 'text-info'
      case 'plumber': return 'text-success'
      case 'hvac_tech': return 'text-danger'
      default: return 'text-secondary'
    }
  }

  if (loading) {
    return <div className="text-center">Loading team assignments...</div>
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Team Assignments</h3>
        <button 
          className="btn btn-primary btn-sm"
          onClick={() => setShowAssignModal(true)}
        >
          <i className="ki-duotone ki-plus fs-2 me-1">
            <span className="path1"></span>
            <span className="path2"></span>
          </i>
          Assign Team Member
        </button>
      </div>
      
      <div className="card-body">
        {assignments.length === 0 ? (
          <div className="text-center text-muted py-10">
            <i className="ki-duotone ki-people fs-3x text-muted mb-3">
              <span className="path1"></span>
              <span className="path2"></span>
              <span className="path3"></span>
              <span className="path4"></span>
              <span className="path5"></span>
            </i>
            <div className="mb-3">No team members assigned yet.</div>
            <div className="fs-7">Click "Assign Team Member" to add team members to this job.</div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-row-bordered">
              <thead>
                <tr className="fw-semibold fs-6 text-gray-800">
                  <th>Team Member</th>
                  <th>Role</th>
                  <th>Type</th>
                  <th>Rate</th>
                  <th>Status</th>
                  <th>Start Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => (
                  <tr key={assignment.id}>
                    <td>
                      <div className="d-flex align-items-center">
                        <i className={`ki-duotone ${getRoleIcon(assignment.role)} fs-2 ${getRoleColor(assignment.role)} me-3`}>
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        <div className="d-flex flex-column">
                          <span className="fw-bold">
                            {assignment.assignment_type === 'internal' ? 
                              `${assignment.user_profile?.first_name || ''} ${assignment.user_profile?.last_name || ''}`.trim() :
                              assignment.contractor_name
                            }
                          </span>
                          {assignment.assignment_type === 'subcontractor' && assignment.contractor_contact && (
                            <span className="text-muted fs-7">{assignment.contractor_contact}</span>
                          )}
                          {assignment.assignment_type === 'internal' && assignment.user_profile?.email && (
                            <span className="text-muted fs-7">{assignment.user_profile.email}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="d-flex flex-column">
                        <span className="badge badge-light-primary">
                          {assignment.role.replace('_', ' ').toUpperCase()}
                        </span>
                        {assignment.trade && (
                          <span className="text-muted fs-8 mt-1">{assignment.trade}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${assignment.assignment_type === 'internal' ? 'badge-light-success' : 'badge-light-info'}`}>
                        {assignment.assignment_type}
                      </span>
                    </td>
                    <td>
                      <span className="fw-bold text-success">
                        {assignment.hourly_rate ? 
                          `$${assignment.hourly_rate}/hr` : 
                          'Not set'
                        }
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${getStatusColor(assignment.status)}`}>
                        {assignment.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className="fw-bold">
                        {assignment.start_date ? 
                          new Date(assignment.start_date).toLocaleDateString() :
                          'Not set'
                        }
                      </span>
                    </td>
                    <td>
                      <div className="d-flex gap-1">
                        {assignment.status === 'assigned' && (
                          <button
                            className="btn btn-sm btn-light-success"
                            onClick={() => handleUpdateAssignmentStatus(assignment.id, 'active')}
                            title="Mark Active"
                          >
                            <i className="ki-duotone ki-play fs-5">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                          </button>
                        )}
                        {assignment.status === 'active' && (
                          <button
                            className="btn btn-sm btn-light-primary"
                            onClick={() => handleUpdateAssignmentStatus(assignment.id, 'completed')}
                            title="Mark Complete"
                          >
                            <i className="ki-duotone ki-check fs-5">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                          </button>
                        )}
                        {(assignment.status === 'assigned' || assignment.status === 'active') && (
                          <button
                            className="btn btn-sm btn-light-danger"
                            onClick={() => handleUpdateAssignmentStatus(assignment.id, 'removed')}
                            title="Remove from Job"
                          >
                            <i className="ki-duotone ki-cross fs-5">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign Team Member Modal */}
      {showAssignModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Assign Team Member</h5>
                <button 
                  className="btn-close"
                  onClick={() => {
                    setShowAssignModal(false)
                    setAssignmentType('')
                  }}
                />
              </div>
              <form onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                const assignmentType = formData.get('assignment_type') as string
                
                const data: any = {
                  role: formData.get('role'),
                  trade: formData.get('trade') || undefined,
                  assignment_type: assignmentType,
                  hourly_rate: formData.get('hourly_rate') ? Number(formData.get('hourly_rate')) : undefined,
                  start_date: formData.get('start_date') || undefined
                }

                if (assignmentType === 'internal') {
                  data.user_id = formData.get('user_id')
                } else {
                  data.contractor_name = formData.get('contractor_name')
                  data.contractor_contact = formData.get('contractor_contact')
                  data.contractor_license = formData.get('contractor_license')
                }

                handleAssignTeamMember(data)
              }}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label required">Assignment Type</label>
                    <select 
                      className="form-select" 
                      name="assignment_type" 
                      value={assignmentType}
                      onChange={(e) => setAssignmentType(e.target.value)}
                      required
                    >
                      <option value="">Select type...</option>
                      <option value="internal">Internal Team Member</option>
                      <option value="subcontractor">Subcontractor</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label required">Role</label>
                    <select className="form-select" name="role" required>
                      <option value="">Select role...</option>
                      {TeamAssignmentService.getAvailableRoles().map(role => (
                        <option key={role.role} value={role.role}>
                          {role.role.replace('_', ' ').toUpperCase()} - {role.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Trade Specialty</label>
                    <select className="form-select" name="trade">
                      <option value="">General/No specialty</option>
                      <option value="electrical">Electrical</option>
                      <option value="plumbing">Plumbing</option>
                      <option value="hvac">HVAC</option>
                      <option value="general">General Construction</option>
                    </select>
                  </div>

                  {/* Conditional fields based on assignment type */}
                  {assignmentType === 'internal' && (
                    <div className="mb-3">
                      <label className="form-label">Team Member</label>
                      <select className="form-select" name="user_id">
                        <option value="">Select team member...</option>
                        {availableTeamMembers.map(member => (
                          <option key={member.id} value={member.id}>
                            {member.first_name} {member.last_name} ({member.email})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {assignmentType === 'subcontractor' && (
                    <>
                      <div className="mb-3">
                        <label className="form-label">Contractor Name</label>
                        <input type="text" className="form-control" name="contractor_name" />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Contact Info</label>
                        <input type="text" className="form-control" name="contractor_contact" 
                               placeholder="Phone or email" />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">License Number</label>
                        <input type="text" className="form-control" name="contractor_license" />
                      </div>
                    </>
                  )}

                  <div className="mb-3">
                    <label className="form-label">Hourly Rate</label>
                    <div className="input-group">
                      <span className="input-group-text">$</span>
                      <input type="number" className="form-control" name="hourly_rate" 
                             step="0.01" placeholder="0.00" />
                      <span className="input-group-text">/hour</span>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Start Date</label>
                    <input type="date" className="form-control" name="start_date" />
                  </div>
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowAssignModal(false)
                      setAssignmentType('')
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Assign Team Member
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