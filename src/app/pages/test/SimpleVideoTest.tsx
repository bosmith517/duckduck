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
      const { data, error } = await supabase.functions.invoke('create-simple-video-room')
      
      if (error) {
        throw error
      }
      
      console.log('Room created:', data)
      setRoomInfo(data)
      setStatus('Room created successfully!')
      
      // Open debug page in new tab
      if (data.debug_url) {
        window.open(data.debug_url, '_blank')
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
                href={`/customer-portal/video-estimate-minimal?sw_token=${encodeURIComponent(roomInfo.token)}`} 
                target="_blank" 
                rel="noopener noreferrer"
              >
                Open Minimal Video Page
              </a>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}

export default SimpleVideoTest