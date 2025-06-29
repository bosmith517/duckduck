import { supabase } from '../../supabaseClient'
import { showToast } from '../utils/toast'

export interface VideoMeeting {
  id: string
  tenant_id: string
  contact_id?: string
  job_id?: string
  created_by_user_id: string
  room_url: string
  provider: string
  start_time?: string
  end_time?: string
  created_at: string
  // Computed fields
  room_name?: string
  status?: 'scheduled' | 'active' | 'ended'
  duration?: number
  participants?: any[]
}

export interface CreateVideoMeetingRequest {
  contact_id?: string
  job_id?: string
  participants?: string[]
  room_name?: string
}

export interface VideoMeetingParticipant {
  id: string
  meeting_id: string
  user_id: string
  joined_at: string
  left_at?: string
  duration?: number
}

class VideoService {
  /**
   * Create a new video meeting room
   */
  async createVideoMeeting(request: CreateVideoMeetingRequest): Promise<VideoMeeting> {
    try {
      const { data, error } = await supabase.functions.invoke('create-video-room', {
        body: {
          contact_id: request.contact_id,
          job_id: request.job_id,
          participants: request.participants,
          room_name: request.room_name
        }
      })

      if (error) {
        console.error('Error creating video meeting:', error)
        throw new Error(error.message || 'Failed to create video meeting')
      }

      return data.meeting
    } catch (error) {
      console.error('Error in createVideoMeeting:', error)
      throw error
    }
  }

  /**
   * Get video meetings for the current tenant
   */
  async getVideoMeetings(filters?: {
    status?: string
    contact_id?: string
    job_id?: string
    date_from?: string
    date_to?: string
  }): Promise<VideoMeeting[]> {
    try {
      let query = supabase
        .from('video_meetings')
        .select(`
          *,
          job:jobs(title, description),
          created_by_user:user_profiles(first_name, last_name, email)
        `)
        .order('created_at', { ascending: false })

      if (filters?.status) {
        query = query.eq('status', filters.status)
      }

      if (filters?.contact_id) {
        query = query.eq('contact_id', filters.contact_id)
      }

      if (filters?.job_id) {
        query = query.eq('job_id', filters.job_id)
      }

      if (filters?.date_from) {
        query = query.gte('created_at', filters.date_from)
      }

      if (filters?.date_to) {
        query = query.lte('created_at', filters.date_to)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching video meetings:', error)
        
        // If the table doesn't exist, return empty array instead of throwing
        if (error.message?.includes('relation "video_meetings" does not exist') || 
            error.message?.includes('table "video_meetings" does not exist') ||
            error.code === 'PGRST116') {
          console.warn('Video meetings table does not exist yet. Returning empty array.')
          return []
        }
        
        throw new Error('Failed to fetch video meetings')
      }

      return data || []
    } catch (error) {
      console.error('Error in getVideoMeetings:', error)
      
      // If it's a network error or table doesn't exist, return empty array
      if (error instanceof Error && 
          (error.message.includes('relation') || 
           error.message.includes('table') ||
           error.message.includes('Failed to fetch'))) {
        console.warn('Video meetings functionality not available yet. Returning empty array.')
        return []
      }
      
      throw error
    }
  }

  /**
   * Get a specific video meeting by ID
   */
  async getVideoMeeting(meetingId: string): Promise<VideoMeeting | null> {
    try {
      const { data, error } = await supabase
        .from('video_meetings')
        .select(`
          *,
          contact:contacts(first_name, last_name, email, phone, mobile),
          job:jobs(title, client_name, description),
          created_by_user:profiles(first_name, last_name, email),
          participants:video_meeting_participants(
            *,
            user:profiles(first_name, last_name, email)
          )
        `)
        .eq('id', meetingId)
        .single()

      if (error) {
        console.error('Error fetching video meeting:', error)
        throw new Error('Failed to fetch video meeting')
      }

      return data
    } catch (error) {
      console.error('Error in getVideoMeeting:', error)
      throw error
    }
  }

  /**
   * Join a video meeting
   */
  async joinVideoMeeting(meetingId: string): Promise<{ room_url: string }> {
    try {
      // Update meeting status to active if it's scheduled
      const { error: updateError } = await supabase
        .from('video_meetings')
        .update({ 
          status: 'active',
          started_at: new Date().toISOString()
        })
        .eq('id', meetingId)
        .eq('status', 'scheduled')

      if (updateError) {
        console.error('Error updating meeting status:', updateError)
      }

      // Record participant joining
      const { error: participantError } = await supabase
        .from('video_meeting_participants')
        .insert({
          meeting_id: meetingId,
          joined_at: new Date().toISOString()
        })

      if (participantError) {
        console.error('Error recording participant:', participantError)
      }

      // Get the meeting room URL
      const meeting = await this.getVideoMeeting(meetingId)
      if (!meeting) {
        throw new Error('Meeting not found')
      }

      return { room_url: meeting.room_url }
    } catch (error) {
      console.error('Error in joinVideoMeeting:', error)
      throw error
    }
  }

  /**
   * End a video meeting
   */
  async endVideoMeeting(meetingId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('video_meetings')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString()
        })
        .eq('id', meetingId)

      if (error) {
        console.error('Error ending video meeting:', error)
        throw new Error('Failed to end video meeting')
      }

      // Update any active participants
      const { error: participantError } = await supabase
        .from('video_meeting_participants')
        .update({
          left_at: new Date().toISOString()
        })
        .eq('meeting_id', meetingId)
        .is('left_at', null)

      if (participantError) {
        console.error('Error updating participants:', participantError)
      }
    } catch (error) {
      console.error('Error in endVideoMeeting:', error)
      throw error
    }
  }

  /**
   * Delete a video meeting
   */
  async deleteVideoMeeting(meetingId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('video_meetings')
        .delete()
        .eq('id', meetingId)

      if (error) {
        console.error('Error deleting video meeting:', error)
        throw new Error('Failed to delete video meeting')
      }
    } catch (error) {
      console.error('Error in deleteVideoMeeting:', error)
      throw error
    }
  }

  /**
   * Subscribe to video meeting updates
   */
  subscribeToVideoMeetings(callback: (payload: any) => void) {
    return supabase
      .channel('video_meetings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'video_meetings'
        },
        callback
      )
      .subscribe()
  }

  /**
   * Subscribe to video meeting participant updates
   */
  subscribeToMeetingParticipants(meetingId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`meeting_${meetingId}_participants`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'video_meeting_participants',
          filter: `meeting_id=eq.${meetingId}`
        },
        callback
      )
      .subscribe()
  }

  /**
   * Format meeting duration
   */
  formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60)
      return `${minutes}m`
    } else {
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      return `${hours}h ${minutes}m`
    }
  }

  /**
   * Generate meeting room name
   */
  generateRoomName(prefix?: string): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const roomPrefix = prefix || 'meeting'
    return `${roomPrefix}-${timestamp}-${random}`
  }

  /**
   * Validate SignalWire room URL
   */
  isValidRoomUrl(url: string): boolean {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname.includes('signalwire.com') || urlObj.hostname.includes('signalwire')
    } catch {
      return false
    }
  }

  /**
   * Get meeting status badge class
   */
  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'scheduled':
        return 'badge-light-warning'
      case 'active':
        return 'badge-light-success'
      case 'ended':
        return 'badge-light-secondary'
      default:
        return 'badge-light-secondary'
    }
  }

  /**
   * Check if meeting is joinable
   */
  isMeetingJoinable(meeting: VideoMeeting): boolean {
    return meeting.status === 'scheduled' || meeting.status === 'active'
  }

  /**
   * Get meeting participants count
   */
  getParticipantsCount(meeting: VideoMeeting): number {
    if (!meeting.participants) return 0
    return meeting.participants.filter((p: any) => !p.left_at).length
  }
}

export const videoService = new VideoService()
