import React, { useState, useEffect } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import clsx from 'clsx'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { useCustomerJourneyStore, journeyEventBus, JOURNEY_EVENTS } from '../../stores/customerJourneyStore'
import { useSmartAssistant } from '../../hooks/useSmartAssistant'
import { StepTrackerMini } from '../journey/StepTracker'
import type { SiteVisitSchema } from '../../contexts/CustomerJourneyContext'
import workflowService from '../../services/workflowService'

interface SiteVisitModalProps {
  isOpen: boolean
  onClose: () => void
  leadId?: string
  leadData?: any
  onSuccess: () => void
}

export const SiteVisitModal: React.FC<SiteVisitModalProps> = ({
  isOpen,
  onClose,
  leadId: propLeadId,
  leadData: propLeadData,
  onSuccess
}) => {
  const { userProfile } = useSupabaseAuth()
  const [loading, setLoading] = useState(false)
  
  // Customer Journey integration
  const { lead, leadId: storeLeadId, setSiteVisit, updateStep, completeCurrentStep } = useCustomerJourneyStore()
  const { trackAction } = useSmartAssistant()
  
  // Use store data or props as fallback
  const effectiveLeadId = storeLeadId || propLeadId
  const effectiveLeadData = lead || propLeadData
  
  // Validation schema
  const validationSchema = Yup.object().shape({
    site_visit_date: Yup.date().required('Site visit date is required').min(new Date(), 'Date cannot be in the past'),
    site_visit_time: Yup.string().required('Site visit time is required'),
    estimated_duration: Yup.number().min(15, 'Duration must be at least 15 minutes').required('Duration is required')
  })

  // Formik form management
  const formik = useFormik({
    initialValues: {
      site_visit_date: '',
      site_visit_time: '',
      assigned_rep: userProfile?.id || '',
      notes: '',
      estimated_duration: '60' // minutes
    },
    validationSchema,
    onSubmit: async (values) => {
      await handleSubmit(values)
    }
  })
  
  // Track when modal opens
  useEffect(() => {
    if (isOpen) {
      trackAction('opened_site_visit_modal')
      // If not on site_visit step, navigate there
      if (storeLeadId && useCustomerJourneyStore.getState().step !== 'site_visit') {
        updateStep('site_visit')
      }
    }
  }, [isOpen, trackAction, storeLeadId, updateStep])

  const handleSubmit = async (values: any) => {
    if (!userProfile?.tenant_id) {
      alert('Authentication error. Please refresh and try again.')
      return
    }

    if (!effectiveLeadId) {
      alert('No lead selected. Please refresh and try again.')
      return
    }

    setLoading(true)
    try {
      // Combine date and time
      const siteVisitDateTime = new Date(`${values.site_visit_date}T${values.site_visit_time}`)
      
      // Update lead with site visit information
      const { error: leadError } = await supabase
        .from('leads')
        .update({
          site_visit_date: siteVisitDateTime.toISOString(),
          site_visit_notes: values.notes,
          assigned_rep: values.assigned_rep,
          status: 'site_visit_scheduled',
          updated_at: new Date().toISOString()
        })
        .eq('id', effectiveLeadId)

      if (leadError) throw leadError

      // Create site visit record
      const siteVisitData = {
        id: 'visit-' + Date.now(),
        lead_id: effectiveLeadId,
        scheduled_at: siteVisitDateTime.toISOString(),
        duration_minutes: parseInt(values.estimated_duration),
        assigned_to: values.assigned_rep,
        notes: values.notes,
        status: 'scheduled' as const,
        tenant_id: userProfile.tenant_id,
        created_at: new Date().toISOString()
      }

      // Insert site visit record
      const { data: siteVisit, error: siteVisitError } = await supabase
        .from('site_visits')
        .insert(siteVisitData)
        .select()
        .single()

      if (siteVisitError) {
        console.error('Site visit record creation failed:', siteVisitError)
        // Continue without site_visits record for now
      }

      // Create calendar event with proper error handling
      const eventData = {
        title: `Site Visit: ${effectiveLeadData?.name || effectiveLeadData?.caller_name || 'Lead'}`,
        description: `Site visit scheduled\n\nClient: ${effectiveLeadData?.name || effectiveLeadData?.caller_name || 'Unknown'}\nPhone: ${effectiveLeadData?.phone_number || effectiveLeadData?.phone || 'Not provided'}\nEmail: ${effectiveLeadData?.email || 'Not provided'}\nNotes: ${values.notes}`,
        start_time: siteVisitDateTime.toISOString(),
        end_time: new Date(siteVisitDateTime.getTime() + parseInt(values.estimated_duration) * 60000).toISOString(),
        event_type: 'site_visit',
        lead_id: effectiveLeadId,
        assigned_to: values.assigned_rep,
        tenant_id: userProfile.tenant_id,
        location: effectiveLeadData?.full_address || effectiveLeadData?.street_address || 'Address to be confirmed',
        status: 'scheduled'
      }

      // Insert into calendar events with proper error handling
      const { error: calendarError } = await supabase
        .from('calendar_events')
        .insert(eventData)

      if (calendarError) {
        console.error('Calendar event creation failed:', calendarError)
        // Don't fail the entire operation if calendar event fails
      }

      // Update Customer Journey Store
      if (siteVisit) {
        const siteVisitData: SiteVisitSchema = {
          id: siteVisit.id,
          lead_id: effectiveLeadId,
          scheduled_at: siteVisit.scheduled_at,
          duration_minutes: siteVisit.duration_minutes,
          assigned_to: siteVisit.assigned_to,
          notes: siteVisit.notes,
          status: 'scheduled',
          created_at: siteVisit.created_at
        }
        setSiteVisit(siteVisitData)
      }

      // Emit events for journey tracking
      journeyEventBus.emit(JOURNEY_EVENTS.SITE_VISIT_SCHEDULED, {
        siteVisit: siteVisit || siteVisitData,
        scheduledAt: siteVisitDateTime.toISOString()
      })

      trackAction('site_visit_scheduled_successfully')
      
      // Auto-advance step
      completeCurrentStep()

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
    <div className="modal fade show d-block" tabIndex={-1} role="dialog">
      <div className="modal-dialog modal-dialog-centered modal-lg" role="document">
        <div className="modal-content">
          <div className="modal-header bg-warning">
            <h5 className="modal-title text-white">
              <i className="ki-duotone ki-calendar-tick fs-2 text-white me-2">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              Schedule Site Visit
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
              disabled={loading}
              aria-label="Close"
            ></button>
          </div>
          
          <form onSubmit={formik.handleSubmit} noValidate>
            <div className="modal-body">
              {/* Journey Progress */}
              <StepTrackerMini className="mb-5" />
              
              <div className="notice d-flex bg-light-warning rounded border-warning border border-dashed p-6 mb-7">
                <div className="d-flex flex-stack flex-grow-1">
                  <div className="fw-semibold">
                    <h6 className="text-gray-900 fw-bold">Schedule Assessment</h6>
                    <div className="fs-7 text-gray-700">
                      Set up an on-site visit to assess the customer's needs and gather requirements for an accurate estimate.
                    </div>
                  </div>
                </div>
              </div>

              {/* Client Information */}
              <div className="mb-5">
                <h6 className="text-gray-700 fw-bold mb-3">
                  <i className="ki-duotone ki-user fs-2 text-primary me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Client Information
                </h6>
                <div className="bg-light-primary p-4 rounded">
                  <div className="row">
                    <div className="col-md-6">
                      <strong>Name:</strong> {effectiveLeadData?.name || effectiveLeadData?.caller_name || 'Unknown'}
                    </div>
                    <div className="col-md-6">
                      <strong>Phone:</strong> {effectiveLeadData?.phone_number || effectiveLeadData?.phone || 'Not provided'}
                    </div>
                    <div className="col-12 mt-2">
                      <strong>Email:</strong> {effectiveLeadData?.email || 'Not provided'}
                    </div>
                    {(effectiveLeadData?.full_address || effectiveLeadData?.street_address) && (
                      <div className="col-12 mt-2">
                        <strong>Address:</strong> {effectiveLeadData?.full_address || effectiveLeadData?.street_address}
                      </div>
                    )}
                    {effectiveLeadData?.initial_request && (
                      <div className="col-12 mt-2">
                        <strong>Request:</strong> {effectiveLeadData.initial_request}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Visit Scheduling */}
              <div className="mb-5">
                <h6 className="text-gray-700 fw-bold mb-3">
                  <i className="ki-duotone ki-calendar-add fs-2 text-warning me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Visit Scheduling
                </h6>
              </div>
              
              <div className="row g-4">
                <div className="col-md-6">
                  <label className="form-label required">Site Visit Date</label>
                  <input
                    type="date"
                    className={clsx('form-control', {
                      'is-invalid': formik.touched.site_visit_date && formik.errors.site_visit_date
                    })}
                    min={new Date().toISOString().split('T')[0]}
                    {...formik.getFieldProps('site_visit_date')}
                  />
                  {formik.touched.site_visit_date && formik.errors.site_visit_date && (
                    <div className="fv-plugins-message-container">
                      <span role="alert">{formik.errors.site_visit_date}</span>
                    </div>
                  )}
                </div>
                
                <div className="col-md-6">
                  <label className="form-label required">Time</label>
                  <input
                    type="time"
                    className={clsx('form-control', {
                      'is-invalid': formik.touched.site_visit_time && formik.errors.site_visit_time
                    })}
                    {...formik.getFieldProps('site_visit_time')}
                  />
                  {formik.touched.site_visit_time && formik.errors.site_visit_time && (
                    <div className="fv-plugins-message-container">
                      <span role="alert">{formik.errors.site_visit_time}</span>
                    </div>
                  )}
                </div>

                <div className="col-md-6">
                  <label className="form-label">Estimated Duration</label>
                  <select
                    className={clsx('form-select', {
                      'is-invalid': formik.touched.estimated_duration && formik.errors.estimated_duration
                    })}
                    {...formik.getFieldProps('estimated_duration')}
                  >
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="90">1.5 hours</option>
                    <option value="120">2 hours</option>
                  </select>
                  {formik.touched.estimated_duration && formik.errors.estimated_duration && (
                    <div className="fv-plugins-message-container">
                      <span role="alert">{formik.errors.estimated_duration}</span>
                    </div>
                  )}
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
                    placeholder="Special instructions, things to bring, access notes..."
                    {...formik.getFieldProps('notes')}
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
                className="btn btn-warning"
                disabled={loading || !formik.isValid || formik.isSubmitting}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm align-middle me-2"></span>
                    Scheduling...
                  </>
                ) : (
                  <>
                    <i className="ki-duotone ki-calendar-add fs-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    Schedule Site Visit
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default SiteVisitModal