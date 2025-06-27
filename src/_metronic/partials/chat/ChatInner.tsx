import {FC, useState, useEffect, useRef} from 'react'
import clsx from 'clsx'
import { toAbsoluteUrl } from '../../helpers'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../../app/modules/auth/core/SupabaseAuth'
import { showToast } from '../../../app/utils/toast'

// Declare global KTChat object
declare global {
  interface Window {
    KTChat: any;
  }
}

type Props = {
  isDrawer?: boolean
}

interface ChatMessage {
  id: string
  channel_id: string
  sender_id: string
  message: string
  created_at: string
  sender?: {
    first_name: string
    last_name: string
    email: string
  }
}

interface ChatChannel {
  id: string
  name: string
  channel_type: 'general' | 'direct' | 'group'
  created_at: string
  tenant_id: string
}

const ChatInner: FC<Props> = ({isDrawer = false}) => {
  const { user, userProfile } = useSupabaseAuth()
  const [message, setMessage] = useState<string>('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [channels, setChannels] = useState<ChatChannel[]>([])
  const [selectedChannel, setSelectedChannel] = useState<ChatChannel | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Initialize Metronic chat components
    if (window.KTChat) {
      window.KTChat.createInstances();
    }
  }, [])

  // This function will now handle fetching channels AND ensuring a general channel exists.
  useEffect(() => {
    const initializeChannels = async () => {
      // Guard Clause: Do not run if we don't have the user's profile and tenant_id yet.
      if (!userProfile?.tenant_id) {
        console.log("Waiting for user profile to initialize channels...");
        return;
      }

      try {
        setLoading(true);

        // Step 1: Fetch all existing channels for the tenant.
        const { data: existingChannels, error: fetchError } = await supabase
          .from('chat_channels')
          .select('id, name, channel_type, tenant_id, created_at')
          .eq('tenant_id', userProfile.tenant_id)
          .order('created_at', { ascending: true });

        if (fetchError) throw fetchError;

        // Step 2: Check if a "General" channel already exists.
        const generalChannelExists = existingChannels?.some(
          channel => channel.name === 'General' && channel.channel_type === 'general'
        );

        let channelsList = existingChannels || [];

        // Step 3: If it does NOT exist, create it.
        if (!generalChannelExists) {
          console.log("General channel not found, creating it now...");
          const { data: newChannel, error: createError } = await supabase
            .from('chat_channels')
            .insert({
              name: 'General',
              channel_type: 'general',
              tenant_id: userProfile.tenant_id,
              created_by: user?.id || userProfile.id
            })
            .select('id, name, channel_type, tenant_id, created_at')
            .single();

          if (createError) throw createError;

          if (newChannel) {
            // Add the new channel to our list
            channelsList = [newChannel, ...channelsList];
          }
        } else {
          console.log("General channel already exists.");
        }

        // Update the state with all channels
        setChannels(channelsList);
        
        // Auto-select general channel if none selected
        if (!selectedChannel && channelsList.length > 0) {
          const generalChannel = channelsList.find(c => c.channel_type === 'general') || channelsList[0];
          setSelectedChannel(generalChannel);
        }

      } catch (error) {
        console.error("Error during channel initialization:", error);
      } finally {
        setLoading(false);
      }
    };

    initializeChannels();

  }, [userProfile]); // This effect re-runs ONLY when the userProfile object is loaded.

  useEffect(() => {
    if (selectedChannel) {
      fetchMessages()
    }
  }, [selectedChannel])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Real-time subscription with proper cleanup
  useEffect(() => {
    // Return early if there's no channel selected, preventing errors.
    if (!selectedChannel?.id) {
      return;
    }

    console.log(`Setting up subscription for channel: ${selectedChannel.id}`);

    const channel = supabase.channel(`room-for-channel-${selectedChannel.id}`);

    const subscription = channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${selectedChannel.id}`,
        },
        (payload) => {
          console.log('New message received!', payload.new);
          // Add the new message to the local state to update the UI
          setMessages(currentMessages => [...currentMessages, payload.new as ChatMessage]);
          
          // Show notification for new messages from others
          const newMessage = payload.new as ChatMessage;
          if (newMessage.sender_id !== user?.id) {
            showToast.info('New team message received');
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed!');
        }
        if (status === 'CHANNEL_ERROR' || err) {
          console.error('Subscription Error:', err);
        }
      });

    // This cleanup function is CRITICAL. It will run whenever the component
    // unmounts or when the `selectedChannelId` changes, preventing duplicate listeners.
    return () => {
      console.log(`Tearing down subscription for channel: ${selectedChannel.id}`);
      supabase.removeChannel(channel);
    };

  }, [selectedChannel?.id]); // The dependency array ensures this logic re-runs if the user switches to a different chat channel.

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }


  const fetchMessages = async () => {
    if (!selectedChannel) return

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          *,
          sender:user_profiles(first_name, last_name, email)
        `)
        .eq('channel_id', selectedChannel.id)
        .order('created_at', { ascending: true })
        .limit(50)

      if (error) {
        console.error('Error fetching messages:', error)
        return
      }

      setMessages(data || [])
    } catch (error) {
      console.error('Error in fetchMessages:', error)
    }
  }

const sendMessage = async () => {
  // Check for required data, no changes needed here
  if (!message.trim() || !selectedChannel || !user || sending) return

  const messageText = message.trim()
  setMessage('')
  setSending(true)

  try {
    // This `insert` command now uses the correct column names
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        channel_id: selectedChannel.id,
        // FIX: Changed 'sender_id' to the correct 'user_id'
        user_id: user.id, 
        // FIX: Changed 'content'/'message' to the correct 'message_text'
        message_text: messageText, 
        // It's also good practice to include the tenant_id
        tenant_id: userProfile?.tenant_id 
      })
      .select(`
        *,
        sender:user_profiles(first_name, last_name, email)
      `)
      .single()

    if (error) {
      console.error('Error sending message:', error)
      showToast.error('Failed to send message')
      setMessage(messageText) // Restore message on error
      return
    }

    // Message will be added via realtime subscription, no changes needed here
  } catch (error) {
    console.error('Error in sendMessage:', error)
    showToast.error('Failed to send message')
    setMessage(messageText) // Restore message on error
  } finally {
    setSending(false)
  }
}


  const onEnterPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.keyCode === 13 && e.shiftKey === false) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    }
  }

  if (loading) {
    return (
      <div
        className='card-body'
        id={isDrawer ? 'kt_drawer_chat_messenger_body' : 'kt_chat_messenger_body'}
      >
        <div className='d-flex justify-content-center py-10'>
          <div className='spinner-border text-primary' role='status'>
            <span className='visually-hidden'>Loading chat...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className='card-body'
      id={isDrawer ? 'kt_drawer_chat_messenger_body' : 'kt_chat_messenger_body'}
    >
      {/* Channel Selector */}
      {channels.length > 1 && (
        <div className='mb-5'>
          <select
            className='form-select form-select-sm'
            value={selectedChannel?.id || ''}
            onChange={(e) => {
              const channel = channels.find(c => c.id === e.target.value)
              setSelectedChannel(channel || null)
            }}
          >
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Messages */}
      <div
        className={clsx('scroll-y me-n5 pe-5', {'h-300px h-lg-auto': !isDrawer})}
        data-kt-element='messages'
        data-kt-scroll='true'
        data-kt-scroll-activate='{default: false, lg: true}'
        data-kt-scroll-max-height='auto'
        data-kt-scroll-dependencies={
          isDrawer
            ? '#kt_drawer_chat_messenger_header, #kt_drawer_chat_messenger_footer'
            : '#kt_header, #kt_app_header, #kt_app_toolbar, #kt_toolbar, #kt_footer, #kt_app_footer, #kt_chat_messenger_header, #kt_chat_messenger_footer'
        }
        data-kt-scroll-wrappers={
          isDrawer
            ? '#kt_drawer_chat_messenger_body'
            : '#kt_content, #kt_app_content, #kt_chat_messenger_body'
        }
        data-kt-scroll-offset={isDrawer ? '0px' : '5px'}
      >
        {messages.length === 0 ? (
          <div className='text-center py-10 text-muted'>
            <i className='ki-duotone ki-message-text-2 fs-3x mb-3'></i>
            <div className='fw-bold mb-2'>No messages yet</div>
            <div className='fs-7'>Start the conversation by sending a message below.</div>
          </div>
        ) : (
          <>
            {messages.map((msg) => {
              const isFromCurrentUser = msg.sender_id === user?.id
              const messageType = isFromCurrentUser ? 'out' : 'in'
              const state = messageType === 'in' ? 'info' : 'primary'

              return (
                <div
                  key={msg.id}
                  className={clsx('d-flex justify-content-start mb-10')}
                >
                  <div
                    className={clsx(
                      'd-flex flex-column align-items',
                      `align-items-${messageType === 'in' ? 'start' : 'end'}`
                    )}
                  >
                    <div className='d-flex align-items-center mb-2'>
                      {messageType === 'in' ? (
                        <>
                          <div className='symbol symbol-35px symbol-circle'>
                            <span className='symbol-label bg-light-info text-info fw-bold'>
                              {msg.sender?.first_name?.charAt(0)}{msg.sender?.last_name?.charAt(0)}
                            </span>
                          </div>
                          <div className='ms-3'>
                            <a href='#' className='fs-5 fw-bold text-gray-900 text-hover-primary me-1'>
                              {msg.sender?.first_name} {msg.sender?.last_name}
                            </a>
                            <span className='text-muted fs-7 mb-1'>
                              {formatMessageTime(msg.created_at)}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className='me-3'>
                            <span className='text-muted fs-7 mb-1'>
                              {formatMessageTime(msg.created_at)}
                            </span>
                            <a href='#' className='fs-5 fw-bold text-gray-900 text-hover-primary ms-1'>
                              You
                            </a>
                          </div>
                          <div className='symbol symbol-35px symbol-circle'>
                            <img alt='Pic' src={toAbsoluteUrl('media/avatars/300-2.jpg')} />
                          </div>
                        </>
                      )}
                    </div>

                    <div
                      className={clsx(
                        'p-5 rounded',
                        `bg-light-${state}`,
                        'text-gray-900 fw-semibold mw-lg-400px',
                        `text-${messageType === 'in' ? 'start' : 'end'}`
                      )}
                      data-kt-element='message-text'
                    >
                      {msg.message}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Input */}
      <div
        className='card-footer pt-4'
        id={isDrawer ? 'kt_drawer_chat_messenger_footer' : 'kt_chat_messenger_footer'}
      >
        <textarea
          className='form-control form-control-flush mb-3'
          rows={1}
          data-kt-element='input'
          placeholder='Type a message'
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={onEnterPress}
          disabled={sending}
        ></textarea>

        <div className='d-flex flex-stack'>
          <div className='d-flex align-items-center me-2'>
            <button
              className='btn btn-sm btn-icon btn-active-light-primary me-1'
              type='button'
              data-bs-toggle='tooltip'
              title='Coming soon'
            >
              <i className='bi bi-paperclip fs-3'></i>
            </button>
            <button
              className='btn btn-sm btn-icon btn-active-light-primary me-1'
              type='button'
              data-bs-toggle='tooltip'
              title='Coming soon'
            >
              <i className='bi bi-upload fs-3'></i>
            </button>
          </div>
          <button
            className='btn btn-primary'
            type='button'
            data-kt-element='send'
            onClick={sendMessage}
            disabled={!message.trim() || sending}
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}

export {ChatInner}
