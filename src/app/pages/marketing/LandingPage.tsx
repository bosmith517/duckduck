import React, { useState } from 'react'
import { Link } from 'react-router-dom'

const LandingPage: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

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
                <a className="nav-link fw-semibold" href="#features">Features</a>
              </li>
              <li className="nav-item dropdown">
                <a className="nav-link dropdown-toggle fw-semibold" href="#" role="button" data-bs-toggle="dropdown">
                  Industries
                </a>
                <ul className="dropdown-menu">
                  <li><a className="dropdown-item" href="#hvac">HVAC</a></li>
                  <li><a className="dropdown-item" href="#plumbing">Plumbing</a></li>
                  <li><a className="dropdown-item" href="#electrical">Electrical</a></li>
                  <li><a className="dropdown-item" href="#handyman">Handyman</a></li>
                  <li><a className="dropdown-item" href="#cleaning">Cleaning</a></li>
                </ul>
              </li>
              <li className="nav-item">
                <a className="nav-link fw-semibold" href="#pricing">Pricing</a>
              </li>
              <li className="nav-item">
                <a className="nav-link fw-semibold" href="#testimonials">Success Stories</a>
              </li>
              <li className="nav-item">
                <Link className="nav-link fw-semibold" to="/demo">Free Demo</Link>
              </li>
              <li className="nav-item ms-3">
                <Link className="btn btn-primary px-4" to="/signup">Try Free - 14 Days</Link>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-primary py-20" style={{marginTop: '76px'}}>
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-6">
              <div className="badge bg-light text-primary mb-4 px-3 py-2 fs-7 fw-bold">
                🚀 SAVE TIME, EARN MORE, BUILD REPUTATION
              </div>
              <h1 className="display-3 fw-bolder text-dark mb-4 lh-1">
                Grow Your Service Business 
                <span className="text-warning">50% Faster</span> 
                Than Any Competitor
              </h1>
              <p className="fs-4 text-dark mb-6 lh-base">
                Join 50,000+ service professionals using our all-in-one platform with built-in 
                customer portals, AI-powered recommendations, and advanced communication tools 
                that other platforms don't offer.
              </p>
              
              {/* Key Benefits */}
              <div className="row g-4 mb-6">
                <div className="col-md-6">
                  <div className="d-flex align-items-center text-dark">
                    <div className="symbol symbol-30px bg-success me-3">
                      <span className="symbol-label">
                        <i className="ki-duotone ki-chart-line-up fs-6 text-white">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                      </span>
                    </div>
                    <span className="fs-6 fw-semibold">45% Average Revenue Increase</span>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="d-flex align-items-center text-dark">
                    <div className="symbol symbol-30px bg-success me-3">
                      <span className="symbol-label">
                        <i className="ki-duotone ki-time fs-6 text-white">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                      </span>
                    </div>
                    <span className="fs-6 fw-semibold">12+ Hours Saved Weekly</span>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="d-flex align-items-center text-dark">
                    <div className="symbol symbol-30px bg-success me-3">
                      <span className="symbol-label">
                        <i className="ki-duotone ki-star fs-6 text-white">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                      </span>
                    </div>
                    <span className="fs-6 fw-semibold">4.9/5 Customer Satisfaction</span>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="d-flex align-items-center text-dark">
                    <div className="symbol symbol-30px bg-success me-3">
                      <span className="symbol-label">
                        <i className="ki-duotone ki-rocket fs-6 text-white">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                      </span>
                    </div>
                    <span className="fs-6 fw-semibold">Setup in 15 Minutes</span>
                  </div>
                </div>
              </div>

              <div className="d-flex gap-3 flex-wrap mb-6">
                <Link className="btn btn-lg btn-light text-primary fw-bold px-6" to="/signup">
                  <i className="ki-duotone ki-rocket fs-3 me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Start Free 14-Day Trial
                </Link>
                <button className="btn btn-lg btn-outline-light fw-semibold" data-bs-toggle="modal" data-bs-target="#demoModal">
                  <i className="ki-duotone ki-play fs-3 me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Watch 3-Min Demo
                </button>
              </div>
              
              <div className="d-flex align-items-center gap-6 text-dark">
                <div className="d-flex align-items-center">
                  <i className="ki-duotone ki-check-circle fs-4 text-success me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  <span className="fs-7">No Credit Card Required</span>
                </div>
                <div className="d-flex align-items-center">
                  <i className="ki-duotone ki-check-circle fs-4 text-success me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  <span className="fs-7">Cancel Anytime</span>
                </div>
                <div className="d-flex align-items-center">
                  <i className="ki-duotone ki-check-circle fs-4 text-success me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  <span className="fs-7">Free Migration</span>
                </div>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="position-relative">
                {/* Hero Image/Video Placeholder */}
                <div className="card shadow-lg border-0">
                  <div className="card-body p-0">
                    <img 
                      src="https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600&h=400&fit=crop" 
                      alt="TradeWorks Pro Dashboard" 
                      className="img-fluid rounded-3"
                    />
                    <div className="position-absolute top-50 start-50 translate-middle">
                      <button className="btn btn-icon btn-circle btn-light-primary btn-lg shadow" data-bs-toggle="modal" data-bs-target="#demoModal">
                        <i className="ki-duotone ki-play fs-2x text-primary">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Floating Reviews */}
                <div className="position-absolute top-0 end-0 me-n5 mt-5 d-none d-xl-block">
                  <div className="card shadow-sm border-0" style={{width: '200px'}}>
                    <div className="card-body p-4">
                      <div className="d-flex mb-2">
                        {[1,2,3,4,5].map(i => (
                          <i key={i} className="ki-duotone ki-star fs-6 text-warning">
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                        ))}
                      </div>
                      <p className="fs-8 mb-2">"Switched from competitors. Best decision ever!"</p>
                      <div className="fs-9 text-dark">- Mike Johnson, HVAC Pro</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-8 bg-light">
        <div className="container">
          <div className="text-center">
            <p className="text-dark fs-6 mb-4">Trusted by service professionals across 50+ industries</p>
            <div className="row align-items-center justify-content-center g-8">
              <div className="col-6 col-md-2">
                <div className="text-center">
                  <h4 className="fw-bold text-primary mb-1">50,000+</h4>
                  <small className="text-dark">Active Users</small>
                </div>
              </div>
              <div className="col-6 col-md-2">
                <div className="text-center">
                  <h4 className="fw-bold text-primary mb-1">5M+</h4>
                  <small className="text-dark">Jobs Completed</small>
                </div>
              </div>
              <div className="col-6 col-md-2">
                <div className="text-center">
                  <h4 className="fw-bold text-primary mb-1">45%</h4>
                  <small className="text-dark">Avg Revenue Growth</small>
                </div>
              </div>
              <div className="col-6 col-md-2">
                <div className="text-center">
                  <h4 className="fw-bold text-primary mb-1">4.9/5</h4>
                  <small className="text-dark">Customer Rating</small>
                </div>
              </div>
              <div className="col-6 col-md-2">
                <div className="text-center">
                  <h4 className="fw-bold text-primary mb-1">12+</h4>
                  <small className="text-dark">Hours Saved/Week</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us Over HouseCall Pro */}
      <section className="py-15">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="display-5 fw-bold text-dark mb-4">
              Why Service Pros Are Switching to TradeWorks Pro
            </h2>
            <p className="fs-4 text-muted">
              Get everything competitors offer, plus advanced features they don't have
            </p>
          </div>

          <div className="row g-8">
            {/* Customer Portals */}
            <div className="col-lg-4">
              <div className="card h-100 border-0 shadow-sm">
                <div className="card-body p-8">
                  <div className="d-flex align-items-center mb-4">
                    <span className="badge badge-light-primary fs-8 me-3">EXCLUSIVE</span>
                    <h4 className="fw-bold text-dark mb-0">Smart Customer Portals</h4>
                  </div>
                  <p className="text-muted fs-6 mb-5">
                    Give customers 24/7 access to their equipment history, real-time technician tracking, 
                    and instant communication - features HouseCall Pro doesn't offer.
                  </p>
                  <ul className="list-unstyled">
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-6 text-dark">Real-time GPS technician tracking</span>
                    </li>
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-6 text-dark">Digital equipment twins with photos</span>
                    </li>
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-6 text-dark">Complete service history access</span>
                    </li>
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-6 text-dark">Built-in messaging & video calls</span>
                    </li>
                  </ul>
                  <div className="bg-light-primary p-4 rounded">
                    <div className="fs-7 text-primary fw-bold">"Customer satisfaction increased 40% since adding portals!"</div>
                    <div className="fs-8 text-muted">- Sarah M., Plumbing Pro</div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Features */}
            <div className="col-lg-4">
              <div className="card h-100 border-0 shadow-sm">
                <div className="card-body p-8">
                  <div className="d-flex align-items-center mb-4">
                    <span className="badge badge-light-success fs-8 me-3">AI-POWERED</span>
                    <h4 className="fw-bold text-dark mb-0">Smart AI Assistant</h4>
                  </div>
                  <p className="text-muted fs-6 mb-5">
                    Our AI identifies equipment from photos, predicts maintenance needs, 
                    and auto-generates service recommendations.
                  </p>
                  <ul className="list-unstyled">
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-6 text-dark">Photo-based equipment identification</span>
                    </li>
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-6 text-dark">Predictive maintenance alerts</span>
                    </li>
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-6 text-dark">Climate-based recommendations</span>
                    </li>
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-6 text-dark">Smart scheduling optimization</span>
                    </li>
                  </ul>
                  <div className="bg-light-success p-4 rounded">
                    <div className="fs-7 text-success fw-bold">"AI helped me book 60% more maintenance calls!"</div>
                    <div className="fs-8 text-muted">- Carlos R., HVAC Specialist</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Advanced Communication */}
            <div className="col-lg-4">
              <div className="card h-100 border-0 shadow-sm">
                <div className="card-body p-8">
                  <div className="d-flex align-items-center mb-4">
                    <span className="badge badge-light-warning fs-8 me-3">BUILT-IN</span>
                    <h4 className="fw-bold text-dark mb-0">Complete Comm Suite</h4>
                  </div>
                  <p className="text-muted fs-6 mb-5">
                    Built-in VoIP calling, SMS, video conferencing, and team chat. 
                    No more switching between multiple apps.
                  </p>
                  <ul className="list-unstyled">
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-6 text-dark">Professional VoIP phone system</span>
                    </li>
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-6 text-dark">SMS & MMS messaging</span>
                    </li>
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-6 text-dark">HD video conferencing</span>
                    </li>
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-6 text-dark">Team collaboration tools</span>
                    </li>
                  </ul>
                  <div className="bg-light-warning p-4 rounded">
                    <div className="fs-7 text-warning fw-bold">"Saves me $200/month on phone & video tools!"</div>
                    <div className="fs-8 text-muted">- Jennifer L., Electrical</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Industry-Specific Sections */}
      <section id="industries" className="py-15 bg-light">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="display-5 fw-bold text-dark mb-4">Built for Your Industry</h2>
            <p className="fs-4 text-muted">Customized features for every service trade</p>
          </div>

          <div className="row g-6">
            <div className="col-lg-6">
              <div className="card border-0 shadow-sm">
                <div className="card-body p-6">
                  <div className="d-flex align-items-center mb-4">
                    <div className="symbol symbol-50px bg-light-primary me-4">
                      <span className="symbol-label">
                        <i className="ki-duotone ki-setting-3 fs-2 text-primary"></i>
                      </span>
                    </div>
                    <div>
                      <h5 className="fw-bold text-dark mb-1">HVAC Specialists</h5>
                      <p className="text-muted fs-7 mb-0">Seasonal scheduling, equipment monitoring</p>
                    </div>
                  </div>
                  <ul className="list-unstyled">
                    <li className="d-flex align-items-center mb-2">
                      <i className="ki-duotone ki-check fs-6 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-7 text-dark">Seasonal maintenance reminders</span>
                    </li>
                    <li className="d-flex align-items-center mb-2">
                      <i className="ki-duotone ki-check fs-6 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-7 text-dark">Filter change tracking</span>
                    </li>
                    <li className="d-flex align-items-center">
                      <i className="ki-duotone ki-check fs-6 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-7 text-dark">Energy efficiency reports</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="card border-0 shadow-sm">
                <div className="card-body p-6">
                  <div className="d-flex align-items-center mb-4">
                    <div className="symbol symbol-50px bg-light-info me-4">
                      <span className="symbol-label">
                        <i className="ki-duotone ki-droplet fs-2 text-info"></i>
                      </span>
                    </div>
                    <div>
                      <h5 className="fw-bold text-dark mb-1">Plumbing Professionals</h5>
                      <p className="text-muted fs-7 mb-0">Emergency dispatch, leak detection</p>
                    </div>
                  </div>
                  <ul className="list-unstyled">
                    <li className="d-flex align-items-center mb-2">
                      <i className="ki-duotone ki-check fs-6 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-7 text-dark">Emergency call prioritization</span>
                    </li>
                    <li className="d-flex align-items-center mb-2">
                      <i className="ki-duotone ki-check fs-6 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-7 text-dark">Water damage prevention alerts</span>
                    </li>
                    <li className="d-flex align-items-center">
                      <i className="ki-duotone ki-check fs-6 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-7 text-dark">Pipe inspection reports</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="card border-0 shadow-sm">
                <div className="card-body p-6">
                  <div className="d-flex align-items-center mb-4">
                    <div className="symbol symbol-50px bg-light-warning me-4">
                      <span className="symbol-label">
                        <i className="ki-duotone ki-electricity fs-2 text-warning"></i>
                      </span>
                    </div>
                    <div>
                      <h5 className="fw-bold text-dark mb-1">Electricians</h5>
                      <p className="text-muted fs-7 mb-0">Safety protocols, code compliance</p>
                    </div>
                  </div>
                  <ul className="list-unstyled">
                    <li className="d-flex align-items-center mb-2">
                      <i className="ki-duotone ki-check fs-6 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-7 text-dark">Safety inspection checklists</span>
                    </li>
                    <li className="d-flex align-items-center mb-2">
                      <i className="ki-duotone ki-check fs-6 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-7 text-dark">Code compliance tracking</span>
                    </li>
                    <li className="d-flex align-items-center">
                      <i className="ki-duotone ki-check fs-6 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-7 text-dark">Panel upgrade recommendations</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="card border-0 shadow-sm">
                <div className="card-body p-6">
                  <div className="d-flex align-items-center mb-4">
                    <div className="symbol symbol-50px bg-light-success me-4">
                      <span className="symbol-label">
                        <i className="ki-duotone ki-broom fs-2 text-success"></i>
                      </span>
                    </div>
                    <div>
                      <h5 className="fw-bold text-dark mb-1">Cleaning Services</h5>
                      <p className="text-muted fs-7 mb-0">Quality control, recurring schedules</p>
                    </div>
                  </div>
                  <ul className="list-unstyled">
                    <li className="d-flex align-items-center mb-2">
                      <i className="ki-duotone ki-check fs-6 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-7 text-dark">Before/after photo verification</span>
                    </li>
                    <li className="d-flex align-items-center mb-2">
                      <i className="ki-duotone ki-check fs-6 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-7 text-dark">Automated recurring bookings</span>
                    </li>
                    <li className="d-flex align-items-center">
                      <i className="ki-duotone ki-check fs-6 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-7 text-dark">Quality rating system</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-15">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="display-5 fw-bold text-dark mb-4">
              Real Stories from Service Professionals
            </h2>
            <p className="fs-4 text-muted">See how TradeWorks Pro transformed their businesses</p>
          </div>

          <div className="row g-8">
            <div className="col-lg-4">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body p-8">
                  <div className="d-flex mb-4">
                    {[1,2,3,4,5].map(i => (
                      <i key={i} className="ki-duotone ki-star fs-5 text-warning">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                    ))}
                  </div>
                  <blockquote className="fs-6 text-dark mb-6">
                    "Switched from HouseCall Pro 6 months ago. Revenue up 47%, customers love the 
                    portal features. The AI recommendations alone pay for the software."
                  </blockquote>
                  <div className="d-flex align-items-center">
                    <div className="symbol symbol-50px me-4">
                      <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face" alt="Mike Johnson" className="w-100 rounded-circle" />
                    </div>
                    <div>
                      <div className="fw-bold text-dark">Mike Johnson</div>
                      <div className="text-muted fs-7">Johnson HVAC Services</div>
                      <div className="text-primary fs-8">Dallas, TX • 8 Technicians</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg-4">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body p-8">
                  <div className="d-flex mb-4">
                    {[1,2,3,4,5].map(i => (
                      <i key={i} className="ki-duotone ki-star fs-5 text-warning">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                    ))}
                  </div>
                  <blockquote className="fs-6 text-dark mb-6">
                    "The customer portals are a game-changer. Customers track their technician 
                    in real-time and can see all their equipment history. 5-star reviews doubled!"
                  </blockquote>
                  <div className="d-flex align-items-center">
                    <div className="symbol symbol-50px me-4">
                      <img src="https://images.unsplash.com/photo-1494790108755-2616b612b2e5?w=100&h=100&fit=crop&crop=face" alt="Sarah Chen" className="w-100 rounded-circle" />
                    </div>
                    <div>
                      <div className="fw-bold text-dark">Sarah Chen</div>
                      <div className="text-muted fs-7">Elite Plumbing Solutions</div>
                      <div className="text-primary fs-8">Seattle, WA • 15 Technicians</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg-4">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body p-8">
                  <div className="d-flex mb-4">
                    {[1,2,3,4,5].map(i => (
                      <i key={i} className="ki-duotone ki-star fs-5 text-warning">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                    ))}
                  </div>
                  <blockquote className="fs-6 text-dark mb-6">
                    "Migration from HouseCall Pro was seamless. The built-in phone system alone 
                    saves us $300/month. ROI was immediate."
                  </blockquote>
                  <div className="d-flex align-items-center">
                    <div className="symbol symbol-50px me-4">
                      <img src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face" alt="Carlos Rodriguez" className="w-100 rounded-circle" />
                    </div>
                    <div>
                      <div className="fw-bold text-dark">Carlos Rodriguez</div>
                      <div className="text-muted fs-7">Rodriguez Electrical</div>
                      <div className="text-primary fs-8">Phoenix, AZ • 12 Technicians</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Competitive Pricing Section */}
      <section id="pricing" className="py-15 bg-light">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="display-5 fw-bold text-dark mb-4">
              Better Features, Better Price Than Competitors
            </h2>
            <p className="fs-4 text-muted">Get more for less with our transparent pricing</p>
            <div className="badge bg-primary text-white px-4 py-2 fs-6">
              💰 SAVE UP TO 40% vs Leading Platforms
            </div>
          </div>

          <div className="row justify-content-center g-8">
            {/* Starter Plan */}
            <div className="col-lg-4">
              <div className="card border-0 shadow-sm">
                <div className="card-body p-8">
                  <div className="text-center mb-6">
                    <h4 className="fw-bold text-dark">Starter</h4>
                    <div className="d-flex align-items-baseline justify-content-center">
                      <span className="fs-1 fw-bold text-dark">$49</span>
                      <span className="text-muted">/month</span>
                    </div>
                    <div className="fs-7 text-muted mb-2">vs Competitors' $79/month</div>
                    <div className="badge bg-light-success text-success">SAVE $30/month</div>
                    <small className="d-block text-muted mt-2">Up to 3 technicians</small>
                  </div>
                  <ul className="list-unstyled mb-8">
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-6">Everything HouseCall Pro has</span>
                    </li>
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-6"><strong>+ Customer portals</strong></span>
                    </li>
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-6"><strong>+ AI equipment recognition</strong></span>
                    </li>
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-6"><strong>+ Built-in VoIP & SMS</strong></span>
                    </li>
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-6">Real-time technician tracking</span>
                    </li>
                  </ul>
                  <Link className="btn btn-outline-primary w-100 mb-3" to="/signup?plan=starter">
                    Start Free 14-Day Trial
                  </Link>
                  <div className="text-center">
                    <small className="text-muted">No credit card required</small>
                  </div>
                </div>
              </div>
            </div>

            {/* Professional Plan */}
            <div className="col-lg-4">
              <div className="card border-primary shadow-lg position-relative">
                <div className="position-absolute top-0 start-50 translate-middle">
                  <span className="badge badge-primary px-4 py-2 fs-7">🔥 MOST POPULAR</span>
                </div>
                <div className="card-body p-8">
                  <div className="text-center mb-6">
                    <h4 className="fw-bold text-dark">Professional</h4>
                    <div className="d-flex align-items-baseline justify-content-center">
                      <span className="fs-1 fw-bold text-dark">$199</span>
                      <span className="text-muted">/month</span>
                    </div>
                    <div className="fs-7 text-muted mb-2">vs HouseCall Pro's $287/month</div>
                    <div className="badge bg-light-success text-success">SAVE $88/month</div>
                    <small className="d-block text-muted mt-2">Up to 25 technicians</small>
                  </div>
                  <ul className="list-unstyled mb-8">
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-6">Everything in Starter</span>
                    </li>
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-6"><strong>+ Advanced AI predictions</strong></span>
                    </li>
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-6"><strong>+ HD video conferencing</strong></span>
                    </li>
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-6"><strong>+ Advanced analytics</strong></span>
                    </li>
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-6">Priority support</span>
                    </li>
                  </ul>
                  <Link className="btn btn-primary w-100 mb-3" to="/signup?plan=professional">
                    Start Free 14-Day Trial
                  </Link>
                  <div className="text-center">
                    <small className="text-muted">No credit card required</small>
                  </div>
                </div>
              </div>
            </div>

            {/* Enterprise Plan */}
            <div className="col-lg-4">
              <div className="card border-0 shadow-sm">
                <div className="card-body p-8">
                  <div className="text-center mb-6">
                    <h4 className="fw-bold text-dark">Enterprise</h4>
                    <div className="d-flex align-items-baseline justify-content-center">
                      <span className="fs-1 fw-bold text-dark">Custom</span>
                    </div>
                    <div className="fs-7 text-muted mb-2">vs HouseCall Pro's $497+/month</div>
                    <div className="badge bg-light-success text-success">SAVE $200+/month</div>
                    <small className="d-block text-muted mt-2">Unlimited technicians</small>
                  </div>
                  <ul className="list-unstyled mb-8">
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-6">Everything in Professional</span>
                    </li>
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-6"><strong>+ Custom integrations</strong></span>
                    </li>
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-6"><strong>+ White-label options</strong></span>
                    </li>
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-6">Dedicated account manager</span>
                    </li>
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-6">24/7 phone support</span>
                    </li>
                  </ul>
                  <button className="btn btn-outline-primary w-100 mb-3" data-bs-toggle="modal" data-bs-target="#contactModal">
                    Contact Sales
                  </button>
                  <div className="text-center">
                    <small className="text-muted">Custom pricing available</small>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Migration Guarantee */}
          <div className="text-center mt-10">
            <div className="card border-0 bg-primary">
              <div className="card-body p-6">
                <h5 className="fw-bold text-white mb-3">
                  🚀 FREE Migration from Any Platform
                </h5>
                <p className="text-white opacity-75 mb-4">
                  Our team will migrate all your data for free. Most migrations complete in 24 hours.
                </p>
                <Link className="btn btn-light text-primary fw-bold" to="/migration">
                  Get Free Migration Quote
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-15 bg-primary">
        <div className="container text-center">
          <h2 className="display-5 fw-bold text-dark mb-4">
            Ready to Beat Your Competition?
          </h2>
          <p className="fs-4 text-dark mb-8">
            Join 50,000+ service professionals who chose TradeWorks Pro over the competition
          </p>
          
          <div className="row justify-content-center mb-8">
            <div className="col-md-8">
              <div className="d-flex justify-content-center gap-8 flex-wrap">
                <div className="text-center text-dark">
                  <h4 className="fw-bold">14 Days</h4>
                  <small>Free Trial</small>
                </div>
                <div className="text-center text-dark">
                  <h4 className="fw-bold">15 Min</h4>
                  <small>Setup Time</small>
                </div>
                <div className="text-center text-dark">
                  <h4 className="fw-bold">24/7</h4>
                  <small>Support</small>
                </div>
                <div className="text-center text-dark">
                  <h4 className="fw-bold">$0</h4>
                  <small>Migration Cost</small>
                </div>
              </div>
            </div>
          </div>

          <div className="d-flex justify-content-center gap-4 flex-wrap">
            <Link className="btn btn-lg btn-light text-primary fw-bold px-8" to="/signup">
              <i className="ki-duotone ki-rocket fs-3 me-2">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              Start Free Trial - No Credit Card
            </Link>
            <button className="btn btn-lg btn-outline-light fw-semibold" data-bs-toggle="modal" data-bs-target="#demoModal">
              <i className="ki-duotone ki-play fs-3 me-2">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              Watch 3-Minute Demo
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-dark py-15">
        <div className="container">
          <div className="row g-8">
            <div className="col-lg-4">
              <div className="d-flex align-items-center mb-6">
                <div className="symbol symbol-40px me-3">
                  <span className="symbol-label bg-primary">
                    <i className="ki-duotone ki-technology-4 fs-2 text-white">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                  </span>
                </div>
                <span className="fs-2 fw-bold text-white">TradeWorks Pro</span>
              </div>
              <p className="text-gray-400 mb-6 fs-6">
                The complete customer experience platform designed specifically for service companies. 
                Better features, better price than the competition.
              </p>
              <div className="d-flex gap-3">
                <a href="#" className="btn btn-sm btn-icon btn-light-primary">
                  <i className="ki-duotone ki-facebook fs-4"></i>
                </a>
                <a href="#" className="btn btn-sm btn-icon btn-light-primary">
                  <i className="ki-duotone ki-twitter fs-4"></i>
                </a>
                <a href="#" className="btn btn-sm btn-icon btn-light-primary">
                  <i className="ki-duotone ki-linkedin fs-4"></i>
                </a>
                <a href="#" className="btn btn-sm btn-icon btn-light-primary">
                  <i className="ki-duotone ki-youtube fs-4"></i>
                </a>
              </div>
            </div>
            
            <div className="col-lg-2">
              <h6 className="text-white fw-bold mb-4">Product</h6>
              <ul className="list-unstyled">
                <li className="mb-3"><a href="#features" className="text-gray-400 text-hover-white fs-6">Features</a></li>
                <li className="mb-3"><a href="#pricing" className="text-gray-400 text-hover-white fs-6">Pricing</a></li>
                <li className="mb-3"><a href="/demo" className="text-gray-400 text-hover-white fs-6">Demo</a></li>
                <li className="mb-3"><a href="/migration" className="text-gray-400 text-hover-white fs-6">Migration</a></li>
                <li className="mb-3"><a href="/integrations" className="text-gray-400 text-hover-white fs-6">Integrations</a></li>
              </ul>
            </div>
            
            <div className="col-lg-2">
              <h6 className="text-white fw-bold mb-4">Industries</h6>
              <ul className="list-unstyled">
                <li className="mb-3"><a href="#hvac" className="text-gray-400 text-hover-white fs-6">HVAC</a></li>
                <li className="mb-3"><a href="#plumbing" className="text-gray-400 text-hover-white fs-6">Plumbing</a></li>
                <li className="mb-3"><a href="#electrical" className="text-gray-400 text-hover-white fs-6">Electrical</a></li>
                <li className="mb-3"><a href="#handyman" className="text-gray-400 text-hover-white fs-6">Handyman</a></li>
                <li className="mb-3"><a href="#cleaning" className="text-gray-400 text-hover-white fs-6">Cleaning</a></li>
              </ul>
            </div>
            
            <div className="col-lg-2">
              <h6 className="text-white fw-bold mb-4">Resources</h6>
              <ul className="list-unstyled">
                <li className="mb-3"><a href="/help" className="text-gray-400 text-hover-white fs-6">Help Center</a></li>
                <li className="mb-3"><a href="/blog" className="text-gray-400 text-hover-white fs-6">Blog</a></li>
                <li className="mb-3"><a href="/webinars" className="text-gray-400 text-hover-white fs-6">Webinars</a></li>
                <li className="mb-3"><a href="/case-studies" className="text-gray-400 text-hover-white fs-6">Case Studies</a></li>
                <li className="mb-3"><a href="/api" className="text-gray-400 text-hover-white fs-6">API Docs</a></li>
              </ul>
            </div>
            
            <div className="col-lg-2">
              <h6 className="text-white fw-bold mb-4">Company</h6>
              <ul className="list-unstyled">
                <li className="mb-3"><a href="/about" className="text-gray-400 text-hover-white fs-6">About Us</a></li>
                <li className="mb-3"><a href="/careers" className="text-gray-400 text-hover-white fs-6">Careers</a></li>
                <li className="mb-3"><a href="/contact" className="text-gray-400 text-hover-white fs-6">Contact</a></li>
                <li className="mb-3"><a href="/partners" className="text-gray-400 text-hover-white fs-6">Partners</a></li>
                <li className="mb-3"><a href="/press" className="text-gray-400 text-hover-white fs-6">Press</a></li>
              </ul>
            </div>
          </div>
          
          <hr className="border-gray-600 my-8" />
          
          <div className="row align-items-center">
            <div className="col-md-6">
              <p className="text-gray-400 mb-0 fs-7">© 2024 TradeWorks Pro. All rights reserved.</p>
            </div>
            <div className="col-md-6 text-md-end">
              <div className="d-flex justify-content-md-end gap-6">
                <a href="/privacy" className="text-gray-400 text-hover-white fs-7">Privacy Policy</a>
                <a href="/terms" className="text-gray-400 text-hover-white fs-7">Terms of Service</a>
                <a href="/security" className="text-gray-400 text-hover-white fs-7">Security</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage