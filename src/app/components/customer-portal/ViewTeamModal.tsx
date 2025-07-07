import React from 'react'

interface TeamMember {
  id: string
  name: string
  role: string
  phone?: string
  email?: string
  avatar?: string
  skills?: string[]
  experience?: string
}

interface ViewTeamModalProps {
  isOpen: boolean
  onClose: () => void
  currentJob?: any
  tenantPhone?: string | null
}

const ViewTeamModal: React.FC<ViewTeamModalProps> = ({ 
  isOpen, 
  onClose, 
  currentJob,
  tenantPhone 
}) => {
  if (!isOpen) return null

  // Mock team data - in real app this would come from props or API
  const teamMembers: TeamMember[] = [
    {
      id: '1',
      name: currentJob?.technician_name || 'Mike Rodriguez',
      role: 'Lead Technician',
      phone: currentJob?.technician_phone || tenantPhone || '',
      email: 'mike.rodriguez@company.com',
      skills: ['HVAC', 'Electrical', 'Plumbing'],
      experience: '8 years'
    },
    {
      id: '2', 
      name: 'Sarah Chen',
      role: 'Project Coordinator',
      phone: tenantPhone || '',
      email: 'sarah.chen@company.com',
      skills: ['Project Management', 'Customer Relations'],
      experience: '5 years'
    }
  ]

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header border-0 pb-0">
            <h3 className="modal-title fw-bold">Your Service Team</h3>
            <button 
              type="button" 
              className="btn-close" 
              onClick={onClose}
              aria-label="Close"
            ></button>
          </div>
          
          <div className="modal-body">
            <div className="mb-4">
              <p className="text-muted">
                Meet the professionals working on your project. You can contact any team member directly.
              </p>
            </div>

            <div className="row g-4">
              {teamMembers.map((member) => (
                <div key={member.id} className="col-md-6">
                  <div className="card border h-100">
                    <div className="card-body text-center">
                      {/* Avatar */}
                      <div className="symbol symbol-75px mx-auto mb-3">
                        {member.avatar ? (
                          <img src={member.avatar} alt={member.name} className="w-100 h-100 object-cover rounded-circle" />
                        ) : (
                          <div className="symbol-label bg-primary text-white fw-bold fs-3">
                            {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </div>
                        )}
                      </div>

                      {/* Name & Role */}
                      <h5 className="fw-bold text-gray-900 mb-1">{member.name}</h5>
                      <div className="text-primary fw-semibold mb-3">{member.role}</div>

                      {/* Experience */}
                      {member.experience && (
                        <div className="text-muted fs-7 mb-3">
                          <i className="ki-duotone ki-medal-star fs-6 text-warning me-1">
                            <span className="path1"></span>
                            <span className="path2"></span>
                            <span className="path3"></span>
                          </i>
                          {member.experience} experience
                        </div>
                      )}

                      {/* Skills */}
                      {member.skills && member.skills.length > 0 && (
                        <div className="mb-4">
                          <div className="d-flex flex-wrap gap-1 justify-content-center">
                            {member.skills.map((skill, index) => (
                              <span key={index} className="badge badge-light-info fs-8">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Contact Actions */}
                      <div className="d-flex gap-2 justify-content-center">
                        {member.phone && (
                          <button 
                            className="btn btn-sm btn-light-success"
                            onClick={() => window.open(`tel:${member.phone}`, '_self')}
                          >
                            <i className="ki-duotone ki-phone fs-6 me-1">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                            Call
                          </button>
                        )}
                        {member.email && (
                          <button 
                            className="btn btn-sm btn-light-primary"
                            onClick={() => window.open(`mailto:${member.email}`, '_self')}
                          >
                            <i className="ki-duotone ki-sms fs-6 me-1">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                            Email
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Emergency Contact */}
            <div className="mt-6 p-4 bg-light-danger rounded">
              <div className="d-flex align-items-center">
                <i className="ki-duotone ki-information-5 fs-2 text-danger me-3">
                  <span className="path1"></span>
                  <span className="path2"></span>
                  <span className="path3"></span>
                </i>
                <div className="flex-grow-1">
                  <div className="fw-bold text-gray-900">Emergency Support</div>
                  <div className="text-muted fs-7">
                    For urgent issues outside business hours, call our emergency line
                  </div>
                </div>
                {tenantPhone && (
                  <button 
                    className="btn btn-danger"
                    onClick={() => window.open(`tel:${tenantPhone}`, '_self')}
                  >
                    <i className="ki-duotone ki-phone fs-5 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    {tenantPhone}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="modal-footer border-0 pt-0">
            <button 
              type="button" 
              className="btn btn-light" 
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ViewTeamModal