import React, { useState, useRef, useCallback } from 'react'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { showToast } from '../../utils/toast'

interface PhotoCaptureProps {
  isOpen: boolean
  onClose: () => void
  onPhotoSaved: (photoUrl: string, photoId: string) => void
  jobId?: string
  costEntryId?: string
  photoType: 'receipt' | 'job_progress' | 'before' | 'after' | 'general'
  title?: string
}

interface CapturedPhoto {
  id?: string
  file: File
  preview: string
  description: string
  location?: {
    latitude: number
    longitude: number
  }
}

const PhotoCapture: React.FC<PhotoCaptureProps> = ({
  isOpen,
  onClose,
  onPhotoSaved,
  jobId,
  costEntryId,
  photoType,
  title = 'Capture Photo'
}) => {
  const { userProfile } = useSupabaseAuth()
  const [photos, setPhotos] = useState<CapturedPhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [description, setDescription] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const getPhotoTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'receipt': 'Receipt',
      'job_progress': 'Job Progress',
      'before': 'Before',
      'after': 'After',
      'general': 'General'
    }
    return labels[type] || 'Photo'
  }

  const getLocation = (): Promise<GeolocationPosition | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null)
        return
      }

      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position),
        (error) => {
          console.warn('Could not get location:', error)
          resolve(null)
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      )
    })
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setShowCamera(true)
      }
    } catch (error) {
      console.error('Error accessing camera:', error)
      showToast.error('Could not access camera. Please check permissions.')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setShowCamera(false)
  }

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    if (!context) return

    // Set canvas size to video size
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Convert canvas to blob
    canvas.toBlob(async (blob) => {
      if (!blob) return

      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' })
      const preview = URL.createObjectURL(blob)
      
      // Get current location
      const position = await getLocation()
      const location = position ? {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      } : undefined

      const newPhoto: CapturedPhoto = {
        file,
        preview,
        description: '',
        location
      }

      setPhotos(prev => [...prev, newPhoto])
      stopCamera()
    }, 'image/jpeg', 0.9)
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const preview = URL.createObjectURL(file)
        
        // Get current location
        const position = await getLocation()
        const location = position ? {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        } : undefined

        const newPhoto: CapturedPhoto = {
          file,
          preview,
          description: '',
          location
        }

        setPhotos(prev => [...prev, newPhoto])
      }
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removePhoto = (index: number) => {
    setPhotos(prev => {
      const updated = [...prev]
      URL.revokeObjectURL(updated[index].preview)
      updated.splice(index, 1)
      return updated
    })
  }

  const updatePhotoDescription = (index: number, description: string) => {
    setPhotos(prev => {
      const updated = [...prev]
      updated[index].description = description
      return updated
    })
  }

  const uploadPhoto = async (photo: CapturedPhoto): Promise<string | null> => {
    try {
      const fileName = `${userProfile?.tenant_id}/${jobId || 'general'}/${photoType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('job-photos')
        .upload(fileName, photo.file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('job-photos')
        .getPublicUrl(fileName)

      // Save photo record to database
      const photoRecord = {
        tenant_id: userProfile?.tenant_id,
        job_id: jobId,
        cost_entry_id: costEntryId,
        photo_type: photoType,
        file_path: fileName,
        file_url: publicUrl,
        description: photo.description || '',
        latitude: photo.location?.latitude,
        longitude: photo.location?.longitude,
        taken_by: userProfile?.id,
        taken_at: new Date().toISOString()
      }

      const { data: savedPhoto, error: saveError } = await supabase
        .from('job_photos')
        .insert(photoRecord)
        .select()
        .single()

      if (saveError) throw saveError

      return savedPhoto.id
    } catch (error) {
      console.error('Error uploading photo:', error)
      return null
    }
  }

  const handleSavePhotos = async () => {
    if (photos.length === 0) {
      showToast.error('Please capture or select at least one photo')
      return
    }

    setUploading(true)
    const loadingToast = showToast.loading('Uploading photos...')

    try {
      const uploadPromises = photos.map(photo => uploadPhoto(photo))
      const results = await Promise.all(uploadPromises)

      const successCount = results.filter(result => result !== null).length
      const failureCount = results.length - successCount

      showToast.dismiss(loadingToast)

      if (successCount > 0) {
        showToast.success(`${successCount} photo(s) uploaded successfully${failureCount > 0 ? `, ${failureCount} failed` : ''}`)
        
        // Call success callback for each uploaded photo
        results.forEach((photoId, index) => {
          if (photoId) {
            onPhotoSaved(photos[index].preview, photoId)
          }
        })

        handleClose()
      } else {
        showToast.error('Failed to upload photos. Please try again.')
      }
    } catch (error) {
      console.error('Error uploading photos:', error)
      showToast.dismiss(loadingToast)
      showToast.error('Failed to upload photos. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleClose = () => {
    stopCamera()
    photos.forEach(photo => URL.revokeObjectURL(photo.preview))
    setPhotos([])
    setDescription('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h3 className="modal-title">
              <i className="ki-duotone ki-camera fs-2 text-primary me-3">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              {title} - {getPhotoTypeLabel(photoType)}
            </h3>
            <button
              type="button"
              className="btn-close"
              onClick={handleClose}
            ></button>
          </div>

          <div className="modal-body">
            {/* Camera View */}
            {showCamera && (
              <div className="mb-6">
                <div className="position-relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-100 rounded"
                    style={{ maxHeight: '400px', objectFit: 'cover' }}
                  />
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                  
                  <div className="position-absolute bottom-0 start-50 translate-middle-x mb-3">
                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-success btn-lg rounded-circle"
                        onClick={capturePhoto}
                        style={{ width: '60px', height: '60px' }}
                      >
                        <i className="ki-duotone ki-camera fs-2">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                      </button>
                      <button
                        className="btn btn-secondary btn-lg rounded-circle"
                        onClick={stopCamera}
                        style={{ width: '60px', height: '60px' }}
                      >
                        <i className="ki-duotone ki-cross fs-2">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Photo Capture Options */}
            {!showCamera && (
              <div className="row g-3 mb-6">
                <div className="col-md-6">
                  <button
                    className="btn btn-primary w-100 py-3"
                    onClick={startCamera}
                  >
                    <i className="ki-duotone ki-camera fs-2x mb-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    <div>Take Photo</div>
                  </button>
                </div>
                <div className="col-md-6">
                  <button
                    className="btn btn-light-primary w-100 py-3"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <i className="ki-duotone ki-folder-up fs-2x mb-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    <div>Choose from Gallery</div>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                  />
                </div>
              </div>
            )}

            {/* Captured Photos */}
            {photos.length > 0 && (
              <div>
                <h6 className="mb-4">Captured Photos ({photos.length})</h6>
                <div className="row g-3">
                  {photos.map((photo, index) => (
                    <div key={index} className="col-md-6">
                      <div className="card">
                        <div className="position-relative">
                          <img
                            src={photo.preview}
                            alt={`Photo ${index + 1}`}
                            className="card-img-top"
                            style={{ height: '200px', objectFit: 'cover' }}
                          />
                          <button
                            className="btn btn-sm btn-danger position-absolute top-0 end-0 m-2"
                            onClick={() => removePhoto(index)}
                          >
                            <i className="ki-duotone ki-cross fs-6">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                          </button>
                          {photo.location && (
                            <div className="position-absolute bottom-0 start-0 m-2">
                              <span className="badge badge-success">
                                <i className="ki-duotone ki-geolocation fs-7 me-1">
                                  <span className="path1"></span>
                                  <span className="path2"></span>
                                </i>
                                GPS
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="card-body">
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="Add description..."
                            value={photo.description}
                            onChange={(e) => updatePhotoDescription(index, e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-light"
              onClick={handleClose}
              disabled={uploading}
            >
              Cancel
            </button>
            {photos.length > 0 && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSavePhotos}
                disabled={uploading}
              >
                {uploading && <span className="spinner-border spinner-border-sm me-2"></span>}
                <i className="ki-duotone ki-cloud-add fs-5 me-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                Save Photos ({photos.length})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PhotoCapture
