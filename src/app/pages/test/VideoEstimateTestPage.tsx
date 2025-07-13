import React, { useState, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'
import { VideoSession } from '../video-estimating/VideoEstimatingHub'
import { ActiveSessionView } from '../video-estimating/components/ActiveSessionView'

const VideoEstimateTestPage: React.FC = () => {
  const [sessions, setSessions] = useState<VideoSession[]>([])
  const [selectedSession, setSelectedSession] = useState<VideoSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRecentSessions()
  }, [])

  const loadRecentSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('video_sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)
      
      if (error) throw error
      setSessions(data || [])
    } catch (error) {
      console.error('Error loading sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  if (selectedSession) {
    return (
      <ActiveSessionView
        session={selectedSession}
        onEnd={() => setSelectedSession(null)}
      />
    )
  }

  return (
    <div className='p-5'>
      <h1>Video Estimate Test Page</h1>
      <p>Select a session to test video estimating without authentication:</p>
      
      {loading ? (
        <div>Loading sessions...</div>
      ) : sessions.length === 0 ? (
        <div>No sessions found</div>
      ) : (
        <div className='mt-4'>
          <h3>Recent Sessions:</h3>
          <div className='list-group'>
            {sessions.map(session => (
              <button
                key={session.id}
                className='list-group-item list-group-item-action'
                onClick={() => setSelectedSession(session)}
              >
                <div className='d-flex justify-content-between'>
                  <div>
                    <strong>{session.trade_type}</strong> - {session.status}
                    <br />
                    <small>Room: {session.room_id}</small>
                  </div>
                  <div>
                    <small>{new Date(session.created_at).toLocaleString()}</small>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      
      <div className='mt-4'>
        <h3>Test Links:</h3>
        {sessions.filter(s => s.room_id).map(session => (
          <div key={session.id} className='mb-2'>
            <code>
              {window.location.origin}/customer-portal/video-estimate?session={session.id}&token={btoa(session.room_id)}
            </code>
          </div>
        ))}
      </div>
    </div>
  )
}

export default VideoEstimateTestPage