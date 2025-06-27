import React, { useState } from 'react'

interface ServicePlan {
  id: string
  name: string
  tier: 'basic' | 'premium' | 'ultimate'
  monthlyPrice: number
  annualPrice: number
  description: string
  features: string[]
  includedServices: string[]
  discounts: {
    laborDiscount: number
    partsDiscount: number
    emergencyDiscount: number
  }
  isPopular?: boolean
  isCurrentPlan?: boolean
}

interface QuoteOption {
  id: string
  title: string
  type: 'repair' | 'replacement' | 'upgrade'
  description: string
  equipment: string
  basePrice: number
  laborHours: number
  warranty: string
  urgency: 'standard' | 'priority' | 'emergency'
  timeline: string
  benefits: string[]
  isRecommended?: boolean
}

interface QuotesAndPlansProps {
  customerId: string
}

export const QuotesAndPlans: React.FC<QuotesAndPlansProps> = ({ customerId }) => {
  const [activeTab, setActiveTab] = useState<'quotes' | 'plans' | 'current'>('quotes')
  const [selectedQuote, setSelectedQuote] = useState<string | null>(null)

  // Mock service plans
  const servicePlans: ServicePlan[] = [
    {
      id: 'basic',
      name: 'Essential Care',
      tier: 'basic',
      monthlyPrice: 29,
      annualPrice: 299,
      description: 'Basic maintenance and priority service for your essential home systems.',
      features: [
        '2 annual HVAC tune-ups',
        '10% discount on repairs',
        'Priority scheduling',
        'Free filter replacements',
        'Basic equipment monitoring'
      ],
      includedServices: [
        'Spring & Fall HVAC maintenance',
        'Air filter replacement (4x/year)',
        'System performance check'
      ],
      discounts: {
        laborDiscount: 10,
        partsDiscount: 5,
        emergencyDiscount: 0
      }
    },
    {
      id: 'premium',
      name: 'Complete Comfort',
      tier: 'premium',
      monthlyPrice: 49,
      annualPrice: 499,
      description: 'Comprehensive home system care with enhanced benefits and faster response.',
      features: [
        '4 annual HVAC tune-ups',
        '15% discount on repairs',
        'Priority scheduling',
        'Free filter replacements',
        'Advanced equipment monitoring',
        '24/7 emergency hotline',
        'Electrical system checks',
        'Plumbing maintenance'
      ],
      includedServices: [
        'Quarterly HVAC maintenance',
        'Air filter replacement (6x/year)',
        'Annual electrical inspection',
        'Plumbing system check',
        'Water heater maintenance'
      ],
      discounts: {
        laborDiscount: 15,
        partsDiscount: 10,
        emergencyDiscount: 20
      },
      isPopular: true,
      isCurrentPlan: true
    },
    {
      id: 'ultimate',
      name: 'Total Home Protection',
      tier: 'ultimate',
      monthlyPrice: 79,
      annualPrice: 799,
      description: 'Ultimate peace of mind with comprehensive coverage and premium benefits.',
      features: [
        'Unlimited service visits',
        '25% discount on repairs',
        'Same-day emergency service',
        'Free filter replacements',
        'IoT equipment monitoring',
        '24/7 emergency hotline',
        'All system maintenance',
        'Preventive replacement program',
        'Energy efficiency optimization'
      ],
      includedServices: [
        'Monthly system checks',
        'Air filter replacement (12x/year)',
        'All electrical maintenance',
        'All plumbing maintenance',
        'Appliance maintenance',
        'Smart home integration'
      ],
      discounts: {
        laborDiscount: 25,
        partsDiscount: 20,
        emergencyDiscount: 50
      }
    }
  ]

  // Mock quote options
  const quoteOptions: QuoteOption[] = [
    {
      id: 'quote-001',
      title: 'Water Heater Anode Rod Replacement',
      type: 'repair',
      description: 'Replace the sacrificial anode rod to prevent tank corrosion and extend water heater life.',
      equipment: 'Rheem Marathon Water Heater',
      basePrice: 185,
      laborHours: 1.5,
      warranty: '1 year parts and labor',
      urgency: 'standard',
      timeline: '1-2 weeks',
      benefits: [
        'Prevent tank corrosion',
        'Extend water heater life 3-5 years',
        'Maintain manufacturer warranty',
        'Improve water quality'
      ],
      isRecommended: true
    },
    {
      id: 'quote-002',
      title: 'Complete Water Heater Replacement',
      type: 'replacement',
      description: 'Full replacement with new high-efficiency tankless water heater for unlimited hot water.',
      equipment: 'Rheem Marathon Water Heater',
      basePrice: 2850,
      laborHours: 8,
      warranty: '10 year manufacturer + 5 year labor',
      urgency: 'standard',
      timeline: '3-5 days',
      benefits: [
        'Unlimited hot water',
        '30% energy savings',
        'Space-saving design',
        'Smart home integration',
        '15-year expected lifespan'
      ]
    },
    {
      id: 'quote-003',
      title: 'Smart Thermostat Upgrade',
      type: 'upgrade',
      description: 'Upgrade to latest Nest Learning Thermostat with advanced AI and energy optimization.',
      equipment: 'Current Thermostat',
      basePrice: 295,
      laborHours: 2,
      warranty: '2 year parts and labor',
      urgency: 'standard',
      timeline: 'Same day',
      benefits: [
        '15% additional energy savings',
        'Remote control via smartphone',
        'Learning algorithms',
        'Energy usage reports',
        'Smart home integration'
      ]
    }
  ]

  const getPlanColor = (tier: string) => {
    switch (tier) {
      case 'basic': return 'info'
      case 'premium': return 'primary'
      case 'ultimate': return 'success'
      default: return 'secondary'
    }
  }

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'emergency': return 'danger'
      case 'priority': return 'warning'
      case 'standard': return 'info'
      default: return 'secondary'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'repair': return 'wrench'
      case 'replacement': return 'arrow-right'
      case 'upgrade': return 'rocket'
      default: return 'information'
    }
  }

  const calculateMembership = (basePrice: number, tier: string) => {
    const plan = servicePlans.find(p => p.tier === tier)
    if (!plan) return { discountedPrice: basePrice, savings: 0 }
    
    const laborDiscount = (basePrice * 0.7) * (plan.discounts.laborDiscount / 100)
    const partsDiscount = (basePrice * 0.3) * (plan.discounts.partsDiscount / 100)
    const totalDiscount = laborDiscount + partsDiscount
    
    return {
      discountedPrice: basePrice - totalDiscount,
      savings: totalDiscount
    }
  }

  return (
    <div className="card card-flush">
      <div className="card-header pt-7">
        <h3 className="card-title align-items-start flex-column">
          <span className="card-label fw-bold text-dark">
            <i className="ki-duotone ki-document-text fs-3 text-primary me-2">
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
            Quotes & Service Plans
          </span>
          <span className="text-muted mt-1 fw-semibold fs-7">
            Personalized quotes and membership plans to maximize your home's value
          </span>
        </h3>
        <div className="card-toolbar">
          <ul className="nav nav-tabs nav-line-tabs nav-stretch fs-6 border-0">
            <li className="nav-item">
              <a 
                className={`nav-link ${activeTab === 'quotes' ? 'active' : ''}`}
                href="#"
                onClick={(e) => { e.preventDefault(); setActiveTab('quotes') }}
              >
                <i className="ki-duotone ki-document-text fs-5 me-1">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                Service Quotes
              </a>
            </li>
            <li className="nav-item">
              <a 
                className={`nav-link ${activeTab === 'plans' ? 'active' : ''}`}
                href="#"
                onClick={(e) => { e.preventDefault(); setActiveTab('plans') }}
              >
                <i className="ki-duotone ki-crown fs-5 me-1">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                Membership Plans
              </a>
            </li>
            <li className="nav-item">
              <a 
                className={`nav-link ${activeTab === 'current' ? 'active' : ''}`}
                href="#"
                onClick={(e) => { e.preventDefault(); setActiveTab('current') }}
              >
                <i className="ki-duotone ki-verify fs-5 me-1">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                My Plan
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="card-body">
        {activeTab === 'quotes' && (
          <div>
            {/* Quote Options */}
            <div className="row g-5">
              {quoteOptions.map((quote) => {
                const typeIcon = getTypeIcon(quote.type)
                const urgencyColor = getUrgencyColor(quote.urgency)
                const currentPlanDiscount = calculateMembership(quote.basePrice, 'premium')

                return (
                  <div key={quote.id} className="col-12">
                    <div className={`card ${quote.isRecommended ? 'border-success border-dashed' : 'border-light'}`}>
                      <div className="card-body p-6">
                        <div className="d-flex align-items-start justify-content-between mb-4">
                          <div className="d-flex align-items-center">
                            <div className={`symbol symbol-50px bg-light-${quote.isRecommended ? 'success' : 'primary'} me-4`}>
                              <span className="symbol-label">
                                <i className={`ki-duotone ki-${typeIcon} fs-2x text-${quote.isRecommended ? 'success' : 'primary'}`}>
                                  <span className="path1"></span>
                                  <span className="path2"></span>
                                </i>
                              </span>
                            </div>
                            <div>
                              <h4 className="text-dark fw-bold mb-1">
                                {quote.title}
                                {quote.isRecommended && (
                                  <span className="badge badge-light-success ms-3">RECOMMENDED</span>
                                )}
                              </h4>
                              <div className="d-flex align-items-center gap-3 flex-wrap">
                                <span className="text-muted fs-7">{quote.equipment}</span>
                                <span className={`badge badge-light-${urgencyColor}`}>
                                  {quote.urgency.toUpperCase()}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-end">
                            <div className="text-dark fw-bold fs-3">${quote.basePrice.toLocaleString()}</div>
                            <div className="text-success fw-bold fs-6">
                              ${currentPlanDiscount.discountedPrice.toLocaleString()} with plan
                            </div>
                            <div className="text-muted fs-7">{quote.timeline}</div>
                          </div>
                        </div>

                        <p className="text-muted fs-6 mb-4">{quote.description}</p>

                        <div className="row g-4 mb-5">
                          <div className="col-md-6">
                            <h6 className="fw-bold text-dark mb-3">Project Details:</h6>
                            <div className="d-flex justify-content-between mb-2">
                              <span className="text-muted fs-7">Labor Hours:</span>
                              <span className="fw-semibold fs-7">{quote.laborHours} hours</span>
                            </div>
                            <div className="d-flex justify-content-between mb-2">
                              <span className="text-muted fs-7">Warranty:</span>
                              <span className="fw-semibold fs-7">{quote.warranty}</span>
                            </div>
                            <div className="d-flex justify-content-between mb-2">
                              <span className="text-muted fs-7">Timeline:</span>
                              <span className="fw-semibold fs-7">{quote.timeline}</span>
                            </div>
                          </div>
                          <div className="col-md-6">
                            <h6 className="fw-bold text-dark mb-3">Benefits:</h6>
                            <div className="d-flex flex-column gap-1">
                              {quote.benefits.slice(0, 3).map((benefit, index) => (
                                <div key={index} className="d-flex align-items-center">
                                  <i className="ki-duotone ki-check fs-6 text-success me-2">
                                    <span className="path1"></span>
                                    <span className="path2"></span>
                                  </i>
                                  <span className="text-dark fs-7">{benefit}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Membership Savings Highlight */}
                        <div className="alert alert-light-success border-success mb-4">
                          <div className="d-flex align-items-center">
                            <i className="ki-duotone ki-crown fs-2x text-success me-3">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                            <div>
                              <h6 className="text-dark mb-1">
                                Your Complete Comfort Plan saves ${currentPlanDiscount.savings.toFixed(0)} on this service!
                              </h6>
                              <p className="text-muted mb-0 fs-7">
                                Member price: ${currentPlanDiscount.discountedPrice.toLocaleString()} 
                                (was ${quote.basePrice.toLocaleString()})
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="d-flex gap-3 flex-wrap">
                          <button className="btn btn-primary">
                            <i className="ki-duotone ki-check fs-5 me-2">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                            Accept Quote
                          </button>
                          <button className="btn btn-light-primary">
                            <i className="ki-duotone ki-calendar-add fs-5 me-2">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                            Schedule Consultation
                          </button>
                          <button className="btn btn-light-info">
                            <i className="ki-duotone ki-message-text-2 fs-5 me-2">
                              <span className="path1"></span>
                              <span className="path2"></span>
                              <span className="path3"></span>
                            </i>
                            Ask Questions
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Request New Quote */}
            <div className="card border-dashed border-primary mt-6">
              <div className="card-body text-center p-6">
                <i className="ki-duotone ki-plus-circle fs-3x text-primary mb-3">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                <h5 className="text-dark mb-3">Need a Quote for Something Else?</h5>
                <p className="text-muted mb-4">
                  Get a personalized quote for any home service or equipment upgrade.
                </p>
                <button className="btn btn-primary">
                  <i className="ki-duotone ki-document-add fs-5 me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Request Custom Quote
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'plans' && (
          <div>
            {/* Plans Comparison */}
            <div className="row g-5">
              {servicePlans.map((plan) => {
                const planColor = getPlanColor(plan.tier)
                const annualSavings = (plan.monthlyPrice * 12) - plan.annualPrice

                return (
                  <div key={plan.id} className="col-lg-4">
                    <div className={`card ${plan.isPopular ? 'border-primary' : 'border-light'} h-100`}>
                      {plan.isPopular && (
                        <div className="card-ribbon ribbon ribbon-top ribbon-vertical">
                          <div className="ribbon-label bg-primary">
                            <i className="ki-duotone ki-star fs-3x text-white">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                          </div>
                        </div>
                      )}
                      
                      <div className="card-header">
                        <div className="card-title">
                          <h3 className="fw-bold text-dark">{plan.name}</h3>
                        </div>
                      </div>

                      <div className="card-body">
                        <div className="text-center mb-5">
                          <span className="fs-2x fw-bold text-dark">${plan.monthlyPrice}</span>
                          <span className="text-muted">/month</span>
                          <div className="text-muted fs-7">
                            or ${plan.annualPrice}/year (save ${annualSavings})
                          </div>
                        </div>

                        <p className="text-muted fs-6 mb-4">{plan.description}</p>

                        <div className="mb-5">
                          <h6 className="fw-bold text-dark mb-3">Key Features:</h6>
                          {plan.features.map((feature, index) => (
                            <div key={index} className="d-flex align-items-center mb-2">
                              <i className="ki-duotone ki-check fs-6 text-success me-2">
                                <span className="path1"></span>
                                <span className="path2"></span>
                              </i>
                              <span className="text-dark fs-7">{feature}</span>
                            </div>
                          ))}
                        </div>

                        <div className="mb-5">
                          <h6 className="fw-bold text-dark mb-3">Discounts:</h6>
                          <div className="row g-2">
                            <div className="col-4 text-center">
                              <div className="bg-light-success p-2 rounded">
                                <div className="fw-bold text-success">{plan.discounts.laborDiscount}%</div>
                                <div className="text-muted fs-8">Labor</div>
                              </div>
                            </div>
                            <div className="col-4 text-center">
                              <div className="bg-light-primary p-2 rounded">
                                <div className="fw-bold text-primary">{plan.discounts.partsDiscount}%</div>
                                <div className="text-muted fs-8">Parts</div>
                              </div>
                            </div>
                            <div className="col-4 text-center">
                              <div className="bg-light-warning p-2 rounded">
                                <div className="fw-bold text-warning">{plan.discounts.emergencyDiscount}%</div>
                                <div className="text-muted fs-8">Emergency</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="text-center">
                          {plan.isCurrentPlan ? (
                            <button className="btn btn-light-success w-100" disabled>
                              <i className="ki-duotone ki-verify fs-5 me-2">
                                <span className="path1"></span>
                                <span className="path2"></span>
                              </i>
                              Current Plan
                            </button>
                          ) : (
                            <button className={`btn btn-${planColor} w-100`}>
                              <i className="ki-duotone ki-arrow-up fs-5 me-2">
                                <span className="path1"></span>
                                <span className="path2"></span>
                              </i>
                              {plan.tier === 'basic' ? 'Downgrade' : 'Upgrade'} to {plan.name}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {activeTab === 'current' && (
          <div>
            {/* Current Plan Overview */}
            <div className="card border-primary">
              <div className="card-body p-6">
                <div className="d-flex align-items-center justify-content-between mb-4">
                  <div>
                    <h3 className="text-dark fw-bold mb-1">Complete Comfort Plan</h3>
                    <p className="text-muted mb-0">Active since March 2024</p>
                  </div>
                  <div className="text-end">
                    <div className="text-dark fw-bold fs-3">$49/month</div>
                    <div className="text-muted fs-7">Next billing: Jan 15, 2025</div>
                  </div>
                </div>

                <div className="row g-5 mb-6">
                  <div className="col-md-4">
                    <div className="text-center p-4 bg-light-success rounded">
                      <i className="ki-duotone ki-calendar-check fs-2x text-success mb-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <div className="fw-bold text-dark fs-3">2</div>
                      <div className="text-muted fs-7">Services Used</div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="text-center p-4 bg-light-primary rounded">
                      <i className="ki-duotone ki-dollar fs-2x text-primary mb-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                        <span className="path3"></span>
                      </i>
                      <div className="fw-bold text-dark fs-3">$347</div>
                      <div className="text-muted fs-7">Total Savings</div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="text-center p-4 bg-light-info rounded">
                      <i className="ki-duotone ki-chart-line-up fs-2x text-info mb-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <div className="fw-bold text-dark fs-3">23%</div>
                      <div className="text-muted fs-7">Avg Discount</div>
                    </div>
                  </div>
                </div>

                <div className="row g-5">
                  <div className="col-md-6">
                    <h6 className="fw-bold text-dark mb-3">Plan Benefits:</h6>
                    <div className="d-flex flex-column gap-2">
                      {servicePlans.find(p => p.isCurrentPlan)?.features.map((feature, index) => (
                        <div key={index} className="d-flex align-items-center">
                          <i className="ki-duotone ki-verify fs-6 text-success me-2">
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                          <span className="text-dark fs-7">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="col-md-6">
                    <h6 className="fw-bold text-dark mb-3">Quick Actions:</h6>
                    <div className="d-flex flex-column gap-2">
                      <button className="btn btn-light-primary btn-sm">
                        <i className="ki-duotone ki-calendar-add fs-5 me-2">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        Schedule Next Service
                      </button>
                      <button className="btn btn-light-info btn-sm">
                        <i className="ki-duotone ki-document fs-5 me-2">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        View Service History
                      </button>
                      <button className="btn btn-light-warning btn-sm">
                        <i className="ki-duotone ki-setting-2 fs-5 me-2">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        Manage Plan Settings
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Upcoming Services */}
            <div className="card mt-6">
              <div className="card-header">
                <h5 className="card-title">Upcoming Scheduled Services</h5>
              </div>
              <div className="card-body">
                <div className="d-flex align-items-center p-4 bg-light-primary rounded">
                  <i className="ki-duotone ki-calendar-2 fs-2x text-primary me-4">
                    <span className="path1"></span>
                    <span className="path2"></span>
                    <span className="path3"></span>
                    <span className="path4"></span>
                    <span className="path5"></span>
                  </i>
                  <div>
                    <h6 className="text-dark fw-bold mb-1">Fall HVAC Tune-Up</h6>
                    <p className="text-muted mb-1">Scheduled for September 15, 2024</p>
                    <p className="text-muted fs-7 mb-0">Included in your Complete Comfort Plan</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default QuotesAndPlans