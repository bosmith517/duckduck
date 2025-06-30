import React, { useState, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'

interface ServiceSchedulingModalProps {
  isOpen: boolean
  onClose: () => void
  customerId: string
  customerName: string
  customerPhone?: string
  customerEmail?: string
}

interface ServiceType {
  id: string
  name: string
  description: string
  estimated_duration: number
  base_price: number
  category: string
}

interface TimeSlot {
  time: string
  available: boolean
  technician?: string
}

const ServiceSchedulingModal: React.FC<ServiceSchedulingModalProps> = ({
  isOpen,
  onClose,
  customerId,
  customerName,
  customerPhone,
  customerEmail
}) => {
  const { currentUser, userProfile } = useSupabaseAuth()
  const [currentStep, setCurrentStep] = useState(1)
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [selectedService, setSelectedService] = useState<ServiceType | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [customerNotes, setCustomerNotes] = useState('')
  const [urgency, setUrgency] = useState<'standard' | 'priority' | 'emergency'>('standard')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadServiceTypes()
      setCurrentStep(1)
      resetForm()
    }
  }, [isOpen])

  useEffect(() => {
    if (selectedDate) {
      loadTimeSlots(selectedDate)
    }
  }, [selectedDate])

  const resetForm = () => {
    setSelectedService(null)
    setSelectedDate('')
    setSelectedTime('')
    setCustomerNotes('')
    setUrgency('standard')
  }

  const loadServiceTypes = async () => {
    setLoading(true)
    try {
      // Try to load from service catalog table first
      let serviceTypesFromDB: ServiceType[] = []
      
      if (userProfile?.tenant_id) {
        const { data: services, error } = await supabase
          .from('service_catalog')
          .select('*')
          .eq('tenant_id', userProfile.tenant_id)
          .eq('is_active', true)
          .order('category', { ascending: true })
        
        if (!error && services) {
          serviceTypesFromDB = services.map(service => ({
            id: service.id,
            name: service.name,
            description: service.description || '',
            estimated_duration: service.estimated_duration || 120,
            base_price: service.base_price || 0,
            category: service.category || 'general'
          }))
        }
      }
      
      // Fall back to mock services if no database services or for demo
      const mockServices: ServiceType[] = [
        {
          id: 'hvac-maintenance',
          name: 'HVAC Maintenance',
          description: 'Complete HVAC system inspection, cleaning, and tune-up',
          estimated_duration: 120,
          base_price: 185,
          category: 'hvac'
        },
        {
          id: 'hvac-repair',
          name: 'HVAC Repair',
          description: 'Diagnose and repair HVAC system issues',
          estimated_duration: 180,
          base_price: 120,
          category: 'hvac'
        },
        {
          id: 'ac-installation',
          name: 'AC Installation',
          description: 'Professional air conditioning system installation',
          estimated_duration: 480,
          base_price: 3500,
          category: 'hvac'
        },
        {
          id: 'electrical-inspection',
          name: 'Electrical Inspection',
          description: 'Comprehensive electrical system safety inspection',
          estimated_duration: 90,
          base_price: 150,
          category: 'electrical'
        },
        {
          id: 'plumbing-repair',
          name: 'Plumbing Repair',
          description: 'General plumbing repairs and maintenance',
          estimated_duration: 120,
          base_price: 135,
          category: 'plumbing'
        },
        {
          id: 'smart-home-setup',
          name: 'Smart Home Setup',
          description: 'Smart device installation and configuration',
          estimated_duration: 240,
          base_price: 250,
          category: 'smart'
        }
      ]
      
      // Use database services if available, otherwise use mock services
      setServiceTypes(serviceTypesFromDB.length > 0 ? serviceTypesFromDB : mockServices)
    } catch (error) {
      console.error('Error loading service types:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTimeSlots = (date: string) => {
    // Mock time slots - in real implementation would check technician availability
    const slots: TimeSlot[] = [
      { time: '08:00', available: true, technician: 'Mike Rodriguez' },
      { time: '09:00', available: true, technician: 'Sarah Chen' },
      { time: '10:00', available: false },
      { time: '11:00', available: true, technician: 'Mike Rodriguez' },
      { time: '13:00', available: true, technician: 'Tom Wilson' },
      { time: '14:00', available: true, technician: 'Sarah Chen' },
      { time: '15:00', available: true, technician: 'Mike Rodriguez' },
      { time: '16:00', available: false },
      { time: '17:00', available: true, technician: 'Lisa Park' }
    ]
    setTimeSlots(slots)
  }

  const handleSubmit = async () => {
    if (!selectedService || !selectedDate || !selectedTime || !currentUser) return

    setSubmitting(true)
    try {
      // Calculate estimated end time
      const startDateTime = new Date(`${selectedDate}T${selectedTime}`)
      const endDateTime = new Date(startDateTime.getTime() + selectedService.estimated_duration * 60000)
      
      // Calculate urgency fee
      let urgencyFee = 0
      if (urgency === 'priority') urgencyFee = 50
      else if (urgency === 'emergency') urgencyFee = 150
      
      const totalCost = selectedService.base_price + urgencyFee
      
      // Generate unique job number
      const jobNumber = `JOB-${Date.now().toString().slice(-6)}`
      
      // Find or create customer account
      let accountId = null
      let contactId = customerId
      
      if (customerId) {
        // Try to find existing contact and associated account
        const { data: contact } = await supabase
          .from('contacts')
          .select('*, account:accounts(*)')
          .eq('id', customerId)
          .single()
        
        if (contact?.account) {
          accountId = contact.account.id
        } else {
          // Create new account for customer
          const { data: newAccount, error: accountError } = await supabase
            .from('accounts')
            .insert({
              tenant_id: userProfile?.tenant_id || '',
              name: customerName,
              type: 'Customer',
              phone: customerPhone,
              email: customerEmail,
              account_status: 'Active'
            })
            .select()
            .single()
          
          if (!accountError && newAccount) {
            accountId = newAccount.id
            
            // Update contact with account_id
            await supabase
              .from('contacts')
              .update({ account_id: newAccount.id })
              .eq('id', customerId)
          }
        }
      }
      
      // Create the job
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert({
          tenant_id: userProfile?.tenant_id || '',
          account_id: accountId,
          contact_id: contactId,
          job_number: jobNumber,
          title: selectedService.name,
          description: `${selectedService.description}${customerNotes ? `\n\nCustomer Notes: ${customerNotes}` : ''}\n\nScheduled via Customer Portal`,
          start_date: startDateTime.toISOString(),
          due_date: endDateTime.toISOString(),
          estimated_cost: totalCost,
          estimated_hours: selectedService.estimated_duration / 60,
          status: 'Scheduled',
          priority: urgency === 'emergency' ? 'high' : urgency === 'priority' ? 'medium' : 'low',
          notes: `Service Type: ${selectedService.category}\nUrgency: ${urgency}${customerNotes ? `\nCustomer Notes: ${customerNotes}` : ''}`,
          location_address: 'Customer Location' // This should be filled from customer profile
        })
        .select()
        .single()

      if (jobError) {
        console.error('Job creation error:', jobError)
        throw jobError
      }
      
      console.log('Job created successfully:', job)
      
      // Create initial job cost entry for the service
      if (job) {
        await supabase
          .from('job_costs')
          .insert({
            job_id: job.id,
            description: `${selectedService.name} - Base Service Fee`,
            amount: selectedService.base_price,
            cost_type: 'service',
            status: 'pending'
          })
        
        // Add urgency fee if applicable
        if (urgencyFee > 0) {
          await supabase
            .from('job_costs')
            .insert({
              job_id: job.id,
              description: `${urgency.charAt(0).toUpperCase() + urgency.slice(1)} Service Fee`,
              amount: urgencyFee,
              cost_type: 'fee',
              status: 'pending'
            })
        }
      }
      
      // Send notification (future: integrate with notification system)
      console.log('Appointment scheduled:', {
        jobId: job?.id,
        customer: customerName,
        service: selectedService.name,
        date: selectedDate,
        time: selectedTime,
        total: totalCost
      })

      // Show success and close modal
      alert(`Service appointment scheduled successfully!\n\nJob #: ${jobNumber}\nDate: ${new Date(selectedDate).toLocaleDateString()}\nTime: ${selectedTime}\nTotal Cost: $${totalCost}\n\nYou will receive a confirmation email shortly.`)
      onClose()
      
    } catch (error) {
      console.error('Error scheduling service:', error)
      alert('There was an error scheduling your appointment. Please try again or call us directly.')
    } finally {
      setSubmitting(false)
    }
  }

  const getMinDate = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  }

  const getMaxDate = () => {
    const maxDate = new Date()
    maxDate.setDate(maxDate.getDate() + 30)
    return maxDate.toISOString().split('T')[0]
  }

  if (!isOpen) return null

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h4 className="modal-title">
              <i className="ki-duotone ki-calendar-add fs-3 text-primary me-2">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              Schedule Service Appointment
            </h4>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>

          <div className="modal-body">
            {/* Progress Steps */}
            <div className="d-flex justify-content-center mb-6">
              <div className="stepper stepper-pills stepper-column d-flex flex-stack flex-wrap flex-rg-row-reverse">
                <div className="stepper-nav flex-center flex-wrap mb-10 mb-xl-0">
                  {[1, 2, 3].map(step => (
                    <div key={step} className={`stepper-item mx-8 my-4 ${currentStep >= step ? 'current' : ''}`}>
                      <div className="stepper-wrapper d-flex align-items-center">
                        <div className={`stepper-icon w-40px h-40px ${currentStep >= step ? 'bg-primary' : 'bg-light'}`}>
                          <i className={`stepper-check fas fa-check text-white ${currentStep > step ? '' : 'd-none'}`}></i>
                          <span className={`stepper-number text-white fw-bold ${currentStep > step ? 'd-none' : ''}`}>{step}</span>
                        </div>
                        <div className="stepper-label">
                          <h3 className="stepper-title fs-6 fw-bold text-dark">
                            {step === 1 && 'Service Type'}
                            {step === 2 && 'Date & Time'}
                            {step === 3 && 'Confirmation'}
                          </h3>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 1: Service Selection */}
            {currentStep === 1 && (
              <div>
                <h5 className="fw-bold text-dark mb-4">What service do you need?</h5>
                {loading ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary"></div>
                  </div>
                ) : (
                  <div className="row g-3">
                    {serviceTypes.map(service => (
                      <div key={service.id} className="col-md-6">
                        <div 
                          className={`card cursor-pointer h-100 ${selectedService?.id === service.id ? 'border-primary shadow' : 'border-light'}`}
                          onClick={() => setSelectedService(service)}
                        >
                          <div className="card-body p-4">
                            <div className="d-flex justify-content-between align-items-start mb-3">
                              <h6 className="fw-bold text-dark mb-0">{service.name}</h6>
                              <span className="badge badge-light-primary">${service.base_price}</span>
                            </div>
                            <p className="text-muted fs-6 mb-2">{service.description}</p>
                            <div className="text-muted fs-7">
                              <i className="ki-duotone ki-time fs-6 me-1">
                                <span className="path1"></span>
                                <span className="path2"></span>
                              </i>
                              ~{Math.floor(service.estimated_duration / 60)}h {service.estimated_duration % 60}m
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-5">
                  <label className="form-label">Urgency Level</label>
                  <div className="row g-3">
                    {[
                      { value: 'standard', label: 'Standard', desc: 'Next available appointment', color: 'info' },
                      { value: 'priority', label: 'Priority', desc: 'Within 24 hours (+$50)', color: 'warning' },
                      { value: 'emergency', label: 'Emergency', desc: 'Same day service (+$150)', color: 'danger' }
                    ].map(option => (
                      <div key={option.value} className="col-md-4">
                        <div 
                          className={`card cursor-pointer ${urgency === option.value ? `border-${option.color} shadow` : 'border-light'}`}
                          onClick={() => setUrgency(option.value as any)}
                        >
                          <div className="card-body text-center p-3">
                            <h6 className="fw-bold text-dark mb-1">{option.label}</h6>
                            <p className="text-muted fs-7 mb-0">{option.desc}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Date & Time Selection */}
            {currentStep === 2 && selectedService && (
              <div>
                <h5 className="fw-bold text-dark mb-4">When would you like us to come?</h5>
                
                <div className="row g-5">
                  <div className="col-md-6">
                    <label className="form-label required">Select Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      min={getMinDate()}
                      max={getMaxDate()}
                    />
                    <div className="text-muted fs-7 mt-1">Available dates within the next 30 days</div>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label required">Select Time</label>
                    {selectedDate ? (
                      <div className="d-flex flex-column gap-2" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {timeSlots.map(slot => (
                          <button
                            key={slot.time}
                            type="button"
                            className={`btn text-start ${selectedTime === slot.time ? 'btn-primary' : slot.available ? 'btn-light' : 'btn-light'}`}
                            onClick={() => slot.available && setSelectedTime(slot.time)}
                            disabled={!slot.available}
                          >
                            <div className="d-flex justify-content-between align-items-center">
                              <span>{slot.time}</span>
                              {slot.available ? (
                                <span className="text-muted fs-7">{slot.technician}</span>
                              ) : (
                                <span className="text-danger fs-7">Unavailable</span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-muted fs-6">Please select a date first</div>
                    )}
                  </div>
                </div>

                <div className="mt-5">
                  <label className="form-label">Additional Notes (Optional)</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    placeholder="Any specific instructions, preferred entry points, or details about the issue..."
                  />
                </div>
              </div>
            )}

            {/* Step 3: Confirmation */}
            {currentStep === 3 && selectedService && selectedDate && selectedTime && (
              <div>
                <h5 className="fw-bold text-dark mb-4">Confirm Your Appointment</h5>
                
                <div className="card border-light bg-light">
                  <div className="card-body p-5">
                    <div className="row g-4">
                      <div className="col-md-6">
                        <h6 className="fw-bold text-dark mb-2">Service Details</h6>
                        <div className="mb-2">
                          <span className="text-muted">Service: </span>
                          <span className="fw-semibold">{selectedService.name}</span>
                        </div>
                        <div className="mb-2">
                          <span className="text-muted">Duration: </span>
                          <span className="fw-semibold">~{Math.floor(selectedService.estimated_duration / 60)}h {selectedService.estimated_duration % 60}m</span>
                        </div>
                        <div className="mb-2">
                          <span className="text-muted">Base Price: </span>
                          <span className="fw-semibold">${selectedService.base_price}</span>
                        </div>
                        {urgency !== 'standard' && (
                          <div className="mb-2">
                            <span className="text-muted">Urgency Fee: </span>
                            <span className="fw-semibold">${urgency === 'priority' ? '50' : '150'}</span>
                          </div>
                        )}
                        <div className="mb-2 border-top pt-2">
                          <span className="text-muted">Total Cost: </span>
                          <span className="fw-bold text-primary">${selectedService.base_price + (urgency === 'priority' ? 50 : urgency === 'emergency' ? 150 : 0)}</span>
                        </div>
                        <div className="mb-2">
                          <span className="text-muted">Urgency: </span>
                          <span className={`badge badge-light-${urgency === 'emergency' ? 'danger' : urgency === 'priority' ? 'warning' : 'info'}`}>
                            {urgency.charAt(0).toUpperCase() + urgency.slice(1)}
                          </span>
                        </div>
                      </div>

                      <div className="col-md-6">
                        <h6 className="fw-bold text-dark mb-2">Appointment Details</h6>
                        <div className="mb-2">
                          <span className="text-muted">Date: </span>
                          <span className="fw-semibold">{new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                        </div>
                        <div className="mb-2">
                          <span className="text-muted">Time: </span>
                          <span className="fw-semibold">{selectedTime}</span>
                        </div>
                        <div className="mb-2">
                          <span className="text-muted">Technician: </span>
                          <span className="fw-semibold">{timeSlots.find(slot => slot.time === selectedTime)?.technician || 'TBD'}</span>
                        </div>
                        <div className="mb-2">
                          <span className="text-muted">Customer: </span>
                          <span className="fw-semibold">{customerName}</span>
                        </div>
                      </div>
                    </div>

                    {customerNotes && (
                      <div className="mt-4">
                        <h6 className="fw-bold text-dark mb-2">Special Instructions</h6>
                        <div className="bg-white p-3 rounded border">
                          {customerNotes}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="alert alert-info mt-4">
                  <div className="d-flex align-items-center">
                    <i className="ki-duotone ki-information-4 fs-2x text-info me-3">
                      <span className="path1"></span>
                      <span className="path2"></span>
                      <span className="path3"></span>
                    </i>
                    <div>
                      <h6 className="mb-1">What happens next?</h6>
                      <p className="mb-0 fs-6">You'll receive a confirmation email with appointment details. Our technician will call you 30 minutes before arrival.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <div className="d-flex justify-content-between w-100">
              <div>
                {currentStep > 1 && (
                  <button 
                    className="btn btn-light text-dark"
                    onClick={() => setCurrentStep(currentStep - 1)}
                    disabled={submitting}
                  >
                    <i className="ki-duotone ki-left fs-5 me-1">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    Back
                  </button>
                )}
              </div>
              
              <div className="d-flex gap-2">
                <button className="btn btn-secondary text-dark" onClick={onClose} disabled={submitting}>
                  Cancel
                </button>
                
                {currentStep < 3 ? (
                  <button 
                    className="btn btn-primary"
                    onClick={() => setCurrentStep(currentStep + 1)}
                    disabled={
                      (currentStep === 1 && !selectedService) ||
                      (currentStep === 2 && (!selectedDate || !selectedTime))
                    }
                  >
                    Continue
                    <i className="ki-duotone ki-right fs-5 ms-1">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                  </button>
                ) : (
                  <button 
                    className="btn btn-success"
                    onClick={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Scheduling...
                      </>
                    ) : (
                      <>
                        <i className="ki-duotone ki-check fs-5 me-2">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        Confirm Appointment
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ServiceSchedulingModal