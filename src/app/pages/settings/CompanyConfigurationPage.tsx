import React, { useState, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'

interface CompanyInfo {
  id: string
  company_name: string
  business_phone: string
  business_email: string
  website: string
  address_line1: string
  address_line2?: string
  city: string
  state: string
  zip_code: string
  license_number?: string
  insurance_info?: string
  logo_url?: string
  emergency_phone?: string
  business_hours: {
    monday: { open: string; close: string; closed: boolean }
    tuesday: { open: string; close: string; closed: boolean }
    wednesday: { open: string; close: string; closed: boolean }
    thursday: { open: string; close: string; closed: boolean }
    friday: { open: string; close: string; closed: boolean }
    saturday: { open: string; close: string; closed: boolean }
    sunday: { open: string; close: string; closed: boolean }
  }
  service_areas: string[]
  specialties: string[]
  customer_portal_settings: {
    show_pricing: boolean
    allow_online_booking: boolean
    show_technician_photos: boolean
    enable_tracking: boolean
    show_service_history: boolean
  }
}

interface DocumentTemplate {
  id: string
  name: string
  type: 'invoice' | 'estimate' | 'service_agreement' | 'work_order'
  file_url: string
  auto_fill_fields: string[]
  uploaded_at: string
}

const CompanyConfigurationPage: React.FC = () => {
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null)
  const [documents, setDocuments] = useState<DocumentTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'company' | 'documents' | 'portal'>('company')
  const [uploadingDocument, setUploadingDocument] = useState(false)

  useEffect(() => {
    loadCompanyConfiguration()
  }, [])

  const loadCompanyConfiguration = async () => {
    try {
      setLoading(true)
      
      // Load company information from enhanced tenants table
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select(`
          *,
          business_phone,
          business_email,
          website,
          address_line1,
          address_line2,
          city,
          state,
          zip_code,
          license_number,
          insurance_info,
          logo_url,
          emergency_phone,
          business_hours,
          service_areas,
          specialties,
          customer_portal_settings
        `)
        .single()

      if (tenantError) throw tenantError

      // Build company info from database
      setCompanyInfo({
        id: tenantData.id,
        company_name: tenantData.company_name || 'Your Service Company',
        business_phone: tenantData.business_phone || '(555) 123-4567',
        business_email: tenantData.business_email || 'info@yourcompany.com',
        website: tenantData.website || 'www.yourcompany.com',
        address_line1: tenantData.address_line1 || '123 Business Ave',
        address_line2: tenantData.address_line2 || '',
        city: tenantData.city || 'Austin',
        state: tenantData.state || 'TX',
        zip_code: tenantData.zip_code || '78701',
        license_number: tenantData.license_number || '',
        insurance_info: tenantData.insurance_info || '',
        logo_url: tenantData.logo_url || '/assets/media/logos/company-logo.png',
        emergency_phone: tenantData.emergency_phone || '',
        business_hours: tenantData.business_hours || {
          monday: { open: '08:00', close: '17:00', closed: false },
          tuesday: { open: '08:00', close: '17:00', closed: false },
          wednesday: { open: '08:00', close: '17:00', closed: false },
          thursday: { open: '08:00', close: '17:00', closed: false },
          friday: { open: '08:00', close: '17:00', closed: false },
          saturday: { open: '09:00', close: '15:00', closed: false },
          sunday: { open: '10:00', close: '14:00', closed: true }
        },
        service_areas: tenantData.service_areas || ['Austin', 'Round Rock', 'Cedar Park'],
        specialties: tenantData.specialties || ['HVAC Repair', 'AC Installation'],
        customer_portal_settings: tenantData.customer_portal_settings || {
          show_pricing: true,
          allow_online_booking: true,
          show_technician_photos: true,
          enable_tracking: true,
          show_service_history: true
        }
      })

      // Load document templates from database
      const { data: documentsData, error: docsError } = await supabase
        .from('document_templates')
        .select(`
          id,
          template_name,
          template_type,
          file_url,
          auto_fill_fields,
          created_at,
          is_active
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (docsError) {
        console.error('Error loading documents:', docsError)
        setDocuments([])
      } else {
        const formattedDocs = documentsData.map(doc => ({
          id: doc.id,
          name: doc.template_name,
          type: doc.template_type as 'invoice' | 'estimate' | 'service_agreement' | 'work_order',
          file_url: doc.file_url,
          auto_fill_fields: doc.auto_fill_fields || [],
          uploaded_at: doc.created_at
        }))
        setDocuments(formattedDocs)
      }

    } catch (error) {
      console.error('Error loading company configuration:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveCompanyInfo = async () => {
    if (!companyInfo) return

    try {
      setSaving(true)
      
      // Update tenant information with all fields
      const { error } = await supabase
        .from('tenants')
        .update({
          company_name: companyInfo.company_name,
          business_phone: companyInfo.business_phone,
          business_email: companyInfo.business_email,
          website: companyInfo.website,
          address_line1: companyInfo.address_line1,
          address_line2: companyInfo.address_line2,
          city: companyInfo.city,
          state: companyInfo.state,
          zip_code: companyInfo.zip_code,
          license_number: companyInfo.license_number,
          insurance_info: companyInfo.insurance_info,
          emergency_phone: companyInfo.emergency_phone,
          business_hours: companyInfo.business_hours,
          service_areas: companyInfo.service_areas,
          specialties: companyInfo.specialties,
          customer_portal_settings: companyInfo.customer_portal_settings,
          updated_at: new Date().toISOString()
        })
        .eq('id', companyInfo.id)

      if (error) throw error

      console.log('Company information saved successfully')
      
    } catch (error) {
      console.error('Error saving company information:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleFileUpload = async (file: File, documentType: string) => {
    try {
      setUploadingDocument(true)
      
      // Upload file to Supabase Storage
      const fileName = `${documentType}-${Date.now()}-${file.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('document-templates')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('document-templates')
        .getPublicUrl(fileName)

      // Save document template record to database
      const { data: docData, error: docError } = await supabase
        .from('document_templates')
        .insert({
          template_name: file.name,
          template_type: documentType,
          file_url: publicUrl,
          file_size: file.size,
          file_type: file.type,
          auto_fill_fields: ['company_name', 'business_phone', 'address_line1', 'business_email'],
          is_active: true
        })
        .select()
        .single()

      if (docError) throw docError

      // Add to local state
      const newDocument: DocumentTemplate = {
        id: docData.id,
        name: docData.template_name,
        type: docData.template_type as any,
        file_url: docData.file_url,
        auto_fill_fields: docData.auto_fill_fields || [],
        uploaded_at: docData.created_at
      }

      setDocuments(prev => [...prev, newDocument])
      console.log('Document uploaded successfully')
      
    } catch (error) {
      console.error('Error uploading document:', error)
    } finally {
      setUploadingDocument(false)
    }
  }

  const updateBusinessHours = (day: string, field: string, value: string | boolean) => {
    if (!companyInfo) return

    setCompanyInfo({
      ...companyInfo,
      business_hours: {
        ...companyInfo.business_hours,
        [day]: {
          ...companyInfo.business_hours[day as keyof typeof companyInfo.business_hours],
          [field]: value
        }
      }
    })
  }

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
          Company Configuration
        </h1>
        <span className="page-desc text-muted fs-7 fw-semibold pt-1">
          Manage your company information and customer portal settings
        </span>
      </div>

      <div className="row g-7">
        <div className="col-lg-12">
          <div className="card card-flush">
            <div className="card-header">
              <ul className="nav nav-tabs nav-line-tabs nav-stretch fs-6 border-0">
                <li className="nav-item">
                  <a 
                    className={`nav-link ${activeTab === 'company' ? 'active' : ''}`}
                    href="#"
                    onClick={(e) => { e.preventDefault(); setActiveTab('company') }}
                  >
                    <i className="ki-duotone ki-office-bag fs-4 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                      <span className="path3"></span>
                      <span className="path4"></span>
                    </i>
                    Company Information
                  </a>
                </li>
                <li className="nav-item">
                  <a 
                    className={`nav-link ${activeTab === 'documents' ? 'active' : ''}`}
                    href="#"
                    onClick={(e) => { e.preventDefault(); setActiveTab('documents') }}
                  >
                    <i className="ki-duotone ki-document fs-4 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    Document Templates
                  </a>
                </li>
                <li className="nav-item">
                  <a 
                    className={`nav-link ${activeTab === 'portal' ? 'active' : ''}`}
                    href="#"
                    onClick={(e) => { e.preventDefault(); setActiveTab('portal') }}
                  >
                    <i className="ki-duotone ki-tablet fs-4 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                      <span className="path3"></span>
                    </i>
                    Customer Portal
                  </a>
                </li>
              </ul>
            </div>

            <div className="card-body">
              {activeTab === 'company' && companyInfo && (
                <div>
                  <div className="row g-5">
                    {/* Basic Information */}
                    <div className="col-md-6">
                      <h5 className="fw-bold text-dark mb-4">Basic Information</h5>
                      
                      <div className="mb-5">
                        <label className="form-label required">Company Name</label>
                        <input
                          type="text"
                          className="form-control"
                          value={companyInfo.company_name}
                          onChange={(e) => setCompanyInfo({...companyInfo, company_name: e.target.value})}
                        />
                      </div>

                      <div className="mb-5">
                        <label className="form-label required">Business Phone</label>
                        <input
                          type="tel"
                          className="form-control"
                          value={companyInfo.business_phone}
                          onChange={(e) => setCompanyInfo({...companyInfo, business_phone: e.target.value})}
                        />
                      </div>

                      <div className="mb-5">
                        <label className="form-label required">Business Email</label>
                        <input
                          type="email"
                          className="form-control"
                          value={companyInfo.business_email}
                          onChange={(e) => setCompanyInfo({...companyInfo, business_email: e.target.value})}
                        />
                      </div>

                      <div className="mb-5">
                        <label className="form-label">Website</label>
                        <input
                          type="url"
                          className="form-control"
                          value={companyInfo.website}
                          onChange={(e) => setCompanyInfo({...companyInfo, website: e.target.value})}
                        />
                      </div>

                      <div className="mb-5">
                        <label className="form-label">Emergency Phone</label>
                        <input
                          type="tel"
                          className="form-control"
                          value={companyInfo.emergency_phone}
                          onChange={(e) => setCompanyInfo({...companyInfo, emergency_phone: e.target.value})}
                        />
                      </div>
                    </div>

                    {/* Address & Licensing */}
                    <div className="col-md-6">
                      <h5 className="fw-bold text-dark mb-4">Address & Licensing</h5>
                      
                      <div className="mb-5">
                        <label className="form-label required">Street Address</label>
                        <input
                          type="text"
                          className="form-control"
                          value={companyInfo.address_line1}
                          onChange={(e) => setCompanyInfo({...companyInfo, address_line1: e.target.value})}
                        />
                      </div>

                      <div className="mb-5">
                        <label className="form-label">Address Line 2</label>
                        <input
                          type="text"
                          className="form-control"
                          value={companyInfo.address_line2 || ''}
                          onChange={(e) => setCompanyInfo({...companyInfo, address_line2: e.target.value})}
                        />
                      </div>

                      <div className="row g-3 mb-5">
                        <div className="col-md-6">
                          <label className="form-label required">City</label>
                          <input
                            type="text"
                            className="form-control"
                            value={companyInfo.city}
                            onChange={(e) => setCompanyInfo({...companyInfo, city: e.target.value})}
                          />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label required">State</label>
                          <input
                            type="text"
                            className="form-control"
                            value={companyInfo.state}
                            onChange={(e) => setCompanyInfo({...companyInfo, state: e.target.value})}
                          />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label required">ZIP Code</label>
                          <input
                            type="text"
                            className="form-control"
                            value={companyInfo.zip_code}
                            onChange={(e) => setCompanyInfo({...companyInfo, zip_code: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="mb-5">
                        <label className="form-label">License Number</label>
                        <input
                          type="text"
                          className="form-control"
                          value={companyInfo.license_number || ''}
                          onChange={(e) => setCompanyInfo({...companyInfo, license_number: e.target.value})}
                        />
                      </div>

                      <div className="mb-5">
                        <label className="form-label">Insurance Information</label>
                        <textarea
                          className="form-control"
                          rows={3}
                          value={companyInfo.insurance_info || ''}
                          onChange={(e) => setCompanyInfo({...companyInfo, insurance_info: e.target.value})}
                          placeholder="e.g., Fully Licensed & Insured, Policy #12345"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Business Hours */}
                  <div className="row g-5 mt-5">
                    <div className="col-12">
                      <h5 className="fw-bold text-dark mb-4">Business Hours</h5>
                      <div className="row g-3">
                        {Object.entries(companyInfo.business_hours).map(([day, hours]) => (
                          <div key={day} className="col-lg-4">
                            <div className="card border">
                              <div className="card-body p-4">
                                <div className="d-flex align-items-center justify-content-between mb-3">
                                  <h6 className="fw-bold text-dark mb-0 text-capitalize">{day}</h6>
                                  <div className="form-check form-switch">
                                    <input
                                      className="form-check-input"
                                      type="checkbox"
                                      checked={!hours.closed}
                                      onChange={(e) => updateBusinessHours(day, 'closed', !e.target.checked)}
                                    />
                                  </div>
                                </div>
                                {!hours.closed && (
                                  <div className="row g-2">
                                    <div className="col-6">
                                      <label className="form-label fs-8">Open</label>
                                      <input
                                        type="time"
                                        className="form-control form-control-sm"
                                        value={hours.open}
                                        onChange={(e) => updateBusinessHours(day, 'open', e.target.value)}
                                      />
                                    </div>
                                    <div className="col-6">
                                      <label className="form-label fs-8">Close</label>
                                      <input
                                        type="time"
                                        className="form-control form-control-sm"
                                        value={hours.close}
                                        onChange={(e) => updateBusinessHours(day, 'close', e.target.value)}
                                      />
                                    </div>
                                  </div>
                                )}
                                {hours.closed && (
                                  <div className="text-center text-muted">
                                    <small>Closed</small>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="row g-5 mt-5">
                    <div className="col-12">
                      <button 
                        className="btn btn-primary"
                        onClick={saveCompanyInfo}
                        disabled={saving}
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
                            Save Company Information
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'documents' && (
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-6">
                    <div>
                      <h5 className="fw-bold text-dark mb-1">Document Templates</h5>
                      <p className="text-muted fs-6 mb-0">
                        Upload your company document templates. Our system will auto-fill your company information.
                      </p>
                    </div>
                    <div>
                      <label className="btn btn-primary">
                        <i className="ki-duotone ki-plus fs-5 me-2">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        Upload Document
                        <input
                          type="file"
                          className="d-none"
                          accept=".pdf,.doc,.docx"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              handleFileUpload(file, 'invoice')
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Document List */}
                  <div className="row g-4">
                    {documents.map((doc) => (
                      <div key={doc.id} className="col-lg-6">
                        <div className="card border">
                          <div className="card-body p-5">
                            <div className="d-flex align-items-center mb-4">
                              <div className="symbol symbol-50px bg-light-primary me-4">
                                <span className="symbol-label">
                                  <i className="ki-duotone ki-document fs-2x text-primary">
                                    <span className="path1"></span>
                                    <span className="path2"></span>
                                  </i>
                                </span>
                              </div>
                              <div className="flex-grow-1">
                                <h6 className="fw-bold text-dark mb-1">{doc.name}</h6>
                                <div className="text-muted fs-7 text-capitalize">{doc.type.replace('_', ' ')}</div>
                              </div>
                              <div>
                                <span className="badge badge-light-success">Active</span>
                              </div>
                            </div>

                            <div className="mb-4">
                              <div className="text-muted fs-7 mb-2">Auto-fill Fields:</div>
                              <div className="d-flex flex-wrap gap-1">
                                {doc.auto_fill_fields.map((field, index) => (
                                  <span key={index} className="badge badge-light-info fs-8">
                                    {field.replace('_', ' ')}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="d-flex align-items-center justify-content-between">
                              <span className="text-muted fs-8">
                                Uploaded: {new Date(doc.uploaded_at).toLocaleDateString()}
                              </span>
                              <div className="d-flex gap-2">
                                <button className="btn btn-sm btn-light-primary">
                                  <i className="ki-duotone ki-eye fs-5">
                                    <span className="path1"></span>
                                    <span className="path2"></span>
                                    <span className="path3"></span>
                                  </i>
                                </button>
                                <button className="btn btn-sm btn-light-danger">
                                  <i className="ki-duotone ki-trash fs-5">
                                    <span className="path1"></span>
                                    <span className="path2"></span>
                                    <span className="path3"></span>
                                    <span className="path4"></span>
                                    <span className="path5"></span>
                                  </i>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Upload New Document Card */}
                    <div className="col-lg-6">
                      <div className="card border-dashed border-primary h-100">
                        <div className="card-body text-center p-5 d-flex flex-column justify-content-center">
                          <i className="ki-duotone ki-plus-circle fs-3x text-primary mb-3">
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                          <h6 className="text-dark mb-2">Upload New Template</h6>
                          <p className="text-muted fs-7 mb-4">
                            Drag & drop your document template or click to browse
                          </p>
                          <label className="btn btn-light-primary">
                            Browse Files
                            <input
                              type="file"
                              className="d-none"
                              accept=".pdf,.doc,.docx"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) {
                                  handleFileUpload(file, 'invoice')
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'portal' && companyInfo && (
                <div>
                  <div className="row g-5">
                    <div className="col-md-6">
                      <h5 className="fw-bold text-dark mb-4">Customer Portal Settings</h5>
                      <p className="text-muted fs-6 mb-5">
                        Configure what your customers can see and do in their portal.
                      </p>

                      <div className="mb-5">
                        <div className="form-check form-switch form-check-custom form-check-solid">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={companyInfo.customer_portal_settings.show_pricing}
                            onChange={(e) => setCompanyInfo({
                              ...companyInfo,
                              customer_portal_settings: {
                                ...companyInfo.customer_portal_settings,
                                show_pricing: e.target.checked
                              }
                            })}
                          />
                          <label className="form-check-label fw-semibold text-gray-800">
                            Show Pricing Information
                          </label>
                        </div>
                        <div className="text-muted fs-7 mt-1">Display service costs and quotes to customers</div>
                      </div>

                      <div className="mb-5">
                        <div className="form-check form-switch form-check-custom form-check-solid">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={companyInfo.customer_portal_settings.allow_online_booking}
                            onChange={(e) => setCompanyInfo({
                              ...companyInfo,
                              customer_portal_settings: {
                                ...companyInfo.customer_portal_settings,
                                allow_online_booking: e.target.checked
                              }
                            })}
                          />
                          <label className="form-check-label fw-semibold text-gray-800">
                            Enable Online Booking
                          </label>
                        </div>
                        <div className="text-muted fs-7 mt-1">Allow customers to schedule services online</div>
                      </div>

                      <div className="mb-5">
                        <div className="form-check form-switch form-check-custom form-check-solid">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={companyInfo.customer_portal_settings.show_technician_photos}
                            onChange={(e) => setCompanyInfo({
                              ...companyInfo,
                              customer_portal_settings: {
                                ...companyInfo.customer_portal_settings,
                                show_technician_photos: e.target.checked
                              }
                            })}
                          />
                          <label className="form-check-label fw-semibold text-gray-800">
                            Show Technician Photos
                          </label>
                        </div>
                        <div className="text-muted fs-7 mt-1">Display technician profiles and photos</div>
                      </div>

                      <div className="mb-5">
                        <div className="form-check form-switch form-check-custom form-check-solid">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={companyInfo.customer_portal_settings.enable_tracking}
                            onChange={(e) => setCompanyInfo({
                              ...companyInfo,
                              customer_portal_settings: {
                                ...companyInfo.customer_portal_settings,
                                enable_tracking: e.target.checked
                              }
                            })}
                          />
                          <label className="form-check-label fw-semibold text-gray-800">
                            Enable Real-Time Tracking
                          </label>
                        </div>
                        <div className="text-muted fs-7 mt-1">Show live technician location when "on the way"</div>
                      </div>

                      <div className="mb-5">
                        <div className="form-check form-switch form-check-custom form-check-solid">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={companyInfo.customer_portal_settings.show_service_history}
                            onChange={(e) => setCompanyInfo({
                              ...companyInfo,
                              customer_portal_settings: {
                                ...companyInfo.customer_portal_settings,
                                show_service_history: e.target.checked
                              }
                            })}
                          />
                          <label className="form-check-label fw-semibold text-gray-800">
                            Show Service History
                          </label>
                        </div>
                        <div className="text-muted fs-7 mt-1">Display complete service timeline and job history</div>
                      </div>
                    </div>

                    <div className="col-md-6">
                      <h5 className="fw-bold text-dark mb-4">Portal Preview</h5>
                      <div className="card border">
                        <div className="card-body p-4">
                          <div className="text-center mb-4">
                            <img 
                              src="/assets/media/misc/customer-portal-preview.jpg" 
                              alt="Portal Preview" 
                              className="w-100 rounded"
                              style={{ maxHeight: '300px', objectFit: 'cover' }}
                            />
                          </div>
                          <div className="text-center">
                            <h6 className="fw-bold text-dark mb-2">{companyInfo.company_name} Customer Portal</h6>
                            <p className="text-muted fs-7 mb-3">
                              This is how your customers will see their portal
                            </p>
                            <button className="btn btn-light-primary btn-sm">
                              <i className="ki-duotone ki-eye fs-5 me-1">
                                <span className="path1"></span>
                                <span className="path2"></span>
                                <span className="path3"></span>
                              </i>
                              Preview Portal
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="row g-5 mt-5">
                    <div className="col-12">
                      <button 
                        className="btn btn-primary"
                        onClick={saveCompanyInfo}
                        disabled={saving}
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
                            Save Portal Settings
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CompanyConfigurationPage