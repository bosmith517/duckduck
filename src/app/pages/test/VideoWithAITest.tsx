// VideoWithAITest.tsx
// Test page for video rooms with AI agents

import React, { useState } from 'react'
import { WorkingVideoComponent } from '../../components/video/WorkingVideoComponent'
import { AIAgentButton } from '../../components/video/AIAgentButton'

export const VideoWithAITest: React.FC = () => {
  const [currentRoom, setCurrentRoom] = useState<string>(`ai-test-${Date.now()}`)
  const [isConnected, setIsConnected] = useState(false)

  return (
    <div className="container py-5">
      <h2 className="mb-4">Video Room with AI Assistant Test</h2>
      
      <div className="row">
        <div className="col-lg-8">
          {/* Video Component */}
          <div className="card">
            <div className="card-body">
              <h4 className="card-title">Video Room</h4>
              
              <WorkingVideoComponent 
                roomName={currentRoom}
                onRoomJoined={(roomName) => {
                  console.log('Room joined:', roomName)
                  setIsConnected(true)
                }}
                onRoomLeft={() => {
                  console.log('Room left')
                  setIsConnected(false)
                }}
              />
            </div>
          </div>
        </div>
        
        <div className="col-lg-4">
          {/* AI Controls */}
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">AI Assistant Controls</h5>
              
              <div className="mb-3">
                <p className="text-muted small">
                  Add an AI assistant to help in your video call
                </p>
              </div>
              
              {!isConnected && (
                <div className="alert alert-warning mb-3">
                  <small>Please join the video room first before adding AI assistant</small>
                </div>
              )}
              
              <AIAgentButton
                roomName={currentRoom}
                agentName="Alex"
                agentRole="Technical Assistant"
                onAgentAdded={() => {
                  console.log('AI agent added to room')
                }}
                onError={(error) => {
                  console.error('AI agent error:', error)
                }}
              />
              
              <hr className="my-4" />
              
              <div className="alert alert-info">
                <strong>How it works:</strong>
                <ol className="mb-0 ps-3">
                  <li>Join the video room first</li>
                  <li>Click "Add AI Assistant"</li>
                  <li>Alex will join and help!</li>
                </ol>
              </div>
              
              <div className="alert alert-warning mt-3">
                <strong>Implementation Status:</strong>
                <ul className="mb-0 ps-3">
                  <li>✅ Video room connection working (40-43s delay)</li>
                  <li>✅ AI agent UI components ready</li>
                  <li>⏳ Waiting for SignalWire AI agent deployment</li>
                  <li>⏳ API credentials needed in Supabase</li>
                </ul>
              </div>
              
              <div className="mt-3">
                <h6>AI Capabilities:</h6>
                <ul className="small">
                  <li>Visual understanding via video</li>
                  <li>Natural conversation</li>
                  <li>Technical expertise</li>
                  <li>Project estimation help</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="row mt-4">
        <div className="col-12">
          <div className="card bg-light">
            <div className="card-body">
              <h5>Test Instructions</h5>
              <ol>
                <li>Click "Join Room" to connect to the video room</li>
                <li>Once connected, click "Add AI Technical Assistant"</li>
                <li>Alex will join the video call and introduce themselves</li>
                <li>Try showing something to the camera and asking Alex about it</li>
                <li>Test the visual understanding capabilities</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VideoWithAITest