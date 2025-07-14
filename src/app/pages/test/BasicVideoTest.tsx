import React from 'react'
import { useSearchParams } from 'react-router-dom'
import { BasicSignalWireRoom } from '../../components/video/BasicSignalWireRoom'

const BasicVideoTest: React.FC = () => {
  const [searchParams] = useSearchParams()
  const swToken = searchParams.get('sw_token')
  
  if (!swToken) {
    return (
      <div style={{ padding: '20px' }}>
        <h2>Basic Video Test</h2>
        <p>No video token provided. Add ?sw_token=YOUR_TOKEN to the URL.</p>
      </div>
    )
  }
  
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <BasicSignalWireRoom token={swToken} />
    </div>
  )
}

export default BasicVideoTest