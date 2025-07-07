import React, { useState, useEffect } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import clsx from 'clsx'
import { emailService } from '../../services/emailService'
import { showToast } from '../../utils/toast'
import { supabase } from '../../../supabaseClient'

interface EmailComposeModalProps {
  isOpen: boolean
  onClose: () => void
  contactId?: string
  contactEmail?: string
  contactName?: string
  accountId?: string
  leadId?: string
  jobId?: string
  replyTo?: {
    subject: string
    messageId: string
    threadId: string
  }
}

const emailSchema = Yup.object().shape({
  to: Yup.string()
    .email('Invalid email format')
    .required('Recipient email is required'),
  subject: Yup.string()
    .required('Subject is required'),
  body: Yup.string()
    .required('Email body is required'),
  cc: Yup.string(),
  bcc: Yup.string()
})

export const EmailComposeModal: React.FC<EmailComposeModalProps> = ({
  isOpen,
  onClose,
  contactId,
  contactEmail = '',
  contactName = '',
  accountId,
  leadId,
  jobId,
  replyTo
}) => {
  const [loading, setLoading] = useState(false)
  const [templates, setTemplates] = useState<any[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [preview, setPreview] = useState(false)

  const formik = useFormik({
    initialValues: {
      to: contactEmail,
      cc: '',
      bcc: '',
      subject: replyTo ? `Re: ${replyTo.subject}` : '',
      body: '',
      priority: 5,
      scheduledAt: ''
    },
    validationSchema: emailSchema,
    onSubmit: async (values) => {
      await handleSendEmail(values)
    }
  })

  useEffect(() => {
    if (isOpen) {
      loadTemplates()
    }
  }, [isOpen])

  const loadTemplates = async () => {
    try {
      const result = await emailService.getTemplates()
      setTemplates(result.templates)
    } catch (error) {
      console.error('Failed to load templates:', error)
    }
  }

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId)
    if (template) {
      // Replace variables in template
      let subject = template.subject_template
      let body = template.html_template || template.text_template || ''
      
      // Simple variable replacement
      const variables = {
        contact_name: contactName,
        first_name: contactName.split(' ')[0],
        last_name: contactName.split(' ')[1] || '',
        company_name: 'Your Company' // Would come from tenant settings
      }
      
      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
        subject = subject.replace(regex, value)
        body = body.replace(regex, value)
      })
      
      formik.setFieldValue('subject', subject)
      formik.setFieldValue('body', body)
    }
    setSelectedTemplate(templateId)
  }

  const handleSendEmail = async (values: any) => {
    setLoading(true)
    try {
      // Get current user for metadata
      const { data: { user } } = await supabase.auth.getUser()
      
      // Prepare email request
      const emailRequest: any = {
        to: values.to,
        subject: values.subject,
        html: `<div>${values.body.replace(/\n/g, '<br>')}</div>`,
        text: values.body,
        priority: values.priority
      }

      if (values.cc) {
        emailRequest.cc = values.cc
      }
      if (values.bcc) {
        emailRequest.bcc = values.bcc
      }
      if (values.scheduledAt) {
        emailRequest.scheduled_at = new Date(values.scheduledAt).toISOString()
      }

      // Add metadata for tracking
      emailRequest.tags = {
        contact_id: contactId,
        account_id: accountId,
        lead_id: leadId,
        job_id: jobId,
        sent_by: user?.id,
        reply_to_message: replyTo?.messageId,
        thread_id: replyTo?.threadId
      }

      const result = await emailService.sendEmail(emailRequest)
      
      showToast.success('Email sent successfully!')
      onClose()
      formik.resetForm()
      
    } catch (error) {
      console.error('Error sending email:', error)
      showToast.error('Failed to send email')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className='modal fade show d-block' tabIndex={-1}>
      <div className='modal-dialog modal-dialog-centered modal-lg'>
        <div className='modal-content'>
          <div className='modal-header'>
            <h5 className='modal-title'>
              <i className='ki-duotone ki-message-add fs-2 me-2'>
                <span className='path1'></span>
                <span className='path2'></span>
                <span className='path3'></span>
              </i>
              Compose Email
            </h5>
            <button
              type='button'
              className='btn-close'
              onClick={onClose}
              disabled={loading}
            ></button>
          </div>

          <form onSubmit={formik.handleSubmit} noValidate>
            <div className='modal-body'>
              {/* Template Selection */}
              {templates.length > 0 && (
                <div className='mb-5'>
                  <label className='form-label'>Email Template (Optional)</label>
                  <select
                    className='form-select form-select-solid'
                    value={selectedTemplate}
                    onChange={(e) => handleTemplateSelect(e.target.value)}
                  >
                    <option value=''>-- Select a template --</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.template_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* To Field */}
              <div className='mb-5'>
                <label className='required form-label'>To</label>
                <input
                  type='email'
                  className={clsx('form-control form-control-solid', {
                    'is-invalid': formik.touched.to && formik.errors.to
                  })}
                  placeholder='recipient@example.com'
                  {...formik.getFieldProps('to')}
                />
                {formik.touched.to && formik.errors.to && (
                  <div className='fv-plugins-message-container'>
                    <span role='alert'>{formik.errors.to}</span>
                  </div>
                )}
              </div>

              {/* CC/BCC Row */}
              <div className='row'>
                <div className='col-md-6 mb-5'>
                  <label className='form-label'>CC</label>
                  <input
                    type='text'
                    className='form-control form-control-solid'
                    placeholder='cc@example.com'
                    {...formik.getFieldProps('cc')}
                  />
                </div>
                <div className='col-md-6 mb-5'>
                  <label className='form-label'>BCC</label>
                  <input
                    type='text'
                    className='form-control form-control-solid'
                    placeholder='bcc@example.com'
                    {...formik.getFieldProps('bcc')}
                  />
                </div>
              </div>

              {/* Subject */}
              <div className='mb-5'>
                <label className='required form-label'>Subject</label>
                <input
                  type='text'
                  className={clsx('form-control form-control-solid', {
                    'is-invalid': formik.touched.subject && formik.errors.subject
                  })}
                  placeholder='Email subject'
                  {...formik.getFieldProps('subject')}
                />
                {formik.touched.subject && formik.errors.subject && (
                  <div className='fv-plugins-message-container'>
                    <span role='alert'>{formik.errors.subject}</span>
                  </div>
                )}
              </div>

              {/* Body */}
              <div className='mb-5'>
                <label className='required form-label'>Message</label>
                {preview ? (
                  <div className='border rounded p-5 bg-light-secondary'>
                    <div dangerouslySetInnerHTML={{ 
                      __html: formik.values.body.replace(/\n/g, '<br>') 
                    }} />
                  </div>
                ) : (
                  <textarea
                    className={clsx('form-control form-control-solid', {
                      'is-invalid': formik.touched.body && formik.errors.body
                    })}
                    rows={10}
                    placeholder='Type your message here...'
                    {...formik.getFieldProps('body')}
                  />
                )}
                {formik.touched.body && formik.errors.body && (
                  <div className='fv-plugins-message-container'>
                    <span role='alert'>{formik.errors.body}</span>
                  </div>
                )}
              </div>

              {/* Options Row */}
              <div className='row'>
                <div className='col-md-6 mb-5'>
                  <label className='form-label'>Priority</label>
                  <select
                    className='form-select form-select-solid'
                    {...formik.getFieldProps('priority')}
                  >
                    <option value={1}>Highest</option>
                    <option value={3}>High</option>
                    <option value={5}>Normal</option>
                    <option value={7}>Low</option>
                    <option value={10}>Lowest</option>
                  </select>
                </div>
                <div className='col-md-6 mb-5'>
                  <label className='form-label'>Schedule Send</label>
                  <input
                    type='datetime-local'
                    className='form-control form-control-solid'
                    min={new Date().toISOString().slice(0, 16)}
                    {...formik.getFieldProps('scheduledAt')}
                  />
                  <div className='form-text'>Leave blank to send immediately</div>
                </div>
              </div>
            </div>

            <div className='modal-footer'>
              <button
                type='button'
                className='btn btn-light me-3'
                onClick={() => setPreview(!preview)}
                disabled={loading}
              >
                {preview ? 'Edit' : 'Preview'}
              </button>
              <button
                type='button'
                className='btn btn-light'
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type='submit'
                className='btn btn-primary'
                disabled={loading || !formik.isValid}
              >
                {loading ? (
                  <>
                    <span className='spinner-border spinner-border-sm align-middle me-2'></span>
                    Sending...
                  </>
                ) : (
                  <>
                    <i className='ki-duotone ki-send fs-2 me-2'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                    </i>
                    {formik.values.scheduledAt ? 'Schedule Send' : 'Send Email'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}