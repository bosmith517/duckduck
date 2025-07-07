import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'

export const AcceptInvitationPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useSupabaseAuth()
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const acceptInvitation = async () => {
      const token = searchParams.get('token')
      
      if (!token) {
        setStatus('error')
        setMessage('No invitation token provided')
        return
      }

      if (!user) {
        setStatus('error')
        setMessage('Please log in to accept the invitation')
        // Store the token and redirect to login
        localStorage.setItem('pendingInvitationToken', token)
        setTimeout(() => {
          navigate('/auth/login')
        }, 2000)
        return
      }

      try {
        // Call the accept invitation function
        const { data, error } = await supabase
          .rpc('accept_team_invitation', {
            p_invitation_token: token
          })

        if (error || !data?.success) {
          setStatus('error')
          setMessage(data?.error || error?.message || 'Failed to accept invitation')
          return
        }

        setStatus('success')
        setMessage('Invitation accepted successfully! Redirecting to dashboard...')
        
        // Clear any stored token
        localStorage.removeItem('pendingInvitationToken')
        
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          navigate('/dashboard')
        }, 2000)
      } catch (err) {
        setStatus('error')
        setMessage('An unexpected error occurred')
        console.error('Error accepting invitation:', err)
      }
    }

    acceptInvitation()
  }, [user, searchParams, navigate])

  // Check for pending invitation after login
  useEffect(() => {
    if (user) {
      const pendingToken = localStorage.getItem('pendingInvitationToken')
      if (pendingToken) {
        // User just logged in with a pending invitation
        const url = new URL(window.location.href)
        url.searchParams.set('token', pendingToken)
        window.location.href = url.toString()
      }
    }
  }, [user])

  return (
    <div className="d-flex flex-column flex-root">
      <div className="d-flex flex-column flex-center flex-column-fluid">
        <div className="w-lg-500px p-10">
          <div className="text-center mb-10">
            <h1 className="text-dark fw-bolder mb-3">Accept Team Invitation</h1>
          </div>

          <div className={`alert alert-${status === 'error' ? 'danger' : status === 'success' ? 'success' : 'info'} d-flex align-items-center p-5`}>
            {status === 'loading' && (
              <>
                <div className="spinner-border spinner-border-sm me-3" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <div className="d-flex flex-column">
                  <span>Processing invitation...</span>
                </div>
              </>
            )}
            
            {status === 'error' && (
              <>
                <i className="ki-duotone ki-information-5 fs-2x text-danger me-3">
                  <span className="path1"></span>
                  <span className="path2"></span>
                  <span className="path3"></span>
                </i>
                <div className="d-flex flex-column">
                  <span>{message}</span>
                </div>
              </>
            )}
            
            {status === 'success' && (
              <>
                <i className="ki-duotone ki-check-circle fs-2x text-success me-3">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                <div className="d-flex flex-column">
                  <span>{message}</span>
                </div>
              </>
            )}
          </div>

          {status === 'error' && (
            <div className="text-center mt-5">
              <button 
                className="btn btn-primary"
                onClick={() => navigate('/auth/login')}
              >
                Go to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}