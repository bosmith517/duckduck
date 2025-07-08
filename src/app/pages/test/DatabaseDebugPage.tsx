import React, { useState, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'

const DatabaseDebugPage: React.FC = () => {
  const { currentUser, userProfile } = useSupabaseAuth()
  const [results, setResults] = useState<any>({})
  const [loading, setLoading] = useState(false)

  const runTests = async () => {
    setLoading(true)
    const testResults: any = {}

    // Test 1: Check user profile
    testResults.userProfile = {
      id: userProfile?.id,
      tenant_id: userProfile?.tenant_id,
      email: currentUser?.email
    }

    // Test 2: Try to query accounts with minimal fields
    try {
      const { data, error, status, statusText } = await supabase
        .from('accounts')
        .select('id')
        .limit(1)
      
      testResults.accountsBasicQuery = { 
        success: !error, 
        error, 
        status, 
        statusText,
        dataCount: data?.length || 0 
      }
    } catch (e) {
      testResults.accountsBasicQuery = { error: e.message }
    }

    // Test 3: Try to query accounts with tenant_id
    try {
      const { data, error, status, statusText } = await supabase
        .from('accounts')
        .select('id, name')
        .eq('tenant_id', userProfile?.tenant_id)
        .limit(5)
      
      testResults.accountsWithTenant = { 
        success: !error, 
        error, 
        status, 
        statusText,
        dataCount: data?.length || 0,
        data: data?.slice(0, 2) // Show first 2 records
      }
    } catch (e) {
      testResults.accountsWithTenant = { error: e.message }
    }

    // Test 4: Try to query contacts
    try {
      const { data, error, status, statusText } = await supabase
        .from('contacts')
        .select('id, first_name, last_name')
        .eq('tenant_id', userProfile?.tenant_id)
        .is('account_id', null)
        .limit(5)
      
      testResults.contactsQuery = { 
        success: !error, 
        error, 
        status, 
        statusText,
        dataCount: data?.length || 0,
        data: data?.slice(0, 2) // Show first 2 records
      }
    } catch (e) {
      testResults.contactsQuery = { error: e.message }
    }

    // Test 5: Check RLS status (requires database introspection)
    try {
      const { data, error } = await supabase
        .rpc('check_table_rls_status', {
          table_names: ['accounts', 'contacts']
        })
      
      testResults.rlsStatus = { data, error }
    } catch (e) {
      testResults.rlsStatus = { note: 'RLS check function not available' }
    }

    setResults(testResults)
    setLoading(false)
  }

  useEffect(() => {
    if (userProfile) {
      runTests()
    }
  }, [userProfile])

  return (
    <div className='container py-5'>
      <h1>Database Debug Page</h1>
      <p>This page helps debug database access issues.</p>
      
      <button 
        className='btn btn-primary mb-4' 
        onClick={runTests}
        disabled={loading}
      >
        {loading ? 'Running Tests...' : 'Re-run Tests'}
      </button>

      <pre className='bg-light p-3 rounded'>
        {JSON.stringify(results, null, 2)}
      </pre>
    </div>
  )
}

export default DatabaseDebugPage