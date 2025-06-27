import React, { useState, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'

interface TechnicianProfile {
  id: string
  tenant_id: string
  user_id: string
  display_name: string
  title?: string
  bio?: string
  photo_url?: string
  years_experience: number
  certifications: string[]
  specialties: string[]
  languages: string[]
  phone_number?: string
  email?: string
  show_in_portal: boolean
  show_contact_info: boolean
  rating: number
  completed_jobs: number
  response_time_minutes: number
  is_active: boolean
  emergency_available: boolean
}

interface UserProfile {
  id: string
  email: string
  full_name?: string
  role: string
}

const TechnicianProfilesPage: React.FC = () => {
  const [technicians, setTechnicians] = useState<TechnicianProfile[]>([])
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedTechnician, setSelectedTechnician] = useState<TechnicianProfile | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  useEffect(() => {
    loadTechnicians()
    loadAvailableUsers()
  }, [])

  const loadTechnicians = async () => {
    try {
      setLoading(true)
      
      const { data: technicianData, error } = await supabase
        .from('technician_profiles')
        .select(`
          *,
          user_profiles(
            email,
            full_name
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setTechnicians(technicianData || [])
      
    } catch (error) {
      console.error('Error loading technicians:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAvailableUsers = async () => {
    try {
      const { data: userData, error } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, role')
        .in('role', ['admin', 'agent']) // Only users who can be technicians
        .order('full_name')

      if (error) throw error
      setAvailableUsers(userData || [])
      
    } catch (error) {
      console.error('Error loading users:', error)
    }
  }

  const createNewTechnician = () => {
    const newTechnician: Partial<TechnicianProfile> = {
      display_name: '',
      title: '',
      bio: '',
      years_experience: 0,
      certifications: [],
      specialties: [],
      languages: ['English'],
      show_in_portal: true,
      show_contact_info: true,
      rating: 5.0,
      completed_jobs: 0,
      response_time_minutes: 15,
      is_active: true,
      emergency_available: false
    }
    setSelectedTechnician(newTechnician as TechnicianProfile)
    setIsEditing(true)
    setShowModal(true)
  }

  const editTechnician = (technician: TechnicianProfile) => {
    setSelectedTechnician(technician)
    setIsEditing(true)
    setShowModal(true)
  }

  const saveTechnician = async () => {
    if (!selectedTechnician) return

    try {
      setSaving(true)
      
      if (selectedTechnician.id) {
        // Update existing technician
        const { error } = await supabase
          .from('technician_profiles')
          .update({
            display_name: selectedTechnician.display_name,
            title: selectedTechnician.title,
            bio: selectedTechnician.bio,
            photo_url: selectedTechnician.photo_url,
            years_experience: selectedTechnician.years_experience,
            certifications: selectedTechnician.certifications,
            specialties: selectedTechnician.specialties,
            languages: selectedTechnician.languages,
            phone_number: selectedTechnician.phone_number,
            email: selectedTechnician.email,
            show_in_portal: selectedTechnician.show_in_portal,
            show_contact_info: selectedTechnician.show_contact_info,
            rating: selectedTechnician.rating,
            response_time_minutes: selectedTechnician.response_time_minutes,
            is_active: selectedTechnician.is_active,
            emergency_available: selectedTechnician.emergency_available,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedTechnician.id)

        if (error) throw error
      } else {
        // Create new technician
        const { error } = await supabase
          .from('technician_profiles')
          .insert({
            user_id: selectedTechnician.user_id,
            display_name: selectedTechnician.display_name,
            title: selectedTechnician.title,
            bio: selectedTechnician.bio,
            photo_url: selectedTechnician.photo_url,
            years_experience: selectedTechnician.years_experience,
            certifications: selectedTechnician.certifications,
            specialties: selectedTechnician.specialties,
            languages: selectedTechnician.languages,
            phone_number: selectedTechnician.phone_number,
            email: selectedTechnician.email,
            show_in_portal: selectedTechnician.show_in_portal,
            show_contact_info: selectedTechnician.show_contact_info,
            rating: selectedTechnician.rating,
            completed_jobs: 0,
            response_time_minutes: selectedTechnician.response_time_minutes,
            is_active: selectedTechnician.is_active,
            emergency_available: selectedTechnician.emergency_available
          })

        if (error) throw error
      }

      await loadTechnicians()
      setShowModal(false)
      setSelectedTechnician(null)
      setIsEditing(false)
      
    } catch (error) {
      console.error('Error saving technician:', error)
    } finally {
      setSaving(false)
    }
  }

  const handlePhotoUpload = async (file: File) => {
    if (!selectedTechnician) return

    try {
      setUploadingPhoto(true)
      
      const fileName = `technician-${selectedTechnician.id || Date.now()}-${file.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('technician-photos')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('technician-photos')
        .getPublicUrl(fileName)

      setSelectedTechnician({
        ...selectedTechnician,
        photo_url: publicUrl
      })
      
    } catch (error) {
      console.error('Error uploading photo:', error)
    } finally {
      setUploadingPhoto(false)
    }
  }

  const addArrayItem = (field: 'certifications' | 'specialties' | 'languages', value: string) => {
    if (!selectedTechnician || !value.trim()) return
    
    const currentArray = selectedTechnician[field] || []
    if (!currentArray.includes(value.trim())) {
      setSelectedTechnician({
        ...selectedTechnician,
        [field]: [...currentArray, value.trim()]
      })
    }
  }

  const removeArrayItem = (field: 'certifications' | 'specialties' | 'languages', index: number) => {
    if (!selectedTechnician) return
    
    const currentArray = selectedTechnician[field] || []
    setSelectedTechnician({
      ...selectedTechnician,
      [field]: currentArray.filter((_, i) => i !== index)
    })
  }

  const commonSpecialties = [
    'HVAC Installation', 'HVAC Repair', 'Air Conditioning', 'Heating Systems',
    'Electrical Work', 'Plumbing', 'Smart Home Integration', 'Energy Efficiency',
    'Preventive Maintenance', 'Emergency Repairs', 'Commercial Systems'
  ]

  const commonCertifications = [
    'EPA 608 Certification', 'NATE Certified', 'OSHA 10/30', 'Electrical License',
    'Plumbing License', 'Smart Home Professional', 'Energy Star Certified',
    'Manufacturer Certified', 'CPR/First Aid', 'Commercial HVAC'
  ]

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-50">
        <div className="spinner-border text-primary"></div>
      </div>
    )
  }

  return (
    <div className="container-xxl">
      <div className="page-title d-flex flex-column justify-content-center flex-wrap me-3 mb-5">
        <h1 className="page-heading d-flex text-dark fw-bold fs-3 flex-column justify-content-center my-0">
          Technician Profiles
        </h1>
        <span className="page-desc text-muted fs-7 fw-semibold pt-1">
          Manage technician profiles displayed in the customer portal
        </span>
      </div>

      <div className="row g-7">
        <div className="col-lg-12">
          <div className="card card-flush">
            <div className="card-header pt-7">
              <h3 className="card-title align-items-start flex-column">
                <span className="card-label fw-bold text-dark">
                  Team Members ({technicians.length})
                </span>
                <span className="text-muted mt-1 fw-semibold fs-7">
                  Manage who appears in customer portal and their information
                </span>
              </h3>
              <div className="card-toolbar">
                <button className="btn btn-primary" onClick={createNewTechnician}>
                  <i className="ki-duotone ki-plus fs-5 me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Add Technician
                </button>
              </div>
            </div>

            <div className="card-body">
              {technicians.length === 0 ? (
                <div className="text-center py-10">
                  <i className="ki-duotone ki-user-tick fs-4x text-muted mb-4">
                    <span className="path1"></span>
                    <span className="path2"></span>
                    <span className="path3"></span>
                  </i>
                  <h4 className="text-dark mb-3">No Technician Profiles Yet</h4>
                  <p className="text-muted fs-5 mb-5">
                    Create technician profiles to display your team in the customer portal.
                  </p>
                  <button className="btn btn-primary" onClick={createNewTechnician}>
                    <i className="ki-duotone ki-plus fs-5 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    Add First Technician
                  </button>
                </div>
              ) : (
                <div className="row g-4">
                  {technicians.map((technician) => (
                    <div key={technician.id} className="col-lg-6">
                      <div className="card border h-100">
                        <div className="card-body p-5">
                          <div className="d-flex align-items-center mb-4">
                            <div className="symbol symbol-60px me-4">
                              {technician.photo_url ? (
                                <img src={technician.photo_url} alt={technician.display_name} />
                              ) : (
                                <span className="symbol-label bg-light-primary text-primary fs-1 fw-bold">
                                  {technician.display_name.charAt(0)}
                                </span>
                              )}
                            </div>
                            <div className="flex-grow-1">
                              <h5 className="text-dark fw-bold mb-1">{technician.display_name}</h5>
                              <div className="text-muted fs-6">{technician.title || 'Technician'}</div>
                              <div className="d-flex align-items-center mt-1">
                                <span className={`badge badge-light-${technician.is_active ? 'success' : 'danger'} me-2`}>
                                  {technician.is_active ? 'Active' : 'Inactive'}
                                </span>
                                {technician.show_in_portal && (
                                  <span className="badge badge-light-info">Visible in Portal</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="mb-4">
                            <div className="row g-3">
                              <div className="col-6">
                                <div className="bg-light-success p-3 rounded text-center">
                                  <div className="fw-bold text-dark fs-4">{technician.rating.toFixed(1)}</div>
                                  <div className="text-muted fs-8">Rating</div>
                                </div>
                              </div>
                              <div className="col-6">
                                <div className="bg-light-primary p-3 rounded text-center">
                                  <div className="fw-bold text-dark fs-4">{technician.years_experience}</div>
                                  <div className="text-muted fs-8">Years Exp.</div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {technician.bio && (
                            <div className="mb-4">
                              <p className="text-muted fs-6 mb-0">
                                {technician.bio.length > 100 
                                  ? `${technician.bio.substring(0, 100)}...` 
                                  : technician.bio
                                }
                              </p>
                            </div>
                          )}

                          <div className="mb-4">
                            <div className="d-flex flex-wrap gap-1">
                              {technician.specialties.slice(0, 3).map((specialty, index) => (
                                <span key={index} className="badge badge-light-info fs-8">
                                  {specialty}
                                </span>
                              ))}
                              {technician.specialties.length > 3 && (
                                <span className="badge badge-light-secondary fs-8">
                                  +{technician.specialties.length - 3} more
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="d-flex justify-content-between align-items-center">
                            <div className="text-muted fs-7">
                              {technician.completed_jobs} jobs completed
                            </div>
                            <button 
                              className="btn btn-sm btn-light-primary"
                              onClick={() => editTechnician(technician)}
                            >
                              <i className="ki-duotone ki-pencil fs-5">
                                <span className="path1"></span>
                                <span className="path2"></span>
                              </i>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Technician Modal */}
      {showModal && selectedTechnician && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-xl">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">
                  {isEditing && selectedTechnician.id ? 'Edit' : 'Add'} Technician Profile
                </h4>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowModal(false)}
                ></button>
              </div>
              
              <div className="modal-body">
                <div className="row g-5">
                  {/* Basic Information */}
                  <div className="col-md-6">
                    <h5 className="fw-bold text-dark mb-4">Basic Information</h5>
                    
                    {!selectedTechnician.id && (
                      <div className="mb-5">
                        <label className="form-label required">User Account</label>
                        <select
                          className="form-select"
                          value={selectedTechnician.user_id || ''}
                          onChange={(e) => setSelectedTechnician({...selectedTechnician, user_id: e.target.value})}
                        >
                          <option value="">Select user account...</option>
                          {availableUsers.map(user => (
                            <option key={user.id} value={user.id}>
                              {user.full_name || user.email} ({user.role})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="mb-5">
                      <label className="form-label required">Display Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={selectedTechnician.display_name}
                        onChange={(e) => setSelectedTechnician({...selectedTechnician, display_name: e.target.value})}
                        placeholder="John Smith"
                      />
                    </div>

                    <div className="mb-5">
                      <label className="form-label">Job Title</label>
                      <input
                        type="text"
                        className="form-control"
                        value={selectedTechnician.title || ''}
                        onChange={(e) => setSelectedTechnician({...selectedTechnician, title: e.target.value})}
                        placeholder="Senior HVAC Technician"
                      />
                    </div>

                    <div className="mb-5">
                      <label className="form-label">Bio</label>
                      <textarea
                        className="form-control"
                        rows={4}
                        value={selectedTechnician.bio || ''}
                        onChange={(e) => setSelectedTechnician({...selectedTechnician, bio: e.target.value})}
                        placeholder="Brief description of experience and expertise..."
                      />
                    </div>

                    <div className="mb-5">
                      <label className="form-label">Years of Experience</label>
                      <input
                        type="number"
                        className="form-control"
                        value={selectedTechnician.years_experience}
                        onChange={(e) => setSelectedTechnician({...selectedTechnician, years_experience: parseInt(e.target.value) || 0})}
                        min="0"
                        max="50"
                      />
                    </div>
                  </div>

                  {/* Photo and Contact */}
                  <div className="col-md-6">
                    <h5 className="fw-bold text-dark mb-4">Photo & Contact</h5>
                    
                    <div className="mb-5">
                      <label className="form-label">Profile Photo</label>
                      <div className="d-flex align-items-center gap-4">
                        {selectedTechnician.photo_url ? (
                          <img 
                            src={selectedTechnician.photo_url} 
                            alt="Profile" 
                            className="rounded"
                            style={{ width: '80px', height: '80px', objectFit: 'cover' }}
                          />
                        ) : (
                          <div 
                            className="symbol symbol-80px"
                            style={{ backgroundColor: '#f1f3f4' }}
                          >
                            <span className="symbol-label text-muted fs-2">
                              {selectedTechnician.display_name?.charAt(0) || '?'}
                            </span>
                          </div>
                        )}
                        <label className="btn btn-light-primary">
                          <i className="ki-duotone ki-cloud-upload fs-5 me-2">
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                          {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                          <input
                            type="file"
                            className="d-none"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handlePhotoUpload(file)
                            }}
                            disabled={uploadingPhoto}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="mb-5">
                      <label className="form-label">Phone Number</label>
                      <input
                        type="tel"
                        className="form-control"
                        value={selectedTechnician.phone_number || ''}
                        onChange={(e) => setSelectedTechnician({...selectedTechnician, phone_number: e.target.value})}
                        placeholder="(555) 123-4567"
                      />
                    </div>

                    <div className="mb-5">
                      <label className="form-label">Email</label>
                      <input
                        type="email"
                        className="form-control"
                        value={selectedTechnician.email || ''}
                        onChange={(e) => setSelectedTechnician({...selectedTechnician, email: e.target.value})}
                        placeholder="john@company.com"
                      />
                    </div>

                    <div className="mb-5">
                      <label className="form-label">Rating</label>
                      <input
                        type="number"
                        className="form-control"
                        value={selectedTechnician.rating}
                        onChange={(e) => setSelectedTechnician({...selectedTechnician, rating: parseFloat(e.target.value) || 5.0})}
                        min="0"
                        max="5"
                        step="0.1"
                      />
                    </div>
                  </div>
                </div>

                {/* Skills and Specialties */}
                <div className="row g-5 mt-2">
                  <div className="col-md-6">
                    <h6 className="fw-bold text-dark mb-3">Specialties</h6>
                    <div className="d-flex flex-wrap gap-2 mb-3">
                      {selectedTechnician.specialties.map((specialty, index) => (
                        <span key={index} className="badge badge-light-info d-flex align-items-center">
                          {specialty}
                          <button
                            type="button"
                            className="btn-close btn-close-sm ms-2"
                            onClick={() => removeArrayItem('specialties', index)}
                          />
                        </span>
                      ))}
                    </div>
                    <div className="d-flex gap-2">
                      <select
                        className="form-select"
                        onChange={(e) => {
                          if (e.target.value) {
                            addArrayItem('specialties', e.target.value)
                            e.target.value = ''
                          }
                        }}
                      >
                        <option value="">Add specialty...</option>
                        {commonSpecialties.map(specialty => (
                          <option key={specialty} value={specialty}>{specialty}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="col-md-6">
                    <h6 className="fw-bold text-dark mb-3">Certifications</h6>
                    <div className="d-flex flex-wrap gap-2 mb-3">
                      {selectedTechnician.certifications.map((cert, index) => (
                        <span key={index} className="badge badge-light-success d-flex align-items-center">
                          {cert}
                          <button
                            type="button"
                            className="btn-close btn-close-sm ms-2"
                            onClick={() => removeArrayItem('certifications', index)}
                          />
                        </span>
                      ))}
                    </div>
                    <div className="d-flex gap-2">
                      <select
                        className="form-select"
                        onChange={(e) => {
                          if (e.target.value) {
                            addArrayItem('certifications', e.target.value)
                            e.target.value = ''
                          }
                        }}
                      >
                        <option value="">Add certification...</option>
                        {commonCertifications.map(cert => (
                          <option key={cert} value={cert}>{cert}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Portal Settings */}
                <div className="row g-5 mt-2">
                  <div className="col-12">
                    <h6 className="fw-bold text-dark mb-3">Portal Settings</h6>
                    <div className="row g-3">
                      <div className="col-md-3">
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={selectedTechnician.show_in_portal}
                            onChange={(e) => setSelectedTechnician({...selectedTechnician, show_in_portal: e.target.checked})}
                          />
                          <label className="form-check-label">Show in Portal</label>
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={selectedTechnician.show_contact_info}
                            onChange={(e) => setSelectedTechnician({...selectedTechnician, show_contact_info: e.target.checked})}
                          />
                          <label className="form-check-label">Show Contact Info</label>
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={selectedTechnician.is_active}
                            onChange={(e) => setSelectedTechnician({...selectedTechnician, is_active: e.target.checked})}
                          />
                          <label className="form-check-label">Active</label>
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={selectedTechnician.emergency_available}
                            onChange={(e) => setSelectedTechnician({...selectedTechnician, emergency_available: e.target.checked})}
                          />
                          <label className="form-check-label">Emergency Available</label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="modal-footer">
                <button 
                  className="btn btn-primary"
                  onClick={saveTechnician}
                  disabled={saving || !selectedTechnician.display_name || (!selectedTechnician.id && !selectedTechnician.user_id)}
                >
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <i className="ki-duotone ki-check fs-5 me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Save Profile
                    </>
                  )}
                </button>
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TechnicianProfilesPage