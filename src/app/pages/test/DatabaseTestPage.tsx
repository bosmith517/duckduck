import React, { useState } from 'react'
import { supabase } from '../../../supabaseClient'

export const DatabaseTestPage: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const testDatabaseConnection = async () => {
    setLoading(true)
    setError(null)
    setResults(null)

    try {
      console.log('Testing database connection...')

      // Test 1: Check if tables exist
      const { data: tablesData, error: tablesError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .in('table_name', ['tenants', 'user_profiles'])

      console.log('Tables check result:', { tablesData, tablesError })

      // Test 2: Try to read from tenants table
      const { data: tenantsData, error: tenantsError } = await supabase
        .from('tenants')
        .select('*')
        .limit(5)

      console.log('Tenants read result:', { tenantsData, tenantsError })

      // Test 3: Try to read from user_profiles table
      const { data: profilesData, error: profilesError } = await supabase
        .from('user_profiles')
        .select('*')
        .limit(5)

      console.log('User profiles read result:', { profilesData, profilesError })

      // Test 4: Get current user info
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      console.log('Current user:', { user, userError })

      // Test 5: Try to insert a test tenant
      const { data: insertData, error: insertError } = await supabase
        .from('tenants')
        .insert([
          {
            name: 'Test Company Database Test',
            subdomain: 'testdbtest',
            plan: 'basic'
          }
        ])
        .select()

      console.log('Test insert result:', { insertData, insertError })

      setResults({
        tables: { data: tablesData, error: tablesError },
        tenants: { data: tenantsData, error: tenantsError },
        profiles: { data: profilesData, error: profilesError },
        currentUser: { data: user, error: userError },
        testInsert: { data: insertData, error: insertError }
      })

    } catch (err: any) {
      console.error('Database test error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const testUserProfileInsert = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setError('No user logged in')
        return
      }

      // Try to insert a user profile for the current user
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .insert([
          {
            id: user.id,
            tenant_id: '10076fd5-e70f-4062-8192-e42173cf57fd', // Use the default tenant
            email: user.email,
            first_name: 'Test',
            last_name: 'User',
            role: 'admin'
          }
        ])
        .select()

      console.log('User profile insert result:', { profileData, profileError })
      
      if (profileError) {
        setError(`Profile insert failed: ${profileError.message}`)
      } else {
        setResults({ profileInsert: { data: profileData, error: null } })
      }

    } catch (err: any) {
      console.error('Profile insert test error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mt-4">
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Database Connection Test</h3>
        </div>
        <div className="card-body">
          <p>Use this page to diagnose why the signup process isn't creating database entries.</p>
          
          <div className="d-flex gap-3 mb-4">
            <button 
              className="btn btn-primary" 
              onClick={testDatabaseConnection}
              disabled={loading}
            >
              {loading ? 'Testing...' : 'Test Database Connection'}
            </button>
            
            <button 
              className="btn btn-secondary" 
              onClick={testUserProfileInsert}
              disabled={loading}
            >
              {loading ? 'Testing...' : 'Test User Profile Insert'}
            </button>
          </div>

          {error && (
            <div className="alert alert-danger">
              <h5>Error</h5>
              <p>{error}</p>
            </div>
          )}

          {results && (
            <div>
              <h5>Test Results:</h5>
              <div className="alert alert-info">
                <pre style={{ maxHeight: '600px', overflow: 'auto' }}>
                  {JSON.stringify(results, null, 2)}
                </pre>
              </div>
            </div>
          )}

          <div className="mt-4">
            <h5>Troubleshooting Steps:</h5>
            <ol>
              <li><strong>If tables don't exist</strong>: Run SAFE_SCHEMA_DEPLOY.sql in Supabase SQL Editor</li>
              <li><strong>If RLS errors</strong>: Run FIX_RLS_POLICIES.sql in Supabase SQL Editor</li>
              <li><strong>If insert fails</strong>: Check the specific error message in the results</li>
              <li><strong>If no current user</strong>: Make sure you're logged in</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DatabaseTestPage