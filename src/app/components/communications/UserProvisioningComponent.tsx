import React, { useState, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'
import { User } from '@supabase/supabase-js'

interface UserProvisioningComponentProps {
  userId?: string
  tenantId?: string
  onProvisionComplete?: (sipConfig: any) => void
}

interface SipConfig {
  username: string
  password: string
  domain: string
  endpoint_uri: string
}

export const UserProvisioningComponent: React.FC<UserProvisioningComponentProps> = ({ 
  userId, 
  tenantId, 
  onProvisionComplete 
}) => {
  const [loading, setLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [userTenantId, setUserTenantId] = useState<string>('')
  const [sipEndpoints, setSipEndpoints] = useState<any[]>([])
  const [loadingEndpoints, setLoadingEndpoints] = useState(false)

  useEffect(() => {
    getCurrentUserInfo()
    if (tenantId || userTenantId) {
      loadExistingEndpoints()
    }
  }, [tenantId, userTenantId])

  const getCurrentUserInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)
      
      if (user && !tenantId) {
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('tenant_id')
          .eq('id', user.id)
          .single()
        
        if (userProfile?.tenant_id) {
          setUserTenantId(userProfile.tenant_id)
        }
      }
    } catch (err) {
      console.error('Error getting user info:', err)
    }
  }

  const loadExistingEndpoints = async () => {
    setLoadingEndpoints(true)
    try {
      const targetTenantId = tenantId || userTenantId
      if (!targetTenantId) return

      const { data, error } = await supabase.functions.invoke('list-sip-endpoints', {
        body: { tenant_id: targetTenantId }
      })

      if (error) {
        console.error('Error loading SIP endpoints:', error)
        return
      }

      setSipEndpoints(data.endpoints || [])
    } catch (err) {
      console.error('Error loading endpoints:', err)
    } finally {
      setLoadingEndpoints(false)
    }
  }

  const handleProvisionEndpoint = async () => {
    if (!currentUser) {
      showToast.error('Please log in to provision an endpoint')
      return
    }

    const targetUserId = userId || currentUser.id
    const targetTenantId = tenantId || userTenantId

    if (!targetTenantId) {
      showToast.error('Tenant ID not found')
      return
    }

    setLoading(true)
    
    try {
      // --- ADD THIS CHECK ---
      // 1. Check if credentials already exist in your DB for this tenant
      console.log('Checking for existing SIP credentials...')
      const { data: existingCreds, error: checkError } = await supabase
        .from('sip_configurations')
        .select('id, sip_username, sip_domain, is_active')
        .eq('tenant_id', targetTenantId)
        .maybeSingle()

      if (checkError) {
        console.error('DB check error:', checkError)
        throw new Error(`DB check failed: ${checkError.message}`)
      }

      if (existingCreds) {
        console.log('Existing credentials found:', existingCreds)
        showToast.info(`This tenant already has SIP credentials: ${existingCreds.sip_username}`)
        
        // Refresh the endpoints list to show the existing endpoint
        await loadExistingEndpoints()
        
        // Still call the callback with existing config if provided
        if (onProvisionComplete) {
          onProvisionComplete({
            username: existingCreds.sip_username,
            domain: existingCreds.sip_domain,
            isActive: existingCreds.is_active
          })
        }
        
        return // Stop the function here
      }
      // --- END OF CHECK ---

      console.log('User not found in DB. Attempting to provision a new SIP endpoint...')
      
      // Data to send to the backend function.
      // The username should be unique for your project.
      const provisioningDetails = {
        userId: targetUserId,
        tenantId: targetTenantId,
        sipUsername: `user-${targetUserId.substring(0, 8)}`, // Example of generating a unique username
        displayName: currentUser.email || 'New User' // Optional: a friendly name
      }

      // Call the Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('create-sip-trunk', {
        body: provisioningDetails,
      })

      if (error) {
        throw error
      }

      // The backend function returns the new credentials upon success
      console.log('Successfully provisioned endpoint! Credentials:', data.sipConfig)
      showToast.success(`New SIP user created: ${data.sipConfig.username}`)

      // Refresh the endpoints list
      await loadExistingEndpoints()

      // Call the callback if provided
      if (onProvisionComplete) {
        onProvisionComplete(data.sipConfig)
      }

    } catch (e: any) {
      console.error('Error provisioning endpoint:', e.message)
      showToast.error(`Failed to provision endpoint: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteEndpoint = async (endpointId: string) => {
    if (!confirm('Are you sure you want to delete this SIP endpoint?')) {
      return
    }

    try {
      // Note: You'll need to create a delete-sip-endpoint function
      const { error } = await supabase.functions.invoke('delete-sip-endpoint', {
        body: { endpoint_id: endpointId }
      })

      if (error) {
        throw error
      }

      showToast.success('SIP endpoint deleted successfully')
      await loadExistingEndpoints()
    } catch (e: any) {
      console.error('Error deleting endpoint:', e.message)
      showToast.error(`Failed to delete endpoint: ${e.message}`)
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">SIP Endpoint Management</h3>
      </div>
      <div className="card-body">
        <div className="mb-4">
          <p className="text-muted mb-3">
            Provision a new phone line for this user. This will create a SIP endpoint 
            that can be used with the softphone.
          </p>
          
          <button 
            onClick={handleProvisionEndpoint}
            disabled={loading || !currentUser}
            className="btn btn-primary"
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Provisioning...
              </>
            ) : (
              'Provision SIP Endpoint'
            )}
          </button>
        </div>

        <hr />

        <div>
          <h5 className="mb-3">Existing SIP Endpoints</h5>
          
          {loadingEndpoints ? (
            <div className="text-center py-3">
              <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              Loading endpoints...
            </div>
          ) : sipEndpoints.length === 0 ? (
            <div className="alert alert-info">
              No SIP endpoints found. Provision one above to get started.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Domain</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sipEndpoints.map((endpoint) => (
                    <tr key={endpoint.id}>
                      <td>
                        <code>{endpoint.username}</code>
                      </td>
                      <td>
                        <code>{endpoint.domain}</code>
                      </td>
                      <td>
                        <span className={`badge ${endpoint.is_active ? 'bg-success' : 'bg-secondary'}`}>
                          {endpoint.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        {new Date(endpoint.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <button
                          onClick={() => handleDeleteEndpoint(endpoint.id)}
                          className="btn btn-sm btn-outline-danger"
                          title="Delete endpoint"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {currentUser && (
          <div className="mt-4 p-3 bg-light rounded">
            <small className="text-muted">
              <strong>Current User:</strong> {currentUser.email}<br />
              <strong>User ID:</strong> <code>{currentUser.id}</code><br />
              <strong>Tenant ID:</strong> <code>{tenantId || userTenantId || 'Not found'}</code>
            </small>
          </div>
        )}
      </div>
    </div>
  )
}

export default UserProvisioningComponent
