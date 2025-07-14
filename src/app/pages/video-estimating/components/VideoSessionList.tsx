import React from 'react'
import { VideoSession } from '../VideoEstimatingHub'
import { supabase } from '../../../../supabaseClient'
import { showToast } from '../../../utils/toast'

interface VideoSessionListProps {
  sessions: VideoSession[]
  loading: boolean
  onStart: (session: VideoSession) => void
  onReview: (session: VideoSession) => void
}

export const VideoSessionList: React.FC<VideoSessionListProps> = ({
  sessions,
  loading,
  onStart,
  onReview
}) => {
  const sendInvite = async (session: VideoSession) => {
    try {
      // First verify the session exists and has a room_id
      if (!session.room_id) {
        showToast.error('Session does not have a room ID yet')
        return
      }
      
      // Generate custom customer portal token
      const { data: tokenData, error: tokenError } = await supabase
        .functions.invoke('generate-customer-portal-token', {
          body: {
            session_id: session.id,
            room_id: session.room_id
          }
        })
      
      if (tokenError) {
        console.error('Token generation error:', tokenError)
        showToast.error('Failed to generate customer token')
        return
      }
      
      // Generate magic link - use IP address for mobile testing
      const host = window.location.hostname === 'localhost' ? '10.0.0.196' : window.location.hostname
      const port = window.location.port ? `:${window.location.port}` : ''
      const protocol = window.location.protocol
      const magicLink = `${protocol}//${host}${port}/estimating-portal/video-session?session=${session.id}&token=${encodeURIComponent(tokenData.portal_token)}&sw_token=${encodeURIComponent(tokenData.signalwire_token)}`
      
      // Store the customer tokens for auditing
      try {
        await supabase
          .from('video_sessions')
          .update({ 
            customer_token: tokenData.portal_token,
            signalwire_token: tokenData.signalwire_token 
          })
          .eq('id', session.id)
      } catch (updateError) {
        console.warn('Could not store customer token:', updateError)
        // Continue anyway - this is just for auditing
      }
      
      // For now, just copy the link to clipboard and show it
      try {
        await navigator.clipboard.writeText(magicLink)
        showToast.success('Magic link copied to clipboard!')
      } catch {
        // Fallback if clipboard fails
        showToast.info('Magic link generated')
      }
      
      console.log('Magic link:', magicLink)
      
      // Show the link in a modal or alert for easy copying
      const message = `Video Estimating Portal Link:\n\n${magicLink}\n\nThis link has been copied to your clipboard. Send it to the customer for their video estimate session.`
      alert(message)
      
      // TODO: Re-enable email sending once the edge function is fixed
      /*
      const { data, error } = await supabase.functions.invoke('send-session-invite', {
        body: {
          session_id: session.id,
          customer_email: 'bosmith@l7motors.com',
          magic_link: magicLink,
          send_sms: false,
          send_email: true
        }
      })
      */
    } catch (error) {
      console.error('Error generating invitation:', error)
      showToast.error('Failed to generate invitation')
    }
  }

  const getTradeIcon = (tradeType: string) => {
    switch (tradeType) {
      case 'ROOFING':
        return 'ki-home-2'
      case 'PLUMBING':
        return 'ki-filter'
      case 'HVAC':
        return 'ki-wind'
      case 'ELECTRICAL':
        return 'ki-flash'
      default:
        return 'ki-wrench'
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'badge-light-info'
      case 'active':
        return 'badge-light-success'
      case 'completed':
        return 'badge-light-primary'
      case 'cancelled':
        return 'badge-light-danger'
      default:
        return 'badge-light-secondary'
    }
  }

  const formatDuration = (startedAt: string, endedAt: string) => {
    const start = new Date(startedAt)
    const end = new Date(endedAt)
    const durationMs = end.getTime() - start.getTime()
    const minutes = Math.floor(durationMs / 60000)
    return `${minutes} min`
  }

  if (loading) {
    return (
      <div className='text-center py-10'>
        <div className='spinner-border text-primary' role='status'>
          <span className='visually-hidden'>Loading...</span>
        </div>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className='text-center py-10'>
        <div className='text-muted'>
          No video estimating sessions yet. Create your first session to get started.
        </div>
      </div>
    )
  }

  return (
    <div className='table-responsive'>
      <table className='table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4'>
        <thead>
          <tr className='fw-bold text-muted'>
            <th className='min-w-150px'>Customer</th>
            <th className='min-w-100px'>Trade</th>
            <th className='min-w-100px'>Status</th>
            <th className='min-w-120px'>Scheduled</th>
            <th className='min-w-100px'>Duration</th>
            <th className='min-w-100px'>Estimate</th>
            <th className='min-w-100px text-end'>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => {
            const customer = session.accounts || session.contacts || session.leads
            const customerName = customer ? (
              'name' in customer ? customer.name :
              `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
            ) : 'Unknown Customer'

            return (
              <tr key={session.id}>
                <td>
                  <div className='d-flex flex-column'>
                    <span className='text-dark fw-bold fs-6'>{customerName}</span>
                    {customer && (
                      <span className='text-muted fs-7'>
                        {('phone' in customer ? customer.phone : 'phone_number' in customer ? customer.phone_number : null) || customer.email}
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <div className='d-flex align-items-center'>
                    <i className={`ki-duotone ${getTradeIcon(session.trade_type)} fs-2 me-2`}>
                      <span className='path1'></span>
                      <span className='path2'></span>
                    </i>
                    <span className='text-dark fw-bold'>{session.trade_type}</span>
                  </div>
                </td>
                <td>
                  <span className={`badge ${getStatusBadge(session.status)}`}>
                    {session.status}
                  </span>
                </td>
                <td>
                  <span className='text-dark fw-bold'>
                    {session.scheduled_at ? 
                      new Date(session.scheduled_at).toLocaleString() : 
                      'Not scheduled'
                    }
                  </span>
                </td>
                <td>
                  <span className='text-dark'>
                    {session.started_at && session.ended_at ? 
                      formatDuration(session.started_at, session.ended_at) : 
                      '-'
                    }
                  </span>
                </td>
                <td>
                  {session.estimate_id ? (
                    <a href={`/estimates`} className='text-primary fw-bold'>
                      #{session.estimates?.estimate_number}
                    </a>
                  ) : (
                    <span className='text-muted'>-</span>
                  )}
                </td>
                <td className='text-end'>
                  {session.status === 'scheduled' && (
                    <>
                      <button
                        className='btn btn-sm btn-light-primary me-2'
                        onClick={() => onStart(session)}
                      >
                        Start
                      </button>
                      <button
                        className='btn btn-sm btn-light-info me-2'
                        onClick={() => sendInvite(session)}
                        title='Send invitation'
                      >
                        <i className='ki-duotone ki-message-text-2 fs-6'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                          <span className='path3'></span>
                        </i>
                      </button>
                    </>
                  )}
                  {session.status === 'active' && (
                    <button
                      className='btn btn-sm btn-light-success me-2'
                      onClick={() => onStart(session)}
                    >
                      Join
                    </button>
                  )}
                  {session.status === 'completed' && session.vision_results && (
                    <button
                      className='btn btn-sm btn-light-info me-2'
                      onClick={() => onReview(session)}
                    >
                      Review
                    </button>
                  )}
                  <button
                    className='btn btn-sm btn-light'
                    title='View Details'
                  >
                    <i className='ki-duotone ki-eye fs-3'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                      <span className='path3'></span>
                    </i>
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}