import React, { useState, useEffect } from 'react'
import { KTCard, KTCardBody, KTIcon } from '../../../_metronic/helpers'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'

interface BrandingSettings {
  id?: string
  tenant_id: string
  company_name: string
  logo_url?: string
  primary_color: string
  secondary_color: string
  custom_domain?: string
  email_from_name: string
  email_from_address: string
  phone_display_name: string
  website_url?: string
  address?: string
  tagline?: string
  email_signature: string
  portal_subdomain?: string
  white_label_enabled: boolean
  custom_css?: string
}

const WhiteLabelBrandingManager: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  const [branding, setBranding] = useState<BrandingSettings>({
    tenant_id: userProfile?.tenant_id || '',
    company_name: '',
    primary_color: '#007bff',
    secondary_color: '#6c757d',
    email_from_name: '',
    email_from_address: '',
    phone_display_name: '',
    email_signature: '',
    white_label_enabled: false
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string>('')

  useEffect(() => {
    fetchBrandingSettings()
  }, [userProfile?.tenant_id])

  const fetchBrandingSettings = async () => {
    if (!userProfile?.tenant_id) return

    try {
      const { data, error } = await supabase
        .from('tenant_branding')
        .select('*')
        .eq('tenant_id', userProfile.tenant_id)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      if (data) {
        setBranding(data)
        setLogoPreview(data.logo_url || '')
      } else {
        // Set defaults from company info
        const { data: company } = await supabase
          .from('companies')
          .select('*')
          .eq('id', userProfile.tenant_id)
          .single()

        if (company) {
          setBranding(prev => ({
            ...prev,
            company_name: company.company_name || '',
            email_from_name: company.company_name || '',
            email_from_address: `info@${company.company_name?.toLowerCase().replace(/\s+/g, '')}.com`,
            phone_display_name: company.company_name || '',
            website_url: company.website || '',
            address: company.address || ''
          }))
        }
      }
    } catch (error) {
      console.error('Error fetching branding settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setLogoFile(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile || !userProfile?.tenant_id) return null

    try {
      const fileExt = logoFile.name.split('.').pop()
      const fileName = `${userProfile.tenant_id}/logo.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('branding-assets')
        .upload(fileName, logoFile, { upsert: true })

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('branding-assets')
        .getPublicUrl(fileName)

      return data.publicUrl
    } catch (error) {
      console.error('Error uploading logo:', error)
      return null
    }
  }

  const generateSubdomain = (companyName: string): string => {
    return companyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 20)
  }

  const saveBrandingSettings = async () => {
    setSaving(true)
    try {
      let logoUrl = branding.logo_url

      // Upload new logo if provided
      if (logoFile) {
        const uploadedUrl = await uploadLogo()
        if (uploadedUrl) logoUrl = uploadedUrl
      }

      // Generate portal subdomain if not set
      const portalSubdomain = branding.portal_subdomain || generateSubdomain(branding.company_name)

      const brandingData = {
        ...branding,
        logo_url: logoUrl,
        portal_subdomain: portalSubdomain,
        updated_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('tenant_branding')
        .upsert(brandingData, { onConflict: 'tenant_id' })

      if (error) throw error

      // Update email templates and communication settings
      await supabase.functions.invoke('update-branding-templates', {
        body: {
          tenant_id: userProfile?.tenant_id,
          branding: brandingData
        }
      })

      alert('Branding settings saved successfully!')
      fetchBrandingSettings()
    } catch (error) {
      console.error('Error saving branding settings:', error)
      alert('Failed to save branding settings')
    } finally {
      setSaving(false)
    }
  }

  const testBrandedEmail = async () => {
    try {
      await supabase.functions.invoke('send-branded-test-email', {
        body: {
          tenant_id: userProfile?.tenant_id,
          to: userProfile?.email,
          test_mode: true
        }
      })
      alert('Test email sent! Check your inbox to see the branded email.')
    } catch (error) {
      console.error('Error sending test email:', error)
      alert('Failed to send test email')
    }
  }

  if (loading) {
    return (
      <KTCard>
        <KTCardBody className="text-center py-10">
          <div className="spinner-border text-primary" style={{ width: '3rem', height: '3rem' }}></div>
          <div className="text-muted mt-3">Loading branding settings...</div>
        </KTCardBody>
      </KTCard>
    )
  }

  return (
    <div className="row g-5">
      {/* White-Label Settings */}
      <div className="col-xl-8">
        <KTCard>
          <div className="card-header">
            <h3 className="card-title">White-Label Branding Settings</h3>
            <div className="card-toolbar">
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={branding.white_label_enabled}
                  onChange={(e) => setBranding(prev => ({ ...prev, white_label_enabled: e.target.checked }))}
                />
                <label className="form-check-label">Enable White-Label Branding</label>
              </div>
            </div>
          </div>
          <KTCardBody>
            <div className="row g-5">
              {/* Company Identity */}
              <div className="col-md-6">
                <h5 className="mb-4">Company Identity</h5>
                
                <div className="mb-5">
                  <label className="form-label required">Company Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={branding.company_name}
                    onChange={(e) => setBranding(prev => ({ ...prev, company_name: e.target.value }))}
                    placeholder="Your Company Name"
                  />
                </div>

                <div className="mb-5">
                  <label className="form-label">Company Tagline</label>
                  <input
                    type="text"
                    className="form-control"
                    value={branding.tagline || ''}
                    onChange={(e) => setBranding(prev => ({ ...prev, tagline: e.target.value }))}
                    placeholder="Professional Service You Can Trust"
                  />
                </div>

                <div className="mb-5">
                  <label className="form-label">Website URL</label>
                  <input
                    type="url"
                    className="form-control"
                    value={branding.website_url || ''}
                    onChange={(e) => setBranding(prev => ({ ...prev, website_url: e.target.value }))}
                    placeholder="https://yourcompany.com"
                  />
                </div>

                <div className="mb-5">
                  <label className="form-label">Business Address</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={branding.address || ''}
                    onChange={(e) => setBranding(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="123 Main St, City, State 12345"
                  />
                </div>
              </div>

              {/* Visual Branding */}
              <div className="col-md-6">
                <h5 className="mb-4">Visual Branding</h5>
                
                <div className="mb-5">
                  <label className="form-label">Company Logo</label>
                  <div className="border rounded p-4 text-center bg-light">
                    {logoPreview ? (
                      <img 
                        src={logoPreview} 
                        alt="Logo Preview" 
                        style={{ maxHeight: '100px', maxWidth: '200px' }}
                        className="mb-3"
                      />
                    ) : (
                      <div className="text-muted mb-3">
                        <KTIcon iconName="picture" className="fs-2x" />
                        <div>No logo uploaded</div>
                      </div>
                    )}
                    <input
                      type="file"
                      className="form-control"
                      accept="image/*"
                      onChange={handleLogoUpload}
                    />
                    <div className="text-muted fs-7 mt-2">Recommended: 200x100px, PNG or SVG</div>
                  </div>
                </div>

                <div className="row mb-5">
                  <div className="col-6">
                    <label className="form-label">Primary Color</label>
                    <div className="d-flex align-items-center">
                      <input
                        type="color"
                        className="form-control form-control-color"
                        value={branding.primary_color}
                        onChange={(e) => setBranding(prev => ({ ...prev, primary_color: e.target.value }))}
                      />
                      <input
                        type="text"
                        className="form-control ms-2"
                        value={branding.primary_color}
                        onChange={(e) => setBranding(prev => ({ ...prev, primary_color: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="col-6">
                    <label className="form-label">Secondary Color</label>
                    <div className="d-flex align-items-center">
                      <input
                        type="color"
                        className="form-control form-control-color"
                        value={branding.secondary_color}
                        onChange={(e) => setBranding(prev => ({ ...prev, secondary_color: e.target.value }))}
                      />
                      <input
                        type="text"
                        className="form-control ms-2"
                        value={branding.secondary_color}
                        onChange={(e) => setBranding(prev => ({ ...prev, secondary_color: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Communication Settings */}
            <div className="separator my-5"></div>
            <h5 className="mb-4">Communication Branding</h5>
            
            <div className="row g-5">
              <div className="col-md-6">
                <div className="mb-5">
                  <label className="form-label required">Email From Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={branding.email_from_name}
                    onChange={(e) => setBranding(prev => ({ ...prev, email_from_name: e.target.value }))}
                    placeholder="Your Company Name"
                  />
                  <div className="text-muted fs-7">This appears as the sender name in emails</div>
                </div>

                <div className="mb-5">
                  <label className="form-label required">Email From Address</label>
                  <input
                    type="email"
                    className="form-control"
                    value={branding.email_from_address}
                    onChange={(e) => setBranding(prev => ({ ...prev, email_from_address: e.target.value }))}
                    placeholder="info@yourcompany.com"
                  />
                  <div className="text-muted fs-7">Custom email address for all outgoing emails</div>
                </div>

                <div className="mb-5">
                  <label className="form-label">Phone Display Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={branding.phone_display_name}
                    onChange={(e) => setBranding(prev => ({ ...prev, phone_display_name: e.target.value }))}
                    placeholder="Your Company Name"
                  />
                  <div className="text-muted fs-7">How your company appears on caller ID</div>
                </div>
              </div>

              <div className="col-md-6">
                <div className="mb-5">
                  <label className="form-label">Portal Subdomain</label>
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control"
                      value={branding.portal_subdomain || ''}
                      onChange={(e) => setBranding(prev => ({ ...prev, portal_subdomain: e.target.value }))}
                      placeholder="yourcompany"
                    />
                    <span className="input-group-text">.tradeworkspro.com</span>
                  </div>
                  <div className="text-muted fs-7">Custom portal URL for your customers</div>
                </div>

                <div className="mb-5">
                  <label className="form-label">Custom Domain (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={branding.custom_domain || ''}
                    onChange={(e) => setBranding(prev => ({ ...prev, custom_domain: e.target.value }))}
                    placeholder="portal.yourcompany.com"
                  />
                  <div className="text-muted fs-7">Use your own domain for the customer portal</div>
                </div>
              </div>
            </div>

            {/* Email Signature */}
            <div className="mb-5">
              <label className="form-label">Email Signature</label>
              <textarea
                className="form-control"
                rows={5}
                value={branding.email_signature}
                onChange={(e) => setBranding(prev => ({ ...prev, email_signature: e.target.value }))}
                placeholder={`Best regards,
{company_name}
{phone}
{website}
{address}`}
              />
              <div className="text-muted fs-7">Available variables: {'{company_name}'}, {'{phone}'}, {'{website}'}, {'{address}'}</div>
            </div>
          </KTCardBody>
        </KTCard>
      </div>

      {/* Preview and Actions */}
      <div className="col-xl-4">
        {/* Live Preview */}
        <KTCard className="mb-5">
          <div className="card-header">
            <h3 className="card-title">Live Preview</h3>
          </div>
          <KTCardBody>
            <div className="text-center mb-5">
              <h6 className="mb-3">Email Header Preview</h6>
              <div 
                className="border rounded p-4"
                style={{ 
                  backgroundColor: branding.primary_color,
                  color: 'white'
                }}
              >
                {logoPreview && (
                  <img 
                    src={logoPreview} 
                    alt="Logo" 
                    style={{ maxHeight: '40px' }}
                    className="mb-2"
                  />
                )}
                <div className="fw-bold">{branding.company_name || 'Your Company'}</div>
                {branding.tagline && (
                  <div className="small opacity-75">{branding.tagline}</div>
                )}
              </div>
            </div>

            <div className="mb-5">
              <h6 className="mb-3">Portal URL Preview</h6>
              <div className="bg-light rounded p-3">
                <div className="text-primary fw-bold">
                  {branding.custom_domain 
                    ? `https://${branding.custom_domain}/abc123`
                    : `https://${branding.portal_subdomain || 'yourcompany'}.tradeworkspro.com/abc123`
                  }
                </div>
              </div>
            </div>

            <div className="mb-5">
              <h6 className="mb-3">Email From Preview</h6>
              <div className="bg-light rounded p-3">
                <div className="fw-bold">{branding.email_from_name || 'Your Company'}</div>
                <div className="text-muted">{branding.email_from_address || 'info@yourcompany.com'}</div>
              </div>
            </div>
          </KTCardBody>
        </KTCard>

        {/* Actions */}
        <KTCard>
          <div className="card-header">
            <h3 className="card-title">Actions</h3>
          </div>
          <KTCardBody>
            <button
              className="btn btn-primary w-100 mb-3"
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
                  <KTIcon iconName="check" className="fs-6 me-2" />
                  Save Branding Settings
                </>
              )}
            </button>

            <button
              className="btn btn-light w-100 mb-3"
              onClick={testBrandedEmail}
            >
              <KTIcon iconName="sms" className="fs-6 me-2" />
              Send Test Email
            </button>

            <div className="alert alert-info">
              <div className="fw-bold mb-2">🎨 White-Label Benefits:</div>
              <ul className="mb-0 small">
                <li>Custom branded emails</li>
                <li>Personalized portal URLs</li>
                <li>Professional caller ID</li>
                <li>Consistent company branding</li>
                <li>Enhanced customer trust</li>
              </ul>
            </div>
          </KTCardBody>
        </KTCard>
      </div>
    </div>
  )
}

export default WhiteLabelBrandingManager