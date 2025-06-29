import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import './ModernTeamChat.css'

interface Channel {
  id: string
  name: string
  description?: string
  type: 'public' | 'private' | 'direct'
  unread_count: number
  last_message?: {
    text: string
    timestamp: string
    sender: string
  }
}

interface Message {
  id: string
  text: string
  sender_id: string
  sender_name: string
  sender_avatar?: string
  timestamp: string
  attachments?: Attachment[]
  reactions?: Reaction[]
  is_edited?: boolean
  thread_count?: number
}

interface Attachment {
  id: string
  name: string
  type: string
  size: number
  url: string
}

interface Reaction {
  emoji: string
  users: string[]
}

interface TeamMember {
  id: string
  name: string
  email: string
  avatar?: string
  status: 'online' | 'away' | 'busy' | 'offline'
  role: string
}

export const ModernTeamChat: React.FC = () => {
  const { user, userProfile } = useSupabaseAuth()
  const [channels, setChannels] = useState<Channel[]>([])
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [message, setMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showUserList, setShowUserList] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadChannels()
    loadTeamMembers()
    subscribeToRealtime()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const loadChannels = async () => {
    try {
      // Load channels from Supabase
      const { data: channelsData, error } = await supabase
        .from('team_channels')
        .select('*')
        .eq('company_id', userProfile?.tenant_id)
        .order('created_at', { ascending: true })

      if (error) throw error

      if (channelsData && channelsData.length > 0) {
        const mappedChannels = channelsData.map((ch: any) => ({
          id: ch.id,
          name: ch.name,
          description: ch.description,
          type: (ch.type as 'public' | 'private' | 'direct') || 'public',
          unread_count: 0
        }))
        setChannels(mappedChannels)
        setActiveChannel(mappedChannels[0])
        loadMessages(channelsData[0].id)
      } else {
        // Create default channels if none exist
        await createDefaultChannels()
      }
    } catch (error) {
      console.error('Error loading channels:', error)
      // Fallback to mock data if database not ready
      const mockChannels: Channel[] = [
        {
          id: '1',
          name: 'general',
          description: 'General team discussions',
          type: 'public' as const,
          unread_count: 0
        }
      ]
      setChannels(mockChannels)
      setActiveChannel(mockChannels[0])
      loadMessages(mockChannels[0].id)
    }
  }

  const createDefaultChannels = async () => {
    try {
      const defaultChannels = [
        { name: 'general', description: 'General team discussions', type: 'public' },
        { name: 'hvac-techs', description: 'HVAC technician discussions', type: 'public' },
        { name: 'sales-team', description: 'Sales and customer success', type: 'private' }
      ]

      const { data, error } = await supabase
        .from('team_channels')
        .insert(defaultChannels.map(ch => ({
          ...ch,
          company_id: userProfile?.tenant_id,
          created_by: user?.id
        })))
        .select()

      if (error) throw error
      
      if (data) {
        const mappedChannels = data.map((ch: any) => ({
          id: ch.id,
          name: ch.name,
          description: ch.description,
          type: ch.type as 'public' | 'private' | 'direct',
          unread_count: 0
        }))
        setChannels(mappedChannels)
        setActiveChannel(mappedChannels[0])
        loadMessages(data[0].id)
      }
    } catch (error) {
      console.error('Error creating default channels:', error)
    }
  }

  const loadTeamMembers = async () => {
    // Mock data - replace with Supabase query
    setTeamMembers([
      {
        id: '1',
        name: 'Mike Rodriguez',
        email: 'mike@tradeworks.com',
        status: 'online',
        role: 'Senior Technician',
        avatar: '/assets/media/avatars/300-1.jpg'
      },
      {
        id: '2',
        name: 'Sarah Johnson',
        email: 'sarah@tradeworks.com',
        status: 'busy',
        role: 'Sales Manager',
        avatar: '/assets/media/avatars/300-2.jpg'
      },
      {
        id: '3',
        name: 'Tom Wilson',
        email: 'tom@tradeworks.com',
        status: 'away',
        role: 'HVAC Technician',
        avatar: '/assets/media/avatars/300-3.jpg'
      }
    ])
  }

  const loadMessages = async (channelId: string) => {
    try {
      // Load messages from Supabase with user info
      const { data: messagesData, error } = await supabase
        .from('team_messages')
        .select(`
          *,
          sender:users!team_messages_sender_id_fkey(
            id,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })
        .limit(50)

      if (error) throw error

      if (messagesData) {
        setMessages(messagesData.map((msg: any) => ({
          id: msg.id,
          text: msg.text,
          sender_id: msg.sender_id,
          sender_name: msg.sender ? `${msg.sender.first_name} ${msg.sender.last_name}` : 'Unknown',
          sender_avatar: msg.sender?.avatar_url,
          timestamp: msg.created_at,
          attachments: msg.attachments || [],
          reactions: msg.reactions || []
        })))
      } else {
        setMessages([])
      }
    } catch (error) {
      console.error('Error loading messages:', error)
      // Fallback to mock messages if database not ready
      setMessages([
        {
          id: '1',
          text: 'Welcome to TradeWorks Pro team chat! 👋',
          sender_id: 'system',
          sender_name: 'System',
          timestamp: new Date().toISOString()
        }
      ])
    }
  }

  const subscribeToRealtime = async () => {
    if (!userProfile?.tenant_id) return

    // Subscribe to new messages in active channel
    const messageChannel = supabase
      .channel(`team-messages-${userProfile.tenant_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'team_messages',
          filter: `company_id=eq.${userProfile.tenant_id}`
        },
        async (payload) => {
          const newMessage = payload.new as any
          
          // Only add message if it's for the active channel and not from current user
          if (newMessage.channel_id === activeChannel?.id && newMessage.sender_id !== user?.id) {
            // Fetch sender info
            const { data: senderData } = await supabase
              .from('users')
              .select('id, first_name, last_name, avatar_url')
              .eq('id', newMessage.sender_id)
              .single()

            const messageWithSender: Message = {
              id: newMessage.id,
              text: newMessage.text,
              sender_id: newMessage.sender_id,
              sender_name: senderData ? `${senderData.first_name} ${senderData.last_name}` : 'Unknown',
              sender_avatar: senderData?.avatar_url,
              timestamp: newMessage.created_at,
              attachments: newMessage.attachments || [],
              reactions: newMessage.reactions || []
            }

            setMessages(prev => [...prev, messageWithSender])
          }
        }
      )
      .subscribe()

    // Subscribe to presence updates
    const presenceChannel = supabase
      .channel(`team-presence-${userProfile.tenant_id}`)
      .on('presence', { event: 'sync' }, () => {
        const presenceState = presenceChannel.presenceState()
        // Update online users
        console.log('Presence sync:', presenceState)
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', newPresences)
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', leftPresences)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track current user presence
          await presenceChannel.track({
            user_id: user?.id,
            name: `${userProfile.first_name} ${userProfile.last_name}`,
            online_at: new Date().toISOString()
          })
        }
      })

    return () => {
      messageChannel.unsubscribe()
      presenceChannel.unsubscribe()
    }
  }

  const sendMessage = async () => {
    if (!message.trim() || !activeChannel || !user) return

    const messageData = {
      text: message.trim(),
      channel_id: activeChannel.id,
      sender_id: user.id,
      company_id: userProfile?.tenant_id
    }

    // Optimistically add message to UI
    const optimisticMessage: Message = {
      id: 'temp-' + Date.now(),
      text: message.trim(),
      sender_id: user.id,
      sender_name: `${userProfile?.first_name} ${userProfile?.last_name}` || 'You',
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, optimisticMessage])
    setMessage('')
    
    try {
      // Send to Supabase
      const { data, error } = await supabase
        .from('team_messages')
        .insert(messageData)
        .select(`
          *,
          sender:users!team_messages_sender_id_fkey(
            id,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .single()

      if (error) throw error

      // Replace optimistic message with real one
      if (data) {
        setMessages(prev => 
          prev.map(msg => 
            msg.id === optimisticMessage.id ? {
              id: data.id,
              text: data.text,
              sender_id: data.sender_id,
              sender_name: data.sender ? `${data.sender.first_name} ${data.sender.last_name}` : 'Unknown',
              sender_avatar: data.sender?.avatar_url,
              timestamp: data.created_at,
              attachments: data.attachments || [],
              reactions: data.reactions || []
            } : msg
          )
        )
      }
    } catch (error) {
      console.error('Error sending message:', error)
      showToast.error('Failed to send message')
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id))
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return
    
    const file = e.target.files[0]
    showToast.info(`Uploading ${file.name}...`)
    
    // Upload file logic
  }

  const addReaction = (messageId: string, emoji: string) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        const reactions = msg.reactions || []
        const existingReaction = reactions.find(r => r.emoji === emoji)
        
        if (existingReaction) {
          // Toggle reaction
          const userIndex = existingReaction.users.indexOf('You')
          if (userIndex > -1) {
            existingReaction.users.splice(userIndex, 1)
          } else {
            existingReaction.users.push('You')
          }
        } else {
          reactions.push({ emoji, users: ['You'] })
        }
        
        return { ...msg, reactions }
      }
      return msg
    }))
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'success'
      case 'away': return 'warning'
      case 'busy': return 'danger'
      default: return 'secondary'
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  return (
    <div className="d-flex h-100 bg-white rounded">
      {/* Channels Sidebar */}
      <div className="d-flex flex-column border-end" style={{ width: '280px' }}>
        <div className="p-5 border-bottom">
          <h3 className="fs-5 fw-bold mb-0">Team Chat</h3>
        </div>

        <div className="p-3">
          <div className="position-relative">
            <i className="ki-duotone ki-magnifier fs-3 position-absolute ms-3 top-50 translate-middle-y text-gray-500">
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
            <input
              type="text"
              className="form-control form-control-sm ps-10"
              placeholder="Search channels..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-grow-1 overflow-auto px-3">
          <div className="mb-4">
            <div className="text-uppercase text-muted fs-8 fw-semibold mb-3 px-3">Channels</div>
            {channels.filter(ch => ch.name.includes(searchTerm)).map(channel => (
              <div
                key={channel.id}
                className={`d-flex align-items-center p-3 rounded cursor-pointer hover-light-primary mb-1 ${
                  activeChannel?.id === channel.id ? 'bg-light-primary' : ''
                }`}
                onClick={() => {
                  setActiveChannel(channel)
                  loadMessages(channel.id)
                }}
              >
                <div className="symbol symbol-40px me-3">
                  <div className="symbol-label bg-light">
                    <i className={`ki-duotone ki-${channel.type === 'private' ? 'lock' : 'message-text'} fs-2 text-primary`}>
                      <span className="path1"></span>
                      <span className="path2"></span>
                      <span className="path3"></span>
                    </i>
                  </div>
                </div>
                <div className="flex-grow-1">
                  <div className="d-flex align-items-center justify-content-between">
                    <span className="fw-bold text-dark"># {channel.name}</span>
                    {channel.unread_count > 0 && (
                      <span className="badge badge-circle badge-primary">{channel.unread_count}</span>
                    )}
                  </div>
                  {channel.last_message && (
                    <div className="text-muted fs-7 text-truncate">
                      {channel.last_message.text}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mb-4">
            <div className="text-uppercase text-muted fs-8 fw-semibold mb-3 px-3">Direct Messages</div>
            {teamMembers.map(member => (
              <div
                key={member.id}
                className="d-flex align-items-center p-3 rounded cursor-pointer hover-light-primary mb-1"
              >
                <div className="symbol symbol-40px me-3">
                  {member.avatar ? (
                    <img src={member.avatar} alt={member.name} />
                  ) : (
                    <div className="symbol-label bg-light-primary">
                      <span className="fs-5 fw-bold text-primary">
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                  )}
                  <div className={`symbol-badge bg-${getStatusColor(member.status)} start-100 top-100 border-2 border-white`}></div>
                </div>
                <div className="flex-grow-1">
                  <div className="fw-bold text-dark">{member.name}</div>
                  <div className="text-muted fs-8">{member.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      {activeChannel ? (
        <div className="flex-grow-1 d-flex flex-column">
          {/* Chat Header */}
          <div className="d-flex align-items-center justify-content-between p-5 border-bottom">
            <div>
              <h4 className="fs-5 fw-bold mb-0"># {activeChannel.name}</h4>
              {activeChannel.description && (
                <span className="text-muted fs-7">{activeChannel.description}</span>
              )}
            </div>
            <div className="d-flex align-items-center gap-2">
              <button 
                className="btn btn-sm btn-light-primary"
                onClick={() => setShowUserList(!showUserList)}
              >
                <i className="ki-duotone ki-people fs-4">
                  <span className="path1"></span>
                  <span className="path2"></span>
                  <span className="path3"></span>
                  <span className="path4"></span>
                  <span className="path5"></span>
                </i>
                {teamMembers.length}
              </button>
              <button className="btn btn-sm btn-light">
                <i className="ki-duotone ki-information fs-4">
                  <span className="path1"></span>
                  <span className="path2"></span>
                  <span className="path3"></span>
                </i>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-grow-1 overflow-auto p-5">
            {messages.map((msg, index) => {
              const showAvatar = index === 0 || messages[index - 1].sender_id !== msg.sender_id
              
              return (
                <div key={msg.id} className={`d-flex mb-5 ${!showAvatar ? 'ms-12' : ''}`}>
                  {showAvatar && (
                    <div className="symbol symbol-40px me-3">
                      {msg.sender_avatar ? (
                        <img src={msg.sender_avatar} alt={msg.sender_name} />
                      ) : (
                        <div className="symbol-label bg-light-primary">
                          <span className="fs-6 fw-bold text-primary">
                            {msg.sender_name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex-grow-1">
                    {showAvatar && (
                      <div className="d-flex align-items-baseline mb-1">
                        <span className="fw-bold text-dark me-2">{msg.sender_name}</span>
                        <span className="text-muted fs-7">{formatTime(msg.timestamp)}</span>
                      </div>
                    )}
                    <div className="bg-light rounded p-3 mb-1" style={{ maxWidth: '70%' }}>
                      <p className="mb-0">{msg.text}</p>
                    </div>
                    
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-2">
                        {msg.attachments.map(attachment => (
                          <a
                            key={attachment.id}
                            href={attachment.url}
                            className="d-inline-flex align-items-center bg-light-primary rounded p-2 me-2 text-hover-primary"
                          >
                            <i className="ki-duotone ki-file fs-2 text-primary me-2">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                            <div>
                              <div className="fw-semibold">{attachment.name}</div>
                              <div className="text-muted fs-8">{(attachment.size / 1024).toFixed(1)} KB</div>
                            </div>
                          </a>
                        ))}
                      </div>
                    )}

                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="d-flex gap-2 mt-2">
                        {msg.reactions.map((reaction, idx) => (
                          <button
                            key={idx}
                            className="btn btn-sm btn-light-primary py-1 px-2"
                            onClick={() => addReaction(msg.id, reaction.emoji)}
                          >
                            <span className="me-1">{reaction.emoji}</span>
                            <span className="fs-8">{reaction.users.length}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="ms-2 opacity-0 hover-opacity-100">
                    <button
                      className="btn btn-sm btn-icon btn-light"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    >
                      😊
                    </button>
                  </div>
                </div>
              )
            })}
            
            {typingUsers.length > 0 && (
              <div className="d-flex align-items-center text-muted fs-7 ms-12">
                <div className="typing-indicator me-2">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="border-top p-5">
            <div className="d-flex align-items-end">
              <button
                className="btn btn-sm btn-icon btn-light me-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <i className="ki-duotone ki-paper-clip fs-3">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="d-none"
                onChange={handleFileUpload}
              />
              
              <div className="flex-grow-1">
                <textarea
                  className="form-control"
                  rows={1}
                  placeholder={`Message #${activeChannel.name}`}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  style={{ resize: 'none', minHeight: '40px' }}
                />
              </div>
              
              <button
                className="btn btn-primary ms-2"
                onClick={sendMessage}
                disabled={!message.trim()}
              >
                <i className="ki-duotone ki-send fs-4">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-grow-1 d-flex align-items-center justify-content-center">
          <div className="text-center">
            <i className="ki-duotone ki-message-text fs-5x text-gray-300 mb-5">
              <span className="path1"></span>
              <span className="path2"></span>
              <span className="path3"></span>
            </i>
            <p className="text-muted">Select a channel to start chatting</p>
          </div>
        </div>
      )}

      {/* User List Sidebar */}
      {showUserList && activeChannel && (
        <div className="border-start" style={{ width: '260px' }}>
          <div className="p-5 border-bottom">
            <h5 className="fs-6 fw-bold mb-0">Channel Members</h5>
          </div>
          <div className="p-3">
            {teamMembers.map(member => (
              <div key={member.id} className="d-flex align-items-center p-3 rounded hover-light-primary">
                <div className="symbol symbol-35px me-3">
                  {member.avatar ? (
                    <img src={member.avatar} alt={member.name} />
                  ) : (
                    <div className="symbol-label bg-light-primary">
                      <span className="fs-7 fw-bold text-primary">
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                  )}
                  <div className={`symbol-badge bg-${getStatusColor(member.status)} start-100 top-100 border-2 border-white`}></div>
                </div>
                <div>
                  <div className="fw-semibold text-dark fs-7">{member.name}</div>
                  <div className="text-muted fs-8">{member.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ModernTeamChat