import React, { useState, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'

interface OrphanedProfile {
  profile_id: string
  email: string
  first_name: string
  last_name: string
  role: string
  tenant_id: string
  created_at: string
  company_name: string
  missing_auth: boolean
}

const FixOrphanedUsers: React.FC = () => {
  const [orphanedProfiles, setOrphanedProfiles] = useState<OrphanedProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [fixing, setFixing] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    loadOrphanedProfiles()
  }, [])

  const loadOrphanedProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('v_orphaned_profiles')
        .select('*')
      
      if (error) throw error
      
      setOrphanedProfiles(data || [])
    } catch (error) {
      console.error('Error loading orphaned profiles:', error)
      setMessage({ type: 'error', text: 'Failed to load orphaned profiles' })
    } finally {
      setLoading(false)
    }
  }

  const sendInvitation = async (email: string) => {
    setFixing(email)
    setMessage(null)
    
    try {
      const { data, error } = await supabase.rpc('send_password_reset_for_profile', {
        p_email: email
      })
      
      if (error) throw error
      
      if (data.success) {
        setMessage({ 
          type: 'success', 
          text: data.needs_invitation 
            ? `Invitation sent to ${email}. They can now complete account setup.`
            : `${email} already has auth access. Use regular password reset.`
        })
        
        // Reload the list
        await loadOrphanedProfiles()
      } else {
        setMessage({ type: 'error', text: data.error })
      }
    } catch (error) {
      console.error('Error sending invitation:', error)
      setMessage({ type: 'error', text: 'Failed to send invitation' })
    } finally {
      setFixing(null)
    }
  }

  if (loading) {
    return (
      <div className="alert alert-info">
        <div className="alert-text">Loading orphaned user profiles...</div>
      </div>
    )
  }

  if (orphanedProfiles.length === 0) {
    return (
      <div className="alert alert-success">
        <div className="alert-text">
          <i className="fas fa-check-circle me-2"></i>
          All user profiles are properly linked to authentication accounts!
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Fix Orphaned User Profiles</h3>
        <div className="card-toolbar">
          <span className="badge badge-danger">{orphanedProfiles.length} profiles need attention</span>
        </div>
      </div>
      <div className="card-body">
        {message && (
          <div className={`alert alert-${message.type === 'success' ? 'success' : 'danger'} mb-4`}>
            <div className="alert-text">{message.text}</div>
          </div>
        )}
        
        <div className="alert alert-warning mb-4">
          <h4 className="alert-heading">What are orphaned profiles?</h4>
          <p>These are team members created in the system but don't have authentication accounts yet. They cannot log in until you send them an invitation.</p>
        </div>
        
        <div className="table-responsive">
          <table className="table table-row-bordered table-row-gray-300">
            <thead>
              <tr className="fw-bold">
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orphanedProfiles.map((profile) => (
                <tr key={profile.profile_id}>
                  <td>{profile.first_name} {profile.last_name}</td>
                  <td>{profile.email}</td>
                  <td>
                    <span className="badge badge-light-primary">{profile.role}</span>
                  </td>
                  <td>{new Date(profile.created_at).toLocaleDateString()}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => sendInvitation(profile.email)}
                      disabled={fixing === profile.email}
                    >
                      {fixing === profile.email ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2"></span>
                          Sending...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-envelope me-2"></i>
                          Send Invitation
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="alert alert-info mt-4">
          <h4 className="alert-heading">Alternative: Manual Creation</h4>
          <p className="mb-0">You can also manually create auth accounts in your Supabase Dashboard:</p>
          <ol className="mb-0 mt-2">
            <li>Go to Supabase Dashboard → Authentication → Users</li>
            <li>Click "Invite User"</li>
            <li>Enter the email address from above</li>
            <li>The user will receive an email to set their password</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

export default FixOrphanedUsers