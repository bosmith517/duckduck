import React, { useState, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { showToast } from '../../utils/toast'

interface JobDocument {
  id: string
  job_id: string
  tenant_id: string
  uploaded_by: string
  file_name: string
  file_path: string
  file_url: string
  file_size: number
  file_type: string
  document_type: 'contract' | 'estimate' | 'invoice' | 'permit' | 'inspection' | 'warranty' | 'compliance' | 'other'
  description?: string
  is_ai_accessible: boolean
  ai_analysis_status: 'pending' | 'processing' | 'completed' | 'failed' | null
  ai_extracted_data: any
  created_at: string
  updated_at: string
  uploader?: {
    first_name: string
    last_name: string
  }
}

interface JobDocumentsProps {
  jobId: string
  showTitle?: boolean
  allowUpload?: boolean
}

const JobDocuments: React.FC<JobDocumentsProps> = ({
  jobId,
  showTitle = true,
  allowUpload = true
}) => {
  const { userProfile } = useSupabaseAuth()
  const [documents, setDocuments] = useState<JobDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [documentType, setDocumentType] = useState<JobDocument['document_type']>('other')
  const [description, setDescription] = useState('')
  const [isAiAccessible, setIsAiAccessible] = useState(true)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [processingAI, setProcessingAI] = useState<string | null>(null)

  useEffect(() => {
    if (jobId && userProfile?.tenant_id) {
      loadDocuments()
    }
  }, [jobId, userProfile?.tenant_id])

  const loadDocuments = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('job_documents')
        .select(`
          *,
          uploader:user_profiles(first_name, last_name)
        `)
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setDocuments(data || [])
    } catch (error) {
      console.error('Error loading documents:', error)
      showToast.error('Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        showToast.error('File size must be less than 10MB')
        return
      }
      
      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ]
      
      if (!allowedTypes.includes(file.type)) {
        showToast.error('File type not supported. Please upload PDF, images, Word documents, or text files.')
        return
      }
      
      setSelectedFile(file)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile || !userProfile?.tenant_id) return

    setUploading(true)
    const loadingToast = showToast.loading('Uploading document...')

    try {
      // Create file path
      const fileExtension = selectedFile.name.split('.').pop()
      const fileName = `${Date.now()}-${selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      const filePath = `job-documents/${jobId}/${fileName}`

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('job-documents')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('job-documents')
        .getPublicUrl(filePath)

      // Save document record to database
      const { data: docData, error: docError } = await supabase
        .from('job_documents')
        .insert({
          job_id: jobId,
          tenant_id: userProfile.tenant_id,
          uploaded_by: userProfile.id,
          file_name: selectedFile.name,
          file_path: filePath,
          file_url: publicUrl,
          file_size: selectedFile.size,
          file_type: selectedFile.type,
          document_type: documentType,
          description: description.trim() || null,
          is_ai_accessible: isAiAccessible,
          ai_analysis_status: isAiAccessible ? 'pending' : null
        })
        .select(`
          *,
          uploader:user_profiles(first_name, last_name)
        `)
        .single()

      if (docError) throw docError

      // Add to local state
      setDocuments(prev => [docData, ...prev])
      
      // Reset form
      setSelectedFile(null)
      setDocumentType('other')
      setDescription('')
      setIsAiAccessible(true)
      setShowUploadForm(false)
      
      // Clear file input
      const fileInput = document.getElementById('documentFile') as HTMLInputElement
      if (fileInput) fileInput.value = ''

      showToast.dismiss(loadingToast)
      showToast.success('Document uploaded successfully!')

      // Trigger AI analysis if enabled
      if (isAiAccessible) {
        triggerAIAnalysis(docData.id)
      }

    } catch (error: any) {
      console.error('Error uploading document:', error)
      showToast.dismiss(loadingToast)
      showToast.error(error.message || 'Failed to upload document')
    } finally {
      setUploading(false)
    }
  }

  const triggerAIAnalysis = async (documentId: string) => {
    setProcessingAI(documentId)
    
    try {
      const { error } = await supabase.functions.invoke('analyze-job-document', {
        body: {
          documentId,
          jobId,
          tenantId: userProfile?.tenant_id
        }
      })

      if (error) {
        console.error('AI analysis failed:', error)
        showToast.error('AI analysis failed. Document uploaded successfully but analysis is unavailable.')
      } else {
        showToast.success('AI analysis started! Results will be available shortly.')
      }
    } catch (error) {
      console.error('Error triggering AI analysis:', error)
    } finally {
      setProcessingAI(null)
      // Refresh documents to get updated AI status
      setTimeout(loadDocuments, 2000)
    }
  }

  const handleDownload = async (document: JobDocument) => {
    try {
      const response = await fetch(document.file_url)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = document.file_name
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading document:', error)
      showToast.error('Failed to download document')
    }
  }

  const handleDelete = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return

    try {
      const { error } = await supabase
        .from('job_documents')
        .delete()
        .eq('id', documentId)

      if (error) throw error

      setDocuments(prev => prev.filter(doc => doc.id !== documentId))
      showToast.success('Document deleted successfully')
    } catch (error) {
      console.error('Error deleting document:', error)
      showToast.error('Failed to delete document')
    }
  }

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'contract': 'Contract',
      'estimate': 'Estimate',
      'invoice': 'Invoice',
      'permit': 'Permit',
      'inspection': 'Inspection Report',
      'warranty': 'Warranty',
      'compliance': 'Compliance Doc',
      'other': 'Other'
    }
    return labels[type] || 'Other'
  }

  const getDocumentTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'contract': 'success',
      'estimate': 'primary',
      'invoice': 'warning',
      'permit': 'info',
      'inspection': 'danger',
      'warranty': 'secondary',
      'compliance': 'dark',
      'other': 'light'
    }
    return colors[type] || 'light'
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getAIStatusIcon = (status: string | null) => {
    switch (status) {
      case 'pending':
        return <i className="ki-duotone ki-time text-warning fs-6" title="AI Analysis Pending"></i>
      case 'processing':
        return <i className="ki-duotone ki-loading text-primary fs-6" title="AI Analysis in Progress"></i>
      case 'completed':
        return <i className="ki-duotone ki-check-circle text-success fs-6" title="AI Analysis Complete"></i>
      case 'failed':
        return <i className="ki-duotone ki-cross-circle text-danger fs-6" title="AI Analysis Failed"></i>
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading documents...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="job-documents">
      {(showTitle || allowUpload) && (
        <div className="d-flex justify-content-between align-items-center mb-4">
          {showTitle && (
            <h6 className="mb-0">
              <i className="ki-duotone ki-folder fs-4 text-primary me-2">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              Job Documents ({documents.length})
            </h6>
          )}
          {!showTitle && <div></div>}
          {allowUpload && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowUploadForm(true)}
            >
              <i className="ki-duotone ki-plus fs-5 me-2">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              Upload Document
            </button>
          )}
        </div>
      )}

      {/* Upload Form */}
      {showUploadForm && (
        <div className="card border-primary mb-4">
          <div className="card-header bg-light-primary">
            <h6 className="card-title mb-0">Upload New Document</h6>
            <button
              className="btn btn-sm btn-icon btn-light-primary"
              onClick={() => setShowUploadForm(false)}
            >
              <i className="ki-duotone ki-cross fs-2"></i>
            </button>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Select File</label>
                <input
                  type="file"
                  id="documentFile"
                  className="form-control"
                  onChange={handleFileSelect}
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
                />
                <div className="form-text">
                  Supported: PDF, Word, Text, Images (max 10MB)
                </div>
              </div>
              <div className="col-md-6">
                <label className="form-label">Document Type</label>
                <select
                  className="form-select"
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value as JobDocument['document_type'])}
                >
                  <option value="contract">Contract</option>
                  <option value="estimate">Estimate</option>
                  <option value="invoice">Invoice</option>
                  <option value="permit">Permit</option>
                  <option value="inspection">Inspection Report</option>
                  <option value="warranty">Warranty</option>
                  <option value="compliance">Compliance Document</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="col-12">
                <label className="form-label">Description (Optional)</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of the document..."
                />
              </div>
              <div className="col-12">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="aiAccessible"
                    checked={isAiAccessible}
                    onChange={(e) => setIsAiAccessible(e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="aiAccessible">
                    Allow AI to analyze this document for data extraction and insights
                  </label>
                </div>
              </div>
              <div className="col-12">
                <button
                  className="btn btn-primary"
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                >
                  {uploading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <i className="ki-duotone ki-cloud-upload fs-5 me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Upload Document
                    </>
                  )}
                </button>
                <button
                  className="btn btn-light ms-2"
                  onClick={() => setShowUploadForm(false)}
                  disabled={uploading}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Documents List */}
      {documents.length === 0 ? (
        <div className="text-center py-8">
          <i className="ki-duotone ki-folder-file fs-3x text-muted mb-3">
            <span className="path1"></span>
            <span className="path2"></span>
          </i>
          <h6 className="text-muted">No Documents Yet</h6>
          <p className="text-muted fs-7 mb-4">
            Upload contracts, permits, inspection reports, and other job-related documents
          </p>
          {allowUpload && (
            <button
              className="btn btn-primary"
              onClick={() => setShowUploadForm(true)}
            >
              <i className="ki-duotone ki-plus fs-5 me-2">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              Upload First Document
            </button>
          )}
        </div>
      ) : (
        <div className="row g-3">
          {documents.map((document) => (
            <div key={document.id} className="col-md-6 col-lg-4">
              <div className="card h-100">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <span className={`badge badge-${getDocumentTypeColor(document.document_type)} fs-8`}>
                      {getDocumentTypeLabel(document.document_type)}
                    </span>
                    <div className="d-flex align-items-center gap-1">
                      {document.is_ai_accessible && getAIStatusIcon(document.ai_analysis_status)}
                      {processingAI === document.id && (
                        <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                      )}
                    </div>
                  </div>
                  
                  <h6 className="card-title text-truncate" title={document.file_name}>
                    {document.file_name}
                  </h6>
                  
                  {document.description && (
                    <p className="text-muted fs-7 mb-2">{document.description}</p>
                  )}
                  
                  <div className="d-flex justify-content-between align-items-center text-muted fs-8 mb-3">
                    <span>{formatFileSize(document.file_size)}</span>
                    <span>{new Date(document.created_at).toLocaleDateString()}</span>
                  </div>
                  
                  <div className="text-muted fs-8 mb-3">
                    Uploaded by: {document.uploader?.first_name} {document.uploader?.last_name}
                  </div>
                  
                  {document.ai_analysis_status === 'completed' && document.ai_extracted_data && (
                    <div className="alert alert-light-success p-2 mb-3">
                      <i className="ki-duotone ki-abstract-39 fs-6 text-success me-1">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-8">AI analysis complete - data extracted</span>
                    </div>
                  )}
                  
                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-light-primary btn-sm flex-fill"
                      onClick={() => handleDownload(document)}
                    >
                      <i className="ki-duotone ki-down fs-6 me-1">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Download
                    </button>
                    {document.is_ai_accessible && document.ai_analysis_status === 'failed' && (
                      <button
                        className="btn btn-light-warning btn-sm"
                        onClick={() => triggerAIAnalysis(document.id)}
                        disabled={processingAI === document.id}
                        title="Retry AI Analysis"
                      >
                        <i className="ki-duotone ki-refresh fs-6"></i>
                      </button>
                    )}
                    <button
                      className="btn btn-light-danger btn-sm"
                      onClick={() => handleDelete(document.id)}
                      title="Delete Document"
                    >
                      <i className="ki-duotone ki-trash fs-6"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default JobDocuments