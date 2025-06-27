import { supabase } from '../../supabaseClient'

export interface ChatMessage {
  id: string
  tenant_id: string
  sender_id: string
  recipient_id?: string
  channel_id?: string
  message: string
  message_type: 'text' | 'file' | 'image' | 'system'
  file_url?: string
  file_name?: string
  is_read: boolean
  created_at: string
  updated_at: string
  sender?: {
    id: string
    first_name: string
    last_name: string
    email: string
    avatar_url?: string
  }
}

export interface ChatChannel {
  id: string
  tenant_id: string
  name: string
  description?: string
  channel_type: 'direct' | 'group' | 'general'
  created_by: string
  created_at: string
  updated_at: string
  participants?: ChatParticipant[]
  last_message?: ChatMessage
  unread_count?: number
}

export interface ChatParticipant {
  id: string
  channel_id: string
  user_id: string
  joined_at: string
  last_read_at?: string
  user?: {
    id: string
    first_name: string
    last_name: string
    email: string
    avatar_url?: string
  }
}

class ChatService {
  // Message Methods
  async sendMessage(
    message: string,
    recipientId?: string,
    channelId?: string,
    messageType: 'text' | 'file' | 'image' = 'text',
    fileUrl?: string,
    fileName?: string
  ): Promise<ChatMessage> {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          recipient_id: recipientId,
          channel_id: channelId,
          message,
          message_type: messageType,
          file_url: fileUrl,
          file_name: fileName,
          is_read: false
        })
        .select(`
          *,
          sender:user_profiles!chat_messages_sender_id_fkey (
            id,
            first_name,
            last_name,
            email,
            avatar_url
          )
        `)
        .single()

      if (error) {
        console.error('Error sending message:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Error in sendMessage:', error)
      throw error
    }
  }

  async getMessages(
    recipientId?: string,
    channelId?: string,
    limit: number = 50
  ): Promise<ChatMessage[]> {
    try {
      let query = supabase
        .from('chat_messages')
        .select(`
          *,
          sender:user_profiles!chat_messages_sender_id_fkey (
            id,
            first_name,
            last_name,
            email,
            avatar_url
          )
        `)
        .order('created_at', { ascending: true })
        .limit(limit)

      if (recipientId) {
        query = query.or(`recipient_id.eq.${recipientId},sender_id.eq.${recipientId}`)
      }

      if (channelId) {
        query = query.eq('channel_id', channelId)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching messages:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in getMessages:', error)
      throw error
    }
  }

  async markMessageAsRead(messageId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('id', messageId)

      if (error) {
        console.error('Error marking message as read:', error)
        throw error
      }
    } catch (error) {
      console.error('Error in markMessageAsRead:', error)
      throw error
    }
  }

  async markAllMessagesAsRead(recipientId?: string, channelId?: string): Promise<void> {
    try {
      let query = supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('is_read', false)

      if (recipientId) {
        query = query.eq('recipient_id', recipientId)
      }

      if (channelId) {
        query = query.eq('channel_id', channelId)
      }

      const { error } = await query

      if (error) {
        console.error('Error marking all messages as read:', error)
        throw error
      }
    } catch (error) {
      console.error('Error in markAllMessagesAsRead:', error)
      throw error
    }
  }

  // Channel Methods
  async getChannels(): Promise<ChatChannel[]> {
    try {
      const { data, error } = await supabase
        .from('chat_channels')
        .select(`
          *,
          participants:chat_participants (
            *,
            user:user_profiles (
              id,
              first_name,
              last_name,
              email,
              avatar_url
            )
          )
        `)
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('Error fetching channels:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in getChannels:', error)
      throw error
    }
  }

  async createChannel(
    name: string,
    description?: string,
    channelType: 'direct' | 'group' | 'general' = 'group',
    participantIds: string[] = []
  ): Promise<ChatChannel> {
    try {
      const { data: channel, error: channelError } = await supabase
        .from('chat_channels')
        .insert({
          name,
          description,
          channel_type: channelType
        })
        .select()
        .single()

      if (channelError) {
        console.error('Error creating channel:', channelError)
        throw channelError
      }

      // Add participants
      if (participantIds.length > 0) {
        const participants = participantIds.map(userId => ({
          channel_id: channel.id,
          user_id: userId
        }))

        const { error: participantsError } = await supabase
          .from('chat_participants')
          .insert(participants)

        if (participantsError) {
          console.error('Error adding participants:', participantsError)
          throw participantsError
        }
      }

      return channel
    } catch (error) {
      console.error('Error in createChannel:', error)
      throw error
    }
  }

  async getDirectMessageChannel(otherUserId: string): Promise<ChatChannel | null> {
    try {
      const { data: currentUser } = await supabase.auth.getUser()
      if (!currentUser.user) return null

      // Look for existing direct message channel
      const { data, error } = await supabase
        .from('chat_channels')
        .select(`
          *,
          participants:chat_participants (
            user_id
          )
        `)
        .eq('channel_type', 'direct')

      if (error) {
        console.error('Error fetching direct channels:', error)
        throw error
      }

      // Find channel with exactly these two participants
      const directChannel = data?.find(channel => {
        const participantIds = channel.participants?.map((p: any) => p.user_id) || []
        return participantIds.length === 2 &&
               participantIds.includes(currentUser.user.id) &&
               participantIds.includes(otherUserId)
      })

      return directChannel || null
    } catch (error) {
      console.error('Error in getDirectMessageChannel:', error)
      return null
    }
  }

  async createDirectMessageChannel(otherUserId: string): Promise<ChatChannel> {
    try {
      const { data: currentUser } = await supabase.auth.getUser()
      if (!currentUser.user) throw new Error('User not authenticated')

      // Check if channel already exists
      const existingChannel = await this.getDirectMessageChannel(otherUserId)
      if (existingChannel) return existingChannel

      // Create new direct message channel
      const { data: otherUserProfile } = await supabase
        .from('user_profiles')
        .select('first_name, last_name')
        .eq('id', otherUserId)
        .single()

      const channelName = `${otherUserProfile?.first_name} ${otherUserProfile?.last_name}`.trim()

      return await this.createChannel(
        channelName,
        'Direct message',
        'direct',
        [currentUser.user.id, otherUserId]
      )
    } catch (error) {
      console.error('Error in createDirectMessageChannel:', error)
      throw error
    }
  }

  // Real-time subscriptions
  subscribeToMessages(
    callback: (payload: any) => void,
    recipientId?: string,
    channelId?: string
  ) {
    return supabase
      .channel('chat-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages'
        },
        callback
      )
      .subscribe()
  }

  subscribeToChannels(callback: (payload: any) => void) {
    return supabase
      .channel('chat-channels')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_channels'
        },
        callback
      )
      .subscribe()
  }

  // Utility methods
  async getUnreadMessageCount(): Promise<number> {
    try {
      const { data: currentUser } = await supabase.auth.getUser()
      if (!currentUser.user) return 0

      const { count, error } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', currentUser.user.id)
        .eq('is_read', false)

      if (error) {
        console.error('Error getting unread count:', error)
        return 0
      }

      return count || 0
    } catch (error) {
      console.error('Error in getUnreadMessageCount:', error)
      return 0
    }
  }

  async getTeamMembers(): Promise<any[]> {
    try {
      const { data: currentUser } = await supabase.auth.getUser()
      if (!currentUser.user) return []

      // Get current user's tenant_id
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('tenant_id')
        .eq('id', currentUser.user.id)
        .single()

      if (!userProfile) return []

      // Get all users in the same tenant
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, first_name, last_name, email, avatar_url')
        .eq('tenant_id', userProfile.tenant_id)
        .neq('id', currentUser.user.id) // Exclude current user

      if (error) {
        console.error('Error fetching team members:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in getTeamMembers:', error)
      return []
    }
  }

  formatMessageTime(timestamp: string): string {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60)
      return diffInMinutes < 1 ? 'Just now' : `${diffInMinutes}m ago`
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`
    } else {
      return date.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }
}

export const chatService = new ChatService()
