// This component has been replaced with PhotoCaptureEnhanced for multi-photo batch upload support
// This is a legacy wrapper that maintains backward compatibility

import React from 'react'
import PhotoCaptureEnhanced from './PhotoCaptureEnhanced'

interface PhotoCaptureProps {
  isOpen: boolean
  onClose: () => void
  onPhotoSaved: (photoUrl: string, photoId: string) => void
  jobId?: string
  costEntryId?: string
  photoType: 'receipt' | 'job_progress' | 'before' | 'after' | 'general' | 'reference'
  title?: string
  maxPhotos?: number
}

/**
 * Legacy PhotoCapture component wrapper
 * Redirects to PhotoCaptureEnhanced while maintaining backward compatibility
 * with the original single-photo callback interface
 */
const PhotoCapture: React.FC<PhotoCaptureProps> = (props) => {
  // Convert legacy onPhotoSaved callback to batch handler
  const handlePhotosSaved = (photos: { url: string; id: string }[]) => {
    // Call the legacy handler for each photo to maintain compatibility
    photos.forEach(photo => {
      props.onPhotoSaved(photo.url, photo.id)
    })
  }

  return (
    <PhotoCaptureEnhanced
      {...props}
      onPhotosSaved={handlePhotosSaved}
    />
  )
}

export default PhotoCapture