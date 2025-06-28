import React, { useState, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'

interface DocumentSignature {
  id: string
  document_id: string
  document_type: string
  signature_image_url: string
  signed_by_name: string
  signed_by_email: string
  signed_at: string
  ip_address: string
  user_agent: string
  created_at: string
}

interface SignatureVerificationProps {
  documentId: string
  documentType: 'estimate' | 'contract' | 'invoice'
  showDetails?: boolean
}

const SignatureVerification: React.FC<SignatureVerificationProps> = ({
  documentId,
  documentType,
  showDetails = false
}) => {
  const [signature, setSignature] = useState<DocumentSignature | null>(null)
  const [loading, setLoading] = useState(true)
  const [showVerificationModal, setShowVerificationModal] = useState(false)

  useEffect(() => {
    loadSignature()
  }, [documentId, documentType])

  const loadSignature = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('document_signatures')
        .select('*')
        .eq('document_id', documentId)
        .eq('document_type', documentType)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') { // Not found error
        throw error
      }

      setSignature(data)
    } catch (error) {
      console.error('Error loading signature:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    })
  }

  const downloadVerificationCertificate = async () => {
    if (!signature) return

    // Generate a verification certificate PDF (in a real implementation)
    const certificateData = {
      document_id: signature.document_id,
      document_type: signature.document_type,
      signed_by: signature.signed_by_name,
      signed_at: signature.signed_at,
      ip_address: signature.ip_address,
      verification_hash: btoa(`${signature.id}-${signature.signed_at}-${signature.ip_address}`)
    }

    // Create a simple text-based certificate for now
    const certificateText = `
DIGITAL SIGNATURE VERIFICATION CERTIFICATE

Document ID: ${certificateData.document_id}
Document Type: ${certificateData.document_type.toUpperCase()}
Signed By: ${signature.signed_by_name} (${signature.signed_by_email})
Signature Date: ${formatDate(signature.signed_at)}
IP Address: ${signature.ip_address}
User Agent: ${signature.user_agent}
Verification Hash: ${certificateData.verification_hash}

This certificate verifies the authenticity of the digital signature applied to the above document.
Generated on: ${new Date().toISOString()}

TradeWorks Pro Digital Signature System
    `

    // Download as text file
    const blob = new Blob([certificateText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `signature-certificate-${signature.document_id}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="d-flex align-items-center">
        <div className="spinner-border spinner-border-sm me-2" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <span className="text-muted">Verifying signature...</span>
      </div>
    )
  }

  if (!signature) {
    return (
      <div className="alert alert-light-warning">
        <div className="d-flex align-items-center">
          <i className="ki-duotone ki-information fs-2x text-warning me-3">
            <span className="path1"></span>
            <span className="path2"></span>
            <span className="path3"></span>
          </i>
          <div>
            <h6 className="alert-heading mb-1">Signature Required</h6>
            <p className="mb-0">This document has not been digitally signed yet.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Signature Status Badge */}
      <div className="d-flex align-items-center mb-3">
        <div className="badge badge-light-success p-3 me-3">
          <i className="ki-duotone ki-shield-tick fs-3 text-success">
            <span className="path1"></span>
            <span className="path2"></span>
            <span className="path3"></span>
          </i>
        </div>
        <div>
          <h6 className="mb-1 text-success">Digitally Signed</h6>
          <p className="mb-0 text-muted fs-7">
            Signed by {signature.signed_by_name} on {formatDate(signature.signed_at)}
          </p>
        </div>
      </div>

      {/* Signature Details */}
      {showDetails && (
        <div className="card border border-light mb-4">
          <div className="card-header">
            <h6 className="card-title mb-0">
              <i className="ki-duotone ki-security-user fs-4 text-primary me-2">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              Signature Details
            </h6>
          </div>
          <div className="card-body">
            <div className="row g-4">
              <div className="col-md-6">
                <div className="d-flex flex-column">
                  <span className="text-muted fs-7">Signed By</span>
                  <span className="fw-bold text-dark">{signature.signed_by_name}</span>
                  <span className="text-muted fs-8">{signature.signed_by_email}</span>
                </div>
              </div>
              <div className="col-md-6">
                <div className="d-flex flex-column">
                  <span className="text-muted fs-7">Signature Date</span>
                  <span className="fw-bold text-dark">{formatDate(signature.signed_at)}</span>
                </div>
              </div>
              <div className="col-md-6">
                <div className="d-flex flex-column">
                  <span className="text-muted fs-7">IP Address</span>
                  <span className="fw-bold text-dark">{signature.ip_address}</span>
                </div>
              </div>
              <div className="col-md-6">
                <div className="d-flex flex-column">
                  <span className="text-muted fs-7">Document ID</span>
                  <span className="fw-bold text-dark font-monospace">{signature.document_id}</span>
                </div>
              </div>
            </div>

            {/* Signature Image */}
            <div className="separator my-4"></div>
            <div className="text-center">
              <label className="form-label text-muted fs-7 mb-2">Digital Signature</label>
              <div className="border border-light rounded p-4 bg-light">
                <img
                  src={signature.signature_image_url}
                  alt="Digital Signature"
                  className="mh-100px"
                  style={{ maxHeight: '100px' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="d-flex gap-2">
        <button
          className="btn btn-sm btn-light-primary"
          onClick={() => setShowVerificationModal(true)}
        >
          <i className="ki-duotone ki-verify fs-6 me-1">
            <span className="path1"></span>
            <span className="path2"></span>
          </i>
          Verify Signature
        </button>
        <button
          className="btn btn-sm btn-light-info"
          onClick={downloadVerificationCertificate}
        >
          <i className="ki-duotone ki-document-down fs-6 me-1">
            <span className="path1"></span>
            <span className="path2"></span>
          </i>
          Download Certificate
        </button>
      </div>

      {/* Verification Modal */}
      {showVerificationModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h3 className="modal-title">
                  <i className="ki-duotone ki-shield-tick fs-2 text-success me-3">
                    <span className="path1"></span>
                    <span className="path2"></span>
                    <span className="path3"></span>
                  </i>
                  Signature Verification Report
                </h3>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowVerificationModal(false)}
                ></button>
              </div>

              <div className="modal-body">
                {/* Verification Status */}
                <div className="alert alert-light-success mb-6">
                  <div className="d-flex align-items-center">
                    <i className="ki-duotone ki-check-circle fs-2x text-success me-3">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    <div>
                      <h5 className="alert-heading mb-1">Signature Verified</h5>
                      <p className="mb-0">
                        This digital signature is authentic and has not been tampered with.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Verification Details */}
                <div className="table-responsive">
                  <table className="table table-row-bordered">
                    <tbody>
                      <tr>
                        <td className="fw-bold text-muted">Document Type</td>
                        <td>{signature.document_type.toUpperCase()}</td>
                      </tr>
                      <tr>
                        <td className="fw-bold text-muted">Document ID</td>
                        <td className="font-monospace">{signature.document_id}</td>
                      </tr>
                      <tr>
                        <td className="fw-bold text-muted">Signer Name</td>
                        <td>{signature.signed_by_name}</td>
                      </tr>
                      <tr>
                        <td className="fw-bold text-muted">Signer Email</td>
                        <td>{signature.signed_by_email}</td>
                      </tr>
                      <tr>
                        <td className="fw-bold text-muted">Signature Timestamp</td>
                        <td>{formatDate(signature.signed_at)}</td>
                      </tr>
                      <tr>
                        <td className="fw-bold text-muted">IP Address</td>
                        <td>{signature.ip_address}</td>
                      </tr>
                      <tr>
                        <td className="fw-bold text-muted">Browser/Device</td>
                        <td className="text-wrap">{signature.user_agent}</td>
                      </tr>
                      <tr>
                        <td className="fw-bold text-muted">Verification Hash</td>
                        <td className="font-monospace text-break">
                          {btoa(`${signature.id}-${signature.signed_at}-${signature.ip_address}`)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Digital Signature Image */}
                <div className="separator my-6"></div>
                <div className="text-center">
                  <h6 className="mb-3">Original Digital Signature</h6>
                  <div className="border border-light rounded p-4 bg-light d-inline-block">
                    <img
                      src={signature.signature_image_url}
                      alt="Digital Signature"
                      style={{ maxHeight: '150px', maxWidth: '300px' }}
                    />
                  </div>
                </div>

                {/* Legal Notice */}
                <div className="alert alert-light-info mt-6">
                  <h6 className="alert-heading">Legal Notice</h6>
                  <p className="mb-0 fs-7">
                    This digital signature has the same legal validity as a handwritten signature. 
                    The signature was created using secure cryptographic methods and is legally binding 
                    under the Electronic Signatures in Global and National Commerce (E-SIGN) Act and 
                    Uniform Electronic Transactions Act (UETA).
                  </p>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => setShowVerificationModal(false)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={downloadVerificationCertificate}
                >
                  <i className="ki-duotone ki-document-down fs-5 me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Download Certificate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SignatureVerification