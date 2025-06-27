import React, { useState } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'

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
}

const TeamPage: React.FC = () => {
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

  return (
    <>
      <PageTitle breadcrumbs={[]}>Team Management</PageTitle>
      
      <div className='row g-5 g-xl-8'>
        <div className='col-xl-12'>
          <KTCard>
            <div className='card-header border-0 pt-5'>
              <h3 className='card-title align-items-start flex-column'>
                <span className='card-label fw-bold fs-3 mb-1'>Team Directory</span>
                <span className='text-muted mt-1 fw-semibold fs-7'>Manage your workforce</span>
              </h3>
              <div className='card-toolbar'>
                <button className='btn btn-sm btn-light me-3'>
                  <i className='ki-duotone ki-exit-down fs-2'></i>
                  Export
                </button>
                <button className='btn btn-sm btn-primary'>
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
                            <a
                              href='#'
                              className='btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1'
                              title='View Profile'
                            >
                              <i className='ki-duotone ki-profile-user fs-3'>
                                <span className='path1'></span>
                                <span className='path2'></span>
                                <span className='path3'></span>
                                <span className='path4'></span>
                              </i>
                            </a>
                            <a
                              href='#'
                              className='btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1'
                              title='Edit'
                            >
                              <i className='ki-duotone ki-pencil fs-3'>
                                <span className='path1'></span>
                                <span className='path2'></span>
                              </i>
                            </a>
                            <a
                              href='#'
                              className='btn btn-icon btn-bg-light btn-active-color-primary btn-sm'
                              title='Assign Job'
                            >
                              <i className='ki-duotone ki-briefcase fs-3'>
                                <span className='path1'></span>
                                <span className='path2'></span>
                              </i>
                            </a>
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
    </>
  )
}

export default TeamPage
