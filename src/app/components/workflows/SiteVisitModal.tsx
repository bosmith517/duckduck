import React, { useState } from 'react'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import workflowService from '../../services/workflowService'

interface SiteVisitModalProps {
  isOpen: boolean
  onClose: () => void
  leadId: string
  leadData: any
  onSuccess: () => void
}

export const SiteVisitModal: React.FC<SiteVisitModalProps> = ({
  isOpen,
  onClose,
  leadId,
  leadData,
  onSuccess
}) => {
  const { userProfile } = useSupabaseAuth()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    site_visit_date: '',
    site_visit_time: '',
    assigned_rep: userProfile?.id || '',
    notes: '',
    estimated_duration: '60' // minutes
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userProfile?.tenant_id) {
      alert('Authentication error. Please refresh and try again.')
      return
    }

    setLoading(true)
    try {
      // Combine date and time
      const siteVisitDateTime = new Date(`${formData.site_visit_date}T${formData.site_visit_time}`)
      
      // Update lead with site visit information
      const { error: leadError } = await supabase
        .from('leads')
        .update({
          site_visit_date: siteVisitDateTime.toISOString(),
          site_visit_notes: formData.notes,
          assigned_rep: formData.assigned_rep,
          status: 'site_visit_scheduled',
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId)

      if (leadError) throw leadError

      // Create calendar event (this could be enhanced with actual calendar integration)
      const eventData = {
        title: `Site Visit: ${leadData.caller_name}`,
        description: `Site visit for ${leadData.initial_request}\n\nClient: ${leadData.caller_name}\nPhone: ${leadData.phone_number}\nNotes: ${formData.notes}`,
        start_time: siteVisitDateTime.toISOString(),
        end_time: new Date(siteVisitDateTime.getTime() + parseInt(formData.estimated_duration) * 60000).toISOString(),
        event_type: 'site_visit',
        lead_id: leadId,
        assigned_to: formData.assigned_rep,
        tenant_id: userProfile.tenant_id
      }

      // Insert into calendar events (if table exists)
      try {
        await supabase.from('calendar_events').insert(eventData)
      } catch (calendarError) {
        console.log('Calendar event creation skipped (table may not exist)')
      }

      alert(`✅ Site visit scheduled successfully!\n\nDate: ${siteVisitDateTime.toLocaleDateString()}\nTime: ${siteVisitDateTime.toLocaleTimeString()}\n\nNext steps:\n• Prepare site visit checklist\n• Send confirmation to client\n• Review property information`)
      
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error scheduling site visit:', error)
      alert('Failed to schedule site visit. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal fade show" style={{display: 'block'}} tabIndex={-1}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h2 className="modal-title">Schedule Site Visit</h2>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              disabled={loading}
            ></button>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {/* Client Information */}
              <div className="mb-5">
                <h5 className="text-gray-800 mb-3">Client Information</h5>
                <div className="bg-light-primary p-4 rounded">
                  <div className="row">
                    <div className="col-md-6">
                      <strong>Name:</strong> {leadData.caller_name}
                    </div>
                    <div className="col-md-6">
                      <strong>Phone:</strong> {leadData.phone_number}
                    </div>
                    <div className="col-12 mt-2">
                      <strong>Request:</strong> {leadData.initial_request}
                    </div>
                  </div>
                </div>
              </div>

              {/* Site Visit Scheduling */}
              <div className="row g-4">
                <div className="col-md-6">
                  <label className="form-label required">Site Visit Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formData.site_visit_date}
                    onChange={(e) => setFormData(prev => ({...prev, site_visit_date: e.target.value}))}
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
                
                <div className="col-md-6">
                  <label className="form-label required">Time</label>
                  <input
                    type="time"
                    className="form-control"
                    value={formData.site_visit_time}
                    onChange={(e) => setFormData(prev => ({...prev, site_visit_time: e.target.value}))}
                    required
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Estimated Duration</label>
                  <select
                    className="form-select"
                    value={formData.estimated_duration}
                    onChange={(e) => setFormData(prev => ({...prev, estimated_duration: e.target.value}))}
                  >
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="90">1.5 hours</option>
                    <option value="120">2 hours</option>
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label">Assigned Representative</label>
                  <input
                    type="text"
                    className="form-control"
                    value={userProfile?.email || 'Current User'}
                    readOnly
                    placeholder="Will use current user"
                  />
                </div>

                <div className="col-12">
                  <label className="form-label">Preparation Notes</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({...prev, notes: e.target.value}))}
                    placeholder="Special instructions, things to bring, access notes..."
                  />
                </div>
              </div>

              {/* Next Steps Info */}
              <div className="mt-5">
                <div className="notice d-flex bg-light-info rounded border-info border border-dashed p-6">
                  <i className="ki-duotone ki-information fs-2tx text-info me-4">
                    <span className="path1"></span>
                    <span className="path2"></span>
                    <span className="path3"></span>
                  </i>
                  <div className="d-flex flex-stack flex-grow-1">
                    <div className="fw-semibold">
                      <h4 className="text-gray-900 fw-bold">After Site Visit</h4>
                      <div className="fs-6 text-gray-700">
                        • Complete site assessment and take photos<br/>
                        • Create detailed estimate based on findings<br/>
                        • Follow up with client within 24 hours
                      </div>
                    </div>
                  </div>
                </div>
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
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? (
                  <span className="spinner-border spinner-border-sm me-2" />
                ) : (
                  <i className="ki-duotone ki-calendar-add me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                )}
                Schedule Site Visit
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default SiteVisitModal