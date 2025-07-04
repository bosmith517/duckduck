import React, { useState, useEffect } from 'react'
import { emailService, EmailDomain } from '../../services/emailService'

interface DomainSetupWizardProps {
  onComplete?: (domain: EmailDomain) => void
  onCancel?: () => void
  className?: string
}

interface DNSRecord {
  record: string
  name: string
  value: string
  type: string
}

const DomainSetupWizard: React.FC<DomainSetupWizardProps> = ({
  onComplete,
  onCancel,
  className = ''
}) => {
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkingStatus, setCheckingStatus] = useState(false)
  
  // Form data
  const [domainData, setDomainData] = useState({
    domain_name: '',
    default_from_name: '',
    default_from_email: '',
    reply_to_email: '',
    region: 'us-east-1'
  })

  // Created domain and DNS records
  const [createdDomain, setCreatedDomain] = useState<EmailDomain | null>(null)
  const [dnsRecords, setDnsRecords] = useState<DNSRecord[]>([])
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'checking' | 'verified' | 'failed'>('pending')
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null)

  const steps = [
    { number: 1, title: 'Domain Details', description: 'Enter your email domain information' },
    { number: 2, title: 'DNS Configuration', description: 'Add DNS records to your domain' },
    { number: 3, title: 'Verification', description: 'Verify domain ownership' },
    { number: 4, title: 'Complete', description: 'Your domain is ready to use' }
  ]

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval)
      }
    }
  }, [pollInterval])

  const validateStep1 = () => {
    if (!domainData.domain_name) return 'Domain name is required'
    if (!domainData.default_from_name) return 'From name is required'
    if (!domainData.default_from_email) return 'From email is required'
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(domainData.default_from_email)) {
      return 'Invalid email format'
    }

    const emailDomain = domainData.default_from_email.split('@')[1]
    if (emailDomain !== domainData.domain_name) {
      return 'From email must use the domain you are adding'
    }

    if (domainData.reply_to_email && !emailRegex.test(domainData.reply_to_email)) {
      return 'Invalid reply-to email format'
    }

    return null
  }

  const handleStep1Submit = async () => {
    const validationError = validateStep1()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await emailService.createDomain(domainData)
      setCreatedDomain(result.domain)
      setDnsRecords(result.domain.dns_records)
      setCurrentStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create domain')
    } finally {
      setLoading(false)
    }
  }

  const startVerificationPolling = () => {
    setVerificationStatus('checking')
    setCheckingStatus(true)

    const interval = setInterval(async () => {
      try {
        const domains = await emailService.getDomains()
        const domain = domains.domains.find(d => d.id === createdDomain?.id)
        
        if (domain) {
          if (domain.status === 'verified') {
            setVerificationStatus('verified')
            setCreatedDomain(domain)
            clearInterval(interval)
            setPollInterval(null)
            setCurrentStep(4)
            setCheckingStatus(false)
          } else if (domain.status === 'failed') {
            setVerificationStatus('failed')
            setError('Domain verification failed. Please check your DNS records.')
            clearInterval(interval)
            setPollInterval(null)
            setCheckingStatus(false)
          }
        }
      } catch (err) {
        console.error('Error checking verification status:', err)
      }
    }, 10000) // Check every 10 seconds

    setPollInterval(interval)

    // Stop polling after 10 minutes
    setTimeout(() => {
      if (verificationStatus === 'checking') {
        clearInterval(interval)
        setPollInterval(null)
        setCheckingStatus(false)
        setError('Verification timeout. Please check your DNS records and try again.')
      }
    }, 600000) // 10 minutes
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      // Could add a toast notification here
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
    }
  }

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Domain Configuration</h3>
        <p className="text-gray-600 mb-6">
          Set up your custom email domain to send emails from your own domain instead of a generic one.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Domain Name *</span>
          </label>
          <input
            type="text"
            placeholder="mail.yourcompany.com"
            className="input input-bordered"
            value={domainData.domain_name}
            onChange={(e) => setDomainData(prev => ({ ...prev, domain_name: e.target.value }))}
          />
          <label className="label">
            <span className="label-text-alt">The domain you want to send emails from</span>
          </label>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Region</span>
          </label>
          <select
            className="select select-bordered"
            value={domainData.region}
            onChange={(e) => setDomainData(prev => ({ ...prev, region: e.target.value }))}
          >
            <option value="us-east-1">US East (Virginia)</option>
            <option value="us-west-2">US West (Oregon)</option>
            <option value="eu-west-1">Europe (Ireland)</option>
            <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
          </select>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Default From Name *</span>
          </label>
          <input
            type="text"
            placeholder="Your Company Support"
            className="input input-bordered"
            value={domainData.default_from_name}
            onChange={(e) => setDomainData(prev => ({ ...prev, default_from_name: e.target.value }))}
          />
          <label className="label">
            <span className="label-text-alt">The name that appears in the "From" field</span>
          </label>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Default From Email *</span>
          </label>
          <input
            type="email"
            placeholder="support@mail.yourcompany.com"
            className="input input-bordered"
            value={domainData.default_from_email}
            onChange={(e) => setDomainData(prev => ({ ...prev, default_from_email: e.target.value }))}
          />
          <label className="label">
            <span className="label-text-alt">Must use the domain you're adding</span>
          </label>
        </div>

        <div className="form-control md:col-span-2">
          <label className="label">
            <span className="label-text font-medium">Reply-To Email</span>
          </label>
          <input
            type="email"
            placeholder="noreply@mail.yourcompany.com (optional)"
            className="input input-bordered"
            value={domainData.reply_to_email}
            onChange={(e) => setDomainData(prev => ({ ...prev, reply_to_email: e.target.value }))}
          />
          <label className="label">
            <span className="label-text-alt">Where replies will be sent (optional)</span>
          </label>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>❌ {error}</span>
        </div>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className={`btn btn-primary ${loading ? 'loading' : ''}`}
          onClick={handleStep1Submit}
          disabled={loading}
        >
          {loading ? 'Creating Domain...' : 'Create Domain'}
        </button>
      </div>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">DNS Configuration</h3>
        <p className="text-gray-600 mb-6">
          Add these DNS records to your domain registrar or DNS provider to verify ownership and enable email sending.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start space-x-3">
          <div className="text-blue-500 text-xl">ℹ️</div>
          <div>
            <h4 className="font-medium text-blue-900 mb-2">Important Instructions</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Add ALL records exactly as shown below</li>
              <li>• DNS changes can take up to 24 hours to propagate</li>
              <li>• Contact your DNS provider if you need help adding records</li>
              <li>• Do not modify the values - copy them exactly</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {dnsRecords.map((record, index) => (
          <div key={index} className="card bg-base-100 border shadow-sm">
            <div className="card-body p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <span className={`badge ${
                    record.type === 'TXT' ? 'badge-primary' :
                    record.type === 'CNAME' ? 'badge-secondary' :
                    record.type === 'MX' ? 'badge-accent' : 'badge-neutral'
                  }`}>
                    {record.type}
                  </span>
                  <span className="font-medium">{record.record}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => copyToClipboard(record.value)}
                >
                  📋 Copy Value
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <label className="font-medium text-gray-600">Host/Name:</label>
                  <p className="font-mono bg-gray-100 p-2 rounded mt-1 break-all">
                    {record.name}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <label className="font-medium text-gray-600">Value:</label>
                  <p className="font-mono bg-gray-100 p-2 rounded mt-1 break-all">
                    {record.value}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <div className="text-yellow-500 text-xl">⚠️</div>
          <div>
            <h4 className="font-medium text-yellow-900 mb-2">DNS Propagation</h4>
            <p className="text-sm text-yellow-800">
              After adding these records, it may take a few minutes to 24 hours for changes to propagate. 
              We'll automatically verify your domain once the records are detected.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setCurrentStep(1)}
        >
          Back
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setCurrentStep(3)}
        >
          I've Added the Records
        </button>
      </div>
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Domain Verification</h3>
        <p className="text-gray-600 mb-6">
          We're checking your DNS records to verify domain ownership. This process is automatic.
        </p>
      </div>

      <div className="text-center space-y-6">
        {verificationStatus === 'pending' && (
          <div>
            <div className="text-6xl mb-4">⏳</div>
            <h4 className="text-lg font-medium mb-2">Ready to Verify</h4>
            <p className="text-gray-600 mb-4">
              Click the button below to start checking your DNS records.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={startVerificationPolling}
            >
              Start Verification
            </button>
          </div>
        )}

        {verificationStatus === 'checking' && (
          <div>
            <div className="text-6xl mb-4">🔍</div>
            <h4 className="text-lg font-medium mb-2">Checking DNS Records...</h4>
            <p className="text-gray-600 mb-4">
              This may take a few minutes. We'll automatically detect when your records are ready.
            </p>
            <div className="loading loading-spinner loading-lg"></div>
            <div className="mt-4">
              <progress className="progress progress-primary w-full max-w-xs"></progress>
            </div>
          </div>
        )}

        {verificationStatus === 'failed' && (
          <div>
            <div className="text-6xl mb-4">❌</div>
            <h4 className="text-lg font-medium text-error mb-2">Verification Failed</h4>
            <p className="text-gray-600 mb-4">
              We couldn't verify your DNS records. Please check that you've added all records correctly.
            </p>
            <div className="space-x-4">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setCurrentStep(2)}
              >
                Review DNS Records
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setVerificationStatus('pending')
                  setError(null)
                }}
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="alert alert-error">
          <span>❌ {error}</span>
        </div>
      )}

      <div className="bg-gray-50 border rounded-lg p-4">
        <h5 className="font-medium mb-2">Troubleshooting Tips:</h5>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Make sure all DNS records are added exactly as shown</li>
          <li>• DNS changes can take up to 24 hours to propagate</li>
          <li>• Try using a DNS checker tool to verify records are live</li>
          <li>• Contact your DNS provider if you need assistance</li>
        </ul>
      </div>

      <div className="flex justify-between">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setCurrentStep(2)}
        >
          Back to DNS
        </button>
        {checkingStatus && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              if (pollInterval) {
                clearInterval(pollInterval)
                setPollInterval(null)
              }
              setCheckingStatus(false)
              setVerificationStatus('pending')
            }}
          >
            Stop Checking
          </button>
        )}
      </div>
    </div>
  )

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-6">
        <div className="text-6xl">🎉</div>
        <div>
          <h3 className="text-2xl font-semibold text-success mb-2">Domain Verified Successfully!</h3>
          <p className="text-gray-600">
            Your domain <strong>{createdDomain?.domain_name}</strong> is now ready to send emails.
          </p>
        </div>

        {createdDomain && (
          <div className="card bg-base-100 border shadow-sm max-w-md mx-auto">
            <div className="card-body p-6">
              <h4 className="font-medium mb-4">Domain Details</h4>
              <div className="space-y-3 text-left">
                <div>
                  <span className="text-sm font-medium text-gray-600">Domain:</span>
                  <p className="font-mono">{createdDomain.domain_name}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">From Email:</span>
                  <p className="font-mono">{createdDomain.default_from_email}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">From Name:</span>
                  <p>{createdDomain.default_from_name}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Status:</span>
                  <span className="badge badge-success ml-2">Verified</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h5 className="font-medium text-green-900 mb-2">What's Next?</h5>
          <ul className="text-sm text-green-800 space-y-1 text-left">
            <li>✅ Your domain is ready to send emails</li>
            <li>✅ All outbound emails will use your custom domain</li>
            <li>✅ You can create email templates using this domain</li>
            <li>✅ Email analytics and tracking are enabled</li>
          </ul>
        </div>
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            if (onComplete && createdDomain) {
              onComplete(createdDomain)
            }
          }}
        >
          Complete Setup
        </button>
      </div>
    </div>
  )

  return (
    <div className={`domain-setup-wizard ${className}`}>
      {/* Progress Steps */}
      <div className="steps steps-horizontal w-full mb-8">
        {steps.map((step) => (
          <div 
            key={step.number}
            className={`step ${currentStep >= step.number ? 'step-primary' : ''}`}
          >
            <div className="step-content text-center">
              <div className="font-medium">{step.title}</div>
              <div className="text-xs text-gray-500 mt-1">{step.description}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="card bg-base-100 shadow-lg">
        <div className="card-body p-8">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
        </div>
      </div>
    </div>
  )
}

export default DomainSetupWizard