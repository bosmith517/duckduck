import React, { useState } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'
import PhotoCaptureEnhanced from '../../components/shared/PhotoCaptureEnhanced'
import { showToast } from '../../utils/toast'

const MultiPhotoTestPage: React.FC = () => {
  const [showPhotoCapture, setShowPhotoCapture] = useState(false)
  const [uploadedPhotos, setUploadedPhotos] = useState<{ url: string; id: string }[]>([])
  const [photoType, setPhotoType] = useState<'receipt' | 'job_progress' | 'before' | 'after' | 'general'>('general')

  const handlePhotosSaved = (photos: { url: string; id: string }[]) => {
    setUploadedPhotos(prev => [...prev, ...photos])
    showToast.success(`${photos.length} photos uploaded successfully!`)
  }

  const clearPhotos = () => {
    setUploadedPhotos([])
    showToast.info('Photo gallery cleared')
  }

  return (
    <>
      <PageTitle breadcrumbs={[]}>Multi-Photo Capture Test</PageTitle>

      <div className="row g-5">
        <div className="col-12">
          <KTCard>
            <div className="card-header">
              <h3 className="card-title">Multi-Photo Batch Upload Demo</h3>
              <div className="card-toolbar">
                <button
                  className="btn btn-sm btn-light-danger"
                  onClick={clearPhotos}
                  disabled={uploadedPhotos.length === 0}
                >
                  Clear All Photos
                </button>
              </div>
            </div>
            <KTCardBody>
              <div className="mb-6">
                <h5 className="mb-4">Features Demonstrated:</h5>
                <div className="row">
                  <div className="col-md-6">
                    <ul className="list-unstyled">
                      <li className="mb-2">
                        <i className="ki-duotone ki-check-circle fs-5 text-success me-2">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        Continuous camera capture mode
                      </li>
                      <li className="mb-2">
                        <i className="ki-duotone ki-check-circle fs-5 text-success me-2">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        Multiple file selection from gallery
                      </li>
                      <li className="mb-2">
                        <i className="ki-duotone ki-check-circle fs-5 text-success me-2">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        Drag & drop support (desktop)
                      </li>
                      <li className="mb-2">
                        <i className="ki-duotone ki-check-circle fs-5 text-success me-2">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        Batch upload with progress tracking
                      </li>
                    </ul>
                  </div>
                  <div className="col-md-6">
                    <ul className="list-unstyled">
                      <li className="mb-2">
                        <i className="ki-duotone ki-check-circle fs-5 text-success me-2">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        Individual photo descriptions
                      </li>
                      <li className="mb-2">
                        <i className="ki-duotone ki-check-circle fs-5 text-success me-2">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        GPS location tagging
                      </li>
                      <li className="mb-2">
                        <i className="ki-duotone ki-check-circle fs-5 text-success me-2">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        Photo selection/deselection
                      </li>
                      <li className="mb-2">
                        <i className="ki-duotone ki-check-circle fs-5 text-success me-2">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        Preview before upload
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="separator separator-dashed my-6"></div>

              <div className="mb-4">
                <label className="form-label">Photo Type</label>
                <select
                  className="form-select"
                  value={photoType}
                  onChange={(e) => setPhotoType(e.target.value as any)}
                >
                  <option value="general">General</option>
                  <option value="before">Before</option>
                  <option value="after">After</option>
                  <option value="job_progress">Job Progress</option>
                  <option value="receipt">Receipt</option>
                </select>
              </div>

              <button
                className="btn btn-primary"
                onClick={() => setShowPhotoCapture(true)}
              >
                <i className="ki-duotone ki-camera fs-2 me-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                Open Multi-Photo Capture
              </button>
            </KTCardBody>
          </KTCard>
        </div>

        {uploadedPhotos.length > 0 && (
          <div className="col-12">
            <KTCard>
              <div className="card-header">
                <h3 className="card-title">Uploaded Photos ({uploadedPhotos.length})</h3>
              </div>
              <KTCardBody>
                <div className="row g-3">
                  {uploadedPhotos.map((photo, index) => (
                    <div key={photo.id} className="col-6 col-md-4 col-lg-3">
                      <div className="card">
                        <img
                          src={photo.url}
                          alt={`Uploaded ${index + 1}`}
                          className="card-img-top"
                          style={{ height: '200px', objectFit: 'cover' }}
                        />
                        <div className="card-body p-2">
                          <small className="text-muted">ID: {photo.id.slice(0, 8)}...</small>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </KTCardBody>
            </KTCard>
          </div>
        )}

        <div className="col-12">
          <KTCard>
            <div className="card-header">
              <h3 className="card-title">Testing Instructions</h3>
            </div>
            <KTCardBody>
              <h5>Mobile Testing:</h5>
              <ol>
                <li>Tap "Open Multi-Photo Capture"</li>
                <li>Choose "Take Photos" to use camera</li>
                <li>Take multiple photos - they'll be queued automatically</li>
                <li>Or choose "Gallery" to select multiple photos at once</li>
                <li>Add descriptions to individual photos if desired</li>
                <li>Tap "Upload X Photos" to batch upload</li>
              </ol>

              <h5 className="mt-4">Desktop Testing:</h5>
              <ol>
                <li>Click "Open Multi-Photo Capture"</li>
                <li>Drag and drop multiple images onto the drop zone</li>
                <li>Or click "Choose from Gallery" and select multiple files</li>
                <li>Use the camera option to capture from webcam</li>
                <li>Select/deselect photos using checkboxes</li>
                <li>Click "Upload X Photos" to batch upload</li>
              </ol>

              <div className="alert alert-info mt-4">
                <i className="ki-duotone ki-information fs-2 me-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                  <span className="path3"></span>
                </i>
                <strong>Note:</strong> Maximum file size is 10MB per photo. Supported formats: JPEG, PNG, GIF, WebP, HEIC/HEIF
              </div>
            </KTCardBody>
          </KTCard>
        </div>
      </div>

      {/* Multi-Photo Capture Modal */}
      <PhotoCaptureEnhanced
        isOpen={showPhotoCapture}
        onClose={() => setShowPhotoCapture(false)}
        onPhotosSaved={handlePhotosSaved}
        photoType={photoType}
        title="Multi-Photo Upload Test"
        maxPhotos={20}
      />
    </>
  )
}

export default MultiPhotoTestPage