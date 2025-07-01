import React, { useState, useEffect } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { NewInquiryButton } from '../../components/workflows/WorkflowLauncher'
import { PromoteToJobModal } from '../../components/workflows/PromoteToJobModal'
import { EditLeadModal } from '../../components/workflows/EditLeadModal'

interface Lead {
  id: string
  tenant_id: string
  caller_name: string
  caller_type?: 'business' | 'individual'
  phone_number: string
  email?: string
  lead_source: string
  initial_request: string
  status: 'new' | 'qualified' | 'unqualified' | 'converted'
  urgency: 'low' | 'medium' | 'high' | 'emergency'
  estimated_value?: number
  follow_up_date?: string
  notes?: string
  created_at: string
  updated_at: string
  converted_to_job_id?: string
}

const LeadsPage: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all')
  const [showPromoteModal, setShowPromoteModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  useEffect(() => {
    if (userProfile?.tenant_id) {
      fetchLeads()
    }
  }, [userProfile?.tenant_id])

  const fetchLeads = async () => {
    if (!userProfile?.tenant_id) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('tenant_id', userProfile.tenant_id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching leads:', error)
        return
      }

      setLeads(data || [])
    } catch (error) {
      console.error('Error fetching leads:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePromoteToJob = (lead: Lead) => {
    setSelectedLead(lead)
    setShowPromoteModal(true)
  }

  const handleEditLead = (lead: Lead) => {
    setSelectedLead(lead)
    setShowEditModal(true)
  }

  const handleJobCreated = (jobId: string) => {
    setShowPromoteModal(false)
    setSelectedLead(null)
    // Refresh leads to show updated status
    fetchLeads()
    // Navigate to the job
    window.location.href = `/schedule?job=${jobId}`
  }

  const handleLeadUpdated = () => {
    setShowEditModal(false)
    setSelectedLead(null)
    // Refresh leads to show updated information
    fetchLeads()
  }

  const handleMarkUnqualified = async (leadId: string) => {
    if (!confirm('Mark this lead as unqualified?')) return

    try {
      const { error } = await supabase
        .from('leads')
        .update({ 
          status: 'unqualified',
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId)

      if (error) throw error
      fetchLeads()
    } catch (error) {
      console.error('Error updating lead:', error)
      alert('Error updating lead')
    }
  }

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'emergency':
        return 'badge-danger'
      case 'high':
        return 'badge-warning'
      case 'medium':
        return 'badge-info'
      default:
        return 'badge-success'
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return 'badge-primary'
      case 'qualified':
        return 'badge-warning'
      case 'converted':
        return 'badge-success'
      case 'unqualified':
        return 'badge-secondary'
      default:
        return 'badge-light'
    }
  }

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.caller_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone_number.includes(searchTerm) ||
      lead.initial_request.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter
    const matchesUrgency = urgencyFilter === 'all' || lead.urgency === urgencyFilter

    return matchesSearch && matchesStatus && matchesUrgency
  })

  return (
    <>
      <PageTitle breadcrumbs={[]}>Lead Management</PageTitle>
      
      <div className='card'>
        <div className='card-header border-0 pt-6'>
          <div className='card-title'>
            <div className='d-flex align-items-center position-relative my-1'>
              <i className='ki-duotone ki-magnifier fs-1 position-absolute ms-6'>
                <span className='path1'></span>
                <span className='path2'></span>
              </i>
              <input
                type='text'
                className='form-control form-control-solid w-250px ps-14'
                placeholder='Search leads...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className='card-toolbar'>
            <div className='d-flex justify-content-end align-items-center gap-3'>
              {/* Status Filter */}
              <select
                className='form-select form-select-solid w-150px'
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value='all'>All Status</option>
                <option value='new'>New</option>
                <option value='qualified'>Qualified</option>
                <option value='converted'>Converted</option>
                <option value='unqualified'>Unqualified</option>
              </select>

              {/* Urgency Filter */}
              <select
                className='form-select form-select-solid w-150px'
                value={urgencyFilter}
                onChange={(e) => setUrgencyFilter(e.target.value)}
              >
                <option value='all'>All Urgency</option>
                <option value='emergency'>Emergency</option>
                <option value='high'>High</option>
                <option value='medium'>Medium</option>
                <option value='low'>Low</option>
              </select>

              {/* New Inquiry Button */}
              <NewInquiryButton
                onSuccess={() => fetchLeads()}
                variant='primary'
                size='md'
              />
            </div>
          </div>
        </div>

        <div className='card-body py-4'>
          {loading ? (
            <div className='d-flex justify-content-center py-10'>
              <div className='spinner-border text-primary' role='status'>
                <span className='visually-hidden'>Loading...</span>
              </div>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className='d-flex flex-column flex-center'>
              <img
                src='/media/illustrations/sketchy-1/2.png'
                alt='No leads'
                className='mw-400px'
              />
              <div className='fs-1 fw-bolder text-dark mb-4'>No leads found.</div>
              <div className='fs-6'>Start by creating your first lead inquiry.</div>
            </div>
          ) : (
            <div className='table-responsive'>
              <table className='table align-middle table-row-dashed fs-6 gy-5'>
                <thead>
                  <tr className='text-start text-muted fw-bolder fs-7 text-uppercase gs-0'>
                    <th className='min-w-125px'>Contact</th>
                    <th className='min-w-150px'>Request</th>
                    <th className='min-w-100px'>Source</th>
                    <th className='min-w-100px'>Status</th>
                    <th className='min-w-100px'>Urgency</th>
                    <th className='min-w-100px'>Value</th>
                    <th className='min-w-100px'>Created</th>
                    <th className='text-end min-w-150px'>Actions</th>
                  </tr>
                </thead>
                <tbody className='text-gray-600 fw-bold'>
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id}>
                      <td>
                        <div className='d-flex flex-column'>
                          <span className='text-gray-800 fs-6 fw-bolder mb-1'>
                            {lead.caller_name}
                          </span>
                          <span className='text-muted fs-7'>{lead.phone_number}</span>
                          {lead.email && (
                            <span className='text-muted fs-7'>{lead.email}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className='text-gray-800'>
                          {lead.initial_request.length > 50
                            ? `${lead.initial_request.substring(0, 50)}...`
                            : lead.initial_request}
                        </div>
                      </td>
                      <td>
                        <span className='text-gray-800'>{lead.lead_source}</span>
                      </td>
                      <td>
                        <span className={`badge ${getStatusBadge(lead.status)} fw-bolder`}>
                          {lead.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${getUrgencyBadge(lead.urgency)} fw-bolder`}>
                          {lead.urgency.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span className='text-gray-800'>
                          {lead.estimated_value ? `$${lead.estimated_value.toLocaleString()}` : '-'}
                        </span>
                      </td>
                      <td>
                        <span className='text-gray-800'>
                          {new Date(lead.created_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td className='text-end'>
                        <div className='d-flex justify-content-end gap-2'>
                          {/* Edit button - always available */}
                          <button
                            className='btn btn-sm btn-light-warning'
                            onClick={() => handleEditLead(lead)}
                            title='Edit Lead'
                          >
                            <i className='ki-duotone ki-pencil fs-4'>
                              <span className='path1'></span>
                              <span className='path2'></span>
                            </i>
                          </button>

                          {lead.status === 'new' && (
                            <>
                              <button
                                className='btn btn-sm btn-success'
                                onClick={() => handlePromoteToJob(lead)}
                                title='Promote to Job'
                              >
                                <i className='ki-duotone ki-arrow-up-right fs-4'>
                                  <span className='path1'></span>
                                  <span className='path2'></span>
                                </i>
                                Promote
                              </button>
                              <button
                                className='btn btn-sm btn-light-danger'
                                onClick={() => handleMarkUnqualified(lead.id)}
                                title='Mark Unqualified'
                              >
                                <i className='ki-duotone ki-cross fs-4'>
                                  <span className='path1'></span>
                                  <span className='path2'></span>
                                </i>
                              </button>
                            </>
                          )}
                          {lead.status === 'converted' && lead.converted_to_job_id && (
                            <a
                              href={`/schedule?job=${lead.converted_to_job_id}`}
                              className='btn btn-sm btn-primary'
                            >
                              <i className='ki-duotone ki-eye fs-4'>
                                <span className='path1'></span>
                                <span className='path2'></span>
                                <span className='path3'></span>
                              </i>
                              View Job
                            </a>
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
      </div>

      {/* Promote to Job Modal */}
      {showPromoteModal && selectedLead && (
        <PromoteToJobModal
          isOpen={showPromoteModal}
          onClose={() => {
            setShowPromoteModal(false)
            setSelectedLead(null)
          }}
          leadId={selectedLead.id}
          leadData={selectedLead}
          onSuccess={handleJobCreated}
        />
      )}

      {/* Edit Lead Modal */}
      {showEditModal && selectedLead && (
        <EditLeadModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false)
            setSelectedLead(null)
          }}
          leadId={selectedLead.id}
          onSuccess={handleLeadUpdated}
        />
      )}
    </>
  )
}

export default LeadsPage