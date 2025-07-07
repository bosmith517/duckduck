import React, { useState, useEffect } from 'react'
import { emailService } from '../../services/emailService'
import { showToast } from '../../utils/toast'
import { EmailComposeModal } from './EmailComposeModal'
import { supabase } from '../../../supabaseClient'

interface EmailMessage {
  id: string
  to_email: string
  from_email: string
  from_name?: string
  subject: string
  html_body?: string
  text_body?: string
  direction: 'inbound' | 'outbound'
  status: string
  created_at: string
  sent_at?: string
  opened_at?: string
  thread_id?: string
  has_attachments?: boolean
  attachments?: any[]
}

interface EmailHistoryProps {
  contactId?: string
  accountId?: string
  leadId?: string
  jobId?: string
  className?: string
  showComposer?: boolean
}

export const EmailHistory: React.FC<EmailHistoryProps> = ({
  contactId,
  accountId,
  leadId,
  jobId,
  className = '',
  showComposer = false
}) => {
  const [emails, setEmails] = useState<EmailMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null)
  const [showFullThread, setShowFullThread] = useState(false)
  const [threadEmails, setThreadEmails] = useState<EmailMessage[]>([])
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterDirection, setFilterDirection] = useState('all')
  const [showComposeModal, setShowComposeModal] = useState(false)
  const [contactInfo, setContactInfo] = useState<{ email?: string, name?: string } | null>(null)

  useEffect(() => {
    fetchEmails()
    if (contactId) {
      fetchContactInfo()
    }
  }, [contactId, accountId, leadId, jobId, filterStatus, filterDirection])

  const fetchContactInfo = async () => {
    if (!contactId) return
    
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('email, first_name, last_name')
        .eq('id', contactId)
        .single()
      
      if (data && !error) {
        setContactInfo({
          email: data.email,
          name: `${data.first_name} ${data.last_name}`.trim()
        })
      }
    } catch (error) {
      console.error('Error fetching contact info:', error)
    }
  }

  const fetchEmails = async () => {
    try {
      setLoading(true)
      
      const filters: any = {}
      if (contactId) filters.contact_id = contactId
      if (accountId) filters.account_id = accountId
      if (leadId) filters.lead_id = leadId
      if (jobId) filters.job_id = jobId
      if (filterStatus !== 'all') filters.status = filterStatus
      if (filterDirection !== 'all') filters.direction = filterDirection

      const { emails: data } = await emailService.getEmailHistory(filters)
      setEmails(data)
    } catch (error) {
      console.error('Error fetching emails:', error)
      showToast.error('Failed to load email history')
    } finally {
      setLoading(false)
    }
  }

  const fetchThread = async (threadId: string) => {
    try {
      const threadData = await emailService.getEmailThread(threadId)
      setThreadEmails(threadData)
      setShowFullThread(true)
    } catch (error) {
      console.error('Error fetching email thread:', error)
      showToast.error('Failed to load email thread')
    }
  }

  const formatDateTime = (timestamp: string): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 24) {
      return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } else if (diffInHours < 48) {
      return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } else {
      return date.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
      })
    }
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      'sent': 'badge-light-success',
      'delivered': 'badge-light-success',
      'opened': 'badge-light-info',
      'bounced': 'badge-light-danger',
      'failed': 'badge-light-danger',
      'pending': 'badge-light-warning',
      'draft': 'badge-light-secondary'
    }
    return badges[status as keyof typeof badges] || 'badge-light-secondary'
  }

  const getDirectionIcon = (direction: string) => {
    return direction === 'inbound' ? (
      <i className="ki-duotone ki-entrance-left fs-4 text-primary">
        <span className="path1"></span>
        <span className="path2"></span>
      </i>
    ) : (
      <i className="ki-duotone ki-exit-right fs-4 text-info">
        <span className="path1"></span>
        <span className="path2"></span>
      </i>
    )
  }

  if (loading) {
    return (
      <div className={`card ${className}`}>
        <div className='card-body'>
          <div className='d-flex justify-content-center py-10'>
            <div className='spinner-border text-primary' role='status'>
              <span className='visually-hidden'>Loading email history...</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`card ${className}`}>
      <div className='card-header border-0'>
        <h3 className='card-title fw-bold'>Email History</h3>
        <div className='card-toolbar'>
          <div className='d-flex gap-2'>
            <select
              className='form-select form-select-sm w-120px'
              value={filterDirection}
              onChange={(e) => setFilterDirection(e.target.value)}
            >
              <option value='all'>All Emails</option>
              <option value='outbound'>Sent</option>
              <option value='inbound'>Received</option>
            </select>
            
            <select
              className='form-select form-select-sm w-120px'
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value='all'>All Status</option>
              <option value='sent'>Sent</option>
              <option value='delivered'>Delivered</option>
              <option value='opened'>Opened</option>
              <option value='bounced'>Bounced</option>
              <option value='failed'>Failed</option>
            </select>

            {showComposer && (
              <button 
                className='btn btn-sm btn-primary'
                onClick={() => setShowComposeModal(true)}
              >
                <i className='ki-duotone ki-message-add fs-4 me-2'>
                  <span className='path1'></span>
                  <span className='path2'></span>
                  <span className='path3'></span>
                </i>
                Compose
              </button>
            )}
          </div>
        </div>
      </div>

      <div className='card-body p-0'>
        {emails.length === 0 ? (
          <div className='text-center py-10'>
            <div className='text-muted mb-3'>
              <i className='ki-duotone ki-message-text fs-3x text-muted mb-3'>
                <span className='path1'></span>
                <span className='path2'></span>
                <span className='path3'></span>
              </i>
            </div>
            <div className='text-muted'>
              No emails found. Emails sent to or from this contact will appear here.
            </div>
          </div>
        ) : (
          <div className='table-responsive'>
            <table className='table table-hover table-row-bordered gy-3'>
              <thead>
                <tr className='fw-bold text-gray-700 border-bottom-2'>
                  <th className='w-50px'></th>
                  <th className='min-w-200px'>Subject</th>
                  <th className='min-w-150px'>From/To</th>
                  <th className='min-w-100px'>Status</th>
                  <th className='min-w-150px'>Date</th>
                  <th className='w-50px'></th>
                </tr>
              </thead>
              <tbody>
                {emails.map((email) => (
                  <tr 
                    key={email.id}
                    className='cursor-pointer'
                    onClick={() => setSelectedEmail(email)}
                  >
                    <td className='text-center'>
                      {getDirectionIcon(email.direction)}
                    </td>
                    <td>
                      <div className='d-flex flex-column'>
                        <span className='fw-bold text-gray-800'>{email.subject}</span>
                        {email.thread_id && (
                          <span className='text-muted fs-7'>
                            Part of conversation
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className='d-flex flex-column'>
                        <span className='text-gray-800'>
                          {email.direction === 'inbound' ? email.from_email : email.to_email}
                        </span>
                        {email.from_name && (
                          <span className='text-muted fs-7'>{email.from_name}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadge(email.status)}`}>
                        {email.status}
                      </span>
                      {email.opened_at && (
                        <div className='text-muted fs-7 mt-1'>
                          Opened {formatDateTime(email.opened_at)}
                        </div>
                      )}
                    </td>
                    <td className='text-muted'>
                      {formatDateTime(email.created_at)}
                    </td>
                    <td>
                      {email.has_attachments && (
                        <i className='ki-duotone ki-paper-clip fs-3 text-muted'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                        </i>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Email Detail Modal */}
      {selectedEmail && (
        <div className='modal fade show d-block' tabIndex={-1}>
          <div className='modal-dialog modal-dialog-centered modal-lg'>
            <div className='modal-content'>
              <div className='modal-header'>
                <h5 className='modal-title'>{selectedEmail.subject}</h5>
                <button
                  type='button'
                  className='btn-close'
                  onClick={() => {
                    setSelectedEmail(null)
                    setShowFullThread(false)
                  }}
                ></button>
              </div>
              <div className='modal-body'>
                <div className='mb-5'>
                  <div className='d-flex justify-content-between align-items-start mb-3'>
                    <div>
                      <div className='fw-bold text-gray-800'>
                        From: {selectedEmail.from_name || selectedEmail.from_email}
                      </div>
                      <div className='text-muted'>
                        To: {selectedEmail.to_email}
                      </div>
                    </div>
                    <div className='text-end'>
                      <div className='text-muted fs-7'>
                        {formatDateTime(selectedEmail.created_at)}
                      </div>
                      <span className={`badge ${getStatusBadge(selectedEmail.status)}`}>
                        {selectedEmail.status}
                      </span>
                    </div>
                  </div>

                  {selectedEmail.thread_id && !showFullThread && (
                    <button
                      className='btn btn-sm btn-light-primary mb-3'
                      onClick={() => fetchThread(selectedEmail.thread_id!)}
                    >
                      <i className='ki-duotone ki-message-text fs-4 me-2'>
                        <span className='path1'></span>
                        <span className='path2'></span>
                        <span className='path3'></span>
                      </i>
                      View Full Thread
                    </button>
                  )}
                </div>

                {showFullThread && threadEmails.length > 0 ? (
                  <div className='timeline'>
                    {threadEmails.map((threadEmail, index) => (
                      <div key={threadEmail.id} className={`timeline-item ${index === threadEmails.length - 1 ? 'active' : ''}`}>
                        <div className='timeline-line'></div>
                        <div className='timeline-icon'>
                          <i className='ki-duotone ki-message-text fs-2 text-gray-500'>
                            <span className='path1'></span>
                            <span className='path2'></span>
                            <span className='path3'></span>
                          </i>
                        </div>
                        <div className='timeline-content mb-5'>
                          <div className='fw-bold text-gray-800 mb-2'>
                            {threadEmail.from_name || threadEmail.from_email}
                          </div>
                          <div className='text-muted fs-7 mb-2'>
                            {formatDateTime(threadEmail.created_at)}
                          </div>
                          <div className='border rounded p-4 bg-light'>
                            {threadEmail.html_body ? (
                              <div dangerouslySetInnerHTML={{ __html: threadEmail.html_body }} />
                            ) : (
                              <pre className='mb-0'>{threadEmail.text_body}</pre>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className='border rounded p-5 bg-light'>
                    {selectedEmail.html_body ? (
                      <div dangerouslySetInnerHTML={{ __html: selectedEmail.html_body }} />
                    ) : (
                      <pre className='mb-0'>{selectedEmail.text_body}</pre>
                    )}
                  </div>
                )}

                {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                  <div className='mt-5'>
                    <h6 className='fw-bold mb-3'>Attachments</h6>
                    <div className='d-flex flex-wrap gap-3'>
                      {selectedEmail.attachments.map((attachment: any, index: number) => (
                        <div key={index} className='border rounded p-3'>
                          <i className='ki-duotone ki-file fs-2x text-primary mb-2'>
                            <span className='path1'></span>
                            <span className='path2'></span>
                          </i>
                          <div className='text-muted fs-7'>{attachment.name}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className='modal-footer'>
                <button
                  type='button'
                  className='btn btn-light'
                  onClick={() => {
                    setSelectedEmail(null)
                    setShowFullThread(false)
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Compose Modal */}
      {showComposeModal && (
        <EmailComposeModal
          isOpen={showComposeModal}
          onClose={() => {
            setShowComposeModal(false)
            fetchEmails() // Refresh emails after sending
          }}
          contactId={contactId}
          contactEmail={contactInfo?.email}
          contactName={contactInfo?.name}
          accountId={accountId}
          leadId={leadId}
          jobId={jobId}
        />
      )}
    </div>
  )
}