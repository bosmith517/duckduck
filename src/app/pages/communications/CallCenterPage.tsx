import React, { useState, useEffect } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'
import { communicationsService, CallLog, ActiveCall } from '../../services/communicationsService'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { showToast } from '../../utils/toast'
import { TableSkeleton, StatCardSkeleton } from '../../components/shared/skeletons/TableSkeleton'
import { VoicemailInbox } from '../../components/communications/VoicemailInbox'
import { VideoMeetingInterface } from '../../components/communications/VideoMeetingInterface'
import { SMSChatInterface } from '../../components/communications/SMSChatInterface'
import { useSoftphoneContext } from '../../contexts/SoftphoneContext'
import { useLocation } from 'react-router-dom'

const CallCenterPage: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  const { showDialer } = useSoftphoneContext()
  const location = useLocation()
  const [callLogs, setCallLogs] = useState<CallLog[]>([])
  const [inboundCalls, setInboundCalls] = useState<ActiveCall[]>([])
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null)
  const [loading, setLoading] = useState(true)
  const [callsLoading, setCallsLoading] = useState(false)

  // Determine active tab from URL
  const getActiveTab = () => {
    const path = location.pathname
    if (path.includes('/video')) return 'video'
    if (path.includes('/sms')) return 'sms'
    if (path.includes('/voicemail')) return 'voicemail'
    return 'call-center'
  }

  const [activeTab, setActiveTab] = useState(getActiveTab())

  // Filters
  const [dateFilter, setDateFilter] = useState('today')
  const [directionFilter, setDirectionFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    if (userProfile?.tenant_id) {
      fetchCallLogs()
      setupRealtimeSubscriptions()
    }

    return () => {
      // Cleanup subscriptions
    }
  }, [userProfile?.tenant_id, dateFilter, directionFilter, statusFilter])

  const fetchCallLogs = async () => {
    try {
      setCallsLoading(true)
      
      const filters: any = {}
      
      if (directionFilter !== 'all') {
        filters.direction = directionFilter
      }
      
      if (statusFilter !== 'all') {
        filters.status = statusFilter
      }

      // Date filtering
      if (dateFilter === 'today') {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        filters.date_from = today.toISOString()
      } else if (dateFilter === 'week') {
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        filters.date_from = weekAgo.toISOString()
      } else if (dateFilter === 'month') {
        const monthAgo = new Date()
        monthAgo.setMonth(monthAgo.getMonth() - 1)
        filters.date_from = monthAgo.toISOString()
      }

      const logs = await communicationsService.getCallLogs(filters)
      setCallLogs(logs)
    } catch (error) {
      console.error('Error fetching call logs:', error)
      showToast.error('Failed to load call history')
    } finally {
      setCallsLoading(false)
      setLoading(false)
    }
  }

  const setupRealtimeSubscriptions = () => {
    // Subscribe to inbound calls
    const inboundSubscription = communicationsService.subscribeToInboundCalls((payload) => {
      const newCall = payload.new as CallLog
      if (newCall.direction === 'inbound' && newCall.status === 'ringing') {
        const activeInboundCall: ActiveCall = {
          id: newCall.id,
          contact_id: newCall.contact_id,
          phone_number: newCall.from_number || '',
          direction: 'inbound',
          status: 'ringing',
          started_at: newCall.created_at,
          provider_call_id: newCall.provider_id || ''
        }
        
        setInboundCalls(prev => [...prev, activeInboundCall])
        showToast.info(`Incoming call from ${communicationsService.formatPhoneNumber(newCall.from_number || '')}`)
        
        // Play notification sound (if available)
        playNotificationSound()
      }
    })

    return () => {
      inboundSubscription.unsubscribe()
    }
  }

  const playNotificationSound = () => {
    // Simple notification sound using Web Audio API
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.value = 800
      oscillator.type = 'sine'
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      
      oscillator.start()
      oscillator.stop(audioContext.currentTime + 0.2)
    } catch (error) {
      console.log('Audio notification not available')
    }
  }

  const handleAnswerCall = async (call: ActiveCall) => {
    const loadingToast = showToast.loading('Answering call...')
    
    try {
      await communicationsService.answerInboundCall(call.id)
      setActiveCall(call)
      setInboundCalls(prev => prev.filter(c => c.id !== call.id))
      
      showToast.dismiss(loadingToast)
      showToast.success('Call answered successfully')
    } catch (error) {
      console.error('Error answering call:', error)
      showToast.dismiss(loadingToast)
      showToast.error('Failed to answer call')
    }
  }

  const handleRejectCall = async (call: ActiveCall) => {
    const loadingToast = showToast.loading('Rejecting call...')
    
    try {
      await communicationsService.rejectInboundCall(call.id)
      setInboundCalls(prev => prev.filter(c => c.id !== call.id))
      
      showToast.dismiss(loadingToast)
      showToast.warning('Call rejected')
    } catch (error) {
      console.error('Error rejecting call:', error)
      showToast.dismiss(loadingToast)
      showToast.error('Failed to reject call')
    }
  }

  const handleHangupCall = async () => {
    if (!activeCall) return
    
    const loadingToast = showToast.loading('Ending call...')
    
    try {
      await communicationsService.hangupCall(activeCall.id)
      setActiveCall(null)
      fetchCallLogs() // Refresh call logs
      
      showToast.dismiss(loadingToast)
      showToast.success('Call ended')
    } catch (error) {
      console.error('Error ending call:', error)
      showToast.dismiss(loadingToast)
      showToast.error('Failed to end call')
    }
  }

  const handleMuteCall = async (muted: boolean) => {
    if (!activeCall) return
    
    try {
      await communicationsService.muteCall(activeCall.id, muted)
      setActiveCall(prev => prev ? { ...prev, muted } : null)
      showToast.success(muted ? 'Call muted' : 'Call unmuted')
    } catch (error) {
      console.error('Error muting call:', error)
      showToast.error('Failed to mute call')
    }
  }

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      'initiated': 'badge-light-info',
      'ringing': 'badge-light-warning',
      'answered': 'badge-light-primary',
      'completed': 'badge-light-success',
      'failed': 'badge-light-danger',
      'busy': 'badge-light-secondary',
      'no-answer': 'badge-light-secondary'
    }
    return `badge ${statusClasses[status as keyof typeof statusClasses] || 'badge-light-secondary'}`
  }

  const getCallStats = () => {
    const total = callLogs.length
    const answered = callLogs.filter(call => call.status === 'answered' || call.status === 'completed').length
    const missed = callLogs.filter(call => call.status === 'no-answer' || call.status === 'failed').length
    const avgDuration = callLogs
      .filter(call => call.duration)
      .reduce((sum, call) => sum + (call.duration || 0), 0) / Math.max(1, callLogs.filter(call => call.duration).length)

    return { total, answered, missed, avgDuration: Math.round(avgDuration) }
  }

  const stats = getCallStats()

  const renderTabContent = (): JSX.Element => {
    switch (activeTab) {
      case 'video':
        return (
          <div className='row g-5 g-xl-8'>
            <div className='col-xl-12'>
              <VideoMeetingInterface className='h-lg-500px' />
            </div>
          </div>
        )
      case 'sms':
        return (
          <div className='row g-5 g-xl-8'>
            <div className='col-xl-12'>
              <KTCard>
                <div className='card-header border-0 pt-5'>
                  <h3 className='card-title align-items-start flex-column'>
                    <span className='card-label fw-bold fs-3 mb-1'>SMS Center</span>
                    <span className='text-muted mt-1 fw-semibold fs-7'>Send and receive SMS messages</span>
                  </h3>
                </div>
                <KTCardBody className='py-3'>
                  <div className='text-center py-10'>
                    <div className='text-muted mb-3'>
                      <i className='ki-duotone ki-message-text-2 fs-3x text-muted mb-3'></i>
                    </div>
                    <div className='text-muted'>
                      SMS functionality is available on contact detail pages. Navigate to a contact to start messaging.
                    </div>
                  </div>
                </KTCardBody>
              </KTCard>
            </div>
          </div>
        )
      case 'voicemail':
        return (
          <div className='row g-5 g-xl-8'>
            <div className='col-xl-12'>
              <VoicemailInbox />
            </div>
          </div>
        )
      default:
        return (
          <>
            {/* Stats Cards */}
            <div className='row g-5 g-xl-8 mb-5'>
              {loading ? (
                <>
                  <div className='col-xl-3'><StatCardSkeleton /></div>
                  <div className='col-xl-3'><StatCardSkeleton /></div>
                  <div className='col-xl-3'><StatCardSkeleton /></div>
                  <div className='col-xl-3'><StatCardSkeleton /></div>
                </>
              ) : (
                <>
                  <div className='col-xl-3'>
                    <div className='card card-bordered'>
                      <div className='card-body'>
                        <div className='d-flex align-items-center'>
                          <div className='symbol symbol-50px me-5'>
                            <span className='symbol-label bg-light-primary'>
                              <i className='ki-duotone ki-phone fs-2x text-primary'></i>
                            </span>
                          </div>
                          <div className='d-flex flex-column'>
                            <span className='fw-bold fs-6 text-gray-800'>{stats.total}</span>
                            <span className='fw-semibold fs-7 text-gray-400'>Total Calls</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className='col-xl-3'>
                    <div className='card card-bordered'>
                      <div className='card-body'>
                        <div className='d-flex align-items-center'>
                          <div className='symbol symbol-50px me-5'>
                            <span className='symbol-label bg-light-success'>
                              <i className='ki-duotone ki-check fs-2x text-success'></i>
                            </span>
                          </div>
                          <div className='d-flex flex-column'>
                            <span className='fw-bold fs-6 text-gray-800'>{stats.answered}</span>
                            <span className='fw-semibold fs-7 text-gray-400'>Answered</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className='col-xl-3'>
                    <div className='card card-bordered'>
                      <div className='card-body'>
                        <div className='d-flex align-items-center'>
                          <div className='symbol symbol-50px me-5'>
                            <span className='symbol-label bg-light-danger'>
                              <i className='ki-duotone ki-cross fs-2x text-danger'></i>
                            </span>
                          </div>
                          <div className='d-flex flex-column'>
                            <span className='fw-bold fs-6 text-gray-800'>{stats.missed}</span>
                            <span className='fw-semibold fs-7 text-gray-400'>Missed</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className='col-xl-3'>
                    <div className='card card-bordered'>
                      <div className='card-body'>
                        <div className='d-flex align-items-center'>
                          <div className='symbol symbol-50px me-5'>
                            <span className='symbol-label bg-light-info'>
                              <i className='ki-duotone ki-time fs-2x text-info'></i>
                            </span>
                          </div>
                          <div className='d-flex flex-column'>
                            <span className='fw-bold fs-6 text-gray-800'>{stats.avgDuration}s</span>
                            <span className='fw-semibold fs-7 text-gray-400'>Avg Duration</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Call History and Voicemail */}
            <div className='row g-5 g-xl-8'>
              <div className='col-xl-8'>
                <KTCard>
                  <div className='card-header border-0 pt-5'>
                    <h3 className='card-title align-items-start flex-column'>
                      <span className='card-label fw-bold fs-3 mb-1'>Call History</span>
                      <span className='text-muted mt-1 fw-semibold fs-7'>View and manage your call logs</span>
                    </h3>
                    <div className='card-toolbar'>
                      <div className='d-flex justify-content-end align-items-center gap-3'>
                        <select
                          className='form-select form-select-solid form-select-sm w-150px'
                          value={dateFilter}
                          onChange={(e) => setDateFilter(e.target.value)}
                        >
                          <option value='today'>Today</option>
                          <option value='week'>This Week</option>
                          <option value='month'>This Month</option>
                          <option value='all'>All Time</option>
                        </select>
                        <select
                          className='form-select form-select-solid form-select-sm w-150px'
                          value={directionFilter}
                          onChange={(e) => setDirectionFilter(e.target.value)}
                        >
                          <option value='all'>All Calls</option>
                          <option value='inbound'>Inbound</option>
                          <option value='outbound'>Outbound</option>
                        </select>
                        <select
                          className='form-select form-select-solid form-select-sm w-150px'
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                        >
                          <option value='all'>All Status</option>
                          <option value='completed'>Completed</option>
                          <option value='answered'>Answered</option>
                          <option value='failed'>Failed</option>
                          <option value='no-answer'>No Answer</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <KTCardBody className='py-3'>
                    {callsLoading ? (
                      <TableSkeleton rows={5} columns={7} />
                    ) : callLogs.length === 0 ? (
                      <div className='text-center py-10'>
                        <div className='text-muted mb-3'>
                          <i className='ki-duotone ki-phone fs-3x text-muted mb-3'></i>
                        </div>
                        <div className='text-muted'>
                          No call history found. Start making or receiving calls to see your call logs here.
                        </div>
                      </div>
                    ) : (
                      <div className='table-responsive'>
                        <table className='table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4'>
                          <thead>
                            <tr className='fw-bold text-muted'>
                              <th className='min-w-120px'>Direction</th>
                              <th className='min-w-150px'>Contact</th>
                              <th className='min-w-120px'>Phone Number</th>
                              <th className='min-w-120px'>Status</th>
                              <th className='min-w-100px'>Duration</th>
                              <th className='min-w-120px'>Date/Time</th>
                              <th className='min-w-100px text-end'>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {callLogs.map((call) => (
                              <tr key={call.id}>
                                <td>
                                  <div className='d-flex align-items-center'>
                                    <i className={`ki-duotone ${call.direction === 'inbound' ? 'ki-call-received' : 'ki-call-made'} fs-2 me-2 ${call.direction === 'inbound' ? 'text-success' : 'text-primary'}`}></i>
                                    <span className='fw-bold fs-6'>
                                      {call.direction === 'inbound' ? 'Inbound' : 'Outbound'}
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  <div className='d-flex flex-column'>
                                    <span className='text-dark fw-bold fs-6'>
                                      {(call as any).contact?.first_name && (call as any).contact?.last_name
                                        ? `${(call as any).contact.first_name} ${(call as any).contact.last_name}`
                                        : 'Unknown Contact'
                                      }
                                    </span>
                                    {(call as any).contact?.account?.name && (
                                      <span className='text-muted fw-semibold fs-7'>{(call as any).contact.account.name}</span>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <span className='text-dark fw-bold fs-6'>
                                    {communicationsService.formatPhoneNumber(
                                      call.direction === 'inbound' ? (call.from_number || '') : (call.to_number || '')
                                    )}
                                  </span>
                                </td>
                                <td>
                                  <span className={getStatusBadge(call.status || '')}>
                                    {call.status}
                                  </span>
                                </td>
                                <td>
                                  <span className='text-dark fw-bold fs-6'>
                                    {call.duration ? `${call.duration}s` : '-'}
                                  </span>
                                </td>
                                <td>
                                  <div className='d-flex flex-column'>
                                    <span className='text-dark fw-bold fs-6'>
                                      {new Date(call.created_at).toLocaleDateString()}
                                    </span>
                                    <span className='text-muted fw-semibold fs-7'>
                                      {new Date(call.created_at).toLocaleTimeString()}
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  <div className='d-flex justify-content-end'>
                                    <button
                                      className='btn btn-icon btn-bg-light btn-active-color-primary btn-sm'
                                      title='Call Back'
                                      onClick={() => {
                                        const phoneNumber = call.direction === 'inbound' ? call.from_number : call.to_number
                                        if (call.contact_id) {
                                          // Use the click-to-call functionality
                                          showToast.info('Call back functionality will be integrated with click-to-call')
                                        }
                                      }}
                                    >
                                      <i className='ki-duotone ki-phone fs-3'></i>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </KTCardBody>
                </KTCard>
              </div>
              
              {/* Voicemail Inbox */}
              <div className='col-xl-4'>
                <VoicemailInbox />
              </div>
            </div>
          </>
        )
    }
  }

  return (
    <>
      <PageTitle breadcrumbs={[]}>Communications Hub</PageTitle>

      {/* Navigation Tabs */}
      <div className='row g-5 g-xl-8 mb-5'>
        <div className='col-xl-12'>
          <KTCard>
            <KTCardBody className='py-3'>
              <ul className='nav nav-tabs nav-line-tabs mb-5 fs-6'>
                <li className='nav-item'>
                  <a
                    className={`nav-link ${activeTab === 'call-center' ? 'active' : ''}`}
                    onClick={() => setActiveTab('call-center')}
                    style={{ cursor: 'pointer' }}
                  >
                    <i className='ki-duotone ki-phone fs-2 me-2'></i>
                    Call Center
                  </a>
                </li>
                <li className='nav-item'>
                  <a
                    className={`nav-link ${activeTab === 'video' ? 'active' : ''}`}
                    onClick={() => setActiveTab('video')}
                    style={{ cursor: 'pointer' }}
                  >
                    <i className='ki-duotone ki-video fs-2 me-2'></i>
                    Video Meetings
                  </a>
                </li>
                <li className='nav-item'>
                  <a
                    className={`nav-link ${activeTab === 'sms' ? 'active' : ''}`}
                    onClick={() => setActiveTab('sms')}
                    style={{ cursor: 'pointer' }}
                  >
                    <i className='ki-duotone ki-message-text-2 fs-2 me-2'></i>
                    SMS Center
                  </a>
                </li>
                <li className='nav-item'>
                  <a
                    className={`nav-link ${activeTab === 'voicemail' ? 'active' : ''}`}
                    onClick={() => setActiveTab('voicemail')}
                    style={{ cursor: 'pointer' }}
                  >
                    <i className='ki-duotone ki-microphone fs-2 me-2'></i>
                    Voicemail
                  </a>
                </li>
                <li className='nav-item'>
                  <a
                    className='nav-link'
                    href='/app/communications'
                    style={{ cursor: 'pointer' }}
                  >
                    <i className='ki-duotone ki-robot fs-2 me-2'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                    </i>
                    AI Features
                    <i className='ki-duotone ki-exit-right-corner fs-3 ms-1'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                    </i>
                  </a>
                </li>
              </ul>
            </KTCardBody>
          </KTCard>
        </div>
      </div>

      {/* Inbound Call Notifications */}
      {inboundCalls.length > 0 && (
        <div className='row g-5 g-xl-8 mb-5'>
          <div className='col-xl-12'>
            {inboundCalls.map((call) => (
              <div key={call.id} className='alert alert-primary d-flex align-items-center p-5 mb-3'>
                <div className='d-flex flex-column flex-grow-1'>
                  <div className='d-flex align-items-center mb-2'>
                    <i className='ki-duotone ki-phone fs-2x text-primary me-3'></i>
                    <div>
                      <h4 className='mb-1'>Incoming Call</h4>
                      <p className='mb-0'>
                        From: {communicationsService.formatPhoneNumber(call.phone_number)}
                        {call.contact_name && ` (${call.contact_name})`}
                      </p>
                    </div>
                  </div>
                </div>
                <div className='d-flex gap-2'>
                  <button
                    className='btn btn-success'
                    onClick={() => handleAnswerCall(call)}
                  >
                    <i className='ki-duotone ki-check fs-2'></i>
                    Answer
                  </button>
                  <button
                    className='btn btn-danger'
                    onClick={() => handleRejectCall(call)}
                  >
                    <i className='ki-duotone ki-cross fs-2'></i>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Call Controls */}
      {activeCall && (
        <div className='row g-5 g-xl-8 mb-5'>
          <div className='col-xl-12'>
            <div className='alert alert-success d-flex align-items-center p-5'>
              <div className='d-flex flex-column flex-grow-1'>
                <div className='d-flex align-items-center mb-2'>
                  <i className='ki-duotone ki-phone fs-2x text-success me-3'></i>
                  <div>
                    <h4 className='mb-1'>Active Call</h4>
                    <p className='mb-0'>
                      {activeCall.direction === 'inbound' ? 'From' : 'To'}: {communicationsService.formatPhoneNumber(activeCall.phone_number)}
                      {activeCall.contact_name && ` (${activeCall.contact_name})`}
                    </p>
                  </div>
                </div>
              </div>
              <div className='d-flex gap-2'>
                <button
                  className={`btn ${(activeCall as any).muted ? 'btn-warning' : 'btn-light'}`}
                  onClick={() => handleMuteCall(!(activeCall as any).muted)}
                >
                  <i className={`ki-duotone ${(activeCall as any).muted ? 'ki-volume-slash' : 'ki-volume-up'} fs-2`}></i>
                  {(activeCall as any).muted ? 'Unmute' : 'Mute'}
                </button>
                <button
                  className='btn btn-danger'
                  onClick={handleHangupCall}
                >
                  <i className='ki-duotone ki-phone fs-2'></i>
                  Hang Up
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content */}
      {renderTabContent()}
    </>
  )
}

export default CallCenterPage
