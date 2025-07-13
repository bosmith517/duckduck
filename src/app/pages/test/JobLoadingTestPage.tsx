import React, { useState } from 'react'
import { supabase } from '../../../supabaseClient'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'

const JobLoadingTestPage: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  const [results, setResults] = useState<any>({})
  const [loading, setLoading] = useState(false)

  const testJobLoading = async () => {
    if (!userProfile?.tenant_id) {
      alert('No tenant ID found')
      return
    }

    setLoading(true)
    const testResults: any = {}

    try {
      // Test 1: Load estimates with contact_id
      const { data: estimates, error: estError } = await supabase
        .from('estimates')
        .select('id, estimate_number, account_id, contact_id')
        .eq('tenant_id', userProfile.tenant_id)
        .not('contact_id', 'is', null)
        .limit(5)

      testResults.estimatesWithContacts = { data: estimates, error: estError }

      // Test 2: For each estimate, try to load jobs
      if (estimates && estimates.length > 0) {
        for (const est of estimates.slice(0, 2)) { // Test first 2
          const { data: jobs, error: jobError } = await supabase
            .from('jobs')
            .select('id, title, job_number, account_id, contact_id')
            .eq('tenant_id', userProfile.tenant_id)
            .eq('contact_id', est.contact_id)

          testResults[`jobsForContact_${est.contact_id}`] = { 
            estimate: est.estimate_number,
            contact_id: est.contact_id,
            jobs: jobs,
            error: jobError 
          }
        }
      }

      // Test 3: Load all jobs with contact_id
      const { data: allContactJobs, error: allJobsError } = await supabase
        .from('jobs')
        .select('id, title, job_number, contact_id')
        .eq('tenant_id', userProfile.tenant_id)
        .not('contact_id', 'is', null)

      testResults.allJobsWithContacts = { data: allContactJobs, error: allJobsError }

      // Test 4: Check specific contact IDs from debug
      const testContactIds = [
        'a37d4cb1-1b3d-45c3-9c6b-2266a3c65c26',
        '97a0d5cc-81a5-44d0-8a86-a9d4c9513325'
      ]

      for (const contactId of testContactIds) {
        const { data: jobs, error } = await supabase
          .from('jobs')
          .select('*')
          .eq('tenant_id', userProfile.tenant_id)
          .eq('contact_id', contactId)

        testResults[`directTest_${contactId}`] = { jobs, error }
      }

    } catch (error) {
      testResults.generalError = error
    }

    setResults(testResults)
    setLoading(false)
  }

  return (
    <>
      <PageTitle breadcrumbs={[]}>Job Loading Test</PageTitle>
      
      <KTCard>
        <KTCardBody>
          <h3>Test Job Loading for Residential Clients</h3>
          
          <button 
            className="btn btn-primary mb-5" 
            onClick={testJobLoading}
            disabled={loading}
          >
            {loading ? 'Testing...' : 'Run Tests'}
          </button>

          {Object.keys(results).length > 0 && (
            <div>
              <h4>Test Results:</h4>
              <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '5px', overflow: 'auto' }}>
                {JSON.stringify(results, null, 2)}
              </pre>
            </div>
          )}

          <div className="mt-5">
            <h4>Current User Info:</h4>
            <p>Tenant ID: {userProfile?.tenant_id || 'Not loaded'}</p>
            <p>User ID: {userProfile?.id || 'Not loaded'}</p>
          </div>
        </KTCardBody>
      </KTCard>
    </>
  )
}

export default JobLoadingTestPage