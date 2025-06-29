import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'
import EquipmentPhotoUpload from './EquipmentPhotoUpload'

interface Equipment {
  id: string
  name: string
  equipment_type: 'hvac' | 'electrical' | 'plumbing' | 'appliance' | 'security' | 'smart_device'
  brand: string
  model: string
  serial_number?: string
  install_date: string
  warranty_expiration?: string
  last_service_date: string
  next_service_due: string
  status: 'excellent' | 'good' | 'needs_attention' | 'urgent' | 'offline'
  efficiency_rating: number // 0-100
  location: string
  notes?: string
  equipment_image_url?: string
  manual_url?: string
  is_smart_enabled: boolean
  serviceHistory: Array<{
    service_date: string
    service_type: string
    technician_name: string
    service_notes: string
  }>
}

interface DigitalTwinProps {
  customerId: string
}

export const DigitalTwin: React.FC<DigitalTwinProps> = ({ customerId }) => {
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showPhotoUpload, setShowPhotoUpload] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'schedule' | 'efficiency'>('overview')
  const sliderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadEquipment()
  }, [customerId])

  const loadEquipment = async () => {
    try {
      setLoading(true)
      
      // Load equipment with service history
      const { data: equipmentData, error: equipmentError } = await supabase
        .from('customer_equipment')
        .select(`
          *,
          equipment_service_history(
            service_date,
            service_type,
            technician_name,
            service_notes
          )
        `)
        .eq('contact_id', customerId)
        .order('created_at', { ascending: false })

      if (equipmentError) {
        console.error('Error loading equipment:', equipmentError)
        setEquipment([])
        return
      }

      // Transform data to match interface
      const transformedEquipment: Equipment[] = equipmentData.map(item => ({
        id: item.id,
        name: item.name,
        equipment_type: item.equipment_type,
        brand: item.brand || 'Unknown',
        model: item.model || 'Unknown',
        serial_number: item.serial_number,
        install_date: item.install_date || new Date().toISOString().split('T')[0],
        warranty_expiration: item.warranty_expiration,
        last_service_date: item.last_service_date || new Date().toISOString().split('T')[0],
        next_service_due: item.next_service_due || new Date().toISOString().split('T')[0],
        status: item.status as any,
        efficiency_rating: item.efficiency_rating || 85,
        location: item.location || 'Unknown',
        notes: item.notes,
        equipment_image_url: item.equipment_image_url || getDefaultImage(item.equipment_type),
        manual_url: item.manual_url,
        is_smart_enabled: item.is_smart_enabled || false,
        serviceHistory: (item.equipment_service_history || []).map((service: any) => ({
          service_date: service.service_date,
          service_type: service.service_type,
          technician_name: service.technician_name,
          service_notes: service.service_notes
        }))
      }))

      setEquipment(transformedEquipment)
      
    } catch (error) {
      console.error('Error loading equipment:', error)
      setEquipment([])
    } finally {
      setLoading(false)
    }
  }

  const getDefaultImage = (equipmentType: string): string => {
    const imageMap: Record<string, string> = {
      'hvac': 'https://images.unsplash.com/photo-1581092335878-9c3ab0d6c6d0?w=400&h=300&fit=crop',
      'electrical': 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400&h=300&fit=crop',
      'plumbing': 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400&h=300&fit=crop',
      'appliance': 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=300&fit=crop',
      'security': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop',
      'smart_device': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop'
    }
    return imageMap[equipmentType] || imageMap['hvac']
  }

  const scrollSlider = (direction: 'left' | 'right') => {
    if (sliderRef.current) {
      const scrollAmount = 320 // Width of one card plus gap
      const currentScroll = sliderRef.current.scrollLeft
      const newScroll = direction === 'left' 
        ? currentScroll - scrollAmount 
        : currentScroll + scrollAmount
      
      sliderRef.current.scrollTo({
        left: newScroll,
        behavior: 'smooth'
      })
    }
  }

  const openEquipmentModal = (item: Equipment) => {
    setSelectedEquipment(item)
    setShowModal(true)
    setActiveTab('overview')
  }

  const closeModal = () => {
    setShowModal(false)
    setSelectedEquipment(null)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'success'
      case 'good': return 'primary'
      case 'needs-attention': return 'warning'
      case 'urgent': return 'danger'
      default: return 'secondary'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent': return 'verify'
      case 'good': return 'check'
      case 'needs-attention': return 'warning-2'
      case 'urgent': return 'danger'
      default: return 'information'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const calculateDaysUntilService = (dueDateString: string) => {
    const dueDate = new Date(dueDateString)
    const today = new Date()
    const diffTime = dueDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const handleEquipmentAdded = (newEquipment: any) => {
    setEquipment(prev => [newEquipment, ...prev])
    setShowPhotoUpload(false)
  }

  if (loading) {
    return (
      <div className="card card-flush">
        <div className="card-body text-center py-10">
          <div className="spinner-border text-primary mb-3"></div>
          <p className="text-muted">Loading your equipment...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="card card-flush">
        <div className="card-header pt-7">
          <h3 className="card-title align-items-start flex-column">
            <span className="card-label fw-bold text-dark">
              <i className="ki-duotone ki-technology-2 fs-3 text-primary me-2">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              Digital Twin - Your Home's Equipment
            </span>
            <span className="text-muted mt-1 fw-semibold fs-7">
              Click any equipment to view detailed information and service history
            </span>
          </h3>
          <div className="card-toolbar">
            <button 
              className="btn btn-sm btn-light-primary"
              onClick={() => setShowPhotoUpload(!showPhotoUpload)}
            >
              <i className="ki-duotone ki-camera fs-5 me-1">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              {showPhotoUpload ? 'Hide Upload' : 'Add Equipment'}
            </button>
          </div>
        </div>

        <div className="card-body">
          {/* Equipment Photo Upload */}
          {showPhotoUpload && (
            <div className="mb-8">
              <EquipmentPhotoUpload 
                customerId={customerId}
                onEquipmentAdded={handleEquipmentAdded}
              />
            </div>
          )}

          {/* Equipment Slider */}
          <div className="position-relative">
            {/* Navigation Buttons */}
            <button 
              className="btn btn-sm btn-light-primary position-absolute top-50 start-0 translate-middle-y"
              style={{ zIndex: 10, marginLeft: '-20px' }}
              onClick={() => scrollSlider('left')}
            >
              <i className="ki-duotone ki-left fs-4">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
            </button>
            
            <button 
              className="btn btn-sm btn-light-primary position-absolute top-50 end-0 translate-middle-y"
              style={{ zIndex: 10, marginRight: '-20px' }}
              onClick={() => scrollSlider('right')}
            >
              <i className="ki-duotone ki-right fs-4">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
            </button>

            {/* Equipment Cards Slider */}
            <div 
              ref={sliderRef}
              className="d-flex gap-4 overflow-auto pb-3"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {equipment.map((item) => {
                const statusColor = getStatusColor(item.status)
                const statusIcon = getStatusIcon(item.status)
                const daysUntilService = calculateDaysUntilService(item.next_service_due)

                return (
                  <div key={item.id} className="flex-shrink-0" style={{ width: '300px' }}>
                    <div 
                      className="card card-bordered cursor-pointer h-100 hover-elevate-up"
                      onClick={() => openEquipmentModal(item)}
                    >
                      {/* Equipment Image */}
                      <div 
                        className="card-img-top"
                        style={{ 
                          height: '200px', 
                          backgroundImage: `url(${item.equipment_image_url})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center'
                        }}
                      >
                        <div className="position-absolute top-0 end-0 m-3">
                          <span className={`badge badge-light-${statusColor}`}>
                            <i className={`ki-duotone ki-${statusIcon} fs-7 me-1`}>
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                            {item.status.replace('-', ' ')}
                          </span>
                        </div>
                      </div>

                      <div className="card-body p-4">
                        <h5 className="text-dark fw-bold mb-2">{item.name}</h5>
                        <div className="text-muted fs-6 mb-3">{item.brand} {item.model}</div>
                        
                        {/* Efficiency Bar */}
                        <div className="mb-3">
                          <div className="d-flex justify-content-between mb-1">
                            <span className="text-muted fs-7">Efficiency</span>
                            <span className="fw-bold fs-7">{item.efficiency_rating}%</span>
                          </div>
                          <div className="progress h-6px">
                            <div 
                              className={`progress-bar bg-${item.efficiency_rating >= 90 ? 'success' : item.efficiency_rating >= 75 ? 'primary' : 'warning'}`}
                              style={{ width: `${item.efficiency_rating}%` }}
                            ></div>
                          </div>
                        </div>

                        <div className="d-flex justify-content-between text-muted fs-7">
                          <span>Next Service:</span>
                          <span className={daysUntilService <= 30 ? 'text-warning fw-bold' : ''}>
                            {daysUntilService > 0 ? `${daysUntilService} days` : 'Overdue'}
                          </span>
                        </div>

                        {item.is_smart_enabled && (
                          <div className="mt-2">
                            <span className="badge badge-light-info">
                              <i className="ki-duotone ki-technology-2 fs-8 me-1">
                                <span className="path1"></span>
                                <span className="path2"></span>
                              </i>
                              Smart Enabled
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Equipment Count & Quick Stats */}
          <div className="row g-4 mt-5">
            <div className="col-md-3">
              <div className="text-center p-4 bg-light-primary rounded">
                <i className="ki-duotone ki-technology-2 fs-2x text-primary mb-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                <div className="fw-bold text-dark fs-3">{equipment.length}</div>
                <div className="text-muted fs-7">Total Equipment</div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="text-center p-4 bg-light-success rounded">
                <i className="ki-duotone ki-verify fs-2x text-success mb-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                <div className="fw-bold text-dark fs-3">
                  {equipment.filter(e => e.status === 'excellent' || e.status === 'good').length}
                </div>
                <div className="text-muted fs-7">Healthy Systems</div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="text-center p-4 bg-light-warning rounded">
                <i className="ki-duotone ki-warning-2 fs-2x text-warning mb-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                <div className="fw-bold text-dark fs-3">
                  {equipment.filter(e => e.status === 'needs_attention').length}
                </div>
                <div className="text-muted fs-7">Need Attention</div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="text-center p-4 bg-light-info rounded">
                <i className="ki-duotone ki-chart-line-up fs-2x text-info mb-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                <div className="fw-bold text-dark fs-3">
                  {equipment.length > 0 ? Math.round(equipment.reduce((sum, e) => sum + e.efficiency_rating, 0) / equipment.length) : 0}%
                </div>
                <div className="text-muted fs-7">Avg Efficiency</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Equipment Detail Modal */}
      {showModal && selectedEquipment && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-xl">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">{selectedEquipment.name}</h4>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={closeModal}
                ></button>
              </div>
              
              <div className="modal-body">
                <div className="row g-5">
                  {/* Equipment Image */}
                  <div className="col-md-5">
                    <img 
                      src={selectedEquipment.equipment_image_url} 
                      alt={selectedEquipment.name}
                      className="w-100 rounded"
                      style={{ height: '300px', objectFit: 'cover' }}
                    />
                  </div>
                  
                  {/* Equipment Info */}
                  <div className="col-md-7">
                    <div className="d-flex align-items-center mb-4">
                      <span className={`badge badge-light-${getStatusColor(selectedEquipment.status)} me-3`}>
                        <i className={`ki-duotone ki-${getStatusIcon(selectedEquipment.status)} fs-7 me-1`}>
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        {selectedEquipment.status.replace('-', ' ').toUpperCase()}
                      </span>
                      <span className="text-muted">{selectedEquipment.location}</span>
                    </div>

                    <div className="row g-4 mb-5">
                      <div className="col-6">
                        <div className="border p-3 rounded text-center">
                          <div className="fw-bold text-dark fs-3">{selectedEquipment.efficiency_rating}%</div>
                          <div className="text-muted fs-7">Efficiency</div>
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="border p-3 rounded text-center">
                          <div className="fw-bold text-dark fs-3">
                            {calculateDaysUntilService(selectedEquipment.next_service_due)}
                          </div>
                          <div className="text-muted fs-7">Days to Service</div>
                        </div>
                      </div>
                    </div>

                    {/* Tabs */}
                    <ul className="nav nav-tabs nav-line-tabs nav-stretch fs-6 border-0 mb-4">
                      <li className="nav-item">
                        <a 
                          className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}
                          href="#"
                          onClick={(e) => { e.preventDefault(); setActiveTab('overview') }}
                        >
                          Overview
                        </a>
                      </li>
                      <li className="nav-item">
                        <a 
                          className={`nav-link ${activeTab === 'schedule' ? 'active' : ''}`}
                          href="#"
                          onClick={(e) => { e.preventDefault(); setActiveTab('schedule') }}
                        >
                          Service History
                        </a>
                      </li>
                      <li className="nav-item">
                        <a 
                          className={`nav-link ${activeTab === 'efficiency' ? 'active' : ''}`}
                          href="#"
                          onClick={(e) => { e.preventDefault(); setActiveTab('efficiency') }}
                        >
                          Performance
                        </a>
                      </li>
                    </ul>

                    {/* Tab Content */}
                    {activeTab === 'overview' && (
                      <div>
                        <div className="d-flex justify-content-between mb-2">
                          <span className="text-muted">Brand & Model:</span>
                          <span className="fw-semibold">{selectedEquipment.brand} {selectedEquipment.model}</span>
                        </div>
                        {selectedEquipment.serial_number && (
                          <div className="d-flex justify-content-between mb-2">
                            <span className="text-muted">Serial Number:</span>
                            <span className="fw-semibold">{selectedEquipment.serial_number}</span>
                          </div>
                        )}
                        <div className="d-flex justify-content-between mb-2">
                          <span className="text-muted">Installation Date:</span>
                          <span className="fw-semibold">{formatDate(selectedEquipment.install_date)}</span>
                        </div>
                        {selectedEquipment.warranty_expiration && (
                          <div className="d-flex justify-content-between mb-2">
                            <span className="text-muted">Warranty Expires:</span>
                            <span className="fw-semibold">{formatDate(selectedEquipment.warranty_expiration)}</span>
                          </div>
                        )}
                        <div className="d-flex justify-content-between mb-2">
                          <span className="text-muted">Next Service Due:</span>
                          <span className="fw-semibold">{formatDate(selectedEquipment.next_service_due)}</span>
                        </div>
                        {selectedEquipment.is_smart_enabled && (
                          <div className="d-flex justify-content-between mb-2">
                            <span className="text-muted">Smart Features:</span>
                            <span className="fw-semibold text-success">Enabled</span>
                          </div>
                        )}
                        {selectedEquipment.notes && (
                          <div className="mt-3">
                            <span className="text-muted">Notes:</span>
                            <div className="fw-semibold">{selectedEquipment.notes}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'schedule' && (
                      <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                        {selectedEquipment.serviceHistory.length > 0 ? (
                          selectedEquipment.serviceHistory.map((service, index) => (
                            <div key={index} className="border-bottom pb-3 mb-3">
                              <div className="d-flex justify-content-between mb-1">
                                <h6 className="text-dark fw-bold">{service.service_type}</h6>
                                <span className="text-muted fs-7">{formatDate(service.service_date)}</span>
                              </div>
                              <p className="text-muted fs-6 mb-1">{service.service_notes}</p>
                              <div className="text-muted fs-7">Technician: {service.technician_name}</div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center text-muted py-4">
                            <i className="ki-duotone ki-calendar fs-3x mb-3">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                            <p>No service history available yet.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'efficiency' && (
                      <div className="text-center">
                        <div className="mb-4">
                          <div className="d-inline-flex align-items-center justify-content-center bg-light-primary rounded-circle" style={{ width: '100px', height: '100px' }}>
                            <span className="text-primary fw-bold fs-2">{selectedEquipment.efficiency_rating}%</span>
                          </div>
                        </div>
                        <p className="text-muted">
                          This equipment is operating at {selectedEquipment.efficiency_rating}% efficiency. 
                          {selectedEquipment.efficiency_rating >= 90 && ' Excellent performance!'}
                          {selectedEquipment.efficiency_rating >= 75 && selectedEquipment.efficiency_rating < 90 && ' Good performance.'}
                          {selectedEquipment.efficiency_rating < 75 && ' Consider maintenance to improve efficiency.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="modal-footer">
                <button className="btn btn-primary">
                  <i className="ki-duotone ki-calendar-add fs-5 me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Schedule Service
                </button>
                {selectedEquipment.manual_url ? (
                  <a 
                    href={selectedEquipment.manual_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="btn btn-light-primary"
                  >
                    <i className="ki-duotone ki-document fs-5 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    View Manual
                  </a>
                ) : (
                  <button className="btn btn-light-secondary" disabled>
                    <i className="ki-duotone ki-document fs-5 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    Manual Not Available
                  </button>
                )}
                <button className="btn btn-secondary text-dark" onClick={closeModal}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default DigitalTwin