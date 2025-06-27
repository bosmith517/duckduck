import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { supabase, Contact } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'
import { ClickablePhoneNumber, PhoneNumberDisplay } from '../../components/communications/ClickablePhoneNumber'
import { SMSChatInterface } from '../../components/communications/SMSChatInterface'
import { VideoMeetingInterface, QuickVideoButton } from '../../components/communications/VideoMeetingInterface'

const ContactDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { userProfile } = useSupabaseAuth()
  const [contact, setContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    if (id && userProfile?.tenant_id) {
      fetchContact()
    }
  }, [id, userProfile?.tenant_id])

  const fetchContact = async () => {
    if (!id) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          *,
          account:accounts(*)
        `)
        .eq('id', id)
        .eq('tenant_id', userProfile?.tenant_id)
        .single()

      if (error) {
        console.error('Error fetching contact:', error)
        showToast.error('Failed to load contact details')
        navigate('/contacts')
        return
      }

      setContact(data)
    } catch (error) {
      console.error('Error in fetchContact:', error)
      showToast.error('Failed to load contact details')
      navigate('/contacts')
    } finally {
      setLoading(false)
    }
  }

  const handleEditContact = () => {
    navigate(`/contacts?edit=${id}`)
  }

  const handleDeleteContact = async () => {
    if (!contact || !window.confirm('Are you sure you want to delete this contact?')) return

    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', contact.id)
        .eq('tenant_id', userProfile?.tenant_id)

      if (error) {
        console.error('Error deleting contact:', error)
        showToast.error('Failed to delete contact')
        return
      }

      showToast.success('Contact deleted successfully')
      navigate('/contacts')
    } catch (error) {
      console.error('Error in handleDeleteContact:', error)
      showToast.error('Failed to delete contact')
    }
  }

  if (loading) {
    return (
      <>
        <PageTitle breadcrumbs={[{ title: 'Contacts', path: '/contacts', isActive: false }]}>
          Loading Contact...
        </PageTitle>
        <div className='d-flex justify-content-center py-10'>
          <div className='spinner-border text-primary' role='status'>
            <span className='visually-hidden'>Loading contact...</span>
          </div>
        </div>
      </>
    )
  }

  if (!contact) {
    return (
      <>
        <PageTitle breadcrumbs={[{ title: 'Contacts', path: '/contacts', isActive: false }]}>
          Contact Not Found
        </PageTitle>
        <div className='text-center py-10'>
          <div className='text-muted'>Contact not found or you don't have permission to view it.</div>
        </div>
      </>
    )
  }

  const contactName = `${contact.first_name} ${contact.last_name}`
  const primaryPhone = contact.mobile || contact.phone

  return (
    <>
      <PageTitle breadcrumbs={[{ title: 'Contacts', path: '/contacts', isActive: false }]}>
        {contactName}
      </PageTitle>

      {/* Contact Header */}
      <div className='row g-5 g-xl-8 mb-5'>
        <div className='col-xl-12'>
          <KTCard>
            <KTCardBody className='py-5'>
              <div className='d-flex align-items-center justify-content-between'>
                <div className='d-flex align-items-center'>
                  {/* Avatar */}
                  <div className='symbol symbol-100px me-5'>
                    <div className='symbol-label fs-1 bg-light-primary text-primary'>
                      {contact.first_name.charAt(0)}{contact.last_name.charAt(0)}
                    </div>
                  </div>
                  
                  {/* Contact Info */}
                  <div className='d-flex flex-column'>
                    <h1 className='text-gray-800 fw-bold mb-1'>{contactName}</h1>
                    {contact.title && (
                      <div className='text-muted fw-semibold fs-5 mb-2'>{contact.title}</div>
                    )}
                    {contact.account && (
                      <div className='d-flex align-items-center mb-2'>
                        <i className='ki-duotone ki-office-bag fs-4 text-muted me-2'></i>
                        <span className='text-muted fw-semibold'>{contact.account.name}</span>
                      </div>
                    )}
                    {contact.is_primary && (
                      <span className='badge badge-light-success fw-bold'>Primary Contact</span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className='d-flex gap-2'>
                  {primaryPhone && (
                    <ClickablePhoneNumber
                      phoneNumber={primaryPhone}
                      contactId={contact.id}
                      contactName={contactName}
                      className='btn btn-primary btn-sm'
                    />
                  )}
                  <QuickVideoButton
                    contactId={contact.id}
                    contactName={contactName}
                    className='btn btn-success btn-sm'
                  />
                  <button
                    className='btn btn-light btn-sm'
                    onClick={handleEditContact}
                  >
                    <i className='ki-duotone ki-pencil fs-4'></i>
                    Edit
                  </button>
                  <button
                    className='btn btn-light-danger btn-sm'
                    onClick={handleDeleteContact}
                  >
                    <i className='ki-duotone ki-trash fs-4'></i>
                    Delete
                  </button>
                </div>
              </div>
            </KTCardBody>
          </KTCard>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className='row g-5 g-xl-8 mb-5'>
        <div className='col-xl-12'>
          <ul className='nav nav-tabs nav-line-tabs nav-line-tabs-2x mb-5 fs-6'>
            <li className='nav-item'>
              <a
                className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
                style={{ cursor: 'pointer' }}
              >
                <i className='ki-duotone ki-profile-circle fs-2 me-2'></i>
                Overview
              </a>
            </li>
            {primaryPhone && (
              <li className='nav-item'>
                <a
                  className={`nav-link ${activeTab === 'sms' ? 'active' : ''}`}
                  onClick={() => setActiveTab('sms')}
                  style={{ cursor: 'pointer' }}
                >
                  <i className='ki-duotone ki-message-text-2 fs-2 me-2'></i>
                  SMS Messages
                </a>
              </li>
            )}
            <li className='nav-item'>
              <a
                className={`nav-link ${activeTab === 'video' ? 'active' : ''}`}
                onClick={() => setActiveTab('video')}
                style={{ cursor: 'pointer' }}
              >
                <i className='ki-duotone ki-video fs-2 me-2'></i>
                Video Meetings
              </a>
            </li>
            <li className='nav-item'>
              <a
                className={`nav-link ${activeTab === 'activity' ? 'active' : ''}`}
                onClick={() => setActiveTab('activity')}
                style={{ cursor: 'pointer' }}
              >
                <i className='ki-duotone ki-chart-simple fs-2 me-2'></i>
                Activity
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Tab Content */}
      <div className='row g-5 g-xl-8'>
        {activeTab === 'overview' && (
          <>
            {/* Contact Information */}
            <div className='col-xl-6'>
              <KTCard>
                <div className='card-header'>
                  <h3 className='card-title'>Contact Information</h3>
                </div>
                <KTCardBody>
                  <div className='row mb-7'>
                    <label className='col-lg-4 fw-semibold text-muted'>Full Name</label>
                    <div className='col-lg-8'>
                      <span className='fw-bold fs-6 text-gray-800'>{contactName}</span>
                    </div>
                  </div>
                  
                  {contact.title && (
                    <div className='row mb-7'>
                      <label className='col-lg-4 fw-semibold text-muted'>Title</label>
                      <div className='col-lg-8'>
                        <span className='fw-bold fs-6 text-gray-800'>{contact.title}</span>
                      </div>
                    </div>
                  )}

                  {contact.email && (
                    <div className='row mb-7'>
                      <label className='col-lg-4 fw-semibold text-muted'>Email</label>
                      <div className='col-lg-8'>
                        <a href={`mailto:${contact.email}`} className='fw-bold fs-6 text-primary'>
                          {contact.email}
                        </a>
                      </div>
                    </div>
                  )}

                  {contact.phone && (
                    <div className='row mb-7'>
                      <label className='col-lg-4 fw-semibold text-muted'>Phone</label>
                      <div className='col-lg-8'>
                        <ClickablePhoneNumber
                          phoneNumber={contact.phone}
                          contactId={contact.id}
                          contactName={contactName}
                          className='fw-bold fs-6'
                        />
                      </div>
                    </div>
                  )}

                  {contact.mobile && (
                    <div className='row mb-7'>
                      <label className='col-lg-4 fw-semibold text-muted'>Mobile</label>
                      <div className='col-lg-8'>
                        <ClickablePhoneNumber
                          phoneNumber={contact.mobile}
                          contactId={contact.id}
                          contactName={contactName}
                          className='fw-bold fs-6'
                        />
                      </div>
                    </div>
                  )}


                  {contact.account && (
                    <div className='row mb-7'>
                      <label className='col-lg-4 fw-semibold text-muted'>Account</label>
                      <div className='col-lg-8'>
                        <span className='fw-bold fs-6 text-gray-800'>{contact.account.name}</span>
                      </div>
                    </div>
                  )}

                  <div className='row mb-7'>
                    <label className='col-lg-4 fw-semibold text-muted'>Primary Contact</label>
                    <div className='col-lg-8'>
                      {contact.is_primary ? (
                        <span className='badge badge-light-success'>Yes</span>
                      ) : (
                        <span className='badge badge-light-secondary'>No</span>
                      )}
                    </div>
                  </div>
                </KTCardBody>
              </KTCard>
            </div>

            {/* Additional Information */}
            <div className='col-xl-6'>
              <KTCard>
                <div className='card-header'>
                  <h3 className='card-title'>Additional Information</h3>
                </div>
                <KTCardBody>
                  {contact.notes ? (
                    <div className='mb-7'>
                      <label className='fw-semibold text-muted mb-3'>Notes</label>
                      <div className='text-gray-800'>
                        {contact.notes.split('\n').map((line, index) => (
                          <div key={index}>{line}</div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className='text-muted text-center py-5'>
                      No additional notes for this contact.
                    </div>
                  )}

                  <div className='row mb-7'>
                    <label className='col-lg-4 fw-semibold text-muted'>Created</label>
                    <div className='col-lg-8'>
                      <span className='fw-bold fs-6 text-gray-800'>
                        {new Date(contact.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className='row mb-7'>
                    <label className='col-lg-4 fw-semibold text-muted'>Last Updated</label>
                    <div className='col-lg-8'>
                      <span className='fw-bold fs-6 text-gray-800'>
                        {new Date(contact.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </KTCardBody>
              </KTCard>
            </div>
          </>
        )}

        {activeTab === 'sms' && primaryPhone && (
          <div className='col-xl-12'>
            <SMSChatInterface
              contactId={contact.id}
              contactName={contactName}
              contactPhone={primaryPhone}
            />
          </div>
        )}

        {activeTab === 'video' && (
          <div className='col-xl-12'>
            <VideoMeetingInterface
              contactId={contact.id}
            />
          </div>
        )}

        {activeTab === 'activity' && (
          <div className='col-xl-12'>
            <KTCard>
              <div className='card-header'>
                <h3 className='card-title'>Recent Activity</h3>
              </div>
              <KTCardBody>
                <div className='text-center py-10'>
                  <div className='text-muted mb-3'>
                    <i className='ki-duotone ki-chart-simple fs-3x text-muted mb-3'></i>
                  </div>
                  <div className='text-muted'>
                    Activity tracking will be available soon. This will show call logs, SMS history, and other interactions with this contact.
                  </div>
                </div>
              </KTCardBody>
            </KTCard>
          </div>
        )}
      </div>
    </>
  )
}

export default ContactDetailsPage
