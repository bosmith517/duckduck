import React, { useState, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'
import PhotoViewer from '../shared/PhotoViewer'

interface JobPhoto {
  id: string
  photo_type: 'job_progress' | 'before' | 'after' | 'general' | 'reference'
  file_url: string
  description: string
  taken_at: string
  taken_by_name: string
  latitude?: number
  longitude?: number
}

interface JobPhotosTabProps {
  jobId: string
  tenantId: string
}

const JobPhotosTab: React.FC<JobPhotosTabProps> = ({ jobId, tenantId }) => {
  const [photos, setPhotos] = useState<JobPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0)
  const [showPhotoViewer, setShowPhotoViewer] = useState(false)

  useEffect(() => {
    if (jobId && tenantId) {
      loadPhotos()
    }
  }, [jobId, tenantId])

  const loadPhotos = async () => {
    setLoading(true)
    console.log('Loading photos for job:', jobId, 'tenant:', tenantId)
    
    try {
      // Only show customer-appropriate photo types (excluding receipts for privacy)
      const customerPhotoTypes = ['job_progress', 'before', 'after', 'general', 'reference']
      
      const { data, error } = await supabase
        .from('job_photos_view')
        .select('*')
        .eq('job_id', jobId)
        .in('photo_type', customerPhotoTypes)
        .order('taken_at', { ascending: false })

      console.log('Photos query result:', { data, error, count: data?.length })
      
      if (error) throw error
      
      setPhotos(data || [])
    } catch (error) {
      console.error('Error loading photos:', error)
      showToast.error('Failed to load photos')
    } finally {
      setLoading(false)
    }
  }

  const getPhotoTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'job_progress': 'Progress Update',
      'before': 'Before',
      'after': 'After',
      'general': 'General',
      'reference': 'Reference'
    }
    return labels[type] || 'Photo'
  }

  const getPhotoTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'job_progress': 'primary',
      'before': 'warning',
      'after': 'success',
      'general': 'info',
      'reference': 'secondary'
    }
    return colors[type] || 'secondary'
  }

  // Group photos by date first, then by type
  const groupedPhotosByDate = photos.reduce((acc, photo) => {
    const dateKey = new Date(photo.taken_at).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    
    if (!acc[dateKey]) {
      acc[dateKey] = {}
    }
    
    if (!acc[dateKey][photo.photo_type]) {
      acc[dateKey][photo.photo_type] = []
    }
    
    acc[dateKey][photo.photo_type].push(photo)
    return acc
  }, {} as Record<string, Record<string, JobPhoto[]>>)
  
  // Sort dates in descending order (most recent first)
  const sortedDates = Object.keys(groupedPhotosByDate).sort((a, b) => {
    return new Date(b).getTime() - new Date(a).getTime()
  })

  const handlePhotoClick = (photo: JobPhoto) => {
    const index = photos.findIndex(p => p.id === photo.id)
    setSelectedPhotoIndex(index >= 0 ? index : 0)
    setShowPhotoViewer(true)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading photos...</span>
        </div>
        <p className="text-muted mt-3">Loading job photos...</p>
      </div>
    )
  }

  if (photos.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="mb-4">
          <i className="ki-duotone ki-picture fs-3x text-muted">
            <span className="path1"></span>
            <span className="path2"></span>
          </i>
        </div>
        <h5 className="text-muted mb-2">No Photos Available</h5>
        <p className="text-muted">
          Our team will upload progress photos as work begins on your project.
        </p>
      </div>
    )
  }

  return (
    <div className="job-photos-customer">
      <div className="mb-4">
        <h5 className="mb-1">
          <i className="ki-duotone ki-picture fs-3 text-primary me-2">
            <span className="path1"></span>
            <span className="path2"></span>
          </i>
          Job Progress Photos
        </h5>
        <p className="text-muted fs-6 mb-0">
          View real-time photos from your project ({photos.length} photo{photos.length !== 1 ? 's' : ''})
        </p>
      </div>

      {/* Photo Timeline */}
      {sortedDates.map((date) => (
        <div key={date} className="mb-6">
          {/* Date Header */}
          <div className="d-flex align-items-center mb-4">
            <div className="bg-primary rounded-circle p-2 me-3">
              <i className="ki-duotone ki-calendar fs-4 text-white">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
            </div>
            <div>
              <h5 className="mb-0">{date}</h5>
              <span className="text-muted fs-7">
                {Object.values(groupedPhotosByDate[date]).reduce((sum, photos) => sum + photos.length, 0)} photos
              </span>
            </div>
          </div>
          
          {/* Photos by Type for this Date */}
          {Object.entries(groupedPhotosByDate[date]).map(([photoType, typePhotos]) => (
            <div key={`${date}-${photoType}`} className="mb-4 ms-5">
              <div className="d-flex align-items-center mb-3">
                <span className={`badge badge-light-${getPhotoTypeColor(photoType)} me-2`}>
                  {getPhotoTypeLabel(photoType)}
                </span>
                <span className="text-muted fs-8">
                  {typePhotos.length} photo{typePhotos.length !== 1 ? 's' : ''}
                </span>
              </div>
              
              {/* Horizontal Scrollable Photo Slider */}
              <div 
                className="photo-slider-container overflow-auto pb-3" 
                style={{ 
                  whiteSpace: 'nowrap',
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#6c757d #f8f9fa'
                }}
              >
                <div className="d-inline-flex gap-3">
                  {typePhotos.map((photo, index) => (
                    <div 
                      key={photo.id} 
                      className="photo-slide"
                      style={{ width: '200px', flexShrink: 0 }}
                    >
                      <div className="card h-100 shadow-sm">
                        <div className="position-relative">
                          <img
                            src={photo.file_url}
                            alt={photo.description || `${getPhotoTypeLabel(photo.photo_type)} photo`}
                            className="card-img-top cursor-pointer"
                            style={{ height: '150px', objectFit: 'cover' }}
                            onClick={() => handlePhotoClick(photo)}
                          />
                          
                          {/* Photo number badge */}
                          <span className="badge badge-dark position-absolute top-0 start-0 m-2 fs-8">
                            {index + 1} of {typePhotos.length}
                          </span>
                          
                          {/* Location indicator */}
                          {(photo.latitude && photo.longitude) && (
                            <span className="badge badge-success position-absolute bottom-0 start-0 m-2 fs-8">
                              <i className="ki-duotone ki-geolocation fs-7">
                                <span className="path1"></span>
                                <span className="path2"></span>
                              </i>
                            </span>
                          )}
                        </div>
                        
                        <div className="card-body p-2">
                          {photo.description && (
                            <p className="card-text fs-8 mb-1 text-truncate" title={photo.description}>
                              {photo.description}
                            </p>
                          )}
                          <div className="text-muted fs-9">
                            {formatDate(photo.taken_at)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Photo Viewer Modal */}
      <PhotoViewer
        photos={photos}
        initialIndex={selectedPhotoIndex}
        isOpen={showPhotoViewer}
        onClose={() => setShowPhotoViewer(false)}
        readOnly={true}
      />
    </div>
  )
}

export default JobPhotosTab