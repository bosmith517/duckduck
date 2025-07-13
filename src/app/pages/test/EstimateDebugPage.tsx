import React, { useState, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'

const EstimateDebugPage: React.FC = () => {
  const [debugData, setDebugData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDebugData()
  }, [])

  const loadDebugData = async () => {
    try {
      // Test the exact same query that estimatesService uses
      const { data: estimates, error: estimatesError } = await supabase
        .from('estimates')
        .select(`
          *,
          accounts(name),
          contacts(name, first_name, last_name)
        `)
        .in('estimate_number', ['EST-20250712-0001', 'EST-022516'])

      // Also load raw estimate data
      const { data: rawEstimates, error: rawError } = await supabase
        .from('estimates')
        .select('*')
        .in('estimate_number', ['EST-20250712-0001', 'EST-022516'])

      // Load contacts directly
      const contactIds = rawEstimates?.map(e => e.contact_id).filter(Boolean) || []
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('*')
        .in('id', contactIds)

      // Load jobs for these contacts
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('*')
        .in('contact_id', contactIds)

      setDebugData({
        estimates,
        estimatesError,
        rawEstimates,
        rawError,
        contacts,
        contactsError,
        contactIds,
        jobs,
        jobsError
      })
    } catch (error) {
      console.error('Debug load error:', error)
      setDebugData({ error: error instanceof Error ? error.message : String(error) })
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div>Loading debug data...</div>

  return (
    <>
      <PageTitle breadcrumbs={[]}>Estimate Debug</PageTitle>
      
      <KTCard>
        <KTCardBody>
          <h3>Debug Data for EST-20250712-0001 and EST-022516</h3>
          
          <div className="mt-5">
            <h4>Estimates with Relations:</h4>
            <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '5px' }}>
              {JSON.stringify(debugData.estimates, null, 2)}
            </pre>
            {debugData.estimatesError && (
              <div className="alert alert-danger">
                Estimates Error: {JSON.stringify(debugData.estimatesError)}
              </div>
            )}
          </div>

          <div className="mt-5">
            <h4>Raw Estimates:</h4>
            <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '5px' }}>
              {JSON.stringify(debugData.rawEstimates, null, 2)}
            </pre>
          </div>

          <div className="mt-5">
            <h4>Contact IDs Found:</h4>
            <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '5px' }}>
              {JSON.stringify(debugData.contactIds, null, 2)}
            </pre>
          </div>

          <div className="mt-5">
            <h4>Contacts:</h4>
            <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '5px' }}>
              {JSON.stringify(debugData.contacts, null, 2)}
            </pre>
            {debugData.contactsError && (
              <div className="alert alert-danger">
                Contacts Error: {JSON.stringify(debugData.contactsError)}
              </div>
            )}
          </div>

          <div className="mt-5">
            <h4>Jobs for these Contacts:</h4>
            <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '5px' }}>
              {JSON.stringify(debugData.jobs, null, 2)}
            </pre>
            {debugData.jobsError && (
              <div className="alert alert-danger">
                Jobs Error: {JSON.stringify(debugData.jobsError)}
              </div>
            )}
          </div>

          <div className="mt-5">
            <h4>What the display logic sees:</h4>
            {debugData.estimates?.map((estimate: any) => (
              <div key={estimate.id} className="border p-3 mb-3">
                <p><strong>Estimate:</strong> {estimate.estimate_number}</p>
                <p><strong>account_id:</strong> {estimate.account_id || 'null'}</p>
                <p><strong>contact_id:</strong> {estimate.contact_id || 'null'}</p>
                <p><strong>accounts?.name:</strong> {estimate.accounts?.name || 'undefined'}</p>
                <p><strong>contact object:</strong> {JSON.stringify(estimate.contact)}</p>
                <p><strong>Display Result:</strong> {
                  estimate.accounts?.name || 
                  (estimate.contact ? (
                    estimate.contact.name || 
                    `${estimate.contact.first_name || ''} ${estimate.contact.last_name || ''}`.trim()
                  ) : null) || 
                  'Unknown Client'
                }</p>
              </div>
            ))}
          </div>
        </KTCardBody>
      </KTCard>
    </>
  )
}

export default EstimateDebugPage