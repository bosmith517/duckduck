import React, { useRef, useState, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'

interface ESignatureCaptureProps {
  isOpen: boolean
  onClose: () => void
  onSignatureComplete: (signatureData: SignatureData) => void
  documentTitle: string
  documentId: string
  documentType: 'estimate' | 'contract' | 'invoice'
  customerName: string
  customerEmail: string
}

interface SignatureData {
  signature_image_url: string
  signed_by_name: string
  signed_by_email: string
  signed_at: string
  ip_address: string
  user_agent: string
}

const ESignatureCapture: React.FC<ESignatureCaptureProps> = ({
  isOpen,
  onClose,
  onSignatureComplete,
  documentTitle,
  documentId,
  documentType,
  customerName,
  customerEmail
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [loading, setLoading] = useState(false)
  const [signedName, setSignedName] = useState(customerName)
  const [signedEmail, setSignedEmail] = useState(customerEmail)
  const [agreementChecked, setAgreementChecked] = useState(false)

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * 2 // High DPI
      canvas.height = rect.height * 2
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(2, 2)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 2
      }
    }
  }, [isOpen])

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.beginPath()
      ctx.moveTo(x, y)
    }
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.lineTo(x, y)
      ctx.stroke()
      setHasSignature(true)
    }
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  // Touch events for mobile
  const startDrawingTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    setIsDrawing(true)
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const touch = e.touches[0]
    const x = touch.clientX - rect.left
    const y = touch.clientY - rect.top

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.beginPath()
      ctx.moveTo(x, y)
    }
  }

  const drawTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (!isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const touch = e.touches[0]
    const x = touch.clientX - rect.left
    const y = touch.clientY - rect.top

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.lineTo(x, y)
      ctx.stroke()
      setHasSignature(true)
    }
  }

  const stopDrawingTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    setIsDrawing(false)
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      setHasSignature(false)
    }
  }

  const uploadSignatureImage = async (dataUrl: string): Promise<string> => {
    // Convert data URL to blob
    const response = await fetch(dataUrl)
    const blob = await response.blob()
    
    // Generate unique filename
    const filename = `signatures/${documentType}_${documentId}_${Date.now()}.png`
    
    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('documents')
      .upload(filename, blob, {
        contentType: 'image/png',
        upsert: false
      })

    if (error) {
      throw new Error(`Failed to upload signature: ${error.message}`)
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(data.path)

    return urlData.publicUrl
  }

  const saveSignature = async () => {
    if (!hasSignature || !signedName.trim() || !signedEmail.trim() || !agreementChecked) {
      showToast.error('Please complete all required fields and provide a signature')
      return
    }

    setLoading(true)
    try {
      const canvas = canvasRef.current
      if (!canvas) throw new Error('Canvas not found')

      // Get signature as data URL
      const dataUrl = canvas.toDataURL('image/png')
      
      // Upload signature image
      const signatureImageUrl = await uploadSignatureImage(dataUrl)

      // Get user's IP and user agent (would be more accurate on server side)
      const response = await fetch('https://api.ipify.org?format=json')
      const { ip } = await response.json()

      const signatureData: SignatureData = {
        signature_image_url: signatureImageUrl,
        signed_by_name: signedName,
        signed_by_email: signedEmail,
        signed_at: new Date().toISOString(),
        ip_address: ip,
        user_agent: navigator.userAgent
      }

      // Save signature record to database
      const { error: dbError } = await supabase
        .from('document_signatures')
        .insert({
          document_id: documentId,
          document_type: documentType,
          signature_image_url: signatureImageUrl,
          signed_by_name: signedName,
          signed_by_email: signedEmail,
          signed_at: signatureData.signed_at,
          ip_address: signatureData.ip_address,
          user_agent: signatureData.user_agent
        })

      if (dbError) {
        throw new Error(`Failed to save signature record: ${dbError.message}`)
      }

      // Update the main document status
      const updateData = {
        signature_status: 'signed',
        signed_at: signatureData.signed_at,
        signed_by_name: signedName,
        signed_by_email: signedEmail,
        signature_ip_address: signatureData.ip_address
      }

      const tableName = documentType === 'estimate' ? 'estimates' : 
                       documentType === 'invoice' ? 'invoices' : 'contracts'

      const { error: updateError } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', documentId)

      if (updateError) {
        throw new Error(`Failed to update document: ${updateError.message}`)
      }

      showToast.success('Document signed successfully!')
      onSignatureComplete(signatureData)
      onClose()
    } catch (error) {
      console.error('Error saving signature:', error)
      showToast.error((error as Error).message || 'Failed to save signature')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h3 className="modal-title">
              <i className="ki-duotone ki-pencil fs-2 text-primary me-3">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              Digital Signature Required
            </h3>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              disabled={loading}
            ></button>
          </div>

          <div className="modal-body">
            {/* Document Information */}
            <div className="alert alert-light-primary mb-6">
              <h5 className="alert-heading">Document to Sign</h5>
              <p className="mb-2">
                <strong>Document:</strong> {documentTitle}
              </p>
              <p className="mb-0">
                <strong>Type:</strong> {documentType.charAt(0).toUpperCase() + documentType.slice(1)}
              </p>
            </div>

            {/* Signer Information */}
            <div className="row g-4 mb-6">
              <div className="col-md-6">
                <label className="form-label required">Full Legal Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={signedName}
                  onChange={(e) => setSignedName(e.target.value)}
                  placeholder="Enter your full legal name"
                  disabled={loading}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label required">Email Address</label>
                <input
                  type="email"
                  className="form-control"
                  value={signedEmail}
                  onChange={(e) => setSignedEmail(e.target.value)}
                  placeholder="Enter your email address"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Signature Canvas */}
            <div className="mb-6">
              <label className="form-label required">Digital Signature</label>
              <div className="card border border-dashed border-primary">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <span className="text-muted fs-7">Sign in the box below using your mouse or finger</span>
                  <button
                    type="button"
                    className="btn btn-sm btn-light-danger"
                    onClick={clearSignature}
                    disabled={loading}
                  >
                    <i className="ki-duotone ki-eraser fs-6 me-1">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    Clear
                  </button>
                </div>
                <div className="card-body p-4">
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={200}
                    className="border border-light rounded w-100"
                    style={{ 
                      height: '200px',
                      cursor: 'crosshair',
                      touchAction: 'none' // Prevent scrolling on touch
                    }}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawingTouch}
                    onTouchMove={drawTouch}
                    onTouchEnd={stopDrawingTouch}
                  />
                  {!hasSignature && (
                    <div className="position-absolute top-50 start-50 translate-middle text-muted fs-6 pointer-events-none">
                      Sign here
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Legal Agreement */}
            <div className="form-check form-check-custom form-check-solid mb-6">
              <input
                className="form-check-input"
                type="checkbox"
                checked={agreementChecked}
                onChange={(e) => setAgreementChecked(e.target.checked)}
                disabled={loading}
              />
              <label className="form-check-label">
                <strong>I agree</strong> that my typed name and drawn signature above constitute a legal signature 
                and that I am legally bound by the terms of this {documentType}. I acknowledge that this electronic 
                signature has the same legal effect as a handwritten signature.
              </label>
            </div>

            {/* Security Notice */}
            <div className="alert alert-light-info">
              <div className="d-flex align-items-center">
                <i className="ki-duotone ki-shield-tick fs-2x text-info me-3">
                  <span className="path1"></span>
                  <span className="path2"></span>
                  <span className="path3"></span>
                </i>
                <div>
                  <h6 className="alert-heading mb-1">Secure Digital Signature</h6>
                  <p className="mb-0 fs-7">
                    Your signature is encrypted and stored securely. We capture your IP address, timestamp, 
                    and device information for legal verification purposes.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-light"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-success"
              onClick={saveSignature}
              disabled={loading || !hasSignature || !signedName.trim() || !signedEmail.trim() || !agreementChecked}
            >
              {loading && <span className="spinner-border spinner-border-sm me-2"></span>}
              <i className="ki-duotone ki-check fs-5 me-2">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              Complete Signature
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ESignatureCapture
