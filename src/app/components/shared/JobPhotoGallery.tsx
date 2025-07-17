import React, { useState, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { showToast } from '../../utils/toast'
import PhotoCapture from './PhotoCapture'
import PhotoViewer from './PhotoViewer'
import AIAnalysisButton from './AIAnalysisButton'
import CreateEstimateModal from '../workflows/CreateEstimateModal'
import { logPhotoUpload } from '../../utils/activityLogger'

interface JobPhoto {
  id: string
  photo_type: 'site_visit' | 'receipt' | 'job_progress' | 'before' | 'after' | 'general' | 'reference'
  file_url: string
  description: string
  taken_at: string
  taken_by_name: string
  latitude?: number
  longitude?: number
  cost_description?: string
}

interface JobPhotoGalleryProps {
  jobId: string
  showTitle?: boolean
  photoTypes?: string[]
  allowCapture?: boolean
  compactView?: boolean
}

const JobPhotoGallery: React.FC<JobPhotoGalleryProps> = ({
  jobId,
  showTitle = true,
  photoTypes = ['job_progress', 'before', 'after', 'general'],
  allowCapture = true,
  compactView = false
}) => {
  const { userProfile } = useSupabaseAuth()
  const [photos, setPhotos] = useState<JobPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [showPhotoCapture, setShowPhotoCapture] = useState(false)
  const [selectedPhotoType, setSelectedPhotoType] = useState<'site_visit' | 'receipt' | 'job_progress' | 'before' | 'after' | 'general'>('job_progress')
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0)
  const [showPhotoViewer, setShowPhotoViewer] = useState(false)
  const [showEstimateModal, setShowEstimateModal] = useState(false)
  const [jobDetails, setJobDetails] = useState<any>(null)
  const [activePhotoType, setActivePhotoType] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid')

  useEffect(() => {
    if (jobId && userProfile?.tenant_id) {
      loadPhotos()
      loadJobDetails()
    }
  }, [jobId, userProfile?.tenant_id])

  const loadPhotos = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('job_photos_view')
        .select('*')
        .eq('job_id', jobId)
        .in('photo_type', photoTypes)
        .order('taken_at', { ascending: false })

      if (error) throw error
      setPhotos(data || [])
    } catch (error) {
      console.error('Error loading photos:', error)
      showToast.error('Failed to load photos')
    } finally {
      setLoading(false)
    }
  }

  const loadJobDetails = async () => {
    try {
      // First get the job details
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single()

      if (jobError) throw jobError

      // Then get estimates for the same account (if job has account_id)
      let estimates: Array<{id: string, status: string, created_at: string}> = []
      if (jobData.account_id) {
        const { data: estimateData, error: estimateError } = await supabase
          .from('estimates')
          .select('id, status, created_at')
          .eq('account_id', jobData.account_id)
          .order('created_at', { ascending: false })

        if (!estimateError) {
          estimates = estimateData || []
        }
      }

      setJobDetails({ ...jobData, estimates })
    } catch (error) {
      console.error('Error loading job details:', error)
    }
  }

  // Check if job needs an estimate based on status and existing estimates
  const needsEstimate = () => {
    if (!jobDetails) return false
    
    // More flexible status checking - if photos exist, likely ready for estimate
    const statusesNeedingEstimate = [
      'needs_assessment', 'needs_estimate', 'site_visit_complete', 
      'draft', 'scheduled', 'in_progress' // Added common statuses
    ]
    
    // Check if job status indicates estimate is needed OR if we have photos (site visit done)
    const statusNeedsEstimate = statusesNeedingEstimate.includes(jobDetails.status) || photos.length > 0
    
    // Check if there are no existing estimates or only draft estimates
    const hasNoFinalEstimate = !jobDetails.estimates || 
      jobDetails.estimates.length === 0 || 
      jobDetails.estimates.every((est: any) => est.status === 'draft' || est.status === 'Draft')
    
    return statusNeedsEstimate && hasNoFinalEstimate
  }

  const getPhotoTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'site_visit': 'Site Visit',
      'receipt': 'Receipt',
      'job_progress': 'Job Progress',
      'before': 'Before',
      'after': 'After',
      'general': 'General'
    }
    return labels[type] || 'Photo'
  }

  const getPhotoTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'site_visit': 'info',
      'receipt': 'success',
      'job_progress': 'primary',
      'before': 'warning',
      'after': 'info',
      'general': 'secondary'
    }
    return colors[type] || 'secondary'
  }

  const groupedPhotos = photos.reduce((acc, photo) => {
    if (!acc[photo.photo_type]) {
      acc[photo.photo_type] = []
    }
    acc[photo.photo_type].push(photo)
    return acc
  }, {} as Record<string, JobPhoto[]>)

  const handlePhotoClick = (photo: JobPhoto) => {
    const index = photos.findIndex(p => p.id === photo.id)
    setSelectedPhotoIndex(index >= 0 ? index : 0)
    setShowPhotoViewer(true)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading photos...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="job-photo-gallery">
      {(showTitle || allowCapture) && (
        <div className="d-flex justify-content-between align-items-center mb-4">
          {showTitle && (
            <h6 className="mb-0">
              <i className="ki-duotone ki-picture fs-4 text-primary me-2">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              Job Photos ({photos.length})
            </h6>
          )}
          {!showTitle && <div></div>} {/* Spacer when no title */}
          {allowCapture && (
            <div className="d-flex gap-2">
              {/* AI Analysis Button - Debug Version */}
              {photos.length > 0 && (
                <button
                  className="btn btn-light-info btn-sm"
                  onClick={async () => {
                    console.log('🔍 Testing AI Analysis...')
                    try {
                      const { data, error } = await supabase.functions.invoke('test-ai-analysis', {
                        body: {
                          jobId,
                          photoUrls: photos.map(p => p.file_url),
                          test: true
                        }
                      })
                      console.log('✅ Test result:', data)
                      if (error) {
                        console.error('❌ Test error:', error)
                        showToast.error(`Test failed: ${error.message}`)
                      } else {
                        showToast.success('Test successful! Check console for details.')
                      }
                    } catch (err) {
                      console.error('❌ Test exception:', err)
                      showToast.error(`Test exception: ${err instanceof Error ? err.message : 'Unknown error'}`)
                    }
                  }}
                >
                  <i className="ki-duotone ki-abstract-39 fs-5 me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Test AI
                </button>
              )}
              
              {/* Create Estimate Button */}
              {needsEstimate() && (
                <button
                  className="btn btn-success btn-sm"
                  onClick={() => setShowEstimateModal(true)}
                  title="Create estimate for this job"
                >
                  <i className="ki-duotone ki-document fs-5 me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Create Estimate
                </button>
              )}
              
              <div className="dropdown">
                <button
                  className="btn btn-primary btn-sm dropdown-toggle"
                  type="button"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                >
                  <i className="ki-duotone ki-camera fs-5 me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Add Photos
                </button>
              <ul className="dropdown-menu">
                <li>
                  <a
                    className="dropdown-item"
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      setSelectedPhotoType('job_progress')
                      setShowPhotoCapture(true)
                    }}
                  >
                    <i className="ki-duotone ki-setting-2 fs-6 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    Progress Photo
                  </a>
                </li>
                <li>
                  <a
                    className="dropdown-item"
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      setSelectedPhotoType('before')
                      setShowPhotoCapture(true)
                    }}
                  >
                    <i className="ki-duotone ki-arrow-left fs-6 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    Before Photo
                  </a>
                </li>
                <li>
                  <a
                    className="dropdown-item"
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      setSelectedPhotoType('after')
                      setShowPhotoCapture(true)
                    }}
                  >
                    <i className="ki-duotone ki-arrow-right fs-6 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    After Photo
                  </a>
                </li>
                <li>
                  <a
                    className="dropdown-item"
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      setSelectedPhotoType('general')
                      setShowPhotoCapture(true)
                    }}
                  >
                    <i className="ki-duotone ki-picture fs-6 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    General Photo
                  </a>
                </li>
              </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {photos.length === 0 ? (
        <div className="text-center py-8">
          <i className="ki-duotone ki-picture fs-3x text-muted mb-3">
            <span className="path1"></span>
            <span className="path2"></span>
          </i>
          <h6 className="text-muted">No Photos Yet</h6>
          <p className="text-muted fs-7 mb-4">
            Start documenting this job by taking photos of your progress
          </p>
          {allowCapture && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setSelectedPhotoType('job_progress')
                setShowPhotoCapture(true)
              }}
            >
              <i className="ki-duotone ki-camera fs-5 me-2">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              Take First Photo
            </button>
          )}
        </div>
      ) : (
        <div>
          {compactView ? (
            // Compact grid view
            <div className="row g-2">
              {photos.slice(0, 6).map((photo) => (
                <div key={photo.id} className="col-4 col-md-2">
                  <div className="position-relative">
                    <img
                      src={photo.file_url}
                      alt={photo.description}
                      className="img-fluid rounded cursor-pointer"
                      style={{ aspectRatio: '1', objectFit: 'cover' }}
                      onClick={() => handlePhotoClick(photo)}
                    />
                    <span className={`badge badge-${getPhotoTypeColor(photo.photo_type)} position-absolute top-0 end-0 m-1 fs-8`}>
                      {getPhotoTypeLabel(photo.photo_type)}
                    </span>
                  </div>
                </div>
              ))}
              {photos.length > 6 && (
                <div className="col-4 col-md-2">
                  <div 
                    className="d-flex align-items-center justify-content-center bg-light rounded cursor-pointer h-100"
                    style={{ aspectRatio: '1', minHeight: '80px' }}
                  >
                    <div className="text-center">
                      <div className="fw-bold text-dark">+{photos.length - 6}</div>
                      <div className="text-muted fs-8">more</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Organized photo gallery
            <div>
              {/* Photo Type Filter Tabs */}
              <div className="mb-4">
                <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between">
                  <div className="d-flex flex-wrap gap-2">
                    <button
                      className={`btn btn-sm ${activePhotoType === 'all' ? 'btn-primary' : 'btn-light'}`}
                      onClick={() => setActivePhotoType('all')}
                    >
                      All Photos ({photos.length})
                    </button>
                    {Object.entries(groupedPhotos).map(([photoType, typePhotos]) => (
                      <button
                        key={photoType}
                        className={`btn btn-sm ${activePhotoType === photoType ? 'btn-primary' : 'btn-light'}`}
                        onClick={() => setActivePhotoType(photoType)}
                      >
                        <span className={`badge badge-${getPhotoTypeColor(photoType)} me-1 fs-8`}>
                          {getPhotoTypeLabel(photoType)}
                        </span>
                        {typePhotos.length}
                      </button>
                    ))}
                  </div>
                  
                  <div className="d-flex gap-2">
                    <button
                      className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-light'}`}
                      onClick={() => setViewMode('grid')}
                      title="Grid View"
                    >
                      <i className="ki-duotone ki-element-11 fs-5">
                        <span className="path1"></span>
                        <span className="path2"></span>
                        <span className="path3"></span>
                        <span className="path4"></span>
                      </i>
                    </button>
                    <button
                      className={`btn btn-sm ${viewMode === 'timeline' ? 'btn-primary' : 'btn-light'}`}
                      onClick={() => setViewMode('timeline')}
                      title="Timeline View"
                    >
                      <i className="ki-duotone ki-time fs-5">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                    </button>
                  </div>
                </div>
              </div>

              {/* Photo Display */}
              {(() => {
                const filteredPhotos = activePhotoType === 'all' ? photos : (groupedPhotos[activePhotoType] || [])
                
                if (viewMode === 'timeline') {
                  // Timeline view grouped by date
                  const photosByDate = filteredPhotos.reduce((acc, photo) => {
                    const dateKey = new Date(photo.taken_at).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })
                    if (!acc[dateKey]) acc[dateKey] = []
                    acc[dateKey].push(photo)
                    return acc
                  }, {} as Record<string, JobPhoto[]>)
                  
                  const sortedDates = Object.keys(photosByDate).sort((a, b) => 
                    new Date(b).getTime() - new Date(a).getTime()
                  )
                  
                  return (
                    <div>
                      {sortedDates.map((date) => (
                        <div key={date} className="mb-5">
                          <div className="d-flex align-items-center mb-3">
                            <div className="bg-primary rounded-circle p-2 me-3">
                              <i className="ki-duotone ki-calendar fs-6 text-white">
                                <span className="path1"></span>
                                <span className="path2"></span>
                              </i>
                            </div>
                            <div>
                              <h6 className="mb-0">{date}</h6>
                              <span className="text-muted fs-7">{photosByDate[date].length} photos</span>
                            </div>
                          </div>
                          <div className="row g-2 ms-5">
                            {photosByDate[date].map((photo) => (
                              <div key={photo.id} className="col-6 col-md-3 col-lg-2">
                                <div className="position-relative">
                                  <img
                                    src={photo.file_url}
                                    alt={photo.description}
                                    className="img-fluid rounded cursor-pointer shadow-sm"
                                    style={{ aspectRatio: '1', objectFit: 'cover' }}
                                    onClick={() => handlePhotoClick(photo)}
                                  />
                                  <span className={`badge badge-${getPhotoTypeColor(photo.photo_type)} position-absolute top-0 end-0 m-1 fs-8`}>
                                    {getPhotoTypeLabel(photo.photo_type)}
                                  </span>
                                  {(photo.latitude && photo.longitude) && (
                                    <span className="badge badge-success position-absolute bottom-0 start-0 m-1 fs-8">
                                      <i className="ki-duotone ki-geolocation fs-7">
                                        <span className="path1"></span>
                                        <span className="path2"></span>
                                      </i>
                                    </span>
                                  )}
                                </div>
                                {photo.description && (
                                  <p className="text-muted fs-8 mt-1 mb-0 text-truncate" title={photo.description}>
                                    {photo.description}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                } else {
                  // Grid view
                  return (
                    <div className="row g-3">
                      {filteredPhotos.map((photo) => (
                        <div key={photo.id} className="col-6 col-md-4 col-lg-3 col-xl-2">
                          <div className="position-relative">
                            <img
                              src={photo.file_url}
                              alt={photo.description}
                              className="img-fluid rounded cursor-pointer shadow-sm"
                              style={{ aspectRatio: '1', objectFit: 'cover' }}
                              onClick={() => handlePhotoClick(photo)}
                            />
                            <span className={`badge badge-${getPhotoTypeColor(photo.photo_type)} position-absolute top-0 end-0 m-2 fs-8`}>
                              {getPhotoTypeLabel(photo.photo_type)}
                            </span>
                            {(photo.latitude && photo.longitude) && (
                              <span className="badge badge-success position-absolute top-0 start-0 m-2 fs-8">
                                <i className="ki-duotone ki-geolocation fs-7">
                                  <span className="path1"></span>
                                  <span className="path2"></span>
                                </i>
                              </span>
                            )}
                            <div className="position-absolute bottom-0 start-0 end-0 bg-gradient-dark rounded-bottom p-2">
                              <div className="text-white fs-8">
                                {formatDate(photo.taken_at)}
                              </div>
                              {photo.description && (
                                <div className="text-light fs-9 text-truncate" title={photo.description}>
                                  {photo.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                }
              })()}
            </div>
          )}
        </div>
      )}

      {/* Photo Capture Modal */}
      <PhotoCapture
        isOpen={showPhotoCapture}
        onClose={() => setShowPhotoCapture(false)}
        onPhotoSaved={async (photoUrl, photoId) => {
          loadPhotos() // Refresh the gallery
          showToast.success('Photo saved successfully!')
          
          // Log photo upload activity
          try {
            await logPhotoUpload(jobId, 1)
          } catch (error) {
            console.error('Failed to log photo upload activity:', error)
          }
        }}
        jobId={jobId}
        photoType={selectedPhotoType}
        title={`${getPhotoTypeLabel(selectedPhotoType)} Documentation`}
      />

      {/* Photo Viewer Modal */}
      <PhotoViewer
        photos={photos}
        initialIndex={selectedPhotoIndex}
        isOpen={showPhotoViewer}
        onClose={() => setShowPhotoViewer(false)}
        onDelete={async (photoId) => {
          try {
            const { error } = await supabase
              .from('job_photos')
              .delete()
              .eq('id', photoId)

            if (error) throw error

            showToast.success('Photo deleted successfully')
            loadPhotos() // Refresh the gallery
          } catch (error) {
            console.error('Error deleting photo:', error)
            showToast.error('Failed to delete photo')
          }
        }}
      />

      {/* Create Estimate Modal */}
      <CreateEstimateModal
        jobId={jobId}
        isOpen={showEstimateModal}
        onClose={() => setShowEstimateModal(false)}
        onEstimateCreated={(estimateId) => {
          showToast.success('Estimate created! Ready to present to customer.')
          setShowEstimateModal(false)
          loadJobDetails() // Refresh job details to update estimate status
        }}
      />
    </div>
  )
}

export default JobPhotoGallery
