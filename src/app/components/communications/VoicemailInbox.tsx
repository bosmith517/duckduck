import React, { useState, useEffect, useRef } from 'react'
import { communicationsService, CallLog } from '../../services/communicationsService'
import { showToast } from '../../utils/toast'
import { supabase } from '../../../supabaseClient'

interface VoicemailItem extends CallLog {
  caller_name?: string
  is_read?: boolean
  recording_duration?: number
  recording_url?: string
}

export const VoicemailInbox: React.FC = () => {
  const [voicemails, setVoicemails] = useState<VoicemailItem[]>([])
  const [loading, setLoading] = useState(true)
  const [currentlyPlaying, setCurrentlyPlaying] = useState<VoicemailItem | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [progress, setProgress] = useState(0)
  
  // State for our filters
  const [filterStatus, setFilterStatus] = useState('all') // 'all', 'unread', 'read'
  const [searchTerm, setSearchTerm] = useState('')
  
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    fetchVoicemails()
  }, [filterStatus, searchTerm]) // Re-run this effect when filters change

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
      setProgress((audio.currentTime / audio.duration) * 100)
    }

    const handlePlay = () => {
      setIsPlaying(true)
    }

    const handlePause = () => {
      setIsPlaying(false)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
      setProgress(0)
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [])

  const fetchVoicemails = async () => {
    try {
      setLoading(true)

      // Get current user's tenant_id from auth context
      const { data: currentUser } = await supabase.auth.getUser()
      if (!currentUser.user) {
        throw new Error('User not authenticated')
      }

      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('tenant_id')
        .eq('id', currentUser.user.id)
        .single()

      if (!userProfile?.tenant_id) {
        throw new Error('User tenant not found')
      }

      // Use call_logs table which has proper contact relationships
      let query = supabase
        .from('call_logs')
        .select(`
          *,
          contact:contacts (
            id,
            first_name,
            last_name,
            account:accounts (
              id,
              name
            )
          )
        `)
        .eq('tenant_id', userProfile.tenant_id) // Add tenant filter
        .eq('direction', 'inbound')
        .not('recording_url', 'is', null) // Only fetch calls that have recordings
        .order('created_at', { ascending: false })

      // === CORRECT FILTERING METHODS ===

      // 1. Add filter for read/unread status
      if (filterStatus === 'unread') {
        query = query.eq('is_read', false)
      } else if (filterStatus === 'read') {
        query = query.eq('is_read', true)
      }
      
      // 2. Add filter for search term (searching caller names)
      // Using 'ilike' for case-insensitive search on from_number for now
      // TODO: When we have caller_name field, we can search that instead
      if (searchTerm.length > 2) {
        query = query.ilike('from_number', `%${searchTerm}%`)
      }
      
      // Execute the final query
      const { data, error } = await query

      if (error) {
        console.error('Error fetching voicemails:', error)
        throw error
      }

      // Transform the data to include additional properties
      const voicemailData = (data || []).map(call => ({
        ...call,
        caller_name: call.contact?.first_name 
          ? `${call.contact.first_name} ${call.contact.last_name}`
          : 'Unknown Caller',
        recording_duration: call.duration || 0,
        recording_url: call.recording_url || `https://example.com/recordings/${call.id}.mp3` // Use actual recording URL or fallback
      }))

      setVoicemails(voicemailData)
    } catch (error) {
      console.error('Error fetching voicemails:', error)
      showToast.error('Failed to load voicemails')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (seconds: number): string => {
    const min = String(Math.floor(seconds / 60)).padStart(2, '0')
    const sec = String(Math.floor(seconds % 60)).padStart(2, '0')
    return `${min}:${sec}`
  }

  const formatDateTime = (timestamp: string): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 24) {
      return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } else if (diffInHours < 48) {
      return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } else {
      return date.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    }
  }

  const handleVoicemailClick = async (voicemail: VoicemailItem) => {
    // Set up audio player first
    setCurrentlyPlaying(voicemail)
    
    if (audioRef.current && voicemail.recording_url) {
      audioRef.current.src = voicemail.recording_url
      audioRef.current.play().catch(error => {
        console.error('Error playing audio:', error)
        showToast.error('Failed to play voicemail')
      })
    }

    // If it's unread, update it in the database
    if (!voicemail.is_read) {
      try {
        const { error } = await supabase
          .from('call_logs')
          .update({ is_read: true })
          .eq('id', voicemail.id)
          
        if (error) {
          console.error('Error marking voicemail as read:', error)
        } else {
          // Optimistically update the local state for an instant UI change
          setVoicemails(currentVoicemails => 
            currentVoicemails.map(v => 
              v.id === voicemail.id ? { ...v, is_read: true } : v
            )
          )
        }
      } catch (error) {
        console.error('Error updating voicemail read status:', error)
      }
    }
  }

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play().catch(error => {
          console.error('Error playing audio:', error)
          showToast.error('Failed to play voicemail')
        })
      }
    }
  }

  const unreadCount = voicemails.filter(vm => !vm.is_read).length

  if (loading) {
    return (
      <div className='card'>
        <div className='card-header'>
          <h3 className='card-title'>Voicemail Inbox</h3>
        </div>
        <div className='card-body'>
          <div className='d-flex justify-content-center py-10'>
            <div className='spinner-border text-primary' role='status'>
              <span className='visually-hidden'>Loading voicemails...</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='card'>
      {/* Header */}
      <div className='card-header border-0 pt-6'>
        <div className='card-title'>
          <h2 className='fw-bold text-gray-800 fs-2'>Voicemail Inbox</h2>
        </div>
        <div className='card-toolbar'>
          <div className='d-flex align-items-center gap-3'>
            {/* Search Input */}
            <div className='position-relative'>
              <input
                type='text'
                className='form-control form-control-sm w-200px'
                placeholder='Search voicemails...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <i className='ki-duotone ki-magnifier fs-6 position-absolute top-50 end-0 translate-middle-y me-3'></i>
            </div>
            
            {/* Status Filter */}
            <select
              className='form-select form-select-sm w-120px'
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value='all'>All Messages</option>
              <option value='unread'>Unread</option>
              <option value='read'>Read</option>
            </select>
            
            {/* Unread Count Badge */}
            {unreadCount > 0 && (
              <span className='badge badge-light-primary fs-7'>
                {unreadCount} new message{unreadCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Audio Player */}
      {currentlyPlaying && (
        <div className='card-body border-bottom bg-light-primary py-4'>
          <div className='d-flex align-items-center'>
            <div className='flex-shrink-0 me-3'>
              <button
                onClick={handlePlayPause}
                className='btn btn-primary btn-icon w-50px h-50px'
              >
                {isPlaying ? (
                  <i className='ki-duotone ki-pause fs-2'></i>
                ) : (
                  <i className='ki-duotone ki-play fs-2'></i>
                )}
              </button>
            </div>
            <div className='flex-grow-1'>
              <div className='fw-bold text-gray-800 mb-1'>
                Now Playing: {currentlyPlaying.caller_name}
              </div>
              <div className='d-flex align-items-center'>
                <span className='text-muted fs-7 me-2'>{formatTime(currentTime)}</span>
                <div className='progress flex-grow-1 h-6px me-2'>
                  <div 
                    className='progress-bar bg-primary' 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <span className='text-muted fs-7'>{formatTime(duration)}</span>
              </div>
            </div>
          </div>
          <audio ref={audioRef} />
        </div>
      )}

      {/* Voicemail List */}
      <div className='card-body p-0'>
        {voicemails.length === 0 ? (
          <div className='text-center py-10'>
            <div className='text-muted mb-3'>
              <i className='ki-duotone ki-microphone fs-3x text-muted mb-3'></i>
            </div>
            <div className='text-muted'>
              No voicemails found. Voicemails will appear here when callers leave messages.
            </div>
          </div>
        ) : (
          <div className='table-responsive'>
            {voicemails.map((voicemail) => (
              <div
                key={voicemail.id}
                onClick={() => handleVoicemailClick(voicemail)}
                className={`d-flex align-items-center p-4 border-bottom border-gray-300 cursor-pointer hover-bg-light-primary ${
                  currentlyPlaying?.id === voicemail.id ? 'bg-light-primary' : ''
                }`}
                style={{ cursor: 'pointer' }}
              >
                {/* Read/Unread Indicator */}
                <div className='flex-shrink-0 me-4'>
                  <div 
                    className={`w-10px h-10px rounded-circle ${
                      voicemail.is_read ? 'bg-transparent' : 'bg-primary'
                    }`}
                  ></div>
                </div>

                {/* Caller Info */}
                <div className='flex-grow-1'>
                  <div className={`fw-bold ${voicemail.is_read ? 'text-gray-600' : 'text-gray-800'}`}>
                    {voicemail.caller_name}
                  </div>
                  <div className={`fs-7 ${voicemail.is_read ? 'text-gray-400' : 'text-gray-500'}`}>
                    {communicationsService.formatPhoneNumber(voicemail.from_number)}
                  </div>
                </div>

                {/* Time and Duration */}
                <div className={`text-end fs-7 ${voicemail.is_read ? 'text-gray-400' : 'text-gray-500'}`}>
                  <div>{formatDateTime(voicemail.created_at)}</div>
                  <div>{formatTime(voicemail.recording_duration || 0)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
