import React, { useState } from 'react'
import { supabase } from '../../../../supabaseClient'
import { showToast } from '../../../utils/toast'
import { useSupabaseAuth } from '../../../modules/auth/core/SupabaseAuth'

interface VideoEstimateInitiatorProps {
  leadId?: string
  contactId?: string
  accountId?: string
  onSessionStarted: (sessionId: string) => void
}

export const VideoEstimateInitiator: React.FC<VideoEstimateInitiatorProps> = ({
  leadId,
  contactId,
  accountId,
  onSessionStarted
}) => {
  const { userProfile } = useSupabaseAuth()
  const [isCreating, setIsCreating] = useState(false)
  const [selectedTrade, setSelectedTrade] = useState<string>('ROOFING')
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    email: '',
    address: ''
  })
  const [sessionType, setSessionType] = useState<'immediate' | 'scheduled'>('immediate')
  const [scheduledTime, setScheduledTime] = useState('')

  const trades = [
    { value: 'ROOFING', label: 'Roofing', icon: 'ki-home-2' },
    { value: 'PLUMBING', label: 'Plumbing', icon: 'ki-water' },
    { value: 'HVAC', label: 'HVAC', icon: 'ki-wind' },
    { value: 'ELECTRICAL', label: 'Electrical', icon: 'ki-electricity' }
  ]

  const handleCreateSession = async () => {
    try {
      setIsCreating(true)

      // Step 1: Create the video room using our proven SignalWire approach
      const roomName = `estimate_${selectedTrade.toLowerCase()}_${Date.now()}`
      
      const { data: roomData, error: roomError } = await supabase.functions.invoke('create-signalwire-room', {
        body: {
          room_name: roomName,
          customer_name: customerInfo.name,
          session_id: null // Will be set after session creation
        }
      })

      if (roomError) throw roomError

      // Step 2: Create the video session record
      const { data: session, error: sessionError } = await supabase
        .from('video_sessions')
        .insert({
          tenant_id: userProfile?.tenant_id,
          lead_id: leadId,
          contact_id: contactId,
          account_id: accountId,
          trade_type: selectedTrade,
          room_id: roomData.room_name,
          signalwire_room_id: roomData.room_id,
          signalwire_room_name: roomData.room_name,
          status: sessionType === 'immediate' ? 'pending' : 'scheduled',
          scheduled_at: sessionType === 'scheduled' ? scheduledTime : null,
          metadata: {
            customer_info: customerInfo,
            ai_enabled: true,
            vision_enabled: true,
            trade_specific_prompts: true
          }
        })
        .select()
        .single()

      if (sessionError) throw sessionError

      // Step 3: Set up AI integration (optional for now)
      // The AI can be added to the room later when the session starts
      console.log('Session created with SignalWire room:', roomData.room_name)

      // Step 4: Send invitation to customer
      if (customerInfo.phone || customerInfo.email) {
        await sendCustomerInvitation(session)
      }

      showToast.success('Video estimation session created successfully!')
      onSessionStarted(session.id)

    } catch (error) {
      console.error('Error creating video session:', error)
      showToast.error('Failed to create video estimation session')
    } finally {
      setIsCreating(false)
    }
  }

  const sendCustomerInvitation = async (session: any) => {
    try {
      // Generate customer portal link
      const portalUrl = `${window.location.origin}/customer-portal/video-estimate/${session.id}`

      // Send SMS if phone provided
      if (customerInfo.phone) {
        await supabase.functions.invoke('send-sms', {
          body: {
            to: customerInfo.phone,
            message: `Hi ${customerInfo.name}, your video estimate for ${selectedTrade.toLowerCase()} is ready! Join here: ${portalUrl}`,
            tenant_id: userProfile?.tenant_id
          }
        })
      }

      // Send email if provided
      if (customerInfo.email) {
        await supabase.functions.invoke('send-email', {
          body: {
            to: customerInfo.email,
            subject: 'Your Video Estimate is Ready',
            html: `
              <h2>Hi ${customerInfo.name},</h2>
              <p>Your video estimate for ${selectedTrade.toLowerCase()} services is ready!</p>
              <p>Our AI assistant Alex will guide you through showing the areas that need service.</p>
              <p><a href="${portalUrl}" style="background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Join Video Estimate</a></p>
              <p>What to expect:</p>
              <ul>
                <li>Use your phone's camera to show the areas needing service</li>
                <li>Our AI will analyze and document any issues</li>
                <li>Receive a detailed estimate within 24 hours</li>
                <li>The session typically takes 10-15 minutes</li>
              </ul>
              <p>Best regards,<br>TradeWorks Pro Team</p>
            `,
            tenant_id: userProfile?.tenant_id
          }
        })
      }
    } catch (error) {
      console.error('Error sending invitation:', error)
      showToast.warning('Session created but failed to send invitation')
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Start AI-Powered Video Estimate</h3>
        <div className="card-toolbar">
          <span className="badge badge-light-success">AI Assistant Ready</span>
        </div>
      </div>

      <div className="card-body">
        {/* Trade Selection */}
        <div className="mb-6">
          <label className="form-label required">Service Type</label>
          <div className="row g-3">
            {trades.map((trade) => (
              <div key={trade.value} className="col-6 col-md-3">
                <label className="btn btn-outline btn-outline-dashed btn-active-light-primary p-7 d-flex align-items-center h-100">
                  <input
                    type="radio"
                    className="form-check-input"
                    name="trade"
                    value={trade.value}
                    checked={selectedTrade === trade.value}
                    onChange={(e) => setSelectedTrade(e.target.value)}
                  />
                  <span className="d-block fw-semibold text-start ms-3">
                    <i className={`ki-duotone ${trade.icon} fs-2 text-primary mb-2`}>
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    <div className="text-gray-900 fw-bold fs-6">{trade.label}</div>
                  </span>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Customer Information */}
        <div className="mb-6">
          <h5 className="mb-4">Customer Information</h5>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label required">Customer Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="John Smith"
                value={customerInfo.name}
                onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Phone Number</label>
              <input
                type="tel"
                className="form-control"
                placeholder="(555) 123-4567"
                value={customerInfo.phone}
                onChange={(e) => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-control"
                placeholder="customer@email.com"
                value={customerInfo.email}
                onChange={(e) => setCustomerInfo(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Property Address</label>
              <input
                type="text"
                className="form-control"
                placeholder="123 Main St, City, State"
                value={customerInfo.address}
                onChange={(e) => setCustomerInfo(prev => ({ ...prev, address: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* Session Type */}
        <div className="mb-6">
          <label className="form-label">Session Type</label>
          <div className="d-flex gap-4">
            <label className="form-check form-check-custom form-check-solid">
              <input
                className="form-check-input"
                type="radio"
                value="immediate"
                checked={sessionType === 'immediate'}
                onChange={(e) => setSessionType('immediate')}
              />
              <span className="form-check-label">Start Now</span>
            </label>
            <label className="form-check form-check-custom form-check-solid">
              <input
                className="form-check-input"
                type="radio"
                value="scheduled"
                checked={sessionType === 'scheduled'}
                onChange={(e) => setSessionType('scheduled')}
              />
              <span className="form-check-label">Schedule for Later</span>
            </label>
          </div>
          
          {sessionType === 'scheduled' && (
            <div className="mt-3">
              <input
                type="datetime-local"
                className="form-control"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>
          )}
        </div>

        {/* AI Features Info */}
        <div className="alert alert-primary d-flex align-items-center p-5 mb-6">
          <i className="ki-duotone ki-shield-tick fs-2hx text-primary me-4">
            <span className="path1"></span>
            <span className="path2"></span>
          </i>
          <div className="d-flex flex-column">
            <h4 className="mb-1">AI-Powered Estimation</h4>
            <span>Our AI assistant will guide the customer through the inspection, analyze issues in real-time, and generate a professional estimate.</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="d-flex justify-content-end gap-3">
          <button type="button" className="btn btn-light">
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleCreateSession}
            disabled={isCreating || !customerInfo.name}
          >
            {isCreating ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Creating Session...
              </>
            ) : (
              <>
                <i className="ki-duotone ki-video-camera fs-5 me-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                Start Video Estimate
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}