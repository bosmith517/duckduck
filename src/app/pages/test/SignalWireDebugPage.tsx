import React, { useState, useEffect } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { showToast } from '../../utils/toast'
import { useSoftphoneContext } from '../../contexts/SoftphoneContext'
import { WebRTCSoftphoneDialer } from '../../components/communications'

const SignalWireDebugPage: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  const { showDialer, startCall } = useSoftphoneContext()
  const [tenantInfo, setTenantInfo] = useState<any>(null)
  const [phoneNumbers, setPhoneNumbers] = useState<any[]>([])
  const [sipConfig, setSipConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [testNumber, setTestNumber] = useState('+15555551234')
  const [showFixedDialer, setShowFixedDialer] = useState(false)

  useEffect(() => {
    loadDebugInfo()
  }, [userProfile])

  const loadDebugInfo = async () => {
    if (!userProfile?.tenant_id) return

    try {
      setLoading(true)
      
      // Get tenant information
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id, company_name')
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

      // Get SIP configuration
      const { data: sip, error: sipError } = await supabase
        .from('sip_configurations')
        .select('*')
        .eq('tenant_id', userProfile.tenant_id)
        .eq('is_active', true)
        .single()

      if (!sipError) setSipConfig(sip)

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

  const fixSIPCredentials = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('fix-sip-authentication')
      
      if (error) throw error
      
      console.log('Fix SIP Result:', data)
      
      if (data.success) {
        showToast.success('SIP credentials fixed!')
        const message = `
SIP Credentials Fixed!

Username: ${data.sip_username}
Domain: ${data.sip_domain}
Password: ${data.sip_password}
Endpoint: ${data.endpoint_name}

${data.message}

Please refresh the page and try making a call.
        `
        alert(message)
        // Reload debug info to show updated credentials
        loadDebugInfo()
      } else {
        showToast.error('Failed to fix SIP credentials')
        alert(data.message || 'Failed to update credentials')
      }
    } catch (err: any) {
      console.error('Error fixing credentials:', err)
      showToast.error(`Failed to fix credentials: ${err.message}`)
    }
  }

  const recreateSIPEndpoint = async () => {
    if (!confirm('This will create a new SIP endpoint with email-based username. Continue?')) {
      return
    }
    
    try {
      showToast.loading('Creating new SIP endpoint...')
      
      const { data, error } = await supabase.functions.invoke('create-sip-endpoint', {
        body: { forceCreate: true }
      })
      
      if (error) throw error
      
      console.log('Create SIP Result:', data)
      
      if (data.success) {
        showToast.success('SIP endpoint created!')
        const message = `
SIP Endpoint Created!

Username: ${data.sipConfig.sip_username}
Domain: ${data.sipConfig.sip_domain}
Status: ${data.sipConfig.user_created_in_signalwire ? 'Ready to use' : 'Manual setup needed'}

${data.message}

${data.manual_setup_needed ? `\nMANUAL SETUP REQUIRED:\n${data.instructions}` : ''}
        `
        alert(message)
        // Reload debug info
        loadDebugInfo()
      } else {
        showToast.error('Failed to create SIP endpoint')
      }
    } catch (err: any) {
      console.error('Error creating endpoint:', err)
      // Try to get the actual error message from the response
      let errorMessage = err.message
      if (err.details) {
        console.error('Error details:', err.details)
        errorMessage = err.details
      }
      showToast.error(`Failed to create endpoint: ${errorMessage}`)
    }
  }

  const testWebRTCCredentials = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-signalwire-voice-token')
      
      if (error) throw error
      
      console.log('WebRTC Credentials:', data)
      showToast.success('Retrieved WebRTC credentials')
      
      const message = `
WebRTC Credentials Retrieved!

SIP Username: ${data.sip?.username}
SIP Domain: ${data.sip?.domain}
WebSocket Server: ${data.websocket?.server}
Project ID: ${data.project}

Check console for full details.
      `
      alert(message)
    } catch (err: any) {
      console.error('Error getting credentials:', err)
      showToast.error(`Failed to get credentials: ${err.message}`)
    }
  }

  const checkTenantConfig = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('check-tenant-signalwire')
      
      if (error) throw error
      
      console.log('Tenant SignalWire Config:', data)
      showToast.success('Retrieved tenant configuration')
      
      const message = `
Tenant SignalWire Configuration:

Tenant: ${data.tenant.name}
Has Subproject ID: ${data.tenant.has_subproject_id ? 'YES' : 'NO'}
Has Subproject Token: ${data.tenant.has_subproject_token ? 'YES' : 'NO'}
Subproject Status: ${data.tenant.subproject_status || 'Not set'}

Credentials Used for API Calls: ${data.credentials_decision}
Reason: ${data.debug_info.reason}

SIP Configurations: ${data.sip_configurations?.length || 0}
Phone Numbers: ${data.phone_numbers?.length || 0}

Environment Config:
- Main Project Available: ${data.environment_config.has_main_project_id && data.environment_config.has_main_api_token ? 'YES' : 'NO'}
- Space URL: ${data.environment_config.space_url || 'NOT SET'}

Check console for full details.
      `
      alert(message)
    } catch (err: any) {
      console.error('Error checking tenant config:', err)
      showToast.error(`Failed to check config: ${err.message}`)
    }
  }

  const updateSipEndpointPhone = async () => {
    try {
      showToast.loading('Updating SIP endpoint with phone number...')
      
      const { data, error } = await supabase.functions.invoke('update-sip-endpoint-phone')
      
      if (error) throw error
      
      console.log('Update result:', data)
      showToast.success('SIP endpoint updated!')
      
      alert(`SIP Endpoint Updated!\n\nPhone Number: ${data.phone_number}\nEndpoint ID: ${data.endpoint_id}\n\nYour outbound calls should now work properly.`)
      
      // Reload debug info
      loadDebugInfo()
    } catch (err: any) {
      console.error('Error updating SIP endpoint:', err)
      showToast.error(`Failed to update: ${err.message}`)
    }
  }

  const testServerSideCall = async () => {
    try {
      showToast.loading('Initiating test call from server...')
      
      const { data, error } = await supabase.functions.invoke('start-outbound-call', {
        body: {
          to: testNumber,
          tenantId: userProfile?.tenant_id
        }
      })
      
      if (error) throw error
      
      console.log('Server-side call result:', data)
      showToast.success('Call initiated from server!')
      
      alert(`Server Call Success!\n\nCall SID: ${data.call_sid}\nFrom: ${data.from}\nTo: ${data.to}`)
    } catch (err: any) {
      console.error('Server call error:', err)
      let errorMessage = err.message
      if (err.details) {
        console.error('Server error details:', err.details)
        errorMessage = err.details
      }
      showToast.error(`Server call failed: ${errorMessage}`)
    }
  }

  const testTurnConnectivity = async () => {
    try {
      showToast.loading('Testing TURN server connectivity...')
      
      const { data, error } = await supabase.functions.invoke('test-turn-connectivity-simple')
      
      if (error) throw error
      
      console.log('TURN connectivity test:', data)
      showToast.success('TURN connectivity test complete')
      
      const message = `
TURN Server Connectivity Test:

${data.summary.recommendation}

TURN Servers:
- Total: ${data.summary.turnServers.total}
- Reachable: ${data.summary.turnServers.reachable}
- Unreachable: ${data.summary.turnServers.unreachable}

STUN Servers:
- Total: ${data.summary.stunServers.total}
- Reachable: ${data.summary.stunServers.reachable}

Details in console.
      `
      alert(message)
    } catch (err: any) {
      console.error('TURN test error:', err)
      showToast.error(`TURN test failed: ${err.message}`)
    }
  }

  const getIceServers = async () => {
    try {
      showToast.loading('Getting ICE servers from SignalWire...')
      
      const { data, error } = await supabase.functions.invoke('get-signalwire-ice-servers')
      
      if (error) throw error
      
      console.log('ICE servers:', data)
      showToast.success('Retrieved ICE servers')
      
      let message = `ICE Servers Configuration:\n\n`
      
      if (data.iceServers && data.iceServers.length > 0) {
        message += `Found ${data.iceServers.length} ICE servers:\n\n`
        data.iceServers.forEach((server: any, i: number) => {
          message += `${i + 1}. ${server.urls}\n`
          if (server.username) {
            message += `   Username: ${server.username}\n`
          }
        })
      } else {
        message += 'No ICE servers configured\n'
      }
      
      if (data.recommendations) {
        message += `\nRecommendations:\n`
        data.recommendations.forEach((rec: string, i: number) => {
          message += `${i + 1}. ${rec}\n`
        })
      }
      
      alert(message)
    } catch (err: any) {
      console.error('ICE servers error:', err)
      showToast.error(`Failed to get ICE servers: ${err.message}`)
    }
  }

  const getMySipCredentials = async () => {
    try {
      showToast.loading('Getting your SIP credentials...')
      
      const { data, error } = await supabase.functions.invoke('get-my-sip-credentials')
      
      if (error) throw error
      
      console.log('SIP credentials:', data)
      showToast.success('Retrieved SIP credentials')
      
      let message = `YOUR SIP CREDENTIALS FOR TESTING:\n\n`
      message += `Username: ${data.credentials.username}\n`
      message += `Password: ${data.credentials.password}\n`
      message += `Domain: ${data.credentials.domain}\n`
      message += `Proxy: ${data.credentials.proxy}\n\n`
      
      message += `ZOIPER CONFIGURATION:\n`
      message += `Account Name: ${data.credentials.zoiper_config.account_name}\n`
      message += `Transport: ${data.credentials.zoiper_config.transport}\n`
      message += `Port: ${data.credentials.zoiper_config.port}\n`
      message += `STUN Server: ${data.credentials.zoiper_config.stun_server}\n\n`
      
      message += data.instructions.join('\n')
      
      // Also log password to console for easy copy
      console.log('SIP Password:', data.credentials.password)
      
      alert(message)
    } catch (err: any) {
      console.error('Error getting SIP credentials:', err)
      showToast.error(`Failed to get credentials: ${err.message}`)
    }
  }

  const checkSipEndpointConfig = async () => {
    try {
      showToast.loading('Checking SIP endpoint configuration...')
      
      const { data, error } = await supabase.functions.invoke('check-sip-endpoint-config')
      
      if (error) throw error
      
      console.log('SIP endpoint config:', data)
      showToast.success('SIP configuration check complete')
      
      let message = `SIP Endpoint Configuration Check:\n\n${data.summary}\n\n`
      
      if (data.signalwireEndpoint) {
        message += `SignalWire Endpoint:\n`
        message += `- Username: ${data.signalwireEndpoint.username}\n`
        message += `- Phone Number: ${data.signalwireEndpoint.send_as || 'NOT SET'}\n`
        message += `- Caller ID: ${data.signalwireEndpoint.caller_id || 'Not set'}\n`
        message += `- Status: ${data.signalwireEndpoint.status || 'Unknown'}\n\n`
      }
      
      if (data.issues.length > 0) {
        message += `Issues Found:\n`
        data.issues.forEach((issue: any, i: number) => {
          message += `${i + 1}. ${issue}\n`
        })
        message += `\nRecommendations:\n`
        data.recommendations.forEach((rec: any, i: number) => {
          message += `${i + 1}. ${rec}\n`
        })
      }
      
      message += `\nPhone Numbers: ${data.phoneNumbers.length} found`
      if (data.phoneNumbers.length > 0) {
        const active = data.phoneNumbers.find((p: any) => p.is_active)
        if (active) {
          message += ` (Active: ${active.number})`
        }
      }
      
      alert(message)
    } catch (err: any) {
      console.error('SIP config check error:', err)
      showToast.error(`SIP config check failed: ${err.message}`)
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
          <h3 className="card-title">Tenant Phone Configuration</h3>
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
                    <td><strong>Phone System Status:</strong></td>
                    <td>
                      <span className="text-success">Active (Using Main Project)</span>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="mt-4 d-flex gap-3 flex-wrap">
                <button 
                  className="btn btn-primary"
                  onClick={checkTenantConfig}
                >
                  Check Tenant Config
                </button>
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
                <button 
                  className="btn btn-success"
                  onClick={recreateSIPEndpoint}
                >
                  Create/Fix SIP Endpoint
                </button>
                <button 
                  className="btn btn-danger"
                  onClick={fixSIPCredentials}
                >
                  Fix SIP Authentication
                </button>
                <button 
                  className="btn btn-info"
                  onClick={testWebRTCCredentials}
                >
                  Test WebRTC
                </button>
                <button 
                  className="btn btn-warning"
                  onClick={updateSipEndpointPhone}
                >
                  Update SIP Phone Number
                </button>
                <button 
                  className="btn btn-secondary"
                  onClick={checkSipEndpointConfig}
                >
                  Check SIP Config
                </button>
                <button 
                  className="btn btn-danger"
                  onClick={getMySipCredentials}
                >
                  Get My SIP Credentials
                </button>
              </div>
            </div>
          )}
        </KTCardBody>
      </KTCard>

      <KTCard className="mb-6">
        <div className="card-header">
          <h3 className="card-title">Mobile Call Testing</h3>
        </div>
        <KTCardBody>
          <div className="mb-4">
            <h5>Configuration Status</h5>
            <table className="table table-sm">
              <tbody>
                <tr>
                  <td><strong>SIP Configuration:</strong></td>
                  <td>
                    {sipConfig ? (
                      <>
                        <span className="text-success">✅ Found</span>
                        <div className="small text-muted">
                          Username: <code>{sipConfig.sip_username}</code><br/>
                          Domain: <code>{sipConfig.sip_domain}</code><br/>
                          Password: <code>{sipConfig.sip_password_encrypted ? '••••••••' : '❌ Missing'}</code>
                        </div>
                      </>
                    ) : (
                      <span className="text-danger">❌ Not found</span>
                    )}
                  </td>
                </tr>
                <tr>
                  <td><strong>Phone Numbers:</strong></td>
                  <td>
                    {phoneNumbers.length > 0 ? (
                      <span className="text-success">✅ {phoneNumbers.length} number(s) found</span>
                    ) : (
                      <span className="text-danger">❌ No phone numbers</span>
                    )}
                  </td>
                </tr>
                <tr>
                  <td><strong>Active Phone:</strong></td>
                  <td>
                    {phoneNumbers.find(p => p.is_active) ? (
                      <span className="text-success">✅ {phoneNumbers.find(p => p.is_active)?.number}</span>
                    ) : (
                      <span className="text-danger">❌ No active phone number</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mb-4">
            <h5>Test Server-Side Call</h5>
            <p className="text-muted">Test if SignalWire can make calls from the server (bypasses WebRTC)</p>
            <div className="d-flex gap-2">
              <input
                type="tel"
                className="form-control"
                style={{ maxWidth: '250px' }}
                placeholder="+1234567890"
                value={testNumber}
                onChange={(e) => setTestNumber(e.target.value)}
              />
              <button 
                className="btn btn-warning"
                onClick={testServerSideCall}
                disabled={!testNumber}
              >
                Test Server Call
              </button>
              <button 
                className="btn btn-info ms-2"
                onClick={testTurnConnectivity}
              >
                Test TURN Connectivity
              </button>
              <button 
                className="btn btn-primary ms-2"
                onClick={getIceServers}
              >
                Get ICE Servers
              </button>
            </div>
          </div>

          <div className="mb-4">
            <h5>Test WebRTC Call (Browser)</h5>
            <p className="text-muted">Test WebRTC calling directly from the browser</p>
            <div className="d-flex gap-2">
              <button 
                className="btn btn-success"
                onClick={showDialer}
              >
                Open Softphone
              </button>
              <button 
                className="btn btn-success"
                onClick={() => {
                  if (testNumber) {
                    startCall('Test Call', testNumber)
                  } else {
                    showToast.error('Please enter a phone number above')
                  }
                }}
                disabled={!testNumber}
              >
                Quick Dial Test Number
              </button>
              <button 
                className="btn btn-warning ms-2"
                onClick={() => setShowFixedDialer(true)}
              >
                Open Fixed Dialer
              </button>
            </div>
          </div>

          <div className="alert alert-info">
            <h6 className="alert-heading">Mobile Debugging Steps:</h6>
            <ol className="mb-0">
              <li>Open browser console on mobile device</li>
              <li>Look for [Mobile Debug] messages</li>
              <li>Check these key points:
                <ul>
                  <li>Audio permissions granted?</li>
                  <li>ICE connection state reaches "connected"?</li>
                  <li>Audio track received?</li>
                  <li>Any specific error messages?</li>
                </ul>
              </li>
              <li>If server-side call works but WebRTC doesn't, it's likely a network/ICE issue</li>
            </ol>
          </div>
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
      
      {/* Fixed WebRTC Dialer */}
      <WebRTCSoftphoneDialer 
        isVisible={showFixedDialer} 
        onClose={() => setShowFixedDialer(false)} 
      />
    </>
  )
}

export default SignalWireDebugPage