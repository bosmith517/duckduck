import React, { useState, useEffect } from 'react'
import { KTIcon } from '../../../_metronic/helpers'
import { jobActivityService, JobActivity } from '../../services/jobActivityService'
import { showToast } from '../../utils/toast'

interface JobActivityTimelineProps {
  jobId: string
  showCustomerView?: boolean
  showAddNoteButton?: boolean
  onAddNote?: () => void
}

export const JobActivityTimeline: React.FC<JobActivityTimelineProps> = ({
  jobId,
  showCustomerView = false,
  showAddNoteButton = true,
  onAddNote
}) => {
  const [activities, setActivities] = useState<JobActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [showInternalActivities, setShowInternalActivities] = useState(!showCustomerView)

  useEffect(() => {
    if (jobId) {
      loadActivities()
    }
  }, [jobId, showInternalActivities])

  const loadActivities = async () => {
    try {
      setLoading(true)
      const data = await jobActivityService.getJobActivities(jobId, showInternalActivities)
      setActivities(data)
    } catch (error) {
      console.error('Error loading activities:', error)
      showToast.error('Failed to load activity timeline')
    } finally {
      setLoading(false)
    }
  }

  const getActivityIcon = (activityType: string) => {
    switch (activityType) {
      case 'job_created': return 'plus'
      case 'estimate_created': return 'document'
      case 'estimate_sent': return 'send'
      case 'estimate_viewed': return 'eye'
      case 'estimate_accepted': return 'check'
      case 'estimate_declined': return 'cross'
      case 'work_started': return 'play'
      case 'work_completed': return 'check-circle'
      case 'work_paused': return 'pause'
      case 'photo_uploaded': return 'picture'
      case 'note_added': return 'note'
      case 'status_changed': return 'switch'
      case 'payment_received': return 'dollar'
      case 'invoice_created': return 'bill'
      case 'invoice_sent': return 'send'
      case 'technician_assigned': return 'user'
      case 'location_update': return 'geolocation'
      case 'call_made': return 'phone'
      case 'sms_sent': return 'sms'
      default: return 'information'
    }
  }

  const getActivityColor = (activityType: string) => {
    switch (activityType) {
      case 'estimate_created':
      case 'estimate_sent':
      case 'invoice_created':
      case 'invoice_sent':
        return 'primary'
      case 'estimate_accepted':
      case 'work_completed':
      case 'payment_received':
        return 'success'
      case 'estimate_declined':
        return 'danger'
      case 'work_started':
      case 'work_paused':
        return 'warning'
      case 'photo_uploaded':
      case 'note_added':
        return 'info'
      default:
        return 'secondary'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60))
      return diffMins < 1 ? 'Just now' : `${diffMins}m ago`
    } else if (diffHours < 24) {
      return `${diffHours}h ago`
    } else if (diffDays < 7) {
      return `${diffDays}d ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  const getActivityUser = (activity: JobActivity) => {
    if (!activity.user_profiles) {
      return 'System'
    }
    return `${activity.user_profiles.first_name} ${activity.user_profiles.last_name}`
  }

  const filteredActivities = showCustomerView 
    ? activities.filter(a => a.is_visible_to_customer)
    : activities

  if (loading) {
    return (
      <div className="d-flex justify-content-center py-10">
        <div className="spinner-border spinner-border-lg text-primary" />
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="d-flex justify-content-between align-items-center w-100">
          <h3 className="card-title">
            {showCustomerView ? 'Project Updates' : 'Activity Timeline'}
          </h3>
          <div className="d-flex gap-3">
            {!showCustomerView && (
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="showInternalSwitch"
                  checked={showInternalActivities}
                  onChange={(e) => setShowInternalActivities(e.target.checked)}
                />
                <label className="form-check-label text-muted" htmlFor="showInternalSwitch">
                  Show internal activities
                </label>
              </div>
            )}
            {showAddNoteButton && onAddNote && (
              <button className="btn btn-sm btn-light-primary" onClick={onAddNote}>
                <KTIcon iconName="plus" className="fs-6 me-1" />
                Add Note
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card-body">
        {filteredActivities.length === 0 ? (
          <div className="text-center py-10">
            <KTIcon iconName="information" className="fs-2x text-muted mb-3" />
            <p className="text-muted">No activities to display</p>
          </div>
        ) : (
          <div className="timeline">
            {filteredActivities.map((activity, index) => (
              <div key={activity.id} className="timeline-item">
                <div className="timeline-line w-40px"></div>
                <div className={`timeline-icon symbol symbol-circle symbol-40px bg-light-${getActivityColor(activity.activity_type)}`}>
                  <div className="symbol-label">
                    <KTIcon 
                      iconName={getActivityIcon(activity.activity_type)} 
                      className={`fs-6 text-${getActivityColor(activity.activity_type)}`} 
                    />
                  </div>
                </div>
                <div className="timeline-content mb-10 mt-n1">
                  <div className="pe-3 mb-5">
                    <div className="fs-5 fw-semibold mb-2">
                      {activity.title}
                      {activity.is_milestone && (
                        <span className="badge badge-light-primary ms-2">
                          <KTIcon iconName="star" className="fs-7 me-1" />
                          Milestone
                        </span>
                      )}
                    </div>
                    
                    {activity.description && (
                      <div className="overflow-auto pb-5">
                        <div className="text-muted fw-semibold text-start ps-10">
                          {activity.description}
                        </div>
                      </div>
                    )}

                    <div className="d-flex align-items-center mt-1 fs-6">
                      <div className="text-muted me-2 fs-7">
                        <KTIcon iconName="profile-circle" className="fs-6 text-muted me-1" />
                        {getActivityUser(activity)}
                      </div>
                      <div className="text-muted fs-7">
                        <KTIcon iconName="time" className="fs-6 text-muted me-1" />
                        {formatDate(activity.created_at)}
                      </div>
                      {!activity.is_visible_to_customer && !showCustomerView && (
                        <span className="badge badge-light-warning ms-2 fs-8">
                          Internal
                        </span>
                      )}
                    </div>

                    {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                      <div className="mt-3">
                        {activity.activity_type === 'estimate_created' && activity.metadata.estimateTotal && (
                          <div className="bg-light-primary rounded p-3">
                            <span className="fw-bold text-primary">
                              Estimate Total: ${activity.metadata.estimateTotal.toFixed(2)}
                            </span>
                          </div>
                        )}
                        {activity.activity_type === 'status_changed' && (
                          <div className="bg-light-info rounded p-3">
                            <span className="text-info">
                              {activity.metadata.oldStatus} → {activity.metadata.newStatus}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default JobActivityTimeline