import React from 'react'

interface TechnicianProfileProps {
  technician: {
    id: string
    name: string
    title: string
    photo?: string
    yearsExperience: number
    certifications: string[]
    specialties: string[]
    rating: number
    completedJobs: number
    responseTime: string
    bio: string
    languages?: string[]
  }
  showFullProfile?: boolean
}

export const TechnicianProfile: React.FC<TechnicianProfileProps> = ({
  technician,
  showFullProfile = false
}) => {
  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <i
        key={i}
        className={`ki-duotone ki-star fs-6 ${
          i < Math.floor(rating) ? 'text-warning' : 'text-muted'
        }`}
      >
        <span className="path1"></span>
        <span className="path2"></span>
      </i>
    ))
  }

  if (!showFullProfile) {
    return (
      <div className="card card-flush bg-light-primary">
        <div className="card-body p-5">
          <div className="d-flex align-items-center">
            <div className="symbol symbol-60px me-4">
              {technician.photo ? (
                <img src={technician.photo} alt={technician.name} className="symbol-label" />
              ) : (
                <span className="symbol-label bg-primary text-white fs-3">
                  {technician.name.split(' ').map(n => n[0]).join('')}
                </span>
              )}
            </div>
            <div className="flex-grow-1">
              <h5 className="text-dark fw-bold mb-1">{technician.name}</h5>
              <div className="text-muted fs-6 mb-2">{technician.title}</div>
              <div className="d-flex align-items-center">
                {renderStars(technician.rating)}
                <span className="text-muted ms-2 fs-7">({technician.rating}/5)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card card-flush">
      <div className="card-header pt-7">
        <h3 className="card-title align-items-start flex-column">
          <span className="card-label fw-bold text-dark">Your Technician</span>
          <span className="text-muted mt-1 fw-semibold fs-7">
            Meet the professional handling your service
          </span>
        </h3>
      </div>

      <div className="card-body">
        {/* Technician Header */}
        <div className="d-flex align-items-center mb-6">
          <div className="symbol symbol-100px me-5">
            {technician.photo ? (
              <img src={technician.photo} alt={technician.name} className="symbol-label" />
            ) : (
              <span className="symbol-label bg-primary text-white fs-2">
                {technician.name.split(' ').map(n => n[0]).join('')}
              </span>
            )}
          </div>
          <div className="flex-grow-1">
            <h3 className="text-dark fw-bold mb-2">{technician.name}</h3>
            <div className="text-primary fs-5 fw-semibold mb-3">{technician.title}</div>
            
            <div className="d-flex align-items-center mb-2">
              {renderStars(technician.rating)}
              <span className="text-muted ms-2 fs-6">
                {technician.rating}/5 • {technician.completedJobs} jobs completed
              </span>
            </div>

            {technician.languages && technician.languages.length > 0 && (
              <div className="d-flex align-items-center">
                <i className="ki-duotone ki-message-text-2 fs-6 text-muted me-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                  <span className="path3"></span>
                </i>
                <span className="text-muted fs-7">
                  Speaks: {technician.languages.join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Key Stats */}
        <div className="row g-4 mb-6">
          <div className="col-md-4">
            <div className="bg-light-info p-4 rounded text-center">
              <i className="ki-duotone ki-time fs-2x text-info mb-2">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              <div className="fw-bold text-dark fs-3">{technician.yearsExperience}</div>
              <div className="text-muted fs-7">Years Experience</div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="bg-light-success p-4 rounded text-center">
              <i className="ki-duotone ki-medal-star fs-2x text-success mb-2">
                <span className="path1"></span>
                <span className="path2"></span>
                <span className="path3"></span>
              </i>
              <div className="fw-bold text-dark fs-3">{technician.certifications.length}</div>
              <div className="text-muted fs-7">Certifications</div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="bg-light-warning p-4 rounded text-center">
              <i className="ki-duotone ki-timer fs-2x text-warning mb-2">
                <span className="path1"></span>
                <span className="path2"></span>
                <span className="path3"></span>
              </i>
              <div className="fw-bold text-dark fs-3">{technician.responseTime}</div>
              <div className="text-muted fs-7">Avg Response</div>
            </div>
          </div>
        </div>

        {/* About */}
        <div className="mb-6">
          <h5 className="text-dark fw-bold mb-3">About {technician.name.split(' ')[0]}</h5>
          <p className="text-muted fs-6 mb-0">{technician.bio}</p>
        </div>

        {/* Certifications */}
        <div className="mb-6">
          <h5 className="text-dark fw-bold mb-3">
            <i className="ki-duotone ki-medal-star fs-4 text-success me-2">
              <span className="path1"></span>
              <span className="path2"></span>
              <span className="path3"></span>
            </i>
            Certifications & Credentials
          </h5>
          <div className="d-flex flex-wrap gap-2">
            {technician.certifications.map((cert, index) => (
              <span key={index} className="badge badge-light-success fs-7 py-2 px-3">
                <i className="ki-duotone ki-verify fs-7 me-1">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                {cert}
              </span>
            ))}
          </div>
        </div>

        {/* Specialties */}
        <div className="mb-6">
          <h5 className="text-dark fw-bold mb-3">
            <i className="ki-duotone ki-wrench fs-4 text-primary me-2">
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
            Specialties
          </h5>
          <div className="d-flex flex-wrap gap-2">
            {technician.specialties.map((specialty, index) => (
              <span key={index} className="badge badge-light-primary fs-7 py-2 px-3">
                {specialty}
              </span>
            ))}
          </div>
        </div>

        {/* Contact Actions */}
        <div className="border-top pt-5">
          <div className="d-flex gap-3">
            <button className="btn btn-primary flex-grow-1">
              <i className="ki-duotone ki-phone fs-5 me-2">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              Call {technician.name.split(' ')[0]}
            </button>
            <button className="btn btn-light-primary">
              <i className="ki-duotone ki-sms fs-5">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
            </button>
            <button className="btn btn-light-info">
              <i className="ki-duotone ki-message-text-2 fs-5">
                <span className="path1"></span>
                <span className="path2"></span>
                <span className="path3"></span>
              </i>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TechnicianProfile