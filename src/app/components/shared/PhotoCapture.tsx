import React, { useState, useRef, useCallback, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { showToast } from '../../utils/toast'
import { MobileService, PhotoResult } from '../../services/mobileService'
import { Capacitor } from '@capacitor/core'
import { CameraPreview } from '@capacitor-community/camera-preview'
import type { CameraPreviewOptions, CameraPreviewPictureOptions } from '@capacitor-community/camera-preview'

interface PhotoCaptureProps {
  isOpen: boolean
  onClose: () => void
  onPhotoSaved: (photoUrl: string, photoId: string) => void
  jobId?: string
  costEntryId?: string
  photoType: 'receipt' | 'job_progress' | 'before' | 'after' | 'general' | 'reference'
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
  const [cameraLoading, setCameraLoading] = useState(false)
  const [description, setDescription] = useState('')
  const [isMobileDevice] = useState(() => Capacitor.isNativePlatform() || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent))
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Cleanup camera preview on unmount
  useEffect(() => {
    return () => {
      if (isMobileDevice && Capacitor.isNativePlatform()) {
        CameraPreview.stop().catch((error: any) => {
          console.error('Error stopping camera preview on cleanup:', error)
        })
      }
    }
  }, [isMobileDevice])

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
      console.log('Starting camera...')
      setCameraLoading(true)
      
      // Check if we're on a mobile device with native camera support
      if (isMobileDevice && Capacitor.isNativePlatform()) {
        // Use camera preview for mobile devices
        try {
          const cameraPreviewOptions: CameraPreviewOptions = {
            position: 'rear',
            height: 400,
            width: window.innerWidth,
            parent: 'cameraPreview',
            className: 'cameraPreview',
            toBack: false
          }
          
          await CameraPreview.start(cameraPreviewOptions)
          setCameraLoading(false)
          setShowCamera(true)
          return
        } catch (error) {
          console.error('Camera preview error:', error)
          // Fall back to single photo mode
          try {
            const photo = await MobileService.takePhoto()
            
            // Convert dataUrl to File
            const response = await fetch(photo.dataUrl)
            const blob = await response.blob()
            const file = new File([blob], `photo_${Date.now()}.${photo.format}`, { type: `image/${photo.format}` })
            
            // Get location
            const position = await getLocation()
            
            // Add to photos array
            const newPhoto: CapturedPhoto = {
              file,
              preview: photo.dataUrl,
              description: '',
              location: position ? {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
              } : undefined
            }
            
            setPhotos(prev => [...prev, newPhoto])
            setCameraLoading(false)
            // Don't close camera mode on mobile - allow multiple captures
            showToast.success(`Photo ${photos.length + 1} captured! Take another or save all.`)
            return
          } catch (error) {
            console.error('Native camera error:', error)
            showToast.error('Failed to capture photo')
            setCameraLoading(false)
            return
          }
        }
      }
      
      // Fall back to browser camera for desktop
      // First try with environment camera, fallback to any available camera
      let constraints = {
        video: { 
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      }

      let stream: MediaStream
      
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints)
      } catch (envError) {
        console.log('Environment camera failed, trying any camera:', envError)
        // Fallback to any available camera
        constraints = {
          video: { 
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            facingMode: 'user' // Front camera as fallback
          }
        }
        stream = await navigator.mediaDevices.getUserMedia(constraints)
      }
      
      console.log('Camera stream obtained:', stream)
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        
        // Wait for video metadata to load
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded')
          setCameraLoading(false)
          setShowCamera(true)
        }
        
        // Add timeout fallback in case metadata never loads
        setTimeout(() => {
          if (cameraLoading) {
            console.log('Camera timeout - showing camera anyway')
            setCameraLoading(false)
            setShowCamera(true)
          }
        }, 3000)
        
        // Force play the video
        await videoRef.current.play().catch(e => {
          console.error('Error playing video:', e)
        })
      } else {
        console.error('Video ref is null')
        setCameraLoading(false)
      }
    } catch (error) {
      console.error('Error accessing camera:', error)
      setCameraLoading(false)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      showToast.error(`Could not access camera: ${errorMessage}. Please check permissions and try again.`)
    }
  }

  const stopCamera = async () => {
    // Stop camera preview if using mobile
    if (isMobileDevice && Capacitor.isNativePlatform() && showCamera) {
      try {
        await CameraPreview.stop()
      } catch (error) {
        console.error('Error stopping camera preview:', error)
      }
    }
    
    // Stop browser camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setShowCamera(false)
    setCameraLoading(false)
  }

  const capturePhoto = async () => {
    console.log('Attempting to capture photo...')
    
    // Use camera preview capture for mobile
    if (isMobileDevice && Capacitor.isNativePlatform() && showCamera) {
      try {
        const captureOptions: CameraPreviewPictureOptions = {
          quality: 90
        }
        
        const result = await CameraPreview.capture(captureOptions)
        const base64 = `data:image/jpeg;base64,${result.value}`
        
        // Convert base64 to blob
        const response = await fetch(base64)
        const blob = await response.blob()
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' })
        
        // Get location
        const position = await getLocation()
        
        const newPhoto: CapturedPhoto = {
          file,
          preview: base64,
          description: '',
          location: position ? {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          } : undefined
        }
        
        setPhotos(prev => [...prev, newPhoto])
        showToast.success(`Photo ${photos.length + 1} captured!`)
        return
      } catch (error) {
        console.error('Camera preview capture error:', error)
        showToast.error('Failed to capture photo')
        return
      }
    }
    
    // Browser camera capture logic
    if (!videoRef.current || !canvasRef.current) {
      console.error('Video or canvas ref is null:', { video: !!videoRef.current, canvas: !!canvasRef.current })
      showToast.error('Camera not ready. Please try again.')
      return
    }

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    if (!context) {
      console.error('Could not get canvas context')
      showToast.error('Canvas error. Please try again.')
      return
    }

    console.log('Video dimensions:', { width: video.videoWidth, height: video.videoHeight })

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.error('Video dimensions are zero - video may not be ready')
      showToast.error('Camera not ready. Please wait a moment and try again.')
      return
    }

    // Set canvas size to video size
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    console.log('Canvas capture completed, converting to blob...')

    // Convert canvas to blob
    canvas.toBlob(async (blob) => {
      if (!blob) {
        console.error('Failed to create blob from canvas')
        showToast.error('Failed to capture photo. Please try again.')
        return
      }

      console.log('Blob created successfully:', { size: blob.size, type: blob.type })

      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' })
      const preview = URL.createObjectURL(blob)
      
      console.log('Getting location...')
      // Get current location
      const position = await getLocation()
      const location = position ? {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      } : undefined

      console.log('Location obtained:', location)

      const newPhoto: CapturedPhoto = {
        file,
        preview,
        description: '',
        location
      }

      console.log('Adding photo to state...')
      setPhotos(prev => {
        const updated = [...prev, newPhoto]
        console.log('Photos updated, new count:', updated.length)
        return updated
      })
      
      showToast.success('Photo captured successfully!')
      // Don't stop camera - allow multiple photos
    }, 'image/jpeg', 0.9)
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File selection started...')
    const files = Array.from(event.target.files || [])
    console.log('Files selected:', files.length)
    
    if (files.length === 0) {
      console.log('No files selected')
      return
    }

    let addedCount = 0
    
    for (const file of files) {
      console.log('Processing file:', { 
        name: file.name, 
        type: file.type, 
        size: file.size,
        sizeMB: (file.size / 1024 / 1024).toFixed(2) + ' MB'
      })
      
      // Check file size (limit to 10MB)
      if (file.size > 10 * 1024 * 1024) {
        console.error('File too large:', file.name)
        showToast.error(`File ${file.name} is too large. Maximum size is 10MB.`)
        continue
      }
      
      if (file.type.startsWith('image/') || file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        try {
          // For mobile, sometimes the type is empty, so we check the extension too
          const preview = URL.createObjectURL(file)
          console.log('Preview URL created:', preview)
          
          // Get current location
          console.log('Getting location for uploaded file...')
          const position = await getLocation()
          const location = position ? {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          } : undefined

          console.log('Location obtained for uploaded file:', location)

          const newPhoto: CapturedPhoto = {
            file,
            preview,
            description: '',
            location
          }

          setPhotos(prev => {
            const updated = [...prev, newPhoto]
            console.log('File added to photos, new count:', updated.length)
            return updated
          })
          
          addedCount++
        } catch (error) {
          console.error('Error processing file:', file.name, error)
          showToast.error(`Failed to process file: ${file.name}`)
        }
      } else {
        console.log('Skipping non-image file:', file.type)
        showToast.error(`File ${file.name} is not an image file`)
      }
    }

    if (addedCount > 0) {
      showToast.success(`${addedCount} photo(s) selected successfully`)
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    
    console.log('File selection completed')
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
      console.log('Starting photo upload...', {
        tenantId: userProfile?.tenant_id,
        jobId,
        photoType,
        fileSize: photo.file.size,
        fileType: photo.file.type
      })

      const fileName = `${userProfile?.tenant_id}/${jobId || 'general'}/${photoType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`
      console.log('Generated filename:', fileName)
      
      console.log('Uploading to Supabase storage...')
      
      // First check if the bucket exists
      const { data: buckets } = await supabase.storage.listBuckets()
      console.log('Available storage buckets:', buckets?.map(b => b.name))
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('job-photos')
        .upload(fileName, photo.file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Storage upload error:', {
          error: uploadError,
          message: uploadError.message,
          fileName,
          bucketName: 'job-photos'
        })
        
        // Check if it's a bucket not found error
        if (uploadError.message?.includes('not found') || uploadError.message?.includes('404')) {
          throw new Error('Storage bucket "job-photos" not found. Please create the bucket in Supabase.')
        }
        
        throw uploadError
      }

      console.log('Storage upload successful:', uploadData)

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('job-photos')
        .getPublicUrl(fileName)

      console.log('Public URL generated:', publicUrl)

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

      console.log('Saving photo record to database:', photoRecord)

      const { data: savedPhoto, error: saveError } = await supabase
        .from('job_photos')
        .insert(photoRecord)
        .select()
        .single()

      if (saveError) {
        console.error('Database save error:', saveError)
        throw saveError
      }

      console.log('Photo record saved successfully:', savedPhoto)

      return savedPhoto.id
    } catch (error) {
      console.error('Error uploading photo:', error)
      
      // Provide specific error messages
      if (error instanceof Error) {
        if (error.message.includes('bucket')) {
          showToast.error('Storage not configured. Please contact support.')
        } else if (error.message.includes('size')) {
          showToast.error('Photo too large. Please reduce size and try again.')
        } else if (error.message.includes('network')) {
          showToast.error('Network error. Please check your connection.')
        } else {
          showToast.error(`Upload failed: ${error.message}`)
        }
      } else {
        showToast.error('Upload failed. Please try again.')
      }
      
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

  const handleClose = async () => {
    await stopCamera()
    photos.forEach(photo => URL.revokeObjectURL(photo.preview))
    setPhotos([])
    setDescription('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
      <style>{`
        .cameraPreview {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }
        
        #cameraPreview {
          position: relative;
          width: 100%;
          height: 100%;
        }
        
        /* Ensure camera preview is visible on mobile */
        @media (max-width: 768px) {
          .modal-dialog {
            margin: 0;
            max-width: 100%;
            height: 100vh;
          }
          
          .modal-content {
            height: 100%;
            border-radius: 0;
          }
          
          .modal-body {
            padding: 0.5rem;
          }
          
          #cameraPreview {
            height: calc(100vh - 200px) !important;
            max-height: 500px;
          }
        }
      `}</style>
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
                  {/* Camera preview container for mobile */}
                  {isMobileDevice && Capacitor.isNativePlatform() ? (
                    <div 
                      id="cameraPreview" 
                      className="w-100 rounded overflow-hidden"
                      style={{ height: '400px', backgroundColor: '#000' }}
                    />
                  ) : (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-100 rounded"
                        style={{ maxHeight: '400px', objectFit: 'cover' }}
                        onError={(e) => {
                          console.error('Video element error:', e)
                          showToast.error('Video display error. Please try again.')
                        }}
                        onCanPlay={() => {
                          console.log('Video can play')
                        }}
                        onLoadStart={() => {
                          console.log('Video load started')
                        }}
                      />
                      <canvas ref={canvasRef} style={{ display: 'none' }} />
                    </>
                  )}
                  
                  {/* Photo count badge */}
                  {photos.length > 0 && (
                    <div className="position-absolute top-0 end-0 m-3">
                      <span className="badge bg-success fs-6">
                        {photos.length} photo{photos.length !== 1 ? 's' : ''} taken
                      </span>
                    </div>
                  )}
                  
                  <div className="position-absolute bottom-0 start-0 end-0 p-3 bg-gradient-dark">
                    <div className="d-flex justify-content-center align-items-center gap-3">
                      {photos.length > 0 && (
                        <button
                          className="btn btn-primary btn-lg shadow"
                          onClick={stopCamera}
                          style={{ minWidth: '100px' }}
                        >
                          <i className="ki-duotone ki-check fs-6 me-1">
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                          Done
                        </button>
                      )}
                      
                      <button
                        className="btn btn-success btn-lg rounded-circle shadow position-relative"
                        onClick={capturePhoto}
                        style={{ width: '80px', height: '80px' }}
                        title="Take Photo"
                      >
                        <i className="ki-duotone ki-camera fs-1">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        {photos.length > 0 && (
                          <span 
                            className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-primary"
                            style={{ fontSize: '0.75rem' }}
                          >
                            {photos.length}
                          </span>
                        )}
                      </button>
                      
                      <button
                        className="btn btn-light btn-lg rounded-circle shadow"
                        onClick={async () => {
                          await stopCamera()
                          if (photos.length === 0) {
                            onClose()
                          }
                        }}
                        style={{ width: '60px', height: '60px' }}
                        title="Cancel"
                      >
                        <i className="ki-duotone ki-cross fs-3">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                      </button>
                    </div>
                    
                    {photos.length > 0 && (
                      <div className="text-center mt-2">
                        <small className="text-white bg-dark bg-opacity-75 px-3 py-1 rounded-pill">
                          📸 {photos.length} photo{photos.length !== 1 ? 's' : ''} • Tap to take more
                        </small>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Photo Capture Options */}
            {!showCamera && (
              <div>
                {isMobileDevice && photos.length === 0 && (
                  <div className="alert alert-primary d-flex align-items-center mb-4">
                    <i className="bi bi-camera-fill fs-3 text-primary me-3"></i>
                    <div>
                      <strong>Take Multiple Photos:</strong> Capture photos one by one and save them all together when done.
                    </div>
                  </div>
                )}
                
                <div className="row g-3 mb-6">
                  {/* Show mobile camera interface when photos exist */}
                  {isMobileDevice && photos.length > 0 && (
                    <div className="col-12">
                      <div className="alert alert-success">
                        <i className="bi bi-check-circle me-2"></i>
                        {photos.length} photo{photos.length > 1 ? 's' : ''} captured. Take more or save all.
                      </div>
                    </div>
                  )}
                  
                  <div className="col-12">
                    <button
                      className="btn btn-primary w-100 py-4"
                      onClick={startCamera}
                      disabled={cameraLoading}
                    >
                      {cameraLoading ? (
                        <>
                          <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                          Starting Camera...
                        </>
                      ) : (
                        <>
                          <i className="ki-duotone ki-camera fs-2x mb-2 text-white">
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                          <div className="fw-bold">
                            {photos.length === 0 ? 'Take First Photo' : `Take Another Photo (${photos.length} taken)`}
                          </div>
                          <small className="text-white-75">
                            {isMobileDevice ? 'Tap to open camera' : 'Use camera to capture photos'}
                          </small>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="col-12">
                    {isMobileDevice ? (
                      <button
                        className="btn btn-light-primary w-100 py-4"
                        onClick={async () => {
                          try {
                            setCameraLoading(true)
                            const photo = await MobileService.selectPhoto()
                            
                            // Convert dataUrl to File
                            const response = await fetch(photo.dataUrl)
                            const blob = await response.blob()
                            const file = new File([blob], `photo_${Date.now()}.${photo.format}`, { type: `image/${photo.format}` })
                            
                            // Get location
                            const position = await getLocation()
                            
                            // Add to photos array
                            const newPhoto: CapturedPhoto = {
                              file,
                              preview: photo.dataUrl,
                              description: '',
                              location: position ? {
                                latitude: position.coords.latitude,
                                longitude: position.coords.longitude
                              } : undefined
                            }
                            
                            setPhotos(prev => [...prev, newPhoto])
                            showToast.success('Photo selected successfully')
                          } catch (error) {
                            console.error('Gallery selection error:', error)
                            showToast.error('Failed to select photo')
                          } finally {
                            setCameraLoading(false)
                          }
                        }}
                        disabled={cameraLoading}
                      >
                        <i className="ki-duotone ki-folder-up fs-2x mb-2 text-primary">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        <div className="fw-bold">Choose from Gallery</div>
                        <small className="text-primary">Select photos from your device</small>
                      </button>
                    ) : (
                      <>
                        <label htmlFor="gallery-input" className="btn btn-light-primary w-100 py-4 mb-0">
                          <i className="ki-duotone ki-folder-up fs-2x mb-2 text-primary">
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                          <div className="fw-bold">Choose from Gallery</div>
                          <small className="text-primary">Select multiple photos at once</small>
                        </label>
                        <input
                          id="gallery-input"
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          style={{ display: 'none' }}
                          onChange={handleFileSelect}
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Captured Photos */}
            {photos.length > 0 && (
              <div>
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h6 className="mb-0">Captured Photos ({photos.length})</h6>
                  {isMobileDevice && photos.length > 0 && (
                    <button 
                      className="btn btn-sm btn-success"
                      onClick={() => {
                        // Scroll to save button
                        const modal = document.querySelector('.modal-footer')
                        modal?.scrollIntoView({ behavior: 'smooth' })
                      }}
                    >
                      <i className="bi bi-check-circle me-1"></i>
                      Ready to Save
                    </button>
                  )}
                </div>
                <div className="row g-3">
                  {photos.map((photo, index) => (
                    <div key={index} className={isMobileDevice ? "col-6" : "col-md-6"}>
                      <div className="card">
                        <div className="position-relative">
                          <img
                            src={photo.preview}
                            alt={`Photo ${index + 1}`}
                            className="card-img-top"
                            style={{ height: isMobileDevice ? '150px' : '200px', objectFit: 'cover' }}
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
