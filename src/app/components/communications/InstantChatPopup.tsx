import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface TeamMember {
  id: string
  name: string
  email: string
  avatar?: string
  status: 'online' | 'away' | 'busy' | 'offline'
  role: string
}

interface Message {
  id: string
  text: string
  sender: 'me' | 'them'
  timestamp: Date
}

interface InstantChatPopupProps {
  member: TeamMember
  onClose: () => void
}

export const InstantChatPopup: React.FC<InstantChatPopupProps> = ({ member, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: `Hi there! I'm available to chat about work topics.`,
      sender: 'them',
      timestamp: new Date(Date.now() - 300000)
    }
  ])
  const [newMessage, setNewMessage] = useState('')
  const [isMinimized, setIsMinimized] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const sendMessage = () => {
    if (!newMessage.trim()) return

    const message: Message = {
      id: Date.now().toString(),
      text: newMessage.trim(),
      sender: 'me',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, message])
    setNewMessage('')

    // Simulate response after a short delay
    setTimeout(() => {
      const responses = [
        "Thanks for reaching out! I'll get back to you shortly.",
        "Got it! Let me check on that for you.",
        "I'm on it! Will update you soon.",
        "Perfect timing! I was just thinking about that.",
        "Absolutely! Happy to help with that."
      ]
      
      const response: Message = {
        id: (Date.now() + 1).toString(),
        text: responses[Math.floor(Math.random() * responses.length)],
        sender: 'them',
        timestamp: new Date()
      }
      
      setMessages(prev => [...prev, response])
    }, 1000 + Math.random() * 2000)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return '#10b981'
      case 'away': return '#f59e0b'
      case 'busy': return '#ef4444'
      default: return '#6b7280'
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })
  }

  // Create the popup using a portal to render it at the document body level
  return createPortal(
    <div 
      className="position-fixed"
      style={{
        bottom: '20px',
        right: '20px',
        width: '350px',
        zIndex: 9999,
        boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
        borderRadius: '12px',
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb'
      }}
    >
      {/* Chat Header */}
      <div 
        className="d-flex align-items-center justify-content-between p-3 border-bottom"
        style={{
          backgroundColor: '#f8fafc',
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px',
          cursor: 'pointer'
        }}
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="d-flex align-items-center">
          <div className="position-relative me-2">
            <div 
              className="d-flex align-items-center justify-content-center"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#e0f2fe',
                color: '#0ea5e9',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              {member.avatar ? (
                <img 
                  src={member.avatar} 
                  alt={member.name}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    objectFit: 'cover'
                  }}
                />
              ) : (
                member.name.split(' ').map(n => n[0]).join('')
              )}
            </div>
            <div
              className="position-absolute"
              style={{
                bottom: '0',
                right: '0',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: getStatusColor(member.status),
                border: '2px solid white'
              }}
            />
          </div>
          <div>
            <div className="fw-semibold text-dark" style={{ fontSize: '14px' }}>
              {member.name}
            </div>
            <div className="text-muted" style={{ fontSize: '12px' }}>
              {member.status} • {member.role}
            </div>
          </div>
        </div>
        <div className="d-flex align-items-center gap-1">
          <button
            className="btn btn-sm btn-icon btn-light-primary"
            onClick={(e) => {
              e.stopPropagation()
              setIsMinimized(!isMinimized)
            }}
            style={{ width: '28px', height: '28px' }}
          >
            <i className={`ki-duotone ki-${isMinimized ? 'up' : 'down'} fs-6`}>
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
          </button>
          <button
            className="btn btn-sm btn-icon btn-light-danger"
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            style={{ width: '28px', height: '28px' }}
          >
            <i className="ki-duotone ki-cross fs-6">
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
          </button>
        </div>
      </div>

      {/* Chat Body */}
      {!isMinimized && (
        <>
          <div 
            className="p-3"
            style={{
              height: '300px',
              overflowY: 'auto',
              backgroundColor: '#ffffff'
            }}
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`d-flex mb-3 ${message.sender === 'me' ? 'justify-content-end' : 'justify-content-start'}`}
              >
                <div
                  className={`px-3 py-2 rounded-3 ${
                    message.sender === 'me' 
                      ? 'bg-primary text-white' 
                      : 'bg-light text-dark'
                  }`}
                  style={{
                    maxWidth: '70%',
                    fontSize: '14px',
                    lineHeight: '1.4'
                  }}
                >
                  <div>{message.text}</div>
                  <div 
                    className={`mt-1 ${message.sender === 'me' ? 'text-white-50' : 'text-muted'}`}
                    style={{ fontSize: '11px' }}
                  >
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div 
            className="p-3 border-top"
            style={{
              backgroundColor: '#f8fafc',
              borderBottomLeftRadius: '12px',
              borderBottomRightRadius: '12px'
            }}
          >
            <div className="d-flex align-items-end gap-2">
              <div className="flex-grow-1">
                <textarea
                  className="form-control"
                  rows={1}
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  style={{
                    resize: 'none',
                    minHeight: '36px',
                    fontSize: '14px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '18px'
                  }}
                />
              </div>
              <button
                className="btn btn-primary d-flex align-items-center justify-content-center"
                onClick={sendMessage}
                disabled={!newMessage.trim()}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  padding: '0'
                }}
              >
                <i className="ki-duotone ki-send fs-5">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
              </button>
            </div>
          </div>
        </>
      )}
    </div>,
    document.body
  )
}

export default InstantChatPopup