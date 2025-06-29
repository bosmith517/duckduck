import React, { useState, useEffect } from 'react'
import { KTIcon } from '../../../_metronic/helpers'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import AIPostCallActions from './AIPostCallActions'

interface CallTranscript {
  id: string
  call_id: string
  created_at: string
  duration: number
  from_number: string
  to_number: string
  transcript_text?: string
  transcript: {
    segments: Array<{
      speaker: 'customer' | 'agent' | 'ai'
      text: string
      timestamp: number
      sentiment: 'positive' | 'neutral' | 'negative'
      confidence: number
    }>
  }
  summary: {
    overview: string
    action_items: string[]
    topics: string[]
    customer_sentiment: 'satisfied' | 'neutral' | 'frustrated'
    resolution_status: 'resolved' | 'pending' | 'escalated'
  }
  analytics: {
    talk_time_ratio: {
      customer: number
      agent: number
    }
    keywords: Array<{ word: string; count: number }>
    interruptions: number
    silence_duration: number
    sentiment_timeline: Array<{ time: number; sentiment: number }>
  }
}

export const AICallAnalytics: React.FC = () => {
  const { tenant } = useSupabaseAuth()
  const [transcripts, setTranscripts] = useState<CallTranscript[]>([])
  const [selectedTranscript, setSelectedTranscript] = useState<CallTranscript | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [searchTerm, setSearchTerm] = useState('')
  const [sentimentFilter, setSentimentFilter] = useState<string>('all')

  useEffect(() => {
    fetchTranscripts()
  }, [tenant?.id])

  const fetchTranscripts = async () => {
    if (!tenant?.id) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('call_transcripts')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      // For demo purposes, generate sample data if none exists
      if (!data || data.length === 0) {
        setTranscripts(generateSampleTranscripts())
      } else {
        setTranscripts(data)
      }
    } catch (error) {
      console.error('Error fetching transcripts:', error)
      // Use sample data for demo
      setTranscripts(generateSampleTranscripts())
    } finally {
      setLoading(false)
    }
  }

  const generateSampleTranscripts = (): CallTranscript[] => {
    return [
      {
        id: '1',
        call_id: 'call_123',
        created_at: new Date().toISOString(),
        duration: 245,
        from_number: '+1234567890',
        to_number: '+0987654321',
        transcript_text: 'Thank you for calling TradeWorks Pro. How can I help you today? Hi, I need to schedule an HVAC inspection for my home. I\'d be happy to help you schedule an HVAC inspection. What\'s your preferred date and time? Do you have anything available this Friday afternoon? Let me check our availability. Yes, we have openings at 2 PM and 4 PM this Friday. Which would work better for you? The 2 PM slot would be perfect!',
        transcript: {
          segments: [
            {
              speaker: 'ai',
              text: 'Thank you for calling TradeWorks Pro. How can I help you today?',
              timestamp: 0,
              sentiment: 'positive',
              confidence: 0.95
            },
            {
              speaker: 'customer',
              text: 'Hi, I need to schedule an HVAC inspection for my home.',
              timestamp: 3,
              sentiment: 'neutral',
              confidence: 0.88
            },
            {
              speaker: 'ai',
              text: 'I\'d be happy to help you schedule an HVAC inspection. What\'s your preferred date and time?',
              timestamp: 8,
              sentiment: 'positive',
              confidence: 0.92
            },
            {
              speaker: 'customer',
              text: 'Do you have anything available this Friday afternoon?',
              timestamp: 15,
              sentiment: 'neutral',
              confidence: 0.85
            },
            {
              speaker: 'ai',
              text: 'Let me check our availability. Yes, we have openings at 2 PM and 4 PM this Friday. Which would work better for you?',
              timestamp: 20,
              sentiment: 'positive',
              confidence: 0.90
            },
            {
              speaker: 'customer',
              text: 'The 2 PM slot would be perfect!',
              timestamp: 28,
              sentiment: 'positive',
              confidence: 0.94
            }
          ]
        },
        summary: {
          overview: 'Customer called to schedule an HVAC inspection. Successfully booked for Friday at 2 PM.',
          action_items: ['HVAC inspection scheduled for Friday 2 PM', 'Send confirmation email to customer'],
          topics: ['HVAC', 'Inspection', 'Scheduling'],
          customer_sentiment: 'satisfied',
          resolution_status: 'resolved'
        },
        analytics: {
          talk_time_ratio: {
            customer: 35,
            agent: 65
          },
          keywords: [
            { word: 'HVAC', count: 3 },
            { word: 'inspection', count: 2 },
            { word: 'Friday', count: 2 },
            { word: 'schedule', count: 2 }
          ],
          interruptions: 0,
          silence_duration: 12,
          sentiment_timeline: [
            { time: 0, sentiment: 0.7 },
            { time: 30, sentiment: 0.8 },
            { time: 60, sentiment: 0.9 }
          ]
        }
      },
      {
        id: '2',
        call_id: 'call_124',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        duration: 180,
        from_number: '+1234567891',
        to_number: '+0987654321',
        transcript_text: 'My AC stopped working and it\'s really hot. This is an emergency! I understand this is urgent. Let me connect you with our emergency service team right away.',
        transcript: {
          segments: [
            {
              speaker: 'customer',
              text: 'My AC stopped working and it\'s really hot. This is an emergency!',
              timestamp: 0,
              sentiment: 'negative',
              confidence: 0.95
            },
            {
              speaker: 'ai',
              text: 'I understand this is urgent. Let me connect you with our emergency service team right away.',
              timestamp: 5,
              sentiment: 'positive',
              confidence: 0.93
            }
          ]
        },
        summary: {
          overview: 'Emergency AC repair request. Call transferred to emergency team.',
          action_items: ['Emergency AC repair dispatched'],
          topics: ['AC Repair', 'Emergency', 'HVAC'],
          customer_sentiment: 'frustrated',
          resolution_status: 'escalated'
        },
        analytics: {
          talk_time_ratio: {
            customer: 60,
            agent: 40
          },
          keywords: [
            { word: 'emergency', count: 2 },
            { word: 'AC', count: 3 },
            { word: 'hot', count: 1 }
          ],
          interruptions: 1,
          silence_duration: 5,
          sentiment_timeline: [
            { time: 0, sentiment: 0.2 },
            { time: 30, sentiment: 0.5 }
          ]
        }
      }
    ]
  }

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
      case 'satisfied':
        return 'success'
      case 'negative':
      case 'frustrated':
        return 'danger'
      default:
        return 'warning'
    }
  }

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
      case 'satisfied':
        return 'smile'
      case 'negative':
      case 'frustrated':
        return 'dislike'
      default:
        return 'minus'
    }
  }

  const filteredTranscripts = transcripts.filter(transcript => {
    const matchesSearch = searchTerm === '' || 
      transcript.transcript.segments.some(seg => 
        seg.text.toLowerCase().includes(searchTerm.toLowerCase())
      )
    
    const matchesSentiment = sentimentFilter === 'all' || 
      transcript.summary.customer_sentiment === sentimentFilter

    return matchesSearch && matchesSentiment
  })

  return (
    <div className="row g-5">
      {/* Transcripts List */}
      <div className="col-lg-4">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Call Transcripts</h3>
          </div>
          <div className="card-body">
            {/* Filters */}
            <div className="mb-5">
              <input
                type="text"
                className="form-control mb-3"
                placeholder="Search transcripts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select
                className="form-select"
                value={sentimentFilter}
                onChange={(e) => setSentimentFilter(e.target.value)}
              >
                <option value="all">All Sentiments</option>
                <option value="satisfied">Satisfied</option>
                <option value="neutral">Neutral</option>
                <option value="frustrated">Frustrated</option>
              </select>
            </div>

            {/* Transcript List */}
            <div className="scroll-y mh-300px">
              {loading ? (
                <div className="text-center py-5">
                  <span className="spinner-border spinner-border-sm"></span>
                </div>
              ) : (
                filteredTranscripts.map(transcript => (
                  <div
                    key={transcript.id}
                    className={`d-flex align-items-center p-3 mb-2 rounded cursor-pointer ${
                      selectedTranscript?.id === transcript.id ? 'bg-light-primary' : 'bg-hover-light'
                    }`}
                    onClick={() => setSelectedTranscript(transcript)}
                  >
                    <div className="symbol symbol-50px me-3">
                      <div className={`symbol-label bg-light-${getSentimentColor(transcript.summary.customer_sentiment)}`}>
                        <KTIcon 
                          iconName={getSentimentIcon(transcript.summary.customer_sentiment)} 
                          className={`fs-2 text-${getSentimentColor(transcript.summary.customer_sentiment)}`} 
                        />
                      </div>
                    </div>
                    <div className="flex-grow-1">
                      <div className="fw-bold">{transcript.from_number}</div>
                      <div className="text-muted fs-7">
                        {new Date(transcript.created_at).toLocaleString()} • {Math.floor(transcript.duration / 60)}m {transcript.duration % 60}s
                      </div>
                      <div className="fs-7 text-truncate">{transcript.summary.overview}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Transcript Details */}
      <div className="col-lg-8">
        {selectedTranscript ? (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Call Analysis</h3>
              <div className="card-toolbar">
                <button className="btn btn-sm btn-light-primary me-2">
                  <KTIcon iconName="download" className="fs-3" />
                  Export
                </button>
                <button className="btn btn-sm btn-light-success">
                  <KTIcon iconName="play" className="fs-3" />
                  Play Recording
                </button>
              </div>
            </div>
            <div className="card-body">
              {/* Call Summary */}
              <div className="bg-light rounded p-5 mb-5">
                <h5 className="mb-3">Summary</h5>
                <p className="mb-3">{selectedTranscript.summary.overview}</p>
                
                <div className="row">
                  <div className="col-md-4">
                    <div className="d-flex align-items-center mb-2">
                      <KTIcon 
                        iconName={getSentimentIcon(selectedTranscript.summary.customer_sentiment)} 
                        className={`fs-2 text-${getSentimentColor(selectedTranscript.summary.customer_sentiment)} me-2`} 
                      />
                      <span className="text-capitalize">{selectedTranscript.summary.customer_sentiment}</span>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="d-flex align-items-center mb-2">
                      <KTIcon iconName="shield-tick" className="fs-2 text-info me-2" />
                      <span className="text-capitalize">{selectedTranscript.summary.resolution_status}</span>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="d-flex align-items-center mb-2">
                      <KTIcon iconName="timer" className="fs-2 text-warning me-2" />
                      <span>{Math.floor(selectedTranscript.duration / 60)}m {selectedTranscript.duration % 60}s</span>
                    </div>
                  </div>
                </div>

                {/* Action Items */}
                {selectedTranscript.summary.action_items.length > 0 && (
                  <div className="mt-4">
                    <h6 className="mb-2">Action Items:</h6>
                    <ul className="mb-0">
                      {selectedTranscript.summary.action_items.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Analytics */}
              <div className="row mb-5">
                <div className="col-md-6">
                  <div className="bg-light rounded p-4">
                    <h6 className="mb-3">Talk Time Ratio</h6>
                    <div className="d-flex justify-content-between mb-2">
                      <span>Customer</span>
                      <span>{selectedTranscript.analytics.talk_time_ratio.customer}%</span>
                    </div>
                    <div className="progress mb-3" style={{ height: '10px' }}>
                      <div 
                        className="progress-bar bg-primary" 
                        style={{ width: `${selectedTranscript.analytics.talk_time_ratio.customer}%` }}
                      />
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span>Agent/AI</span>
                      <span>{selectedTranscript.analytics.talk_time_ratio.agent}%</span>
                    </div>
                    <div className="progress" style={{ height: '10px' }}>
                      <div 
                        className="progress-bar bg-success" 
                        style={{ width: `${selectedTranscript.analytics.talk_time_ratio.agent}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="bg-light rounded p-4">
                    <h6 className="mb-3">Key Metrics</h6>
                    <div className="d-flex justify-content-between mb-2">
                      <span>Interruptions</span>
                      <span className="fw-bold">{selectedTranscript.analytics.interruptions}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span>Silence Duration</span>
                      <span className="fw-bold">{selectedTranscript.analytics.silence_duration}s</span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span>Keywords Detected</span>
                      <span className="fw-bold">{selectedTranscript.analytics.keywords.length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transcript */}
              <div className="mb-5">
                <h5 className="mb-3">Transcript</h5>
                <div className="timeline">
                  {selectedTranscript.transcript.segments.map((segment, index) => (
                    <div key={index} className="timeline-item">
                      <div className="timeline-line"></div>
                      <div className="timeline-icon">
                        <i className={`ki-duotone ki-${segment.speaker === 'customer' ? 'user' : 'robot'} fs-2`}>
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                      </div>
                      <div className="timeline-content mb-5">
                        <div className="d-flex align-items-center mb-2">
                          <span className="fw-bold text-capitalize me-2">{segment.speaker}</span>
                          <span className="badge badge-light-secondary fs-8">{segment.timestamp}s</span>
                          <span className={`badge badge-light-${getSentimentColor(segment.sentiment)} fs-8 ms-2`}>
                            {segment.sentiment}
                          </span>
                          <span className="badge badge-light fs-8 ms-2">
                            {Math.round(segment.confidence * 100)}% confident
                          </span>
                        </div>
                        <div className="fs-6 text-gray-800">{segment.text}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Keywords */}
              <div className="bg-light rounded p-5 mb-5">
                <h6 className="mb-3">Top Keywords</h6>
                <div className="d-flex flex-wrap gap-2">
                  {selectedTranscript.analytics.keywords.map((keyword, i) => (
                    <span key={i} className="badge badge-primary">
                      {keyword.word} ({keyword.count})
                    </span>
                  ))}
                </div>
              </div>

              {/* AI Post-Call Actions */}
              {selectedTranscript.transcript_text && (
                <AIPostCallActions
                  callId={selectedTranscript.call_id}
                  transcript={{
                    id: selectedTranscript.id,
                    call_id: selectedTranscript.call_id,
                    from_number: selectedTranscript.from_number,
                    to_number: selectedTranscript.to_number,
                    duration: selectedTranscript.duration,
                    transcript_text: selectedTranscript.transcript_text,
                    created_at: selectedTranscript.created_at
                  }}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-body text-center py-10">
              <KTIcon iconName="message-text-2" className="fs-5x text-muted mb-5" />
              <h3 className="text-muted">Select a call transcript to view analysis</h3>
              <p className="text-muted">AI-powered transcription and sentiment analysis for every call</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AICallAnalytics