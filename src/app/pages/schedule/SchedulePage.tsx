import React, { useState } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'

interface ScheduleEvent {
  id: string
  title: string
  client: string
  jobId: string
  type: 'meeting' | 'work' | 'inspection' | 'delivery'
  startTime: string
  endTime: string
  date: string
  location: string
  assignedTo: string[]
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled'
  notes: string
}

const SchedulePage: React.FC = () => {
  const [events] = useState<ScheduleEvent[]>([
    {
      id: '1',
      title: 'Kitchen Installation',
      client: 'Smith Family',
      jobId: 'JOB-001',
      type: 'work',
      startTime: '08:00',
      endTime: '16:00',
      date: '2024-02-15',
      location: '123 Main St, Springfield, IL',
      assignedTo: ['John Doe', 'Mike Wilson'],
      status: 'scheduled',
      notes: 'Install kitchen cabinets and countertops'
    },
    {
      id: '2',
      title: 'Client Meeting',
      client: 'Johnson Residence',
      jobId: 'JOB-002',
      type: 'meeting',
      startTime: '10:00',
      endTime: '11:00',
      date: '2024-02-16',
      location: '456 Oak Ave, Springfield, IL',
      assignedTo: ['Sarah Johnson'],
      status: 'scheduled',
      notes: 'Discuss bathroom renovation plans'
    },
    {
      id: '3',
      title: 'Material Delivery',
      client: 'Williams Property',
      jobId: 'JOB-003',
      type: 'delivery',
      startTime: '09:00',
      endTime: '10:00',
      date: '2024-02-17',
      location: '789 Pine Rd, Springfield, IL',
      assignedTo: ['Delivery Team'],
      status: 'scheduled',
      notes: 'Deck materials delivery'
    },
    {
      id: '4',
      title: 'Final Inspection',
      client: 'Davis Home',
      jobId: 'JOB-004',
      type: 'inspection',
      startTime: '14:00',
      endTime: '15:00',
      date: '2024-02-18',
      location: '321 Elm St, Springfield, IL',
      assignedTo: ['Inspector Smith'],
      status: 'completed',
      notes: 'Final inspection for roof repair'
    }
  ])

  const getTypeIcon = (type: string) => {
    const icons = {
      'meeting': 'ki-people',
      'work': 'ki-hammer',
      'inspection': 'ki-search-list',
      'delivery': 'ki-delivery'
    }
    return icons[type as keyof typeof icons] || 'ki-calendar'
  }

  const getTypeBadge = (type: string) => {
    const badges = {
      'meeting': 'badge-light-info',
      'work': 'badge-light-primary',
      'inspection': 'badge-light-warning',
      'delivery': 'badge-light-success'
    }
    return `badge ${badges[type as keyof typeof badges]}`
  }

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      'scheduled': 'badge-light-info',
      'in-progress': 'badge-light-primary',
      'completed': 'badge-light-success',
      'cancelled': 'badge-light-danger'
    }
    return `badge ${statusClasses[status as keyof typeof statusClasses]}`
  }

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  return (
    <>
      <PageTitle breadcrumbs={[]}>Schedule Management</PageTitle>
      
      <div className='row g-5 g-xl-8'>
        <div className='col-xl-12'>
          <KTCard>
            <div className='card-header border-0 pt-5'>
              <h3 className='card-title align-items-start flex-column'>
                <span className='card-label fw-bold fs-3 mb-1'>Project Schedule</span>
                <span className='text-muted mt-1 fw-semibold fs-7'>Manage appointments and work schedules</span>
              </h3>
              <div className='card-toolbar'>
                <button className='btn btn-sm btn-light me-3'>
                  <i className='ki-duotone ki-calendar fs-2'></i>
                  Calendar View
                </button>
                <button className='btn btn-sm btn-primary'>
                  <i className='ki-duotone ki-plus fs-2'></i>
                  New Event
                </button>
              </div>
            </div>
            <KTCardBody className='py-3'>
              <div className='table-responsive'>
                <table className='table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4'>
                  <thead>
                    <tr className='fw-bold text-muted'>
                      <th className='min-w-200px'>Event</th>
                      <th className='min-w-120px'>Type</th>
                      <th className='min-w-120px'>Date</th>
                      <th className='min-w-120px'>Time</th>
                      <th className='min-w-150px'>Assigned To</th>
                      <th className='min-w-120px'>Status</th>
                      <th className='min-w-200px'>Location</th>
                      <th className='min-w-100px text-end'>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((event) => (
                      <tr key={event.id}>
                        <td>
                          <div className='d-flex align-items-center'>
                            <div className='symbol symbol-45px me-5'>
                              <div className='symbol-label bg-light-primary text-primary'>
                                <i className={`ki-duotone ${getTypeIcon(event.type)} fs-2`}>
                                  <span className='path1'></span>
                                  <span className='path2'></span>
                                </i>
                              </div>
                            </div>
                            <div className='d-flex justify-content-start flex-column'>
                              <a href='#' className='text-dark fw-bold text-hover-primary fs-6'>
                                {event.title}
                              </a>
                              <span className='text-muted fw-semibold fs-7'>
                                {event.client} - {event.jobId}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={getTypeBadge(event.type)}>
                            {event.type}
                          </span>
                        </td>
                        <td>
                          <span className='text-dark fw-bold d-block fs-6'>
                            {new Date(event.date).toLocaleDateString()}
                          </span>
                        </td>
                        <td>
                          <div className='d-flex flex-column'>
                            <span className='text-dark fw-bold fs-6'>
                              {formatTime(event.startTime)}
                            </span>
                            <span className='text-muted fw-semibold fs-7'>
                              to {formatTime(event.endTime)}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className='d-flex flex-column'>
                            {event.assignedTo.map((person, index) => (
                              <span key={index} className='text-dark fw-bold fs-6'>
                                {person}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <span className={getStatusBadge(event.status)}>
                            {event.status.replace('-', ' ')}
                          </span>
                        </td>
                        <td>
                          <span className='text-dark fw-bold d-block fs-6'>
                            {event.location}
                          </span>
                        </td>
                        <td>
                          <div className='d-flex justify-content-end flex-shrink-0'>
                            <a
                              href='#'
                              className='btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1'
                              title='Edit Event'
                            >
                              <i className='ki-duotone ki-pencil fs-3'>
                                <span className='path1'></span>
                                <span className='path2'></span>
                              </i>
                            </a>
                            <a
                              href='#'
                              className='btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1'
                              title='Mark Complete'
                            >
                              <i className='ki-duotone ki-check fs-3'>
                                <span className='path1'></span>
                                <span className='path2'></span>
                              </i>
                            </a>
                            <a
                              href='#'
                              className='btn btn-icon btn-bg-light btn-active-color-primary btn-sm'
                              title='Delete'
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
            </KTCardBody>
          </KTCard>
        </div>
      </div>
    </>
  )
}

export default SchedulePage
