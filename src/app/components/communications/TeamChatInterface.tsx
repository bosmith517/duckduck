import React, { useState, useEffect, useRef } from 'react'
import { chatService, ChatMessage, ChatChannel } from '../../services/chatService'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { showToast } from '../../utils/toast'

interface TeamChatInterfaceProps {
  isVisible: boolean
  onClose: () => void
}

export const TeamChatInterface: React.FC<TeamChatInterfaceProps> = ({ isVisible, onClose }) => {
  const { user } = useSupabaseAuth()
  const [channels, setChannels] = useState<ChatChannel[]>([])
  const [selectedChannel, setSelectedChannel] = useState<ChatChannel | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isVisible && user) {
      fetchChannels()
      fetchTeamMembers()
      fetchUnreadCount()
      setupRealtimeSubscriptions()
    }
  }, [isVisible, user])

  useEffect(() => {
    if (selectedChannel) {
      fetchMessages()
    }
  }, [selectedChannel])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchChannels = async () => {
    try {
      const channelData = await chatService.getChannels()
      setChannels(channelData)
      
      // Auto-select first channel if none selected
      if (!selectedChannel && channelData.length > 0) {
        setSelectedChannel(channelData[0])
      }
    } catch (error) {
      console.error('Error fetching channels:', error)
      showToast.error('Failed to load chat channels')
    }
  }

  const fetchMessages = async () => {
    if (!selectedChannel) return

    try {
      setLoading(true)
      const messageData = await chatService.getMessages(
        selectedChannel.channel_type === 'direct' ? selectedChannel.id : undefined,
        selectedChannel.channel_type !== 'direct' ? selectedChannel.id : undefined
      )
      setMessages(messageData)
      
      // Mark messages as read
      await chatService.markAllMessagesAsRead(
        selectedChannel.channel_type === 'direct' ? selectedChannel.id : undefined,
        selectedChannel.channel_type !== 'direct' ? selectedChannel.id : undefined
      )
    } catch (error) {
      console.error('Error fetching messages:', error)
      showToast.error('Failed to load messages')
    } finally {
      setLoading(false)
    }
  }

  const fetchTeamMembers = async () => {
    try {
      const members = await chatService.getTeamMembers()
      setTeamMembers(members)
    } catch (error) {
      console.error('Error fetching team members:', error)
    }
  }

  const fetchUnreadCount = async () => {
    try {
      const count = await chatService.getUnreadMessageCount()
      setUnreadCount(count)
    } catch (error) {
      console.error('Error fetching unread count:', error)
    }
  }

  const setupRealtimeSubscriptions = () => {
    const subscription = chatService.subscribeToMessages((payload: any) => {
      const newMessage = payload.new as ChatMessage
      
      // Add message to current conversation if it matches
      if (selectedChannel) {
        const isForCurrentChannel = 
          (selectedChannel.channel_type === 'direct' && newMessage.recipient_id === selectedChannel.id) ||
          (selectedChannel.channel_type !== 'direct' && newMessage.channel_id === selectedChannel.id)
        
        if (isForCurrentChannel) {
          setMessages(prev => [...prev, newMessage])
        }
      }
      
      // Update unread count
      fetchUnreadCount()
      
      // Show notification for new messages
      if (newMessage.sender_id !== user?.id) {
        showToast.info(`New message from ${newMessage.sender?.first_name} ${newMessage.sender?.last_name}`)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChannel || !user) return

    try {
      const messageData = await chatService.sendMessage(
        newMessage,
        selectedChannel.channel_type === 'direct' ? selectedChannel.id : undefined,
        selectedChannel.channel_type !== 'direct' ? selectedChannel.id : undefined
      )
      
      setMessages(prev => [...prev, messageData])
      setNewMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
      showToast.error('Failed to send message')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const startDirectMessage = async (memberId: string) => {
    try {
      const channel = await chatService.createDirectMessageChannel(memberId)
      setSelectedChannel(channel)
      await fetchChannels() // Refresh channels list
    } catch (error) {
      console.error('Error starting direct message:', error)
      showToast.error('Failed to start conversation')
    }
  }

  if (!isVisible) return null

  return (
    <div className='fixed top-0 right-0 h-full w-96 bg-white shadow-2xl border-l border-gray-200 z-50'>
      {/* Header */}
      <div className='flex items-center justify-between p-4 border-b border-gray-200 bg-primary'>
        <div className='flex items-center'>
          <i className='ki-duotone ki-message-text-2 fs-2 text-white me-2'></i>
          <h3 className='text-white fw-bold mb-0'>Team Chat</h3>
          {unreadCount > 0 && (
            <span className='badge badge-light-danger ms-2'>{unreadCount}</span>
          )}
        </div>
        <button
          onClick={onClose}
          className='btn btn-icon btn-sm btn-active-light-primary'
        >
          <i className='ki-duotone ki-cross fs-2 text-white'></i>
        </button>
      </div>

      {/* Channel/Contact List */}
      <div className='border-b border-gray-200 bg-light'>
        <div className='p-3'>
          <div className='d-flex justify-content-between align-items-center mb-3'>
            <h6 className='fw-bold text-gray-800 mb-0'>Conversations</h6>
            <button className='btn btn-sm btn-light-primary'>
              <i className='ki-duotone ki-plus fs-4'></i>
            </button>
          </div>
          
          {/* Channels */}
          <div className='mb-3'>
            {channels.map((channel) => (
              <div
                key={channel.id}
                onClick={() => setSelectedChannel(channel)}
                className={`d-flex align-items-center p-2 rounded cursor-pointer mb-1 ${
                  selectedChannel?.id === channel.id ? 'bg-primary text-white' : 'hover-bg-light-primary'
                }`}
              >
                <div className='symbol symbol-35px me-3'>
                  <span className='symbol-label bg-light-info text-info fw-bold'>
                    {channel.channel_type === 'direct' ? 
                      channel.name.charAt(0).toUpperCase() : 
                      '#'
                    }
                  </span>
                </div>
                <div className='flex-grow-1'>
                  <div className='fw-bold fs-7'>{channel.name}</div>
                  <div className='text-muted fs-8'>
                    {channel.channel_type === 'direct' ? 'Direct Message' : 'Group Chat'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Team Members */}
          <div>
            <h6 className='fw-bold text-gray-600 mb-2 fs-8'>Team Members</h6>
            {teamMembers.map((member) => (
              <div
                key={member.id}
                onClick={() => startDirectMessage(member.id)}
                className='d-flex align-items-center p-2 rounded cursor-pointer mb-1 hover-bg-light-primary'
              >
                <div className='symbol symbol-30px me-2'>
                  <span className='symbol-label bg-light-success text-success fw-bold fs-8'>
                    {member.first_name?.charAt(0)}{member.last_name?.charAt(0)}
                  </span>
                </div>
                <div className='flex-grow-1'>
                  <div className='fw-bold fs-8'>{member.first_name} {member.last_name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className='flex-grow-1 d-flex flex-column' style={{ height: 'calc(100vh - 200px)' }}>
        {selectedChannel ? (
          <>
            {/* Messages */}
            <div className='flex-grow-1 p-3 overflow-auto'>
              {loading ? (
                <div className='text-center py-5'>
                  <div className='spinner-border text-primary' role='status'>
                    <span className='visually-hidden'>Loading messages...</span>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className='text-center py-5 text-muted'>
                  <i className='ki-duotone ki-message-text-2 fs-3x mb-3'></i>
                  <div>No messages yet. Start the conversation!</div>
                </div>
              ) : (
                <div>
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`d-flex mb-3 ${
                        message.sender_id === user?.id ? 'justify-content-end' : 'justify-content-start'
                      }`}
                    >
                      <div
                        className={`max-w-75 p-3 rounded ${
                          message.sender_id === user?.id
                            ? 'bg-primary text-white'
                            : 'bg-light-info text-dark'
                        }`}
                      >
                        {message.sender_id !== user?.id && (
                          <div className='fw-bold fs-8 mb-1'>
                            {message.sender?.first_name} {message.sender?.last_name}
                          </div>
                        )}
                        <div className='fs-7'>{message.message}</div>
                        <div className={`fs-8 mt-1 ${
                          message.sender_id === user?.id ? 'text-white-50' : 'text-muted'
                        }`}>
                          {chatService.formatMessageTime(message.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Message Input */}
            <div className='p-3 border-t border-gray-200'>
              <div className='d-flex align-items-center'>
                <input
                  type='text'
                  className='form-control form-control-sm me-2'
                  placeholder='Type a message...'
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className='btn btn-primary btn-sm'
                >
                  <i className='ki-duotone ki-send fs-4'></i>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className='d-flex align-items-center justify-content-center h-100 text-muted'>
            <div className='text-center'>
              <i className='ki-duotone ki-message-text-2 fs-3x mb-3'></i>
              <div>Select a conversation to start chatting</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
