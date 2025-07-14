import React, { useState } from 'react'
import { supabase } from '../../../supabaseClient'

const SimpleVideoTest: React.FC = () => {
  const [status, setStatus] = useState('')
  const [roomInfo, setRoomInfo] = useState<any>(null)
  const [error, setError] = useState('')
  
  const createTestRoom = async () => {
    setStatus('Creating room...')
    setError('')
    
    try {
      const response = await supabase.functions.invoke('create-simple-video-room')
      
      // Check if we got data even with an error (SignalWire sometimes returns 400 but still works)
      if (response.data && response.data.room) {
        console.log('Room created:', response.data)
        setRoomInfo(response.data)
        setStatus('Room created successfully!')
        
        // Open debug page in new tab
        if (response.data.debug_url) {
          window.open(response.data.debug_url, '_blank')
        }
        return
      }
      
      if (response.error) {
        throw response.error
      }
      
    } catch (err: any) {
      console.error('Error:', err)
      setError(err.message || 'Failed to create room')
      setStatus('')
    }
  }
  
  return (
    <div style={{ padding: '20px' }}>
      <h1>Simple Video Test</h1>
      
      <button 
        onClick={createTestRoom}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        Create Test Room
      </button>
      
      {status && (
        <div style={{ marginTop: '20px', color: 'green' }}>
          {status}
        </div>
      )}
      
      {error && (
        <div style={{ marginTop: '20px', color: 'red' }}>
          Error: {error}
        </div>
      )}
      
      {roomInfo && (
        <div style={{ marginTop: '20px', backgroundColor: '#f0f0f0', padding: '10px' }}>
          <h3>Room Info:</h3>
          <pre>{JSON.stringify(roomInfo, null, 2)}</pre>
          
          <h3>Test Links:</h3>
          <ul>
            <li>
              <a href={roomInfo.debug_url} target="_blank" rel="noopener noreferrer">
                Open Debug Page
              </a>
            </li>
            <li>
              <a 
                href={`/estimating-portal/video-session-minimal?sw_token=${encodeURIComponent(roomInfo.token)}`} 
                target="_blank" 
                rel="noopener noreferrer"
              >
                Open Minimal Video Page (Estimating Portal)
              </a>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}

export default SimpleVideoTest