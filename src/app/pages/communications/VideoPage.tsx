import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'
import SignalWireVideo from '../../components/communications/SignalWireVideo'
import { videoService, VideoMeeting } from '../../services/videoService'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { showToast } from '../../utils/toast'
import { TableSkeleton, StatCardSkeleton } from '../../components/shared/skeletons/TableSkeleton'

const VideoPage: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  const navigate = useNavigate()
  const [meetings, setMeetings] = useState<VideoMeeting[]>([])
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<'live' | 'meetings'>('live')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (userProfile?.tenant_id) {
      fetchMeetings()
    } else {
      // If no user profile, set loading to false and clear meetings
      setLoading(false)
      setMeetings([])
    }
  }, [userProfile?.tenant_id, statusFilter, searchTerm])

  const fetchMeetings = async () => {
    try {
      setLoading(true)
      const filters: any = {}
      
      if (statusFilter !== 'all') {
        filters.status = statusFilter
      }

      const data = await videoService.getVideoMeetings(filters)
      
      // Filter by search term if provided
      let filteredData = data
      if (searchTerm) {
        filteredData = data.filter(meeting => 
          meeting.room_url.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (meeting as any).job?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (meeting as any).created_by_user?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (meeting as any).created_by_user?.last_name?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      }
      
      setMeetings(filteredData)
    } catch (error) {
      console.error('Error fetching meetings:', error)
      showToast.error('Failed to load video meetings')
    } finally {
      setLoading(false)
    }
  }

  const handleJoinMeeting = async (meetingId: string) => {
    try {
      const loadingToast = showToast.loading('Joining meeting...')
      await videoService.joinVideoMeeting(meetingId)
      showToast.dismiss(loadingToast)
      showToast.success('Joined meeting successfully!')
      fetchMeetings() // Refresh to update status
    } catch (error) {
      console.error('Error joining meeting:', error)
      showToast.error('Failed to join meeting')
    }
  }

  const handleEndMeeting = async (meetingId: string) => {
    if (!confirm('Are you sure you want to end this meeting?')) return

    try {
      const loadingToast = showToast.loading('Ending meeting...')
      await videoService.endVideoMeeting(meetingId)
      showToast.dismiss(loadingToast)
      showToast.warning('Meeting ended successfully')
      fetchMeetings() // Refresh to update status
    } catch (error) {
      console.error('Error ending meeting:', error)
      showToast.error('Failed to end meeting')
    }
  }

  const handleDeleteMeeting = async (meetingId: string) => {
    if (!confirm('Are you sure you want to delete this meeting? This action cannot be undone.')) return

    try {
      const loadingToast = showToast.loading('Deleting meeting...')
      await videoService.deleteVideoMeeting(meetingId)
      showToast.dismiss(loadingToast)
      showToast.warning('Meeting deleted successfully')
      fetchMeetings() // Refresh list
    } catch (error) {
      console.error('Error deleting meeting:', error)
      showToast.error('Failed to delete meeting')
    }
  }

  const getStatusBadge = (status: string) => {
    return `badge ${videoService.getStatusBadgeClass(status)}`
  }

  const createInstantMeeting = async () => {
    try {
      const instantMeetingId = `instant-${Date.now()}`
      navigate(`/video-meeting/${instantMeetingId}/room`)
      showToast.success('Instant meeting started!')
    } catch (error) {
      showToast.error('Failed to create instant meeting')
    }
  }

  const getMeetingStats = () => {
    const total = meetings.length
    const active = meetings.filter(m => m.status === 'active').length
    const scheduled = meetings.filter(m => m.status === 'scheduled').length
    const ended = meetings.filter(m => m.status === 'ended').length

    return { total, active, scheduled, ended }
  }

  const stats = getMeetingStats()

  return (
    <>
      <PageTitle breadcrumbs={[]}>Video Conferencing</PageTitle>

      {/* Navigation Tabs */}
      <div className='row g-5 g-xl-8 mb-5'>
        <div className='col-xl-12'>
          <div className='card card-bordered'>
            <div className='card-body p-0'>
              <div className='d-flex'>
                <button
                  className={`btn btn-flex flex-center btn-active-light-primary py-3 px-4 ${activeView === 'live' ? 'active' : ''}`}
                  onClick={() => setActiveView('live')}
                >
                  <i className='ki-duotone ki-video fs-2 me-2'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                  </i>
                  Live Meeting
                </button>
                <button
                  className={`btn btn-flex flex-center btn-active-light-primary py-3 px-4 ${activeView === 'meetings' ? 'active' : ''}`}
                  onClick={() => setActiveView('meetings')}
                >
                  <i className='ki-duotone ki-calendar fs-2 me-2'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                  </i>
                  Meeting History
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Meeting View - Now controlled by CSS display property */}
      <div style={{ display: activeView === 'live' ? 'block' : 'none' }}>
        <div className='row g-5 g-xl-8'>
          <div className='col-xl-12'>
            <KTCard>
              <div className='card-header border-0 pt-5'>
                <h3 className='card-title align-items-start flex-column'>
                  <span className='card-label fw-bold fs-3 mb-1'>Video Meeting Room</span>
                  <span className='text-muted mt-1 fw-semibold fs-7'>Start or join a video conference</span>
                </h3>
              </div>
              <KTCardBody className='py-3'>
                {/* Instant Meeting Actions */}
                <div className='row g-5 mb-8'>
                  <div className='col-md-6'>
                    <div className='card bg-light-primary h-100 cursor-pointer' onClick={createInstantMeeting}>
                      <div className='card-body text-center p-6'>
                        <i className='ki-duotone ki-rocket fs-3x text-primary mb-3'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                        </i>
                        <h4 className='fw-bold text-dark mb-2'>Start Instant Meeting</h4>
                        <p className='text-muted fs-7 mb-3'>Begin a video call immediately without scheduling</p>
                        <button className='btn btn-primary'>
                          Start Now →
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className='col-md-6'>
                    <div className='card bg-light-info h-100 cursor-pointer' onClick={() => navigate('/video-meeting/create')}>
                      <div className='card-body text-center p-6'>
                        <i className='ki-duotone ki-calendar-add fs-3x text-info mb-3'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                          <span className='path3'></span>
                          <span className='path4'></span>
                          <span className='path5'></span>
                          <span className='path6'></span>
                        </i>
                        <h4 className='fw-bold text-dark mb-2'>Schedule Meeting</h4>
                        <p className='text-muted fs-7 mb-3'>Plan a future meeting with agenda and invites</p>
                        <button className='btn btn-info'>
                          Schedule →
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className='separator my-6'></div>
                
                <SignalWireVideo />
              </KTCardBody>
            </KTCard>
          </div>
        </div>
      </div>

      {/* Meeting History View - Now controlled by CSS display property */}
      <div style={{ display: activeView === 'meetings' ? 'block' : 'none' }}>
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
                            <i className='ki-duotone ki-video fs-2x text-primary'></i>
                          </span>
                        </div>
                        <div className='d-flex flex-column'>
                          <span className='fw-bold fs-6 text-gray-800'>{stats.total}</span>
                          <span className='fw-semibold fs-7 text-gray-400'>Total Meetings</span>
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
                          <span className='fw-bold fs-6 text-gray-800'>{stats.active}</span>
                          <span className='fw-semibold fs-7 text-gray-400'>Active Now</span>
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
                          <span className='symbol-label bg-light-warning'>
                            <i className='ki-duotone ki-time fs-2x text-warning'></i>
                          </span>
                        </div>
                        <div className='d-flex flex-column'>
                          <span className='fw-bold fs-6 text-gray-800'>{stats.scheduled}</span>
                          <span className='fw-semibold fs-7 text-gray-400'>Scheduled</span>
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
                          <span className='symbol-label bg-light-secondary'>
                            <i className='ki-duotone ki-cross fs-2x text-secondary'></i>
                          </span>
                        </div>
                        <div className='d-flex flex-column'>
                          <span className='fw-bold fs-6 text-gray-800'>{stats.ended}</span>
                          <span className='fw-semibold fs-7 text-gray-400'>Completed</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Meeting History Table */}
          <div className='row g-5 g-xl-8'>
            <div className='col-xl-12'>
              <KTCard>
                <div className='card-header border-0 pt-5'>
                  <div className='card-title'>
                    <div className='d-flex align-items-center position-relative my-1'>
                      <i className='ki-duotone ki-magnifier fs-1 position-absolute ms-6'>
                        <span className='path1'></span>
                        <span className='path2'></span>
                      </i>
                      <input
                        type='text'
                        className='form-control form-control-solid w-250px ps-14'
                        placeholder='Search meetings...'
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className='card-toolbar'>
                    <div className='d-flex justify-content-end align-items-center'>
                      <select
                        className='form-select form-select-solid form-select-sm w-150px me-3'
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                      >
                        <option value='all'>All Status</option>
                        <option value='scheduled'>Scheduled</option>
                        <option value='active'>Active</option>
                        <option value='ended'>Ended</option>
                      </select>
                      <button 
                        className='btn btn-sm btn-primary'
                        onClick={() => setActiveView('live')}
                      >
                        <i className='ki-duotone ki-plus fs-2'></i>
                        New Meeting
                      </button>
                    </div>
                  </div>
                </div>
                <KTCardBody className='py-3'>
                  {loading ? (
                    <TableSkeleton rows={5} columns={7} />
                  ) : meetings.length === 0 ? (
                    <div className='text-center py-10'>
                      <div className='text-muted mb-3'>
                        <i className='ki-duotone ki-video fs-3x text-muted mb-3'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                        </i>
                      </div>
                      <div className='text-muted'>
                        No video meetings found. Start your first meeting to begin collaborating with your team and clients.
                      </div>
                    </div>
                  ) : (
                    <div className='table-responsive'>
                      <table className='table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4'>
                        <thead>
                          <tr className='fw-bold text-muted'>
                            <th className='min-w-150px'>Room Name</th>
                            <th className='min-w-120px'>Job</th>
                            <th className='min-w-120px'>Created By</th>
                            <th className='min-w-100px'>Status</th>
                            <th className='min-w-120px'>Created</th>
                            <th className='min-w-120px'>Duration</th>
                            <th className='min-w-100px text-end'>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {meetings.map((meeting) => (
                            <tr key={meeting.id}>
                              <td>
                                <div className='d-flex flex-column'>
                                  <span className='text-dark fw-bold fs-6'>
                                    {meeting.room_name || `Meeting ${meeting.id.substring(0, 8)}`}
                                  </span>
                                  <span className='text-muted fw-semibold fs-7'>
                                    {meeting.provider || 'SignalWire'}
                                  </span>
                                </div>
                              </td>
                              <td>
                                <span className='text-dark fw-bold fs-6'>
                                  {(meeting as any).job?.title || 'General meeting'}
                                </span>
                              </td>
                              <td>
                                <span className='text-dark fw-bold fs-6'>
                                  {(meeting as any).created_by_user ? 
                                    `${(meeting as any).created_by_user.first_name} ${(meeting as any).created_by_user.last_name}` : 
                                    'Unknown'
                                  }
                                </span>
                              </td>
                              <td>
                                <span className={getStatusBadge(meeting.status || 'unknown')}>
                                  {meeting.status || 'Unknown'}
                                </span>
                              </td>
                              <td>
                                <span className='text-dark fw-bold fs-6'>
                                  {new Date(meeting.created_at).toLocaleDateString()}
                                </span>
                                <span className='text-muted fw-semibold fs-7 d-block'>
                                  {new Date(meeting.created_at).toLocaleTimeString()}
                                </span>
                              </td>
                              <td>
                                <span className='text-dark fw-bold fs-6'>
                                  {meeting.duration ? 
                                    videoService.formatDuration(meeting.duration) : 
                                    meeting.status === 'active' ? 'In progress' : '-'
                                  }
                                </span>
                              </td>
                              <td>
                                <div className='d-flex justify-content-end flex-shrink-0'>
                                  {videoService.isMeetingJoinable(meeting) && (
                                    <button
                                      className='btn btn-icon btn-bg-light btn-active-color-success btn-sm me-1'
                                      title='Join Meeting'
                                      onClick={() => handleJoinMeeting(meeting.id)}
                                    >
                                      <i className='ki-duotone ki-entrance-right fs-3'>
                                        <span className='path1'></span>
                                        <span className='path2'></span>
                                      </i>
                                    </button>
                                  )}
                                  {meeting.status === 'active' && (
                                    <button
                                      className='btn btn-icon btn-bg-light btn-active-color-warning btn-sm me-1'
                                      title='End Meeting'
                                      onClick={() => handleEndMeeting(meeting.id)}
                                    >
                                      <i className='ki-duotone ki-cross fs-3'>
                                        <span className='path1'></span>
                                        <span className='path2'></span>
                                      </i>
                                    </button>
                                  )}
                                  <button
                                    className='btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1'
                                    title='View Details'
                                    onClick={() => showToast.info('Meeting details view will be available in a future update')}
                                  >
                                    <i className='ki-duotone ki-eye fs-3'>
                                      <span className='path1'></span>
                                      <span className='path2'></span>
                                      <span className='path3'></span>
                                    </i>
                                  </button>
                                  <button
                                    className='btn btn-icon btn-bg-light btn-active-color-danger btn-sm'
                                    title='Delete Meeting'
                                    onClick={() => handleDeleteMeeting(meeting.id)}
                                  >
                                    <i className='ki-duotone ki-trash fs-3'>
                                      <span className='path1'></span>
                                      <span className='path2'></span>
                                      <span className='path3'></span>
                                      <span className='path4'></span>
                                      <span className='path5'></span>
                                    </i>
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
          </div>
        </>
      </div>
    </>
  )
}

export default VideoPage
