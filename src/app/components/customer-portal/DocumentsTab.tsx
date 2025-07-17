import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'

interface PortalDocument {
  id: string
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  document_type: string
  description?: string
  created_at: string
  uploaded_by_name: string
  is_shared_with_customer: boolean
}

interface DocumentsTabProps {
  jobId: string
  tenantId: string
  contactId?: string
}

const DocumentsTab: React.FC<DocumentsTabProps> = ({ jobId, tenantId, contactId }) => {
  const [documents, setDocuments] = useState<PortalDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (jobId && tenantId) {
      loadDocuments()
    }
  }, [jobId, tenantId])

  const loadDocuments = async () => {
    setLoading(true)
    try {
      // Load documents related to this job that are shared with customers
      const { data, error } = await supabase
        .from('job_documents')
        .select(`
          id,
          file_name,
          file_path,
          file_size,
          file_type,
          document_type,
          description,
          created_at,
          uploaded_by,
          uploaded_by_contact_id,
          is_shared_with_customer
        `)
        .eq('job_id', jobId)
        .eq('tenant_id', tenantId)
        .eq('is_shared_with_customer', true)
        .order('created_at', { ascending: false })

      if (error) throw error

      // For each document, try to get the uploader name
      const transformedDocs = await Promise.all((data || []).map(async (doc) => {
        let uploaded_by_name = 'Team Member'
        
        try {
          // Try to get name from user_profiles if uploaded_by exists
          if (doc.uploaded_by) {
            const { data: userProfile } = await supabase
              .from('user_profiles')
              .select('first_name, last_name')
              .eq('id', doc.uploaded_by)
              .single()
            
            if (userProfile) {
              uploaded_by_name = `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim()
            }
          }
          // Try to get name from contacts if uploaded_by_contact_id exists
          else if (doc.uploaded_by_contact_id) {
            const { data: contact } = await supabase
              .from('contacts')
              .select('first_name, last_name')
              .eq('id', doc.uploaded_by_contact_id)
              .single()
            
            if (contact) {
              uploaded_by_name = `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
            }
          }
        } catch (error) {
          console.warn('Could not fetch uploader name:', error)
        }
        
        return {
          ...doc,
          uploaded_by_name: uploaded_by_name || 'Team Member'
        }
      }))

      setDocuments(transformedDocs)
    } catch (error) {
      console.error('Error loading documents:', error)
      showToast.error('Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = () => {
    fileInputRef.current?.click()
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    setUploading(true)
    const loadingToast = showToast.loading('Uploading documents...')

    try {
      for (const file of files) {
        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          showToast.error(`File ${file.name} is too large. Maximum size is 10MB.`)
          continue
        }

        const fileName = `customer-uploads/${tenantId}/${jobId}/${Date.now()}_${file.name}`

        // Upload to Supabase storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('job-documents')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          })

        if (uploadError) throw uploadError

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('job-documents')
          .getPublicUrl(fileName)

        // Save document record
        const { error: saveError } = await supabase
          .from('job_documents')
          .insert({
            job_id: jobId,
            tenant_id: tenantId,
            uploaded_by_contact_id: contactId,
            file_name: file.name,
            file_path: fileName,
            file_url: publicUrl,
            file_size: file.size,
            file_type: file.type,
            document_type: 'customer_upload',
            description: 'Uploaded by customer via portal',
            is_shared_with_customer: true,
            created_at: new Date().toISOString()
          })

        if (saveError) throw saveError
      }

      showToast.dismiss(loadingToast)
      showToast.success(`${files.length} document(s) uploaded successfully!`)
      
      // Reset form and reload documents
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      
      await loadDocuments()

    } catch (error: any) {
      console.error('Error uploading documents:', error)
      showToast.dismiss(loadingToast)
      showToast.error(error.message || 'Failed to upload documents')
    } finally {
      setUploading(false)
    }
  }

  const handleDownloadDocument = async (document: PortalDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('job-documents')
        .createSignedUrl(document.file_path, 60)
      
      if (error) {
        showToast.error('Failed to access document')
        return
      }
      
      window.open(data.signedUrl, '_blank')
    } catch (error) {
      console.error('Error downloading document:', error)
      showToast.error('Failed to download document')
    }
  }

  const getDocumentIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return 'file-pdf'
    if (fileType.includes('word') || fileType.includes('doc')) return 'file-word'
    if (fileType.includes('excel') || fileType.includes('sheet')) return 'file-excel'
    if (fileType.includes('image')) return 'picture'
    return 'file'
  }

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'contract': 'Contract',
      'invoice': 'Invoice',
      'estimate': 'Estimate',
      'permit': 'Permit',
      'insurance': 'Insurance',
      'warranty': 'Warranty',
      'customer_upload': 'Customer Document',
      'other': 'Document'
    }
    return labels[type] || 'Document'
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading documents...</span>
        </div>
        <p className="text-muted mt-3">Loading project documents...</p>
      </div>
    )
  }

  return (
    <div className="documents-customer">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h5 className="mb-1">
            <i className="ki-duotone ki-folder fs-3 text-primary me-2">
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
            Project Documents
          </h5>
          <p className="text-muted fs-6 mb-0">
            View shared documents and upload files for your project
          </p>
        </div>
        
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleFileSelect}
          disabled={uploading}
        >
          <i className="ki-duotone ki-file-up fs-2 me-2">
            <span className="path1"></span>
            <span className="path2"></span>
          </i>
          Upload File
        </button>
      </div>

      {/* Upload Area */}
      <div 
        className="alert alert-light border border-dashed border-primary rounded p-4 mb-4"
        onClick={handleFileSelect}
        style={{ cursor: 'pointer' }}
      >
        <div className="d-flex align-items-center">
          <i className="ki-duotone ki-file-up fs-2x text-primary me-3">
            <span className="path1"></span>
            <span className="path2"></span>
          </i>
          <div>
            <h6 className="mb-1">Share Documents with Your Contractor</h6>
            <p className="text-muted mb-0 fs-7">
              Upload permits, specifications, photos, or any other project-related files
            </p>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />

      {/* Documents List */}
      {documents.length === 0 ? (
        <div className="text-center py-8">
          <div className="mb-4">
            <i className="ki-duotone ki-folder-2 fs-3x text-muted">
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
          </div>
          <h6 className="text-muted mb-2">No Documents Yet</h6>
          <p className="text-muted">
            Documents shared by your contractor or uploaded by you will appear here.
          </p>
        </div>
      ) : (
        <div className="row g-3">
          {documents.map((doc) => (
            <div key={doc.id} className="col-sm-6 col-lg-4">
              <div className="card h-100 shadow-sm">
                <div className="card-body">
                  <div className="d-flex align-items-start mb-3">
                    <div className="symbol symbol-40px me-3">
                      <span className="symbol-label bg-light-primary text-primary">
                        <i className={`ki-duotone ki-${getDocumentIcon(doc.file_type)} fs-2`}>
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                      </span>
                    </div>
                    <div className="flex-grow-1">
                      <h6 className="mb-1 text-truncate" title={doc.file_name}>
                        {doc.file_name}
                      </h6>
                      <span className="badge badge-light-info fs-8">
                        {getDocumentTypeLabel(doc.document_type)}
                      </span>
                    </div>
                  </div>

                  {doc.description && (
                    <p className="text-muted fs-7 mb-3">
                      {doc.description}
                    </p>
                  )}

                  <div className="d-flex justify-content-between align-items-center text-muted fs-8 mb-3">
                    <span>{formatFileSize(doc.file_size)}</span>
                    <span>{formatDate(doc.created_at)}</span>
                  </div>

                  <div className="d-flex justify-content-between align-items-center">
                    <div className="text-muted fs-8">
                      <i className="ki-duotone ki-profile-user fs-7 me-1">
                        <span className="path1"></span>
                        <span className="path2"></span>
                        <span className="path3"></span>
                      </i>
                      {doc.uploaded_by_name}
                    </div>
                    
                    <button
                      className="btn btn-light-primary btn-sm"
                      onClick={() => handleDownloadDocument(doc)}
                      title="Download document"
                    >
                      <i className="ki-duotone ki-file-down fs-5">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
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

export default DocumentsTab