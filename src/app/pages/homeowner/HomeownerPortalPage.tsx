import React, { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../../supabaseClient'
import EquipmentPhotoUpload from '../../components/customer-portal/EquipmentPhotoUpload'
import DigitalTwin from '../../components/customer-portal/DigitalTwin'
import MaintenanceHub from '../../components/customer-portal/MaintenanceHub'
// ServiceProviderDirectory component will be added later

interface HomeownerProfile {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zip_code: string
  home_type: string
  home_age: string
}

interface BrandingConfig {
  name: string
  tagline: string
  primaryColor: string
  secondaryColor: string
  logo?: string
  favicon?: string
  domain?: string
  supportEmail?: string
  supportPhone?: string
  footerText?: string
  hideTradeWorksBranding?: boolean
}

const HomeownerPortalPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const [profile, setProfile] = useState<HomeownerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<'dashboard' | 'equipment' | 'maintenance' | 'providers' | 'profile'>('dashboard')
  
  // White-label branding configuration
  const [branding, setBranding] = useState<BrandingConfig>({
    name: 'Home Assistant',
    tagline: 'Your Smart Home Maintenance Hub',
    primaryColor: '#0ea5e9',
    secondaryColor: '#059669',
    footerText: 'Your trusted home maintenance companion',
    hideTradeWorksBranding: true
  })

  useEffect(() => {
    loadProfile()
    loadBranding()
  }, [])

  const loadBranding = async () => {
    // Load white-label branding from URL params or database
    const partner = searchParams.get('partner')
    const domain = window.location.hostname
    
    // Predefined branding configs for different partners
    const brandingConfigs: Record<string, BrandingConfig> = {
      'homegenius': {
        name: 'HomeGenius',
        tagline: 'Smart Home Management Made Simple',
        primaryColor: '#8b5cf6',
        secondaryColor: '#10b981',
        logo: '/logos/homegenius-logo.png',
        footerText: 'HomeGenius - Intelligent home maintenance solutions',
        hideTradeWorksBranding: true
      },
      'homesmart': {
        name: 'HomeSmart Pro',
        tagline: 'Professional Home Care Assistant',
        primaryColor: '#3b82f6',
        secondaryColor: '#f59e0b',
        logo: '/logos/homesmart-logo.png',
        footerText: 'HomeSmart Pro - Your home maintenance partner',
        hideTradeWorksBranding: true
      },
      'myhouse': {
        name: 'MyHouse Manager',
        tagline: 'Take Control of Your Home',
        primaryColor: '#ef4444',
        secondaryColor: '#059669',
        logo: '/logos/myhouse-logo.png',
        footerText: 'MyHouse Manager - Home ownership simplified',
        hideTradeWorksBranding: true
      },
      'default': {
        name: 'Home Assistant',
        tagline: 'Your Smart Home Maintenance Hub',
        primaryColor: '#0ea5e9',
        secondaryColor: '#059669',
        footerText: 'Your trusted home maintenance companion',
        hideTradeWorksBranding: true
      }
    }

    // Select branding based on partner param or domain
    let selectedBranding = brandingConfigs['default']
    
    if (partner && brandingConfigs[partner]) {
      selectedBranding = brandingConfigs[partner]
    } else if (domain !== 'localhost' && domain !== '127.0.0.1') {
      // Check if domain matches any known partner domains
      Object.entries(brandingConfigs).forEach(([key, config]) => {
        if (config.domain && domain.includes(config.domain)) {
          selectedBranding = config
        }
      })
    }

    setBranding(selectedBranding)

    // Apply CSS custom properties for theming
    const root = document.documentElement
    root.style.setProperty('--bs-primary', selectedBranding.primaryColor)
    root.style.setProperty('--primary-color', selectedBranding.primaryColor)
    root.style.setProperty('--secondary-color', selectedBranding.secondaryColor)
    
    // Update page title and favicon
    document.title = `${selectedBranding.name} - ${selectedBranding.tagline}`
    if (selectedBranding.favicon) {
      const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement
      if (favicon) favicon.href = selectedBranding.favicon
    }
  }

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/homeowner-signup'
        return
      }

      const { data: profileData, error } = await supabase
        .from('homeowner_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error) {
        console.error('Error loading profile:', error)
        return
      }

      setProfile(profileData)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (loading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }}></div>
          <p className="text-muted">Loading your home portal...</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <div className="text-center">
          <h3 className="text-dark mb-3">Profile Not Found</h3>
          <p className="text-muted mb-4">We couldn't find your homeowner profile.</p>
          <Link to="/homeowner-signup" className="btn btn-primary">
            Complete Your Profile
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="d-flex flex-column min-vh-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container-fluid">
          <div className="d-flex justify-content-between align-items-center py-4">
            <div className="d-flex align-items-center">
              <div className="symbol symbol-40px me-3">
                {branding.logo ? (
                  <img src={branding.logo} alt={branding.name} className="w-40px h-40px" />
                ) : (
                  <span className="symbol-label" style={{ backgroundColor: branding.primaryColor }}>
                    <i className="ki-duotone ki-home-2 fs-2 text-white">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                  </span>
                )}
              </div>
              <div>
                <h4 className="text-dark fw-bold mb-0">{branding.name}</h4>
                <small className="text-muted">{branding.tagline}</small>
              </div>
            </div>

            <div className="d-flex align-items-center gap-3">
              <div className="text-end d-none d-md-block">
                <div className="text-dark fw-semibold">{profile.first_name} {profile.last_name}</div>
                <small className="text-muted">{profile.city}, {profile.state}</small>
              </div>
              <div className="dropdown">
                <button 
                  className="btn btn-light btn-icon" 
                  data-bs-toggle="dropdown"
                >
                  <i className="ki-duotone ki-setting-3 fs-3">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                </button>
                <ul className="dropdown-menu dropdown-menu-end">
                  <li>
                    <button 
                      className="dropdown-item"
                      onClick={() => setActiveSection('profile')}
                    >
                      <i className="ki-duotone ki-profile-user fs-5 me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                        <span className="path3"></span>
                      </i>
                      My Profile
                    </button>
                  </li>
                  <li><hr className="dropdown-divider" /></li>
                  <li>
                    <button className="dropdown-item text-danger" onClick={handleSignOut}>
                      <i className="ki-duotone ki-exit-right fs-5 me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Sign Out
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="border-top">
            <ul className="nav nav-tabs nav-line-tabs nav-stretch fs-6 border-0">
              <li className="nav-item">
                <button 
                  className={`nav-link ${activeSection === 'dashboard' ? 'active' : 'text-muted'}`}
                  onClick={() => setActiveSection('dashboard')}
                >
                  <i className="ki-duotone ki-home-2 fs-4 me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Dashboard
                </button>
              </li>
              <li className="nav-item">
                <button 
                  className={`nav-link ${activeSection === 'equipment' ? 'active' : 'text-muted'}`}
                  onClick={() => setActiveSection('equipment')}
                >
                  <i className="ki-duotone ki-technology-2 fs-4 me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  My Equipment
                </button>
              </li>
              <li className="nav-item">
                <button 
                  className={`nav-link ${activeSection === 'maintenance' ? 'active' : 'text-muted'}`}
                  onClick={() => setActiveSection('maintenance')}
                >
                  <i className="ki-duotone ki-setting-3 fs-4 me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Maintenance
                </button>
              </li>
              <li className="nav-item">
                <button 
                  className={`nav-link ${activeSection === 'providers' ? 'active' : 'text-muted'}`}
                  onClick={() => setActiveSection('providers')}
                >
                  <i className="ki-duotone ki-profile-user fs-4 me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                    <span className="path3"></span>
                  </i>
                  Find Professionals
                </button>
              </li>
            </ul>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow-1 bg-light">
        <div className="container-fluid py-6">
          {/* Dashboard Section */}
          {activeSection === 'dashboard' && (
            <div>
              <div className="row g-6 mb-8">
                <div className="col-xl-3 col-md-6">
                  <div className="card card-flush h-100">
                    <div className="card-body d-flex align-items-center">
                      <div className="symbol symbol-60px me-4" style={{ backgroundColor: `${branding.secondaryColor}20` }}>
                        <span className="symbol-label">
                          <i className="ki-duotone ki-home-2 fs-2x" style={{ color: branding.secondaryColor }}>
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                        </span>
                      </div>
                      <div>
                        <h3 className="text-dark fw-bold">Welcome Home!</h3>
                        <p className="text-muted mb-0">
                          {branding.tagline.toLowerCase().includes('smart') ? 
                            'Your smart home assistant is ready to help manage your equipment and maintenance.' :
                            'Your home management assistant is ready to help organize your equipment and maintenance.'
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="col-xl-3 col-md-6">
                  <div className="card card-flush h-100">
                    <div className="card-body text-center">
                      <div className="symbol symbol-60px bg-light-primary mx-auto mb-3">
                        <span className="symbol-label">
                          <i className="ki-duotone ki-camera fs-2x text-primary">
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                        </span>
                      </div>
                      <h5 className="text-dark fw-bold mb-2">Add Equipment</h5>
                      <p className="text-muted fs-7 mb-3">Take photos and let AI identify your home equipment</p>
                      <button 
                        className="btn btn-sm btn-primary"
                        onClick={() => setActiveSection('equipment')}
                      >
                        Get Started
                      </button>
                    </div>
                  </div>
                </div>

                <div className="col-xl-3 col-md-6">
                  <div className="card card-flush h-100">
                    <div className="card-body text-center">
                      <div className="symbol symbol-60px bg-light-warning mx-auto mb-3">
                        <span className="symbol-label">
                          <i className="ki-duotone ki-notification-on fs-2x text-warning">
                            <span className="path1"></span>
                            <span className="path2"></span>
                            <span className="path3"></span>
                          </i>
                        </span>
                      </div>
                      <h5 className="text-dark fw-bold mb-2">Smart Reminders</h5>
                      <p className="text-muted fs-7 mb-3">Get AI-powered maintenance recommendations</p>
                      <button 
                        className="btn btn-sm btn-warning"
                        onClick={() => setActiveSection('maintenance')}
                      >
                        View Tips
                      </button>
                    </div>
                  </div>
                </div>

                <div className="col-xl-3 col-md-6">
                  <div className="card card-flush h-100">
                    <div className="card-body text-center">
                      <div className="symbol symbol-60px bg-light-info mx-auto mb-3">
                        <span className="symbol-label">
                          <i className="ki-duotone ki-profile-user fs-2x text-info">
                            <span className="path1"></span>
                            <span className="path2"></span>
                            <span className="path3"></span>
                          </i>
                        </span>
                      </div>
                      <h5 className="text-dark fw-bold mb-2">Find Professionals</h5>
                      <p className="text-muted fs-7 mb-3">Connect with trusted service providers</p>
                      <button 
                        className="btn btn-sm btn-info"
                        onClick={() => setActiveSection('providers')}
                      >
                        Browse Pros
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="card card-flush">
                <div className="card-header pt-7">
                  <h3 className="card-title align-items-start flex-column">
                    <span className="card-label fw-bold text-dark">Quick Actions</span>
                    <span className="text-muted mt-1 fw-semibold fs-7">
                      Common tasks to keep your home running smoothly
                    </span>
                  </h3>
                </div>
                <div className="card-body">
                  <div className="row g-4">
                    <div className="col-md-6 col-lg-3">
                      <div className="d-flex align-items-center border rounded p-4 hover-bg-light-primary cursor-pointer">
                        <i className="ki-duotone ki-camera fs-2x text-primary me-3">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        <div>
                          <h6 className="text-dark fw-bold mb-1">Add Equipment</h6>
                          <small className="text-muted">Take photos to add equipment</small>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6 col-lg-3">
                      <div className="d-flex align-items-center border rounded p-4 hover-bg-light-success cursor-pointer">
                        <i className="ki-duotone ki-calendar-add fs-2x text-success me-3">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        <div>
                          <h6 className="text-dark fw-bold mb-1">Schedule Service</h6>
                          <small className="text-muted">Book a professional service</small>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6 col-lg-3">
                      <div className="d-flex align-items-center border rounded p-4 hover-bg-light-warning cursor-pointer">
                        <i className="ki-duotone ki-notepad-edit fs-2x text-warning me-3">
                          <span className="path1"></span>
                          <span className="path2"></span>
                          <span className="path3"></span>
                        </i>
                        <div>
                          <h6 className="text-dark fw-bold mb-1">Log Maintenance</h6>
                          <small className="text-muted">Record completed tasks</small>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6 col-lg-3">
                      <div className="d-flex align-items-center border rounded p-4 hover-bg-light-info cursor-pointer">
                        <i className="ki-duotone ki-questionnaire-tablet fs-2x text-info me-3">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        <div>
                          <h6 className="text-dark fw-bold mb-1">Get Quote</h6>
                          <small className="text-muted">Request service estimates</small>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Equipment Section */}
          {activeSection === 'equipment' && (
            <div>
              <DigitalTwin customerId={profile.id} />
            </div>
          )}

          {/* Maintenance Section */}
          {activeSection === 'maintenance' && (
            <div>
              <MaintenanceHub 
                customerId={profile.id}
                customerLocation={{
                  city: profile.city || 'Austin',
                  state: profile.state || 'TX'
                }}
              />
            </div>
          )}

          {/* Service Providers Section */}
          {activeSection === 'providers' && (
            <div className="text-center py-5">
              <i className="ki-duotone ki-people fs-4x text-primary mb-3">
                <span className="path1"></span>
                <span className="path2"></span>
                <span className="path3"></span>
              </i>
              <h3 className="text-dark fw-bold mb-2">Service Provider Directory</h3>
              <p className="text-muted">Coming soon - Find trusted professionals in your area</p>
            </div>
          )}

          {/* Profile Section */}
          {activeSection === 'profile' && (
            <div className="card card-flush">
              <div className="card-header pt-7">
                <h3 className="card-title align-items-start flex-column">
                  <span className="card-label fw-bold text-dark">My Profile</span>
                  <span className="text-muted mt-1 fw-semibold fs-7">
                    Manage your account and home information
                  </span>
                </h3>
              </div>
              <div className="card-body">
                <div className="row g-8">
                  <div className="col-lg-6">
                    <h5 className="text-dark fw-bold mb-4">Personal Information</h5>
                    <div className="mb-4">
                      <label className="form-label">Full Name</label>
                      <input type="text" className="form-control" value={`${profile.first_name} ${profile.last_name}`} readOnly />
                    </div>
                    <div className="mb-4">
                      <label className="form-label">Email</label>
                      <input type="email" className="form-control" value={profile.email} readOnly />
                    </div>
                    <div className="mb-4">
                      <label className="form-label">Phone</label>
                      <input type="tel" className="form-control" value={profile.phone || ''} readOnly />
                    </div>
                  </div>
                  <div className="col-lg-6">
                    <h5 className="text-dark fw-bold mb-4">Home Information</h5>
                    <div className="mb-4">
                      <label className="form-label">Address</label>
                      <input type="text" className="form-control" value={profile.address || ''} readOnly />
                    </div>
                    <div className="row g-3 mb-4">
                      <div className="col-md-6">
                        <label className="form-label">City</label>
                        <input type="text" className="form-control" value={profile.city || ''} readOnly />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label">State</label>
                        <input type="text" className="form-control" value={profile.state || ''} readOnly />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label">ZIP</label>
                        <input type="text" className="form-control" value={profile.zip_code || ''} readOnly />
                      </div>
                    </div>
                    <div className="row g-3 mb-4">
                      <div className="col-md-6">
                        <label className="form-label">Home Type</label>
                        <input type="text" className="form-control" value={profile.home_type || 'Not specified'} readOnly />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Home Age</label>
                        <input type="text" className="form-control" value={profile.home_age || 'Not specified'} readOnly />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-8">
                  <button className="btn btn-light-primary me-3">
                    <i className="ki-duotone ki-pencil fs-5 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    Edit Profile
                  </button>
                  <button className="btn btn-light-danger">
                    <i className="ki-duotone ki-trash fs-5 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                      <span className="path3"></span>
                      <span className="path4"></span>
                      <span className="path5"></span>
                    </i>
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-top py-4">
        <div className="container-fluid">
          <div className="row align-items-center">
            <div className="col-md-6">
              <p className="text-muted mb-0">© 2024 TradeWorks Home. Made for homeowners who care about their homes.</p>
            </div>
            <div className="col-md-6 text-md-end">
              <div className="d-flex justify-content-md-end gap-4">
                <a href="#" className="text-muted text-hover-primary">Help Center</a>
                <a href="#" className="text-muted text-hover-primary">Privacy</a>
                <a href="#" className="text-muted text-hover-primary">Terms</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default HomeownerPortalPage