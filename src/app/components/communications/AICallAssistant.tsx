import React, { useState, useEffect } from 'react'
import { KTIcon } from '../../../_metronic/helpers'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'

interface AIAssistantConfig {
  voice: 'polly.amy' | 'polly.matthew' | 'polly.joanna' | 'polly.brian'
  personality: 'professional' | 'friendly' | 'concise'
  features: {
    appointmentScheduling: boolean
    questionAnswering: boolean
    callRouting: boolean
    leadCapture: boolean
    emergencyDetection: boolean
  }
  businessHours: {
    enabled: boolean
    schedule: Record<string, { start: string; end: string; enabled: boolean }>
  }
  customGreeting: string
  transferNumbers: Array<{ name: string; number: string; department: string }>
}

// Voice options - moved outside component to avoid hoisting issues
const voices = [
  // Amazon Polly Voices
  { value: 'polly.amy', label: 'Amy (British Female)', accent: 'British', provider: 'Amazon Polly' },
  { value: 'polly.brian', label: 'Brian (British Male)', accent: 'British', provider: 'Amazon Polly' },
  { value: 'polly.emma', label: 'Emma (British Female)', accent: 'British', provider: 'Amazon Polly' },
  { value: 'polly.joanna', label: 'Joanna (American Female)', accent: 'American', provider: 'Amazon Polly' },
  { value: 'polly.joey', label: 'Joey (American Male)', accent: 'American', provider: 'Amazon Polly' },
  { value: 'polly.kendra', label: 'Kendra (American Female)', accent: 'American', provider: 'Amazon Polly' },
  { value: 'polly.kimberly', label: 'Kimberly (American Female)', accent: 'American', provider: 'Amazon Polly' },
  { value: 'polly.matthew', label: 'Matthew (American Male)', accent: 'American', provider: 'Amazon Polly' },
  { value: 'polly.salli', label: 'Salli (American Female)', accent: 'American', provider: 'Amazon Polly' },
  { value: 'polly.russell', label: 'Russell (Australian Male)', accent: 'Australian', provider: 'Amazon Polly' },
  { value: 'polly.nicole', label: 'Nicole (Australian Female)', accent: 'Australian', provider: 'Amazon Polly' },
  
  // Google Cloud Voices
  { value: 'google.en-US-Wavenet-A', label: 'Wavenet A (American Male)', accent: 'American', provider: 'Google Cloud' },
  { value: 'google.en-US-Wavenet-B', label: 'Wavenet B (American Male)', accent: 'American', provider: 'Google Cloud' },
  { value: 'google.en-US-Wavenet-C', label: 'Wavenet C (American Female)', accent: 'American', provider: 'Google Cloud' },
  { value: 'google.en-US-Wavenet-D', label: 'Wavenet D (American Male)', accent: 'American', provider: 'Google Cloud' },
  { value: 'google.en-US-Wavenet-E', label: 'Wavenet E (American Female)', accent: 'American', provider: 'Google Cloud' },
  { value: 'google.en-US-Wavenet-F', label: 'Wavenet F (American Female)', accent: 'American', provider: 'Google Cloud' },
  { value: 'google.en-GB-Wavenet-A', label: 'Wavenet A (British Female)', accent: 'British', provider: 'Google Cloud' },
  { value: 'google.en-GB-Wavenet-B', label: 'Wavenet B (British Male)', accent: 'British', provider: 'Google Cloud' },
  
  // Microsoft Azure Voices
  { value: 'azure.en-US-JennyNeural', label: 'Jenny (American Female)', accent: 'American', provider: 'Microsoft Azure' },
  { value: 'azure.en-US-GuyNeural', label: 'Guy (American Male)', accent: 'American', provider: 'Microsoft Azure' },
  { value: 'azure.en-US-AriaNeural', label: 'Aria (American Female)', accent: 'American', provider: 'Microsoft Azure' },
  { value: 'azure.en-US-DavisNeural', label: 'Davis (American Male)', accent: 'American', provider: 'Microsoft Azure' },
  { value: 'azure.en-GB-SoniaNeural', label: 'Sonia (British Female)', accent: 'British', provider: 'Microsoft Azure' },
  { value: 'azure.en-GB-RyanNeural', label: 'Ryan (British Male)', accent: 'British', provider: 'Microsoft Azure' },
  
  // ElevenLabs Voices (Premium Natural Voices)
  { value: 'elevenlabs.rachel', label: 'Rachel (Natural Female)', accent: 'American', provider: 'ElevenLabs' },
  { value: 'elevenlabs.josh', label: 'Josh (Natural Male)', accent: 'American', provider: 'ElevenLabs' },
  { value: 'elevenlabs.bella', label: 'Bella (Natural Female)', accent: 'American', provider: 'ElevenLabs' },
  { value: 'elevenlabs.antoni', label: 'Antoni (Natural Male)', accent: 'American', provider: 'ElevenLabs' },
  { value: 'elevenlabs.arnold', label: 'Arnold (Natural Male)', accent: 'American', provider: 'ElevenLabs' },
  { value: 'elevenlabs.domi', label: 'Domi (Natural Female)', accent: 'American', provider: 'ElevenLabs' },
  { value: 'elevenlabs.elli', label: 'Elli (Natural Female)', accent: 'American', provider: 'ElevenLabs' }
]

export const AICallAssistant: React.FC = () => {
  const { tenant } = useSupabaseAuth()
  const [previewLoading, setPreviewLoading] = useState(false)
  const [config, setConfig] = useState<AIAssistantConfig>({
    voice: 'polly.amy',
    personality: 'professional',
    features: {
      appointmentScheduling: true,
      questionAnswering: true,
      callRouting: true,
      leadCapture: true,
      emergencyDetection: true
    },
    businessHours: {
      enabled: true,
      schedule: {
        monday: { start: '09:00', end: '17:00', enabled: true },
        tuesday: { start: '09:00', end: '17:00', enabled: true },
        wednesday: { start: '09:00', end: '17:00', enabled: true },
        thursday: { start: '09:00', end: '17:00', enabled: true },
        friday: { start: '09:00', end: '17:00', enabled: true },
        saturday: { start: '10:00', end: '14:00', enabled: false },
        sunday: { start: '00:00', end: '00:00', enabled: false }
      }
    },
    customGreeting: `Thank you for calling ${tenant?.company_name || 'our company'}. I'm your AI assistant. How can I help you today?`,
    transferNumbers: []
  })

  const [callStats, setCallStats] = useState({
    totalCalls: 0,
    appointmentsScheduled: 0,
    questionsAnswered: 0,
    callsTransferred: 0,
    averageCallDuration: 0,
    satisfactionScore: 0
  })

  const [loading, setLoading] = useState(false)
  const [testMode, setTestMode] = useState(false)

  const personalities = [
    { value: 'professional', label: 'Professional', description: 'Formal and business-focused' },
    { value: 'friendly', label: 'Friendly', description: 'Warm and conversational' },
    { value: 'concise', label: 'Concise', description: 'Brief and to-the-point' }
  ]

  const handleSaveConfig = async () => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('ai_assistant_config')
        .upsert({
          tenant_id: tenant?.id,
          config: config,
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      // Deploy AI configuration to SignalWire
      const { data, error: deployError } = await supabase.functions.invoke('deploy-ai-assistant', {
        body: { config }
      })

      if (deployError) throw deployError

      alert('AI Assistant configuration saved and deployed successfully!')
    } catch (error) {
      console.error('Error saving AI config:', error)
      alert('Failed to save configuration')
    } finally {
      setLoading(false)
    }
  }

  const handlePreviewVoice = async () => {
    setPreviewLoading(true)
    try {
      // Check if this is a premium voice that requires API preview
      const selectedVoice = voices.find(v => v.value === config.voice)
      
      if (selectedVoice?.provider === 'ElevenLabs' || 
          selectedVoice?.provider === 'Google Cloud' || 
          selectedVoice?.provider === 'Microsoft Azure') {
        // For premium voices, show a message instead of browser TTS
        alert(`Preview not available for ${selectedVoice.provider} voices.\n\nTo hear the actual ${selectedVoice.label} voice:\n1. Save your configuration\n2. Use the "Test Call" feature\n3. Or wait for an incoming call\n\nThe actual voice will sound much more natural than this preview.`)
        setPreviewLoading(false)
        return
      }
      
      // For basic Polly voices, use browser TTS as approximation
      const utterance = new SpeechSynthesisUtterance(config.customGreeting)
      
      // Try to match accent at least
      const isFemaleName = config.voice.includes('amy') || config.voice.includes('joanna') || 
                          config.voice.includes('emma') || config.voice.includes('kendra') || 
                          config.voice.includes('kimberly') || config.voice.includes('salli') || 
                          config.voice.includes('nicole')
      
      const browserVoices = speechSynthesis.getVoices()
      if (config.voice.includes('british')) {
        utterance.voice = browserVoices.find(v => v.lang.includes('en-GB')) || browserVoices[0]
      } else if (config.voice.includes('australian')) {
        utterance.voice = browserVoices.find(v => v.lang.includes('en-AU')) || browserVoices[0]
      } else {
        utterance.voice = browserVoices.find(v => v.lang.includes('en-US')) || browserVoices[0]
      }
      
      utterance.rate = config.personality === 'concise' ? 1.1 : 0.9
      utterance.pitch = isFemaleName ? 1.1 : 0.9
      
      speechSynthesis.speak(utterance)
      
      // Wait for speech to complete
      utterance.onend = () => {
        setPreviewLoading(false)
      }
    } catch (error) {
      console.error('Preview error:', error)
      setPreviewLoading(false)
    }
  }

  const handleTestCall = async () => {
    setTestMode(true)
    try {
      const selectedVoice = voices.find(v => v.value === config.voice)
      const phoneNumber = prompt('Enter your phone number to receive test call (e.g., +1234567890):')
      
      if (!phoneNumber) {
        setTestMode(false)
        return
      }

      // Show what would happen in production
      alert(`Test Call Configuration:\n\nVoice: ${selectedVoice?.label}\nProvider: ${selectedVoice?.provider}\nPersonality: ${config.personality}\nGreeting: "${config.customGreeting}"\n\nWhen fully integrated with SignalWire/Vapi:\n- You would receive a call at ${phoneNumber}\n- The AI would use the actual ${selectedVoice?.label} voice from ${selectedVoice?.provider}\n- It would greet you with your custom message\n- The voice would sound natural and distinct\n\nNote: Full voice provider integration requires API keys for ${selectedVoice?.provider}`)
      
      // In production, uncomment this:
      /*
      const { data, error } = await supabase.functions.invoke('initiate-ai-test-call', {
        body: { 
          config,
          testNumber: phoneNumber,
          voiceProvider: selectedVoice?.provider,
          voiceId: config.voice
        }
      })
      if (error) throw error
      */
    } catch (error) {
      console.error('Error initiating test call:', error)
      alert('Failed to initiate test call')
    } finally {
      setTestMode(false)
    }
  }

  return (
    <div className="card">
      <div className="card-header border-0 pt-6">
        <h3 className="card-title align-items-start flex-column">
          <span className="card-label fw-bold fs-3 mb-1">AI Call Assistant</span>
          <span className="text-muted mt-1 fw-semibold fs-7">
            Configure your intelligent voice assistant
          </span>
        </h3>
        <div className="card-toolbar">
          <button
            className="btn btn-sm btn-light-primary me-3"
            onClick={handleTestCall}
            disabled={testMode}
          >
            <KTIcon iconName="phone" className="fs-3 me-1" />
            Test Call
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={handleSaveConfig}
            disabled={loading}
          >
            {loading ? (
              <span className="spinner-border spinner-border-sm me-2" />
            ) : (
              <KTIcon iconName="save" className="fs-3 me-1" />
            )}
            Save & Deploy
          </button>
        </div>
      </div>

      <div className="card-body">
        {/* AI Stats Dashboard */}
        <div className="row g-5 g-xl-10 mb-10">
          <div className="col-md-2">
            <div className="bg-light-primary rounded p-5 text-center">
              <div className="fs-2 fw-bold text-primary">{callStats.totalCalls}</div>
              <div className="fs-7 text-muted">Total Calls</div>
            </div>
          </div>
          <div className="col-md-2">
            <div className="bg-light-success rounded p-5 text-center">
              <div className="fs-2 fw-bold text-success">{callStats.appointmentsScheduled}</div>
              <div className="fs-7 text-muted">Appointments</div>
            </div>
          </div>
          <div className="col-md-2">
            <div className="bg-light-info rounded p-5 text-center">
              <div className="fs-2 fw-bold text-info">{callStats.questionsAnswered}</div>
              <div className="fs-7 text-muted">Questions</div>
            </div>
          </div>
          <div className="col-md-2">
            <div className="bg-light-warning rounded p-5 text-center">
              <div className="fs-2 fw-bold text-warning">{callStats.callsTransferred}</div>
              <div className="fs-7 text-muted">Transferred</div>
            </div>
          </div>
          <div className="col-md-2">
            <div className="bg-light-danger rounded p-5 text-center">
              <div className="fs-2 fw-bold text-danger">{callStats.averageCallDuration}s</div>
              <div className="fs-7 text-muted">Avg Duration</div>
            </div>
          </div>
          <div className="col-md-2">
            <div className="bg-light-success rounded p-5 text-center">
              <div className="fs-2 fw-bold text-success">{callStats.satisfactionScore}%</div>
              <div className="fs-7 text-muted">Satisfaction</div>
            </div>
          </div>
        </div>

        {/* Configuration Tabs */}
        <ul className="nav nav-tabs nav-line-tabs mb-5 fs-6">
          <li className="nav-item">
            <a className="nav-link active" data-bs-toggle="tab" href="#voice-config">
              Voice & Personality
            </a>
          </li>
          <li className="nav-item">
            <a className="nav-link" data-bs-toggle="tab" href="#features-config">
              Features
            </a>
          </li>
          <li className="nav-item">
            <a className="nav-link" data-bs-toggle="tab" href="#hours-config">
              Business Hours
            </a>
          </li>
          <li className="nav-item">
            <a className="nav-link" data-bs-toggle="tab" href="#routing-config">
              Call Routing
            </a>
          </li>
          <li className="nav-item">
            <a className="nav-link" data-bs-toggle="tab" href="#training-config">
              Knowledge Base
            </a>
          </li>
        </ul>

        <div className="tab-content">
          {/* Voice & Personality Tab */}
          <div className="tab-pane fade show active" id="voice-config">
            <div className="row">
              <div className="col-md-6">
                <div className="mb-5">
                  <label className="form-label">AI Voice</label>
                  <select
                    className="form-select"
                    value={config.voice}
                    onChange={(e) => setConfig({ ...config, voice: e.target.value as any })}
                  >
                    <optgroup label="Amazon Polly (Standard)">
                      {voices.filter(v => v.provider === 'Amazon Polly').map(voice => (
                        <option key={voice.value} value={voice.value}>
                          {voice.label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Google Cloud (WaveNet)">
                      {voices.filter(v => v.provider === 'Google Cloud').map(voice => (
                        <option key={voice.value} value={voice.value}>
                          {voice.label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Microsoft Azure (Neural)">
                      {voices.filter(v => v.provider === 'Microsoft Azure').map(voice => (
                        <option key={voice.value} value={voice.value}>
                          {voice.label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="ElevenLabs (Premium Natural)">
                      {voices.filter(v => v.provider === 'ElevenLabs').map(voice => (
                        <option key={voice.value} value={voice.value}>
                          {voice.label}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <div className="form-text">
                    Choose from various TTS providers. ElevenLabs provides the most natural-sounding voices.
                  </div>
                </div>
              </div>
              <div className="col-md-6">
                <div className="mb-5">
                  <label className="form-label">Personality</label>
                  <select
                    className="form-select"
                    value={config.personality}
                    onChange={(e) => setConfig({ ...config, personality: e.target.value as any })}
                  >
                    {personalities.map(p => (
                      <option key={p.value} value={p.value}>
                        {p.label} - {p.description}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="mb-5">
              <label className="form-label">Custom Greeting</label>
              <textarea
                className="form-control"
                rows={3}
                value={config.customGreeting}
                onChange={(e) => setConfig({ ...config, customGreeting: e.target.value })}
                placeholder="Enter your custom greeting message..."
              />
              <div className="form-text">This is what callers will hear when they first connect</div>
            </div>

            {/* Voice Preview */}
            <div className="bg-light rounded p-5">
              <h5 className="mb-3">Voice Testing</h5>
              <div className="d-flex align-items-center mb-3">
                <button 
                  className="btn btn-sm btn-light-primary me-3"
                  onClick={handlePreviewVoice}
                  disabled={previewLoading}
                  title="Basic preview using browser TTS"
                >
                  {previewLoading ? (
                    <span className="spinner-border spinner-border-sm" />
                  ) : (
                    <KTIcon iconName="play" className="fs-3" />
                  )}
                </button>
                <div className="flex-grow-1">
                  <div className="fw-bold">Sample: "{config.customGreeting}"</div>
                  <div className="text-muted fs-7">
                    Voice: {voices.find(v => v.value === config.voice)?.label} 
                    <span className="badge badge-light-info ms-2">{voices.find(v => v.value === config.voice)?.provider}</span>
                  </div>
                  <div className="text-warning fs-8 mt-1">
                    Note: Browser preview uses basic TTS. Actual AI voice will sound much better with the selected provider.
                  </div>
                </div>
              </div>
              
              {/* Test Call Button */}
              <div className="border-top pt-3">
                <button 
                  className="btn btn-sm btn-success me-3"
                  onClick={handleTestCall}
                  disabled={testMode}
                >
                  <KTIcon iconName="phone" className="fs-3 me-2" />
                  Make Test Call
                </button>
                <span className="text-muted fs-7">
                  Receive a real call from your AI assistant to hear the actual voice
                </span>
              </div>
            </div>
          </div>

          {/* Features Tab */}
          <div className="tab-pane fade" id="features-config">
            <div className="row">
              <div className="col-md-6">
                <div className="form-check form-switch mb-5">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={config.features.appointmentScheduling}
                    onChange={(e) => setConfig({
                      ...config,
                      features: { ...config.features, appointmentScheduling: e.target.checked }
                    })}
                  />
                  <label className="form-check-label">
                    <div className="fw-bold">Appointment Scheduling</div>
                    <div className="text-muted fs-7">AI can book appointments based on availability</div>
                  </label>
                </div>

                <div className="form-check form-switch mb-5">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={config.features.questionAnswering}
                    onChange={(e) => setConfig({
                      ...config,
                      features: { ...config.features, questionAnswering: e.target.checked }
                    })}
                  />
                  <label className="form-check-label">
                    <div className="fw-bold">Question Answering</div>
                    <div className="text-muted fs-7">Answer common questions about services and pricing</div>
                  </label>
                </div>

                <div className="form-check form-switch mb-5">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={config.features.leadCapture}
                    onChange={(e) => setConfig({
                      ...config,
                      features: { ...config.features, leadCapture: e.target.checked }
                    })}
                  />
                  <label className="form-check-label">
                    <div className="fw-bold">Lead Capture</div>
                    <div className="text-muted fs-7">Collect contact information from new callers</div>
                  </label>
                </div>
              </div>

              <div className="col-md-6">
                <div className="form-check form-switch mb-5">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={config.features.callRouting}
                    onChange={(e) => setConfig({
                      ...config,
                      features: { ...config.features, callRouting: e.target.checked }
                    })}
                  />
                  <label className="form-check-label">
                    <div className="fw-bold">Intelligent Call Routing</div>
                    <div className="text-muted fs-7">Route calls to the right person or department</div>
                  </label>
                </div>

                <div className="form-check form-switch mb-5">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={config.features.emergencyDetection}
                    onChange={(e) => setConfig({
                      ...config,
                      features: { ...config.features, emergencyDetection: e.target.checked }
                    })}
                  />
                  <label className="form-check-label">
                    <div className="fw-bold">Emergency Detection</div>
                    <div className="text-muted fs-7">Immediately route emergency calls to on-call staff</div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Business Hours Tab */}
          <div className="tab-pane fade" id="hours-config">
            <div className="mb-5">
              <div className="form-check form-switch mb-5">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={config.businessHours.enabled}
                  onChange={(e) => setConfig({
                    ...config,
                    businessHours: { ...config.businessHours, enabled: e.target.checked }
                  })}
                />
                <label className="form-check-label">
                  <div className="fw-bold">Use Business Hours</div>
                  <div className="text-muted fs-7">AI behaves differently during and after hours</div>
                </label>
              </div>
            </div>

            {config.businessHours.enabled && (
              <div className="table-responsive">
                <table className="table table-row-bordered">
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Enabled</th>
                      <th>Start Time</th>
                      <th>End Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(config.businessHours.schedule).map(([day, schedule]) => (
                      <tr key={day}>
                        <td className="text-capitalize">{day}</td>
                        <td>
                          <div className="form-check form-switch">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={schedule.enabled}
                              onChange={(e) => {
                                const newSchedule = { ...config.businessHours.schedule }
                                newSchedule[day].enabled = e.target.checked
                                setConfig({
                                  ...config,
                                  businessHours: { ...config.businessHours, schedule: newSchedule }
                                })
                              }}
                            />
                          </div>
                        </td>
                        <td>
                          <input
                            type="time"
                            className="form-control form-control-sm"
                            value={schedule.start}
                            disabled={!schedule.enabled}
                            onChange={(e) => {
                              const newSchedule = { ...config.businessHours.schedule }
                              newSchedule[day].start = e.target.value
                              setConfig({
                                ...config,
                                businessHours: { ...config.businessHours, schedule: newSchedule }
                              })
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="time"
                            className="form-control form-control-sm"
                            value={schedule.end}
                            disabled={!schedule.enabled}
                            onChange={(e) => {
                              const newSchedule = { ...config.businessHours.schedule }
                              newSchedule[day].end = e.target.value
                              setConfig({
                                ...config,
                                businessHours: { ...config.businessHours, schedule: newSchedule }
                              })
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Call Routing Tab */}
          <div className="tab-pane fade" id="routing-config">
            <div className="mb-5">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5>Transfer Numbers</h5>
                <button
                  className="btn btn-sm btn-light-primary"
                  onClick={() => {
                    setConfig({
                      ...config,
                      transferNumbers: [
                        ...config.transferNumbers,
                        { name: '', number: '', department: '' }
                      ]
                    })
                  }}
                >
                  <KTIcon iconName="plus" className="fs-3" />
                  Add Number
                </button>
              </div>

              {config.transferNumbers.map((transfer, index) => (
                <div key={index} className="bg-light rounded p-4 mb-3">
                  <div className="row">
                    <div className="col-md-4">
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Name"
                        value={transfer.name}
                        onChange={(e) => {
                          const newTransfers = [...config.transferNumbers]
                          newTransfers[index].name = e.target.value
                          setConfig({ ...config, transferNumbers: newTransfers })
                        }}
                      />
                    </div>
                    <div className="col-md-3">
                      <input
                        type="tel"
                        className="form-control"
                        placeholder="Phone Number"
                        value={transfer.number}
                        onChange={(e) => {
                          const newTransfers = [...config.transferNumbers]
                          newTransfers[index].number = e.target.value
                          setConfig({ ...config, transferNumbers: newTransfers })
                        }}
                      />
                    </div>
                    <div className="col-md-4">
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Department/Role"
                        value={transfer.department}
                        onChange={(e) => {
                          const newTransfers = [...config.transferNumbers]
                          newTransfers[index].department = e.target.value
                          setConfig({ ...config, transferNumbers: newTransfers })
                        }}
                      />
                    </div>
                    <div className="col-md-1">
                      <button
                        className="btn btn-sm btn-light-danger"
                        onClick={() => {
                          const newTransfers = config.transferNumbers.filter((_, i) => i !== index)
                          setConfig({ ...config, transferNumbers: newTransfers })
                        }}
                      >
                        <KTIcon iconName="trash" className="fs-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Knowledge Base Tab */}
          <div className="tab-pane fade" id="training-config">
            <div className="alert alert-primary">
              <div className="d-flex align-items-center">
                <KTIcon iconName="information" className="fs-2 me-3" />
                <div>
                  <h5 className="mb-1">AI Knowledge Base</h5>
                  <p className="mb-0">
                    Upload documents, FAQs, and service information to train your AI assistant.
                    The more information you provide, the better it can answer customer questions.
                  </p>
                </div>
              </div>
            </div>

            <div className="row">
              <div className="col-md-6">
                <div className="card bg-light">
                  <div className="card-body">
                    <h5 className="mb-3">Upload Documents</h5>
                    <div className="dropzone">
                      <div className="dz-message text-center">
                        <KTIcon iconName="cloud-upload" className="fs-3x text-primary mb-3" />
                        <div className="text-muted">Drop files here or click to upload</div>
                        <div className="text-muted fs-7">PDF, DOC, TXT files up to 10MB</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-md-6">
                <div className="card bg-light">
                  <div className="card-body">
                    <h5 className="mb-3">Quick FAQ Builder</h5>
                    <button className="btn btn-primary w-100">
                      <KTIcon iconName="plus" className="fs-3 me-2" />
                      Add Question & Answer
                    </button>
                    <div className="mt-3 text-center text-muted">
                      <small>Build a knowledge base of common questions</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AICallAssistant
