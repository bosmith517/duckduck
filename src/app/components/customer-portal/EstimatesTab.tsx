import React, { useState, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'
import { KTIcon } from '../../../_metronic/helpers'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'

interface EstimatesTabProps {
  jobId: string
  tenantId: string
  portalTokenId?: string
  customerId?: string
}

interface EstimateData {
  id: string
  estimate_number: string
  project_title?: string
  description?: string
  status: string
  total_amount: number
  created_at: string
  valid_until: string
  line_items?: any[]
  estimate_line_items?: any[]
  terms_conditions?: string
  payment_terms?: string
  signed_date?: string
  signed_by?: string
  signature_data?: string
  signed_at?: string
  signed_by_name?: string
}

const EstimatesTab: React.FC<EstimatesTabProps> = ({ jobId, tenantId, portalTokenId, customerId }) => {
  const [estimate, setEstimate] = useState<EstimateData | null>(null)
  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState(false)
  const [showSignatureModal, setShowSignatureModal] = useState(false)
  const [signatureName, setSignatureName] = useState('')
  const [signatureCanvas, setSignatureCanvas] = useState<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  useEffect(() => {
    loadEstimate()
  }, [jobId])

  const loadEstimate = async () => {
    try {
      setLoading(true)
      let foundEstimate: EstimateData | null = null

      // First try to find estimates that belong to this job
      const { data: jobEstimates, error: jobEstimatesError } = await supabase
        .from('estimates')
        .select(`
          *,
          estimate_line_items(
            id,
            description,
            quantity,
            unit_price,
            line_total,
            item_type,
            sort_order
          )
        `)
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })
        .limit(1)

      if (!jobEstimatesError && jobEstimates && jobEstimates.length > 0) {
        foundEstimate = jobEstimates[0]
      } else {
        // If no job estimates, check if job was created from an estimate
        const { data: job, error: jobError } = await supabase
          .from('jobs')
          .select('estimate_id')
          .eq('id', jobId)
          .single()

        if (!jobError && job?.estimate_id) {
          // Load the estimate that created this job
          const { data: estimateData, error: estimateError } = await supabase
            .from('estimates')
            .select(`
              *,
              estimate_line_items(
                id,
                description,
                quantity,
                unit_price,
                line_total,
                item_type,
                sort_order
              )
            `)
            .eq('id', job.estimate_id)
            .single()

          if (!estimateError && estimateData) {
            foundEstimate = estimateData
          }
        }
      }

      if (!foundEstimate) {
        console.log('No estimate associated with this job')
        return
      }

      setEstimate(foundEstimate)

      // Log portal activity if we have a portal token
      if (portalTokenId && tenantId) {
        await supabase.functions.invoke('log-portal-activity', {
          body: {
            portal_token_id: portalTokenId,
            tenant_id: tenantId,
            activity_type: 'view_estimate',
            metadata: { estimate_id: foundEstimate.id }
          }
        })
      }

    } catch (error) {
      console.error('Error loading estimate:', error)
      toast.error('Failed to load estimate')
    } finally {
      setLoading(false)
    }
  }

  const initializeCanvas = (canvas: HTMLCanvasElement) => {
    if (!canvas) return
    
    setSignatureCanvas(canvas)
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    canvas.width = canvas.offsetWidth
    canvas.height = 200

    // Set drawing style
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // Clear canvas
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!signatureCanvas) return
    setIsDrawing(true)

    const ctx = signatureCanvas.getContext('2d')
    if (!ctx) return

    const rect = signatureCanvas.getBoundingClientRect()
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.nativeEvent.offsetX
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.nativeEvent.offsetY

    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !signatureCanvas) return
    e.preventDefault()

    const ctx = signatureCanvas.getContext('2d')
    if (!ctx) return

    const rect = signatureCanvas.getBoundingClientRect()
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.nativeEvent.offsetX
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.nativeEvent.offsetY

    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearSignature = () => {
    if (!signatureCanvas) return
    const ctx = signatureCanvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, signatureCanvas.width, signatureCanvas.height)
  }

  const handleApproveEstimate = async () => {
    if (!estimate || !signatureName.trim()) {
      toast.error('Please enter your name to sign')
      return
    }

    if (!signatureCanvas) {
      toast.error('Please provide a signature')
      return
    }

    try {
      setSigning(true)

      // Get signature data
      const signatureData = signatureCanvas.toDataURL()

      // Use RPC function to sign estimate with proper validation
      const { error: signError } = await supabase
        .rpc('sign_estimate_via_portal', {
          p_estimate_id: estimate.id,
          p_portal_token: window.location.pathname.split('/').pop() || '', // Get token from URL
          p_signed_by: signatureName,
          p_signature_data: signatureData
        })

      if (signError) throw signError

      // Log portal activity
      if (portalTokenId && tenantId) {
        await supabase.functions.invoke('log-portal-activity', {
          body: {
            portal_token_id: portalTokenId,
            tenant_id: tenantId,
            activity_type: 'sign_estimate',
            metadata: { 
              estimate_id: estimate.id,
              signed_by: signatureName
            }
          }
        })
      }

      // Trigger estimate to job conversion
      const { error: conversionError } = await supabase.functions.invoke('auto-convert-signed-estimate', {
        body: {
          estimate_id: estimate.id
        }
      })

      if (conversionError) {
        console.error('Error converting estimate to job:', conversionError)
      }

      toast.success('Estimate approved successfully!')
      setShowSignatureModal(false)
      loadEstimate() // Reload to show updated status

    } catch (error) {
      console.error('Error approving estimate:', error)
      toast.error('Failed to approve estimate')
    } finally {
      setSigning(false)
    }
  }

  if (loading) {
    return (
      <div className="d-flex justify-content-center py-10">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  if (!estimate) {
    return (
      <div className="text-center py-10">
        <KTIcon iconName="document" className="fs-3x text-muted mb-3" />
        <h5 className="text-muted">No Estimate Available</h5>
        <p className="text-muted">There is no estimate associated with this job.</p>
      </div>
    )
  }

  const isApproved = estimate.status === 'signed' || estimate.status === 'approved'
  const isPending = estimate.status === 'sent' || estimate.status === 'draft'

  return (
    <div>
      {/* Estimate Header */}
      <div className="d-flex justify-content-between align-items-center mb-6">
        <div>
          <h3 className="mb-2">Estimate #{estimate.estimate_number}</h3>
          <div className="text-muted fs-6">
            Created on {format(new Date(estimate.created_at), 'MMMM d, yyyy')}
          </div>
        </div>
        <div className="text-end">
          <div className={`badge badge-lg badge-light-${
            isApproved ? 'success' : isPending ? 'warning' : 'secondary'
          }`}>
            {isApproved ? 'Approved' : isPending ? 'Pending Approval' : estimate.status}
          </div>
          {!isApproved && estimate.valid_until && (
            <div className="text-muted fs-7 mt-2">
              Valid until {format(new Date(estimate.valid_until), 'MMM d, yyyy')}
            </div>
          )}
        </div>
      </div>

      {/* Estimate Details */}
      <div className="card mb-6">
        <div className="card-body">
          {estimate.project_title && (
            <>
              <div className="mb-6">
                <div className="fw-semibold fs-6 text-gray-600 mb-2">Project</div>
                <div className="fw-bold fs-5 text-gray-800">{estimate.project_title}</div>
              </div>
              <div className="separator separator-dashed mb-6"></div>
            </>
          )}

          {estimate.description && (
            <>
              <div className="mb-8">
                <div className="fw-semibold fs-6 text-gray-600 mb-3">Description</div>
                <div className="text-gray-800">{estimate.description}</div>
              </div>
              <div className="separator separator-dashed mb-8"></div>
            </>
          )}

          <div className="separator separator-dashed mb-8"></div>

          {/* Line Items */}
          <div className="table-responsive mb-8">
            <table className="table">
              <thead>
                <tr className="fs-6 fw-bold text-gray-700 text-uppercase">
                  <th className="min-w-200px">Description</th>
                  <th className="min-w-100px text-end">Quantity</th>
                  <th className="min-w-100px text-end">Unit Price</th>
                  <th className="min-w-100px text-end">Total</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Check for line items from the separate table first
                  const lineItems = (estimate as any).estimate_line_items?.length > 0 
                    ? (estimate as any).estimate_line_items.sort((a: any, b: any) => a.sort_order - b.sort_order)
                    : estimate.line_items || []
                  
                  if (lineItems.length === 0) {
                    return (
                      <tr>
                        <td colSpan={4} className="text-center text-muted">No line items</td>
                      </tr>
                    )
                  }
                  
                  return lineItems.map((item: any, index: number) => (
                    <tr key={item.id || index} className="fs-6 text-gray-800">
                      <td>{item.description}</td>
                      <td className="text-end">{item.quantity}</td>
                      <td className="text-end">${(item.unit_price || 0).toFixed(2)}</td>
                      <td className="text-end fw-bold">
                        ${(item.line_total || (item.quantity * item.unit_price)).toFixed(2)}
                      </td>
                    </tr>
                  ))
                })()}
              </tbody>
              <tfoot>
                <tr className="fs-5 text-gray-900 fw-bold">
                  <td colSpan={3} className="text-end">Total Amount:</td>
                  <td className="text-end">${estimate.total_amount.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Terms and Conditions */}
          {estimate.terms_conditions && (
            <div className="mb-8">
              <div className="fw-semibold fs-6 text-gray-600 mb-3">Terms & Conditions</div>
              <div className="text-gray-700 fs-7" style={{ whiteSpace: 'pre-wrap' }}>
                {estimate.terms_conditions}
              </div>
            </div>
          )}

          {/* Payment Terms */}
          {estimate.payment_terms && (
            <div className="mb-8">
              <div className="fw-semibold fs-6 text-gray-600 mb-3">Payment Terms</div>
              <div className="text-gray-700">{estimate.payment_terms}</div>
            </div>
          )}

          {/* Signature Section */}
          {isApproved && (estimate.signed_by || estimate.signed_by_name) && (
            <div className="bg-light-success rounded p-6">
              <div className="d-flex align-items-center mb-3">
                <KTIcon iconName="check-circle" className="fs-2x text-success me-3" />
                <div>
                  <div className="fw-bold fs-5 text-success">Estimate Approved</div>
                  <div className="text-gray-600">
                    Signed by {estimate.signed_by_name || estimate.signed_by} on {format(new Date(estimate.signed_at || estimate.signed_date!), 'MMMM d, yyyy')}
                  </div>
                </div>
              </div>
              {estimate.signature_data && (
                <div className="mt-4">
                  <img 
                    src={estimate.signature_data} 
                    alt="Signature" 
                    className="border rounded"
                    style={{ maxHeight: '100px' }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Approve Button */}
          {!isApproved && isPending && (
            <div className="text-center mt-8">
              <button
                className="btn btn-lg btn-success"
                onClick={() => setShowSignatureModal(true)}
              >
                <KTIcon iconName="check" className="fs-3 me-2" />
                Approve Estimate
              </button>
              <div className="text-muted fs-7 mt-3">
                By approving this estimate, you agree to the terms and authorize us to proceed with the work.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Signature Modal */}
      {showSignatureModal && (
        <div className="modal fade show d-block" tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Approve Estimate</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowSignatureModal(false)}
                  disabled={signing}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-5">
                  <label className="form-label required">Your Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter your full name"
                    value={signatureName}
                    onChange={(e) => setSignatureName(e.target.value)}
                    disabled={signing}
                  />
                </div>

                <div className="mb-5">
                  <label className="form-label required">Signature</label>
                  <div className="border rounded p-2 bg-white">
                    <canvas
                      ref={initializeCanvas}
                      className="w-100"
                      style={{ touchAction: 'none', cursor: 'crosshair' }}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-light-danger mt-2"
                    onClick={clearSignature}
                    disabled={signing}
                  >
                    <KTIcon iconName="eraser" className="fs-6 me-1" />
                    Clear Signature
                  </button>
                </div>

                <div className="bg-light-warning rounded p-4">
                  <div className="d-flex">
                    <KTIcon iconName="information" className="fs-2x text-warning me-3" />
                    <div className="text-gray-700 fs-7">
                      By signing this estimate, you agree to the terms and conditions and authorize us to proceed with the described work at the quoted price of <strong>${estimate.total_amount.toFixed(2)}</strong>.
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => setShowSignatureModal(false)}
                  disabled={signing}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleApproveEstimate}
                  disabled={signing || !signatureName.trim()}
                >
                  {signing ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Approving...
                    </>
                  ) : (
                    <>
                      <KTIcon iconName="check" className="fs-3 me-2" />
                      Approve & Sign
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showSignatureModal && <div className="modal-backdrop fade show"></div>}
    </div>
  )
}

export default EstimatesTab