import React, { useState, useEffect } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'

const PurchaseLogsPage: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPurchaseLogs()
  }, [userProfile])

  const loadPurchaseLogs = async () => {
    if (!userProfile?.tenant_id) return

    try {
      setLoading(true)
      
      // Get edge function logs for purchase attempts
      const { data, error } = await supabase
        .from('edge_function_logs')
        .select('*')
        .eq('function_name', 'purchase-phone-number')
        .eq('tenant_id', userProfile.tenant_id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error
      setLogs(data || [])

    } catch (err: any) {
      console.error('Error loading logs:', err)
    } finally {
      setLoading(false)
    }
  }

  const attemptRepurchase = async (phoneNumber: string) => {
    if (!confirm(`Attempt to repurchase ${phoneNumber}?`)) return

    try {
      const { data, error } = await supabase.functions.invoke('purchase-phone-number', {
        body: {
          phoneNumber: phoneNumber,
          tenantId: userProfile?.tenant_id,
          friendlyName: phoneNumber
        }
      })

      if (error) throw error
      alert(`Purchase attempt completed: ${JSON.stringify(data, null, 2)}`)
      loadPurchaseLogs()
    } catch (err: any) {
      alert(`Purchase failed: ${err.message}`)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <>
      <PageTitle breadcrumbs={[]}>Phone Number Purchase Logs</PageTitle>

      <KTCard>
        <div className="card-header">
          <h3 className="card-title">Recent Purchase Attempts</h3>
          <div className="card-toolbar">
            <button className="btn btn-sm btn-light" onClick={loadPurchaseLogs}>
              Refresh
            </button>
          </div>
        </div>
        <KTCardBody>
          {logs.length > 0 ? (
            <div className="table-responsive">
              <table className="table table-row-bordered">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Phone Number</th>
                    <th>Status</th>
                    <th>Error</th>
                    <th>Response</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const requestData = log.request_data || {}
                    const responseData = log.response_data || {}
                    const phoneNumber = requestData.phoneNumber || 'Unknown'
                    
                    return (
                      <tr key={log.id}>
                        <td>{new Date(log.created_at).toLocaleString()}</td>
                        <td className="font-monospace">{phoneNumber}</td>
                        <td>
                          <span className={`badge ${log.success ? 'badge-success' : 'badge-danger'}`}>
                            {log.success ? 'Success' : 'Failed'}
                          </span>
                        </td>
                        <td className="text-danger small">
                          {log.error_message || '-'}
                        </td>
                        <td>
                          <details>
                            <summary className="cursor-pointer">View Details</summary>
                            <pre className="mt-2 p-2 bg-light small">
                              <strong>Request:</strong>
                              {JSON.stringify(requestData, null, 2)}
                              
                              <strong>Response:</strong>
                              {JSON.stringify(responseData, null, 2)}
                              
                              <strong>Error Details:</strong>
                              {JSON.stringify(log.error_details, null, 2)}
                            </pre>
                          </details>
                        </td>
                        <td>
                          {!log.success && (
                            <button 
                              className="btn btn-sm btn-warning"
                              onClick={() => attemptRepurchase(phoneNumber)}
                            >
                              Retry Purchase
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted">No purchase logs found</p>
          )}
        </KTCardBody>
      </KTCard>

      <div className="mt-6">
        <KTCard>
          <div className="card-header">
            <h3 className="card-title">Manual Phone Number Purchase</h3>
          </div>
          <KTCardBody>
            <div className="alert alert-warning">
              <strong>Note:</strong> Only use this if a number shows in the database but not in SignalWire.
              This will attempt to purchase the number directly from SignalWire.
            </div>
            <div className="row g-3">
              <div className="col-md-6">
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Phone number (e.g., +15551234567)"
                  id="manualPhoneNumber"
                />
              </div>
              <div className="col-md-6">
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    const input = document.getElementById('manualPhoneNumber') as HTMLInputElement
                    if (input.value) {
                      attemptRepurchase(input.value)
                    }
                  }}
                >
                  Attempt Purchase
                </button>
              </div>
            </div>
          </KTCardBody>
        </KTCard>
      </div>
    </>
  )
}

export default PurchaseLogsPage