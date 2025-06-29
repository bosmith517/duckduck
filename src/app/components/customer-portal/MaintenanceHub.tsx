import React, { useState } from 'react'

interface MaintenanceRecommendation {
  id: string
  title: string
  priority: 'high' | 'medium' | 'low'
  category: 'preventive' | 'repair' | 'upgrade' | 'seasonal'
  equipment: string
  description: string
  estimatedCost: number
  timeframe: string
  benefits: string[]
  isAiGenerated: boolean
  confidence: number // 0-100 for AI recommendations
}

interface SeasonalTip {
  id: string
  season: 'spring' | 'summer' | 'fall' | 'winter'
  title: string
  description: string
  actionItems: string[]
  equipment?: string
}

interface MaintenanceHubProps {
  customerId: string
  customerLocation: {
    city: string
    state: string
  }
}

export const MaintenanceHub: React.FC<MaintenanceHubProps> = ({
  customerId,
  customerLocation
}) => {
  const [activeTab, setActiveTab] = useState<'recommendations' | 'seasonal' | 'calendar'>('recommendations')

  // Mock AI-generated recommendations based on Austin, TX climate and equipment age
  const recommendations: MaintenanceRecommendation[] = [
    {
      id: 'rec-001',
      title: 'HVAC Filter Replacement Due',
      priority: 'high',
      category: 'preventive',
      equipment: 'Main HVAC System',
      description: 'Your HVAC filter should be replaced every 3 months. Based on your usage patterns and Austin\'s high pollen levels, replacement is recommended now.',
      estimatedCost: 45,
      timeframe: 'Next 2 weeks',
      benefits: [
        'Improved air quality',
        '15% better energy efficiency',
        'Extended equipment life',
        'Reduced allergy symptoms'
      ],
      isAiGenerated: true,
      confidence: 95
    },
    {
      id: 'rec-002',
      title: 'Water Heater Anode Rod Inspection',
      priority: 'medium',
      category: 'preventive',
      equipment: 'Water Heater',
      description: 'Anode rod inspection recommended for 4-year-old water heater. This preventive check can extend your water heater\'s life significantly.',
      estimatedCost: 185,
      timeframe: 'Next 3 months',
      benefits: [
        'Prevent tank corrosion',
        'Extend water heater life by 3-5 years',
        'Maintain warranty coverage',
        'Avoid costly emergency repairs'
      ],
      isAiGenerated: true,
      confidence: 87
    },
    {
      id: 'rec-003',
      title: 'Smart Thermostat Optimization',
      priority: 'low',
      category: 'upgrade',
      equipment: 'Thermostat',
      description: 'Your current thermostat usage patterns suggest you could save an additional 12% on energy costs with AI scheduling optimization.',
      estimatedCost: 95,
      timeframe: 'Anytime',
      benefits: [
        '12% additional energy savings',
        'Improved comfort automation',
        'Remote control capabilities',
        'Energy usage insights'
      ],
      isAiGenerated: true,
      confidence: 78
    },
    {
      id: 'rec-004',
      title: 'Electrical Panel Safety Check',
      priority: 'medium',
      category: 'preventive',
      equipment: 'Electrical Panel',
      description: 'Your 6-year-old electrical panel is due for a safety inspection. Austin building codes recommend biennial inspections.',
      estimatedCost: 150,
      timeframe: 'Next 6 months',
      benefits: [
        'Ensure electrical safety',
        'Code compliance verification',
        'Prevent electrical fires',
        'Insurance requirement satisfaction'
      ],
      isAiGenerated: true,
      confidence: 82
    }
  ]

  // Austin, TX specific seasonal tips
  const seasonalTips: SeasonalTip[] = [
    {
      id: 'tip-summer',
      season: 'summer',
      title: 'Beat the Texas Heat - Summer Prep',
      description: 'Austin summers are intense! Prepare your home for 100°F+ temperatures and peak energy demand.',
      actionItems: [
        'Set thermostat to 78°F when home, 85°F when away',
        'Close blinds during peak sun hours (10am-6pm)',
        'Check AC refrigerant levels before peak season',
        'Trim vegetation around outdoor AC unit for airflow',
        'Consider installing smart thermostat with geofencing',
        'Schedule pre-summer AC tune-up in May'
      ],
      equipment: 'HVAC System'
    },
    {
      id: 'tip-spring',
      season: 'spring',
      title: 'Spring Preparation & Allergy Season',
      description: 'Austin\'s allergy season is notorious (ranked #1 worst in US). Prepare your home\'s air quality systems.',
      actionItems: [
        'Replace HVAC filters with MERV 11+ rating',
        'Schedule professional duct cleaning',
        'Check and clean outdoor AC unit coils',
        'Test system before hot weather arrives',
        'Consider upgrading to HEPA filtration',
        'Inspect attic insulation for energy efficiency'
      ],
      equipment: 'HVAC System'
    },
    {
      id: 'tip-winter',
      season: 'winter',
      title: 'Austin Winter Home Prep',
      description: 'While Austin winters are mild, prepare for occasional freezes and energy efficiency.',
      actionItems: [
        'Insulate outdoor faucets and pipes',
        'Check heating system operation',
        'Seal air leaks around windows and doors',
        'Clean gutters before winter rain season',
        'Test emergency heating backup systems',
        'Service fireplace and chimney if applicable'
      ],
      equipment: 'HVAC System'
    }
  ]

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'danger'
      case 'medium': return 'warning'
      case 'low': return 'info'
      default: return 'secondary'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'preventive': return 'shield-tick'
      case 'repair': return 'wrench'
      case 'upgrade': return 'rocket'
      case 'seasonal': return 'calendar'
      default: return 'information'
    }
  }

  const getCurrentSeason = () => {
    const month = new Date().getMonth()
    if (month >= 2 && month <= 4) return 'spring'
    if (month >= 5 && month <= 7) return 'summer'
    if (month >= 8 && month <= 10) return 'fall'
    return 'winter'
  }

  const filteredRecommendations = recommendations

  const currentSeason = getCurrentSeason()
  const currentSeasonTip = seasonalTips.find(tip => tip.season === currentSeason)

  return (
    <div className="card card-flush">
      <div className="card-header pt-7">
        <h3 className="card-title align-items-start flex-column">
          <span className="card-label fw-bold text-dark">
            <i className="ki-duotone ki-rocket fs-3 text-success me-2">
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
            Personalized Maintenance Hub
          </span>
          <span className="text-muted mt-1 fw-semibold fs-7">
            AI-powered recommendations tailored to your home in {customerLocation.city}, {customerLocation.state}
          </span>
        </h3>
        <div className="card-toolbar">
          <ul className="nav nav-tabs nav-line-tabs nav-stretch fs-6 border-0">
            <li className="nav-item">
              <a 
                className={`nav-link ${activeTab === 'recommendations' ? 'active' : ''}`}
                href="#"
                onClick={(e) => { e.preventDefault(); setActiveTab('recommendations') }}
              >
                <i className="ki-duotone ki-abstract-26 fs-5 me-1">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                Smart Recommendations
              </a>
            </li>
            <li className="nav-item">
              <a 
                className={`nav-link ${activeTab === 'seasonal' ? 'active' : ''}`}
                href="#"
                onClick={(e) => { e.preventDefault(); setActiveTab('seasonal') }}
              >
                <i className="ki-duotone ki-weather-cloudy fs-5 me-1">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                Seasonal Tips
              </a>
            </li>
            <li className="nav-item">
              <a 
                className={`nav-link ${activeTab === 'calendar' ? 'active' : ''}`}
                href="#"
                onClick={(e) => { e.preventDefault(); setActiveTab('calendar') }}
              >
                <i className="ki-duotone ki-calendar fs-5 me-1">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                Maintenance Calendar
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="card-body">
        {activeTab === 'recommendations' && (
          <div>
            {/* AI Insight Banner */}
            <div className="alert alert-light-primary border-primary mb-6">
              <div className="d-flex align-items-center">
                <i className="ki-duotone ki-abstract-26 fs-2x text-primary me-4">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                <div>
                  <h5 className="text-dark mb-1">🤖 AI-Powered Insights</h5>
                  <p className="text-muted mb-0">
                    These recommendations are generated based on your equipment age, usage patterns, 
                    local climate data for Austin, TX, and industry best practices.
                  </p>
                </div>
              </div>
            </div>

            {/* Priority Summary */}
            <div className="row g-4 mb-6">
              <div className="col-md-4">
                <div className="text-center p-4 bg-light-danger rounded">
                  <i className="ki-duotone ki-warning-2 fs-2x text-danger mb-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  <div className="fw-bold text-dark fs-3">
                    {filteredRecommendations.filter(r => r.priority === 'high').length}
                  </div>
                  <div className="text-muted fs-7">High Priority</div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="text-center p-4 bg-light-warning rounded">
                  <i className="ki-duotone ki-information fs-2x text-warning mb-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                    <span className="path3"></span>
                  </i>
                  <div className="fw-bold text-dark fs-3">
                    {filteredRecommendations.filter(r => r.priority === 'medium').length}
                  </div>
                  <div className="text-muted fs-7">Medium Priority</div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="text-center p-4 bg-light-info rounded">
                  <i className="ki-duotone ki-rocket fs-2x text-info mb-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  <div className="fw-bold text-dark fs-3">
                    ${filteredRecommendations.reduce((sum, r) => sum + r.estimatedCost, 0)}
                  </div>
                  <div className="text-muted fs-7">Potential Savings</div>
                </div>
              </div>
            </div>

            {/* Recommendations List */}
            <div className="row g-5">
              {filteredRecommendations.map((rec) => {
                const priorityColor = getPriorityColor(rec.priority)
                const categoryIcon = getCategoryIcon(rec.category)

                return (
                  <div key={rec.id} className="col-12">
                    <div className={`card border-${priorityColor} border-dashed`}>
                      <div className="card-body p-6">
                        <div className="d-flex align-items-start justify-content-between mb-4">
                          <div className="d-flex align-items-center">
                            <div className={`symbol symbol-50px bg-light-${priorityColor} me-4`}>
                              <span className="symbol-label">
                                <i className={`ki-duotone ki-${categoryIcon} fs-2x text-${priorityColor}`}>
                                  <span className="path1"></span>
                                  <span className="path2"></span>
                                </i>
                              </span>
                            </div>
                            <div>
                              <h4 className="text-dark fw-bold mb-1">{rec.title}</h4>
                              <div className="d-flex align-items-center gap-3 flex-wrap">
                                <span className={`badge badge-light-${priorityColor}`}>
                                  {rec.priority.toUpperCase()} PRIORITY
                                </span>
                                <span className="text-muted fs-7">{rec.equipment}</span>
                                {rec.isAiGenerated && (
                                  <span className="badge badge-light-info">
                                    <i className="ki-duotone ki-abstract-26 fs-8 me-1">
                                      <span className="path1"></span>
                                      <span className="path2"></span>
                                    </i>
                                    AI {rec.confidence}%
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-end">
                            <div className="text-dark fw-bold fs-3">${rec.estimatedCost}</div>
                            <div className="text-muted fs-7">{rec.timeframe}</div>
                          </div>
                        </div>

                        <p className="text-muted fs-6 mb-4">{rec.description}</p>

                        <div className="row g-4 mb-5">
                          <div className="col-md-8">
                            <h6 className="fw-bold text-dark mb-3">Benefits:</h6>
                            <div className="d-flex flex-wrap gap-2">
                              {rec.benefits.map((benefit, index) => (
                                <span key={index} className="badge badge-light-success fs-7 py-2 px-3">
                                  <i className="ki-duotone ki-check fs-8 me-1">
                                    <span className="path1"></span>
                                    <span className="path2"></span>
                                  </i>
                                  {benefit}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="d-flex gap-3 flex-wrap">
                          <button className="btn btn-primary">
                            <i className="ki-duotone ki-calendar-add fs-5 me-2">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                            Schedule Service
                          </button>
                          <button className="btn btn-light-primary">
                            <i className="ki-duotone ki-information-5 fs-5 me-2">
                              <span className="path1"></span>
                              <span className="path2"></span>
                              <span className="path3"></span>
                            </i>
                            Learn More
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {filteredRecommendations.length === 0 && (
              <div className="text-center py-10">
                <i className="ki-duotone ki-verify fs-4x text-success mb-4">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                <h4 className="text-dark mb-3">All Caught Up!</h4>
                <p className="text-muted fs-5 mb-5">
                  No current maintenance recommendations. Your systems are running smoothly!
                </p>
                <button className="btn btn-light-primary">
                  <i className="ki-duotone ki-refresh fs-5 me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Check for New Recommendations
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'seasonal' && (
          <div>
            {/* Current Season Header */}
            <div className="alert alert-light-warning border-warning mb-6">
              <div className="d-flex align-items-center">
                <i className="ki-duotone ki-weather-cloudy fs-2x text-warning me-4">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                <div>
                  <h5 className="text-dark mb-1">
                    {currentSeason === 'summer' && '🌞 Summer'}
                    {currentSeason === 'spring' && '🌸 Spring'}
                    {currentSeason === 'fall' && '🍂 Fall'}
                    {currentSeason === 'winter' && '❄️ Winter'}
                    {' '}in Austin, TX
                  </h5>
                  <p className="text-muted mb-0">
                    Specialized maintenance tips for your local climate and current season.
                  </p>
                </div>
              </div>
            </div>

            {/* Current Season Tip */}
            {currentSeasonTip && (
              <div className="card card-bordered mb-6">
                <div className="card-body p-6">
                  <h4 className="text-dark fw-bold mb-3">{currentSeasonTip.title}</h4>
                  <p className="text-muted fs-6 mb-4">{currentSeasonTip.description}</p>
                  
                  <h6 className="fw-bold text-dark mb-3">Recommended Actions:</h6>
                  <div className="mb-5">
                    {currentSeasonTip.actionItems.map((item, index) => (
                      <div key={index} className="d-flex align-items-start mb-3">
                        <i className="ki-duotone ki-check-circle fs-5 text-success me-3 mt-1">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        <span className="text-dark fs-6">{item}</span>
                      </div>
                    ))}
                  </div>

                  {currentSeasonTip.equipment && (
                    <div className="d-flex align-items-center text-muted mb-4">
                      <i className="ki-duotone ki-wrench fs-6 me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-7">Applies to: {currentSeasonTip.equipment}</span>
                    </div>
                  )}

                  <button className="btn btn-primary">
                    <i className="ki-duotone ki-calendar-add fs-5 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    Schedule Seasonal Service
                  </button>
                </div>
              </div>
            )}

            {/* All Seasons Overview */}
            <h5 className="text-dark fw-bold mb-4">Year-Round Austin Climate Guide</h5>
            <div className="row g-4">
              {seasonalTips.map((tip) => (
                <div key={tip.id} className="col-md-6">
                  <div className={`card ${tip.season === currentSeason ? 'border-warning' : 'border-light'}`}>
                    <div className="card-body p-4">
                      <h6 className="text-dark fw-bold mb-2 text-capitalize">
                        {tip.season === 'summer' && '🌞'} 
                        {tip.season === 'spring' && '🌸'} 
                        {tip.season === 'fall' && '🍂'} 
                        {tip.season === 'winter' && '❄️'} 
                        {' '}{tip.season}
                      </h6>
                      <p className="text-muted fs-7 mb-3">{tip.description}</p>
                      <div className="text-muted fs-8">
                        {tip.actionItems.length} recommended actions
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="text-center py-10">
            <i className="ki-duotone ki-calendar-search fs-4x text-muted mb-4">
              <span className="path1"></span>
              <span className="path2"></span>
              <span className="path3"></span>
              <span className="path4"></span>
            </i>
            <h4 className="text-dark mb-3">Smart Maintenance Calendar</h4>
            <p className="text-muted fs-5 mb-5">
              Interactive maintenance calendar with automated scheduling and reminders coming soon.
              This will sync with your equipment schedules and local weather patterns.
            </p>
            <div className="d-flex justify-content-center gap-3">
              <button className="btn btn-primary">
                <i className="ki-duotone ki-notification-on fs-5 me-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                  <span className="path3"></span>
                </i>
                Enable Smart Notifications
              </button>
              <button className="btn btn-light-primary">
                <i className="ki-duotone ki-calendar-add fs-5 me-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                Request Calendar Access
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MaintenanceHub