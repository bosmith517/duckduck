import React, { useState } from 'react'
import { KTIcon } from '../../../_metronic/helpers'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'

interface CustomerIntakeModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (customerId: string, jobId: string) => void
  prefillData?: Partial<CustomerIntakeData>
}

interface CustomerIntakeData {
  // Customer Info
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  
  // Job Details
  serviceType: string
  urgency: 'emergency' | 'urgent' | 'normal' | 'scheduled'
  description: string
  estimatedCost: number
  
  // Scheduling
  preferredDate: string
  preferredTime: string
  duration: number
  
  // Communication
  preferredContactMethod: 'phone' | 'email' | 'text'
  notes: string
}

const SERVICE_TYPES = [
  'HVAC Repair',
  'HVAC Installation', 
  'Plumbing Repair',
  'Plumbing Installation',
  'Electrical Repair',
  'Electrical Installation',
  'Roofing',
  'General Maintenance',
  'Emergency Service',
  'Inspection',
  'Other'
]

export const CustomerIntakeModal: React.FC<CustomerIntakeModalProps> = ({ 
  isOpen, 
  onClose, 
  onComplete,
  prefillData = {}
}) => {
  const { userProfile, tenant } = useSupabaseAuth()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState<CustomerIntakeData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    serviceType: '',
    urgency: 'normal',
    description: '',
    estimatedCost: 0,
    preferredDate: '',
    preferredTime: '',
    duration: 60,
    preferredContactMethod: 'phone',
    notes: '',
    ...prefillData
  })

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(prev => prev + 1)
    } else {
      handleSubmit()
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const handleSubmit = async () => {
    if (!userProfile?.tenant_id) return

    setLoading(true)
    try {
      // 1. Create/Update Customer
      const { data: customer, error: customerError } = await supabase
        .from('contacts')
        .upsert({
          tenant_id: userProfile.tenant_id,
          first_name: formData.firstName,
          last_name: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          contact_type: 'customer',
          lead_source: 'phone_intake',
          preferred_contact_method: formData.preferredContactMethod,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'phone,tenant_id'
        })
        .select()
        .single()

      if (customerError) throw customerError

      // 2. Create Job
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert({
          tenant_id: userProfile.tenant_id,
          contact_id: customer.id,
          title: `${formData.serviceType} - ${formData.firstName} ${formData.lastName}`,
          description: formData.description,
          service_type: formData.serviceType,
          status: formData.urgency === 'emergency' ? 'scheduled' : 'lead',
          priority: formData.urgency,
          estimated_cost: formData.estimatedCost,
          estimated_duration: formData.duration,
          scheduled_start: formData.preferredDate ? 
            new Date(`${formData.preferredDate}T${formData.preferredTime || '09:00'}`).toISOString() 
            : null,
          assigned_technician_id: userProfile.id,
          service_address: formData.address,
          notes: formData.notes,
          created_by: userProfile.id,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (jobError) throw jobError

      // 3. Create initial activity log
      await supabase
        .from('job_activities')
        .insert({
          job_id: job.id,
          activity_type: 'intake_completed',
          description: `Customer intake completed during phone call by ${userProfile.first_name} ${userProfile.last_name}`,
          performed_by: userProfile.id,
          created_at: new Date().toISOString()
        })

      console.log('Customer intake completed:', { customer: customer.id, job: job.id })
      onComplete(customer.id, job.id)
      onClose()

    } catch (error) {
      console.error('Error creating customer/job:', error)
      alert('There was an error saving the customer information. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const canContinue = () => {
    switch (currentStep) {
      case 1:
        return formData.firstName && formData.lastName && (formData.phone || formData.email)
      case 2:
        return formData.serviceType && formData.description
      case 3:
        return true
      default:
        return false
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="modal show d-block" 
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999 }}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header bg-light-success">
            <h3 className="modal-title">
              <KTIcon iconName="user-tick" className="fs-2x text-success me-3" />
              Customer Intake - Step {currentStep} of 3
            </h3>
            <button 
              type="button" 
              className="btn-close" 
              onClick={onClose}
            ></button>
          </div>

          <div className="modal-body">
            {/* Progress Bar */}
            <div className="mb-6">
              <div className="progress progress-sm">
                <div 
                  className="progress-bar bg-success" 
                  style={{ width: `${(currentStep / 3) * 100}%` }}
                ></div>
              </div>
              <div className="d-flex justify-content-between mt-2">
                <small className={currentStep >= 1 ? 'text-success fw-bold' : 'text-muted'}>Customer Info</small>
                <small className={currentStep >= 2 ? 'text-success fw-bold' : 'text-muted'}>Service Details</small>
                <small className={currentStep >= 3 ? 'text-success fw-bold' : 'text-muted'}>Scheduling</small>
              </div>
            </div>

            {/* Step 1: Customer Information */}
            {currentStep === 1 && (
              <div className="row g-4">
                <div className="col-12">
                  <h5 className="text-gray-800 mb-4">Customer Information</h5>
                </div>
                
                <div className="col-md-6">
                  <label className="form-label required">First Name</label>
                  <input
                    type="text"
                    className="form-control form-control-lg"
                    value={formData.firstName}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    placeholder="John"
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label required">Last Name</label>
                  <input
                    type="text"
                    className="form-control form-control-lg"
                    value={formData.lastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    placeholder="Smith"
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label required">Phone</label>
                  <input
                    type="tel"
                    className="form-control form-control-lg"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-control form-control-lg"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="john@email.com"
                  />
                </div>

                <div className="col-12">
                  <label className="form-label">Service Address</label>
                  <input
                    type="text"
                    className="form-control form-control-lg"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="123 Main St, City, State 12345"
                  />
                </div>

                <div className="col-12">
                  <label className="form-label">Preferred Contact Method</label>
                  <select
                    className="form-select form-select-lg"
                    value={formData.preferredContactMethod}
                    onChange={(e) => setFormData(prev => ({ ...prev, preferredContactMethod: e.target.value as any }))}
                  >
                    <option value="phone">📞 Phone Call</option>
                    <option value="text">💬 Text Message</option>
                    <option value="email">📧 Email</option>
                  </select>
                </div>
              </div>
            )}

            {/* Step 2: Service Details */}
            {currentStep === 2 && (
              <div className="row g-4">
                <div className="col-12">
                  <h5 className="text-gray-800 mb-4">Service Details</h5>
                </div>

                <div className="col-md-6">
                  <label className="form-label required">Service Type</label>
                  <select
                    className="form-select form-select-lg"
                    value={formData.serviceType}
                    onChange={(e) => setFormData(prev => ({ ...prev, serviceType: e.target.value }))}
                  >
                    <option value="">Select service...</option>
                    {SERVICE_TYPES.map(service => (
                      <option key={service} value={service}>{service}</option>
                    ))}
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label">Priority/Urgency</label>
                  <select
                    className="form-select form-select-lg"
                    value={formData.urgency}
                    onChange={(e) => setFormData(prev => ({ ...prev, urgency: e.target.value as any }))}
                  >
                    <option value="emergency">🚨 Emergency</option>
                    <option value="urgent">⚡ Urgent</option>
                    <option value="normal">📅 Normal</option>
                    <option value="scheduled">⏰ Scheduled</option>
                  </select>
                </div>

                <div className="col-12">
                  <label className="form-label required">Description of Issue</label>
                  <textarea
                    className="form-control"
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe the issue, symptoms, what the customer has tried, etc."
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Estimated Cost</label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                    <input
                      type="number"
                      className="form-control form-control-lg"
                      value={formData.estimatedCost || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, estimatedCost: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="col-md-6">
                  <label className="form-label">Estimated Duration</label>
                  <select
                    className="form-select form-select-lg"
                    value={formData.duration}
                    onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                  >
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={90}>1.5 hours</option>
                    <option value={120}>2 hours</option>
                    <option value={180}>3 hours</option>
                    <option value={240}>4 hours</option>
                    <option value={480}>All day</option>
                  </select>
                </div>
              </div>
            )}

            {/* Step 3: Scheduling & Notes */}
            {currentStep === 3 && (
              <div className="row g-4">
                <div className="col-12">
                  <h5 className="text-gray-800 mb-4">Scheduling & Additional Notes</h5>
                </div>

                <div className="col-md-6">
                  <label className="form-label">Preferred Date</label>
                  <input
                    type="date"
                    className="form-control form-control-lg"
                    value={formData.preferredDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, preferredDate: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Preferred Time</label>
                  <input
                    type="time"
                    className="form-control form-control-lg"
                    value={formData.preferredTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, preferredTime: e.target.value }))}
                  />
                </div>

                <div className="col-12">
                  <label className="form-label">Additional Notes</label>
                  <textarea
                    className="form-control"
                    rows={4}
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Any additional notes, special instructions, access information, etc."
                  />
                </div>

                <div className="col-12">
                  <div className="alert alert-info">
                    <h6>Summary:</h6>
                    <p><strong>{formData.firstName} {formData.lastName}</strong> - {formData.phone}</p>
                    <p><strong>Service:</strong> {formData.serviceType} ({formData.urgency})</p>
                    <p><strong>Issue:</strong> {formData.description.substring(0, 100)}{formData.description.length > 100 ? '...' : ''}</p>
                  </div>
                </div>
              </div>
            )}
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
            
            {currentStep > 1 && (
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={handleBack}
                disabled={loading}
              >
                <KTIcon iconName="arrow-left" className="fs-6 me-1" />
                Back
              </button>
            )}
            
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={handleNext}
              disabled={!canContinue() || loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  Creating...
                </>
              ) : currentStep === 3 ? (
                <>
                  <KTIcon iconName="check" className="fs-6 me-1" />
                  Create Customer & Job
                </>
              ) : (
                <>
                  Next
                  <KTIcon iconName="arrow-right" className="fs-6 ms-1" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CustomerIntakeModal