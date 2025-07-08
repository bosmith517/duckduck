import React, { useState, useEffect } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'

interface Permit {
  id: string
  job_id: string
  tenant_id: string
  permit_type: string
  permit_number: string
  status: 'pending' | 'submitted' | 'approved' | 'rejected' | 'expired'
  application_date?: string
  approval_date?: string
  expiry_date?: string
  issuing_authority: string
  fees?: number
  documents?: string[]
  notes?: string
  created_at: string
  updated_at: string
  job?: {
    title: string
    job_number: string
    location_address: string
  }
}

const PermittingProcessPage: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  const [permits, setPermits] = useState<Permit[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedPermit, setSelectedPermit] = useState<Permit | null>(null)
  const [activeFilter, setActiveFilter] = useState('all')
  const [jobs, setJobs] = useState<any[]>([])
  
  const [formData, setFormData] = useState({
    job_id: '',
    permit_type: '',
    permit_number: '',
    issuing_authority: '',
    application_date: '',
    fees: '',
    notes: ''
  })

  useEffect(() => {
    if (userProfile?.tenant_id) {
      loadPermits()
      loadJobs()
    }
  }, [userProfile?.tenant_id, activeFilter])

  const loadPermits = async () => {
    if (!userProfile?.tenant_id) return

    try {
      setLoading(true)
      
      let query = supabase
        .from('job_permits')
        .select(`
          *,
          job:jobs (
            title,
            job_number,
            location_address
          )
        `)
        .eq('tenant_id', userProfile.tenant_id)
        .order('created_at', { ascending: false })

      if (activeFilter !== 'all') {
        query = query.eq('status', activeFilter)
      }

      const { data, error } = await query

      if (error) throw error
      setPermits(data || [])
    } catch (error) {
      console.error('Error loading permits:', error)
      showToast.error('Failed to load permits')
    } finally {
      setLoading(false)
    }
  }

  const loadJobs = async () => {
    if (!userProfile?.tenant_id) return

    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, job_number, location_address')
        .eq('tenant_id', userProfile.tenant_id)
        .in('status', ['pending', 'scheduled', 'in_progress'])
        .order('created_at', { ascending: false })

      if (error) throw error
      setJobs(data || [])
    } catch (error) {
      console.error('Error loading jobs:', error)
    }
  }

  const handleCreatePermit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('job_permits')
        .insert({
          tenant_id: userProfile?.tenant_id,
          job_id: formData.job_id,
          permit_type: formData.permit_type,
          permit_number: formData.permit_number,
          issuing_authority: formData.issuing_authority,
          application_date: formData.application_date,
          fees: formData.fees ? parseFloat(formData.fees) : null,
          notes: formData.notes,
          status: 'pending'
        })
        .select()
        .single()

      if (error) throw error

      showToast.success('Permit application created successfully')
      setShowCreateModal(false)
      setFormData({
        job_id: '',
        permit_type: '',
        permit_number: '',
        issuing_authority: '',
        application_date: '',
        fees: '',
        notes: ''
      })
      loadPermits()
    } catch (error) {
      console.error('Error creating permit:', error)
      showToast.error('Failed to create permit application')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (permitId: string, newStatus: string) => {
    try {
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      }

      if (newStatus === 'approved') {
        updateData.approval_date = new Date().toISOString()
      }

      const { error } = await supabase
        .from('job_permits')
        .update(updateData)
        .eq('id', permitId)

      if (error) throw error

      showToast.success(`Permit status updated to ${newStatus}`)
      loadPermits()
    } catch (error) {
      console.error('Error updating permit:', error)
      showToast.error('Failed to update permit status')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return 'badge-light-warning'
      case 'submitted': return 'badge-light-info'
      case 'approved': return 'badge-light-success'
      case 'rejected': return 'badge-light-danger'
      case 'expired': return 'badge-light-secondary'
      default: return 'badge-light'
    }
  }

  const permitTypes = [
    'Building Permit',
    'Electrical Permit',
    'Plumbing Permit',
    'Mechanical/HVAC Permit',
    'Demolition Permit',
    'Roofing Permit',
    'Fence Permit',
    'Pool/Spa Permit',
    'Sign Permit',
    'Grading Permit',
    'Tree Removal Permit',
    'Special Use Permit'
  ]

  const filterCounts = {
    all: permits.length,
    pending: permits.filter(p => p.status === 'pending').length,
    submitted: permits.filter(p => p.status === 'submitted').length,
    approved: permits.filter(p => p.status === 'approved').length,
    rejected: permits.filter(p => p.status === 'rejected').length,
    expired: permits.filter(p => p.status === 'expired').length
  }

  const filteredPermits = activeFilter === 'all' 
    ? permits 
    : permits.filter(p => p.status === activeFilter)

  return (
    <>
      <PageTitle breadcrumbs={[]}>Permitting Process</PageTitle>

      <div className='row g-5'>
        {/* Stats Cards */}
        <div className='col-12'>
          <div className='row g-5'>
            <div className='col-md-3'>
              <div className='card bg-light-warning'>
                <div className='card-body'>
                  <div className='d-flex align-items-center'>
                    <i className='ki-duotone ki-time fs-2x text-warning me-4'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                    </i>
                    <div>
                      <div className='fs-2 fw-bold text-warning'>{filterCounts.pending}</div>
                      <div className='fs-7 text-muted'>Pending</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className='col-md-3'>
              <div className='card bg-light-info'>
                <div className='card-body'>
                  <div className='d-flex align-items-center'>
                    <i className='ki-duotone ki-send fs-2x text-info me-4'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                    </i>
                    <div>
                      <div className='fs-2 fw-bold text-info'>{filterCounts.submitted}</div>
                      <div className='fs-7 text-muted'>Submitted</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className='col-md-3'>
              <div className='card bg-light-success'>
                <div className='card-body'>
                  <div className='d-flex align-items-center'>
                    <i className='ki-duotone ki-check-circle fs-2x text-success me-4'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                    </i>
                    <div>
                      <div className='fs-2 fw-bold text-success'>{filterCounts.approved}</div>
                      <div className='fs-7 text-muted'>Approved</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className='col-md-3'>
              <div className='card bg-light-danger'>
                <div className='card-body'>
                  <div className='d-flex align-items-center'>
                    <i className='ki-duotone ki-cross-circle fs-2x text-danger me-4'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                    </i>
                    <div>
                      <div className='fs-2 fw-bold text-danger'>{filterCounts.rejected}</div>
                      <div className='fs-7 text-muted'>Rejected</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Permits List */}
        <div className='col-12'>
          <KTCard>
            <div className='card-header border-0 pt-5'>
              <h3 className='card-title align-items-start flex-column'>
                <span className='card-label fw-bold fs-3 mb-1'>Permit Applications</span>
                <span className='text-muted mt-1 fw-semibold fs-7'>Manage all permit applications</span>
              </h3>
              <div className='card-toolbar'>
                <button
                  className='btn btn-primary'
                  onClick={() => setShowCreateModal(true)}
                >
                  <i className='ki-duotone ki-plus fs-2'></i>
                  New Permit Application
                </button>
              </div>
            </div>
            <div className='card-body py-3'>
              {/* Filter Tabs */}
              <ul className='nav nav-tabs nav-line-tabs nav-line-tabs-2x border-0 fs-4 fw-semibold mb-n2'>
                {Object.entries(filterCounts).map(([key, count]) => (
                  <li key={key} className='nav-item'>
                    <a
                      className={`nav-link text-active-primary pb-4 ${activeFilter === key ? 'active' : ''}`}
                      href='#'
                      onClick={(e) => {
                        e.preventDefault()
                        setActiveFilter(key)
                      }}
                    >
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                      {count > 0 && (
                        <span className='badge badge-light-primary ms-2'>{count}</span>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <KTCardBody>
              {loading ? (
                <div className='text-center py-10'>
                  <div className='spinner-border text-primary' role='status'>
                    <span className='visually-hidden'>Loading...</span>
                  </div>
                </div>
              ) : filteredPermits.length === 0 ? (
                <div className='text-center py-10'>
                  <div className='text-muted'>No permits found.</div>
                </div>
              ) : (
                <div className='table-responsive'>
                  <table className='table table-row-bordered table-row-gray-100 align-middle gs-0 gy-3'>
                    <thead>
                      <tr className='fw-bold text-muted'>
                        <th className='min-w-150px'>Job</th>
                        <th className='min-w-120px'>Permit Type</th>
                        <th className='min-w-100px'>Permit #</th>
                        <th className='min-w-120px'>Authority</th>
                        <th className='min-w-100px'>Status</th>
                        <th className='min-w-100px'>Applied</th>
                        <th className='min-w-80px'>Fees</th>
                        <th className='min-w-120px text-end'>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPermits.map(permit => (
                        <tr key={permit.id}>
                          <td>
                            <div className='d-flex flex-column'>
                              <span className='text-dark fw-bold fs-6'>
                                {permit.job?.title || 'Unknown Job'}
                              </span>
                              <span className='text-muted fs-7'>
                                {permit.job?.job_number} - {permit.job?.location_address}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className='text-gray-800 fw-bold'>
                              {permit.permit_type}
                            </span>
                          </td>
                          <td>
                            <span className='text-gray-800'>
                              {permit.permit_number || '-'}
                            </span>
                          </td>
                          <td>
                            <span className='text-gray-800'>
                              {permit.issuing_authority}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${getStatusBadge(permit.status)}`}>
                              {permit.status.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <span className='text-gray-800'>
                              {permit.application_date 
                                ? new Date(permit.application_date).toLocaleDateString()
                                : '-'}
                            </span>
                          </td>
                          <td>
                            <span className='text-gray-800 fw-bold'>
                              {permit.fees ? `$${permit.fees.toFixed(2)}` : '-'}
                            </span>
                          </td>
                          <td className='text-end'>
                            <div className='d-flex justify-content-end gap-2'>
                              {permit.status === 'pending' && (
                                <>
                                  <button
                                    className='btn btn-sm btn-light-info'
                                    onClick={() => handleUpdateStatus(permit.id, 'submitted')}
                                    title='Mark as Submitted'
                                  >
                                    <i className='ki-duotone ki-send fs-4'>
                                      <span className='path1'></span>
                                      <span className='path2'></span>
                                    </i>
                                  </button>
                                </>
                              )}
                              {permit.status === 'submitted' && (
                                <>
                                  <button
                                    className='btn btn-sm btn-light-success'
                                    onClick={() => handleUpdateStatus(permit.id, 'approved')}
                                    title='Mark as Approved'
                                  >
                                    <i className='ki-duotone ki-check fs-4'>
                                      <span className='path1'></span>
                                      <span className='path2'></span>
                                    </i>
                                  </button>
                                  <button
                                    className='btn btn-sm btn-light-danger'
                                    onClick={() => handleUpdateStatus(permit.id, 'rejected')}
                                    title='Mark as Rejected'
                                  >
                                    <i className='ki-duotone ki-cross fs-4'>
                                      <span className='path1'></span>
                                      <span className='path2'></span>
                                    </i>
                                  </button>
                                </>
                              )}
                              <button
                                className='btn btn-sm btn-light-primary'
                                onClick={() => setSelectedPermit(permit)}
                                title='View Details'
                              >
                                <i className='ki-duotone ki-eye fs-4'>
                                  <span className='path1'></span>
                                  <span className='path2'></span>
                                  <span className='path3'></span>
                                </i>
                              </button>
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

      {/* Create Permit Modal */}
      {showCreateModal && (
        <div className='modal show d-block' style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className='modal-dialog modal-lg'>
            <div className='modal-content'>
              <div className='modal-header'>
                <h5 className='modal-title'>New Permit Application</h5>
                <button
                  className='btn-close'
                  onClick={() => setShowCreateModal(false)}
                />
              </div>
              <form onSubmit={handleCreatePermit}>
                <div className='modal-body'>
                  <div className='row g-5'>
                    <div className='col-md-6'>
                      <label className='form-label required'>Job</label>
                      <select
                        className='form-select form-select-solid'
                        value={formData.job_id}
                        onChange={(e) => setFormData({...formData, job_id: e.target.value})}
                        required
                      >
                        <option value=''>Select job...</option>
                        {jobs.map(job => (
                          <option key={job.id} value={job.id}>
                            {job.job_number} - {job.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className='col-md-6'>
                      <label className='form-label required'>Permit Type</label>
                      <select
                        className='form-select form-select-solid'
                        value={formData.permit_type}
                        onChange={(e) => setFormData({...formData, permit_type: e.target.value})}
                        required
                      >
                        <option value=''>Select type...</option>
                        {permitTypes.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                    <div className='col-md-6'>
                      <label className='form-label'>Permit Number</label>
                      <input
                        type='text'
                        className='form-control form-control-solid'
                        placeholder='Enter permit number'
                        value={formData.permit_number}
                        onChange={(e) => setFormData({...formData, permit_number: e.target.value})}
                      />
                    </div>
                    <div className='col-md-6'>
                      <label className='form-label required'>Issuing Authority</label>
                      <input
                        type='text'
                        className='form-control form-control-solid'
                        placeholder='e.g., City Building Department'
                        value={formData.issuing_authority}
                        onChange={(e) => setFormData({...formData, issuing_authority: e.target.value})}
                        required
                      />
                    </div>
                    <div className='col-md-6'>
                      <label className='form-label'>Application Date</label>
                      <input
                        type='date'
                        className='form-control form-control-solid'
                        value={formData.application_date}
                        onChange={(e) => setFormData({...formData, application_date: e.target.value})}
                      />
                    </div>
                    <div className='col-md-6'>
                      <label className='form-label'>Fees</label>
                      <input
                        type='number'
                        className='form-control form-control-solid'
                        placeholder='0.00'
                        step='0.01'
                        value={formData.fees}
                        onChange={(e) => setFormData({...formData, fees: e.target.value})}
                      />
                    </div>
                    <div className='col-12'>
                      <label className='form-label'>Notes</label>
                      <textarea
                        className='form-control form-control-solid'
                        rows={3}
                        placeholder='Additional notes...'
                        value={formData.notes}
                        onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
                <div className='modal-footer'>
                  <button
                    type='button'
                    className='btn btn-light'
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type='submit'
                    className='btn btn-primary'
                    disabled={loading}
                  >
                    Create Application
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Permit Details Modal */}
      {selectedPermit && (
        <div className='modal show d-block' style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className='modal-dialog'>
            <div className='modal-content'>
              <div className='modal-header'>
                <h5 className='modal-title'>Permit Details</h5>
                <button
                  className='btn-close'
                  onClick={() => setSelectedPermit(null)}
                />
              </div>
              <div className='modal-body'>
                <div className='mb-4'>
                  <label className='form-label fw-bold'>Job</label>
                  <div className='text-gray-800'>
                    {selectedPermit.job?.title}<br />
                    <span className='text-muted'>
                      {selectedPermit.job?.job_number} - {selectedPermit.job?.location_address}
                    </span>
                  </div>
                </div>
                <div className='mb-4'>
                  <label className='form-label fw-bold'>Permit Type</label>
                  <div className='text-gray-800'>{selectedPermit.permit_type}</div>
                </div>
                <div className='mb-4'>
                  <label className='form-label fw-bold'>Permit Number</label>
                  <div className='text-gray-800'>{selectedPermit.permit_number || 'Not assigned'}</div>
                </div>
                <div className='mb-4'>
                  <label className='form-label fw-bold'>Status</label>
                  <div>
                    <span className={`badge ${getStatusBadge(selectedPermit.status)}`}>
                      {selectedPermit.status.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className='mb-4'>
                  <label className='form-label fw-bold'>Issuing Authority</label>
                  <div className='text-gray-800'>{selectedPermit.issuing_authority}</div>
                </div>
                {selectedPermit.application_date && (
                  <div className='mb-4'>
                    <label className='form-label fw-bold'>Application Date</label>
                    <div className='text-gray-800'>
                      {new Date(selectedPermit.application_date).toLocaleDateString()}
                    </div>
                  </div>
                )}
                {selectedPermit.approval_date && (
                  <div className='mb-4'>
                    <label className='form-label fw-bold'>Approval Date</label>
                    <div className='text-gray-800'>
                      {new Date(selectedPermit.approval_date).toLocaleDateString()}
                    </div>
                  </div>
                )}
                {selectedPermit.fees && (
                  <div className='mb-4'>
                    <label className='form-label fw-bold'>Fees</label>
                    <div className='text-gray-800'>${selectedPermit.fees.toFixed(2)}</div>
                  </div>
                )}
                {selectedPermit.notes && (
                  <div className='mb-4'>
                    <label className='form-label fw-bold'>Notes</label>
                    <div className='text-gray-800'>{selectedPermit.notes}</div>
                  </div>
                )}
              </div>
              <div className='modal-footer'>
                <button
                  className='btn btn-light'
                  onClick={() => setSelectedPermit(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default PermittingProcessPage