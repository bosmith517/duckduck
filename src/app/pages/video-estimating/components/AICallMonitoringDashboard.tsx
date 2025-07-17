import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../../supabaseClient'
import { useSupabaseAuth } from '../../../modules/auth/core/SupabaseAuth'
import { showToast } from '../../../utils/toast'
import { VideoSession } from '../VideoEstimatingHub'

interface MonitoringSession extends VideoSession {
  ai_status?: 'active' | 'inactive' | 'error'
  customer_connected?: boolean
  current_phase?: string
  issues_captured?: number
  elapsed_time?: number
}

export const AICallMonitoringDashboard: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  const [activeSessions, setActiveSessions] = useState<MonitoringSession[]>([])
  const [selectedSession, setSelectedSession] = useState<MonitoringSession | null>(null)
  const [visionResults, setVisionResults] = useState<any[]>([])
  const [sessionTranscript, setSessionTranscript] = useState<any[]>([])
  const [isInterveningMode, setIsInterveningMode] = useState(false)
  const [stats, setStats] = useState({
    activeCalls: 0,
    averageDuration: 0,
    issuesPerCall: 0,
    aiSuccessRate: 0
  })

  const updateIntervalRef = useRef<NodeJS.Timeout>()
  const realtimeChannelRef = useRef<any>()

  useEffect(() => {
    if (userProfile?.tenant_id) {
      loadActiveSessions()
      subscribeToRealtimeUpdates()
      
      // Update every 5 seconds
      updateIntervalRef.current = setInterval(() => {
        loadActiveSessions()
      }, 5000)
    }

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current)
      }
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current)
      }
    }
  }, [userProfile?.tenant_id])

  const loadActiveSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('video_sessions')
        .select(`
          *,
          leads(name, phone_number),
          contacts(first_name, last_name, phone),
          accounts(name, phone),
          vision_results(count)
        `)
        .eq('tenant_id', userProfile?.tenant_id)
        .eq('status', 'active')
        .order('started_at', { ascending: false })

      if (error) throw error

      // Enhance with real-time data
      const enhanced = (data || []).map(session => ({
        ...session,
        ai_status: session.metadata?.ai_agent_connected ? 'active' : 'inactive',
        customer_connected: session.metadata?.customer_connected || false,
        current_phase: session.metadata?.current_phase || 'waiting',
        issues_captured: session.vision_results?.[0]?.count || 0,
        elapsed_time: session.started_at ? 
          Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000) : 0
      }))

      setActiveSessions(enhanced)
      
      // Update stats
      setStats({
        activeCalls: enhanced.length,
        averageDuration: enhanced.reduce((acc, s) => acc + (s.elapsed_time || 0), 0) / (enhanced.length || 1),
        issuesPerCall: enhanced.reduce((acc, s) => acc + (s.issues_captured || 0), 0) / (enhanced.length || 1),
        aiSuccessRate: enhanced.filter(s => s.ai_status === 'active').length / (enhanced.length || 1) * 100
      })
    } catch (error) {
      console.error('Error loading active sessions:', error)
    }
  }

  const subscribeToRealtimeUpdates = () => {
    realtimeChannelRef.current = supabase
      .channel('monitoring-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'video_sessions',
          filter: `tenant_id=eq.${userProfile?.tenant_id}`
        },
        (payload) => {
          console.log('Session update:', payload)
          loadActiveSessions()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'vision_results'
        },
        (payload) => {
          console.log('New vision result:', payload)
          if (selectedSession && payload.new.session_id === selectedSession.id) {
            setVisionResults(prev => [payload.new, ...prev])
          }
        }
      )
      .subscribe()
  }

  const selectSession = async (session: MonitoringSession) => {
    setSelectedSession(session)
    
    // Load vision results for this session
    const { data: results } = await supabase
      .from('vision_results')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at', { ascending: false })
      .limit(50)

    setVisionResults(results || [])

    // Load transcript/events
    const { data: events } = await supabase
      .from('session_events')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at', { ascending: false })
      .limit(100)

    setSessionTranscript(events || [])
  }

  const interveneInSession = async () => {
    if (!selectedSession) return

    try {
      setIsInterveningMode(true)
      
      // Request to join the session as a supervisor
      const { data, error } = await supabase.functions.invoke('join-session-as-supervisor', {
        body: {
          session_id: selectedSession.id,
          room_id: selectedSession.room_id,
          mode: 'observe' // or 'assist' to actively participate
        }
      })

      if (error) throw error

      showToast.success('Joined session as supervisor')
      
      // Open video interface in new window or modal
      window.open(
        `/supervisor/video-session/${selectedSession.id}?token=${data.token}`,
        'supervisor-video',
        'width=1200,height=800'
      )
    } catch (error) {
      console.error('Error intervening:', error)
      showToast.error('Failed to join session')
    } finally {
      setIsInterveningMode(false)
    }
  }

  const terminateAI = async (sessionId: string) => {
    try {
      const { error } = await supabase.functions.invoke('control-ai-agent', {
        body: {
          session_id: sessionId,
          action: 'terminate'
        }
      })

      if (error) throw error
      showToast.success('AI agent terminated')
      loadActiveSessions()
    } catch (error) {
      console.error('Error terminating AI:', error)
      showToast.error('Failed to terminate AI')
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="row g-5">
      {/* Stats Overview */}
      <div className="col-12">
        <div className="row g-5">
          <div className="col-md-3">
            <div className="card">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <div className="symbol symbol-50px me-3">
                    <div className="symbol-label bg-light-success">
                      <i className="ki-duotone ki-call fs-2x text-success">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                    </div>
                  </div>
                  <div>
                    <div className="fs-2 fw-bold">{stats.activeCalls}</div>
                    <div className="text-muted">Active Calls</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="col-md-3">
            <div className="card">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <div className="symbol symbol-50px me-3">
                    <div className="symbol-label bg-light-primary">
                      <i className="ki-duotone ki-time fs-2x text-primary">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                    </div>
                  </div>
                  <div>
                    <div className="fs-2 fw-bold">{formatDuration(Math.round(stats.averageDuration))}</div>
                    <div className="text-muted">Avg Duration</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="col-md-3">
            <div className="card">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <div className="symbol symbol-50px me-3">
                    <div className="symbol-label bg-light-warning">
                      <i className="ki-duotone ki-magnifier fs-2x text-warning">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                    </div>
                  </div>
                  <div>
                    <div className="fs-2 fw-bold">{stats.issuesPerCall.toFixed(1)}</div>
                    <div className="text-muted">Issues/Call</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="col-md-3">
            <div className="card">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <div className="symbol symbol-50px me-3">
                    <div className="symbol-label bg-light-info">
                      <i className="ki-duotone ki-percentage fs-2x text-info">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                    </div>
                  </div>
                  <div>
                    <div className="fs-2 fw-bold">{stats.aiSuccessRate.toFixed(0)}%</div>
                    <div className="text-muted">AI Success</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Sessions List */}
      <div className="col-md-5">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Active AI Estimation Sessions</h3>
            <div className="card-toolbar">
              <button 
                className="btn btn-sm btn-light-primary"
                onClick={loadActiveSessions}
              >
                <i className="ki-duotone ki-arrows-circle fs-6">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                Refresh
              </button>
            </div>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4">
                <thead>
                  <tr className="fw-bold text-muted">
                    <th>Customer</th>
                    <th>Trade</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSessions.map((session) => (
                    <tr 
                      key={session.id}
                      className={selectedSession?.id === session.id ? 'bg-light-primary' : ''}
                      style={{ cursor: 'pointer' }}
                      onClick={() => selectSession(session)}
                    >
                      <td>
                        <div className="d-flex align-items-center">
                          <div className="symbol symbol-circle symbol-30px me-3">
                            <span className={`symbol-label bg-${
                              session.customer_connected ? 'success' : 'warning'
                            }`}>
                              <i className="ki-duotone ki-user fs-6 text-white">
                                <span className="path1"></span>
                                <span className="path2"></span>
                              </i>
                            </span>
                          </div>
                          <div className="d-flex flex-column">
                            <span className="text-gray-800 fw-bold">
                              {session.contacts?.first_name || session.leads?.name || 'Unknown'}
                            </span>
                            <span className="text-muted fs-7">
                              {session.current_phase || 'Waiting'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-light-primary">
                          {session.trade_type}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <div className={`bullet bullet-dot bg-${
                            session.ai_status === 'active' ? 'success' : 
                            session.ai_status === 'error' ? 'danger' : 'warning'
                          } me-2`}></div>
                          <span className="text-muted fs-7">
                            AI {session.ai_status || 'unknown'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="text-dark fw-bold">
                          {formatDuration(session.elapsed_time || 0)}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-light-danger"
                          onClick={(e) => {
                            e.stopPropagation()
                            terminateAI(session.id)
                          }}
                          title="Terminate AI"
                        >
                          <i className="ki-duotone ki-cross fs-6">
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {activeSessions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-5">
                        No active AI estimation sessions
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Session Details */}
      <div className="col-md-7">
        {selectedSession ? (
          <>
            {/* Session Info Card */}
            <div className="card mb-5">
              <div className="card-header">
                <h3 className="card-title">
                  Session Details - {selectedSession.room_id}
                </h3>
                <div className="card-toolbar">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={interveneInSession}
                    disabled={isInterveningMode}
                  >
                    <i className="ki-duotone ki-screen fs-6 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    Monitor Live
                  </button>
                </div>
              </div>
              <div className="card-body">
                <div className="row g-5">
                  <div className="col-md-6">
                    <div className="d-flex flex-column mb-5">
                      <span className="text-muted mb-2">Customer</span>
                      <span className="text-dark fw-bold">
                        {selectedSession.contacts?.first_name} {selectedSession.contacts?.last_name ||
                          selectedSession.leads?.name || 'Unknown'}
                      </span>
                    </div>
                    <div className="d-flex flex-column">
                      <span className="text-muted mb-2">Contact</span>
                      <span className="text-dark">
                        {selectedSession.contacts?.phone || selectedSession.leads?.phone_number || 'N/A'}
                      </span>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="d-flex flex-column mb-5">
                      <span className="text-muted mb-2">AI Performance</span>
                      <div className="d-flex align-items-center">
                        <div className="progress flex-grow-1 me-3" style={{ height: '8px' }}>
                          <div 
                            className="progress-bar bg-success" 
                            role="progressbar" 
                            style={{ width: `${(selectedSession.issues_captured || 0) * 10}%` }}
                          ></div>
                        </div>
                        <span className="text-dark fw-bold">
                          {selectedSession.issues_captured || 0} issues
                        </span>
                      </div>
                    </div>
                    <div className="d-flex flex-column">
                      <span className="text-muted mb-2">Phase Progress</span>
                      <span className="badge badge-light-primary">
                        {selectedSession.current_phase || 'Initial'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Vision Results */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">AI Vision Analysis</h3>
                <div className="card-toolbar">
                  <span className="badge badge-light-success">
                    {visionResults.length} captures
                  </span>
                </div>
              </div>
              <div className="card-body">
                <div className="scroll-y mh-350px">
                  {visionResults.map((result, index) => (
                    <div key={result.id} className="d-flex mb-5">
                      <div className="symbol symbol-60px symbol-2by3 me-4">
                        {result.frame_url && (
                          <img 
                            src={result.frame_url} 
                            alt={`Capture ${index + 1}`}
                            className="rounded"
                          />
                        )}
                      </div>
                      <div className="flex-grow-1">
                        <div className="d-flex justify-content-between mb-2">
                          <span className="text-dark fw-bold">
                            {result.analysis_type || 'General Analysis'}
                          </span>
                          <span className="text-muted fs-7">
                            {new Date(result.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-gray-600 mb-2">
                          {result.description}
                        </p>
                        {result.metadata?.severity && (
                          <span className={`badge badge-${
                            result.metadata.severity === 'critical' ? 'danger' :
                            result.metadata.severity === 'major' ? 'warning' :
                            'info'
                          }`}>
                            {result.metadata.severity}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {visionResults.length === 0 && (
                    <div className="text-center text-muted py-10">
                      No vision analysis results yet
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="card">
            <div className="card-body text-center py-10">
              <i className="ki-duotone ki-monitor-mobile fs-5x text-muted mb-5">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              <h3 className="text-muted">Select a session to view details</h3>
              <p className="text-muted">
                Click on any active session from the list to monitor AI performance and customer interaction
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}