import React, { useState } from 'react'

interface VisionResult {
  id: string
  timestamp: string
  objects: {
    type: string
    confidence: number
    bbox?: { x: number; y: number; width: number; height: number }
    attributes?: Record<string, any>
  }[]
  trade_insights?: {
    category: string
    finding: string
    severity: 'info' | 'warning' | 'critical'
  }[]
}

interface VisionResultsPanelProps {
  results: VisionResult[]
  capturedFrames: string[]
}

export const VisionResultsPanel: React.FC<VisionResultsPanelProps> = ({
  results,
  capturedFrames
}) => {
  const [selectedFrame, setSelectedFrame] = useState<string | null>(null)
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set())

  const toggleResultExpanded = (resultId: string) => {
    const newExpanded = new Set(expandedResults)
    if (newExpanded.has(resultId)) {
      newExpanded.delete(resultId)
    } else {
      newExpanded.add(resultId)
    }
    setExpandedResults(newExpanded)
  }

  const getObjectIcon = (type: string) => {
    const iconMap: Record<string, string> = {
      // Roofing
      'shingle': 'ki-home-2',
      'vent': 'ki-wind',
      'flashing': 'ki-shield-tick',
      'damage': 'ki-warning',
      
      // Plumbing
      'pipe': 'ki-filter',
      'valve': 'ki-toggle-on',
      'leak': 'ki-water',
      'water_heater': 'ki-flame',
      
      // HVAC
      'filter': 'ki-category',
      'condenser': 'ki-snow',
      'thermostat': 'ki-temperature',
      'ductwork': 'ki-route',
      
      // Electrical
      'panel': 'ki-electricity',
      'outlet': 'ki-socket',
      'breaker': 'ki-switch',
      'wire': 'ki-cable'
    }
    
    return iconMap[type.toLowerCase()] || 'ki-element-11'
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'danger'
      case 'warning': return 'warning'
      case 'info': return 'info'
      default: return 'secondary'
    }
  }

  return (
    <div className='flex-grow-1 overflow-auto p-4'>
      <h5 className='mb-4'>AI Vision Analysis</h5>

      {/* Captured Frames Gallery */}
      {capturedFrames.length > 0 && (
        <div className='mb-5'>
          <h6 className='text-muted mb-3'>Captured Frames ({capturedFrames.length})</h6>
          <div className='d-flex gap-2 overflow-auto pb-2'>
            {capturedFrames.map((frame, index) => (
              <div
                key={frame}
                className='position-relative cursor-pointer'
                onClick={() => setSelectedFrame(frame)}
                style={{ minWidth: '80px' }}
              >
                <img
                  src={`/api/storage/vision-captures/${frame}`}
                  alt={`Frame ${index + 1}`}
                  className='rounded border'
                  style={{ width: '80px', height: '60px', objectFit: 'cover' }}
                />
                <span className='position-absolute top-0 start-0 badge badge-dark badge-sm m-1'>
                  {index + 1}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vision Results */}
      <div className='mb-4'>
        <h6 className='text-muted mb-3'>Detection Results</h6>
        
        {results.length === 0 ? (
          <div className='text-center py-5 text-muted'>
            <i className='ki-duotone ki-scan-barcode fs-3x mb-3'>
              <span className='path1'></span>
              <span className='path2'></span>
              <span className='path3'></span>
              <span className='path4'></span>
            </i>
            <div>Waiting for AI analysis...</div>
          </div>
        ) : (
          <div className='accordion' id='visionResultsAccordion'>
            {results.slice(-10).reverse().map((result, index) => (
              <div key={result.id} className='accordion-item mb-2'>
                <h2 className='accordion-header'>
                  <button
                    className={`accordion-button ${!expandedResults.has(result.id) ? 'collapsed' : ''}`}
                    type='button'
                    onClick={() => toggleResultExpanded(result.id)}
                  >
                    <div className='d-flex align-items-center w-100'>
                      <span className='badge badge-light-primary me-2'>
                        Frame {results.length - index}
                      </span>
                      <span className='text-muted small me-auto'>
                        {new Date(result.timestamp).toLocaleTimeString()}
                      </span>
                      <span className='badge badge-secondary'>
                        {result.objects.length} objects
                      </span>
                    </div>
                  </button>
                </h2>
                <div
                  className={`accordion-collapse collapse ${expandedResults.has(result.id) ? 'show' : ''}`}
                >
                  <div className='accordion-body'>
                    {/* Detected Objects */}
                    <div className='mb-3'>
                      <h6 className='text-muted mb-2'>Detected Objects</h6>
                      {result.objects.map((obj, objIndex) => (
                        <div key={objIndex} className='d-flex align-items-center mb-2'>
                          <i className={`ki-duotone ${getObjectIcon(obj.type)} fs-2 me-2`}>
                            <span className='path1'></span>
                            <span className='path2'></span>
                          </i>
                          <div className='flex-grow-1'>
                            <div className='fw-bold'>{obj.type}</div>
                            {obj.attributes && (
                              <div className='text-muted small'>
                                {Object.entries(obj.attributes).map(([key, value]) => (
                                  <span key={key} className='me-2'>
                                    {key}: {value}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className='text-end'>
                            <div className='progress' style={{ width: '60px', height: '4px' }}>
                              <div
                                className='progress-bar bg-success'
                                style={{ width: `${obj.confidence * 100}%` }}
                              />
                            </div>
                            <div className='text-muted small'>
                              {Math.round(obj.confidence * 100)}%
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Trade Insights */}
                    {result.trade_insights && result.trade_insights.length > 0 && (
                      <div>
                        <h6 className='text-muted mb-2'>Trade Insights</h6>
                        {result.trade_insights.map((insight, insightIndex) => (
                          <div
                            key={insightIndex}
                            className={`alert alert-${getSeverityColor(insight.severity)} py-2 mb-2`}
                          >
                            <div className='d-flex align-items-center'>
                              <i className={`ki-duotone ki-${insight.severity === 'critical' ? 'cross-circle' : insight.severity === 'warning' ? 'warning' : 'information'} fs-2 me-2`}>
                                <span className='path1'></span>
                                <span className='path2'></span>
                                <span className='path3'></span>
                              </i>
                              <div>
                                <div className='fw-bold'>{insight.category}</div>
                                <div className='small'>{insight.finding}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Frame Preview Modal */}
      {selectedFrame && (
        <div
          className='modal fade show d-block'
          tabIndex={-1}
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setSelectedFrame(null)}
        >
          <div className='modal-dialog modal-dialog-centered modal-lg'>
            <div className='modal-content'>
              <div className='modal-header'>
                <h5 className='modal-title'>Captured Frame</h5>
                <button
                  type='button'
                  className='btn-close'
                  onClick={() => setSelectedFrame(null)}
                />
              </div>
              <div className='modal-body p-0'>
                <img
                  src={`/api/storage/vision-captures/${selectedFrame}`}
                  alt='Captured frame'
                  className='w-100'
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}