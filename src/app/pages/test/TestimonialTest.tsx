import React from 'react'
import TestimonialVideoRoomClean from '../video-testimonials/components/TestimonialVideoRoomClean'

const TestimonialTest: React.FC = () => {
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
          <h1 className="mb-4">Video Testimonial Test Page</h1>
          <p className="text-muted mb-5">
            This page tests the SignalWire video testimonial feature with timing measurements.
          </p>
          
          <div className="card">
            <div className="card-body">
              <h5 className="card-title mb-3">Test Configuration</h5>
              <ul className="list-unstyled">
                <li><strong>Testimonial ID:</strong> test-123</li>
                <li><strong>Customer:</strong> John Smith</li>
                <li><strong>Job:</strong> HVAC Installation</li>
                <li><strong>Max Duration:</strong> 60 seconds</li>
              </ul>
            </div>
          </div>

          <div className="mt-4">
            <TestimonialVideoRoomClean
              testimonialId="test-123"
              customerName="John Smith"
              jobTitle="HVAC Installation"
              onRecordingComplete={handleRecordingComplete}
              onError={handleError}
              maxDuration={60}
            />
          </div>

          <div className="card mt-4">
            <div className="card-body">
              <h5 className="card-title">Timing Logs</h5>
              <p className="text-muted">Open the browser console to see detailed timing information:</p>
              <ul className="small">
                <li>🚀 Video initialization start time</li>
                <li>📡 Token fetch duration</li>
                <li>🎤 Media permission request time</li>
                <li>🔧 Room session creation time</li>
                <li>🚪 Room join duration</li>
                <li>🎉 Total initialization time</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TestimonialTest