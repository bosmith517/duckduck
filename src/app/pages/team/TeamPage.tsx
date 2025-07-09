import React, { useState, useEffect } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'
import ModernTeamChat from '../../components/communications/ModernTeamChat'
import InstantChatPopup from '../../components/communications/InstantChatPopup'
import RoleAssignmentModal from '../../components/team/RoleAssignmentModal'
import FixOrphanedUsers from '../../components/team/FixOrphanedUsers'
import { AdminPasswordReset, BulkPasswordResetModal } from '../../components/team/AdminPasswordReset'
import { teamMemberService, TeamMember as TeamMemberType, TeamMemberInvite } from '../../services/teamMemberService'
import { communicationsService } from '../../services/communicationsService'

interface TeamMember {
  id: string
  name: string
  email: string
  phone: string
  role: string
  department: string
  status: 'active' | 'inactive' | 'on-leave'
  hireDate: string
  skills: string[]
  currentJobs: number
  completedJobs: number
  avatar?: string
  permissions?: string[]
}

const TeamPage: React.FC = () => {
  
  const [activeTab, setActiveTab] = useState<'directory' | 'chat'>('directory')
  const [activeChatMember, setActiveChatMember] = useState<TeamMember | null>(null)
  const [showAddMemberModal, setShowAddMemberModal] = useState(false)
  const [showEditMemberModal, setShowEditMemberModal] = useState(false)
  const [showAssignJobModal, setShowAssignJobModal] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showRoleAssignmentModal, setShowRoleAssignmentModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showBulkPasswordReset, setShowBulkPasswordReset] = useState(false)
  const [selectedMembers, setSelectedMembers] = useState<TeamMember[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Add Member Form State
  const [addMemberForm, setAddMemberForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: '',
    department: '',
    skills: '',
    hireDate: ''
  })
  
  // Edit Member Form State
  const [editMemberForm, setEditMemberForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    department: '',
    status: '',
    skills: ''
  })
  
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [isLoadingMembers, setIsLoadingMembers] = useState(true)

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      'active': 'badge-light-success',
      'inactive': 'badge-light-danger',
      'on-leave': 'badge-light-warning'
    }
    return `badge ${statusClasses[status as keyof typeof statusClasses]}`
  }

  const getDepartmentColor = (department: string) => {
    const colors = {
      'Operations': 'primary',
      'Construction': 'success',
      'Sales': 'info',
      'Administration': 'warning'
    }
    return colors[department as keyof typeof colors] || 'secondary'
  }

  // Load team members on component mount
  useEffect(() => {
    loadTeamMembers()
  }, [])

  // Load team members from database
  const loadTeamMembers = async () => {
    setIsLoadingMembers(true)
    try {
      const { data, error } = await teamMemberService.getTeamMembers()
      
      if (error) {
        console.error('Error loading team members')
        setError('Failed to load team members')
      } else if (data && data.length > 0) {
        // Convert database format to component format
        const formattedMembers: TeamMember[] = data.map(member => {
          // Handle both full_name and first_name/last_name formats
          let displayName = '';
          if (member.full_name) {
            displayName = member.full_name;
          } else if (member.first_name || member.last_name) {
            displayName = `${member.first_name || ''} ${member.last_name || ''}`.trim();
          } else {
            displayName = member.email || '';
          }

          // Get display role from view or map from database role
          const displayRole = (member as any).display_role || member.role || '';

          return {
            id: member.id || '',
            name: displayName,
            email: member.email || '',
            phone: member.phone || '',
            role: displayRole,
            department: member.department || 'Operations',
            status: member.is_active ? 'active' : 'inactive',
            hireDate: (member as any).hire_date || member.created_at || new Date().toISOString(),
            skills: (member as any).skills || [],
            currentJobs: (member as any).current_jobs || 0,
            completedJobs: (member as any).completed_jobs || 0,
            avatar: member.avatar_url
          };
        })
        setTeamMembers(formattedMembers)
      } else {
        // No team members found
        setTeamMembers([])
      }
    } catch (err) {
      console.error('Error in loadTeamMembers')
      setError('Failed to load team members')
    } finally {
      setIsLoadingMembers(false)
    }
  }

  // Handler functions
  const handleAddMember = () => {
    setShowAddMemberModal(true)
    setError(null)
    setSuccess(null)
  }

  const handleSaveMember = async () => {
    
    setIsLoading(true)
    setError(null)
    
    try {
      // Validate form
      if (!addMemberForm.firstName || !addMemberForm.lastName || !addMemberForm.email || !addMemberForm.role) {
        setError('Please fill in all required fields')
        setIsLoading(false)
        return
      }

      // Map display role to database role
      const roleMapping: { [key: string]: string } = {
        'Administrator': 'admin',
        'Project Manager': 'manager',
        'Site Supervisor': 'supervisor',
        'Lead Carpenter': 'technician',
        'Carpenter': 'field_worker',
        'Electrician': 'technician',
        'Plumber': 'technician',
        'HVAC Technician': 'technician',
        'Estimator': 'estimator',
        'Office Manager': 'manager',
        'Dispatcher': 'dispatcher',
        'Customer Service': 'customer_service',
        'Sales Representative': 'sales',
        'Accounting': 'accounting',
        'Field Worker': 'field_worker',
        'Subcontractor': 'subcontractor'
      }

      // Get the database role or default to 'agent'
      const dbRole = roleMapping[addMemberForm.role] || 'agent'

      // Create team member
      const memberData: TeamMemberInvite = {
        full_name: `${addMemberForm.firstName} ${addMemberForm.lastName}`.trim(),
        email: addMemberForm.email,
        phone: addMemberForm.phone,
        role: dbRole as any,
        department: addMemberForm.department
      }

      const { data, error } = await teamMemberService.createTeamMember(memberData)

      if (error) {
        console.error('Create team member error:', error)
        setError(error.message || 'Failed to add team member')
      } else {
        setSuccess('Team member added successfully! They will receive an invitation email.')
        
        // Reset form
        setAddMemberForm({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          role: '',
          department: '',
          skills: '',
          hireDate: ''
        })
        
        // Reload team members
        await loadTeamMembers()
        
        // Close modal after a short delay
        setTimeout(() => {
          setShowAddMemberModal(false)
          setSuccess(null)
        }, 2000)
      }
    } catch (err) {
      setError('An unexpected error occurred')
      console.error('Error adding team member:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportTeam = () => {
    // Create CSV content
    const headers = ['Name', 'Email', 'Phone', 'Role', 'Department', 'Status', 'Hire Date', 'Current Jobs', 'Completed Jobs', 'Skills']
    const csvContent = [
      headers.join(','),
      ...teamMembers.map(member => [
        member.name,
        member.email,
        member.phone,
        member.role,
        member.department,
        member.status,
        member.hireDate,
        member.currentJobs,
        member.completedJobs,
        `"${member.skills.join('; ')}"`
      ].join(','))
    ].join('\n')

    // Download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `team-directory-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const handleViewProfile = (member: TeamMember) => {
    setSelectedMember(member)
    setShowProfileModal(true)
  }

  const handleEditMember = (member: TeamMember) => {
    setSelectedMember(member)
    setEditMemberForm({
      name: member.name,
      email: member.email,
      phone: member.phone,
      role: member.role,
      department: member.department,
      status: member.status,
      skills: member.skills.join(', ')
    })
    setShowEditMemberModal(true)
    setError(null)
    setSuccess(null)
  }

  const handleUpdateMember = async () => {
    if (!selectedMember) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      // Validate form
      if (!editMemberForm.name || !editMemberForm.email || !editMemberForm.role) {
        setError('Please fill in all required fields')
        setIsLoading(false)
        return
      }

      // Map role to correct format
      let dbRole: 'admin' | 'agent' | 'viewer' = 'viewer'
      if (editMemberForm.role.toLowerCase().includes('admin')) {
        dbRole = 'admin'
      } else if (editMemberForm.role.toLowerCase().includes('manager') || 
                 editMemberForm.role.toLowerCase().includes('lead')) {
        dbRole = 'agent'
      }

      // Update team member
      const updateData: Partial<TeamMemberType> = {
        full_name: editMemberForm.name,
        email: editMemberForm.email,
        phone: editMemberForm.phone,
        role: dbRole,
        department: editMemberForm.department,
        is_active: editMemberForm.status === 'active'
      }

      const { data, error } = await teamMemberService.updateTeamMember(selectedMember.id, updateData)

      if (error) {
        setError(error.message || 'Failed to update team member')
      } else {
        setSuccess('Team member updated successfully!')
        
        // Reload team members
        await loadTeamMembers()
        
        // Close modal after a short delay
        setTimeout(() => {
          setShowEditMemberModal(false)
          setSuccess(null)
        }, 2000)
      }
    } catch (err) {
      setError('An unexpected error occurred')
      console.error('Error updating team member:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAssignJob = (member: TeamMember) => {
    setSelectedMember(member)
    setShowAssignJobModal(true)
  }

  const handleAssignRole = (member: TeamMember) => {
    setSelectedMember(member)
    setShowRoleAssignmentModal(true)
  }

  const handleRoleSave = (userId: string, role: string, permissions: string[]) => {
    // Here you would typically make an API call to update the user's role and permissions
    // For demo purposes, we'll just log it
    // In production, this would call your backend API
    setShowRoleAssignmentModal(false)
  }

  const handleDeleteMember = (member: TeamMember) => {
    setMemberToDelete(member)
    setShowDeleteConfirm(true)
  }

  const confirmDeleteMember = async () => {
    if (!memberToDelete) return
    
    setIsDeleting(true)
    setError(null)
    
    try {
      const { success, error } = await teamMemberService.deleteTeamMember(memberToDelete.id)
      
      if (error) {
        setError(error.message || 'Failed to delete team member')
      } else {
        setSuccess('Team member deleted successfully')
        await loadTeamMembers()
        setShowDeleteConfirm(false)
        setMemberToDelete(null)
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err) {
      setError('An unexpected error occurred')
      console.error('Error deleting team member:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeactivateMember = async (member: TeamMember) => {
    try {
      const { data, error } = await teamMemberService.deactivateTeamMember(member.id)
      
      if (error) {
        setError(error.message || 'Failed to deactivate team member')
      } else {
        setSuccess('Team member deactivated successfully')
        await loadTeamMembers()
      }
    } catch (err) {
      setError('An unexpected error occurred')
      console.error('Error deactivating team member:', err)
    }
  }

  return (
    <>
      <PageTitle breadcrumbs={[]}>Team Management</PageTitle>
      
      {/* Tab Navigation */}
      <div className="d-flex justify-content-center mb-6">
        <ul className="nav nav-pills nav-line-tabs nav-line-tabs-2x border-transparent fs-6 fw-bold">
          <li className="nav-item">
            <button 
              className={`nav-link border-0 bg-transparent ${activeTab === 'directory' ? 'active' : 'text-muted'}`}
              onClick={() => setActiveTab('directory')}
            >
              <i className="ki-duotone ki-people fs-4 me-2">
                <span className="path1"></span>
                <span className="path2"></span>
                <span className="path3"></span>
                <span className="path4"></span>
                <span className="path5"></span>
              </i>
              Team Directory
            </button>
          </li>
          <li className="nav-item">
            <button 
              className={`nav-link border-0 bg-transparent ${activeTab === 'chat' ? 'active' : 'text-muted'}`}
              onClick={() => setActiveTab('chat')}
            >
              <i className="ki-duotone ki-message-text fs-4 me-2">
                <span className="path1"></span>
                <span className="path2"></span>
                <span className="path3"></span>
              </i>
              Team Chat
            </button>
          </li>
        </ul>
      </div>

      {activeTab === 'directory' && (
        <div className='row g-5 g-xl-8'>
          <div className='col-xl-12'>
            {/* Fix Orphaned Users Component */}
            <div className='mb-5'>
              <FixOrphanedUsers />
            </div>
            
            <KTCard>
            <div className='card-header border-0 pt-5'>
              <h3 className='card-title align-items-start flex-column'>
                <span className='card-label fw-bold fs-3 mb-1'>Team Directory - LIVE UPDATE TEST</span>
                <span className='text-muted mt-1 fw-semibold fs-7'>Manage your workforce</span>
              </h3>
              <div className='card-toolbar'>
                <button 
                  className='btn btn-sm btn-light me-3'
                  onClick={handleExportTeam}
                >
                  <i className='ki-duotone ki-exit-down fs-2'></i>
                  Export
                </button>
                {selectedMembers.length > 0 && (
                  <button 
                    className='btn btn-sm btn-light-warning me-3'
                    onClick={() => setShowBulkPasswordReset(true)}
                  >
                    <i className='ki-duotone ki-key fs-2'></i>
                    Reset Passwords ({selectedMembers.length})
                  </button>
                )}
                <button 
                  className='btn btn-sm btn-primary'
                  onClick={handleAddMember}
                >
                  <i className='ki-duotone ki-plus fs-2'></i>
                  Add Member
                </button>
              </div>
            </div>
            <KTCardBody className='py-3'>
              <div className='table-responsive'>
                <table className='table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4'>
                  <thead>
                    <tr className='fw-bold text-muted'>
                      <th className='w-10px pe-2'>
                        <div className='form-check form-check-sm form-check-custom form-check-solid me-3'>
                          <input
                            className='form-check-input'
                            type='checkbox'
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedMembers(teamMembers)
                              } else {
                                setSelectedMembers([])
                              }
                            }}
                            checked={selectedMembers.length === teamMembers.length && teamMembers.length > 0}
                          />
                        </div>
                      </th>
                      <th className='min-w-200px'>Team Member</th>
                      <th className='min-w-150px'>Contact</th>
                      <th className='min-w-120px'>Role</th>
                      <th className='min-w-120px'>Department</th>
                      <th className='min-w-120px'>Status</th>
                      <th className='min-w-100px'>Current Jobs</th>
                      <th className='min-w-120px'>Completed</th>
                      <th className='min-w-200px'>Skills</th>
                      <th className='min-w-100px text-end'>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamMembers.map((member) => (
                      <tr key={member.id}>
                        <td>
                          <div className='form-check form-check-sm form-check-custom form-check-solid'>
                            <input
                              className='form-check-input'
                              type='checkbox'
                              checked={selectedMembers.some(m => m.id === member.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedMembers([...selectedMembers, member])
                                } else {
                                  setSelectedMembers(selectedMembers.filter(m => m.id !== member.id))
                                }
                              }}
                            />
                          </div>
                        </td>
                        <td>
                          <div className='d-flex align-items-center'>
                            <div className='symbol symbol-45px me-5'>
                              <div className={`symbol-label bg-light-${getDepartmentColor(member.department)} text-${getDepartmentColor(member.department)} fw-bold`}>
                                {member.name.split(' ').map(n => n[0]).join('')}
                              </div>
                            </div>
                            <div className='d-flex justify-content-start flex-column'>
                              <a href='#' className='text-dark fw-bold text-hover-primary fs-6'>
                                {member.name}
                              </a>
                              <span className='text-muted fw-semibold fs-7'>
                                Hired: {new Date(member.hireDate).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className='d-flex flex-column'>
                            <span className='text-dark fw-bold fs-6'>{member.email}</span>
                            <span className='text-muted fw-semibold fs-7'>{member.phone ? communicationsService.formatPhoneNumber(member.phone) : ''}</span>
                          </div>
                        </td>
                        <td>
                          <span className='text-dark fw-bold d-block fs-6'>
                            {member.role}
                          </span>
                        </td>
                        <td>
                          <span className={`badge badge-light-${getDepartmentColor(member.department)}`}>
                            {member.department}
                          </span>
                        </td>
                        <td>
                          <span className={getStatusBadge(member.status)}>
                            {member.status.replace('-', ' ')}
                          </span>
                        </td>
                        <td>
                          <span className='text-dark fw-bold d-block fs-6'>
                            {member.currentJobs}
                          </span>
                        </td>
                        <td>
                          <span className='text-dark fw-bold d-block fs-6'>
                            {member.completedJobs}
                          </span>
                        </td>
                        <td>
                          <div className='d-flex flex-wrap'>
                            {member.skills.slice(0, 2).map((skill, index) => (
                              <span key={index} className='badge badge-light-secondary me-1 mb-1'>
                                {skill}
                              </span>
                            ))}
                            {member.skills.length > 2 && (
                              <span className='badge badge-light-info'>
                                +{member.skills.length - 2} more
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className='d-flex justify-content-end flex-shrink-0'>
                            <button
                              className='btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1'
                              title='Instant Chat'
                              onClick={() => setActiveChatMember(member)}
                            >
                              <i className='ki-duotone ki-message-text-2 fs-3'>
                                <span className='path1'></span>
                                <span className='path2'></span>
                                <span className='path3'></span>
                              </i>
                            </button>
                            <button
                              className='btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1'
                              title='View Profile'
                              onClick={() => handleViewProfile(member)}
                            >
                              <i className='ki-duotone ki-profile-user fs-3'>
                                <span className='path1'></span>
                                <span className='path2'></span>
                                <span className='path3'></span>
                                <span className='path4'></span>
                              </i>
                            </button>
                            <button
                              className='btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1'
                              title='Edit'
                              onClick={() => handleEditMember(member)}
                            >
                              <i className='ki-duotone ki-pencil fs-3'>
                                <span className='path1'></span>
                                <span className='path2'></span>
                              </i>
                            </button>
                            <button
                              className='btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1'
                              title='Assign Job'
                              onClick={() => handleAssignJob(member)}
                            >
                              <i className='ki-duotone ki-briefcase fs-3'>
                                <span className='path1'></span>
                                <span className='path2'></span>
                              </i>
                            </button>
                            <button
                              className='btn btn-icon btn-bg-light btn-active-color-warning btn-sm me-1'
                              title='Assign Role & Permissions'
                              onClick={() => handleAssignRole(member)}
                            >
                              <i className='ki-duotone ki-security-user fs-3'>
                                <span className='path1'></span>
                                <span className='path2'></span>
                              </i>
                            </button>
                            <div className='btn-group'>
                              <button
                                className='btn btn-icon btn-bg-light btn-active-color-warning btn-sm'
                                type='button'
                                data-bs-toggle='dropdown'
                                aria-expanded='false'
                                title='More Actions'
                              >
                                <i className='ki-duotone ki-dots-vertical fs-3'>
                                  <span className='path1'></span>
                                  <span className='path2'></span>
                                  <span className='path3'></span>
                                </i>
                              </button>
                              <ul className='dropdown-menu dropdown-menu-end'>
                                <li>
                                  <AdminPasswordReset 
                                    userEmail={member.email}
                                    userName={member.name}
                                    userId={member.id}
                                  />
                                </li>
                                <li><hr className='dropdown-divider' /></li>
                                <li>
                                  <button
                                    className='dropdown-item'
                                    onClick={() => handleDeactivateMember(member)}
                                    disabled={member.status === 'inactive'}
                                  >
                                    <i className='ki-duotone ki-lock fs-4 me-2'>
                                      <span className='path1'></span>
                                      <span className='path2'></span>
                                    </i>
                                    {member.status === 'inactive' ? 'Already Deactivated' : 'Deactivate User'}
                                  </button>
                                </li>
                                <li>
                                  <button
                                    className='dropdown-item text-danger'
                                    onClick={() => handleDeleteMember(member)}
                                  >
                                    <i className='ki-duotone ki-trash fs-4 me-2'>
                                      <span className='path1'></span>
                                      <span className='path2'></span>
                                      <span className='path3'></span>
                                      <span className='path4'></span>
                                      <span className='path5'></span>
                                    </i>
                                    Delete Permanently
                                  </button>
                                </li>
                              </ul>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </KTCardBody>
          </KTCard>
        </div>
      </div>
      )}

      {activeTab === 'chat' && (
        <div style={{ height: '70vh' }}>
          <ModernTeamChat />
        </div>
      )}

      {/* Instant Chat Popup */}
      {activeChatMember && (
        <InstantChatPopup
          member={{
            id: activeChatMember.id,
            name: activeChatMember.name,
            email: activeChatMember.email,
            avatar: activeChatMember.avatar,
            status: activeChatMember.status === 'active' ? 'online' : 
                   activeChatMember.status === 'on-leave' ? 'away' : 'offline',
            role: activeChatMember.role
          }}
          onClose={() => setActiveChatMember(null)}
        />
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Add New Team Member</h5>
                <button
                  className="btn btn-icon btn-sm btn-active-light-primary ms-2"
                  onClick={() => setShowAddMemberModal(false)}
                >
                  <i className="ki-duotone ki-cross fs-2x">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                </button>
              </div>
              <div className="modal-body">
                {error && (
                  <div className="alert alert-danger mb-4">
                    <div className="alert-text">{error}</div>
                  </div>
                )}
                {success && (
                  <div className="alert alert-success mb-4">
                    <div className="alert-text">{success}</div>
                  </div>
                )}
                <form>
                  <div className="row mb-4">
                    <div className="col-md-6">
                      <label className="form-label required">First Name</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="Enter first name"
                        value={addMemberForm.firstName}
                        onChange={(e) => setAddMemberForm({...addMemberForm, firstName: e.target.value})}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label required">Last Name</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="Enter last name"
                        value={addMemberForm.lastName}
                        onChange={(e) => setAddMemberForm({...addMemberForm, lastName: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="row mb-4">
                    <div className="col-md-6">
                      <label className="form-label required">Email</label>
                      <input 
                        type="email" 
                        className="form-control" 
                        placeholder="Enter email address"
                        value={addMemberForm.email}
                        onChange={(e) => setAddMemberForm({...addMemberForm, email: e.target.value})}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Phone</label>
                      <input 
                        type="tel" 
                        className="form-control" 
                        placeholder="Enter phone number"
                        value={addMemberForm.phone}
                        onChange={(e) => setAddMemberForm({...addMemberForm, phone: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="row mb-4">
                    <div className="col-md-6">
                      <label className="form-label required">Role</label>
                      <select 
                        className="form-select"
                        value={addMemberForm.role}
                        onChange={(e) => setAddMemberForm({...addMemberForm, role: e.target.value})}
                      >
                        <option value="">Select role</option>
                        <option value="Administrator">Administrator</option>
                        <option value="Project Manager">Project Manager</option>
                        <option value="Site Supervisor">Site Supervisor</option>
                        <option value="Lead Carpenter">Lead Carpenter</option>
                        <option value="Carpenter">Carpenter</option>
                        <option value="Electrician">Electrician</option>
                        <option value="Plumber">Plumber</option>
                        <option value="HVAC Technician">HVAC Technician</option>
                        <option value="Estimator">Estimator</option>
                        <option value="Office Manager">Office Manager</option>
                        <option value="Dispatcher">Dispatcher</option>
                        <option value="Customer Service">Customer Service</option>
                        <option value="Sales Representative">Sales Representative</option>
                        <option value="Accounting">Accounting</option>
                        <option value="Field Worker">Field Worker</option>
                        <option value="Subcontractor">Subcontractor</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Department</label>
                      <select 
                        className="form-select"
                        value={addMemberForm.department}
                        onChange={(e) => setAddMemberForm({...addMemberForm, department: e.target.value})}
                      >
                        <option value="">Select department</option>
                        <option value="Operations">Operations</option>
                        <option value="Construction">Construction</option>
                        <option value="Sales">Sales</option>
                        <option value="Administration">Administration</option>
                      </select>
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="form-label">Skills (comma separated)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g., Carpentry, Project Management, Client Relations"
                      value={addMemberForm.skills}
                      onChange={(e) => setAddMemberForm({...addMemberForm, skills: e.target.value})}
                    />
                  </div>
                  <div className="mb-4">
                    <label className="form-label">Hire Date</label>
                    <input 
                      type="date" 
                      className="form-control"
                      value={addMemberForm.hireDate}
                      onChange={(e) => setAddMemberForm({...addMemberForm, hireDate: e.target.value})}
                    />
                  </div>
                </form>
              </div>
              <div className="modal-footer">
                <button 
                  className="btn btn-light" 
                  onClick={() => setShowAddMemberModal(false)}
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    handleSaveMember();
                  }}
                  disabled={isLoading}
                  type="button"
                >
                  {isLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Adding...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-plus me-2"></i>
                      Add Member
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Profile Modal */}
      {showProfileModal && selectedMember && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Team Member Profile</h5>
                <button
                  className="btn btn-icon btn-sm btn-active-light-primary ms-2"
                  onClick={() => setShowProfileModal(false)}
                >
                  <i className="ki-duotone ki-cross fs-2x">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                </button>
              </div>
              <div className="modal-body">
                <div className="text-center mb-6">
                  <div className={`symbol symbol-100px symbol-circle bg-light-${getDepartmentColor(selectedMember.department)} mb-3`}>
                    <div className={`symbol-label fs-1 fw-bold text-${getDepartmentColor(selectedMember.department)}`}>
                      {selectedMember.name.split(' ').map(n => n[0]).join('')}
                    </div>
                  </div>
                  <h3 className="mb-2">{selectedMember.name}</h3>
                  <span className="text-muted fs-6">{selectedMember.role}</span>
                </div>
                
                <div className="row mb-4">
                  <div className="col-md-6">
                    <label className="form-label text-muted">Email</label>
                    <p className="fw-bold">{selectedMember.email}</p>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label text-muted">Phone</label>
                    <p className="fw-bold">{selectedMember.phone ? communicationsService.formatPhoneNumber(selectedMember.phone) : 'Not provided'}</p>
                  </div>
                </div>
                
                <div className="row mb-4">
                  <div className="col-md-6">
                    <label className="form-label text-muted">Department</label>
                    <p><span className={`badge badge-light-${getDepartmentColor(selectedMember.department)}`}>{selectedMember.department}</span></p>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label text-muted">Status</label>
                    <p><span className={getStatusBadge(selectedMember.status)}>{selectedMember.status.replace('-', ' ')}</span></p>
                  </div>
                </div>
                
                <div className="row mb-4">
                  <div className="col-md-4">
                    <label className="form-label text-muted">Hire Date</label>
                    <p className="fw-bold">{new Date(selectedMember.hireDate).toLocaleDateString()}</p>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label text-muted">Current Jobs</label>
                    <p className="fw-bold text-primary fs-2">{selectedMember.currentJobs}</p>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label text-muted">Completed Jobs</label>
                    <p className="fw-bold text-success fs-2">{selectedMember.completedJobs}</p>
                  </div>
                </div>
                
                <div className="mb-4">
                  <label className="form-label text-muted">Skills</label>
                  <div className="d-flex flex-wrap">
                    {selectedMember.skills.map((skill, index) => (
                      <span key={index} className="badge badge-light-secondary me-2 mb-2">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-light" onClick={() => setShowProfileModal(false)}>
                  Close
                </button>
                <button className="btn btn-primary" onClick={() => { setShowProfileModal(false); handleEditMember(selectedMember); }}>
                  Edit Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      {showEditMemberModal && selectedMember && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Edit Team Member</h5>
                <button
                  className="btn btn-icon btn-sm btn-active-light-primary ms-2"
                  onClick={() => setShowEditMemberModal(false)}
                >
                  <i className="ki-duotone ki-cross fs-2x">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                </button>
              </div>
              <div className="modal-body">
                {error && (
                  <div className="alert alert-danger mb-4">
                    <div className="alert-text">{error}</div>
                  </div>
                )}
                {success && (
                  <div className="alert alert-success mb-4">
                    <div className="alert-text">{success}</div>
                  </div>
                )}
                <form>
                  <div className="row mb-4">
                    <div className="col-md-6">
                      <label className="form-label required">Name</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={editMemberForm.name}
                        onChange={(e) => setEditMemberForm({...editMemberForm, name: e.target.value})}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label required">Email</label>
                      <input 
                        type="email" 
                        className="form-control" 
                        value={editMemberForm.email}
                        onChange={(e) => setEditMemberForm({...editMemberForm, email: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="row mb-4">
                    <div className="col-md-6">
                      <label className="form-label">Phone</label>
                      <input 
                        type="tel" 
                        className="form-control" 
                        value={editMemberForm.phone}
                        onChange={(e) => setEditMemberForm({...editMemberForm, phone: e.target.value})}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label required">Role</label>
                      <select 
                        className="form-select" 
                        value={editMemberForm.role}
                        onChange={(e) => setEditMemberForm({...editMemberForm, role: e.target.value})}
                      >
                        <option value="Project Manager">Project Manager</option>
                        <option value="Lead Carpenter">Lead Carpenter</option>
                        <option value="Carpenter">Carpenter</option>
                        <option value="Electrician">Electrician</option>
                        <option value="Plumber">Plumber</option>
                        <option value="Estimator">Estimator</option>
                        <option value="Office Manager">Office Manager</option>
                        <option value="Administrator">Administrator</option>
                      </select>
                    </div>
                  </div>
                  <div className="row mb-4">
                    <div className="col-md-6">
                      <label className="form-label">Department</label>
                      <select 
                        className="form-select" 
                        value={editMemberForm.department}
                        onChange={(e) => setEditMemberForm({...editMemberForm, department: e.target.value})}
                      >
                        <option value="Operations">Operations</option>
                        <option value="Construction">Construction</option>
                        <option value="Sales">Sales</option>
                        <option value="Administration">Administration</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Status</label>
                      <select 
                        className="form-select" 
                        value={editMemberForm.status}
                        onChange={(e) => setEditMemberForm({...editMemberForm, status: e.target.value})}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="on-leave">On Leave</option>
                      </select>
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="form-label">Skills (comma separated)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={editMemberForm.skills}
                      onChange={(e) => setEditMemberForm({...editMemberForm, skills: e.target.value})}
                    />
                  </div>
                </form>
              </div>
              <div className="modal-footer">
                <button 
                  className="btn btn-light" 
                  onClick={() => setShowEditMemberModal(false)}
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={handleUpdateMember}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-save me-2"></i>
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Job Modal */}
      {showAssignJobModal && selectedMember && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Assign Job to {selectedMember.name}</h5>
                <button
                  className="btn btn-icon btn-sm btn-active-light-primary ms-2"
                  onClick={() => setShowAssignJobModal(false)}
                >
                  <i className="ki-duotone ki-cross fs-2x">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                </button>
              </div>
              <div className="modal-body">
                <div className="mb-4">
                  <label className="form-label required">Select Job</label>
                  <select className="form-select">
                    <option value="">Choose a job to assign</option>
                    <option value="1">Kitchen Renovation - Smith Residence</option>
                    <option value="2">Bathroom Remodel - Johnson Home</option>
                    <option value="3">Deck Installation - Brown Property</option>
                    <option value="4">Electrical Upgrade - Davis House</option>
                    <option value="5">Plumbing Repair - Wilson Building</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label className="form-label">Role on Job</label>
                  <select className="form-select">
                    <option value="lead">Lead</option>
                    <option value="assistant">Assistant</option>
                    <option value="specialist">Specialist</option>
                    <option value="supervisor">Supervisor</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label className="form-label">Priority</label>
                  <select className="form-select">
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label className="form-label">Notes</label>
                  <textarea className="form-control" rows={3} placeholder="Additional notes for this assignment..."></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-light" onClick={() => setShowAssignJobModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary">
                  Assign Job
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Role Assignment Modal */}
      <RoleAssignmentModal
        show={showRoleAssignmentModal}
        onHide={() => setShowRoleAssignmentModal(false)}
        user={selectedMember ? {
          id: selectedMember.id,
          name: selectedMember.name,
          email: selectedMember.email,
          role: selectedMember.role,
          permissions: selectedMember.permissions || []
        } : null}
        onSave={handleRoleSave}
      />

      {/* Bulk Password Reset Modal */}
      <BulkPasswordResetModal
        show={showBulkPasswordReset}
        onClose={() => {
          setShowBulkPasswordReset(false)
          setSelectedMembers([])
        }}
        selectedUsers={selectedMembers.map(m => ({
          email: m.email,
          name: m.name
        }))}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && memberToDelete && (
        <div className="modal d-block" tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Delete Team Member</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setMemberToDelete(null)
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-danger d-flex align-items-center mb-5">
                  <i className="ki-duotone ki-information-5 fs-2hx text-danger me-4">
                    <span className="path1"></span>
                    <span className="path2"></span>
                    <span className="path3"></span>
                  </i>
                  <div className="d-flex flex-column">
                    <h4 className="mb-1 text-danger">Warning</h4>
                    <span>This action cannot be undone!</span>
                  </div>
                </div>
                
                <p>Are you sure you want to permanently delete <strong>{memberToDelete.name}</strong>?</p>
                <p className="text-muted">
                  This will remove their account, profile, and all associated data from the system.
                </p>
                
                {memberToDelete.currentJobs > 0 && (
                  <div className="alert alert-warning">
                    <i className="ki-duotone ki-warning fs-5 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    This member has {memberToDelete.currentJobs} active job(s) assigned.
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  className="btn btn-light" 
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setMemberToDelete(null)
                  }}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-danger"
                  onClick={confirmDeleteMember}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <i className="ki-duotone ki-trash fs-4 me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                        <span className="path3"></span>
                        <span className="path4"></span>
                        <span className="path5"></span>
                      </i>
                      Delete Permanently
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success/Error Alerts */}
      {success && (
        <div className="position-fixed bottom-0 end-0 p-3" style={{ zIndex: 1090 }}>
          <div className="alert alert-success alert-dismissible fade show" role="alert">
            <i className="ki-duotone ki-check-circle fs-2hx text-success me-3">
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
            {success}
          </div>
        </div>
      )}
      
      {error && (
        <div className="position-fixed bottom-0 end-0 p-3" style={{ zIndex: 1090 }}>
          <div className="alert alert-danger alert-dismissible fade show" role="alert">
            <i className="ki-duotone ki-cross-circle fs-2hx text-danger me-3">
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
            {error}
            <button 
              type="button" 
              className="btn-close" 
              onClick={() => setError(null)}
            ></button>
          </div>
        </div>
      )}
    </>
  )
}

export default TeamPage
