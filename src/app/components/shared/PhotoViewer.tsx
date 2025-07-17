import React, { useState, useEffect } from 'react'
import { KTIcon } from '../../../_metronic/helpers'
// Custom styles in PhotoViewer.css if needed

interface Photo {
  id: string
  file_url: string
  description?: string
  photo_type: string
  taken_at: string
  taken_by?: string
}

interface PhotoViewerProps {
  photos: Photo[]
  initialIndex?: number
  isOpen: boolean
  onClose: () => void
  onDelete?: (photoId: string) => void
}

export const PhotoViewer: React.FC<PhotoViewerProps> = ({
  photos,
  initialIndex = 0,
  isOpen,
  onClose,
  onDelete
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [imageLoading, setImageLoading] = useState(true)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  useEffect(() => {
    setCurrentIndex(initialIndex)
  }, [initialIndex])

  useEffect(() => {
    // Preload adjacent images
    if (photos.length > 0) {
      const preloadIndexes = [
        currentIndex - 1,
        currentIndex,
        currentIndex + 1
      ].filter(i => i >= 0 && i < photos.length)

      preloadIndexes.forEach(index => {
        const img = new Image()
        img.src = photos[index].file_url
      })
    }
  }, [currentIndex, photos])

  const handlePrevious = () => {
    setImageLoading(true)
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : photos.length - 1))
  }

  const handleNext = () => {
    setImageLoading(true)
    setCurrentIndex(prev => (prev < photos.length - 1 ? prev + 1 : 0))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') handlePrevious()
    if (e.key === 'ArrowRight') handleNext()
    if (e.key === 'Escape') onClose()
  }

  // Minimum swipe distance for a valid swipe (in px)
  const minSwipeDistance = 50
  
  // Add visual feedback for swipe
  const [swipeProgress, setSwipeProgress] = useState(0)

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null) // Reset touch end
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return
    
    const currentTouch = e.targetTouches[0].clientX
    setTouchEnd(currentTouch)
    
    // Calculate swipe progress for visual feedback
    const progress = (touchStart - currentTouch) / window.innerWidth
    setSwipeProgress(Math.max(-1, Math.min(1, progress))) // Clamp between -1 and 1
    
    // Prevent vertical scrolling while swiping horizontally
    if (Math.abs(touchStart - currentTouch) > 10) {
      e.preventDefault()
    }
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe && photos.length > 1) {
      handleNext()
    }
    if (isRightSwipe && photos.length > 1) {
      handlePrevious()
    }
    
    // Reset swipe progress
    setSwipeProgress(0)
    setTouchStart(null)
    setTouchEnd(null)
  }

  const handleDeletePhoto = () => {
    if (onDelete && photos[currentIndex]) {
      const photoToDelete = photos[currentIndex]
      
      // Move to next photo or close if last one
      if (photos.length === 1) {
        onClose()
      } else if (currentIndex === photos.length - 1) {
        setCurrentIndex(currentIndex - 1)
      }
      
      onDelete(photoToDelete.id)
    }
  }

  if (!isOpen || photos.length === 0) return null

  const currentPhoto = photos[currentIndex]

  return (
    <div 
      className="modal fade show d-block" 
      style={{ backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 1070 }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="modal-dialog modal-fullscreen">
        <div className="modal-content bg-transparent">
          {/* Header */}
          <div className="modal-header border-0 position-absolute top-0 w-100" style={{ zIndex: 10 }}>
            <div className="d-flex align-items-center">
              <h5 className="modal-title text-white">
                {currentIndex + 1} / {photos.length}
              </h5>
              {currentPhoto.photo_type && (
                <span className="badge bg-primary ms-3">{currentPhoto.photo_type}</span>
              )}
            </div>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
            ></button>
          </div>

          {/* Main Content */}
          <div className="modal-body d-flex align-items-center justify-content-center p-0">
            <div className="container-fluid">
              <div className="row align-items-center">
                {/* Previous Button */}
                <div className="col-auto d-none d-md-block">
                  <button
                    className="btn btn-icon btn-light-primary btn-lg"
                    onClick={handlePrevious}
                    disabled={photos.length <= 1}
                  >
                    <KTIcon iconName="arrow-left" className="fs-1" />
                  </button>
                </div>

                {/* Image Container */}
                <div className="col position-relative">
                  <div 
                    className="text-center position-relative photo-swipe-container"
                    style={{ 
                      minHeight: '300px',
                      touchAction: 'pan-y pinch-zoom', // Allow vertical scroll and zoom but we handle horizontal swipes
                      transform: `translateX(${-swipeProgress * 30}px)`, // Visual swipe feedback
                      transition: swipeProgress === 0 ? 'transform 0.3s ease' : 'none'
                    }}
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                  >
                    {imageLoading && (
                      <div className="position-absolute top-50 start-50 translate-middle">
                        <div className="spinner-border text-light" role="status">
                          <span className="visually-hidden">Loading...</span>
                        </div>
                      </div>
                    )}
                    
                    <img
                      src={currentPhoto.file_url}
                      alt={currentPhoto.description || 'Photo'}
                      className="img-fluid rounded"
                      style={{ 
                        maxHeight: '70vh', 
                        maxWidth: '100%',
                        display: imageLoading ? 'none' : 'block',
                        margin: '0 auto',
                        userSelect: 'none', // Prevent text selection on mobile
                        WebkitUserSelect: 'none',
                        msUserSelect: 'none'
                      }}
                      onLoad={() => setImageLoading(false)}
                      onError={() => setImageLoading(false)}
                      draggable={false} // Prevent drag on desktop
                    />
                  </div>

                  {/* Photo Info */}
                  {currentPhoto.description && (
                    <div className="text-center mt-3">
                      <p className="text-white mb-0">{currentPhoto.description}</p>
                    </div>
                  )}

                  {/* Photo metadata */}
                  <div className="text-center mt-2">
                    <small className="text-white-50">
                      Taken on {new Date(currentPhoto.taken_at).toLocaleDateString()} 
                      at {new Date(currentPhoto.taken_at).toLocaleTimeString()}
                    </small>
                  </div>
                </div>

                {/* Next Button */}
                <div className="col-auto d-none d-md-block">
                  <button
                    className="btn btn-icon btn-light-primary btn-lg"
                    onClick={handleNext}
                    disabled={photos.length <= 1}
                  >
                    <KTIcon iconName="arrow-right" className="fs-1" />
                  </button>
                </div>
              </div>

              {/* Mobile navigation dots and swipe hint */}
              {photos.length > 1 && (
                <div className="row mt-3 d-md-none">
                  <div className="col text-center">
                    {/* Swipe hint for first photo */}
                    {currentIndex === 0 && (
                      <div className="text-white-50 mb-2">
                        <i className="ki-duotone ki-arrow-left fs-5 me-1">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        Swipe to navigate
                        <i className="ki-duotone ki-arrow-right fs-5 ms-1">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                      </div>
                    )}
                    <div className="d-flex justify-content-center gap-2">
                      {photos.map((_, index) => (
                        <button
                          key={index}
                          className={`btn btn-sm rounded-circle p-0 ${
                            index === currentIndex ? 'bg-primary' : 'bg-white opacity-50'
                          }`}
                          style={{ width: '10px', height: '10px' }}
                          onClick={() => {
                            setImageLoading(true)
                            setCurrentIndex(index)
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer with actions - position higher on mobile to avoid chat bubble */}
          <div className="modal-footer border-0 position-absolute w-100" style={{ bottom: '0' }}>
            <div className="d-flex w-100 justify-content-between">
              <div>
                {onDelete && (
                  <button
                    className="btn btn-danger"
                    onClick={handleDeletePhoto}
                  >
                    <KTIcon iconName="trash" className="fs-6 me-1" />
                    Delete Photo
                  </button>
                )}
              </div>
              
              {/* Move mobile buttons higher to avoid chat bubble */}
              <div className="d-flex gap-2" style={{ marginBottom: '80px' }}>
                <button
                  className="btn btn-light d-md-none"
                  onClick={handlePrevious}
                  disabled={photos.length <= 1}
                >
                  <KTIcon iconName="arrow-left" className="fs-6" />
                </button>
                
                <span className="btn btn-light-primary disabled">
                  {currentIndex + 1} / {photos.length}
                </span>
                
                <button
                  className="btn btn-light d-md-none"
                  onClick={handleNext}
                  disabled={photos.length <= 1}
                >
                  <KTIcon iconName="arrow-right" className="fs-6" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PhotoViewer