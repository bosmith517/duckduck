import React, { useState, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { showToast } from '../../utils/toast'
import clsx from 'clsx'

interface Lead {
  id: string
  name: string
  caller_name?: string
  service_type: string
  phone?: string
  email?: string
  full_address?: string
  status: 'new' | 'qualified' | 'converted'
  created_at: string
}

interface LinkEstimateToLeadModalProps {
  estimateId: string
  estimateNumber: string
  isOpen: boolean
  onClose: () => void
  onLinked: (leadId: string) => void
}

export const LinkEstimateToLeadModal: React.FC<LinkEstimateToLeadModalProps> = ({
  estimateId,
  estimateNumber,
  isOpen,
  onClose,
  onLinked
}) => {
  const { userProfile } = useSupabaseAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLeadId, setSelectedLeadId] = useState('')
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (isOpen && userProfile?.tenant_id) {
      loadLeads()
    }
  }, [isOpen, userProfile?.tenant_id])

  const loadLeads = async (search?: string) => {
    if (!userProfile?.tenant_id) return

    try {
      setSearching(true)
      let query = supabase
        .from('leads')
        .select(`
          id,
          name,
          caller_name,
          service_type,
          phone,
          email,
          full_address,
          status,
          created_at
        `)
        .eq('tenant_id', userProfile.tenant_id)
        .in('status', ['new', 'qualified'])
        .order('created_at', { ascending: false })
        .limit(50)

      // Add search filter if provided
      if (search) {
        query = query.or(`
          name.ilike.%${search}%,
          caller_name.ilike.%${search}%,
          phone.ilike.%${search}%,
          email.ilike.%${search}%,
          service_type.ilike.%${search}%
        `)
      }

      const { data, error } = await query

      if (error) throw error
      setLeads(data || [])
    } catch (error) {
      console.error('Error loading leads:', error)
      showToast.error('Failed to load leads')
    } finally {
      setSearching(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    loadLeads(searchTerm)
  }

  const handleLink = async () => {
    if (!selectedLeadId) {
      showToast.error('Please select a lead')
      return
    }

    try {
      setLoading(true)
      
      // Update the estimate with the lead_id
      const { error: updateError } = await supabase
        .from('estimates')
        .update({ 
          lead_id: selectedLeadId,
          updated_at: new Date().toISOString()
        })
        .eq('id', estimateId)

      if (updateError) throw updateError

      // Log the activity
      if (userProfile?.id) {
        await supabase
          .from('estimate_activity_log')
          .insert({
            estimate_id: estimateId,
            tenant_id: userProfile.tenant_id,
            activity_type: 'linked_to_lead',
            description: `Estimate linked to lead`,
            performed_by: userProfile.id,
            metadata: {
              lead_id: selectedLeadId,
              recovery_action: true
            }
          })
      }

      showToast.success('Estimate successfully linked to lead')
      onLinked(selectedLeadId)
      onClose()
    } catch (error) {
      console.error('Error linking estimate to lead:', error)
      showToast.error('Failed to link estimate to lead')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal fade show d-block" tabIndex={-1}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Link Estimate to Customer Journey</h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              aria-label="Close"
            />
          </div>

          <div className="modal-body">
            <div className="alert alert-light-info d-flex align-items-center p-5 mb-6">
              <i className="ki-duotone ki-information-5 fs-2hx text-info me-4">
                <span className="path1"></span>
                <span className="path2"></span>
                <span className="path3"></span>
              </i>
              <div className="d-flex flex-column">
                <h4 className="mb-1">Journey Recovery</h4>
                <span>Link estimate {estimateNumber} to an existing lead to track it in the customer journey.</span>
              </div>
            </div>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="mb-5">
              <div className="input-group">
                <input
                  type="text"
                  className="form-control form-control-solid"
                  placeholder="Search leads by name, phone, email, or service type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={searching}
                >
                  {searching ? (
                    <span className="spinner-border spinner-border-sm me-2" />
                  ) : (
                    <i className="ki-duotone ki-magnifier fs-3">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                  )}
                  Search
                </button>
              </div>
            </form>

            {/* Lead Selection */}
            <div className="mb-6">
              <label className="required fw-semibold fs-6 mb-3">Select Lead</label>
              {leads.length === 0 ? (
                <div className="text-center py-10 text-muted">
                  {searchTerm ? 'No leads found matching your search.' : 'No available leads to link.'}
                </div>
              ) : (
                <div 
                  className="border rounded p-3" 
                  style={{ maxHeight: '300px', overflowY: 'auto' }}
                >
                  {leads.map((lead) => (
                    <label
                      key={lead.id}
                      className={clsx(
                        'd-flex align-items-center p-3 mb-2 cursor-pointer rounded',
                        'bg-hover-light-primary border border-dashed border-hover-primary',
                        selectedLeadId === lead.id && 'bg-light-primary border-primary'
                      )}
                    >
                      <input
                        type="radio"
                        className="form-check-input me-3"
                        name="leadSelection"
                        value={lead.id}
                        checked={selectedLeadId === lead.id}
                        onChange={(e) => setSelectedLeadId(e.target.value)}
                      />
                      <div className="flex-grow-1">
                        <div className="fw-bold text-gray-800">
                          {lead.name || lead.caller_name || 'Unknown'}
                        </div>
                        <div className="text-muted fs-7">
                          {lead.service_type} • {lead.status}
                          {lead.phone && ` • ${lead.phone}`}
                        </div>
                        {lead.full_address && (
                          <div className="text-muted fs-8 mt-1">
                            <i className="ki-duotone ki-geolocation fs-6 me-1">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                            {lead.full_address}
                          </div>
                        )}
                        <div className="text-muted fs-8 mt-1">
                          Created: {new Date(lead.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Info Text */}
            <div className="text-muted fs-7">
              <strong>Note:</strong> Once linked, this estimate will appear in the customer's journey timeline 
              and can be converted to a job upon approval.
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-light"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleLink}
              disabled={loading || !selectedLeadId}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  Linking...
                </>
              ) : (
                <>
                  <i className="ki-duotone ki-check fs-3 me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Link to Lead
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </div>
  )
}