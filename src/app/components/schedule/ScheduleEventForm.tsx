import React, { useState } from 'react'
import { useFormValidation } from '../../hooks/useFormValidation'
import { scheduleEventSchema, validateAppointmentAsync, checkDuplicateAppointment } from '../../utils/appointmentValidation'
import { showToast } from '../../utils/toast'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { AppointmentService, AppointmentConflict } from '../../services/appointmentService'

interface ScheduleEventFormProps {
  isOpen: boolean
  onClose: () => void
  onSave: (eventData: any) => Promise<void>
  selectedDate?: string
}

export const ScheduleEventForm: React.FC<ScheduleEventFormProps> = ({
  isOpen,
  onClose,
  onSave,
  selectedDate = new Date().toISOString().split('T')[0]
}) => {
  const { userProfile } = useSupabaseAuth()
  const [conflicts, setConflicts] = useState<AppointmentConflict[]>([])
  const [showConflictWarning, setShowConflictWarning] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState(false)
  
  const {
    values,
    errors,
    touched,
    getFieldProps,
    getFieldMeta,
    handleSubmit,
    isValid,
    isSubmitting,
    setErrors,
    setFieldValue
  } = useFormValidation({
    initialValues: {
      title: '',
      client: '',
      type: '',
      date: selectedDate,
      startTime: '',
      endTime: '',
      location: '',
      assignedTo: '',
      notes: ''
    },
    validationSchema: scheduleEventSchema,
    onSubmit: async (formValues) => {
      try {
        // Check for async validations (conflicts, duplicates)
        if (userProfile?.tenant_id) {
          const asyncErrors = await validateAppointmentAsync(formValues, userProfile.tenant_id)
          if (Object.keys(asyncErrors).length > 0) {
            setErrors(asyncErrors)
            return
          }
        }
        
        await onSave(formValues)
        showToast.success('Event created successfully!')
        onClose()
      } catch (error) {
        console.error('Error saving event:', error)
        showToast.error('Failed to create event. Please try again.')
      }
    }
  })

  // Check for conflicts when date or time changes
  const checkForConflicts = async () => {
    if (values.date && values.startTime && values.endTime && userProfile?.tenant_id) {
      try {
        const result = await AppointmentService.checkTimeSlotConflict(
          {
            date: values.date,
            startTime: values.startTime,
            endTime: values.endTime
          },
          userProfile.tenant_id
        )
        
        setConflicts(result.conflicts)
        setShowConflictWarning(result.hasConflict)
      } catch (error) {
        console.error('Error checking conflicts:', error)
      }
    }
  }

  // Check for duplicates
  const checkForDuplicates = async () => {
    if (values.client && values.date && userProfile?.tenant_id) {
      try {
        const isDuplicate = await checkDuplicateAppointment(
          values.client,
          values.date,
          userProfile.tenant_id
        )
        setDuplicateWarning(isDuplicate)
      } catch (error) {
        console.error('Error checking duplicates:', error)
      }
    }
  }

  // Watch for time/date changes
  React.useEffect(() => {
    if (values.date && values.startTime && values.endTime) {
      checkForConflicts()
    }
  }, [values.date, values.startTime, values.endTime])

  // Watch for client/date changes for duplicate check
  React.useEffect(() => {
    if (values.client && values.date) {
      checkForDuplicates()
    }
  }, [values.client, values.date])

  if (!isOpen) return null

  return (
    <div className='modal fade show d-block' style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
      <div className='modal-dialog modal-lg'>
        <div className='modal-content'>
          <div className='modal-header'>
            <h5 className='modal-title'>Create New Event</h5>
            <button 
              type='button' 
              className='btn-close' 
              onClick={onClose}
              disabled={isSubmitting}
            ></button>
          </div>
          <div className='modal-body'>
            <form onSubmit={handleSubmit}>
              <div className='row g-3'>
                <div className='col-md-6'>
                  <label className='form-label required'>Event Title</label>
                  <input 
                    type='text' 
                    className={`form-control ${getFieldMeta('title').isInvalid ? 'is-invalid' : ''}`}
                    {...getFieldProps('title')}
                    placeholder='e.g., Kitchen Installation'
                  />
                  {getFieldMeta('title').isInvalid && (
                    <div className='invalid-feedback'>{errors.title}</div>
                  )}
                </div>
                <div className='col-md-6'>
                  <label className='form-label required'>Client Name</label>
                  <input 
                    type='text' 
                    className={`form-control ${getFieldMeta('client').isInvalid ? 'is-invalid' : ''}`}
                    {...getFieldProps('client')}
                    placeholder='e.g., John Smith'
                  />
                  {getFieldMeta('client').isInvalid && (
                    <div className='invalid-feedback'>{errors.client}</div>
                  )}
                </div>
                <div className='col-md-6'>
                  <label className='form-label required'>Event Type</label>
                  <select 
                    className={`form-select ${getFieldMeta('type').isInvalid ? 'is-invalid' : ''}`}
                    {...getFieldProps('type')}
                  >
                    <option value=''>Select Type</option>
                    <option value='meeting'>Meeting</option>
                    <option value='work'>Work</option>
                    <option value='inspection'>Inspection</option>
                    <option value='delivery'>Delivery</option>
                  </select>
                  {getFieldMeta('type').isInvalid && (
                    <div className='invalid-feedback'>{errors.type}</div>
                  )}
                </div>
                <div className='col-md-6'>
                  <label className='form-label required'>Date</label>
                  <input 
                    type='date' 
                    className={`form-control ${getFieldMeta('date').isInvalid ? 'is-invalid' : ''}`}
                    {...getFieldProps('date')}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  {getFieldMeta('date').isInvalid && (
                    <div className='invalid-feedback'>{errors.date}</div>
                  )}
                </div>
                <div className='col-md-6'>
                  <label className='form-label required'>Start Time</label>
                  <input 
                    type='time' 
                    className={`form-control ${getFieldMeta('startTime').isInvalid ? 'is-invalid' : ''}`}
                    {...getFieldProps('startTime')}
                  />
                  {getFieldMeta('startTime').isInvalid && (
                    <div className='invalid-feedback'>{errors.startTime}</div>
                  )}
                </div>
                <div className='col-md-6'>
                  <label className='form-label required'>End Time</label>
                  <input 
                    type='time' 
                    className={`form-control ${getFieldMeta('endTime').isInvalid ? 'is-invalid' : ''}`}
                    {...getFieldProps('endTime')}
                  />
                  {getFieldMeta('endTime').isInvalid && (
                    <div className='invalid-feedback'>{errors.endTime}</div>
                  )}
                </div>
                <div className='col-12'>
                  <label className='form-label required'>Location</label>
                  <input 
                    type='text' 
                    className={`form-control ${getFieldMeta('location').isInvalid ? 'is-invalid' : ''}`}
                    {...getFieldProps('location')}
                    placeholder='123 Main St, City, State'
                  />
                  {getFieldMeta('location').isInvalid && (
                    <div className='invalid-feedback'>{errors.location}</div>
                  )}
                </div>
                <div className='col-12'>
                  <label className='form-label required'>Assigned To</label>
                  <input 
                    type='text' 
                    className={`form-control ${getFieldMeta('assignedTo').isInvalid ? 'is-invalid' : ''}`}
                    {...getFieldProps('assignedTo')}
                    placeholder='Technician name'
                  />
                  {getFieldMeta('assignedTo').isInvalid && (
                    <div className='invalid-feedback'>{errors.assignedTo}</div>
                  )}
                </div>
                <div className='col-12'>
                  <label className='form-label'>Notes</label>
                  <textarea 
                    className={`form-control ${getFieldMeta('notes').isInvalid ? 'is-invalid' : ''}`}
                    {...getFieldProps('notes')}
                    rows={3} 
                    placeholder='Additional notes...'
                  />
                  {getFieldMeta('notes').isInvalid && (
                    <div className='invalid-feedback'>{errors.notes}</div>
                  )}
                </div>
              </div>
              
              {/* Duplicate Warning */}
              {duplicateWarning && (
                <div className='alert alert-info mt-3' role='alert'>
                  <h6 className='alert-heading'>
                    <i className='ki-duotone ki-information-5 fs-3 me-2'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                      <span className='path3'></span>
                    </i>
                    Possible Duplicate Appointment
                  </h6>
                  <p className='mb-0'>
                    An appointment for <strong>{values.client}</strong> on this date may already exist. 
                    Please verify before creating a duplicate appointment.
                  </p>
                </div>
              )}
              
              {/* Conflict Warning */}
              {showConflictWarning && conflicts.length > 0 && (
                <div className='alert alert-warning mt-3' role='alert'>
                  <h6 className='alert-heading'>
                    <i className='ki-duotone ki-information-5 fs-3 me-2'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                      <span className='path3'></span>
                    </i>
                    Time Conflict Detected
                  </h6>
                  <p className='mb-2'>This time slot conflicts with:</p>
                  <ul className='mb-0'>
                    {conflicts.map((conflict, index) => (
                      <li key={index}>
                        <strong>{conflict.title}</strong> ({conflict.startTime} - {conflict.endTime})
                      </li>
                    ))}
                  </ul>
                  <hr />
                  <p className='mb-0 text-muted'>
                    You can still create this event, but please consider choosing a different time.
                  </p>
                </div>
              )}
              
              {/* Validation Summary */}
              {Object.keys(errors).length > 0 && Object.keys(touched).length > 0 && (
                <div className='alert alert-danger mt-3' role='alert'>
                  <h6 className='alert-heading'>Please fix the following errors:</h6>
                  <ul className='mb-0'>
                    {Object.entries(errors).map(([field, error]) => 
                      touched[field] ? <li key={field}>{error}</li> : null
                    )}
                  </ul>
                </div>
              )}
              
              <div className='modal-footer'>
                <button 
                  type='button' 
                  className='btn btn-light' 
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button 
                  type='submit' 
                  className='btn btn-primary'
                  disabled={isSubmitting || !isValid}
                >
                  {isSubmitting ? (
                    <>
                      <span className='spinner-border spinner-border-sm me-2' />
                      Creating...
                    </>
                  ) : (
                    'Create Event'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}