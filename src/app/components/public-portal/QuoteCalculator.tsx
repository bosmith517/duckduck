import React, { useState } from 'react'

interface QuoteCalculatorProps {
  isOpen: boolean
  onClose: () => void
  tenantId: string
  referralCode?: string | null
}

const QuoteCalculator: React.FC<QuoteCalculatorProps> = ({ 
  isOpen, 
  onClose, 
  tenantId,
  referralCode 
}) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    serviceType: '',
    squareFootage: '',
    message: ''
  })

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Submit quote request
    console.log('Quote request:', formData, 'Referral:', referralCode)
    onClose()
  }

  return (
    <>
      <div className="modal fade show d-block" tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Get Your Free Quote</h5>
              <button 
                type="button" 
                className="btn-close" 
                onClick={onClose}
              ></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="row g-4">
                  <div className="col-md-6">
                    <label className="form-label required">Your Name</label>
                    <input
                      type="text"
                      className="form-control form-control-solid"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label required">Email</label>
                    <input
                      type="email"
                      className="form-control form-control-solid"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Phone</label>
                    <input
                      type="tel"
                      className="form-control form-control-solid"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label required">Service Type</label>
                    <select
                      className="form-select form-select-solid"
                      value={formData.serviceType}
                      onChange={(e) => setFormData({...formData, serviceType: e.target.value})}
                      required
                    >
                      <option value="">Select a service</option>
                      <option value="hvac">HVAC Service</option>
                      <option value="plumbing">Plumbing</option>
                      <option value="electrical">Electrical</option>
                      <option value="roofing">Roofing</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label">Square Footage (optional)</label>
                    <input
                      type="number"
                      className="form-control form-control-solid"
                      value={formData.squareFootage}
                      onChange={(e) => setFormData({...formData, squareFootage: e.target.value})}
                      placeholder="Approximate square footage"
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Additional Details</label>
                    <textarea
                      className="form-control form-control-solid"
                      rows={4}
                      value={formData.message}
                      onChange={(e) => setFormData({...formData, message: e.target.value})}
                      placeholder="Tell us more about your project..."
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Get My Quote
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show"></div>
    </>
  )
}

export default QuoteCalculator