import React, { useState } from 'react'
import { Link } from 'react-router-dom'

const LandingPage: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <div className="d-flex flex-column min-vh-100 bg-white">
      {/* Navigation Header */}
      <nav className="navbar navbar-expand-lg navbar-light bg-white shadow-sm">
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
                <a className="nav-link" href="#pricing">Pricing</a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="#demo">Demo</a>
              </li>
              <li className="nav-item">
                <Link className="nav-link" to="/customer-portal">Customer Portal</Link>
              </li>
              <li className="nav-item ms-3">
                <Link className="btn btn-primary" to="/signup">Start Free Trial</Link>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-primary py-20">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-6">
              <h1 className="display-4 fw-bold text-white mb-4">
                The Complete Customer Experience Platform for Service Companies
              </h1>
              <p className="fs-4 text-white opacity-75 mb-6">
                Transform your service business with AI-powered customer portals, real-time tracking, 
                smart maintenance recommendations, and seamless communication tools.
              </p>
              <div className="d-flex gap-3 flex-wrap">
                <Link className="btn btn-lg btn-light text-primary fw-bold" to="/signup">
                  <i className="ki-duotone ki-rocket fs-3 me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Start Free Trial
                </Link>
                <button className="btn btn-lg btn-outline-light" data-bs-toggle="modal" data-bs-target="#demoModal">
                  <i className="ki-duotone ki-play fs-3 me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Watch Demo
                </button>
              </div>
              <div className="mt-6">
                <small className="text-white opacity-50">
                  ✓ 14-day free trial • ✓ No credit card required • ✓ Cancel anytime
                </small>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="position-relative">
                <img 
                  src="https://images.unsplash.com/photo-1556740749-887f6717d7e4?w=600&h=400&fit=crop" 
                  alt="Service professional using TradeWorks Pro" 
                  className="img-fluid rounded-3 shadow-lg"
                />
                <div className="position-absolute top-0 start-0 w-100 h-100 bg-primary opacity-10 rounded-3"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-light">
        <div className="container">
          <div className="text-center mb-15">
            <h2 className="display-5 fw-bold text-dark mb-4">
              Everything Your Service Business Needs
            </h2>
            <p className="fs-4 text-muted">
              From customer portals to AI recommendations, we've got you covered
            </p>
          </div>

          <div className="row g-10">
            {/* Customer Portal */}
            <div className="col-lg-4">
              <div className="card h-100 border-0 shadow-sm">
                <div className="card-body text-center p-8">
                  <div className="symbol symbol-80px bg-light-primary mx-auto mb-5">
                    <span className="symbol-label">
                      <i className="ki-duotone ki-home-2 fs-2x text-primary">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                    </span>
                  </div>
                  <h4 className="fw-bold text-dark mb-3">Smart Customer Portals</h4>
                  <p className="text-muted fs-6 mb-5">
                    Give customers 24/7 access to their service history, equipment details, 
                    real-time technician tracking, and instant communication tools.
                  </p>
                  <ul className="list-unstyled text-start">
                    <li className="d-flex align-items-center mb-2">
                      <i className="ki-duotone ki-check fs-5 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Real-time technician tracking
                    </li>
                    <li className="d-flex align-items-center mb-2">
                      <i className="ki-duotone ki-check fs-5 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Digital equipment twins
                    </li>
                    <li className="d-flex align-items-center mb-2">
                      <i className="ki-duotone ki-check fs-5 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Service history & invoices
                    </li>
                    <li className="d-flex align-items-center">
                      <i className="ki-duotone ki-check fs-5 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Instant messaging & video calls
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* AI Features */}
            <div className="col-lg-4">
              <div className="card h-100 border-0 shadow-sm">
                <div className="card-body text-center p-8">
                  <div className="symbol symbol-80px bg-light-success mx-auto mb-5">
                    <span className="symbol-label">
                      <i className="ki-duotone ki-abstract-26 fs-2x text-success">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                    </span>
                  </div>
                  <h4 className="fw-bold text-dark mb-3">AI-Powered Intelligence</h4>
                  <p className="text-muted fs-6 mb-5">
                    Leverage artificial intelligence to provide predictive maintenance, 
                    equipment recognition, and personalized service recommendations.
                  </p>
                  <ul className="list-unstyled text-start">
                    <li className="d-flex align-items-center mb-2">
                      <i className="ki-duotone ki-check fs-5 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Photo-based equipment ID
                    </li>
                    <li className="d-flex align-items-center mb-2">
                      <i className="ki-duotone ki-check fs-5 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Predictive maintenance alerts
                    </li>
                    <li className="d-flex align-items-center mb-2">
                      <i className="ki-duotone ki-check fs-5 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Climate-based recommendations
                    </li>
                    <li className="d-flex align-items-center">
                      <i className="ki-duotone ki-check fs-5 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Automated scheduling optimization
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Communication Suite */}
            <div className="col-lg-4">
              <div className="card h-100 border-0 shadow-sm">
                <div className="card-body text-center p-8">
                  <div className="symbol symbol-80px bg-light-warning mx-auto mb-5">
                    <span className="symbol-label">
                      <i className="ki-duotone ki-message-text-2 fs-2x text-warning">
                        <span className="path1"></span>
                        <span className="path2"></span>
                        <span className="path3"></span>
                      </i>
                    </span>
                  </div>
                  <h4 className="fw-bold text-dark mb-3">Complete Communication Suite</h4>
                  <p className="text-muted fs-6 mb-5">
                    Built-in VoIP calling, SMS, video conferencing, and team chat. 
                    Everything your team needs to stay connected with customers.
                  </p>
                  <ul className="list-unstyled text-start">
                    <li className="d-flex align-items-center mb-2">
                      <i className="ki-duotone ki-check fs-5 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      VoIP calling system
                    </li>
                    <li className="d-flex align-items-center mb-2">
                      <i className="ki-duotone ki-check fs-5 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      SMS & MMS messaging
                    </li>
                    <li className="d-flex align-items-center mb-2">
                      <i className="ki-duotone ki-check fs-5 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      HD video conferencing
                    </li>
                    <li className="d-flex align-items-center">
                      <i className="ki-duotone ki-check fs-5 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Team collaboration tools
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20">
        <div className="container">
          <div className="text-center mb-15">
            <h2 className="display-5 fw-bold text-dark mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="fs-4 text-muted">
              Choose the plan that fits your business size and needs
            </p>
          </div>

          <div className="row justify-content-center g-8">
            {/* Starter Plan */}
            <div className="col-lg-4">
              <div className="card border-0 shadow-sm">
                <div className="card-body p-8">
                  <div className="text-center mb-6">
                    <h4 className="fw-bold text-dark">Starter</h4>
                    <div className="d-flex align-items-center justify-content-center">
                      <span className="fs-2 fw-bold text-dark">$99</span>
                      <span className="text-muted">/month</span>
                    </div>
                    <small className="text-muted">Up to 5 technicians</small>
                  </div>
                  <ul className="list-unstyled mb-8">
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Customer portals
                    </li>
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Real-time tracking
                    </li>
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Basic AI features
                    </li>
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      VoIP & SMS
                    </li>
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Email support
                    </li>
                  </ul>
                  <Link className="btn btn-outline-primary w-100" to="/signup?plan=starter">
                    Start Free Trial
                  </Link>
                </div>
              </div>
            </div>

            {/* Professional Plan */}
            <div className="col-lg-4">
              <div className="card border-primary shadow-lg position-relative">
                <div className="position-absolute top-0 start-50 translate-middle">
                  <span className="badge badge-primary px-4 py-2">Most Popular</span>
                </div>
                <div className="card-body p-8">
                  <div className="text-center mb-6">
                    <h4 className="fw-bold text-dark">Professional</h4>
                    <div className="d-flex align-items-center justify-content-center">
                      <span className="fs-2 fw-bold text-dark">$249</span>
                      <span className="text-muted">/month</span>
                    </div>
                    <small className="text-muted">Up to 25 technicians</small>
                  </div>
                  <ul className="list-unstyled mb-8">
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Everything in Starter
                    </li>
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Advanced AI features
                    </li>
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Video conferencing
                    </li>
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Analytics & reporting
                    </li>
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Priority support
                    </li>
                  </ul>
                  <Link className="btn btn-primary w-100" to="/signup?plan=professional">
                    Start Free Trial
                  </Link>
                </div>
              </div>
            </div>

            {/* Enterprise Plan */}
            <div className="col-lg-4">
              <div className="card border-0 shadow-sm">
                <div className="card-body p-8">
                  <div className="text-center mb-6">
                    <h4 className="fw-bold text-dark">Enterprise</h4>
                    <div className="d-flex align-items-center justify-content-center">
                      <span className="fs-2 fw-bold text-dark">Custom</span>
                    </div>
                    <small className="text-muted">Unlimited technicians</small>
                  </div>
                  <ul className="list-unstyled mb-8">
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Everything in Professional
                    </li>
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Custom integrations
                    </li>
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      White-label options
                    </li>
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Dedicated account manager
                    </li>
                    <li className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-check fs-5 text-success me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      24/7 phone support
                    </li>
                  </ul>
                  <button className="btn btn-outline-primary w-100" data-bs-toggle="modal" data-bs-target="#contactModal">
                    Contact Sales
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Homeowner Section */}
      <section id="homeowners" className="py-20 bg-light">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-6">
              <h2 className="display-5 fw-bold text-dark mb-4">
                For Homeowners: Your Digital Home Assistant
              </h2>
              <p className="fs-5 text-muted mb-6">
                Even without a service company, TradeWorks Pro can help you manage your home's 
                equipment, track maintenance schedules, and get AI-powered recommendations to 
                keep everything running smoothly.
              </p>
              <ul className="list-unstyled mb-6">
                <li className="d-flex align-items-center mb-3">
                  <i className="ki-duotone ki-check fs-4 text-success me-3">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  <span className="fs-6">Photo-based equipment identification</span>
                </li>
                <li className="d-flex align-items-center mb-3">
                  <i className="ki-duotone ki-check fs-4 text-success me-3">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  <span className="fs-6">Smart maintenance reminders</span>
                </li>
                <li className="d-flex align-items-center mb-3">
                  <i className="ki-duotone ki-check fs-4 text-success me-3">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  <span className="fs-6">Climate-specific seasonal tips</span>
                </li>
                <li className="d-flex align-items-center mb-3">
                  <i className="ki-duotone ki-check fs-4 text-success me-3">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  <span className="fs-6">Service provider directory</span>
                </li>
              </ul>
              <div className="d-flex gap-3">
                <Link className="btn btn-success btn-lg" to="/homeowner-signup">
                  <i className="ki-duotone ki-home-2 fs-3 me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Try Free for Homeowners
                </Link>
                <Link className="btn btn-outline-dark btn-lg" to="/demo/homeowner">
                  View Demo
                </Link>
              </div>
            </div>
            <div className="col-lg-6">
              <img 
                src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&h=400&fit=crop" 
                alt="Happy homeowner using smart home features" 
                className="img-fluid rounded-3 shadow-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary">
        <div className="container text-center">
          <h2 className="display-5 fw-bold text-white mb-4">
            Ready to Transform Your Service Business?
          </h2>
          <p className="fs-4 text-white opacity-75 mb-8">
            Join thousands of service companies already using TradeWorks Pro
          </p>
          <div className="d-flex justify-content-center gap-4 flex-wrap">
            <Link className="btn btn-lg btn-light text-primary fw-bold" to="/signup">
              <i className="ki-duotone ki-rocket fs-3 me-2">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              Start Your Free Trial
            </Link>
            <button className="btn btn-lg btn-outline-light" data-bs-toggle="modal" data-bs-target="#demoModal">
              <i className="ki-duotone ki-play fs-3 me-2">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              Schedule Demo
            </button>
          </div>
          <div className="mt-6">
            <small className="text-white opacity-50">
              ✓ 14-day free trial • ✓ Setup in under 15 minutes • ✓ Cancel anytime
            </small>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-dark py-10">
        <div className="container">
          <div className="row g-8">
            <div className="col-lg-4">
              <div className="d-flex align-items-center mb-4">
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
              <p className="text-muted mb-4">
                The complete customer experience platform designed specifically for service companies.
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
              </div>
            </div>
            <div className="col-lg-2">
              <h6 className="text-white fw-bold mb-4">Product</h6>
              <ul className="list-unstyled">
                <li className="mb-2"><a href="#features" className="text-muted text-hover-white">Features</a></li>
                <li className="mb-2"><a href="#pricing" className="text-muted text-hover-white">Pricing</a></li>
                <li className="mb-2"><a href="#" className="text-muted text-hover-white">API</a></li>
                <li className="mb-2"><a href="#" className="text-muted text-hover-white">Integrations</a></li>
              </ul>
            </div>
            <div className="col-lg-2">
              <h6 className="text-white fw-bold mb-4">Company</h6>
              <ul className="list-unstyled">
                <li className="mb-2"><a href="#" className="text-muted text-hover-white">About</a></li>
                <li className="mb-2"><a href="#" className="text-muted text-hover-white">Blog</a></li>
                <li className="mb-2"><a href="#" className="text-muted text-hover-white">Careers</a></li>
                <li className="mb-2"><a href="#" className="text-muted text-hover-white">Contact</a></li>
              </ul>
            </div>
            <div className="col-lg-2">
              <h6 className="text-white fw-bold mb-4">Support</h6>
              <ul className="list-unstyled">
                <li className="mb-2"><a href="#" className="text-muted text-hover-white">Help Center</a></li>
                <li className="mb-2"><a href="#" className="text-muted text-hover-white">Documentation</a></li>
                <li className="mb-2"><a href="#" className="text-muted text-hover-white">Status</a></li>
                <li className="mb-2"><a href="#" className="text-muted text-hover-white">Security</a></li>
              </ul>
            </div>
            <div className="col-lg-2">
              <h6 className="text-white fw-bold mb-4">Legal</h6>
              <ul className="list-unstyled">
                <li className="mb-2"><a href="#" className="text-muted text-hover-white">Privacy</a></li>
                <li className="mb-2"><a href="#" className="text-muted text-hover-white">Terms</a></li>
                <li className="mb-2"><a href="#" className="text-muted text-hover-white">GDPR</a></li>
                <li className="mb-2"><a href="#" className="text-muted text-hover-white">Compliance</a></li>
              </ul>
            </div>
          </div>
          <hr className="border-secondary my-8" />
          <div className="row align-items-center">
            <div className="col-md-6">
              <p className="text-muted mb-0">© 2024 TradeWorks Pro. All rights reserved.</p>
            </div>
            <div className="col-md-6 text-md-end">
              <p className="text-muted mb-0">Made with ❤️ for service professionals</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage