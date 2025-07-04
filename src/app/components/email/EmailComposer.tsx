import React, { useState, useEffect } from 'react'
import { emailService, EmailDomain, EmailTemplate } from '../../services/emailService'

interface EmailComposerProps {
  className?: string
}

const EmailComposer: React.FC<EmailComposerProps> = ({ className = '' }) => {
  const [loading, setLoading] = useState(false)
  const [domains, setDomains] = useState<EmailDomain[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [emailData, setEmailData] = useState({
    to: '',
    cc: '',
    bcc: '',
    subject: '',
    html: '',
    text: '',
    from_domain: '',
    priority: 5,
    scheduled_at: ''
  })

  useEffect(() => {
    loadDomains()
    loadTemplates()
  }, [])

  const loadDomains = async () => {
    try {
      const result = await emailService.getDomains()
      setDomains(result.domains.filter(d => d.status === 'verified'))
    } catch (err) {
      console.error('Failed to load domains:', err)
    }
  }

  const loadTemplates = async () => {
    try {
      const result = await emailService.getTemplates()
      setTemplates(result.templates)
    } catch (err) {
      console.error('Failed to load templates:', err)
    }
  }

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId)
    if (template) {
      setEmailData(prev => ({
        ...prev,
        subject: template.subject_template,
        html: template.html_template || '',
        text: template.text_template || ''
      }))
    }
    setSelectedTemplate(templateId)
  }

  const handleSend = async () => {
    if (!emailData.to || !emailData.subject) {
      setError('To and Subject fields are required')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await emailService.sendEmail({
        to: emailData.to.split(',').map(email => email.trim()),
        cc: emailData.cc ? emailData.cc.split(',').map(email => email.trim()) : undefined,
        bcc: emailData.bcc ? emailData.bcc.split(',').map(email => email.trim()) : undefined,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
        priority: emailData.priority,
        scheduled_at: emailData.scheduled_at || undefined
      })

      setSuccess(`Email sent successfully! ID: ${result.message_id || 'N/A'}`)
      
      // Reset form
      setEmailData({
        to: '',
        cc: '',
        bcc: '',
        subject: '',
        html: '',
        text: '',
        from_domain: '',
        priority: 5,
        scheduled_at: ''
      })
      setSelectedTemplate('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveDraft = async () => {
    setLoading(true)
    try {
      // In a real implementation, you'd save to drafts table
      setSuccess('Draft saved (feature to be implemented)')
    } catch (err) {
      setError('Failed to save draft')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`email-composer ${className}`}>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <span className="me-2">✉️</span>
            Compose Email
          </h3>
          <div className="card-toolbar">
            <button
              type="button"
              className="btn btn-sm btn-light me-2"
              onClick={handleSaveDraft}
              disabled={loading}
            >
              💾 Save Draft
            </button>
            <button
              type="button"
              className={`btn btn-sm btn-primary ${loading ? 'loading' : ''}`}
              onClick={handleSend}
              disabled={loading || !emailData.to || !emailData.subject}
            >
              {loading ? 'Sending...' : '📤 Send Email'}
            </button>
          </div>
        </div>

        <div className="card-body">
          {error && (
            <div className="alert alert-danger d-flex align-items-center">
              <span>❌ {error}</span>
            </div>
          )}

          {success && (
            <div className="alert alert-success d-flex align-items-center">
              <span>✅ {success}</span>
            </div>
          )}

          <div className="row mb-6">
            {/* Template Selector */}
            <div className="col-md-6">
              <label className="form-label">Email Template (Optional)</label>
              <select
                className="form-select"
                value={selectedTemplate}
                onChange={(e) => handleTemplateSelect(e.target.value)}
              >
                <option value="">Select a template...</option>
                {templates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.template_name}
                  </option>
                ))}
              </select>
            </div>

            {/* From Domain */}
            <div className="col-md-6">
              <label className="form-label">From Domain</label>
              <select
                className="form-select"
                value={emailData.from_domain}
                onChange={(e) => setEmailData(prev => ({ ...prev, from_domain: e.target.value }))}
              >
                <option value="">Use default domain</option>
                {domains.map(domain => (
                  <option key={domain.id} value={domain.id}>
                    {domain.domain_name} ({domain.default_from_email})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="row mb-6">
            {/* Recipients */}
            <div className="col-12">
              <label className="form-label required">To</label>
              <input
                type="email"
                className="form-control"
                placeholder="recipient@example.com, another@example.com"
                value={emailData.to}
                onChange={(e) => setEmailData(prev => ({ ...prev, to: e.target.value }))}
                multiple
              />
              <div className="form-text">Separate multiple emails with commas</div>
            </div>
          </div>

          <div className="row mb-6">
            <div className="col-md-6">
              <label className="form-label">CC</label>
              <input
                type="email"
                className="form-control"
                placeholder="cc@example.com"
                value={emailData.cc}
                onChange={(e) => setEmailData(prev => ({ ...prev, cc: e.target.value }))}
                multiple
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">BCC</label>
              <input
                type="email"
                className="form-control"
                placeholder="bcc@example.com"
                value={emailData.bcc}
                onChange={(e) => setEmailData(prev => ({ ...prev, bcc: e.target.value }))}
                multiple
              />
            </div>
          </div>

          <div className="row mb-6">
            <div className="col-md-8">
              <label className="form-label required">Subject</label>
              <input
                type="text"
                className="form-control"
                placeholder="Email subject"
                value={emailData.subject}
                onChange={(e) => setEmailData(prev => ({ ...prev, subject: e.target.value }))}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label">Priority</label>
              <select
                className="form-select"
                value={emailData.priority}
                onChange={(e) => setEmailData(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
              >
                <option value={1}>🔴 High</option>
                <option value={5}>🟡 Normal</option>
                <option value={10}>🔵 Low</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label">Schedule</label>
              <input
                type="datetime-local"
                className="form-control"
                value={emailData.scheduled_at}
                onChange={(e) => setEmailData(prev => ({ ...prev, scheduled_at: e.target.value }))}
              />
            </div>
          </div>

          {/* Email Content */}
          <div className="row mb-6">
            <div className="col-12">
              <label className="form-label">HTML Content</label>
              <textarea
                className="form-control"
                rows={12}
                placeholder="<h1>Hello!</h1><p>Your email content here...</p>"
                value={emailData.html}
                onChange={(e) => setEmailData(prev => ({ ...prev, html: e.target.value }))}
              />
              <div className="form-text">
                You can use HTML tags for formatting. Variables like {`{{name}}`} will be replaced if using templates.
              </div>
            </div>
          </div>

          <div className="row mb-6">
            <div className="col-12">
              <label className="form-label">Plain Text Content (Optional)</label>
              <textarea
                className="form-control"
                rows={6}
                placeholder="Plain text version of your email..."
                value={emailData.text}
                onChange={(e) => setEmailData(prev => ({ ...prev, text: e.target.value }))}
              />
              <div className="form-text">
                Plain text fallback for email clients that don't support HTML
              </div>
            </div>
          </div>

          {/* Preview */}
          {emailData.html && (
            <div className="row mb-6">
              <div className="col-12">
                <label className="form-label">Preview</label>
                <div className="border p-4 bg-light rounded">
                  <div className="mb-2">
                    <strong>Subject:</strong> {emailData.subject}
                  </div>
                  <div className="mb-2">
                    <strong>To:</strong> {emailData.to}
                  </div>
                  <hr />
                  <div 
                    dangerouslySetInnerHTML={{ __html: emailData.html }}
                    style={{ maxHeight: '300px', overflow: 'auto' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Domain Status */}
          {domains.length === 0 && (
            <div className="alert alert-warning">
              ⚠️ No verified email domains found. 
              <a href="#" onClick={() => window.location.hash = '#setup'} className="alert-link ms-2">
                Set up a domain first
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default EmailComposer