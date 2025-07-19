import React, { useState } from 'react'
import TestimonialVideoRoomClean from '../video-testimonials/components/TestimonialVideoRoomClean'

export const TestimonialQuickTest: React.FC = () => {
  const [errorDetails, setErrorDetails] = useState<string | null>(null)

  return (
    <div className="container py-5">
      <div className="row">
        <div className="col-12">
          <h1 className="mb-4">🎥 Testimonial Quick Test</h1>
          
          <div className="alert alert-info mb-4">
            <h5>Testing Fixed Edge Function</h5>
            <p>This uses the updated <code>signalwire-token-v2</code> with two-step room creation.</p>
            <p className="mb-0">Connection should now be fast (no 42-second ICE timeout).</p>
          </div>

          {errorDetails && (
            <div className="alert alert-danger mb-4">
              <h5>⚠️ Edge Function Error</h5>
              <p>{errorDetails}</p>
              <hr />
              <p className="mb-0">
                <strong>To fix:</strong> Deploy the Edge Function with:<br />
                <code>supabase functions deploy signalwire-token-v2</code>
              </p>
            </div>
          )}

          <TestimonialVideoRoomClean
            testimonialId={`test-${Date.now()}`}
            customerName="Test User"
            jobTitle="Testing Service"
            onRecordingComplete={(url) => {
              console.log('Recording complete:', url)
              alert(`Recording saved: ${url}`)
            }}
            onError={(error) => {
              console.error('Testimonial error:', error)
              
              // Check if it's a 404 error
              if (error.message?.includes('404') || error.message?.includes('not found')) {
                setErrorDetails('Edge Function "signalwire-token-v2" not found (404). The function needs to be deployed.')
              } else {
                setErrorDetails(error.message || 'Unknown error occurred')
              }
            }}
          />

          <div className="alert alert-warning mt-4">
            <h5>📋 Quick Deploy Instructions</h5>
            <ol className="mb-0">
              <li>Open terminal in project root</li>
              <li>Run: <code>supabase functions deploy signalwire-token-v2</code></li>
              <li>Refresh this page and try again</li>
              <li>Connection should be fast (under 5 seconds)</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TestimonialQuickTest