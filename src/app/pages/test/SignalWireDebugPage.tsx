import React, { useState, useEffect } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'

const SignalWireDebugPage: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  const [tenantInfo, setTenantInfo] = useState<any>(null)
  const [phoneNumbers, setPhoneNumbers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDebugInfo()
  }, [userProfile])

  const loadDebugInfo = async () => {
    if (!userProfile?.tenant_id) return

    try {
      setLoading(true)
      
      // Get tenant SignalWire configuration
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id, company_name, signalwire_subproject_id, signalwire_subproject_token, signalwire_subproject_space')
        .eq('id', userProfile.tenant_id)
        .single()

      if (tenantError) throw tenantError
      setTenantInfo(tenant)

      // Get phone numbers
      const { data: numbers, error: numbersError } = await supabase
        .from('signalwire_phone_numbers')
        .select('*')
        .eq('tenant_id', userProfile.tenant_id)

      if (numbersError) throw numbersError
      setPhoneNumbers(numbers || [])

    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const checkSignalWireProjects = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('debug-signalwire', {
        body: { tenantId: userProfile?.tenant_id }
      })

      if (error) throw error
      console.log('SignalWire Debug Info:', data)
      alert(JSON.stringify(data, null, 2))
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }

  const verifyPhoneNumbers = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-phone-numbers')

      if (error) throw error
      console.log('Phone Number Verification:', data)
      
      // Display results in a more readable format
      const message = `
Phone Number Verification Results:

Tenant: ${data.tenant_info.name}
Using Main Project: ${data.using_main_project ? 'YES' : 'NO'}
Has Subproject: ${data.tenant_info.has_subproject ? 'YES' : 'NO'}

Summary:
- Numbers in Database: ${data.summary.total_in_database}
- Numbers in SignalWire: ${data.summary.total_in_signalwire}
- Missing from SignalWire: ${data.summary.missing_from_signalwire}
- Missing from Database: ${data.summary.missing_from_database}

${data.summary.missing_from_signalwire > 0 ? 
`\n⚠️ NUMBERS IN DATABASE BUT NOT IN SIGNALWIRE:\n${data.comparison.in_db_not_in_sw.map((n: any) => `- ${n.number} (ID: ${n.signalwire_id})`).join('\n')}` : ''}

${data.summary.missing_from_database > 0 ? 
`\n📞 NUMBERS IN SIGNALWIRE BUT NOT IN DATABASE:\n${data.comparison.in_sw_not_in_db.map((n: any) => `- ${n.number} (ID: ${n.sw_id})`).join('\n')}` : ''}
      `
      
      alert(message)
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }

  const repairSignalWireConfig = async () => {
    if (!confirm('This will attempt to repair your SignalWire configuration by copying subproject credentials from your SIP configuration. Continue?')) {
      return
    }

    try {
      const { data, error } = await supabase.functions.invoke('repair-tenant-signalwire')

      if (error) throw error
      
      if (data.success) {
        alert(`Success! SignalWire configuration repaired.\n\nSubproject ID: ${data.subproject_id}`)
        loadDebugInfo() // Reload to show updated info
      } else {
        alert(`Repair failed: ${data.message}`)
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <>
      <PageTitle breadcrumbs={[]}>SignalWire Debug Info</PageTitle>

      <KTCard className="mb-6">
        <div className="card-header">
          <h3 className="card-title">Tenant SignalWire Configuration</h3>
        </div>
        <KTCardBody>
          {error && (
            <div className="alert alert-danger mb-4">
              {error}
            </div>
          )}
          
          {tenantInfo && (
            <div>
              <h5>Tenant: {tenantInfo.company_name}</h5>
              <table className="table">
                <tbody>
                  <tr>
                    <td><strong>Tenant ID:</strong></td>
                    <td className="font-monospace">{tenantInfo.id}</td>
                  </tr>
                  <tr>
                    <td><strong>SignalWire Subproject ID:</strong></td>
                    <td className="font-monospace">
                      {tenantInfo.signalwire_subproject_id || <span className="text-danger">NOT SET</span>}
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Has Subproject Token:</strong></td>
                    <td>
                      {tenantInfo.signalwire_subproject_token ? 
                        <span className="text-success">Yes</span> : 
                        <span className="text-danger">No</span>}
                    </td>
                  </tr>
                  <tr>
                    <td><strong>SignalWire Space:</strong></td>
                    <td className="font-monospace">
                      {tenantInfo.signalwire_subproject_space || <span className="text-muted">Using default</span>}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="mt-4 d-flex gap-3">
                <button 
                  className="btn btn-primary"
                  onClick={checkSignalWireProjects}
                >
                  Check SignalWire Projects
                </button>
                <button 
                  className="btn btn-warning"
                  onClick={verifyPhoneNumbers}
                >
                  Verify Phone Numbers
                </button>
                {!tenantInfo.signalwire_subproject_id && (
                  <button 
                    className="btn btn-success"
                    onClick={repairSignalWireConfig}
                  >
                    Repair SignalWire Config
                  </button>
                )}
              </div>
            </div>
          )}
        </KTCardBody>
      </KTCard>

      <KTCard>
        <div className="card-header">
          <h3 className="card-title">Phone Numbers in Database</h3>
        </div>
        <KTCardBody>
          {phoneNumbers.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>SignalWire ID</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {phoneNumbers.map((num) => (
                  <tr key={num.id}>
                    <td className="font-monospace">{num.number}</td>
                    <td className="font-monospace small">{num.signalwire_number_id}</td>
                    <td>{num.number_type}</td>
                    <td>
                      <span className={`badge ${num.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {num.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>{new Date(num.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-muted">No phone numbers found in database</p>
          )}
        </KTCardBody>
      </KTCard>
    </>
  )
}

export default SignalWireDebugPage