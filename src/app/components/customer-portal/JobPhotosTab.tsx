import React, { useState, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'
import PhotoViewer from '../shared/PhotoViewer'
import './JobPhotosTab.css'

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
      <div className="mb-5">
        <h3 className="mb-2">
          <i className="ki-duotone ki-picture fs-2 text-primary me-3">
            <span className="path1"></span>
            <span className="path2"></span>
          </i>
          Job Progress Photos
        </h3>
        <p className="text-muted fs-5 mb-0">
          View all photos from your project • {photos.length} photo{photos.length !== 1 ? 's' : ''} total
        </p>
      </div>

      {/* Photo Gallery by Date */}
      {sortedDates.map((date) => (
        <div key={date} className="mb-8">
          {/* Date Header */}
          <div className="d-flex align-items-center mb-4 pb-2 border-bottom">
            <div className="bg-light-primary rounded p-3 me-3">
              <i className="ki-duotone ki-calendar fs-2x text-primary">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
            </div>
            <div>
              <h4 className="mb-0">{date}</h4>
              <span className="text-muted fs-6">
                {Object.values(groupedPhotosByDate[date]).reduce((sum, photos) => sum + photos.length, 0)} photos uploaded
              </span>
            </div>
          </div>
          
          {/* Photos by Type for this Date */}
          {Object.entries(groupedPhotosByDate[date]).map(([photoType, typePhotos]) => (
            <div key={`${date}-${photoType}`} className="mb-6">
              <div className="d-flex align-items-center mb-4">
                <span className={`badge badge-lg badge-light-${getPhotoTypeColor(photoType)} me-3`}>
                  {getPhotoTypeLabel(photoType)}
                </span>
                <span className="text-muted fs-6">
                  {typePhotos.length} photo{typePhotos.length !== 1 ? 's' : ''}
                </span>
              </div>
              
              {/* Photo Grid */}
              <div className="row g-4">
                {typePhotos.map((photo, index) => (
                  <div key={photo.id} className="col-12 col-sm-6 col-md-4 col-lg-3">
                    <div className="card h-100 shadow-sm hover-elevate-up">
                      <div 
                        className="position-relative overflow-hidden cursor-pointer"
                        style={{ paddingBottom: '75%' }} // 4:3 aspect ratio
                        onClick={() => handlePhotoClick(photo)}
                      >
                        <img
                          src={photo.file_url}
                          alt={photo.description || `${getPhotoTypeLabel(photo.photo_type)} photo`}
                          className="position-absolute top-0 start-0 w-100 h-100"
                          style={{ objectFit: 'cover' }}
                        />
                        
                        {/* Hover overlay */}
                        <div className="position-absolute top-0 start-0 w-100 h-100 bg-dark bg-opacity-0 hover-bg-opacity-50 transition-all d-flex align-items-center justify-content-center">
                          <i className="ki-duotone ki-eye fs-2x text-white opacity-0 hover-opacity-100 transition-all">
                            <span className="path1"></span>
                            <span className="path2"></span>
                            <span className="path3"></span>
                          </i>
                        </div>
                        
                        {/* Photo badges */}
                        <div className="position-absolute top-0 start-0 m-3">
                          <span className={`badge badge-${getPhotoTypeColor(photoType)} shadow`}>
                            {getPhotoTypeLabel(photoType)}
                          </span>
                        </div>
                        
                        {/* Location indicator */}
                        {(photo.latitude && photo.longitude) && (
                          <div className="position-absolute bottom-0 end-0 m-3">
                            <span className="badge badge-success shadow">
                              <i className="ki-duotone ki-geolocation fs-6">
                                <span className="path1"></span>
                                <span className="path2"></span>
                              </i>
                              GPS
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div className="card-body">
                        {photo.description ? (
                          <p className="card-text mb-2" style={{ minHeight: '2.5rem' }}>
                            {photo.description}
                          </p>
                        ) : (
                          <p className="card-text text-muted mb-2" style={{ minHeight: '2.5rem' }}>
                            No description
                          </p>
                        )}
                        <div className="d-flex justify-content-between align-items-center">
                          <small className="text-muted">
                            <i className="ki-duotone ki-time fs-6 me-1">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                            {formatDate(photo.taken_at)}
                          </small>
                          {photo.taken_by_name && (
                            <small className="text-muted">
                              <i className="ki-duotone ki-user fs-6 me-1">
                                <span className="path1"></span>
                                <span className="path2"></span>
                              </i>
                              {photo.taken_by_name}
                            </small>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
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
      />
    </div>
  )
}

export default JobPhotosTab