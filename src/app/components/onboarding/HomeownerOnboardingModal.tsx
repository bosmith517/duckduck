import React, { useState } from 'react'
import { KTIcon } from '../../../_metronic/helpers'
import { supabase } from '../../../supabaseClient'

interface HomeownerOnboardingModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (data: HomeownerData) => void
  contractorName?: string
  tenantId?: string // The contractor's tenant ID
}

interface HomeownerData {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  serviceNeeded: string
  urgency: 'emergency' | 'urgent' | 'normal' | 'scheduled'
  description: string
  preferredContactMethod: 'phone' | 'email' | 'text'
  bestTimeToCall: string
}

const SERVICE_TYPES = [
  'HVAC Repair',
  'Plumbing',
  'Electrical',
  'Roofing',
  'General Maintenance',
  'Emergency Service',
  'Other'
]

export const HomeownerOnboardingModal: React.FC<HomeownerOnboardingModalProps> = ({ 
  isOpen, 
  onClose, 
  onComplete,
  contractorName = 'TradeWorks Pro',
  tenantId
}) => {
  const [formData, setFormData] = useState<HomeownerData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    serviceNeeded: '',
    urgency: 'normal',
    description: '',
    preferredContactMethod: 'phone',
    bestTimeToCall: 'anytime'
  })

  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      // Create lead/contact in database
      if (tenantId) {
        const { data: contact, error: contactError } = await supabase
          .from('contacts')
          .insert({
            tenant_id: tenantId,
            first_name: formData.firstName,
            last_name: formData.lastName,
            email: formData.email,
            phone: formData.phone,
            address: formData.address,
            contact_type: 'lead',
            lead_source: 'homeowner_portal',
            preferred_contact_method: formData.preferredContactMethod,
            notes: `Service needed: ${formData.serviceNeeded}\nUrgency: ${formData.urgency}\nDescription: ${formData.description}\nBest time to call: ${formData.bestTimeToCall}`,
            created_at: new Date().toISOString()
          })
          .select()
          .single()

        if (contactError) throw contactError

        // Create initial job/service request
        const { error: jobError } = await supabase
          .from('jobs')
          .insert({
            tenant_id: tenantId,
            contact_id: contact.id,
            title: `${formData.serviceNeeded} - ${formData.firstName} ${formData.lastName}`,
            description: formData.description,
            service_type: formData.serviceNeeded,
            status: 'lead',
            priority: formData.urgency,
            service_address: formData.address,
            notes: `Preferred contact: ${formData.preferredContactMethod}\nBest time: ${formData.bestTimeToCall}`,
            created_at: new Date().toISOString()
          })

        if (jobError) throw jobError

        // Send notification to contractor
        await supabase.functions.invoke('notify-new-lead', {
          body: {
            tenantId,
            contactId: contact.id,
            serviceType: formData.serviceNeeded,
            urgency: formData.urgency,
            contactMethod: formData.preferredContactMethod,
            customerName: `${formData.firstName} ${formData.lastName}`,
            customerPhone: formData.phone,
            customerEmail: formData.email
          }
        })
      }

      await onComplete(formData)
      onClose()
    } catch (error) {
      console.error('Error submitting homeowner form:', error)
      alert('There was an error submitting your information. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = formData.firstName && formData.lastName && 
                   (formData.phone || formData.email) && formData.serviceNeeded

  if (!isOpen) return null

  return (
    <div 
      className="modal show d-block" 
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999 }}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header bg-light-primary">
            <h3 className="modal-title">
              <KTIcon iconName="home-2" className="fs-2x text-primary me-3" />
              Get Your Service Request Started
            </h3>
            <button 
              type="button" 
              className="btn-close" 
              onClick={onClose}
            ></button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="alert alert-info d-flex align-items-center mb-6">
                <KTIcon iconName="information" className="fs-2x text-info me-3" />
                <div>
                  <strong>Welcome!</strong> We're excited to help you with your service needs. 
                  This quick form helps {contractorName} provide you with the best possible service.
                </div>
              </div>

              <div className="row g-4">
                {/* Personal Information */}
                <div className="col-12">
                  <h5 className="text-gray-800 mb-4">Contact Information</h5>
                </div>
                
                <div className="col-md-6">
                  <label className="form-label required">First Name</label>
                  <input
                    type="text"
                    className="form-control form-control-lg"
                    value={formData.firstName}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    required
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label required">Last Name</label>
                  <input
                    type="text"
                    className="form-control form-control-lg"
                    value={formData.lastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    required
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label required">Phone Number</label>
                  <input
                    type="tel"
                    className="form-control form-control-lg"
                    placeholder="(555) 123-4567"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-control form-control-lg"
                    placeholder="your@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>

                <div className="col-12">
                  <label className="form-label">Service Address</label>
                  <input
                    type="text"
                    className="form-control form-control-lg"
                    placeholder="123 Main St, City, State 12345"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  />
                </div>

                {/* Service Information */}
                <div className="col-12 mt-6">
                  <h5 className="text-gray-800 mb-4">Service Details</h5>
                </div>

                <div className="col-md-6">
                  <label className="form-label required">Type of Service Needed</label>
                  <select
                    className="form-select form-select-lg"
                    value={formData.serviceNeeded}
                    onChange={(e) => setFormData(prev => ({ ...prev, serviceNeeded: e.target.value }))}
                    required
                  >
                    <option value="">Select service type...</option>
                    {SERVICE_TYPES.map(service => (
                      <option key={service} value={service}>{service}</option>
                    ))}
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label">Urgency Level</label>
                  <select
                    className="form-select form-select-lg"
                    value={formData.urgency}
                    onChange={(e) => setFormData(prev => ({ ...prev, urgency: e.target.value as any }))}
                  >
                    <option value="emergency">🚨 Emergency (ASAP)</option>
                    <option value="urgent">⚡ Urgent (Today)</option>
                    <option value="normal">📅 Normal (This week)</option>
                    <option value="scheduled">⏰ Scheduled (Flexible)</option>
                  </select>
                </div>

                <div className="col-12">
                  <label className="form-label">Description of Issue</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Please describe what's happening and any relevant details..."
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                {/* Contact Preferences */}
                <div className="col-12 mt-6">
                  <h5 className="text-gray-800 mb-4">Contact Preferences</h5>
                </div>

                <div className="col-md-6">
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

                <div className="col-md-6">
                  <label className="form-label">Best Time to Contact</label>
                  <select
                    className="form-select form-select-lg"
                    value={formData.bestTimeToCall}
                    onChange={(e) => setFormData(prev => ({ ...prev, bestTimeToCall: e.target.value }))}
                  >
                    <option value="anytime">Anytime</option>
                    <option value="morning">Morning (8am-12pm)</option>
                    <option value="afternoon">Afternoon (12pm-5pm)</option>
                    <option value="evening">Evening (5pm-8pm)</option>
                    <option value="weekends">Weekends only</option>
                  </select>
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
                disabled={!canSubmit || loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <KTIcon iconName="check" className="fs-6 me-1" />
                    Submit Service Request
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

export default HomeownerOnboardingModal