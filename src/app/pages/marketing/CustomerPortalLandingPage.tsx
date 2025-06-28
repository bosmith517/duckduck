import React, { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'

const CustomerPortalLandingPage: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [activeFeature, setActiveFeature] = useState(0)
  const [email, setEmail] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Auto-rotate features every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % 4)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Here you would integrate with your email service
    console.log('Email submitted:', email)
    setIsSubmitted(true)
    setTimeout(() => {
      setIsSubmitted(false)
      setEmail('')
    }, 3000)
  }

  const features = [
    {
      icon: 'geolocation',
      title: 'Real-Time Technician Tracking',
      description: 'See exactly where your technician is and get live ETA updates on an interactive map.',
      benefit: 'Never wonder when your service will arrive again'
    },
    {
      icon: 'technology-2',
      title: 'Smart Home Dashboard', 
      description: 'View your property details, equipment status, and service history all in one place.',
      benefit: 'Complete visibility into your home systems'
    },
    {
      icon: 'profile-user',
      title: 'Meet Your Technician',
      description: 'See detailed profiles, certifications, and ratings before they arrive at your door.',
      benefit: 'Know exactly who is coming to your home'
    },
    {
      icon: 'calendar-add',
      title: 'Instant Service Scheduling',
      description: 'Book appointments, request emergency service, or schedule maintenance with one click.',
      benefit: 'Service scheduling that fits your schedule'
    }
  ]

  const testimonials = [
    {
      name: 'Sarah Mitchell',
      location: 'Austin, TX',
      text: "I love being able to track my technician! No more waiting around all day wondering when they'll show up.",
      rating: 5,
      service: 'AC Repair'
    },
    {
      name: 'Mike Rodriguez',
      location: 'Houston, TX', 
      text: "The portal shows me everything about my HVAC system. I feel so much more informed about my home maintenance.",
      rating: 5,
      service: 'System Maintenance'
    },
    {
      name: 'Jennifer Chen',
      location: 'Dallas, TX',
      text: "Being able to see my technician's credentials and reviews beforehand gives me complete peace of mind.",
      rating: 5,
      service: 'Heat Pump Installation'
    }
  ]

  return (
    <div className="d-flex flex-column min-vh-100 bg-white">
      {/* Navigation Header */}
      <nav className="navbar navbar-expand-lg navbar-light bg-white shadow-sm fixed-top">
        <div className="container">
          <Link className="navbar-brand d-flex align-items-center" to="/">
            <div className="symbol symbol-40px me-3">
              <span className="symbol-label bg-primary">
                <i className="ki-duotone ki-technology-4 fs-2 text-white">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
              </span>
            </div>
            <span className="fs-2 fw-bold text-dark">TradeWorks Pro</span>
          </Link>
          
          <button 
            className="navbar-toggler" 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            type="button"
          >
            <span className="navbar-toggler-icon"></span>
          </button>
          
          <div className={`collapse navbar-collapse ${isMenuOpen ? 'show' : ''}`}>
            <ul className="navbar-nav ms-auto mb-2 mb-lg-0">
              <li className="nav-item">
                <a className="nav-link" href="#features">Features</a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="#demo">See It In Action</a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="#testimonials">Reviews</a>
              </li>
              <li className="nav-item ms-3">
                <a className="btn btn-primary" href="#get-started">Get Your Portal</a>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-primary py-20" style={{ marginTop: '76px' }}>
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-6">
              <div className="text-center text-lg-start">
                <h1 className="display-4 fw-bold text-white mb-4">
                  Your Personal
                  <span className="text-warning d-block">Service Command Center</span>
                </h1>
                <p className="fs-4 text-white opacity-75 mb-6">
                  Track technicians in real-time, manage your home systems, and stay connected with your service team - all from your exclusive customer portal.
                </p>
                <div className="d-flex flex-column flex-sm-row gap-3 justify-content-center justify-content-lg-start">
                  <a href="#demo" className="btn btn-warning btn-lg px-6">
                    <i className="ki-duotone ki-rocket fs-3 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    See It In Action
                  </a>
                  <a href="#get-started" className="btn btn-light-primary btn-lg px-6">
                    <i className="ki-duotone ki-entrance-right fs-3 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    Get Your Portal
                  </a>
                </div>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="text-center">
                <div className="position-relative">
                  {/* Portal Preview Mockup */}
                  <div className="card shadow-lg border-0 bg-white rounded-3 overflow-hidden" style={{ transform: 'rotate(-5deg) scale(0.9)' }}>
                    <div className="card-header bg-primary py-3">
                      <div className="d-flex align-items-center">
                        <div className="symbol symbol-30px me-2">
                          <span className="symbol-label bg-white bg-opacity-20">
                            <i className="ki-duotone ki-home fs-5 text-white">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                          </span>
                        </div>
                        <h6 className="text-white mb-0 fw-bold">Your Service Portal</h6>
                      </div>
                    </div>
                    <div className="card-body p-4">
                      <div className="d-flex align-items-center mb-3">
                        <div className="symbol symbol-40px me-3">
                          <div className="symbol-label bg-success">
                            <i className="ki-duotone ki-geolocation fs-5 text-white">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                          </div>
                        </div>
                        <div>
                          <div className="fw-bold text-dark">Mike is on the way!</div>
                          <div className="text-muted fs-7">ETA: 15 minutes</div>
                        </div>
                      </div>
                      <div className="bg-light rounded p-3 mb-3">
                        <div className="row g-2">
                          <div className="col-4">
                            <div className="text-center">
                              <div className="fw-bold text-primary">4.9★</div>
                              <div className="fs-8 text-muted">Rating</div>
                            </div>
                          </div>
                          <div className="col-4">
                            <div className="text-center">
                              <div className="fw-bold text-success">12yrs</div>
                              <div className="fs-8 text-muted">Experience</div>
                            </div>
                          </div>
                          <div className="col-4">
                            <div className="text-center">
                              <div className="fw-bold text-info">EPA</div>
                              <div className="fs-8 text-muted">Certified</div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <button className="btn btn-primary btn-sm w-100">
                        <i className="ki-duotone ki-message-text fs-6 me-1">
                          <span className="path1"></span>
                          <span className="path2"></span>
                          <span className="path3"></span>
                        </i>
                        Chat with Mike
                      </button>
                    </div>
                  </div>
                  {/* Floating badges */}
                  <div className="position-absolute top-0 end-0 translate-middle">
                    <div className="badge badge-circle badge-lg badge-warning">
                      <i className="ki-duotone ki-star fs-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                    </div>
                  </div>
                  <div className="position-absolute bottom-0 start-0 translate-middle">
                    <div className="badge badge-circle badge-lg badge-success">
                      <i className="ki-duotone ki-check fs-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-light">
        <div className="container">
          <div className="text-center mb-15">
            <h2 className="display-5 fw-bold text-dark mb-4">Everything You Need to Know</h2>
            <p className="fs-4 text-muted">Your customer portal puts you in complete control of your home service experience</p>
          </div>

          <div className="row">
            <div className="col-lg-6">
              {/* Feature Navigation */}
              <div className="d-flex flex-column gap-4">
                {features.map((feature, index) => (
                  <div 
                    key={index}
                    className={`card cursor-pointer transition-all ${
                      activeFeature === index ? 'border-primary shadow-sm' : 'border-light-primary'
                    }`}
                    onClick={() => setActiveFeature(index)}
                  >
                    <div className="card-body p-4">
                      <div className="d-flex align-items-start">
                        <div className={`symbol symbol-50px me-4 ${
                          activeFeature === index ? 'symbol-primary' : 'symbol-light-primary'
                        }`}>
                          <span className="symbol-label">
                            <i className={`ki-duotone ki-${feature.icon} fs-2 ${
                              activeFeature === index ? 'text-white' : 'text-primary'
                            }`}>
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                          </span>
                        </div>
                        <div className="flex-grow-1">
                          <h5 className="text-dark fw-bold mb-2">{feature.title}</h5>
                          <p className="text-muted mb-2">{feature.description}</p>
                          <div className="text-primary fs-7 fw-bold">
                            <i className="ki-duotone ki-check-circle fs-6 me-1">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                            {feature.benefit}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="col-lg-6">
              {/* Feature Preview */}
              <div className="position-sticky" style={{ top: '100px' }}>
                <div className="card border-0 shadow-lg">
                  <div className="card-body p-0">
                    {activeFeature === 0 && (
                      <div className="bg-primary text-white p-6 text-center">
                        <i className="ki-duotone ki-geolocation fs-5x mb-4 text-warning">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        <h4 className="text-white fw-bold mb-3">Live Tracking Demo</h4>
                        <div className="bg-white bg-opacity-20 rounded p-4 mb-4">
                          <div className="d-flex justify-content-between align-items-center text-white">
                            <span>Your Technician</span>
                            <span className="badge badge-warning">On Route</span>
                          </div>
                          <div className="progress mt-2" style={{ height: '6px' }}>
                            <div className="progress-bar bg-warning" style={{ width: '65%' }}></div>
                          </div>
                          <div className="mt-2 fs-7">ETA: 12 minutes • 2.3 miles away</div>
                        </div>
                        <p className="text-white opacity-75 mb-0">Real-time GPS tracking keeps you informed</p>
                      </div>
                    )}

                    {activeFeature === 1 && (
                      <div className="bg-success text-white p-6">
                        <i className="ki-duotone ki-technology-2 fs-5x mb-4 text-warning">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        <h4 className="text-white fw-bold mb-3">Smart Dashboard</h4>
                        <div className="row g-3 mb-4">
                          <div className="col-6">
                            <div className="bg-white bg-opacity-20 rounded p-3 text-center">
                              <div className="fw-bold">$485K</div>
                              <div className="fs-8 opacity-75">Property Value</div>
                            </div>
                          </div>
                          <div className="col-6">
                            <div className="bg-white bg-opacity-20 rounded p-3 text-center">
                              <div className="fw-bold">1,850 sq ft</div>
                              <div className="fs-8 opacity-75">Home Size</div>
                            </div>
                          </div>
                        </div>
                        <p className="text-white opacity-75 mb-0">Your complete home system overview</p>
                      </div>
                    )}

                    {activeFeature === 2 && (
                      <div className="bg-info text-white p-6 text-center">
                        <i className="ki-duotone ki-profile-user fs-5x mb-4 text-warning">
                          <span className="path1"></span>
                          <span className="path2"></span>
                          <span className="path3"></span>
                        </i>
                        <h4 className="text-white fw-bold mb-3">Technician Profile</h4>
                        <div className="d-flex align-items-center justify-content-center mb-4">
                          <div className="symbol symbol-60px me-3">
                            <div className="symbol-label bg-white">
                              <i className="ki-duotone ki-profile-circle fs-2 text-info">
                                <span className="path1"></span>
                                <span className="path2"></span>
                                <span className="path3"></span>
                              </i>
                            </div>
                          </div>
                          <div className="text-start">
                            <div className="text-white fw-bold">Mike Rodriguez</div>
                            <div className="text-white opacity-75">12 Years Experience</div>
                            <div className="text-warning">★★★★★ 4.9 Rating</div>
                          </div>
                        </div>
                        <p className="text-white opacity-75 mb-0">Know your technician before they arrive</p>
                      </div>
                    )}

                    {activeFeature === 3 && (
                      <div className="bg-warning text-dark p-6 text-center">
                        <i className="ki-duotone ki-calendar-add fs-5x mb-4 text-primary">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        <h4 className="text-dark fw-bold mb-3">Easy Scheduling</h4>
                        <div className="bg-white rounded p-4 mb-4">
                          <div className="d-flex gap-2 mb-3">
                            <button className="btn btn-primary btn-sm flex-fill">Emergency</button>
                            <button className="btn btn-light btn-sm flex-fill">Same Day</button>
                            <button className="btn btn-light btn-sm flex-fill">Schedule</button>
                          </div>
                          <div className="text-muted fs-7">Available time slots automatically synced</div>
                        </div>
                        <p className="text-dark opacity-75 mb-0">Book service instantly, 24/7</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo" className="py-20 bg-white">
        <div className="container">
          <div className="text-center mb-15">
            <h2 className="display-5 fw-bold text-dark mb-4">See Your Portal in Action</h2>
            <p className="fs-4 text-muted">Experience the future of home service management</p>
          </div>

          <div className="row justify-content-center">
            <div className="col-lg-10">
              <div className="card border-0 shadow-lg overflow-hidden">
                <div className="card-body p-0">
                  <div className="bg-dark py-3 px-4">
                    <div className="d-flex align-items-center">
                      <div className="d-flex gap-2 me-4">
                        <div className="bg-danger rounded-circle" style={{ width: '12px', height: '12px' }}></div>
                        <div className="bg-warning rounded-circle" style={{ width: '12px', height: '12px' }}></div>
                        <div className="bg-success rounded-circle" style={{ width: '12px', height: '12px' }}></div>
                      </div>
                      <div className="text-white fs-7">customer-portal.tradeworkspro.com</div>
                    </div>
                  </div>
                  
                  {/* Demo Portal Interface */}
                  <div className="p-6 bg-light">
                    <div className="row g-4">
                      <div className="col-md-8">
                        <div className="card h-100">
                          <div className="card-header bg-primary text-white">
                            <h6 className="mb-0">
                              <i className="ki-duotone ki-geolocation fs-4 me-2">
                                <span className="path1"></span>
                                <span className="path2"></span>
                              </i>
                              Your Technician is On the Way
                            </h6>
                          </div>
                          <div className="card-body p-0">
                            <div className="bg-success text-white p-4 text-center">
                              <i className="ki-duotone ki-map fs-5x mb-3">
                                <span className="path1"></span>
                                <span className="path2"></span>
                                <span className="path3"></span>
                              </i>
                              <h5 className="text-white mb-2">Interactive Map View</h5>
                              <p className="text-white opacity-75 mb-3">Real-time technician location tracking</p>
                              <div className="d-flex justify-content-center gap-4">
                                <div className="text-center">
                                  <div className="fw-bold">2.3 mi</div>
                                  <div className="fs-8 opacity-75">Distance</div>
                                </div>
                                <div className="text-center">
                                  <div className="fw-bold">12 min</div>
                                  <div className="fs-8 opacity-75">ETA</div>
                                </div>
                                <div className="text-center">
                                  <div className="fw-bold">★ 4.9</div>
                                  <div className="fs-8 opacity-75">Rating</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="col-md-4">
                        <div className="card mb-4">
                          <div className="card-body">
                            <h6 className="card-title">
                              <i className="ki-duotone ki-wrench fs-4 text-primary me-2">
                                <span className="path1"></span>
                                <span className="path2"></span>
                              </i>
                              Current Service
                            </h6>
                            <div className="mb-3">
                              <div className="fw-bold text-dark">AC System Maintenance</div>
                              <div className="text-muted fs-7">Scheduled for Today</div>
                            </div>
                            <div className="badge badge-light-success w-100 py-2">IN PROGRESS</div>
                          </div>
                        </div>
                        
                        <div className="card">
                          <div className="card-body">
                            <h6 className="card-title">
                              <i className="ki-duotone ki-profile-user fs-4 text-info me-2">
                                <span className="path1"></span>
                                <span className="path2"></span>
                                <span className="path3"></span>
                              </i>
                              Your Technician
                            </h6>
                            <div className="d-flex align-items-center mb-3">
                              <div className="symbol symbol-40px me-3">
                                <div className="symbol-label bg-info">MR</div>
                              </div>
                              <div>
                                <div className="fw-bold">Mike Rodriguez</div>
                                <div className="text-muted fs-8">Senior HVAC Tech</div>
                              </div>
                            </div>
                            <button className="btn btn-primary btn-sm w-100">
                              <i className="ki-duotone ki-message-text fs-6 me-1">
                                <span className="path1"></span>
                                <span className="path2"></span>
                                <span className="path3"></span>
                              </i>
                              Chat Now
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-8">
            <a href="#get-started" className="btn btn-primary btn-lg px-8">
              <i className="ki-duotone ki-entrance-right fs-3 me-2">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              Get Your Customer Portal
            </a>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 bg-light">
        <div className="container">
          <div className="text-center mb-15">
            <h2 className="display-5 fw-bold text-dark mb-4">What Homeowners Say</h2>
            <p className="fs-4 text-muted">Real reviews from real customers using their service portals</p>
          </div>

          <div className="row g-6">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="col-lg-4">
                <div className="card h-100 border-0 shadow-sm">
                  <div className="card-body p-6">
                    <div className="d-flex mb-4">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <i key={i} className="ki-duotone ki-star fs-5 text-warning">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                      ))}
                    </div>
                    <blockquote className="text-dark fs-5 fw-normal mb-4">
                      "{testimonial.text}"
                    </blockquote>
                    <div className="d-flex align-items-center">
                      <div className="symbol symbol-50px me-3">
                        <div className="symbol-label bg-primary text-white fw-bold">
                          {testimonial.name.split(' ').map(n => n[0]).join('')}
                        </div>
                      </div>
                      <div>
                        <div className="fw-bold text-dark">{testimonial.name}</div>
                        <div className="text-muted fs-7">{testimonial.location}</div>
                        <div className="text-primary fs-8">{testimonial.service}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="get-started" className="py-20 bg-primary">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-8 text-center">
              <h2 className="display-5 fw-bold text-white mb-4">
                Ready for the Ultimate Service Experience?
              </h2>
              <p className="fs-4 text-white opacity-75 mb-8">
                Join thousands of homeowners who never worry about service appointments again. 
                Get your personal customer portal when you book your first service.
              </p>

              <div className="row g-4 mb-8">
                <div className="col-md-4">
                  <div className="text-center">
                    <div className="symbol symbol-60px mx-auto mb-3">
                      <div className="symbol-label bg-warning">
                        <i className="ki-duotone ki-phone fs-2 text-dark">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                      </div>
                    </div>
                    <h5 className="text-white fw-bold mb-2">1. Call Us</h5>
                    <p className="text-white opacity-75 fs-6">Book your first service appointment</p>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="text-center">
                    <div className="symbol symbol-60px mx-auto mb-3">
                      <div className="symbol-label bg-warning">
                        <i className="ki-duotone ki-entrance-right fs-2 text-dark">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                      </div>
                    </div>
                    <h5 className="text-white fw-bold mb-2">2. Get Access</h5>
                    <p className="text-white opacity-75 fs-6">Receive your portal link via email</p>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="text-center">
                    <div className="symbol symbol-60px mx-auto mb-3">
                      <div className="symbol-label bg-warning">
                        <i className="ki-duotone ki-rocket fs-2 text-dark">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                      </div>
                    </div>
                    <h5 className="text-white fw-bold mb-2">3. Experience</h5>
                    <p className="text-white opacity-75 fs-6">Track, chat, and manage everything</p>
                  </div>
                </div>
              </div>

              <div className="d-flex flex-column flex-sm-row gap-4 justify-content-center align-items-center">
                <a 
                  href="tel:+15551234567" 
                  className="btn btn-warning btn-lg px-8"
                >
                  <i className="ki-duotone ki-phone fs-3 me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Call (555) 123-4567
                </a>
                
                <div className="text-white">or</div>
                
                <form onSubmit={handleEmailSubmit} className="d-flex gap-2">
                  <input
                    type="email"
                    className="form-control form-control-lg"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{ minWidth: '250px' }}
                  />
                  <button 
                    type="submit" 
                    className="btn btn-light btn-lg"
                    disabled={isSubmitted}
                  >
                    {isSubmitted ? (
                      <>
                        <i className="ki-duotone ki-check fs-4">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        Sent!
                      </>
                    ) : (
                      <>
                        <i className="ki-duotone ki-send fs-4">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        Get Info
                      </>
                    )}
                  </button>
                </form>
              </div>

              <p className="text-white opacity-50 fs-7 mt-4 mb-0">
                Free portal included with every service. No setup fees. No monthly charges.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-dark py-10">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-md-6">
              <div className="d-flex align-items-center">
                <div className="symbol symbol-40px me-3">
                  <span className="symbol-label bg-primary">
                    <i className="ki-duotone ki-technology-4 fs-2 text-white">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                  </span>
                </div>
                <div>
                  <div className="text-white fw-bold fs-4">TradeWorks Pro</div>
                  <div className="text-muted fs-7">Professional Home Services</div>
                </div>
              </div>
            </div>
            <div className="col-md-6 text-md-end">
              <div className="d-flex flex-column flex-md-row gap-4 justify-content-md-end">
                <a href="tel:+15551234567" className="text-white text-decoration-none">
                  <i className="ki-duotone ki-phone fs-5 me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  (555) 123-4567
                </a>
                <a href="mailto:service@tradeworkspro.com" className="text-white text-decoration-none">
                  <i className="ki-duotone ki-sms fs-5 me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  service@tradeworkspro.com
                </a>
              </div>
              <div className="text-muted fs-8 mt-2">
                © 2024 TradeWorks Pro. All rights reserved.
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default CustomerPortalLandingPage