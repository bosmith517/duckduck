import React from 'react'
import SignalWireVideoRoom from '../../components/video/SignalWireVideoRoom'

const SignalWireVideoTestPage: React.FC = () => {
  const handleRoomJoined = (roomSession: any) => {
    console.log('Test Page: Room joined successfully', roomSession)
  }

  const handleMemberJoined = (member: any) => {
    console.log('Test Page: Member joined', member)
  }

  const handleMemberLeft = (member: any) => {
    console.log('Test Page: Member left', member)
  }

  const handleError = (error: any) => {
    console.error('Test Page: Video room error', error)
  }

  return (
    <div className="container-fluid p-5">
      <h1 className="mb-4">SignalWire Video Room Isolated Test</h1>
      
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Video Room Component Test (No Token)</h3>
              <p className="text-muted mb-0">Testing the component in isolation without VideoEstimatePage</p>
            </div>
            <div className="card-body">
              {/* Component will show test mode UI since no token is provided */}
              <SignalWireVideoRoom 
                onRoomJoined={handleRoomJoined}
                onMemberJoined={handleMemberJoined}
                onMemberLeft={handleMemberLeft}
                onError={handleError}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="row mt-5">
        <div className="col-12">
          <div className="alert alert-warning">
            <h5>⚠️ Testing Without VideoEstimatePage</h5>
            <p>This test page isolates the SignalWireVideoRoom component to determine if the connection issues are:</p>
            <ul>
              <li>Related to the component itself</li>
              <li>Related to the token being passed from VideoEstimatePage</li>
              <li>Related to the specific room being joined</li>
            </ul>
            <p className="mb-0">
              <strong>Expected behavior:</strong> The component should generate a fresh test token, create a new room, and connect successfully.
            </p>
          </div>
        </div>
      </div>

      <div className="row mt-3">
        <div className="col-12">
          <div className="alert alert-info">
            <h5>🔍 Console Output</h5>
            <p>Open your browser's developer console to see detailed logs:</p>
            <ul>
              <li>Token generation process</li>
              <li>Room session creation</li>
              <li>Connection events</li>
              <li>Any errors that occur</li>
            </ul>
            <p className="mb-0">
              <strong>Look for:</strong> "Connection pool not initialized" errors or successful "Room joined" messages.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SignalWireVideoTestPage