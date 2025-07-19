import React from 'react'
import TestimonialVideoRoomClean from '../video-testimonials/components/TestimonialVideoRoomClean'

const VideoTimingTest: React.FC = () => {
  const handleRecordingComplete = (videoUrl: string) => {
    console.log('Recording completed:', videoUrl)
    alert(`Recording completed! Video URL: ${videoUrl}`)
  }

  const handleError = (error: any) => {
    console.error('Testimonial error:', error)
  }

  return (
    <div className="container py-5">
      <div className="row">
        <div className="col-12">
          <div className="alert alert-info mb-4">
            <h4 className="alert-heading">Video Timing Test Page</h4>
            <p>This is the correct page for testing SignalWire video with timing measurements.</p>
            <hr />
            <p className="mb-0">Check the browser console for detailed timing logs.</p>
          </div>

          <h1 className="mb-4">SignalWire Video Testimonial - Timing Test</h1>
          
          <div className="card mb-4 border-primary">
            <div className="card-header bg-primary text-white">
              <h5 className="mb-0">Test Parameters</h5>
            </div>
            <div className="card-body">
              <dl className="row mb-0">
                <dt className="col-sm-3">Testimonial ID:</dt>
                <dd className="col-sm-9">test-123</dd>
                
                <dt className="col-sm-3">Customer Name:</dt>
                <dd className="col-sm-9">John Smith</dd>
                
                <dt className="col-sm-3">Job Title:</dt>
                <dd className="col-sm-9">HVAC Installation</dd>
                
                <dt className="col-sm-3">Max Duration:</dt>
                <dd className="col-sm-9">60 seconds</dd>
              </dl>
            </div>
          </div>

          <div className="bg-light p-4 rounded mb-4">
            <TestimonialVideoRoomClean
              testimonialId="test-123"
              customerName="John Smith"
              jobTitle="HVAC Installation"
              onRecordingComplete={handleRecordingComplete}
              onError={handleError}
              maxDuration={60}
            />
          </div>

          <div className="card border-success">
            <div className="card-header bg-success text-white">
              <h5 className="mb-0">Expected Console Output</h5>
            </div>
            <div className="card-body">
              <pre className="mb-0 p-3 bg-dark text-light rounded">
{`✅ SignalWire Browser SDK loaded
🚀 Starting video initialization... [timestamp]
📡 Fetching token from edge function...
✅ Token received in XXXms
🎤 Requesting media permissions...
✅ Media permissions granted in XXXXms
🔧 Creating room session...
✅ Room session created in Xms
🚪 Joining room...
✅ Room joined in XXXXms
🎉 Video initialization complete in XXXXms (X.Xs)`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VideoTimingTest