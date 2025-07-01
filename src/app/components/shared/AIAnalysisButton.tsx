import React, { useState } from 'react'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'
import { KTIcon } from '../../../_metronic/helpers'

interface AIAnalysisButtonProps {
  jobId: string
  photos?: Array<{ file_url: string; photo_type: string }>
  documentUrl?: string
  onAnalysisComplete?: (analysis: any) => void
}

export const AIAnalysisButton: React.FC<AIAnalysisButtonProps> = ({
  jobId,
  photos = [],
  documentUrl,
  onAnalysisComplete
}) => {
  const [analyzing, setAnalyzing] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [analysis, setAnalysis] = useState<any>(null)

  const handleAnalyze = async () => {
    if (!jobId) {
      showToast.error('Job ID is required for analysis')
      return
    }

    if (!photos.length && !documentUrl) {
      showToast.error('Please upload photos or documents to analyze')
      return
    }

    setAnalyzing(true)
    const loadingToast = showToast.loading('AI is analyzing your photos and documents...')

    try {
      const photoUrls = photos.map(p => p.file_url)
      
      const { data, error } = await supabase.functions.invoke('analyze-job-documents', {
        body: {
          jobId,
          photoUrls: photoUrls.length > 0 ? photoUrls : undefined,
          documentUrl,
          analysisType: 'full'
        }
      })

      showToast.dismiss(loadingToast)

      if (error) throw error

      setAnalysis(data.analysis)
      setShowResults(true)
      showToast.success('AI analysis completed!')

      if (onAnalysisComplete) {
        onAnalysisComplete(data.analysis)
      }

    } catch (error) {
      console.error('Error running AI analysis:', error)
      showToast.dismiss(loadingToast)
      showToast.error('AI analysis failed. Please try again.')
    } finally {
      setAnalyzing(false)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'danger'
      case 'high': return 'warning'
      case 'medium': return 'primary'
      case 'low': return 'success'
      default: return 'secondary'
    }
  }

  return (
    <>
      <button
        className="btn btn-light-primary"
        onClick={handleAnalyze}
        disabled={analyzing || (!photos.length && !documentUrl)}
      >
        {analyzing ? (
          <>
            <span className="spinner-border spinner-border-sm me-2" />
            Analyzing...
          </>
        ) : (
          <>
            <KTIcon iconName="abstract-39" className="fs-6 me-2" />
            AI Analysis
          </>
        )}
      </button>

      {/* Results Modal */}
      {showResults && analysis && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h3 className="modal-title">
                  <KTIcon iconName="abstract-39" className="fs-2 text-primary me-3" />
                  AI Analysis Results
                </h3>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowResults(false)}
                ></button>
              </div>

              <div className="modal-body">
                {/* Combined Diagnosis */}
                {analysis.combinedDiagnosis && (
                  <div className="mb-6">
                    <h5 className="mb-4">
                      <KTIcon iconName="health" className="fs-4 text-success me-2" />
                      Diagnosis
                    </h5>
                    
                    {analysis.combinedDiagnosis.severity && (
                      <div className="mb-3">
                        <span className={`badge badge-${getSeverityColor(analysis.combinedDiagnosis.severity)} fs-6`}>
                          {analysis.combinedDiagnosis.severity} Priority
                        </span>
                      </div>
                    )}

                    {analysis.combinedDiagnosis.rootCause && (
                      <div className="alert alert-info">
                        <h6>Root Cause:</h6>
                        <p className="mb-0">{analysis.combinedDiagnosis.rootCause}</p>
                      </div>
                    )}

                    {analysis.combinedDiagnosis.recommendedApproach && (
                      <div className="alert alert-primary">
                        <h6>Recommended Approach:</h6>
                        <p className="mb-0">{analysis.combinedDiagnosis.recommendedApproach}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Photo Analysis */}
                {analysis.photoAnalysis && analysis.photoAnalysis.length > 0 && (
                  <div className="mb-6">
                    <h5 className="mb-4">
                      <KTIcon iconName="picture" className="fs-4 text-primary me-2" />
                      Photo Analysis
                    </h5>
                    {analysis.photoAnalysis.map((photoResult: any, index: number) => (
                      <div key={index} className="card mb-3">
                        <div className="card-body">
                          <h6>Photo {index + 1}</h6>
                          {photoResult.equipmentIdentification && (
                            <p><strong>Equipment:</strong> {photoResult.equipmentIdentification}</p>
                          )}
                          {photoResult.visibleIssues && (
                            <p><strong>Issues Found:</strong> {photoResult.visibleIssues}</p>
                          )}
                          {photoResult.conditionRating && (
                            <p><strong>Condition Rating:</strong> {photoResult.conditionRating}/10</p>
                          )}
                          {photoResult.recommendations && (
                            <p><strong>Recommendations:</strong> {photoResult.recommendations}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Document Analysis */}
                {analysis.documentAnalysis && (
                  <div className="mb-6">
                    <h5 className="mb-4">
                      <KTIcon iconName="document" className="fs-4 text-info me-2" />
                      Document Analysis
                    </h5>
                    <div className="card">
                      <div className="card-body">
                        {analysis.documentAnalysis.documentType && (
                          <p><strong>Document Type:</strong> {analysis.documentAnalysis.documentType}</p>
                        )}
                        {analysis.documentAnalysis.keyDates && (
                          <p><strong>Key Dates:</strong> {analysis.documentAnalysis.keyDates}</p>
                        )}
                        {analysis.documentAnalysis.equipmentInfo && (
                          <p><strong>Equipment:</strong> {analysis.documentAnalysis.equipmentInfo}</p>
                        )}
                        {analysis.documentAnalysis.reportedIssues && (
                          <p><strong>Reported Issues:</strong> {analysis.documentAnalysis.reportedIssues}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Cost Estimates */}
                {analysis.estimatedCosts && (
                  <div className="mb-6">
                    <h5 className="mb-4">
                      <KTIcon iconName="dollar" className="fs-4 text-success me-2" />
                      Cost Estimates
                    </h5>
                    <div className="card">
                      <div className="card-body">
                        {analysis.estimatedCosts.laborHours && (
                          <p><strong>Estimated Labor:</strong> {analysis.estimatedCosts.laborHours} hours</p>
                        )}
                        {analysis.estimatedCosts.totalRange && (
                          <p><strong>Total Cost Range:</strong> {analysis.estimatedCosts.totalRange}</p>
                        )}
                        {analysis.estimatedCosts.parts && (
                          <div>
                            <p><strong>Required Parts:</strong></p>
                            <ul>
                              {analysis.estimatedCosts.parts.map((part: string, index: number) => (
                                <li key={index}>{part}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Suggested Actions */}
                {analysis.suggestedActions && analysis.suggestedActions.length > 0 && (
                  <div className="mb-6">
                    <h5 className="mb-4">
                      <KTIcon iconName="cheque" className="fs-4 text-warning me-2" />
                      Recommended Actions
                    </h5>
                    <div className="list-group">
                      {analysis.suggestedActions.map((action: any, index: number) => (
                        <div key={index} className={`list-group-item d-flex justify-content-between align-items-center`}>
                          <div>
                            <h6 className="mb-1">{action.title || `Action ${index + 1}`}</h6>
                            <p className="mb-1">{action.description || action}</p>
                            {action.timeframe && (
                              <small className="text-muted">Timeframe: {action.timeframe}</small>
                            )}
                          </div>
                          {action.priority && (
                            <span className={`badge badge-${getSeverityColor(action.priority)}`}>
                              {action.priority}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => setShowResults(false)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    // Here you could implement actions like:
                    // - Create work orders from recommendations
                    // - Generate estimates
                    // - Schedule follow-up
                    showToast.info('Actions will be implemented soon!')
                  }}
                >
                  <KTIcon iconName="plus" className="fs-6 me-1" />
                  Create Action Items
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default AIAnalysisButton