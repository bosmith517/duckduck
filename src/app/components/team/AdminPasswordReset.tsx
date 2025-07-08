import React, { useState } from 'react'
import { supabase } from '../../../supabaseClient'

interface AdminPasswordResetProps {
  userEmail: string
  userId?: string
  userName?: string
  onSuccess?: () => void
}

export const AdminPasswordReset: React.FC<AdminPasswordResetProps> = ({ 
  userEmail, 
  userId,
  userName,
  onSuccess 
}) => {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const sendPasswordReset = async () => {
    setLoading(true)
    setMessage(null)

    try {
      // First, use the custom function for logging
      const { data: customResult, error: customError } = await supabase.rpc(
        'admin_send_password_reset',
        { p_user_email: userEmail }
      )

      if (customError) throw customError

      if (!customResult.success) {
        setMessage({ type: 'error', text: customResult.error })
        return
      }

      // Then trigger the actual Supabase Auth password reset
      const { error: authError } = await supabase.auth.resetPasswordForEmail(userEmail, {
        redirectTo: `${window.location.origin}/auth/callback`,
      })

      if (authError) {
        console.error('Auth reset error:', authError)
        setMessage({ 
          type: 'error', 
          text: 'Failed to send reset email. Please try again.' 
        })
        return
      }

      setMessage({ 
        type: 'success', 
        text: `Password reset email sent to ${userEmail}` 
      })
      
      if (onSuccess) {
        setTimeout(onSuccess, 2000)
      }
    } catch (error) {
      console.error('Error sending password reset:', error)
      setMessage({ 
        type: 'error', 
        text: 'An error occurred. Please try again.' 
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="d-flex align-items-center gap-2">
      {message && (
        <div className={`alert alert-${message.type === 'success' ? 'success' : 'danger'} mb-0 py-2 px-3`}>
          <div className="alert-text fs-7">{message.text}</div>
        </div>
      )}
      
      <button
        className="btn btn-sm btn-light-warning"
        onClick={sendPasswordReset}
        disabled={loading}
        title={`Send password reset to ${userName || userEmail}`}
      >
        {loading ? (
          <>
            <span className="spinner-border spinner-border-sm me-2"></span>
            Sending...
          </>
        ) : (
          <>
            <i className="fas fa-key me-2"></i>
            Send Password Reset
          </>
        )}
      </button>
    </div>
  )
}

// Bulk password reset modal component
export const BulkPasswordResetModal: React.FC<{
  show: boolean
  onClose: () => void
  selectedUsers: Array<{ email: string; name: string }>
}> = ({ show, onClose, selectedUsers }) => {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[]>([])

  const sendBulkResets = async () => {
    setLoading(true)
    setResults([])

    try {
      const emails = selectedUsers.map(u => u.email)
      
      // Use custom function for logging
      const { data: customResult, error: customError } = await supabase.rpc(
        'admin_send_bulk_password_resets',
        { p_user_emails: emails }
      )

      if (customError) throw customError

      // Send actual reset emails one by one
      const resetResults = []
      for (const user of selectedUsers) {
        try {
          const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
            redirectTo: `${window.location.origin}/auth/reset-password`,
          })
          
          resetResults.push({
            email: user.email,
            name: user.name,
            success: !error,
            error: error?.message
          })
        } catch (err) {
          resetResults.push({
            email: user.email,
            name: user.name,
            success: false,
            error: 'Failed to send reset email'
          })
        }
      }

      setResults(resetResults)
    } catch (error) {
      console.error('Bulk reset error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!show) return null

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Send Password Resets</h5>
            <button
              className="btn btn-icon btn-sm btn-active-light-primary ms-2"
              onClick={onClose}
            >
              <i className="ki-duotone ki-cross fs-2x">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
            </button>
          </div>
          
          <div className="modal-body">
            <div className="alert alert-info mb-4">
              <div className="alert-text">
                You are about to send password reset emails to {selectedUsers.length} users.
                Each user will receive an email with instructions to reset their password.
              </div>
            </div>

            <h6 className="mb-3">Selected Users:</h6>
            <div className="table-responsive">
              <table className="table table-row-bordered table-row-gray-300">
                <thead>
                  <tr className="fw-bold">
                    <th>Name</th>
                    <th>Email</th>
                    {results.length > 0 && <th>Status</th>}
                  </tr>
                </thead>
                <tbody>
                  {selectedUsers.map((user, index) => {
                    const result = results.find(r => r.email === user.email)
                    return (
                      <tr key={index}>
                        <td>{user.name}</td>
                        <td>{user.email}</td>
                        {result && (
                          <td>
                            {result.success ? (
                              <span className="badge badge-light-success">
                                <i className="fas fa-check me-1"></i>
                                Sent
                              </span>
                            ) : (
                              <span className="badge badge-light-danger">
                                <i className="fas fa-times me-1"></i>
                                Failed
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="modal-footer">
            <button 
              className="btn btn-light" 
              onClick={onClose}
            >
              {results.length > 0 ? 'Close' : 'Cancel'}
            </button>
            {results.length === 0 && (
              <button 
                className="btn btn-warning"
                onClick={sendBulkResets}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Sending...
                  </>
                ) : (
                  <>
                    <i className="fas fa-paper-plane me-2"></i>
                    Send Reset Emails
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}