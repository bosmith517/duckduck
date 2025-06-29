import React, { useState, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'

interface BrandingSettings {
  id: string
  tenant_id: string
  brand_level: 'standard' | 'supplier' | 'enterprise'
  
  // Visual Branding
  primary_color: string
  secondary_color: string
  accent_color: string
  logo_url?: string
  favicon_url?: string
  background_image_url?: string
  
  // Typography
  font_family: string
  heading_font?: string
  
  // Portal Customization
  portal_title?: string
  portal_description?: string
  welcome_message?: string
  footer_text?: string
  custom_css?: string
  
  // Contact Information Override
  custom_support_phone?: string
  custom_support_email?: string
  custom_website?: string
  
  // Feature Flags
  enable_advanced_features: boolean
  allow_white_labeling: boolean
  custom_domain?: string
}

const SupplierBrandingPage: React.FC = () => {
  const [branding, setBranding] = useState<BrandingSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'visual' | 'content' | 'advanced' | 'preview'>('visual')
  const [uploadingLogo, setUploadingLogo] = useState(false)

  useEffect(() => {
    loadBrandingSettings()
  }, [])

  const loadBrandingSettings = async () => {
    try {
      setLoading(true)
      
      const { data: brandingData, error } = await supabase
        .from('company_branding')
        .select('*')
        .single()

      if (error && error.code !== 'PGRST116') { // Not found error
        throw error
      }

      if (brandingData) {
        setBranding(brandingData)
      } else {
        // Create default branding settings
        const { data: defaultBranding, error: createError } = await supabase
          .from('company_branding')
          .insert({
            brand_level: 'supplier',
            primary_color: '#0066CC',
            secondary_color: '#6C757D',
            accent_color: '#28A745',
            font_family: 'Inter',
            enable_advanced_features: true,
            allow_white_labeling: true
          })
          .select()
          .single()

        if (createError) throw createError
        setBranding(defaultBranding)
      }
    } catch (error) {
      console.error('Error loading branding settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveBrandingSettings = async () => {
    if (!branding) return

    try {
      setSaving(true)
      
      const { error } = await supabase
        .from('company_branding')
        .update({
          primary_color: branding.primary_color,
          secondary_color: branding.secondary_color,
          accent_color: branding.accent_color,
          logo_url: branding.logo_url,
          favicon_url: branding.favicon_url,
          background_image_url: branding.background_image_url,
          font_family: branding.font_family,
          heading_font: branding.heading_font,
          portal_title: branding.portal_title,
          portal_description: branding.portal_description,
          welcome_message: branding.welcome_message,
          footer_text: branding.footer_text,
          custom_css: branding.custom_css,
          custom_support_phone: branding.custom_support_phone,
          custom_support_email: branding.custom_support_email,
          custom_website: branding.custom_website,
          enable_advanced_features: branding.enable_advanced_features,
          allow_white_labeling: branding.allow_white_labeling,
          custom_domain: branding.custom_domain,
          updated_at: new Date().toISOString()
        })
        .eq('id', branding.id)

      if (error) throw error
      console.log('Branding settings saved successfully')
      
    } catch (error) {
      console.error('Error saving branding settings:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = async (file: File, type: 'logo' | 'favicon') => {
    try {
      setUploadingLogo(true)
      
      const fileName = `${type}-${Date.now()}-${file.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('branding-assets')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('branding-assets')
        .getPublicUrl(fileName)

      setBranding(prev => prev ? {
        ...prev,
        [type === 'logo' ? 'logo_url' : 'favicon_url']: publicUrl
      } : null)
      
    } catch (error) {
      console.error('Error uploading logo:', error)
    } finally {
      setUploadingLogo(false)
    }
  }

  const predefinedColors = [
    '#0066CC', '#28A745', '#DC3545', '#FFC107', '#6F42C1', '#FD7E14',
    '#20C997', '#6C757D', '#343A40', '#007BFF', '#E83E8C', '#17A2B8'
  ]

  const fontOptions = [
    'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins',
    'Source Sans Pro', 'Nunito', 'Raleway', 'Ubuntu'
  ]

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-50">
        <div className="spinner-border text-primary"></div>
      </div>
    )
  }

  if (!branding) {
    return (
      <div className="alert alert-danger">
        <h4>Error</h4>
        <p>Unable to load branding settings. Please try again later.</p>
      </div>
    )
  }

  return (
    <div className="container-xxl">
      <div className="page-title d-flex flex-column justify-content-center flex-wrap me-3 mb-5">
        <h1 className="page-heading d-flex text-dark fw-bold fs-3 flex-column justify-content-center my-0">
          Supplier Branding Customization
        </h1>
        <span className="page-desc text-muted fs-7 fw-semibold pt-1">
          Customize your white-label customer portal with your brand identity
        </span>
      </div>

      <div className="row g-7">
        <div className="col-lg-12">
          <div className="card card-flush">
            <div className="card-header">
              <ul className="nav nav-tabs nav-line-tabs nav-stretch fs-6 border-0">
                <li className="nav-item">
                  <a 
                    className={`nav-link ${activeTab === 'visual' ? 'active' : ''}`}
                    href="#"
                    onClick={(e) => { e.preventDefault(); setActiveTab('visual') }}
                  >
                    <i className="ki-duotone ki-palette fs-4 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                      <span className="path3"></span>
                    </i>
                    Visual Branding
                  </a>
                </li>
                <li className="nav-item">
                  <a 
                    className={`nav-link ${activeTab === 'content' ? 'active' : ''}`}
                    href="#"
                    onClick={(e) => { e.preventDefault(); setActiveTab('content') }}
                  >
                    <i className="ki-duotone ki-message-text-2 fs-4 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                      <span className="path3"></span>
                    </i>
                    Content & Messaging
                  </a>
                </li>
                <li className="nav-item">
                  <a 
                    className={`nav-link ${activeTab === 'advanced' ? 'active' : ''}`}
                    href="#"
                    onClick={(e) => { e.preventDefault(); setActiveTab('advanced') }}
                  >
                    <i className="ki-duotone ki-code fs-4 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                      <span className="path3"></span>
                      <span className="path4"></span>
                    </i>
                    Advanced Customization
                  </a>
                </li>
                <li className="nav-item">
                  <a 
                    className={`nav-link ${activeTab === 'preview' ? 'active' : ''}`}
                    href="#"
                    onClick={(e) => { e.preventDefault(); setActiveTab('preview') }}
                  >
                    <i className="ki-duotone ki-eye fs-4 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                      <span className="path3"></span>
                    </i>
                    Preview
                  </a>
                </li>
              </ul>
            </div>

            <div className="card-body">
              {activeTab === 'visual' && (
                <div>
                  <div className="row g-5">
                    {/* Colors */}
                    <div className="col-md-6">
                      <h5 className="fw-bold text-dark mb-4">Brand Colors</h5>
                      
                      <div className="mb-5">
                        <label className="form-label">Primary Color</label>
                        <div className="d-flex align-items-center gap-3">
                          <input
                            type="color"
                            className="form-control form-control-color"
                            value={branding.primary_color}
                            onChange={(e) => setBranding({...branding, primary_color: e.target.value})}
                            style={{ width: '60px', height: '40px' }}
                          />
                          <input
                            type="text"
                            className="form-control"
                            value={branding.primary_color}
                            onChange={(e) => setBranding({...branding, primary_color: e.target.value})}
                            placeholder="#0066CC"
                          />
                        </div>
                        <div className="d-flex gap-2 mt-2">
                          {predefinedColors.slice(0, 6).map(color => (
                            <button
                              key={color}
                              className="btn p-0 border"
                              style={{ width: '30px', height: '30px', backgroundColor: color }}
                              onClick={() => setBranding({...branding, primary_color: color})}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="mb-5">
                        <label className="form-label">Secondary Color</label>
                        <div className="d-flex align-items-center gap-3">
                          <input
                            type="color"
                            className="form-control form-control-color"
                            value={branding.secondary_color}
                            onChange={(e) => setBranding({...branding, secondary_color: e.target.value})}
                            style={{ width: '60px', height: '40px' }}
                          />
                          <input
                            type="text"
                            className="form-control"
                            value={branding.secondary_color}
                            onChange={(e) => setBranding({...branding, secondary_color: e.target.value})}
                            placeholder="#6C757D"
                          />
                        </div>
                      </div>

                      <div className="mb-5">
                        <label className="form-label">Accent Color</label>
                        <div className="d-flex align-items-center gap-3">
                          <input
                            type="color"
                            className="form-control form-control-color"
                            value={branding.accent_color}
                            onChange={(e) => setBranding({...branding, accent_color: e.target.value})}
                            style={{ width: '60px', height: '40px' }}
                          />
                          <input
                            type="text"
                            className="form-control"
                            value={branding.accent_color}
                            onChange={(e) => setBranding({...branding, accent_color: e.target.value})}
                            placeholder="#28A745"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Typography */}
                    <div className="col-md-6">
                      <h5 className="fw-bold text-dark mb-4">Typography</h5>
                      
                      <div className="mb-5">
                        <label className="form-label">Primary Font Family</label>
                        <select
                          className="form-select"
                          value={branding.font_family}
                          onChange={(e) => setBranding({...branding, font_family: e.target.value})}
                        >
                          {fontOptions.map(font => (
                            <option key={font} value={font}>{font}</option>
                          ))}
                        </select>
                      </div>

                      <div className="mb-5">
                        <label className="form-label">Heading Font (Optional)</label>
                        <select
                          className="form-select"
                          value={branding.heading_font || ''}
                          onChange={(e) => setBranding({...branding, heading_font: e.target.value || undefined})}
                        >
                          <option value="">Same as primary font</option>
                          {fontOptions.map(font => (
                            <option key={font} value={font}>{font}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Logo Upload */}
                  <div className="row g-5 mt-2">
                    <div className="col-md-6">
                      <h5 className="fw-bold text-dark mb-4">Logo & Assets</h5>
                      
                      <div className="mb-5">
                        <label className="form-label">Company Logo</label>
                        <div className="d-flex align-items-center gap-4">
                          {branding.logo_url && (
                            <img 
                              src={branding.logo_url} 
                              alt="Logo" 
                              className="border rounded"
                              style={{ width: '100px', height: '60px', objectFit: 'contain' }}
                            />
                          )}
                          <label className="btn btn-light-primary">
                            <i className="ki-duotone ki-cloud-upload fs-5 me-2">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                            Upload Logo
                            <input
                              type="file"
                              className="d-none"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handleLogoUpload(file, 'logo')
                              }}
                            />
                          </label>
                        </div>
                      </div>

                      <div className="mb-5">
                        <label className="form-label">Favicon</label>
                        <div className="d-flex align-items-center gap-4">
                          {branding.favicon_url && (
                            <img 
                              src={branding.favicon_url} 
                              alt="Favicon" 
                              className="border rounded"
                              style={{ width: '32px', height: '32px', objectFit: 'contain' }}
                            />
                          )}
                          <label className="btn btn-light-primary">
                            <i className="ki-duotone ki-cloud-upload fs-5 me-2">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                            Upload Favicon
                            <input
                              type="file"
                              className="d-none"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handleLogoUpload(file, 'favicon')
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'content' && (
                <div>
                  <div className="row g-5">
                    <div className="col-md-6">
                      <h5 className="fw-bold text-dark mb-4">Portal Content</h5>
                      
                      <div className="mb-5">
                        <label className="form-label">Portal Title</label>
                        <input
                          type="text"
                          className="form-control"
                          value={branding.portal_title || ''}
                          onChange={(e) => setBranding({...branding, portal_title: e.target.value})}
                          placeholder="Customer Portal"
                        />
                      </div>

                      <div className="mb-5">
                        <label className="form-label">Portal Description</label>
                        <textarea
                          className="form-control"
                          rows={3}
                          value={branding.portal_description || ''}
                          onChange={(e) => setBranding({...branding, portal_description: e.target.value})}
                          placeholder="Welcome to your service portal..."
                        />
                      </div>

                      <div className="mb-5">
                        <label className="form-label">Welcome Message</label>
                        <textarea
                          className="form-control"
                          rows={4}
                          value={branding.welcome_message || ''}
                          onChange={(e) => setBranding({...branding, welcome_message: e.target.value})}
                          placeholder="Welcome! Manage your services, schedule appointments, and track your technician..."
                        />
                      </div>
                    </div>

                    <div className="col-md-6">
                      <h5 className="fw-bold text-dark mb-4">Contact Information</h5>
                      
                      <div className="mb-5">
                        <label className="form-label">Support Phone</label>
                        <input
                          type="tel"
                          className="form-control"
                          value={branding.custom_support_phone || ''}
                          onChange={(e) => setBranding({...branding, custom_support_phone: e.target.value})}
                          placeholder="(555) 123-4567"
                        />
                      </div>

                      <div className="mb-5">
                        <label className="form-label">Support Email</label>
                        <input
                          type="email"
                          className="form-control"
                          value={branding.custom_support_email || ''}
                          onChange={(e) => setBranding({...branding, custom_support_email: e.target.value})}
                          placeholder="support@yourcompany.com"
                        />
                      </div>

                      <div className="mb-5">
                        <label className="form-label">Website</label>
                        <input
                          type="url"
                          className="form-control"
                          value={branding.custom_website || ''}
                          onChange={(e) => setBranding({...branding, custom_website: e.target.value})}
                          placeholder="https://www.yourcompany.com"
                        />
                      </div>

                      <div className="mb-5">
                        <label className="form-label">Footer Text</label>
                        <textarea
                          className="form-control"
                          rows={3}
                          value={branding.footer_text || ''}
                          onChange={(e) => setBranding({...branding, footer_text: e.target.value})}
                          placeholder="© 2024 Your Company. All rights reserved."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'advanced' && (
                <div>
                  <div className="row g-5">
                    <div className="col-md-6">
                      <h5 className="fw-bold text-dark mb-4">Advanced Features</h5>
                      
                      <div className="mb-5">
                        <div className="form-check form-switch form-check-custom form-check-solid">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={branding.enable_advanced_features}
                            onChange={(e) => setBranding({...branding, enable_advanced_features: e.target.checked})}
                          />
                          <label className="form-check-label fw-semibold text-gray-800">
                            Enable Advanced Features
                          </label>
                        </div>
                        <div className="text-muted fs-7 mt-1">Access to premium portal features and integrations</div>
                      </div>

                      <div className="mb-5">
                        <div className="form-check form-switch form-check-custom form-check-solid">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={branding.allow_white_labeling}
                            onChange={(e) => setBranding({...branding, allow_white_labeling: e.target.checked})}
                          />
                          <label className="form-check-label fw-semibold text-gray-800">
                            Allow White Labeling
                          </label>
                        </div>
                        <div className="text-muted fs-7 mt-1">Remove TradeWorks branding from customer-facing pages</div>
                      </div>

                      <div className="mb-5">
                        <label className="form-label">Custom Domain</label>
                        <input
                          type="text"
                          className="form-control"
                          value={branding.custom_domain || ''}
                          onChange={(e) => setBranding({...branding, custom_domain: e.target.value})}
                          placeholder="portal.yourcompany.com"
                          disabled={!branding.allow_white_labeling}
                        />
                        <div className="text-muted fs-7 mt-1">
                          Requires DNS configuration and SSL certificate setup
                        </div>
                      </div>
                    </div>

                    <div className="col-md-6">
                      <h5 className="fw-bold text-dark mb-4">Custom CSS</h5>
                      
                      <div className="mb-5">
                        <label className="form-label">Additional CSS Styles</label>
                        <textarea
                          className="form-control font-monospace"
                          rows={12}
                          value={branding.custom_css || ''}
                          onChange={(e) => setBranding({...branding, custom_css: e.target.value})}
                          placeholder={`/* Add custom CSS here */\n.custom-header {\n  background: linear-gradient(45deg, #ff6b6b, #4ecdc4);\n}\n\n.btn-custom {\n  border-radius: 20px;\n  transition: all 0.3s ease;\n}`}
                        />
                        <div className="text-muted fs-7 mt-1">
                          Add custom CSS to override default styling. Use with caution.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'preview' && (
                <div>
                  <h5 className="fw-bold text-dark mb-4">Portal Preview</h5>
                  <div 
                    className="border rounded p-5"
                    style={{ 
                      backgroundColor: '#f8f9fa',
                      fontFamily: branding.font_family,
                      minHeight: '500px'
                    }}
                  >
                    {/* Preview Header */}
                    <div 
                      className="d-flex align-items-center justify-content-between p-4 rounded mb-4"
                      style={{ backgroundColor: branding.primary_color, color: 'white' }}
                    >
                      <div className="d-flex align-items-center">
                        {branding.logo_url && (
                          <img 
                            src={branding.logo_url} 
                            alt="Logo" 
                            style={{ height: '40px', marginRight: '15px' }}
                          />
                        )}
                        <h4 className="mb-0" style={{ fontFamily: branding.heading_font || branding.font_family }}>
                          {branding.portal_title || 'Customer Portal'}
                        </h4>
                      </div>
                      <div className="text-white-50 fs-6">
                        Welcome, John Doe
                      </div>
                    </div>

                    {/* Preview Content */}
                    <div className="row g-4">
                      <div className="col-md-8">
                        <div className="bg-white p-4 rounded shadow-sm">
                          <h5 className="mb-3" style={{ color: branding.primary_color }}>
                            {branding.welcome_message || 'Welcome to your service portal'}
                          </h5>
                          <p className="text-muted">
                            {branding.portal_description || 'Manage your services, view your equipment, and track your technician in real-time.'}
                          </p>
                          <button 
                            className="btn me-2"
                            style={{ backgroundColor: branding.accent_color, color: 'white' }}
                          >
                            Schedule Service
                          </button>
                          <button 
                            className="btn"
                            style={{ backgroundColor: branding.secondary_color, color: 'white' }}
                          >
                            View Equipment
                          </button>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="bg-white p-4 rounded shadow-sm">
                          <h6 className="mb-3">Contact Support</h6>
                          <p className="text-muted fs-7 mb-2">
                            <i className="ki-duotone ki-phone fs-6 me-2"></i>
                            {branding.custom_support_phone || '(555) 123-4567'}
                          </p>
                          <p className="text-muted fs-7 mb-2">
                            <i className="ki-duotone ki-sms fs-6 me-2"></i>
                            {branding.custom_support_email || 'support@company.com'}
                          </p>
                          <p className="text-muted fs-7">
                            <i className="ki-duotone ki-global fs-6 me-2"></i>
                            {branding.custom_website || 'www.company.com'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Preview Footer */}
                    <div className="text-center text-muted fs-7 mt-5 pt-4 border-top">
                      {branding.footer_text || '© 2024 Your Company. All rights reserved.'}
                    </div>
                  </div>
                </div>
              )}

              {/* Save Button */}
              <div className="row g-5 mt-5">
                <div className="col-12">
                  <button 
                    className="btn btn-primary"
                    onClick={saveBrandingSettings}
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
                        Save Branding Settings
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SupplierBrandingPage