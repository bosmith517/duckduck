import React, { useState, useEffect, useRef } from 'react'
import { useSupabaseAuth } from '../../../modules/auth/core/SupabaseAuth'
import { supabase } from '../../../../supabaseClient'
import { showToast } from '../../../utils/toast'
import { KTIcon } from '../../../../_metronic/helpers'
import { DocumentAutofill } from './DocumentAutofill'

interface BusinessDocument {
  id: string
  tenant_id: string
  uploaded_by: string
  file_name: string
  file_path: string
  file_url: string
  file_size: number
  file_type: string
  document_type: string
  description?: string
  created_at: string
  updated_at: string
}

const DOCUMENT_TYPES = [
  { value: 'license', label: 'Business License', icon: 'document' },
  { value: 'insurance', label: 'Insurance Certificate', icon: 'shield-check' },
  { value: 'contract', label: 'Contract Template', icon: 'handshake' },
  { value: 'policy', label: 'Company Policy', icon: 'book' },
  { value: 'certification', label: 'Certification', icon: 'award' },
  { value: 'tax', label: 'Tax Document', icon: 'calculator' },
  { value: 'permit', label: 'Permit', icon: 'verify' },
  { value: 'other', label: 'Other', icon: 'folder' }
]

export function Documents() {
  const { userProfile, tenant } = useSupabaseAuth()
  const [documents, setDocuments] = useState<BusinessDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedType, setSelectedType] = useState('other')
  const [description, setDescription] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [autofillDocument, setAutofillDocument] = useState<BusinessDocument | null>(null)

  useEffect(() => {
    if (userProfile?.tenant_id) {
      loadDocuments()
    }
  }, [userProfile?.tenant_id])

  const loadDocuments = async () => {
    if (!userProfile?.tenant_id) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('business_documents')
        .select(`
          *,
          uploaded_by_profile:user_profiles(first_name, last_name)
        `)
        .eq('tenant_id', userProfile.tenant_id)
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

        const fileExt = file.name.split('.').pop()
        const fileName = `${userProfile?.tenant_id}/documents/${Date.now()}_${file.name}`

        // Upload to Supabase storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('business-documents')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          })

        if (uploadError) throw uploadError

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('business-documents')
          .getPublicUrl(fileName)

        // Save document record
        const { error: saveError } = await supabase
          .from('business_documents')
          .insert({
            tenant_id: userProfile?.tenant_id,
            uploaded_by: userProfile?.id,
            file_name: file.name,
            file_path: fileName,
            file_url: publicUrl,
            file_size: file.size,
            file_type: file.type,
            document_type: selectedType,
            description: description || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })

        if (saveError) throw saveError
      }

      showToast.dismiss(loadingToast)
      showToast.success(`${files.length} document(s) uploaded successfully!`)
      
      // Reset form and reload documents
      setDescription('')
      setSelectedType('other')
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

  const handleDeleteDocument = async (document: BusinessDocument) => {
    if (!confirm(`Are you sure you want to delete "${document.file_name}"?`)) {
      return
    }

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('business-documents')
        .remove([document.file_path])

      if (storageError) throw storageError

      // Delete from database
      const { error: dbError } = await supabase
        .from('business_documents')
        .delete()
        .eq('id', document.id)

      if (dbError) throw dbError

      showToast.success('Document deleted successfully')
      await loadDocuments()

    } catch (error: any) {
      console.error('Error deleting document:', error)
      showToast.error(error.message || 'Failed to delete document')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getDocumentIcon = (type: string) => {
    const docType = DOCUMENT_TYPES.find(dt => dt.value === type)
    return docType?.icon || 'folder'
  }

  const getDocumentTypeLabel = (type: string) => {
    const docType = DOCUMENT_TYPES.find(dt => dt.value === type)
    return docType?.label || 'Document'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  return (
    <div className='card'>
      <div className='card-header border-0 cursor-pointer'>
        <div className='card-title m-0'>
          <h3 className='fw-bolder m-0'>Business Documents</h3>
        </div>
        <div className='card-toolbar'>
          <button
            type='button'
            className='btn btn-primary'
            onClick={handleFileSelect}
            disabled={uploading}
          >
            <KTIcon iconName='plus' className='fs-2' />
            Upload Document
          </button>
        </div>
      </div>

      <div className='card-body border-top p-9'>
        {/* Upload Configuration */}
        <div className='row mb-8'>
          <div className='col-lg-6'>
            <label className='fw-bold fs-6 mb-2'>Document Type</label>
            <select
              className='form-select form-select-solid'
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              {DOCUMENT_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className='col-lg-6'>
            <label className='fw-bold fs-6 mb-2'>Description (Optional)</label>
            <input
              type='text'
              className='form-control form-control-solid'
              placeholder='Brief description of the document'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        {/* Upload Area */}
        <div 
          className='dropzone border border-dashed border-gray-300 rounded p-9 mb-9 text-center cursor-pointer'
          onClick={handleFileSelect}
          style={{ backgroundColor: '#f8f9fa' }}
        >
          <div className='d-flex flex-column align-items-center'>
            <KTIcon iconName='file-up' className='fs-3x text-primary mb-4' />
            <div className='fs-5 fw-bolder text-dark mb-2'>
              Drop files here or click to upload
            </div>
            <div className='fs-7 fw-bold text-gray-500'>
              Upload business documents (PDF, DOC, XLS, Images)
            </div>
            <div className='fs-8 fw-bold text-gray-400 mt-2'>
              Maximum file size: 10MB
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type='file'
          multiple
          accept='.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif'
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />

        {/* Documents List */}
        {loading ? (
          <div className='d-flex justify-content-center py-10'>
            <div className='spinner-border text-primary' role='status'>
              <span className='visually-hidden'>Loading...</span>
            </div>
          </div>
        ) : documents.length === 0 ? (
          <div className='text-center py-10'>
            <KTIcon iconName='folder' className='fs-3x text-gray-400 mb-4' />
            <h4 className='fw-bolder text-gray-700'>No Documents Yet</h4>
            <p className='text-gray-500'>Upload your first business document to get started.</p>
          </div>
        ) : (
          <div className='table-responsive'>
            <table className='table table-flush align-middle table-row-bordered table-row-solid gy-4 gs-9'>
              <thead className='border-gray-200 fs-5 fw-bold bg-lighten'>
                <tr>
                  <th className='min-w-175px ps-9'>Document</th>
                  <th className='min-w-100px'>Type</th>
                  <th className='min-w-100px'>Size</th>
                  <th className='min-w-125px'>Uploaded</th>
                  <th className='min-w-100px'>Uploaded By</th>
                  <th className='min-w-75px text-end'>Actions</th>
                </tr>
              </thead>
              <tbody className='fw-bold text-gray-600 fs-6'>
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td className='ps-9'>
                      <div className='d-flex align-items-center'>
                        <div className='symbol symbol-45px me-5'>
                          <span className='symbol-label bg-light-primary text-primary fw-bold'>
                            <KTIcon iconName={getDocumentIcon(doc.document_type)} className='fs-2x' />
                          </span>
                        </div>
                        <div className='d-flex flex-column'>
                          <span className='text-gray-800 fw-bolder text-hover-primary mb-1'>
                            {doc.file_name}
                          </span>
                          {doc.description && (
                            <span className='text-muted fw-bold d-block fs-7'>
                              {doc.description}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className='badge badge-light-primary fw-bolder'>
                        {getDocumentTypeLabel(doc.document_type)}
                      </span>
                    </td>
                    <td>
                      <span className='text-gray-600 fw-bolder d-block fs-6'>
                        {formatFileSize(doc.file_size)}
                      </span>
                    </td>
                    <td>
                      <span className='text-gray-600 fw-bolder d-block fs-6'>
                        {formatDate(doc.created_at)}
                      </span>
                    </td>
                    <td>
                      <span className='text-gray-600 fw-bolder d-block fs-6'>
                        {(doc as any).uploaded_by_profile?.first_name} {(doc as any).uploaded_by_profile?.last_name}
                      </span>
                    </td>
                    <td className='text-end'>
                      <div className='d-flex justify-content-end'>
                        <button
                          type='button'
                          className='btn btn-sm btn-light-primary me-2'
                          onClick={async () => {
                            const { data, error } = await supabase.storage
                              .from('business-documents')
                              .createSignedUrl(doc.file_path, 60)
                            
                            if (error) {
                              showToast.error('Failed to access document')
                              return
                            }
                            
                            window.open(data.signedUrl, '_blank')
                          }}
                          title='View Document'
                        >
                          <KTIcon iconName='eye' className='fs-5' />
                        </button>
                        {(doc.file_type === 'application/pdf' || 
                          doc.file_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                          doc.file_type === 'application/msword') && (
                          <button
                            type='button'
                            className='btn btn-sm btn-light-success me-2'
                            onClick={() => setAutofillDocument(doc)}
                            title='AI Autofill'
                          >
                            <KTIcon iconName='scan-barcode' className='fs-5' />
                          </button>
                        )}
                        <button
                          type='button'
                          className='btn btn-sm btn-light-danger'
                          onClick={() => handleDeleteDocument(doc)}
                          title='Delete Document'
                        >
                          <KTIcon iconName='trash' className='fs-5' />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Document Autofill Modal */}
      {autofillDocument && (
        <DocumentAutofill
          documentId={autofillDocument.id}
          documentName={autofillDocument.file_name}
          documentPath={autofillDocument.file_path}
          onClose={() => setAutofillDocument(null)}
          onComplete={() => {
            setAutofillDocument(null)
            loadDocuments()
          }}
        />
      )}
    </div>
  )
}