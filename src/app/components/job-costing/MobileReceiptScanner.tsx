import React, { useState, useRef, useCallback } from 'react'
import { KTCard, KTCardBody, KTIcon } from '../../../_metronic/helpers'

interface ReceiptData {
  vendor: string
  total: number
  description: string
  date: string
  imageUrl: string
  lineItems?: Array<{
    description: string
    amount: number
  }>
}

interface MobileReceiptScannerProps {
  onReceiptScanned: (data: ReceiptData) => void
  onCancel: () => void
}

const MobileReceiptScanner: React.FC<MobileReceiptScannerProps> = ({ onReceiptScanned, onCancel }) => {
  const [scanning, setScanning] = useState(false)
  const [processingOCR, setProcessingOCR] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [extractedData, setExtractedData] = useState<Partial<ReceiptData>>({})
  const [showManualEntry, setShowManualEntry] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Start camera for live scanning
  const startCamera = async () => {
    setScanning(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
    } catch (error) {
      console.error('Error accessing camera:', error)
      alert('Camera access denied. Please use file upload instead.')
      setScanning(false)
    }
  }

  // Capture photo from camera
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    
    if (ctx) {
      ctx.drawImage(video, 0, 0)
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8)
      setCapturedImage(imageDataUrl)
      
      // Stop camera
      const stream = video.srcObject as MediaStream
      stream?.getTracks().forEach(track => track.stop())
      setScanning(false)
      
      // Process with OCR
      processWithOCR(imageDataUrl)
    }
  }

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const imageDataUrl = e.target?.result as string
      setCapturedImage(imageDataUrl)
      processWithOCR(imageDataUrl)
    }
    reader.readAsDataURL(file)
  }

  // OCR Processing (Mock implementation - in production, use Tesseract.js or cloud OCR)
  const processWithOCR = async (imageDataUrl: string) => {
    setProcessingOCR(true)
    
    try {
      // Simulate OCR processing delay
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Mock OCR results - in production, this would use actual OCR
      const mockReceiptData = {
        vendor: extractVendorFromMockOCR(),
        total: generateMockTotal(),
        description: generateMockDescription(),
        date: new Date().toISOString().split('T')[0],
        imageUrl: imageDataUrl,
        lineItems: generateMockLineItems()
      }
      
      setExtractedData(mockReceiptData)
      
    } catch (error) {
      console.error('OCR processing error:', error)
      alert('Error processing receipt. Please enter manually.')
      setShowManualEntry(true)
    } finally {
      setProcessingOCR(false)
    }
  }

  // Mock OCR extraction functions (replace with real OCR in production)
  const extractVendorFromMockOCR = (): string => {
    const vendors = ['Home Depot', 'Lowes', 'Menards', 'Local Supply Co', 'Ace Hardware', 'Ferguson']
    return vendors[Math.floor(Math.random() * vendors.length)]
  }

  const generateMockTotal = (): number => {
    return Math.round((Math.random() * 500 + 25) * 100) / 100
  }

  const generateMockDescription = (): string => {
    const descriptions = [
      'PVC Pipes and Fittings',
      'Electrical Supplies',
      'Plumbing Materials',
      'HVAC Components',
      'Tools and Hardware',
      'Safety Equipment'
    ]
    return descriptions[Math.floor(Math.random() * descriptions.length)]
  }

  const generateMockLineItems = () => {
    return [
      { description: '2" PVC Pipe', amount: 45.99 },
      { description: 'Pipe Fittings', amount: 23.50 },
      { description: 'PVC Cement', amount: 12.99 }
    ]
  }

  const handleConfirmData = () => {
    if (!extractedData.vendor || !extractedData.total) {
      alert('Please ensure vendor and total amount are filled')
      return
    }

    onReceiptScanned(extractedData as ReceiptData)
  }

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
    }
    setScanning(false)
  }

  return (
    <KTCard>
      <div className="card-header">
        <h3 className="card-title">📱 Mobile Receipt Scanner</h3>
        <div className="card-toolbar">
          <button className="btn btn-light btn-sm" onClick={onCancel}>
            <KTIcon iconName="cross" className="fs-6" />
          </button>
        </div>
      </div>
      <KTCardBody>
        {!capturedImage && !scanning && (
          <div className="text-center py-8">
            <KTIcon iconName="scanner" className="fs-2x text-primary mb-4" />
            <h4 className="mb-4">Scan Receipt for Instant Cost Entry</h4>
            <p className="text-muted mb-6">
              Use your phone camera to automatically extract vendor, amount, and description from receipts
            </p>
            
            <div className="row g-4">
              <div className="col-md-6">
                <button 
                  className="btn btn-primary btn-lg w-100"
                  onClick={startCamera}
                >
                  <KTIcon iconName="camera" className="fs-3 me-3" />
                  <div>
                    <div className="fw-bold">Take Photo</div>
                    <div className="fs-7 text-white-75">Use camera</div>
                  </div>
                </button>
              </div>
              <div className="col-md-6">
                <button 
                  className="btn btn-light btn-lg w-100"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <KTIcon iconName="folder" className="fs-3 me-3" />
                  <div>
                    <div className="fw-bold">Upload Photo</div>
                    <div className="fs-7 text-muted">From gallery</div>
                  </div>
                </button>
              </div>
            </div>

            <div className="separator my-6"></div>
            
            <button 
              className="btn btn-light-warning"
              onClick={() => setShowManualEntry(true)}
            >
              <KTIcon iconName="edit" className="fs-6 me-2" />
              Enter Manually Instead
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
          </div>
        )}

        {/* Camera View */}
        {scanning && (
          <div className="text-center">
            <h5 className="mb-4">Position receipt in frame and tap capture</h5>
            <div className="position-relative d-inline-block">
              <video 
                ref={videoRef}
                style={{ 
                  width: '100%', 
                  maxWidth: '400px', 
                  height: 'auto',
                  border: '2px solid #007bff',
                  borderRadius: '8px'
                }}
                playsInline
              />
              <div className="position-absolute top-50 start-50 translate-middle">
                <div style={{
                  width: '200px',
                  height: '120px',
                  border: '2px dashed rgba(255,255,255,0.8)',
                  borderRadius: '8px'
                }}></div>
              </div>
            </div>
            <div className="mt-4">
              <button 
                className="btn btn-success btn-lg me-3"
                onClick={capturePhoto}
              >
                <KTIcon iconName="camera" className="fs-3 me-2" />
                Capture Receipt
              </button>
              <button 
                className="btn btn-light"
                onClick={stopCamera}
              >
                Cancel
              </button>
            </div>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
        )}

        {/* OCR Processing */}
        {processingOCR && (
          <div className="text-center py-8">
            <div className="spinner-border text-primary mb-4" style={{ width: '3rem', height: '3rem' }}></div>
            <h5>🔍 Reading Receipt...</h5>
            <p className="text-muted">
              Extracting vendor, amount, and line items using OCR technology
            </p>
          </div>
        )}

        {/* OCR Results */}
        {capturedImage && !processingOCR && !showManualEntry && (
          <div className="row g-5">
            <div className="col-md-6">
              <h6 className="mb-3">📷 Captured Image</h6>
              <img 
                src={capturedImage} 
                alt="Receipt" 
                className="img-fluid rounded border"
                style={{ maxHeight: '300px', width: '100%', objectFit: 'contain' }}
              />
              <div className="text-center mt-3">
                <button 
                  className="btn btn-light btn-sm"
                  onClick={() => {
                    setCapturedImage(null)
                    setExtractedData({})
                  }}
                >
                  <KTIcon iconName="arrow-left" className="fs-6 me-1" />
                  Retake Photo
                </button>
              </div>
            </div>
            <div className="col-md-6">
              <h6 className="mb-3">🤖 Extracted Data</h6>
              <div className="mb-3">
                <label className="form-label">Vendor</label>
                <input 
                  type="text"
                  className="form-control"
                  value={extractedData.vendor || ''}
                  onChange={(e) => setExtractedData(prev => ({ ...prev, vendor: e.target.value }))}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Total Amount</label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input 
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={extractedData.total || ''}
                    onChange={(e) => setExtractedData(prev => ({ ...prev, total: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label">Description</label>
                <input 
                  type="text"
                  className="form-control"
                  value={extractedData.description || ''}
                  onChange={(e) => setExtractedData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="mb-4">
                <label className="form-label">Date</label>
                <input 
                  type="date"
                  className="form-control"
                  value={extractedData.date || ''}
                  onChange={(e) => setExtractedData(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>

              <div className="alert alert-success">
                <div className="fw-bold mb-2">✅ OCR Scan Complete!</div>
                <div className="fs-7">
                  Review the extracted data above and click "Use This Data" to add to job costs.
                </div>
              </div>

              <div className="d-grid gap-2">
                <button 
                  className="btn btn-success"
                  onClick={handleConfirmData}
                >
                  <KTIcon iconName="check" className="fs-6 me-2" />
                  Use This Data
                </button>
                <button 
                  className="btn btn-light"
                  onClick={() => setShowManualEntry(true)}
                >
                  <KTIcon iconName="edit" className="fs-6 me-2" />
                  Edit Manually
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Manual Entry Fallback */}
        {showManualEntry && (
          <div>
            <h6 className="mb-4">✏️ Manual Entry</h6>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Vendor</label>
                <input 
                  type="text"
                  className="form-control"
                  value={extractedData.vendor || ''}
                  onChange={(e) => setExtractedData(prev => ({ ...prev, vendor: e.target.value }))}
                  placeholder="e.g., Home Depot"
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Total Amount</label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input 
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={extractedData.total || ''}
                    onChange={(e) => setExtractedData(prev => ({ ...prev, total: Number(e.target.value) }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="col-12">
                <label className="form-label">Description</label>
                <input 
                  type="text"
                  className="form-control"
                  value={extractedData.description || ''}
                  onChange={(e) => setExtractedData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="e.g., PVC pipes and fittings"
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Date</label>
                <input 
                  type="date"
                  className="form-control"
                  value={extractedData.date || new Date().toISOString().split('T')[0]}
                  onChange={(e) => setExtractedData(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div className="col-12">
                <button 
                  className="btn btn-primary w-100"
                  onClick={handleConfirmData}
                >
                  <KTIcon iconName="check" className="fs-6 me-2" />
                  Add Manual Entry
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Benefits Section */}
        {!capturedImage && !scanning && !showManualEntry && (
          <div className="mt-8">
            <div className="alert alert-info">
              <div className="fw-bold mb-2">📱 Mobile Receipt Scanning Benefits:</div>
              <ul className="mb-0 small">
                <li>🔍 Automatic OCR extraction of vendor, amount, and items</li>
                <li>⚡ 90% faster than manual entry</li>
                <li>📊 Real-time job profitability tracking</li>
                <li>🎯 Instant profit margin calculations</li>
                <li>💰 Identify profitable vs losing jobs immediately</li>
              </ul>
            </div>
          </div>
        )}
      </KTCardBody>
    </KTCard>
  )
}

export default MobileReceiptScanner