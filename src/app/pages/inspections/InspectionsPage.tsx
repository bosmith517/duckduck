import React, { useState, useEffect } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { InspectionService, JobInspection } from '../../services/inspectionService'
import { showToast } from '../../utils/toast'

const InspectionsPage: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  const [inspections, setInspections] = useState<JobInspection[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [selectedInspection, setSelectedInspection] = useState<JobInspection | null>(null)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showResultModal, setShowResultModal] = useState(false)

  useEffect(() => {
    if (userProfile?.tenant_id) {
      loadInspections()
    }
  }, [userProfile?.tenant_id, activeFilter])

  const loadInspections = async () => {
    if (!userProfile?.tenant_id) return

    try {
      setLoading(true)
      let data: JobInspection[]

      if (activeFilter === 'all') {
        data = await InspectionService.getInspectionsByStatus(userProfile.tenant_id, 'pending')
        const scheduled = await InspectionService.getInspectionsByStatus(userProfile.tenant_id, 'scheduled')
        const passed = await InspectionService.getInspectionsByStatus(userProfile.tenant_id, 'passed')
        const failed = await InspectionService.getInspectionsByStatus(userProfile.tenant_id, 'failed')
        data = [...data, ...scheduled, ...passed, ...failed]
      } else if (activeFilter === 'upcoming') {
        data = await InspectionService.getUpcomingInspections(userProfile.tenant_id, 7)
      } else {
        data = await InspectionService.getInspectionsByStatus(userProfile.tenant_id, activeFilter)
      }

      setInspections(data)
    } catch (error) {
      console.error('Error loading inspections:', error)
      showToast.error('Failed to load inspections')
    } finally {
      setLoading(false)
    }
  }

  const handleScheduleInspection = async (scheduleData: any) => {
    if (!selectedInspection) return

    try {
      await InspectionService.scheduleInspection(selectedInspection.id, scheduleData)
      showToast.success('Inspection scheduled successfully')
      setShowScheduleModal(false)
      setSelectedInspection(null)
      loadInspections()
    } catch (error) {
      console.error('Error scheduling inspection:', error)
      showToast.error('Failed to schedule inspection')
    }
  }

  const handleCompleteInspection = async (resultData: any) => {
    if (!selectedInspection) return

    try {
      await InspectionService.completeInspection(selectedInspection.id, resultData)
      showToast.success('Inspection result recorded successfully')
      setShowResultModal(false)
      setSelectedInspection(null)
      loadInspections()
    } catch (error) {
      console.error('Error completing inspection:', error)
      showToast.error('Failed to record inspection result')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'badge-light-warning'
      case 'scheduled': return 'badge-light-info'
      case 'passed': return 'badge-light-success'
      case 'failed': return 'badge-light-danger'
      case 'waived': return 'badge-light-secondary'
      default: return 'badge-light-secondary'
    }
  }

  const getTradeIcon = (trade: string) => {
    switch (trade) {
      case 'electrical': return 'ki-electricity'
      case 'plumbing': return 'ki-drop'
      case 'hvac': return 'ki-wind'
      case 'structural': return 'ki-home'
      case 'roofing': return 'ki-home-2'
      default: return 'ki-verify'
    }
  }

  const filterCounts = {
    all: inspections.length,
    pending: inspections.filter(i => i.status === 'pending').length,
    scheduled: inspections.filter(i => i.status === 'scheduled').length,
    upcoming: inspections.filter(i => 
      i.status === 'scheduled' && 
      i.scheduled_date && 
      new Date(i.scheduled_date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    ).length,
    passed: inspections.filter(i => i.status === 'passed').length,
    failed: inspections.filter(i => i.status === 'failed').length
  }

  const filteredInspections = inspections.filter(inspection => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'upcoming') {
      return inspection.status === 'scheduled' && 
             inspection.scheduled_date && 
             new Date(inspection.scheduled_date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
    return inspection.status === activeFilter
  })

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
      <PageTitle breadcrumbs={[]}>Inspections Dashboard</PageTitle>

      <div className='row g-5 g-xl-8'>
        {/* Filter Tabs */}
        <div className='col-12'>
          <div className='card'>
            <div className='card-header border-0 pt-5'>
              <h3 className='card-title align-items-start flex-column'>
                <span className='card-label fw-bold fs-3 mb-1'>Inspection Management</span>
                <span className='text-muted mt-1 fw-semibold fs-7'>Manage job inspections and schedules</span>
              </h3>
            </div>
            <div className='card-body py-3'>
              <ul className='nav nav-tabs nav-line-tabs nav-line-tabs-2x border-0 fs-4 fw-semibold mb-n2'>
                {[
                  { key: 'all', label: 'All', count: filterCounts.all },
                  { key: 'pending', label: 'Pending', count: filterCounts.pending },
                  { key: 'scheduled', label: 'Scheduled', count: filterCounts.scheduled },
                  { key: 'upcoming', label: 'Upcoming (7 days)', count: filterCounts.upcoming },
                  { key: 'passed', label: 'Passed', count: filterCounts.passed },
                  { key: 'failed', label: 'Failed', count: filterCounts.failed }
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
                        <span className='badge badge-light-primary ms-2'>{filter.count}</span>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Inspections List */}
        <div className='col-12'>
          <KTCard>
            <KTCardBody>
              {filteredInspections.length === 0 ? (
                <div className='text-center py-10'>
                  <div className='text-muted'>No inspections found for the selected filter.</div>
                </div>
              ) : (
                <div className='table-responsive'>
                  <table className='table table-row-bordered table-row-gray-100 align-middle gs-0 gy-3'>
                    <thead>
                      <tr className='fw-bold text-muted'>
                        <th className='min-w-120px'>Job</th>
                        <th className='min-w-100px'>Trade</th>
                        <th className='min-w-80px'>Phase</th>
                        <th className='min-w-80px'>Type</th>
                        <th className='min-w-100px'>Status</th>
                        <th className='min-w-120px'>Scheduled Date</th>
                        <th className='min-w-100px'>Inspector</th>
                        <th className='min-w-100px text-end'>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInspections.map((inspection: any) => (
                        <tr key={inspection.id}>
                          <td>
                            <div className='d-flex align-items-center'>
                              <div className='d-flex justify-content-start flex-column'>
                                <a href={`/jobs/${inspection.job_id}`} className='text-dark fw-bold text-hover-primary fs-6'>
                                  {inspection.jobs?.title || `Job ${inspection.job_id.slice(0, 8)}`}
                                </a>
                                <span className='text-muted fw-semibold text-muted d-block fs-7'>
                                  {inspection.jobs?.account?.name || inspection.jobs?.location_address}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className='d-flex align-items-center'>
                              <i className={`ki-duotone ${getTradeIcon(inspection.trade)} fs-2 text-primary me-2`}>
                                <span className='path1'></span>
                                <span className='path2'></span>
                              </i>
                              <span className='fw-bold text-gray-800'>
                                {inspection.trade}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className='badge badge-light-info'>
                              {inspection.phase}
                            </span>
                          </td>
                          <td>
                            <span className='text-muted fw-semibold'>
                              {inspection.inspection_type}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${getStatusColor(inspection.status)}`}>
                              {inspection.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <span className='text-gray-800 fw-bold'>
                              {inspection.scheduled_date ? 
                                new Date(inspection.scheduled_date).toLocaleDateString() : 
                                '-'
                              }
                            </span>
                          </td>
                          <td>
                            <span className='text-gray-800 fw-bold'>
                              {inspection.inspector_name || '-'}
                            </span>
                          </td>
                          <td className='text-end'>
                            <div className='d-flex justify-content-end flex-shrink-0'>
                              {inspection.status === 'pending' && (
                                <button
                                  className='btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1'
                                  onClick={() => {
                                    setSelectedInspection(inspection)
                                    setShowScheduleModal(true)
                                  }}
                                  title='Schedule Inspection'
                                >
                                  <i className='ki-duotone ki-calendar-add fs-2'>
                                    <span className='path1'></span>
                                    <span className='path2'></span>
                                  </i>
                                </button>
                              )}
                              {inspection.status === 'scheduled' && (
                                <button
                                  className='btn btn-icon btn-bg-light btn-active-color-success btn-sm me-1'
                                  onClick={() => {
                                    setSelectedInspection(inspection)
                                    setShowResultModal(true)
                                  }}
                                  title='Record Result'
                                >
                                  <i className='ki-duotone ki-verify fs-2'>
                                    <span className='path1'></span>
                                    <span className='path2'></span>
                                  </i>
                                </button>
                              )}
                              <a
                                href={`/jobs/${inspection.job_id}`}
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

      {/* Schedule Inspection Modal */}
      {showScheduleModal && selectedInspection && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Schedule {selectedInspection.trade} {selectedInspection.phase} Inspection
                </h5>
                <button 
                  className="btn-close"
                  onClick={() => setShowScheduleModal(false)}
                />
              </div>
              <form onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                handleScheduleInspection({
                  scheduled_date: formData.get('scheduled_date'),
                  inspector_name: formData.get('inspector_name'),
                  inspector_contact: formData.get('inspector_contact'),
                  notes: formData.get('notes')
                })
              }}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label required">Scheduled Date & Time</label>
                    <input 
                      type="datetime-local" 
                      className="form-control" 
                      name="scheduled_date"
                      required 
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label required">Inspector Name</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      name="inspector_name"
                      required 
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Inspector Contact</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      name="inspector_contact"
                      placeholder="Phone or email"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Notes</label>
                    <textarea 
                      className="form-control" 
                      name="notes"
                      rows={3}
                      placeholder="Any special instructions or requirements"
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => setShowScheduleModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Schedule Inspection
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Record Result Modal */}
      {showResultModal && selectedInspection && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Record Inspection Result
                </h5>
                <button 
                  className="btn-close"
                  onClick={() => setShowResultModal(false)}
                />
              </div>
              <form onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                const punchList = formData.get('punch_list') as string
                handleCompleteInspection({
                  result: formData.get('result'),
                  notes: formData.get('notes'),
                  punch_list: punchList ? punchList.split('\n').filter(item => item.trim()) : [],
                  certificate_number: formData.get('certificate_number')
                })
              }}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label required">Result</label>
                    <select className="form-select" name="result" required>
                      <option value="">Select result...</option>
                      <option value="pass">Pass</option>
                      <option value="fail">Fail</option>
                      <option value="conditional">Conditional Pass</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Certificate Number</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      name="certificate_number"
                      placeholder="Official certificate or permit number"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Punch List Items</label>
                    <textarea 
                      className="form-control" 
                      name="punch_list"
                      rows={4}
                      placeholder="Enter each item on a new line..."
                    />
                    <div className="form-text">
                      Enter each punch list item on a separate line (only for failed or conditional inspections)
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Notes</label>
                    <textarea 
                      className="form-control" 
                      name="notes"
                      rows={3}
                      placeholder="Additional notes about the inspection"
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => setShowResultModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Record Result
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

export default InspectionsPage