import React, { useState } from 'react'
import { KTIcon } from '../../../_metronic/helpers'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'

interface Lead {
  id: string
  name: string
  email?: string
  phone?: string
  service_type?: string
  notes?: string
  created_at: string
  source?: string
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'
}

interface LeadConversionWidgetProps {
  lead: Lead
  onConversionComplete: () => void
}

export const LeadConversionWidget: React.FC<LeadConversionWidgetProps> = ({
  lead,
  onConversionComplete
}) => {
  const { userProfile, tenant } = useSupabaseAuth()
  const [converting, setConverting] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const handleConvertToAccount = async () => {
    if (!tenant?.id || !userProfile?.tenant_id) {
      alert('Unable to convert: Missing tenant information')
      return
    }

    setConverting(true)
    
    try {
      // Start a transaction-like operation
      const timestamp = new Date().toISOString()
      
      // 1. Create Account record
      const { data: accountData, error: accountError } = await supabase
        .from('accounts')
        .insert({
          tenant_id: userProfile.tenant_id,
          name: lead.name,
          type: 'Customer',
          status: 'Active',
          created_at: timestamp,
          updated_at: timestamp,
          description: `Converted from lead on ${new Date().toLocaleDateString()}`,
          industry: lead.service_type || 'Home Services',
          source: lead.source || 'Lead Conversion'
        })
        .select()
        .single()

      if (accountError) throw accountError

      // 2. Create Contact record linked to the Account
      const { data: contactData, error: contactError } = await supabase
        .from('contacts')
        .insert({
          tenant_id: userProfile.tenant_id,
          account_id: accountData.id,
          first_name: lead.name.split(' ')[0] || lead.name,
          last_name: lead.name.split(' ').slice(1).join(' ') || '',
          email: lead.email,
          phone: lead.phone,
          title: 'Primary Contact',
          is_primary: true,
          created_at: timestamp,
          updated_at: timestamp,
          notes: lead.notes ? `Lead Notes: ${lead.notes}` : undefined
        })
        .select()
        .single()

      if (contactError) throw contactError

      // 3. Create initial Job record (optional - as a placeholder for future work)
      if (lead.service_type) {
        const { error: jobError } = await supabase
          .from('jobs')
          .insert({
            tenant_id: userProfile.tenant_id,
            account_id: accountData.id,
            contact_id: contactData.id,
            title: `${lead.service_type} Service`,
            description: `Initial service request from lead conversion`,
            status: 'draft',
            priority: 'medium',
            service_type: lead.service_type,
            created_at: timestamp,
            updated_at: timestamp
          })

        if (jobError) {
          console.warn('Warning: Could not create initial job:', jobError)
          // Don't fail the conversion if job creation fails
        }
      }

      // 4. Update Lead status to converted
      const { error: leadUpdateError } = await supabase
        .from('leads')
        .update({ 
          status: 'converted',
          converted_at: timestamp,
          converted_to_account_id: accountData.id,
          updated_at: timestamp
        })
        .eq('id', lead.id)

      if (leadUpdateError) throw leadUpdateError

      // 5. Create activity log entry
      await supabase
        .from('activity_logs')
        .insert({
          tenant_id: userProfile.tenant_id,
          type: 'lead_conversion',
          description: `Lead "${lead.name}" converted to Account and Contact`,
          metadata: {
            lead_id: lead.id,
            account_id: accountData.id,
            contact_id: contactData.id,
            converted_by: userProfile.id
          },
          created_at: timestamp
        })

      setShowConfirmation(true)
      setTimeout(() => {
        onConversionComplete()
      }, 2000)

    } catch (error) {
      console.error('Error converting lead:', error)
      alert('Failed to convert lead. Please try again.')
    } finally {
      setConverting(false)
    }
  }

  if (showConfirmation) {
    return (
      <div className="alert alert-success d-flex align-items-center p-5">
        <KTIcon iconName="check-circle" className="fs-2x text-success me-4" />
        <div>
          <h4 className="alert-heading mb-1">Conversion Successful!</h4>
          <p className="mb-0">
            Lead "{lead.name}" has been converted to an Account and Contact.
            {lead.service_type && ' An initial job has been created.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="card bg-light-primary border border-primary">
      <div className="card-body p-5">
        <div className="d-flex align-items-center justify-content-between mb-4">
          <div className="d-flex align-items-center">
            <KTIcon iconName="convert" className="fs-2x text-primary me-3" />
            <div>
              <h5 className="mb-1">Ready to Convert Lead?</h5>
              <p className="text-muted mb-0">
                This will create an Account and Contact record
              </p>
            </div>
          </div>
          <div className="badge badge-light-primary fs-7">
            Zero-Entry Conversion
          </div>
        </div>

        {/* Preview of what will be created */}
        <div className="bg-white rounded p-4 mb-4">
          <h6 className="mb-3">Conversion Preview:</h6>
          <div className="row">
            <div className="col-md-6">
              <div className="d-flex align-items-center mb-2">
                <KTIcon iconName="office-bag" className="fs-4 text-success me-2" />
                <div>
                  <div className="fw-bold">Account</div>
                  <div className="text-muted fs-7">{lead.name}</div>
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="d-flex align-items-center mb-2">
                <KTIcon iconName="profile-user" className="fs-4 text-info me-2" />
                <div>
                  <div className="fw-bold">Contact</div>
                  <div className="text-muted fs-7">{lead.email || lead.phone || 'Primary Contact'}</div>
                </div>
              </div>
            </div>
          </div>
          {lead.service_type && (
            <div className="mt-3">
              <div className="d-flex align-items-center">
                <KTIcon iconName="abstract-26" className="fs-4 text-warning me-2" />
                <div>
                  <div className="fw-bold">Initial Job</div>
                  <div className="text-muted fs-7">{lead.service_type} Service (Draft)</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="d-flex justify-content-between align-items-center">
          <div className="text-muted fs-7">
            <KTIcon iconName="information" className="fs-6 me-1" />
            This action cannot be undone
          </div>
          <button
            className="btn btn-primary"
            onClick={handleConvertToAccount}
            disabled={converting}
          >
            {converting ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" />
                Converting...
              </>
            ) : (
              <>
                <KTIcon iconName="arrow-right" className="fs-3 me-2" />
                Convert to Account
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default LeadConversionWidget