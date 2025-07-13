import React, { useState, useEffect } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'
import { VideoSessionList } from './components/VideoSessionList'
import { CreateSessionModal } from './components/CreateSessionModal'
import { ActiveSessionView } from './components/ActiveSessionView'
import { EstimateReviewModal } from './components/EstimateReviewModal'

export interface VideoSession {
  id: string
  tenant_id: string
  lead_id?: string
  contact_id?: string
  account_id?: string
  trade_type: 'ROOFING' | 'PLUMBING' | 'HVAC' | 'ELECTRICAL'
  room_id: string
  room_url?: string
  status: 'scheduled' | 'active' | 'completed' | 'cancelled'
  scheduled_at?: string
  started_at?: string
  ended_at?: string
  estimate_id?: string
  vision_results?: any[]
  metadata?: any
  created_at: string
  updated_at: string
  // Related data from joins
  accounts?: { id: string; name: string; phone?: string; email?: string }
  contacts?: { id: string; first_name?: string; last_name?: string; phone?: string; email?: string }
  leads?: { id: string; name: string; phone_number?: string; email?: string }
  estimates?: { id: string; estimate_number: string; total_amount: number; status: string }
}

const VideoEstimatingHub: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  const [sessions, setSessions] = useState<VideoSession[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [activeSession, setActiveSession] = useState<VideoSession | null>(null)
  const [reviewingSession, setReviewingSession] = useState<VideoSession | null>(null)
  const [stats, setStats] = useState({
    totalSessions: 0,
    completedSessions: 0,
    averageDuration: 0,
    estimatesGenerated: 0
  })

  useEffect(() => {
    if (userProfile?.tenant_id) {
      loadSessions()
      loadStats()
      subscribeToUpdates()
    }
  }, [userProfile?.tenant_id])

  const loadSessions = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('video_sessions')
        .select(`
          *,
          leads(id, name, phone_number, email),
          contacts(id, first_name, last_name, phone, email),
          accounts(id, name, phone, email),
          estimates(id, estimate_number, total_amount, status)
        `)
        .eq('tenant_id', userProfile?.tenant_id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setSessions(data || [])
    } catch (error) {
      console.error('Error loading video sessions:', error)
      showToast.error('Failed to load video sessions')
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_video_estimating_stats', {
          p_tenant_id: userProfile?.tenant_id
        })

      if (error) throw error
      if (data && data[0]) {
        setStats(data[0])
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const subscribeToUpdates = () => {
    const subscription = supabase
      .channel('video_sessions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'video_sessions',
          filter: `tenant_id=eq.${userProfile?.tenant_id}`
        },
        () => {
          loadSessions()
          loadStats()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }

  const handleCreateSession = async (sessionData: any) => {
    try {
      // This will be implemented to create SignalWire room and save session
      showToast.success('Video estimating session created')
      setShowCreateModal(false)
      loadSessions()
    } catch (error) {
      console.error('Error creating session:', error)
      showToast.error('Failed to create session')
    }
  }

  const handleStartSession = (session: VideoSession) => {
    setActiveSession(session)
  }

  const handleEndSession = () => {
    setActiveSession(null)
    loadSessions()
  }

  const handleReviewEstimate = (session: VideoSession) => {
    setReviewingSession(session)
  }

  if (activeSession) {
    return (
      <ActiveSessionView
        session={activeSession}
        onEnd={handleEndSession}
      />
    )
  }

  return (
    <>
      <PageTitle breadcrumbs={[]}>AI-Powered Video Estimating</PageTitle>

      {/* Stats Cards */}
      <div className='row g-5 g-xl-8 mb-5'>
        <div className='col-xl-3'>
          <KTCard className='card-flush'>
            <KTCardBody className='d-flex flex-column'>
              <span className='fs-2hx fw-bold text-dark me-2 lh-1 ls-n2'>
                {stats.totalSessions}
              </span>
              <span className='text-gray-400 pt-1 fw-semibold fs-6'>
                Total Sessions
              </span>
            </KTCardBody>
          </KTCard>
        </div>

        <div className='col-xl-3'>
          <KTCard className='card-flush'>
            <KTCardBody className='d-flex flex-column'>
              <span className='fs-2hx fw-bold text-dark me-2 lh-1 ls-n2'>
                {stats.completedSessions}
              </span>
              <span className='text-gray-400 pt-1 fw-semibold fs-6'>
                Completed
              </span>
            </KTCardBody>
          </KTCard>
        </div>

        <div className='col-xl-3'>
          <KTCard className='card-flush'>
            <KTCardBody className='d-flex flex-column'>
              <span className='fs-2hx fw-bold text-dark me-2 lh-1 ls-n2'>
                {stats.averageDuration}m
              </span>
              <span className='text-gray-400 pt-1 fw-semibold fs-6'>
                Avg Duration
              </span>
            </KTCardBody>
          </KTCard>
        </div>

        <div className='col-xl-3'>
          <KTCard className='card-flush'>
            <KTCardBody className='d-flex flex-column'>
              <span className='fs-2hx fw-bold text-dark me-2 lh-1 ls-n2'>
                {stats.estimatesGenerated}
              </span>
              <span className='text-gray-400 pt-1 fw-semibold fs-6'>
                Estimates Generated
              </span>
            </KTCardBody>
          </KTCard>
        </div>
      </div>

      {/* Sessions List */}
      <div className='row g-5 g-xl-8'>
        <div className='col-xl-12'>
          <KTCard>
            <div className='card-header border-0 pt-5'>
              <h3 className='card-title align-items-start flex-column'>
                <span className='card-label fw-bold fs-3 mb-1'>Video Estimating Sessions</span>
                <span className='text-muted mt-1 fw-semibold fs-7'>
                  Guided video calls with AI-powered analysis
                </span>
              </h3>
              <div className='card-toolbar'>
                <button
                  className='btn btn-sm btn-primary'
                  onClick={() => setShowCreateModal(true)}
                >
                  <i className='ki-duotone ki-plus fs-2'></i>
                  New Session
                </button>
              </div>
            </div>
            <KTCardBody className='py-3'>
              <VideoSessionList
                sessions={sessions}
                loading={loading}
                onStart={handleStartSession}
                onReview={handleReviewEstimate}
              />
            </KTCardBody>
          </KTCard>
        </div>
      </div>

      {/* Create Session Modal */}
      {showCreateModal && (
        <CreateSessionModal
          onSave={handleCreateSession}
          onCancel={() => setShowCreateModal(false)}
        />
      )}

      {/* Estimate Review Modal */}
      {reviewingSession && (
        <EstimateReviewModal
          session={reviewingSession}
          onClose={() => setReviewingSession(null)}
          onSave={() => {
            setReviewingSession(null)
            loadSessions()
          }}
        />
      )}
    </>
  )
}

export default VideoEstimatingHub