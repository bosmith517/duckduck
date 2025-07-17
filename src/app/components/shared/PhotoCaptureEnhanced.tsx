import React, { useState, useRef, useCallback, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { showToast } from '../../utils/toast'
import { MobileService, PhotoResult } from '../../services/mobileService'
import { Capacitor } from '@capacitor/core'
import { CameraPreview } from '@capacitor-community/camera-preview'
import { Camera, CameraResultType, CameraSource, GalleryPhotos, PermissionStatus } from '@capacitor/camera'
import type { CameraPreviewOptions, CameraPreviewPictureOptions } from '@capacitor-community/camera-preview'

interface PhotoCaptureEnhancedProps {
  isOpen: boolean
  onClose: () => void
  onPhotosSaved: (photos: { url: string; id: string }[]) => void
  jobId?: string
  costEntryId?: string
  photoType: 'receipt' | 'job_progress' | 'before' | 'after' | 'general' | 'reference'
  title?: string
  maxPhotos?: number
}

interface CapturedPhoto {
  id: string
  file: File
  preview: string
  description: string
  location?: {
    latitude: number
    longitude: number
  }
  status: 'pending' | 'uploading' | 'uploaded' | 'failed'
  progress?: number
  error?: string
}

const PhotoCaptureEnhanced: React.FC<PhotoCaptureEnhancedProps> = ({
  isOpen,
  onClose,
  onPhotosSaved,
  jobId,
  costEntryId,
  photoType,
  title = 'Capture Photos',
  maxPhotos = 50
}) => {
  const { userProfile } = useSupabaseAuth()
  const [photos, setPhotos] = useState<CapturedPhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [cameraLoading, setCameraLoading] = useState(false)
  const [isMobileDevice] = useState(() => Capacitor.isNativePlatform() || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent))
  const [isDragging, setIsDragging] = useState(false)
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set())
  const [batchDescription, setBatchDescription] = useState('')
  const [continuousCapture, setContinuousCapture] = useState(true)
  const [debugNoFallback, setDebugNoFallback] = useState(false) // Debug flag to disable fallback
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  // Cleanup camera preview on unmount
  useEffect(() => {
    return () => {
      if (isMobileDevice && Capacitor.isNativePlatform()) {
        CameraPreview.stop().catch((error: any) => {
          console.error('Error stopping camera preview on cleanup:', error)
        })
      }
      // Clean up preview URLs
      photos.forEach(photo => URL.revokeObjectURL(photo.preview))
    }
  }, [isMobileDevice, photos])

  const getPhotoTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'receipt': 'Receipt',
      'job_progress': 'Job Progress',
      'before': 'Before',
      'after': 'After',
      'general': 'General',
      'reference': 'Reference'
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

  const generatePhotoId = () => {
    return `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  const startCamera = async () => {
    try {
      setCameraLoading(true)
      console.log('[PhotoCapture] Starting camera - isMobileDevice:', isMobileDevice, 'isNativePlatform:', Capacitor.isNativePlatform())
      
      if (isMobileDevice && Capacitor.isNativePlatform()) {
        try {
          console.log('[PhotoCapture] Attempting to start CameraPreview')
          const cameraPreviewOptions: CameraPreviewOptions = {
            position: 'rear',
            height: 400,
            width: window.innerWidth,
            parent: 'cameraPreview',
            className: 'cameraPreview',
            toBack: false
          }
          
          await CameraPreview.start(cameraPreviewOptions)
          console.log('[PhotoCapture] CameraPreview started successfully')
          setCameraLoading(false)
          setShowCamera(true)
          return
        } catch (error) {
          console.error('[PhotoCapture] Camera preview error:', error)
          
          if (debugNoFallback) {
            console.log('[PhotoCapture] Debug mode: Fallback disabled, showing error')
            showToast.error('Camera preview failed (fallback disabled in debug mode)')
            setCameraLoading(false)
            return
          }
          
          console.log('[PhotoCapture] Falling back to native camera (MobileService.takePhoto)')
          // Fall back to native camera
          await captureWithNativeCamera()
          return
        }
      }
      
      // Browser camera for desktop
      const constraints = {
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        
        videoRef.current.onloadedmetadata = () => {
          setCameraLoading(false)
          setShowCamera(true)
        }
        
        await videoRef.current.play()
      }
    } catch (error) {
      console.error('Error accessing camera:', error)
      setCameraLoading(false)
      showToast.error('Could not access camera. Please check permissions.')
    }
  }

  const stopCamera = async () => {
    console.log('[PhotoCapture] Stopping camera - showCamera:', showCamera)
    if (isMobileDevice && Capacitor.isNativePlatform() && showCamera) {
      try {
        console.log('[PhotoCapture] Stopping CameraPreview')
        await CameraPreview.stop()
        console.log('[PhotoCapture] CameraPreview stopped successfully')
      } catch (error) {
        console.error('[PhotoCapture] Error stopping camera preview:', error)
      }
    }
    
    if (streamRef.current) {
      console.log('[PhotoCapture] Stopping browser media stream')
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setShowCamera(false)
    setCameraLoading(false)
  }

  const captureWithNativeCamera = async () => {
    try {
      console.log('[PhotoCapture] Using MobileService.takePhoto fallback')
      console.log('[PhotoCapture] Current photo count:', photos.length, 'Max photos:', maxPhotos)
      console.log('[PhotoCapture] Continuous capture enabled:', continuousCapture)
      
      const photo = await MobileService.takePhoto()
      console.log('[PhotoCapture] Photo captured via MobileService.takePhoto')
      
      const response = await fetch(photo.dataUrl)
      const blob = await response.blob()
      const file = new File([blob], `photo_${Date.now()}.${photo.format}`, { type: `image/${photo.format}` })
      
      const position = await getLocation()
      
      const newPhoto: CapturedPhoto = {
        id: generatePhotoId(),
        file,
        preview: photo.dataUrl,
        description: '',
        location: position ? {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        } : undefined,
        status: 'pending'
      }
      
      setPhotos(prev => {
        const updatedPhotos = [...prev, newPhoto]
        
        // Check continuous capture with updated photo count
        if (continuousCapture && updatedPhotos.length < maxPhotos) {
          console.log('[PhotoCapture] Continuous capture: Scheduling next capture in 500ms (photos:', updatedPhotos.length, '/', maxPhotos, ')')
          setTimeout(() => captureWithNativeCamera(), 500)
        } else {
          console.log('[PhotoCapture] Stopping capture - continuousCapture:', continuousCapture, 'reached limit:', updatedPhotos.length >= maxPhotos)
        }
        
        return updatedPhotos
      })
      showToast.success(`Photo ${photos.length + 1} captured!`)
    } catch (error) {
      console.error('[PhotoCapture] Native camera error:', error)
      showToast.error('Failed to capture photo')
      setCameraLoading(false)
    }
  }

  const capturePhoto = async () => {
    console.log('[PhotoCapture] capturePhoto called - Current photo count:', photos.length, 'Max:', maxPhotos)
    
    if (photos.length >= maxPhotos) {
      showToast.warning(`Maximum ${maxPhotos} photos reached`)
      return
    }

    // Mobile camera preview capture
    if (isMobileDevice && Capacitor.isNativePlatform() && showCamera) {
      try {
        console.log('[PhotoCapture] Using CameraPreview.capture')
        const captureOptions: CameraPreviewPictureOptions = {
          quality: 90
        }
        
        const result = await CameraPreview.capture(captureOptions)
        console.log('[PhotoCapture] CameraPreview.capture successful')
        const base64 = `data:image/jpeg;base64,${result.value}`
        
        const response = await fetch(base64)
        const blob = await response.blob()
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' })
        
        const position = await getLocation()
        
        const newPhoto: CapturedPhoto = {
          id: generatePhotoId(),
          file,
          preview: base64,
          description: '',
          location: position ? {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          } : undefined,
          status: 'pending'
        }
        
        setPhotos(prev => [...prev, newPhoto])
        showToast.success(`Photo ${photos.length + 1} captured!`)
        console.log('[PhotoCapture] Photo added. Total photos:', photos.length + 1, 'showCamera still:', showCamera)
        
        // Haptic feedback on mobile
        if (MobileService.isNativePlatform()) {
          MobileService.hapticFeedback('medium')
        }
        
        return
      } catch (error) {
        console.error('[PhotoCapture] Camera preview capture error:', error)
        showToast.error('Failed to capture photo')
        return
      }
    }
    
    // Browser camera capture
    if (!videoRef.current || !canvasRef.current) {
      showToast.error('Camera not ready')
      return
    }

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    if (!context || video.videoWidth === 0) {
      showToast.error('Camera not ready')
      return
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    canvas.toBlob(async (blob) => {
      if (!blob) {
        showToast.error('Failed to capture photo')
        return
      }

      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' })
      const preview = URL.createObjectURL(blob)
      
      const position = await getLocation()
      
      const newPhoto: CapturedPhoto = {
        id: generatePhotoId(),
        file,
        preview,
        description: '',
        location: position ? {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        } : undefined,
        status: 'pending'
      }

      setPhotos(prev => [...prev, newPhoto])
      showToast.success(`Photo ${photos.length + 1} captured!`)
    }, 'image/jpeg', 0.9)
  }

  const selectMultiplePhotosFromGallery = async () => {
    console.log('[PhotoCapture] selectMultiplePhotosFromGallery called')
    console.log('[PhotoCapture] Platform check - isMobileDevice:', isMobileDevice, 'isNativePlatform:', Capacitor.isNativePlatform())
    
    if (!isMobileDevice || !Capacitor.isNativePlatform()) {
      // For desktop, trigger file input
      console.log('[PhotoCapture] Desktop mode - triggering file input')
      fileInputRef.current?.click()
      return
    }

    try {
      setCameraLoading(true)
      
      // Use Camera.pickImages for multiple selection if available
      const hasPickImages = 'pickImages' in Camera
      console.log('[PhotoCapture] Camera.pickImages available:', hasPickImages)
      
      if (hasPickImages) {
        console.log('[PhotoCapture] Using Camera.pickImages for multi-selection')
        const remainingSlots = maxPhotos - photos.length
        console.log('[PhotoCapture] Requesting up to', remainingSlots, 'photos')
        
        const result = await (Camera as any).pickImages({
          quality: 90,
          limit: remainingSlots
        }) as GalleryPhotos
        
        console.log('[PhotoCapture] pickImages result:', result.photos.length, 'photos returned')
        
        const newPhotos: CapturedPhoto[] = []
        const position = await getLocation()
        
        for (const photo of result.photos) {
          const response = await fetch(photo.webPath)
          const blob = await response.blob()
          const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' })
          
          newPhotos.push({
            id: generatePhotoId(),
            file,
            preview: photo.webPath,
            description: '',
            location: position ? {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            } : undefined,
            status: 'pending'
          })
        }
        
        setPhotos(prev => [...prev, ...newPhotos])
        showToast.success(`${newPhotos.length} photos selected!`)
        console.log('[PhotoCapture] Total photos after gallery selection:', photos.length + newPhotos.length)
      } else {
        // Fallback to single selection
        console.log('[PhotoCapture] Falling back to MobileService.selectPhoto (single selection)')
        const photo = await MobileService.selectPhoto()
        
        const response = await fetch(photo.dataUrl)
        const blob = await response.blob()
        const file = new File([blob], `photo_${Date.now()}.${photo.format}`, { type: `image/${photo.format}` })
        
        const position = await getLocation()
        
        const newPhoto: CapturedPhoto = {
          id: generatePhotoId(),
          file,
          preview: photo.dataUrl,
          description: '',
          location: position ? {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          } : undefined,
          status: 'pending'
        }
        
        setPhotos(prev => [...prev, newPhoto])
        showToast.success('Photo selected!')
        console.log('[PhotoCapture] Total photos after single selection:', photos.length + 1)
      }
    } catch (error) {
      console.error('[PhotoCapture] Gallery selection error:', error)
      showToast.error('Failed to select photos')
    } finally {
      setCameraLoading(false)
    }
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    await processSelectedFiles(files)
  }

  const processSelectedFiles = async (files: File[]) => {
    if (files.length === 0) return

    const remainingSlots = maxPhotos - photos.length
    if (remainingSlots <= 0) {
      showToast.warning(`Maximum ${maxPhotos} photos reached`)
      return
    }

    const filesToProcess = files.slice(0, remainingSlots)
    const newPhotos: CapturedPhoto[] = []
    const position = await getLocation()
    
    for (const file of filesToProcess) {
      if (file.size > 10 * 1024 * 1024) {
        showToast.error(`${file.name} is too large (max 10MB)`)
        continue
      }
      
      if (file.type.startsWith('image/')) {
        const preview = URL.createObjectURL(file)
        
        newPhotos.push({
          id: generatePhotoId(),
          file,
          preview,
          description: '',
          location: position ? {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          } : undefined,
          status: 'pending'
        })
      }
    }

    if (newPhotos.length > 0) {
      setPhotos(prev => [...prev, ...newPhotos])
      showToast.success(`${newPhotos.length} photo(s) added!`)
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.target === dropZoneRef.current) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    await processSelectedFiles(files)
  }

  const removePhoto = (id: string) => {
    setPhotos(prev => {
      const updated = prev.filter(p => {
        if (p.id === id) {
          URL.revokeObjectURL(p.preview)
          return false
        }
        return true
      })
      return updated
    })
    setSelectedPhotos(prev => {
      const updated = new Set(prev)
      updated.delete(id)
      return updated
    })
  }

  const updatePhotoDescription = (id: string, description: string) => {
    setPhotos(prev => prev.map(p => 
      p.id === id ? { ...p, description } : p
    ))
  }

  const togglePhotoSelection = (id: string) => {
    setSelectedPhotos(prev => {
      const updated = new Set(prev)
      if (updated.has(id)) {
        updated.delete(id)
      } else {
        updated.add(id)
      }
      return updated
    })
  }

  const selectAllPhotos = () => {
    setSelectedPhotos(new Set(photos.map(p => p.id)))
  }

  const deselectAllPhotos = () => {
    setSelectedPhotos(new Set())
  }

  const removeSelectedPhotos = () => {
    const idsToRemove = Array.from(selectedPhotos)
    setPhotos(prev => prev.filter(p => {
      if (idsToRemove.includes(p.id)) {
        URL.revokeObjectURL(p.preview)
        return false
      }
      return true
    }))
    setSelectedPhotos(new Set())
  }

  const uploadPhoto = async (photo: CapturedPhoto, index: number): Promise<{ url: string; id: string } | null> => {
    try {
      // Update status to uploading
      setPhotos(prev => prev.map(p => 
        p.id === photo.id ? { ...p, status: 'uploading', progress: 0 } : p
      ))

      const fileName = `${userProfile?.tenant_id}/${jobId || 'general'}/${photoType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`
      
      // Create a progress callback
      const onUploadProgress = (progress: number) => {
        setPhotos(prev => prev.map(p => 
          p.id === photo.id ? { ...p, progress } : p
        ))
      }

      // Upload to Supabase storage with progress tracking
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
        description: photo.description || batchDescription || '',
        latitude: photo.location?.latitude,
        longitude: photo.location?.longitude,
        taken_by: userProfile?.id,
        taken_at: new Date().toISOString(),
        batch_upload: true,
        batch_index: index
      }

      const { data: savedPhoto, error: saveError } = await supabase
        .from('job_photos')
        .insert(photoRecord)
        .select()
        .single()

      if (saveError) throw saveError

      // Update status to uploaded
      setPhotos(prev => prev.map(p => 
        p.id === photo.id ? { ...p, status: 'uploaded', progress: 100 } : p
      ))

      return { url: publicUrl, id: savedPhoto.id }
    } catch (error) {
      console.error('Error uploading photo:', error)
      
      // Update status to failed
      setPhotos(prev => prev.map(p => 
        p.id === photo.id ? { ...p, status: 'failed', error: error instanceof Error ? error.message : String(error) } : p
      ))
      
      return null
    }
  }

  const handleBatchUpload = async () => {
    if (photos.length === 0) {
      showToast.error('Please capture or select at least one photo')
      return
    }

    setUploading(true)
    const loadingToast = showToast.loading(`Uploading ${photos.length} photos...`)

    try {
      // Upload photos in parallel batches of 3 to avoid overwhelming the server
      const batchSize = 3
      const uploadedPhotos: { url: string; id: string }[] = []
      
      for (let i = 0; i < photos.length; i += batchSize) {
        const batch = photos.slice(i, i + batchSize)
        const batchPromises = batch.map((photo, idx) => uploadPhoto(photo, i + idx))
        const batchResults = await Promise.all(batchPromises)
        
        batchResults.forEach(result => {
          if (result) uploadedPhotos.push(result)
        })
        
        // Update progress
        showToast.dismiss(loadingToast)
        showToast.loading(`Uploaded ${uploadedPhotos.length} of ${photos.length} photos...`)
      }

      showToast.dismiss(loadingToast)

      const failedCount = photos.length - uploadedPhotos.length
      if (uploadedPhotos.length > 0) {
        showToast.success(
          `${uploadedPhotos.length} photo(s) uploaded successfully${
            failedCount > 0 ? `, ${failedCount} failed` : ''
          }`
        )
        
        onPhotosSaved(uploadedPhotos)
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
    setSelectedPhotos(new Set())
    setBatchDescription('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
      <style>{`
        .photo-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 1rem;
        }
        
        @media (max-width: 768px) {
          .photo-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        
        .photo-card {
          position: relative;
          cursor: pointer;
          transition: transform 0.2s;
        }
        
        .photo-card:hover {
          transform: scale(1.05);
        }
        
        .photo-card.selected {
          outline: 3px solid #3B82F6;
          outline-offset: -3px;
        }
        
        .drag-zone {
          border: 2px dashed #ccc;
          border-radius: 8px;
          padding: 2rem;
          text-align: center;
          transition: all 0.3s;
        }
        
        .drag-zone.dragging {
          border-color: #3B82F6;
          background-color: #EBF5FF;
        }
        
        #cameraPreview {
          position: relative;
          width: 100%;
          height: 100%;
        }
        
        .upload-progress {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: rgba(0,0,0,0.2);
        }
        
        .upload-progress-bar {
          height: 100%;
          background: #10B981;
          transition: width 0.3s;
        }
      `}</style>
      
      <div className="modal-dialog modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <h3 className="modal-title">
              <i className="ki-duotone ki-camera fs-2 text-primary me-3">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              {title} - {getPhotoTypeLabel(photoType)}
              {photos.length > 0 && (
                <span className="badge badge-primary ms-3">{photos.length} photos</span>
              )}
            </h3>
            <button
              type="button"
              className="btn-close"
              onClick={handleClose}
              disabled={uploading}
            ></button>
          </div>

          <div className="modal-body">
            {/* Camera View */}
            {showCamera && (
              <div className="mb-6">
                <div className="position-relative">
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
                      />
                      <canvas ref={canvasRef} style={{ display: 'none' }} />
                    </>
                  )}
                  
                  <div className="position-absolute bottom-0 start-0 end-0 p-3 bg-gradient-dark">
                    <div className="d-flex justify-content-center align-items-center gap-3">
                      <button
                        className="btn btn-light btn-lg"
                        onClick={stopCamera}
                        style={{ minWidth: '100px' }}
                      >
                        <i className="ki-duotone ki-arrow-left fs-6 me-1">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        Back
                      </button>
                      
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
                          <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-primary">
                            {photos.length}
                          </span>
                        )}
                      </button>
                      
                      {isMobileDevice && (
                        <>
                          <div className="form-check form-switch">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id="continuousCapture"
                              checked={continuousCapture}
                              onChange={(e) => setContinuousCapture(e.target.checked)}
                            />
                            <label className="form-check-label text-white" htmlFor="continuousCapture">
                              Continuous
                            </label>
                          </div>
                          
                          {/* Debug toggle - only show in development */}
                          {process.env.NODE_ENV === 'development' && (
                            <div className="form-check form-switch">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id="debugNoFallback"
                                checked={debugNoFallback}
                                onChange={(e) => setDebugNoFallback(e.target.checked)}
                              />
                              <label className="form-check-label text-white" htmlFor="debugNoFallback">
                                Debug: No Fallback
                              </label>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Photo Options */}
            {!showCamera && !uploading && (
              <div>
                {/* Drag & Drop Zone (Desktop only) */}
                {!isMobileDevice && (
                  <div
                    ref={dropZoneRef}
                    className={`drag-zone mb-4 ${isDragging ? 'dragging' : ''}`}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  >
                    <i className="ki-duotone ki-cloud-upload fs-3x text-primary mb-3">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    <p className="mb-2">Drag & drop photos here</p>
                    <p className="text-muted small">or use the buttons below</p>
                  </div>
                )}

                <div className="row g-3 mb-4">
                  <div className={isMobileDevice ? "col-12" : "col-md-6"}>
                    <button
                      className="btn btn-primary w-100 py-4"
                      onClick={startCamera}
                      disabled={cameraLoading || photos.length >= maxPhotos}
                    >
                      <i className="ki-duotone ki-camera fs-2x mb-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <div className="fw-bold">Take Photos</div>
                      <small>Use camera to capture multiple photos</small>
                    </button>
                  </div>
                  
                  <div className={isMobileDevice ? "col-12" : "col-md-6"}>
                    <button
                      className="btn btn-light-primary w-100 py-4"
                      onClick={selectMultiplePhotosFromGallery}
                      disabled={cameraLoading || photos.length >= maxPhotos}
                    >
                      <i className="ki-duotone ki-folder-up fs-2x mb-2 text-primary">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <div className="fw-bold">Choose from Gallery</div>
                      <small className="text-primary">Select multiple photos at once</small>
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

                {/* Batch Description */}
                {photos.length > 0 && (
                  <div className="mb-4">
                    <label className="form-label">Batch Description (Optional)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Add a description for all photos..."
                      value={batchDescription}
                      onChange={(e) => setBatchDescription(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Photo Grid */}
            {photos.length > 0 && !uploading && (
              <div>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="mb-0">Selected Photos ({photos.length}/{maxPhotos})</h6>
                  <div className="btn-group">
                    <button
                      className="btn btn-sm btn-light"
                      onClick={selectAllPhotos}
                    >
                      Select All
                    </button>
                    <button
                      className="btn btn-sm btn-light"
                      onClick={deselectAllPhotos}
                    >
                      Deselect All
                    </button>
                    {selectedPhotos.size > 0 && (
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={removeSelectedPhotos}
                      >
                        Remove Selected ({selectedPhotos.size})
                      </button>
                    )}
                  </div>
                </div>

                <div className="photo-grid">
                  {photos.map((photo) => (
                    <div
                      key={photo.id}
                      className={`photo-card card ${selectedPhotos.has(photo.id) ? 'selected' : ''}`}
                      onClick={() => togglePhotoSelection(photo.id)}
                    >
                      <div className="position-relative">
                        <img
                          src={photo.preview}
                          alt={`Photo ${photo.id}`}
                          className="card-img-top"
                          style={{ height: '150px', objectFit: 'cover' }}
                        />
                        
                        {/* Selection checkbox */}
                        <div className="position-absolute top-0 start-0 m-2">
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={selectedPhotos.has(photo.id)}
                              onChange={(e) => {
                                e.stopPropagation()
                                togglePhotoSelection(photo.id)
                              }}
                            />
                          </div>
                        </div>

                        {/* Remove button */}
                        <button
                          className="btn btn-sm btn-danger position-absolute top-0 end-0 m-2"
                          onClick={(e) => {
                            e.stopPropagation()
                            removePhoto(photo.id)
                          }}
                        >
                          <i className="ki-duotone ki-cross fs-6">
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                        </button>

                        {/* Status indicators */}
                        {photo.location && (
                          <div className="position-absolute bottom-0 start-0 m-2">
                            <span className="badge badge-success">
                              <i className="ki-duotone ki-geolocation fs-7">
                                <span className="path1"></span>
                                <span className="path2"></span>
                              </i>
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div className="card-body p-2">
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Description..."
                          value={photo.description}
                          onChange={(e) => {
                            e.stopPropagation()
                            updatePhotoDescription(photo.id, e.target.value)
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload Progress */}
            {uploading && (
              <div>
                <h6 className="mb-4">Uploading Photos...</h6>
                <div className="photo-grid">
                  {photos.map((photo) => (
                    <div key={photo.id} className="card">
                      <div className="position-relative">
                        <img
                          src={photo.preview}
                          alt={`Uploading ${photo.id}`}
                          className="card-img-top"
                          style={{ height: '150px', objectFit: 'cover', opacity: photo.status === 'uploaded' ? 1 : 0.7 }}
                        />
                        
                        {/* Status overlay */}
                        <div className="position-absolute top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center">
                          {photo.status === 'uploading' && (
                            <div className="spinner-border text-white" role="status">
                              <span className="visually-hidden">Uploading...</span>
                            </div>
                          )}
                          {photo.status === 'uploaded' && (
                            <i className="ki-duotone ki-check-circle fs-2x text-success">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                          )}
                          {photo.status === 'failed' && (
                            <i className="ki-duotone ki-cross-circle fs-2x text-danger">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                          )}
                        </div>

                        {/* Progress bar */}
                        {photo.status === 'uploading' && photo.progress !== undefined && (
                          <div className="upload-progress">
                            <div 
                              className="upload-progress-bar" 
                              style={{ width: `${photo.progress}%` }}
                            />
                          </div>
                        )}
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
            {photos.length > 0 && !uploading && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleBatchUpload}
              >
                <i className="ki-duotone ki-cloud-upload fs-5 me-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                Upload {photos.length} Photo{photos.length !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PhotoCaptureEnhanced