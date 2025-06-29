import React, { useState, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'

interface TestResult {
  test: string
  status: 'pass' | 'fail' | 'pending'
  message: string
  details?: any
}

export const BackendConnectivityTest: React.FC = () => {
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [isRunning, setIsRunning] = useState(false)

  const runTests = async () => {
    setIsRunning(true)
    const results: TestResult[] = []

    // Test 1: Supabase Client Initialization
    try {
      if (supabase) {
        results.push({
          test: 'Supabase Client',
          status: 'pass',
          message: 'Supabase client initialized successfully'
        })
      } else {
        results.push({
          test: 'Supabase Client',
          status: 'fail',
          message: 'Supabase client not initialized'
        })
      }
    } catch (error) {
      results.push({
        test: 'Supabase Client',
        status: 'fail',
        message: 'Error initializing Supabase client',
        details: error
      })
    }

    // Test 2: Authentication Status
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) {
        results.push({
          test: 'Authentication',
          status: 'fail',
          message: `Auth error: ${error.message}`,
          details: error
        })
      } else if (user) {
        results.push({
          test: 'Authentication',
          status: 'pass',
          message: `User authenticated: ${user.email}`,
          details: { id: user.id, email: user.email }
        })
      } else {
        results.push({
          test: 'Authentication',
          status: 'fail',
          message: 'No authenticated user found'
        })
      }
    } catch (error) {
      results.push({
        test: 'Authentication',
        status: 'fail',
        message: 'Auth check failed',
        details: error
      })
    }

    // Test 3: Database Connection
    try {
      const { data, error } = await supabase
        .from('users')
        .select('count')
        .limit(1)

      if (error) {
        results.push({
          test: 'Database Connection',
          status: 'fail',
          message: `Database error: ${error.message}`,
          details: error
        })
      } else {
        results.push({
          test: 'Database Connection',
          status: 'pass',
          message: 'Database connection successful'
        })
      }
    } catch (error) {
      results.push({
        test: 'Database Connection',
        status: 'fail',
        message: 'Database connection failed',
        details: error
      })
    }

    // Test 4: Profile Table Access
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .limit(1)

      if (error) {
        results.push({
          test: 'Profile Table',
          status: 'fail',
          message: `Profile table error: ${error.message}`,
          details: error
        })
      } else {
        results.push({
          test: 'Profile Table',
          status: 'pass',
          message: 'Profile table accessible'
        })
      }
    } catch (error) {
      results.push({
        test: 'Profile Table',
        status: 'fail',
        message: 'Profile table access failed',
        details: error
      })
    }

    // Test 5: Team Channels Table
    try {
      const { data, error } = await supabase
        .from('team_channels')
        .select('id')
        .limit(1)

      if (error) {
        results.push({
          test: 'Team Channels Table',
          status: 'fail',
          message: `Team channels error: ${error.message}`,
          details: error
        })
      } else {
        results.push({
          test: 'Team Channels Table',
          status: 'pass',
          message: 'Team channels table accessible'
        })
      }
    } catch (error) {
      results.push({
        test: 'Team Channels Table',
        status: 'fail',
        message: 'Team channels access failed',
        details: error
      })
    }

    // Test 6: Contacts Table
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id')
        .limit(1)

      if (error) {
        results.push({
          test: 'Contacts Table',
          status: 'fail',
          message: `Contacts error: ${error.message}`,
          details: error
        })
      } else {
        results.push({
          test: 'Contacts Table',
          status: 'pass',
          message: 'Contacts table accessible'
        })
      }
    } catch (error) {
      results.push({
        test: 'Contacts Table',
        status: 'fail',
        message: 'Contacts access failed',
        details: error
      })
    }

    setTestResults(results)
    setIsRunning(false)
  }

  useEffect(() => {
    runTests()
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return '✅'
      case 'fail': return '❌'
      case 'pending': return '⏳'
      default: return '❓'
    }
  }

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'pass': return 'text-success'
      case 'fail': return 'text-danger'
      case 'pending': return 'text-warning'
      default: return 'text-muted'
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Backend Connectivity Test</h3>
        <div className="card-toolbar">
          <button 
            className="btn btn-sm btn-primary"
            onClick={runTests}
            disabled={isRunning}
          >
            {isRunning ? 'Testing...' : 'Run Tests'}
          </button>
        </div>
      </div>
      <div className="card-body">
        {testResults.length === 0 && !isRunning && (
          <div className="text-center py-5">
            <p className="text-muted">Click "Run Tests" to check backend connectivity</p>
          </div>
        )}
        
        {isRunning && (
          <div className="text-center py-5">
            <div className="spinner-border text-primary mb-3"></div>
            <p className="text-muted">Running connectivity tests...</p>
          </div>
        )}

        {testResults.length > 0 && (
          <div className="table-responsive">
            <table className="table table-row-bordered">
              <thead>
                <tr>
                  <th>Test</th>
                  <th>Status</th>
                  <th>Message</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {testResults.map((result, index) => (
                  <tr key={index}>
                    <td className="fw-bold">{result.test}</td>
                    <td>
                      <span className={getStatusClass(result.status)}>
                        {getStatusIcon(result.status)} {result.status.toUpperCase()}
                      </span>
                    </td>
                    <td className={getStatusClass(result.status)}>
                      {result.message}
                    </td>
                    <td>
                      {result.details && (
                        <details>
                          <summary className="btn btn-sm btn-light">Show Details</summary>
                          <pre className="mt-2 bg-light p-2 rounded">
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="alert alert-info mt-4">
          <h6>Environment Info:</h6>
          <ul className="mb-0">
            <li><strong>Supabase URL:</strong> {import.meta.env.VITE_SUPABASE_URL || 'Not set'}</li>
            <li><strong>Environment:</strong> {import.meta.env.DEV ? 'Development' : 'Production'}</li>
            <li><strong>Current URL:</strong> {window.location.origin}</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default BackendConnectivityTest