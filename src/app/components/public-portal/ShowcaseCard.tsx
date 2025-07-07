import React, { useState } from 'react'

interface ProjectShowcase {
  id: string
  title: string
  description?: string
  category?: string
  duration_days?: number
  client_type?: string
  after_photos?: string[]
  tags?: string[]
}

interface ShowcaseCardProps {
  project: ProjectShowcase
  onClick?: () => void
}

const ShowcaseCard: React.FC<ShowcaseCardProps> = ({ project, onClick }) => {
  const [imageError, setImageError] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  const images = project.after_photos || []
  const hasMultipleImages = images.length > 1

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentImageIndex((prev) => (prev + 1) % images.length)
  }

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  return (
    <div 
      className="showcase-card card h-100 cursor-pointer border-hover"
      onClick={onClick}
    >
      {/* Image Section */}
      <div className="position-relative" style={{ height: '250px', overflow: 'hidden' }}>
        {images.length > 0 && !imageError ? (
          <>
            <img
              src={images[currentImageIndex]}
              alt={project.title}
              className="w-100 h-100"
              style={{ objectFit: 'cover' }}
              onError={() => setImageError(true)}
            />
            
            {/* Image Navigation */}
            {hasMultipleImages && (
              <>
                <button
                  className="btn btn-sm btn-icon btn-white position-absolute start-0 top-50 translate-middle-y ms-2"
                  onClick={handlePrevImage}
                >
                  <i className="ki-duotone ki-left fs-2"></i>
                </button>
                <button
                  className="btn btn-sm btn-icon btn-white position-absolute end-0 top-50 translate-middle-y me-2"
                  onClick={handleNextImage}
                >
                  <i className="ki-duotone ki-right fs-2"></i>
                </button>
                
                {/* Image Indicators */}
                <div className="position-absolute bottom-0 start-50 translate-middle-x mb-2">
                  <div className="d-flex gap-1">
                    {images.map((_: string, index: number) => (
                      <div
                        key={index}
                        className={`bg-white rounded-circle ${index === currentImageIndex ? 'opacity-100' : 'opacity-50'}`}
                        style={{ width: '6px', height: '6px' }}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="w-100 h-100 bg-light d-flex align-items-center justify-content-center">
            <i className="ki-duotone ki-picture fs-3x text-gray-400">
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
          </div>
        )}
        
        {/* Category Badge */}
        {project.category && (
          <span className="badge badge-primary position-absolute top-0 start-0 m-3">
            {project.category}
          </span>
        )}
      </div>

      {/* Content Section */}
      <div className="card-body">
        <h5 className="card-title fw-bold mb-2">{project.title}</h5>
        
        {project.description && (
          <p className="text-gray-600 mb-3 text-truncate-2">
            {project.description}
          </p>
        )}

        {/* Project Details */}
        <div className="d-flex flex-wrap gap-3 text-gray-600 small">
          {project.duration_days && (
            <div className="d-flex align-items-center gap-1">
              <i className="ki-duotone ki-time fs-6">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              <span>{project.duration_days} days</span>
            </div>
          )}
          
          {project.client_type && (
            <div className="d-flex align-items-center gap-1">
              <i className="ki-duotone ki-user fs-6">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              <span>{project.client_type}</span>
            </div>
          )}
        </div>

        {/* Tags */}
        {project.tags && project.tags.length > 0 && (
          <div className="mt-3">
            <div className="d-flex flex-wrap gap-1">
              {project.tags.slice(0, 3).map((tag: string, index: number) => (
                <span key={index} className="badge badge-light-primary badge-sm">
                  {tag}
                </span>
              ))}
              {project.tags.length > 3 && (
                <span className="badge badge-light badge-sm">
                  +{project.tags.length - 3}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ShowcaseCard