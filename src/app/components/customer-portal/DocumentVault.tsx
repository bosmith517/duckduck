import React, { useState } from 'react'

interface Document {
  id: string
  name: string
  type: string
  size: number
  uploadDate: string
  category: 'contract' | 'estimate' | 'invoice' | 'warranty' | 'manual' | 'report' | 'other'
  url?: string
  previewUrl?: string
  status: 'uploaded' | 'processing' | 'ready' | 'error'
}

interface DocumentVaultProps {
  customerId?: string
  tenantId?: string
}

const DocumentVault: React.FC<DocumentVaultProps> = ({ customerId, tenantId }) => {
  const [documents, setDocuments] = useState<Document[]>([
    {
      id: '1',
      name: 'Service Agreement 2024.pdf',
      type: 'application/pdf',
      size: 2048576,
      uploadDate: '2024-01-15',
      category: 'contract',
      status: 'ready'
    },
    {
      id: '2', 
      name: 'HVAC System Manual.pdf',
      type: 'application/pdf',
      size: 5242880,
      uploadDate: '2024-01-10',
      category: 'manual',
      status: 'ready'
    },
    {
      id: '3',
      name: 'Maintenance Report June 2024.pdf',
      type: 'application/pdf', 
      size: 1048576,
      uploadDate: '2024-06-30',
      category: 'report',
      status: 'ready'
    }
  ])

  const [filter, setFilter] = useState<string>('all')
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({})
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null)

  const categories = [
    { id: 'all', label: 'All Documents', count: documents.length },
    { id: 'contract', label: 'Contracts', count: documents.filter(d => d.category === 'contract').length },
    { id: 'estimate', label: 'Estimates', count: documents.filter(d => d.category === 'estimate').length },
    { id: 'invoice', label: 'Invoices', count: documents.filter(d => d.category === 'invoice').length },
    { id: 'warranty', label: 'Warranties', count: documents.filter(d => d.category === 'warranty').length },
    { id: 'manual', label: 'Manuals', count: documents.filter(d => d.category === 'manual').length },
    { id: 'report', label: 'Reports', count: documents.filter(d => d.category === 'report').length },
    { id: 'other', label: 'Other', count: documents.filter(d => d.category === 'other').length }
  ]

  const filteredDocuments = filter === 'all' 
    ? documents 
    : documents.filter(doc => doc.category === filter)

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getCategoryIcon = (category: string): string => {
    switch (category) {
      case 'contract': return 'ki-handshake'
      case 'estimate': return 'ki-calculator'
      case 'invoice': return 'ki-bill'
      case 'warranty': return 'ki-shield-tick'
      case 'manual': return 'ki-book-open'
      case 'report': return 'ki-chart-line-up'
      default: return 'ki-document'
    }
  }

  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'contract': return 'primary'
      case 'estimate': return 'info'
      case 'invoice': return 'warning'
      case 'warranty': return 'success'
      case 'manual': return 'secondary'
      case 'report': return 'danger'
      default: return 'dark'
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    Array.from(files).forEach((file) => {
      const newDoc: Document = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: file.name,
        type: file.type,
        size: file.size,
        uploadDate: new Date().toISOString().split('T')[0],
        category: 'other',
        status: 'processing'
      }

      setDocuments(prev => [...prev, newDoc])
      
      // Simulate upload progress
      let progress = 0
      const interval = setInterval(() => {
        progress += Math.random() * 20
        if (progress >= 100) {
          progress = 100
          clearInterval(interval)
          setDocuments(prev => 
            prev.map(doc => 
              doc.id === newDoc.id 
                ? { ...doc, status: 'ready' }
                : doc
            )
          )
          setUploadProgress(prev => {
            const { [newDoc.id]: removed, ...rest } = prev
            return rest
          })
        }
        setUploadProgress(prev => ({ ...prev, [newDoc.id]: Math.round(progress) }))
      }, 200)
    })
  }

  const handlePreview = (document: Document) => {
    setPreviewDocument(document)
  }

  const handleDownload = (document: Document) => {
    // In real app, this would download from the actual URL
    alert(`Downloading ${document.name}`)
  }

  return (
    <div className="card shadow-sm">
      <div className="card-header border-0 pt-6">
        <div className="card-title">
          <div className="d-flex align-items-center">
            <i className="ki-duotone ki-folder fs-2 text-primary me-3">
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
            <div>
              <h3 className="fw-bold text-gray-900 mb-1">Document Vault</h3>
              <div className="text-muted fs-7">Upload, organize, and access your documents</div>
            </div>
          </div>
        </div>
        <div className="card-toolbar">
          <label className="btn btn-primary btn-sm">
            <i className="ki-duotone ki-plus fs-6 me-2">
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
            Upload Documents
            <input 
              type="file" 
              className="d-none"
              multiple
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={handleFileUpload}
            />
          </label>
        </div>
      </div>

      <div className="card-body pt-0">
        {/* Category Filters */}
        <div className="mb-6">
          <div className="d-flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category.id}
                className={`btn btn-sm ${
                  filter === category.id 
                    ? 'btn-primary' 
                    : 'btn-light-primary'
                }`}
                onClick={() => setFilter(category.id)}
              >
                {category.label}
                {category.count > 0 && (
                  <span className="badge badge-sm badge-circle badge-white text-primary ms-2">
                    {category.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Documents List */}
        <div className="row g-3">
          {filteredDocuments.map((document) => (
            <div key={document.id} className="col-12">
              <div className="card border">
                <div className="card-body p-4">
                  <div className="d-flex align-items-center">
                    {/* Document Icon */}
                    <div className={`symbol symbol-50px me-3`}>
                      <div className={`symbol-label bg-light-${getCategoryColor(document.category)}`}>
                        <i className={`ki-duotone ${getCategoryIcon(document.category)} fs-2 text-${getCategoryColor(document.category)}`}>
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                      </div>
                    </div>

                    {/* Document Info */}
                    <div className="flex-grow-1">
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <h6 className="fw-bold text-gray-900 mb-1">{document.name}</h6>
                          <div className="d-flex align-items-center gap-3 text-muted fs-7">
                            <span>
                              <i className="ki-duotone ki-file fs-6 me-1">
                                <span className="path1"></span>
                                <span className="path2"></span>
                              </i>
                              {formatFileSize(document.size)}
                            </span>
                            <span>
                              <i className="ki-duotone ki-calendar fs-6 me-1">
                                <span className="path1"></span>
                                <span className="path2"></span>
                              </i>
                              {new Date(document.uploadDate).toLocaleDateString()}
                            </span>
                            <span className={`badge badge-light-${getCategoryColor(document.category)} text-${getCategoryColor(document.category)}`}>
                              {document.category.charAt(0).toUpperCase() + document.category.slice(1)}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="d-flex gap-1">
                          {document.status === 'processing' ? (
                            <div className="d-flex align-items-center">
                              <div className="spinner-border spinner-border-sm text-primary me-2" role="status">
                                <span className="visually-hidden">Processing...</span>
                              </div>
                              <span className="text-muted fs-7">
                                {uploadProgress[document.id] || 0}%
                              </span>
                            </div>
                          ) : (
                            <>
                              <button 
                                className="btn btn-sm btn-icon btn-light-primary"
                                onClick={() => handlePreview(document)}
                                title="Preview"
                              >
                                <i className="ki-duotone ki-eye fs-6">
                                  <span className="path1"></span>
                                  <span className="path2"></span>
                                  <span className="path3"></span>
                                </i>
                              </button>
                              <button 
                                className="btn btn-sm btn-icon btn-light-success"
                                onClick={() => handleDownload(document)}
                                title="Download"
                              >
                                <i className="ki-duotone ki-down fs-6">
                                  <span className="path1"></span>
                                  <span className="path2"></span>
                                </i>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredDocuments.length === 0 && (
          <div className="text-center py-10">
            <i className="ki-duotone ki-folder-down fs-5x text-gray-400 mb-4">
              <span className="path1"></span>
              <span className="path2"></span>
              <span className="path3"></span>
            </i>
            <h5 className="text-gray-600 fw-bold mb-2">No Documents Found</h5>
            <p className="text-muted">
              {filter === 'all' 
                ? 'Upload your first document to get started' 
                : `No ${filter} documents found`
              }
            </p>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewDocument && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-xl">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{previewDocument.name}</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setPreviewDocument(null)}
                ></button>
              </div>
              <div className="modal-body p-0" style={{ height: '70vh' }}>
                {previewDocument.type === 'application/pdf' ? (
                  <div className="h-100 d-flex align-items-center justify-content-center bg-light">
                    <div className="text-center">
                      <i className="ki-duotone ki-file-down fs-5x text-primary mb-4">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <h5 className="text-gray-900 fw-bold mb-2">PDF Preview</h5>
                      <p className="text-muted mb-4">
                        PDF preview will be available here in the full implementation
                      </p>
                      <button 
                        className="btn btn-primary"
                        onClick={() => handleDownload(previewDocument)}
                      >
                        Download to View
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="h-100 d-flex align-items-center justify-content-center bg-light">
                    <div className="text-center">
                      <i className="ki-duotone ki-file-down fs-5x text-secondary mb-4">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <h5 className="text-gray-900 fw-bold mb-2">Document Preview</h5>
                      <p className="text-muted">
                        Preview not available for this file type
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-light" 
                  onClick={() => setPreviewDocument(null)}
                >
                  Close
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={() => handleDownload(previewDocument)}
                >
                  <i className="ki-duotone ki-down fs-6 me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DocumentVault