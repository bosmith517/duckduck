import React, { useState } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'
import ModernTeamChat from '../../components/communications/ModernTeamChat'
import InstantChatPopup from '../../components/communications/InstantChatPopup'
import RoleAssignmentModal from '../../components/team/RoleAssignmentModal'

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
  const [teamMembers] = useState<TeamMember[]>([
    {
      id: '1',
      name: 'John Doe',
      email: 'john.doe@tradeworkspro.com',
      phone: '(555) 123-4567',
      role: 'Project Manager',
      department: 'Operations',
      status: 'active',
      hireDate: '2022-03-15',
      skills: ['Project Management', 'Client Relations', 'Scheduling'],
      currentJobs: 3,
      completedJobs: 25
    },
    {
      id: '2',
      name: 'Mike Wilson',
      email: 'mike.wilson@tradeworkspro.com',
      phone: '(555) 987-6543',
      role: 'Lead Carpenter',
      department: 'Construction',
      status: 'active',
      hireDate: '2021-08-20',
      skills: ['Carpentry', 'Framing', 'Finish Work'],
      currentJobs: 2,
      completedJobs: 45
    },
    {
      id: '3',
      name: 'Sarah Johnson',
      email: 'sarah.johnson@tradeworkspro.com',
      phone: '(555) 456-7890',
      role: 'Estimator',
      department: 'Sales',
      status: 'active',
      hireDate: '2023-01-10',
      skills: ['Cost Estimation', 'Blueprint Reading', 'Client Consultation'],
      currentJobs: 1,
      completedJobs: 18
    },
    {
      id: '4',
      name: 'Tom Rodriguez',
      email: 'tom.rodriguez@tradeworkspro.com',
      phone: '(555) 321-0987',
      role: 'Electrician',
      department: 'Construction',
      status: 'on-leave',
      hireDate: '2020-11-05',
      skills: ['Electrical Work', 'Wiring', 'Panel Installation'],
      currentJobs: 0,
      completedJobs: 38
    },
    {
      id: '5',
      name: 'Lisa Chen',
      email: 'lisa.chen@tradeworkspro.com',
      phone: '(555) 654-3210',
      role: 'Office Manager',
      department: 'Administration',
      status: 'active',
      hireDate: '2022-06-01',
      skills: ['Administration', 'Scheduling', 'Customer Service'],
      currentJobs: 0,
      completedJobs: 0
    }
  ])

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

  // Handler functions
  const handleAddMember = () => {
    setShowAddMemberModal(true)
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
    setShowEditMemberModal(true)
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
    console.log('Saving role assignment:', { userId, role, permissions })
    // For demo purposes, we'll just log it
    // In production, this would call your backend API
    setShowRoleAssignmentModal(false)
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
            <KTCard>
            <div className='card-header border-0 pt-5'>
              <h3 className='card-title align-items-start flex-column'>
                <span className='card-label fw-bold fs-3 mb-1'>Team Directory</span>
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
                            <span className='text-muted fw-semibold fs-7'>{member.phone}</span>
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
                              className='btn btn-icon btn-bg-light btn-active-color-warning btn-sm'
                              title='Assign Role & Permissions'
                              onClick={() => handleAssignRole(member)}
                            >
                              <i className='ki-duotone ki-security-user fs-3'>
                                <span className='path1'></span>
                                <span className='path2'></span>
                              </i>
                            </button>
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
                <form>
                  <div className="row mb-4">
                    <div className="col-md-6">
                      <label className="form-label required">First Name</label>
                      <input type="text" className="form-control" placeholder="Enter first name" />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label required">Last Name</label>
                      <input type="text" className="form-control" placeholder="Enter last name" />
                    </div>
                  </div>
                  <div className="row mb-4">
                    <div className="col-md-6">
                      <label className="form-label required">Email</label>
                      <input type="email" className="form-control" placeholder="Enter email address" />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label required">Phone</label>
                      <input type="tel" className="form-control" placeholder="Enter phone number" />
                    </div>
                  </div>
                  <div className="row mb-4">
                    <div className="col-md-6">
                      <label className="form-label required">Role</label>
                      <select className="form-select">
                        <option value="">Select role</option>
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
                    <div className="col-md-6">
                      <label className="form-label required">Department</label>
                      <select className="form-select">
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
                    <input type="text" className="form-control" placeholder="e.g., Carpentry, Project Management, Client Relations" />
                  </div>
                  <div className="mb-4">
                    <label className="form-label">Hire Date</label>
                    <input type="date" className="form-control" />
                  </div>
                </form>
              </div>
              <div className="modal-footer">
                <button className="btn btn-light" onClick={() => setShowAddMemberModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary">
                  Add Member
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
                    <p className="fw-bold">{selectedMember.phone}</p>
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
                <form>
                  <div className="row mb-4">
                    <div className="col-md-6">
                      <label className="form-label required">Name</label>
                      <input type="text" className="form-control" defaultValue={selectedMember.name} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label required">Email</label>
                      <input type="email" className="form-control" defaultValue={selectedMember.email} />
                    </div>
                  </div>
                  <div className="row mb-4">
                    <div className="col-md-6">
                      <label className="form-label required">Phone</label>
                      <input type="tel" className="form-control" defaultValue={selectedMember.phone} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label required">Role</label>
                      <select className="form-select" defaultValue={selectedMember.role}>
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
                      <label className="form-label required">Department</label>
                      <select className="form-select" defaultValue={selectedMember.department}>
                        <option value="Operations">Operations</option>
                        <option value="Construction">Construction</option>
                        <option value="Sales">Sales</option>
                        <option value="Administration">Administration</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label required">Status</label>
                      <select className="form-select" defaultValue={selectedMember.status}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="on-leave">On Leave</option>
                      </select>
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="form-label">Skills (comma separated)</label>
                    <input type="text" className="form-control" defaultValue={selectedMember.skills.join(', ')} />
                  </div>
                </form>
              </div>
              <div className="modal-footer">
                <button className="btn btn-light" onClick={() => setShowEditMemberModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary">
                  Save Changes
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
    </>
  )
}

export default TeamPage
