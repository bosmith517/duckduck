import React, { useState } from 'react'

export const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  
  // Log component mount for debugging
  React.useEffect(() => {
    console.log('💬 ChatWidget mounted')
    return () => console.log('💬 ChatWidget unmounted')
  }, [])
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'support',
      message: 'Hi! I\'m here to help. How can I assist you today?',
      timestamp: new Date(Date.now() - 60000)
    }
  ])
  const [newMessage, setNewMessage] = useState('')

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      const message = {
        id: messages.length + 1,
        sender: 'customer',
        message: newMessage.trim(),
        timestamp: new Date()
      }
      setMessages([...messages, message])
      setNewMessage('')
      
      // Simulate support response after 2 seconds
      setTimeout(() => {
        const response = {
          id: messages.length + 2,
          sender: 'support',
          message: 'Thanks for your message! A team member will get back to you shortly. For urgent matters, please call (123) 456-7890.',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, response])
      }, 2000)
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })
  }

  return (
    <>
      {/* Chat Widget Button */}
      <div 
        className="position-fixed"
        style={{ 
          bottom: '80px', // Higher on mobile to avoid navigation buttons
          right: '20px',
          zIndex: 9999
        }}
      >
        {!isOpen && (
          <button
            className="btn btn-primary rounded-circle shadow-lg d-flex align-items-center justify-content-center"
            style={{ 
              width: '60px', 
              height: '60px',
              background: '#007bff',
              border: 'none',
              boxShadow: '0 4px 12px rgba(0,123,255,0.3)'
            }}
            onClick={() => setIsOpen(true)}
            title="Chat with support"
          >
            <i className="ki-duotone ki-message-text-2 fs-2">
              <span className="path1"></span>
              <span className="path2"></span>
              <span className="path3"></span>
            </i>
          </button>
        )}

        {/* Chat Window */}
        {isOpen && (
          <div 
            className="card shadow-lg border-0"
            style={{ width: '350px', height: '500px' }}
          >
            {/* Chat Header */}
            <div className="card-header bg-primary d-flex align-items-center justify-content-between p-4">
              <div className="d-flex align-items-center">
                <div className="symbol symbol-35px me-3">
                  <span className="symbol-label bg-light-primary text-primary">
                    <i className="ki-duotone ki-message-text-2 fs-4">
                      <span className="path1"></span>
                      <span className="path2"></span>
                      <span className="path3"></span>
                    </i>
                  </span>
                </div>
                <div>
                  <h6 className="text-white mb-0">TradeWorks Support</h6>
                  <span className="text-light fs-7">
                    <i className="ki-duotone ki-abstract-26 fs-7 me-1">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    Online
                  </span>
                </div>
              </div>
              <button
                className="btn btn-sm btn-icon btn-light-primary"
                onClick={() => setIsOpen(false)}
              >
                <i className="ki-duotone ki-cross fs-4">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
              </button>
            </div>

            {/* Messages Area */}
            <div 
              className="card-body p-4 overflow-auto"
              style={{ height: '350px', backgroundColor: '#f8f9fa' }}
            >
              <div className="d-flex flex-column gap-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`d-flex ${msg.sender === 'customer' ? 'justify-content-end' : 'justify-content-start'}`}
                  >
                    <div
                      className={`p-3 rounded-3 max-w-75 ${
                        msg.sender === 'customer' 
                          ? 'bg-primary text-white' 
                          : 'bg-white text-dark shadow-sm border'
                      }`}
                      style={{ maxWidth: '75%' }}
                    >
                      <p className="mb-1 fs-6">{msg.message}</p>
                      <div 
                        className={`fs-8 ${
                          msg.sender === 'customer' ? 'text-light' : 'text-muted'
                        }`}
                      >
                        {formatTime(msg.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Message Input */}
            <div className="card-footer p-4 bg-white border-top">
              <div className="d-flex gap-2">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                >
                  <i className="ki-duotone ki-send fs-5">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                </button>
              </div>
              <div className="text-center mt-2">
                <small className="text-muted fs-8">
                  Powered by TradeWorks Pro
                </small>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Contact Options */}
      {isOpen && (
        <div 
          className="position-fixed"
          style={{ 
            bottom: '20px',
            right: '390px',
            zIndex: 9998
          }}
        >
          <div className="card bg-white shadow-sm">
            <div className="card-body p-3">
              <h6 className="mb-2">Quick Contact</h6>
              <div className="d-flex gap-2">
                <a 
                  href="tel:1234567890" 
                  className="btn btn-sm btn-light-success"
                  title="Call Us"
                >
                  <i className="ki-duotone ki-phone fs-5">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                </a>
                <a 
                  href="sms:1234567890" 
                  className="btn btn-sm btn-light-primary"
                  title="Text Us"
                >
                  <i className="ki-duotone ki-sms fs-5">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                </a>
                <a 
                  href="mailto:support@tradeworkspro.com" 
                  className="btn btn-sm btn-light-info"
                  title="Email Us"
                >
                  <i className="ki-duotone ki-sms fs-5">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ChatWidget