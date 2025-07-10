import React from 'react'
import { KTIcon } from '../../../_metronic/helpers'

interface TrackingInfoModalProps {
  isOpen: boolean
  onClose: () => void
  trackingUrl: string
  jobTitle: string
  customerName: string
}

export const TrackingInfoModal: React.FC<TrackingInfoModalProps> = ({
  isOpen,
  onClose,
  trackingUrl,
  jobTitle,
  customerName
}) => {
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(trackingUrl)
      alert('Tracking link copied to clipboard!')
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleShareViaText = () => {
    const message = `Hi ${customerName}! I'm on my way to your location for: ${jobTitle}. Track my arrival here: ${trackingUrl}`
    const smsUrl = `sms:?body=${encodeURIComponent(message)}`
    window.open(smsUrl, '_system')
  }

  const handleShareViaWhatsApp = () => {
    const message = `Hi ${customerName}! I'm on my way to your location for: ${jobTitle}. Track my arrival here: ${trackingUrl}`
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank')
  }

  if (!isOpen) return null

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header bg-success text-white">
            <h5 className="modal-title">
              <KTIcon iconName="geolocation" className="fs-3 me-2" />
              Tracking Started!
            </h5>
            <button 
              className="btn-close btn-close-white"
              onClick={onClose}
            ></button>
          </div>
          <div className="modal-body">
            <div className="alert alert-success d-flex align-items-center mb-4">
              <KTIcon iconName="check-circle" className="fs-2 me-3" />
              <div>
                <strong>Location tracking is active!</strong><br />
                Share the link below with your customer
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label fw-bold">Tracking Link:</label>
              <div className="input-group">
                <input 
                  type="text" 
                  className="form-control" 
                  value={trackingUrl}
                  readOnly
                />
                <button 
                  className="btn btn-primary"
                  onClick={handleCopyLink}
                >
                  <KTIcon iconName="copy" className="fs-4" />
                </button>
              </div>
            </div>

            <div className="d-grid gap-2">
              <button 
                className="btn btn-light-primary"
                onClick={handleShareViaText}
              >
                <KTIcon iconName="message-text" className="fs-4 me-2" />
                Share via Text Message
              </button>
              <button 
                className="btn btn-light-success"
                onClick={handleShareViaWhatsApp}
              >
                <i className="bi bi-whatsapp me-2"></i>
                Share via WhatsApp
              </button>
            </div>

            <div className="mt-4 p-3 bg-light rounded">
              <small className="text-muted">
                <KTIcon iconName="information" className="fs-6 me-1" />
                The customer will be able to see your real-time location as you travel to their property.
                Tracking automatically stops when you complete the job.
              </small>
            </div>
          </div>
          <div className="modal-footer">
            <button 
              className="btn btn-secondary"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TrackingInfoModal