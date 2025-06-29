import React, { useState, useRef } from 'react'
import { supabase } from '../../../supabaseClient'

interface EquipmentPhotoUploadProps {
  customerId: string
  onEquipmentAdded: (equipmentData: any) => void
}

interface AIDetection {
  equipmentType: string
  brand?: string
  model?: string
  confidence: number
  questions: AIQuestion[]
}

interface AIQuestion {
  id: string
  question: string
  type: 'text' | 'select' | 'number' | 'date'
  options?: string[]
  required: boolean
  field: string
}

interface EquipmentData {
  name: string
  equipment_type: string
  brand?: string
  model?: string
  serial_number?: string
  install_date?: string
  location?: string
  notes?: string
  warranty_expiration?: string
}

const EquipmentPhotoUpload: React.FC<EquipmentPhotoUploadProps> = ({
  customerId,
  onEquipmentAdded
}) => {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [aiDetection, setAiDetection] = useState<AIDetection | null>(null)
  const [equipmentData, setEquipmentData] = useState<EquipmentData>({
    name: '',
    equipment_type: '',
    location: ''
  })
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (file: File) => {
    try {
      setIsAnalyzing(true)
      
      // Create preview URL
      const previewUrl = URL.createObjectURL(file)
      setUploadedImage(previewUrl)

      // Upload to Supabase Storage
      const fileName = `equipment-photos/${customerId}/${Date.now()}-${file.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('equipment-photos')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('equipment-photos')
        .getPublicUrl(fileName)

      // Simulate AI analysis (in real implementation, would call OpenAI Vision API or similar)
      await simulateAIAnalysis(publicUrl, file)
      
    } catch (error) {
      console.error('Error uploading file:', error)
      alert('Error uploading photo. Please try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const simulateAIAnalysis = async (imageUrl: string, file: File) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Mock AI detection results based on common equipment types
    const mockDetections: AIDetection[] = [
      {
        equipmentType: 'hvac',
        brand: 'Trane',
        model: 'XR16',
        confidence: 92,
        questions: [
          {
            id: 'install_date',
            question: 'When was this HVAC system installed?',
            type: 'date',
            required: false,
            field: 'install_date'
          },
          {
            id: 'location',
            question: 'Where is this unit located?',
            type: 'select',
            options: ['Exterior - Front', 'Exterior - Back', 'Exterior - Side', 'Attic', 'Basement', 'Garage', 'Mechanical Room'],
            required: true,
            field: 'location'
          },
          {
            id: 'serial_number',
            question: 'Can you see the serial number on a label? (Optional)',
            type: 'text',
            required: false,
            field: 'serial_number'
          },
          {
            id: 'issues',
            question: 'Are you experiencing any issues with this equipment?',
            type: 'text',
            required: false,
            field: 'notes'
          }
        ]
      },
      {
        equipmentType: 'plumbing',
        brand: 'Rheem',
        model: 'Marathon',
        confidence: 88,
        questions: [
          {
            id: 'capacity',
            question: 'What is the capacity of this water heater (gallons)?',
            type: 'select',
            options: ['30', '40', '50', '75', '80', '100'],
            required: false,
            field: 'model'
          },
          {
            id: 'fuel_type',
            question: 'What type of fuel does this use?',
            type: 'select',
            options: ['Electric', 'Natural Gas', 'Propane', 'Oil'],
            required: true,
            field: 'notes'
          },
          {
            id: 'location',
            question: 'Where is this water heater located?',
            type: 'select',
            options: ['Garage', 'Basement', 'Utility Room', 'Attic', 'Closet', 'Outside'],
            required: true,
            field: 'location'
          }
        ]
      },
      {
        equipmentType: 'electrical',
        confidence: 85,
        questions: [
          {
            id: 'panel_size',
            question: 'What is the amperage of this electrical panel?',
            type: 'select',
            options: ['100A', '150A', '200A', '400A', 'Not sure'],
            required: false,
            field: 'model'
          },
          {
            id: 'location',
            question: 'Where is this panel located?',
            type: 'select',
            options: ['Garage', 'Basement', 'Utility Room', 'Outside', 'Closet'],
            required: true,
            field: 'location'
          }
        ]
      }
    ]

    // Randomly select a detection result for demo
    const detection = mockDetections[Math.floor(Math.random() * mockDetections.length)]
    setAiDetection(detection)
    
    // Set initial equipment data
    setEquipmentData({
      name: `${detection.brand ? detection.brand + ' ' : ''}${detection.equipmentType.charAt(0).toUpperCase() + detection.equipmentType.slice(1)} System`,
      equipment_type: detection.equipmentType,
      brand: detection.brand,
      model: detection.model,
      location: ''
    })
  }

  const handleQuestionAnswer = (questionId: string, answer: string) => {
    const question = aiDetection?.questions.find(q => q.id === questionId)
    if (question) {
      setEquipmentData(prev => ({
        ...prev,
        [question.field]: question.field === 'notes' && prev.notes 
          ? `${prev.notes}\n${question.question}: ${answer}`
          : answer
      }))
    }
  }

  const nextQuestion = () => {
    if (aiDetection && currentQuestionIndex < aiDetection.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    } else {
      // All questions answered, move to review
      setCurrentQuestionIndex(-1)
    }
  }

  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
    }
  }

  const submitEquipment = async () => {
    try {
      setIsSubmitting(true)

      // Insert equipment into database
      const { data, error } = await supabase
        .from('customer_equipment')
        .insert({
          contact_id: customerId,
          equipment_type: equipmentData.equipment_type,
          name: equipmentData.name,
          brand: equipmentData.brand,
          model: equipmentData.model,
          serial_number: equipmentData.serial_number,
          install_date: equipmentData.install_date,
          location: equipmentData.location,
          notes: equipmentData.notes,
          warranty_expiration: equipmentData.warranty_expiration,
          equipment_image_url: uploadedImage,
          status: 'good',
          efficiency_rating: 85,
          is_smart_enabled: false
        })
        .select()
        .single()

      if (error) throw error

      // Generate AI maintenance recommendations for new equipment
      await generateInitialRecommendations(data.id)

      onEquipmentAdded(data)
      resetForm()
      
    } catch (error) {
      console.error('Error saving equipment:', error)
      alert('Error saving equipment. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const generateInitialRecommendations = async (equipmentId: string) => {
    try {
      await supabase.functions.invoke('generate-ai-recommendations', {
        body: { customerId, equipmentId }
      })
    } catch (error) {
      console.error('Error generating recommendations:', error)
    }
  }

  const resetForm = () => {
    setUploadedImage(null)
    setAiDetection(null)
    setEquipmentData({ name: '', equipment_type: '', location: '' })
    setCurrentQuestionIndex(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const getCurrentQuestion = () => {
    if (!aiDetection || currentQuestionIndex < 0) return null
    return aiDetection.questions[currentQuestionIndex]
  }

  const currentQuestion = getCurrentQuestion()

  return (
    <div className="card card-flush">
      <div className="card-header pt-7">
        <h3 className="card-title align-items-start flex-column">
          <span className="card-label fw-bold text-dark">
            <i className="ki-duotone ki-camera fs-3 text-primary me-2">
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
            Add Equipment with AI Recognition
          </span>
          <span className="text-muted mt-1 fw-semibold fs-7">
            Take a photo and let our AI identify and classify your equipment
          </span>
        </h3>
      </div>

      <div className="card-body">
        {/* Photo Upload Section */}
        {!uploadedImage && (
          <div className="text-center py-10">
            <div 
              className="border-2 border-dashed border-primary rounded p-8 cursor-pointer hover-bg-light-primary"
              onClick={() => fileInputRef.current?.click()}
            >
              <i className="ki-duotone ki-camera fs-4x text-primary mb-4">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              <h4 className="text-dark mb-3">Take or Upload Equipment Photo</h4>
              <p className="text-muted fs-5 mb-4">
                Our AI will analyze the photo and help you add the equipment to your profile
              </p>
              <button className="btn btn-primary">
                <i className="ki-duotone ki-plus fs-5 me-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                Choose Photo
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="d-none"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileUpload(file)
              }}
            />
          </div>
        )}

        {/* AI Analysis Loading */}
        {isAnalyzing && (
          <div className="text-center py-10">
            <div className="spinner-border text-primary mb-4" style={{ width: '3rem', height: '3rem' }}></div>
            <h4 className="text-dark mb-3">🔍 AI Analyzing Your Equipment...</h4>
            <p className="text-muted fs-5">
              Our AI is identifying the equipment type, brand, and model
            </p>
          </div>
        )}

        {/* AI Detection Results */}
        {aiDetection && uploadedImage && (
          <div>
            <div className="row g-5 mb-6">
              <div className="col-md-4">
                <img 
                  src={uploadedImage} 
                  alt="Equipment" 
                  className="w-100 rounded shadow"
                  style={{ maxHeight: '300px', objectFit: 'cover' }}
                />
              </div>
              <div className="col-md-8">
                <div className="alert alert-success">
                  <div className="d-flex align-items-center">
                    <i className="ki-duotone ki-verify fs-2x text-success me-3">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    <div>
                      <h5 className="mb-1">Equipment Detected! 🎯</h5>
                      <p className="mb-0">
                        <strong>Type:</strong> {aiDetection.equipmentType.charAt(0).toUpperCase() + aiDetection.equipmentType.slice(1)}<br/>
                        {aiDetection.brand && <><strong>Brand:</strong> {aiDetection.brand}<br/></>}
                        {aiDetection.model && <><strong>Model:</strong> {aiDetection.model}<br/></>}
                        <strong>Confidence:</strong> {aiDetection.confidence}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Current Question */}
                {currentQuestion && currentQuestionIndex >= 0 && (
                  <div className="card border-primary">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-center mb-4">
                        <h6 className="fw-bold text-dark mb-0">
                          Question {currentQuestionIndex + 1} of {aiDetection.questions.length}
                        </h6>
                        <span className="badge badge-light-primary">
                          {currentQuestion.required ? 'Required' : 'Optional'}
                        </span>
                      </div>

                      <h5 className="text-dark mb-4">{currentQuestion.question}</h5>

                      {currentQuestion.type === 'text' && (
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter your answer..."
                          onChange={(e) => handleQuestionAnswer(currentQuestion.id, e.target.value)}
                        />
                      )}

                      {currentQuestion.type === 'number' && (
                        <input
                          type="number"
                          className="form-control"
                          placeholder="Enter number..."
                          onChange={(e) => handleQuestionAnswer(currentQuestion.id, e.target.value)}
                        />
                      )}

                      {currentQuestion.type === 'date' && (
                        <input
                          type="date"
                          className="form-control"
                          onChange={(e) => handleQuestionAnswer(currentQuestion.id, e.target.value)}
                        />
                      )}

                      {currentQuestion.type === 'select' && currentQuestion.options && (
                        <select
                          className="form-select"
                          onChange={(e) => handleQuestionAnswer(currentQuestion.id, e.target.value)}
                        >
                          <option value="">Select an option...</option>
                          {currentQuestion.options.map(option => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      )}

                      <div className="d-flex justify-content-between mt-4">
                        <button 
                          className="btn btn-light"
                          onClick={previousQuestion}
                          disabled={currentQuestionIndex === 0}
                        >
                          <i className="ki-duotone ki-left fs-5 me-1">
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                          Previous
                        </button>
                        <button 
                          className="btn btn-primary"
                          onClick={nextQuestion}
                        >
                          {currentQuestionIndex === aiDetection.questions.length - 1 ? 'Review' : 'Next'}
                          <i className="ki-duotone ki-right fs-5 ms-1">
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Equipment Review */}
                {currentQuestionIndex === -1 && (
                  <div className="card border-success">
                    <div className="card-body">
                      <h5 className="text-dark mb-4">
                        <i className="ki-duotone ki-check-circle fs-3 text-success me-2">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        Review Equipment Details
                      </h5>

                      <div className="row g-3">
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Equipment Name</label>
                            <input
                              type="text"
                              className="form-control"
                              value={equipmentData.name}
                              onChange={(e) => setEquipmentData({...equipmentData, name: e.target.value})}
                            />
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Type</label>
                            <input
                              type="text"
                              className="form-control"
                              value={equipmentData.equipment_type}
                              disabled
                            />
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Brand</label>
                            <input
                              type="text"
                              className="form-control"
                              value={equipmentData.brand || ''}
                              onChange={(e) => setEquipmentData({...equipmentData, brand: e.target.value})}
                            />
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Model</label>
                            <input
                              type="text"
                              className="form-control"
                              value={equipmentData.model || ''}
                              onChange={(e) => setEquipmentData({...equipmentData, model: e.target.value})}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="d-flex justify-content-between mt-4">
                        <button 
                          className="btn btn-light"
                          onClick={() => setCurrentQuestionIndex(aiDetection.questions.length - 1)}
                        >
                          <i className="ki-duotone ki-left fs-5 me-1">
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                          Back to Questions
                        </button>
                        <div className="d-flex gap-2">
                          <button className="btn btn-secondary text-dark" onClick={resetForm}>
                            Start Over
                          </button>
                          <button 
                            className="btn btn-success"
                            onClick={submitEquipment}
                            disabled={isSubmitting || !equipmentData.name.trim()}
                          >
                            {isSubmitting ? (
                              <>
                                <span className="spinner-border spinner-border-sm me-2"></span>
                                Adding Equipment...
                              </>
                            ) : (
                              <>
                                <i className="ki-duotone ki-check fs-5 me-2">
                                  <span className="path1"></span>
                                  <span className="path2"></span>
                                </i>
                                Add to My Equipment
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default EquipmentPhotoUpload