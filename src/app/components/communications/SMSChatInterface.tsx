import React, { useState, useEffect, useRef } from 'react'
import { communicationsService, SMSMessage } from '../../services/communicationsService'
import { showToast } from '../../utils/toast'

interface SMSChatInterfaceProps {
  contactId: string
  contactName: string
  contactPhone: string
  className?: string
}

export const SMSChatInterface: React.FC<SMSChatInterfaceProps> = ({
  contactId,
  contactName,
  contactPhone,
  className = ''
}) => {
  const [messages, setMessages] = useState<SMSMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (contactId) {
      fetchMessages()
      setupRealtimeSubscription()
    }

    return () => {
      // Cleanup subscription
    }
  }, [contactId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const fetchMessages = async () => {
    try {
      setLoading(true)
      const smsMessages = await communicationsService.getSMSMessages(contactId)
      setMessages(smsMessages)
    } catch (error) {
      console.error('Error fetching SMS messages:', error)
      showToast.error('Failed to load messages')
    } finally {
      setLoading(false)
    }
  }

  const setupRealtimeSubscription = () => {
    const subscription = communicationsService.subscribeToSMSMessages(contactId, (payload) => {
      const newMessage = payload.new as SMSMessage
      setMessages(prev => [...prev, newMessage])
      
      if (newMessage.direction === 'inbound') {
        showToast.info(`New message from ${contactName}`)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newMessage.trim() || sending) return

    const messageText = newMessage.trim()
    setNewMessage('')
    setSending(true)

    try {
      const sentMessage = await communicationsService.sendSMS(contactId, contactPhone, messageText)
      
      // Optimistically add the message to the UI
      setMessages(prev => [...prev, sentMessage])
      showToast.success('Message sent')
    } catch (error) {
      console.error('Error sending SMS:', error)
      showToast.error('Failed to send message')
      // Restore the message text on error
      setNewMessage(messageText)
    } finally {
      setSending(false)
    }
  }

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    }
  }

  const getMessageStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <i className='ki-duotone ki-check fs-7 text-muted'></i>
      case 'delivered':
        return <i className='ki-duotone ki-double-check fs-7 text-primary'></i>
      case 'failed':
        return <i className='ki-duotone ki-cross fs-7 text-danger'></i>
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className={`card ${className}`}>
        <div className='card-header'>
          <h3 className='card-title'>
            <i className='ki-duotone ki-message-text-2 fs-2 me-2'></i>
            SMS Messages
          </h3>
        </div>
        <div className='card-body'>
          <div className='d-flex justify-content-center py-10'>
            <div className='spinner-border text-primary' role='status'>
              <span className='visually-hidden'>Loading messages...</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`card ${className}`}>
      <div className='card-header'>
        <h3 className='card-title'>
          <i className='ki-duotone ki-message-text-2 fs-2 me-2'></i>
          SMS Messages with {contactName}
        </h3>
        <div className='card-toolbar'>
          <span className='badge badge-light-primary'>
            {communicationsService.formatPhoneNumber(contactPhone)}
          </span>
        </div>
      </div>
      
      <div className='card-body p-0'>
        {/* Messages Container */}
        <div 
          className='scroll-y'
          style={{ 
            height: '400px',
            overflowY: 'auto',
            padding: '1rem'
          }}
        >
          {messages.length === 0 ? (
            <div className='text-center py-10'>
              <div className='text-muted mb-3'>
                <i className='ki-duotone ki-message-text-2 fs-3x text-muted mb-3'></i>
              </div>
              <div className='text-muted'>
                No messages yet. Start a conversation by sending a message below.
              </div>
            </div>
          ) : (
            <div className='d-flex flex-column gap-3'>
              {messages.map((message, index) => {
                const isOutbound = message.direction === 'outbound'
                const showDate = index === 0 || 
                  new Date(message.created_at).toDateString() !== 
                  new Date(messages[index - 1].created_at).toDateString()

                return (
                  <React.Fragment key={message.id}>
                    {showDate && (
                      <div className='text-center'>
                        <span className='badge badge-light-secondary fs-8'>
                          {new Date(message.created_at).toLocaleDateString([], { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </span>
                      </div>
                    )}
                    
                    <div className={`d-flex ${isOutbound ? 'justify-content-end' : 'justify-content-start'}`}>
                      <div 
                        className={`max-w-75 p-3 rounded ${
                          isOutbound 
                            ? 'bg-primary text-white' 
                            : 'bg-light-secondary text-dark'
                        }`}
                        style={{ maxWidth: '75%' }}
                      >
                        <div className='fw-semibold mb-1'>{message.body}</div>
                        <div className={`d-flex align-items-center justify-content-end gap-1 ${
                          isOutbound ? 'text-white-50' : 'text-muted'
                        }`}>
                          <span className='fs-8'>
                            {formatMessageTime(message.created_at)}
                          </span>
                          {isOutbound && getMessageStatusIcon(message.status)}
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Message Input */}
        <div className='card-footer'>
          <form onSubmit={handleSendMessage} className='d-flex gap-2'>
            <div className='flex-grow-1'>
              <textarea
                className='form-control'
                placeholder={`Send a message to ${contactName}...`}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage(e)
                  }
                }}
                rows={2}
                disabled={sending}
                style={{ resize: 'none' }}
              />
            </div>
            <div className='d-flex align-items-end'>
              <button
                type='submit'
                className='btn btn-primary'
                disabled={!newMessage.trim() || sending}
              >
                {sending ? (
                  <>
                    <span className='spinner-border spinner-border-sm me-2' role='status'></span>
                    Sending...
                  </>
                ) : (
                  <>
                    <i className='ki-duotone ki-send fs-2'></i>
                    Send
                  </>
                )}
              </button>
            </div>
          </form>
          
          {/* Character Counter */}
          <div className='text-muted fs-8 mt-2'>
            {newMessage.length}/160 characters
            {newMessage.length > 160 && (
              <span className='text-warning ms-2'>
                Message will be split into {Math.ceil(newMessage.length / 160)} parts
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Compact SMS widget for contact cards
interface SMSWidgetProps {
  contactId: string
  contactName: string
  contactPhone: string
  onOpenChat: () => void
}

export const SMSWidget: React.FC<SMSWidgetProps> = ({
  contactId,
  contactName,
  contactPhone,
  onOpenChat
}) => {
  const [lastMessage, setLastMessage] = useState<SMSMessage | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (contactId) {
      fetchLastMessage()
      setupRealtimeSubscription()
    }
  }, [contactId])

  const fetchLastMessage = async () => {
    try {
      const messages = await communicationsService.getSMSMessages(contactId)
      if (messages.length > 0) {
        setLastMessage(messages[messages.length - 1])
        // Count unread messages (inbound messages that haven't been "read")
        const unread = messages.filter(msg => 
          msg.direction === 'inbound' && 
          msg.status === 'received'
        ).length
        setUnreadCount(unread)
      }
    } catch (error) {
      console.error('Error fetching last message:', error)
    }
  }

  const setupRealtimeSubscription = () => {
    const subscription = communicationsService.subscribeToSMSMessages(contactId, (payload) => {
      const newMessage = payload.new as SMSMessage
      setLastMessage(newMessage)
      
      if (newMessage.direction === 'inbound') {
        setUnreadCount(prev => prev + 1)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }

  const handleOpenChat = () => {
    setUnreadCount(0) // Mark as read when opening chat
    onOpenChat()
  }

  return (
    <button
      className='btn btn-light btn-sm d-flex align-items-center gap-2'
      onClick={handleOpenChat}
      title={`Send SMS to ${contactName}`}
    >
      <i className='ki-duotone ki-message-text-2 fs-4'></i>
      <span>SMS</span>
      {unreadCount > 0 && (
        <span className='badge badge-circle badge-danger'>{unreadCount}</span>
      )}
      {lastMessage && (
        <span className='text-muted fs-8 ms-2'>
          {lastMessage.direction === 'outbound' ? 'You: ' : ''}
          {lastMessage.body.length > 20 
            ? `${lastMessage.body.substring(0, 20)}...` 
            : lastMessage.body
          }
        </span>
      )}
    </button>
  )
}
