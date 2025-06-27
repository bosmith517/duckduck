import React, { useState } from 'react'

interface ContactTechnicianModalProps {
  isOpen: boolean
  onClose: () => void
  technicianName?: string
  technicianPhone?: string
  jobId?: string
}

const ContactTechnicianModal: React.FC<ContactTechnicianModalProps> = ({
  isOpen,
  onClose,
  technicianName = 'Your Technician',
  technicianPhone = '+15551234567',
  jobId
}) => {
  const [messageType, setMessageType] = useState<'call' | 'text' | 'chat'>('call')
  const [customMessage, setCustomMessage] = useState('')

  const handleCall = () => {
    window.open(`tel:${technicianPhone}`, '_self')
  }

  const handleText = () => {
    const message = customMessage || 'Hi! I have a question about my upcoming service appointment.'
    const encodedMessage = encodeURIComponent(message)
    window.open(`sms:${technicianPhone}?body=${encodedMessage}`, '_self')
  }

  const handleChat = () => {
    // In a real implementation, this would open a chat interface
    alert('Live chat is coming soon! For now, please call or text your technician.')
  }

  const quickMessages = [
    'Running a few minutes late',
    'Can you call when you arrive?',
    'Please use the side entrance',
    'I have a question about the service',
    'Can we reschedule for later today?'
  ]

  if (!isOpen) return null

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h4 className="modal-title">
              <i className="ki-duotone ki-message-text-2 fs-3 text-primary me-2">
                <span className="path1"></span>
                <span className="path2"></span>
                <span className="path3"></span>
              </i>
              Contact {technicianName}
            </h4>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>

          <div className="modal-body">
            {/* Contact Method Selection */}
            <div className="mb-6">
              <h6 className="fw-bold text-dark mb-3">How would you like to contact your technician?</h6>
              <div className="row g-3">
                <div className="col-md-4">
                  <div 
                    className={`card cursor-pointer h-100 ${messageType === 'call' ? 'border-primary shadow' : 'border-light'}`}
                    onClick={() => setMessageType('call')}
                  >
                    <div className="card-body text-center p-4">
                      <i className="ki-duotone ki-phone fs-3x text-success mb-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <h6 className="fw-bold text-dark mb-1">Phone Call</h6>
                      <p className="text-muted fs-7 mb-0">Speak directly with your technician</p>
                    </div>
                  </div>
                </div>

                <div className="col-md-4">
                  <div 
                    className={`card cursor-pointer h-100 ${messageType === 'text' ? 'border-primary shadow' : 'border-light'}`}
                    onClick={() => setMessageType('text')}
                  >
                    <div className="card-body text-center p-4">
                      <i className="ki-duotone ki-sms fs-3x text-warning mb-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <h6 className="fw-bold text-dark mb-1">Text Message</h6>
                      <p className="text-muted fs-7 mb-0">Send a quick text message</p>
                    </div>
                  </div>
                </div>

                <div className="col-md-4">
                  <div 
                    className={`card cursor-pointer h-100 ${messageType === 'chat' ? 'border-primary shadow' : 'border-light'}`}
                    onClick={() => setMessageType('chat')}
                  >
                    <div className="card-body text-center p-4">
                      <i className="ki-duotone ki-message-text fs-3x text-info mb-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                        <span className="path3"></span>
                      </i>
                      <h6 className="fw-bold text-dark mb-1">Live Chat</h6>
                      <p className="text-muted fs-7 mb-0">Chat through the app</p>
                      <span className="badge badge-light-warning fs-8 mt-1">Coming Soon</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Text Message Options */}
            {messageType === 'text' && (
              <div className="mb-6">
                <h6 className="fw-bold text-dark mb-3">Quick Messages</h6>
                <div className="d-flex flex-wrap gap-2 mb-4">
                  {quickMessages.map((message, index) => (
                    <button
                      key={index}
                      className={`btn btn-sm ${customMessage === message ? 'btn-primary' : 'btn-light'}`}
                      onClick={() => setCustomMessage(message)}
                    >
                      {message}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="form-label">Custom Message</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Type your message here..."
                  />
                </div>
              </div>
            )}

            {/* Technician Info */}
            <div className="alert alert-info">
              <div className="d-flex align-items-center">
                <i className="ki-duotone ki-information-4 fs-2x text-info me-3">
                  <span className="path1"></span>
                  <span className="path2"></span>
                  <span className="path3"></span>
                </i>
                <div>
                  <h6 className="mb-1">Contact Information</h6>
                  <p className="mb-1 fs-6">
                    <strong>Technician:</strong> {technicianName}<br/>
                    <strong>Phone:</strong> {technicianPhone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')}
                  </p>
                  {jobId && (
                    <p className="mb-0 fs-7 text-muted">
                      <strong>Job ID:</strong> {jobId}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <div className="d-flex justify-content-between w-100">
              <button className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              
              <div className="d-flex gap-2">
                {messageType === 'call' && (
                  <button className="btn btn-success" onClick={handleCall}>
                    <i className="ki-duotone ki-phone fs-5 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    Call Now
                  </button>
                )}
                
                {messageType === 'text' && (
                  <button 
                    className="btn btn-warning" 
                    onClick={handleText}
                    disabled={!customMessage.trim()}
                  >
                    <i className="ki-duotone ki-sms fs-5 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    Send Text
                  </button>
                )}
                
                {messageType === 'chat' && (
                  <button className="btn btn-info" onClick={handleChat} disabled>
                    <i className="ki-duotone ki-message-text fs-5 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                      <span className="path3"></span>
                    </i>
                    Start Chat (Coming Soon)
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

export default ContactTechnicianModal