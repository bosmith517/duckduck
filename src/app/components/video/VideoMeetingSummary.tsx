import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'

interface VideoMeetingSummaryProps {
  meetingId: string
}

interface MeetingSummary {
  id: string
  title: string
  date: string
  duration: number
  participants: string[]
  recording_url?: string
  transcript: TranscriptEntry[]
  ai_summary: AISummary
  action_items: ActionItem[]
  files: MeetingFile[]
  notes: string
}

interface TranscriptEntry {
  timestamp: string
  speaker: string
  text: string
}

interface AISummary {
  key_points: string[]
  decisions: string[]
  next_steps: string[]
  generated_at: string
}

interface ActionItem {
  id: string
  text: string
  assignee?: string
  due_date?: string
  completed: boolean
  job_id?: string
}

interface MeetingFile {
  id: string
  name: string
  url: string
  size: number
  uploaded_during_meeting: boolean
}

export const VideoMeetingSummary: React.FC<VideoMeetingSummaryProps> = ({ meetingId }) => {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<MeetingSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [assigningTasks, setAssigningTasks] = useState(false)
  const [selectedJob, setSelectedJob] = useState('')
  const [jobs, setJobs] = useState<any[]>([])

  useEffect(() => {
    loadMeetingSummary()
    loadJobs()
  }, [meetingId])

  const loadMeetingSummary = async () => {
    try {
      // Mock data - replace with actual Supabase query
      setSummary({
        id: meetingId,
        title: 'HVAC System Review & Estimate',
        date: new Date().toISOString(),
        duration: 2700, // 45 minutes
        participants: ['Mike Rodriguez', 'John Smith'],
        recording_url: '#',
        transcript: [
          { timestamp: '00:00:15', speaker: 'Mike Rodriguez', text: 'Good morning John, thanks for making time for this video call.' },
          { timestamp: '00:00:25', speaker: 'John Smith', text: 'Happy to be here. I\'ve been looking forward to discussing the HVAC replacement.' },
          { timestamp: '00:01:10', speaker: 'Mike Rodriguez', text: 'Let me share my screen and show you the photos of your current system.' },
          { timestamp: '00:02:30', speaker: 'Mike Rodriguez', text: 'As you can see here, the system is about 15 years old and showing significant wear.' },
          { timestamp: '00:05:45', speaker: 'John Smith', text: 'Yes, I\'ve noticed it\'s been struggling lately, especially during the hot days.' },
          { timestamp: '00:08:20', speaker: 'Mike Rodriguez', text: 'I recommend the Carrier Infinity 20 SEER system. It\'s highly efficient and comes with smart home integration.' },
          { timestamp: '00:15:30', speaker: 'John Smith', text: 'The smart thermostat feature is definitely appealing. How much energy savings can we expect?' },
          { timestamp: '00:16:45', speaker: 'Mike Rodriguez', text: 'With the 20 SEER rating, you\'re looking at about 30-40% reduction in cooling costs compared to your current system.' }
        ],
        ai_summary: {
          key_points: [
            'Current HVAC system is 15 years old and showing significant wear',
            'Recommended Carrier Infinity 20 SEER system with smart home integration',
            'Expected 30-40% reduction in cooling costs with new system',
            'Total estimate of $8,500 includes all materials, labor, and 10-year warranty',
            'Installation can be completed in one day'
          ],
          decisions: [
            'Client selected Carrier Infinity 20 SEER system',
            'Installation scheduled for next Tuesday at 8 AM',
            'Opted for smart thermostat integration',
            'Agreed to $8,500 total cost with financing available'
          ],
          next_steps: [
            'Mike to send detailed equipment specifications by EOD',
            'Client to clear access path to attic before installation',
            'Schedule follow-up call for Friday to confirm preparations',
            'Installation team arrival Tuesday 8 AM'
          ],
          generated_at: new Date().toISOString()
        },
        action_items: [
          { id: '1', text: 'Send detailed equipment specifications to client', assignee: 'Mike Rodriguez', due_date: new Date().toISOString(), completed: false },
          { id: '2', text: 'Clear access path to attic', assignee: 'John Smith', due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), completed: false },
          { id: '3', text: 'Schedule follow-up call for Friday', assignee: 'Mike Rodriguez', completed: false },
          { id: '4', text: 'Confirm installation team for Tuesday 8 AM', assignee: 'Mike Rodriguez', completed: false }
        ],
        files: [
          { id: '1', name: 'Current_System_Photos.pdf', url: '#', size: 2500000, uploaded_during_meeting: false },
          { id: '2', name: 'HVAC_Estimate_2024.pdf', url: '#', size: 1200000, uploaded_during_meeting: false },
          { id: '3', name: 'Carrier_Infinity_Brochure.pdf', url: '#', size: 3200000, uploaded_during_meeting: true }
        ],
        notes: 'Client expressed interest in the smart home features. Mentioned they have an existing smart home setup with Google Home. Need to ensure compatibility.\n\nClient also asked about maintenance plans - follow up with service agreement options.\n\nPayment: Client interested in 12-month financing option.'
      })
    } catch (error) {
      showToast.error('Failed to load meeting summary')
    } finally {
      setLoading(false)
    }
  }

  const loadJobs = async () => {
    try {
      // Mock jobs data
      setJobs([
        { id: '1', title: 'HVAC System Replacement - Smith Residence', job_number: 'JOB-2024-001' },
        { id: '2', title: 'Annual Maintenance - Smith Residence', job_number: 'JOB-2024-002' }
      ])
    } catch (error) {
      console.error('Failed to load jobs')
    }
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes} minutes`
  }

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const handleActionItemToggle = async (itemId: string) => {
    setSummary(prev => {
      if (!prev) return null
      return {
        ...prev,
        action_items: prev.action_items.map(item =>
          item.id === itemId ? { ...item, completed: !item.completed } : item
        )
      }
    })
  }

  const assignToJob = async () => {
    if (!selectedJob) {
      showToast.error('Please select a job')
      return
    }
    
    setAssigningTasks(true)
    try {
      // Link action items to job
      showToast.success('Action items linked to job')
      
      // Update local state
      setSummary(prev => {
        if (!prev) return null
        return {
          ...prev,
          action_items: prev.action_items.map(item => ({ ...item, job_id: selectedJob }))
        }
      })
    } catch (error) {
      showToast.error('Failed to assign tasks')
    } finally {
      setAssigningTasks(false)
    }
  }

  const exportSummary = () => {
    if (!summary) return
    
    const content = `
# ${summary.title}
Date: ${new Date(summary.date).toLocaleString()}
Duration: ${formatDuration(summary.duration)}
Participants: ${summary.participants.join(', ')}

## AI Summary

### Key Points
${summary.ai_summary.key_points.map(point => `• ${point}`).join('\n')}

### Decisions Made
${summary.ai_summary.decisions.map(decision => `• ${decision}`).join('\n')}

### Next Steps
${summary.ai_summary.next_steps.map(step => `• ${step}`).join('\n')}

## Action Items
${summary.action_items.map(item => `☐ ${item.text} (${item.assignee || 'Unassigned'})`).join('\n')}

## Meeting Notes
${summary.notes}

## Full Transcript
${summary.transcript.map(entry => `[${entry.timestamp}] ${entry.speaker}: ${entry.text}`).join('\n')}
    `.trim()
    
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${summary.title.replace(/\s+/g, '_')}_Summary.md`
    a.click()
  }

  const filteredTranscript = summary?.transcript.filter(entry =>
    entry.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.speaker.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="text-center py-10">
        <h3 className="text-muted">Summary not found</h3>
      </div>
    )
  }

  return (
    <div className="container py-5">
      {/* Header */}
      <div className="row mb-6">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h1 className="fs-2x fw-bold text-dark mb-2">{summary.title}</h1>
              <div className="text-muted">
                <i className="ki-duotone ki-calendar fs-5 me-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                {new Date(summary.date).toLocaleString()} • {formatDuration(summary.duration)} • {summary.participants.length} participants
              </div>
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-light-primary" onClick={exportSummary}>
                <i className="ki-duotone ki-download fs-3"></i>
                Export Summary
              </button>
              {summary.recording_url && (
                <a href={summary.recording_url} className="btn btn-primary">
                  <i className="ki-duotone ki-video fs-3"></i>
                  View Recording
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-6">
        {/* AI Summary */}
        <div className="col-lg-8">
          <KTCard className="mb-6">
            <div className="card-header">
              <h3 className="card-title">
                <i className="ki-duotone ki-technology fs-2 text-primary me-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                AI-Generated Summary
              </h3>
              <div className="card-toolbar">
                <span className="text-muted fs-7">
                  Generated at {new Date(summary.ai_summary.generated_at).toLocaleTimeString()}
                </span>
              </div>
            </div>
            <KTCardBody>
              <div className="mb-6">
                <h6 className="fw-bold mb-3">Key Discussion Points</h6>
                <ul className="mb-0">
                  {summary.ai_summary.key_points.map((point, index) => (
                    <li key={index} className="mb-2">{point}</li>
                  ))}
                </ul>
              </div>

              <div className="mb-6">
                <h6 className="fw-bold mb-3">Decisions Made</h6>
                <ul className="mb-0">
                  {summary.ai_summary.decisions.map((decision, index) => (
                    <li key={index} className="mb-2 text-success">{decision}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h6 className="fw-bold mb-3">Next Steps</h6>
                <ul className="mb-0">
                  {summary.ai_summary.next_steps.map((step, index) => (
                    <li key={index} className="mb-2">{step}</li>
                  ))}
                </ul>
              </div>
            </KTCardBody>
          </KTCard>

          {/* Meeting Notes */}
          <KTCard className="mb-6">
            <div className="card-header">
              <h3 className="card-title">Meeting Notes</h3>
            </div>
            <KTCardBody>
              <pre className="text-gray-700" style={{ whiteSpace: 'pre-wrap' }}>
                {summary.notes}
              </pre>
            </KTCardBody>
          </KTCard>

          {/* Transcript */}
          <KTCard>
            <div className="card-header">
              <h3 className="card-title">Full Transcript</h3>
              <div className="card-toolbar">
                <div className="input-group input-group-sm">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search transcript..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <span className="input-group-text">
                    <i className="ki-duotone ki-magnifier fs-5">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                  </span>
                </div>
              </div>
            </div>
            <KTCardBody className="p-0">
              <div className="table-responsive mh-400px">
                <table className="table table-row-dashed">
                  <tbody>
                    {filteredTranscript.map((entry, index) => (
                      <tr key={index}>
                        <td className="text-muted text-nowrap pe-5" style={{ width: '100px' }}>
                          {entry.timestamp}
                        </td>
                        <td className="fw-bold text-nowrap pe-5" style={{ width: '150px' }}>
                          {entry.speaker}:
                        </td>
                        <td>{entry.text}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </KTCardBody>
          </KTCard>
        </div>

        {/* Sidebar */}
        <div className="col-lg-4">
          {/* Action Items */}
          <KTCard className="mb-6">
            <div className="card-header">
              <h3 className="card-title">Action Items</h3>
              <div className="card-toolbar">
                <span className="badge badge-light-primary">
                  {summary.action_items.filter(item => !item.completed).length} Open
                </span>
              </div>
            </div>
            <KTCardBody>
              {summary.action_items.map(item => (
                <div key={item.id} className="d-flex align-items-start mb-4">
                  <input
                    type="checkbox"
                    className="form-check-input mt-1 me-3"
                    checked={item.completed}
                    onChange={() => handleActionItemToggle(item.id)}
                  />
                  <div className="flex-grow-1">
                    <div className={item.completed ? 'text-muted text-decoration-line-through' : ''}>
                      {item.text}
                    </div>
                    <div className="text-muted fs-7 mt-1">
                      {item.assignee && <span className="me-3">👤 {item.assignee}</span>}
                      {item.due_date && <span>📅 {new Date(item.due_date).toLocaleDateString()}</span>}
                    </div>
                  </div>
                </div>
              ))}

              <div className="separator my-4"></div>

              <div>
                <label className="form-label">Link to Job</label>
                <select 
                  className="form-select form-select-sm mb-3"
                  value={selectedJob}
                  onChange={(e) => setSelectedJob(e.target.value)}
                >
                  <option value="">Select a job...</option>
                  {jobs.map(job => (
                    <option key={job.id} value={job.id}>
                      {job.job_number} - {job.title}
                    </option>
                  ))}
                </select>
                <button 
                  className="btn btn-sm btn-primary w-100"
                  onClick={assignToJob}
                  disabled={!selectedJob || assigningTasks}
                >
                  {assigningTasks ? 'Assigning...' : 'Assign to Job'}
                </button>
              </div>
            </KTCardBody>
          </KTCard>

          {/* Files */}
          <KTCard>
            <div className="card-header">
              <h3 className="card-title">Meeting Files</h3>
            </div>
            <KTCardBody className="p-0">
              <div className="table-responsive">
                <table className="table table-row-dashed">
                  <tbody>
                    {summary.files.map(file => (
                      <tr key={file.id}>
                        <td>
                          <div className="d-flex align-items-center">
                            <i className="ki-duotone ki-file fs-2x text-primary me-3">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                            <div>
                              <a href={file.url} className="text-dark fw-bold text-hover-primary">
                                {file.name}
                              </a>
                              <div className="text-muted fs-7">
                                {formatFileSize(file.size)}
                                {file.uploaded_during_meeting && (
                                  <span className="badge badge-light-success ms-2">New</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </KTCardBody>
          </KTCard>
        </div>
      </div>
    </div>
  )
}

export default VideoMeetingSummary