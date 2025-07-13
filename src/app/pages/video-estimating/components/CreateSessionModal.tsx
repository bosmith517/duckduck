import React, { useState, useEffect } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import clsx from 'clsx'
import { supabase } from '../../../../supabaseClient'
import { useSupabaseAuth } from '../../../modules/auth/core/SupabaseAuth'
import { showToast } from '../../../utils/toast'

interface CreateSessionModalProps {
  onSave: (data: any) => void
  onCancel: () => void
}

const sessionSchema = Yup.object().shape({
  unifiedClientId: Yup.string().required('Customer is required'),
  trade_type: Yup.string()
    .oneOf(['ROOFING', 'PLUMBING', 'HVAC', 'ELECTRICAL'])
    .required('Trade type is required'),
  scheduled_at: Yup.date()
    .min(new Date(), 'Scheduled time must be in the future')
    .required('Scheduled time is required'),
  customer_phone: Yup.string()
    .matches(/^[0-9]{10}$/, 'Phone must be 10 digits')
    .required('Customer phone is required'),
  notes: Yup.string().max(500, 'Maximum 500 characters')
})

export const CreateSessionModal: React.FC<CreateSessionModalProps> = ({
  onSave,
  onCancel
}) => {
  const { userProfile } = useSupabaseAuth()
  const [loading, setLoading] = useState(false)

  const formik = useFormik({
    initialValues: {
      unifiedClientId: '',
      trade_type: '',
      scheduled_at: '',
      customer_phone: '',
      send_sms: true,
      send_email: false,
      notes: ''
    },
    validationSchema: sessionSchema,
    onSubmit: async (values) => {
      setLoading(true)
      try {
        // Extract client type and ID
        const [clientType, clientId] = values.unifiedClientId.split('_')
        
        // Create video room using the existing working function
        const { data: roomResponse, error: roomError } = await supabase.functions.invoke('create-video-room', {
          body: {
            contact_id: clientType === 'contact' ? clientId : null,
            job_id: null,
            participants: [],
            room_name: `AI Video Estimate - ${values.trade_type}`,
            // Add trade type and vision flags in metadata
            trade_type: values.trade_type,
            enable_vision: true
          }
        })

        if (roomError) {
          console.error('Session creation error:', roomError)
          throw new Error(`Failed to create video estimating session: ${roomError.message || 'Unknown error'}`)
        }

        if (!roomResponse || !roomResponse.meeting) {
          throw new Error('Invalid response from room creation')
        }

        const meeting = roomResponse.meeting
        console.log('Video room created:', meeting)
        
        // Create video session record
        const sessionData = {
          tenant_id: userProfile?.tenant_id,
          lead_id: clientType === 'lead' ? clientId : null,
          contact_id: clientType === 'contact' ? clientId : null,
          account_id: clientType === 'account' ? clientId : null,
          trade_type: values.trade_type,
          room_id: meeting.id,
          room_url: meeting.room_url,
          status: values.scheduled_at ? 'scheduled' : 'active',
          scheduled_at: values.scheduled_at || null,
          notes: values.notes || null,
          metadata: {
            room_name: meeting.room_name,
            signalwire_room_id: meeting.id,
            ai_enabled: true,
            vision_enabled: true,
            created_at: new Date().toISOString()
          }
        }

        const { data: session, error: sessionError } = await supabase
          .from('video_sessions')
          .insert([sessionData])
          .select()
          .single()

        if (sessionError) throw sessionError
        
        console.log('Video estimating session created:', session)

        // Try to add AI to the room
        try {
          // IMPORTANT: Use meeting.room_id which is the actual SignalWire room name
          console.log('Adding AI to room:', meeting.room_id)
          const { data: aiResult } = await supabase.functions.invoke('add-ai-to-video-room', {
            body: {
              room_name: meeting.room_id, // This is the sanitized room name SignalWire uses
              session_id: session.id,
              trade_type: values.trade_type
            }
          })
          
          if (aiResult?.success) {
            console.log('AI added to room successfully')
          } else {
            console.log('AI not added:', aiResult?.error)
          }
        } catch (aiError) {
          console.log('Could not add AI to room:', aiError)
          // Continue anyway
        }

        // TODO: Implement proper SignalWire integration
        // For now, we'll skip token generation and notifications
        
        /*
        // Generate customer token and magic link
        const { data: tokenData, error: tokenError } = await supabase
          .functions.invoke('generate-room-token', {
            body: {
              room_id: tempRoomId,
              user_name: 'Customer',
              permissions: ['join_as_viewer', 'send_video', 'send_audio']
            }
          })

        if (tokenError) throw tokenError

        // Send notifications
        if (values.send_sms || values.send_email) {
          await supabase.functions.invoke('send-session-invite', {
            body: {
              session_id: session.id,
              customer_phone: values.customer_phone,
              magic_link: `${window.location.origin}/video-estimate/${session.id}?token=${tokenData.token}`,
              send_sms: values.send_sms,
              send_email: values.send_email
            }
          })
        }
        */

        showToast.success('Video estimating session created successfully')
        onSave(session)
      } catch (error: any) {
        console.error('Error creating session:', error)
        showToast.error(error.message || 'Failed to create session')
      } finally {
        setLoading(false)
      }
    }
  })

  const [clients, setClients] = useState<any[]>([])
  const [loadingClients, setLoadingClients] = useState(true)

  useEffect(() => {
    if (userProfile?.tenant_id) {
      loadAllClients()
    }
  }, [userProfile?.tenant_id])

  const loadAllClients = async () => {
    if (!userProfile?.tenant_id) return
    
    try {
      setLoadingClients(true)
      
      // Load all accounts, contacts, and leads
      const [accountsRes, contactsRes, leadsRes] = await Promise.all([
        supabase
          .from('accounts')
          .select('id, name, phone, email')
          .eq('tenant_id', userProfile.tenant_id)
          .order('name'),
        supabase
          .from('contacts')
          .select('id, first_name, last_name, phone, email')
          .eq('tenant_id', userProfile.tenant_id)
          .order('first_name'),
        supabase
          .from('leads')
          .select('id, name, phone_number, email')
          .eq('tenant_id', userProfile.tenant_id)
          .order('name')
      ])

      const allClients: Array<{
        value: string
        label: string
        type: string
        phone?: string
        email?: string
      }> = []
      
      // Add accounts
      if (accountsRes.data) {
        accountsRes.data.forEach(account => {
          allClients.push({
            value: `account_${account.id}`,
            label: `${account.name} (Business)`,
            type: 'account',
            phone: account.phone,
            email: account.email
          })
        })
      }
      
      // Add contacts
      if (contactsRes.data) {
        contactsRes.data.forEach(contact => {
          const name = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unnamed Contact'
          allClients.push({
            value: `contact_${contact.id}`,
            label: `${name} (Contact)`,
            type: 'contact',
            phone: contact.phone,
            email: contact.email
          })
        })
      }
      
      // Add leads
      if (leadsRes.data) {
        leadsRes.data.forEach(lead => {
          allClients.push({
            value: `lead_${lead.id}`,
            label: `${lead.name} (Lead)`,
            type: 'lead',
            phone: lead.phone_number,
            email: lead.email
          })
        })
      }
      
      setClients(allClients)
    } catch (error) {
      console.error('Error loading clients:', error)
    } finally {
      setLoadingClients(false)
    }
  }

  const handleClientChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value
    formik.setFieldValue('unifiedClientId', selectedValue)
    
    // Auto-populate phone if available
    const selectedClient = clients.find(c => c.value === selectedValue)
    if (selectedClient?.phone) {
      formik.setFieldValue('customer_phone', selectedClient.phone.replace(/\D/g, ''))
    }
  }

  return (
    <div className='modal fade show d-block' tabIndex={-1} role='dialog'>
      <div className='modal-dialog modal-dialog-centered modal-lg' role='document'>
        <div className='modal-content'>
          <div className='modal-header'>
            <h5 className='modal-title'>Schedule Video Estimating Session</h5>
            <button
              type='button'
              className='btn-close'
              onClick={onCancel}
              aria-label='Close'
            ></button>
          </div>

          <form onSubmit={formik.handleSubmit} noValidate>
            <div className='modal-body'>
              {/* Customer Selection */}
              <div className='mb-7'>
                <label className='required fw-semibold fs-6 mb-2'>Customer</label>
                <select
                  className={clsx(
                    'form-select form-select-solid',
                    {'is-invalid': formik.touched.unifiedClientId && formik.errors.unifiedClientId},
                    {'is-valid': formik.touched.unifiedClientId && !formik.errors.unifiedClientId}
                  )}
                  value={formik.values.unifiedClientId}
                  onChange={handleClientChange}
                  disabled={loadingClients}
                >
                  <option value=''>
                    {loadingClients ? 'Loading clients...' : 'Select customer for video estimate...'}
                  </option>
                  {clients.map((client) => (
                    <option key={client.value} value={client.value}>
                      {client.label}
                    </option>
                  ))}
                </select>
                {formik.touched.unifiedClientId && formik.errors.unifiedClientId && (
                  <div className='fv-plugins-message-container'>
                    <span role='alert'>{formik.errors.unifiedClientId}</span>
                  </div>
                )}
              </div>

              {/* Trade Type */}
              <div className='mb-7'>
                <label className='required fw-semibold fs-6 mb-2'>Trade Type</label>
                <select
                  className={clsx(
                    'form-select form-select-solid',
                    {'is-invalid': formik.touched.trade_type && formik.errors.trade_type},
                    {'is-valid': formik.touched.trade_type && !formik.errors.trade_type}
                  )}
                  {...formik.getFieldProps('trade_type')}
                >
                  <option value=''>Select trade type...</option>
                  <option value='ROOFING'>Roofing</option>
                  <option value='PLUMBING'>Plumbing</option>
                  <option value='HVAC'>HVAC</option>
                  <option value='ELECTRICAL'>Electrical</option>
                </select>
                {formik.touched.trade_type && formik.errors.trade_type && (
                  <div className='fv-plugins-message-container'>
                    <span role='alert'>{formik.errors.trade_type}</span>
                  </div>
                )}
              </div>

              {/* Scheduled Time */}
              <div className='mb-7'>
                <label className='required fw-semibold fs-6 mb-2'>Scheduled Time</label>
                <input
                  type='datetime-local'
                  className={clsx(
                    'form-control form-control-solid',
                    {'is-invalid': formik.touched.scheduled_at && formik.errors.scheduled_at},
                    {'is-valid': formik.touched.scheduled_at && !formik.errors.scheduled_at}
                  )}
                  {...formik.getFieldProps('scheduled_at')}
                />
                {formik.touched.scheduled_at && formik.errors.scheduled_at && (
                  <div className='fv-plugins-message-container'>
                    <span role='alert'>{formik.errors.scheduled_at}</span>
                  </div>
                )}
              </div>

              {/* Customer Phone */}
              <div className='mb-7'>
                <label className='required fw-semibold fs-6 mb-2'>Customer Phone</label>
                <input
                  type='tel'
                  className={clsx(
                    'form-control form-control-solid',
                    {'is-invalid': formik.touched.customer_phone && formik.errors.customer_phone},
                    {'is-valid': formik.touched.customer_phone && !formik.errors.customer_phone}
                  )}
                  placeholder='1234567890'
                  {...formik.getFieldProps('customer_phone')}
                />
                {formik.touched.customer_phone && formik.errors.customer_phone && (
                  <div className='fv-plugins-message-container'>
                    <span role='alert'>{formik.errors.customer_phone}</span>
                  </div>
                )}
              </div>

              {/* Notification Options */}
              <div className='mb-7'>
                <label className='fw-semibold fs-6 mb-2'>Send Invitation Via</label>
                <div className='d-flex gap-5'>
                  <div className='form-check'>
                    <input
                      className='form-check-input'
                      type='checkbox'
                      id='send_sms'
                      {...formik.getFieldProps('send_sms')}
                      checked={formik.values.send_sms}
                    />
                    <label className='form-check-label' htmlFor='send_sms'>
                      SMS Text Message
                    </label>
                  </div>
                  <div className='form-check'>
                    <input
                      className='form-check-input'
                      type='checkbox'
                      id='send_email'
                      {...formik.getFieldProps('send_email')}
                      checked={formik.values.send_email}
                    />
                    <label className='form-check-label' htmlFor='send_email'>
                      Email
                    </label>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className='mb-7'>
                <label className='fw-semibold fs-6 mb-2'>Notes</label>
                <textarea
                  className='form-control form-control-solid'
                  rows={3}
                  placeholder='Any special instructions or areas to focus on...'
                  {...formik.getFieldProps('notes')}
                />
              </div>

              {/* Info Alert */}
              <div className='alert alert-primary d-flex align-items-center'>
                <i className='ki-duotone ki-information fs-2 me-3'>
                  <span className='path1'></span>
                  <span className='path2'></span>
                  <span className='path3'></span>
                </i>
                <div>
                  <strong>How it works:</strong> The customer will receive a magic link to join the video call. 
                  Our AI will guide them through showing specific areas based on the trade type selected.
                </div>
              </div>
            </div>

            <div className='modal-footer'>
              <button
                type='button'
                className='btn btn-light'
                onClick={onCancel}
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
                    Creating...
                  </>
                ) : (
                  'Create Session'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}