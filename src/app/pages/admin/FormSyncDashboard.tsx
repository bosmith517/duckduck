import React, { useState, useEffect } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { formSyncService, SyncStatus } from '../../services/formSyncService'
import { realtimeSyncService } from '../../services/realtimeSyncService'
import { formSchemas } from '../../config/formSchemaRegistry'
import { supabase } from '../../../supabaseClient'
import { format } from 'date-fns'

interface SyncLogEntry {
  id: string
  form_id: string
  sync_date: string
  status: string
  synced_tables: string[]
  created_records: any[]
  updated_records: any[]
  errors: string[]
  metadata: any
}

const FormSyncDashboard: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'rules' | 'mappings'>('overview')
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedForm, setSelectedForm] = useState<string>('')
  const [activeSubscriptions, setActiveSubscriptions] = useState<any[]>([])
  const [syncStats, setSyncStats] = useState({
    totalSyncs: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    syncedTables: new Set<string>()
  })

  useEffect(() => {
    if (userProfile?.tenant_id) {
      loadSyncData()
      loadActiveSubscriptions()
    }
  }, [userProfile?.tenant_id, selectedForm])

  const loadSyncData = async () => {
    if (!userProfile?.tenant_id) return

    setLoading(true)
    try {
      // Build query
      let query = supabase
        .from('form_sync_logs')
        .select('*')
        .eq('tenant_id', userProfile.tenant_id)
        .order('sync_date', { ascending: false })
        .limit(100)

      if (selectedForm) {
        query = query.eq('form_id', selectedForm)
      }

      const { data, error } = await query

      if (error) throw error

      setSyncLogs(data || [])
      
      // Calculate stats
      const stats = {
        totalSyncs: data?.length || 0,
        successfulSyncs: data?.filter(log => log.status === 'success').length || 0,
        failedSyncs: data?.filter(log => log.status === 'failed').length || 0,
        syncedTables: new Set<string>()
      }

      data?.forEach(log => {
        log.synced_tables?.forEach((table: string) => stats.syncedTables.add(table))
      })

      setSyncStats(stats)
    } catch (error) {
      console.error('Error loading sync data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadActiveSubscriptions = () => {
    const subs = realtimeSyncService.getActiveSubscriptions()
    setActiveSubscriptions(subs)
  }

  const retrySync = async (syncId: string) => {
    try {
      await formSyncService.retryFailedSync(syncId)
      loadSyncData()
    } catch (error) {
      console.error('Error retrying sync:', error)
    }
  }

  const toggleTableSync = (table: string, active: boolean) => {
    if (active) {
      realtimeSyncService.pauseTableSync(table)
    } else {
      realtimeSyncService.resumeTableSync(table)
    }
    loadActiveSubscriptions()
  }

  const renderOverview = () => (
    <div className='row g-5'>
      {/* Stats Cards */}
      <div className='col-xl-3'>
        <div className='card card-flush h-xl-100'>
          <div className='card-body'>
            <div className='d-flex align-items-center mb-5'>
              <div className='symbol symbol-40px me-3'>
                <div className='symbol-label bg-light-primary'>
                  <i className='ki-duotone ki-arrows-loop fs-1 text-primary'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                  </i>
                </div>
              </div>
              <div>
                <div className='fs-4 fw-bold text-gray-900'>{syncStats.totalSyncs}</div>
                <div className='fs-7 text-gray-600'>Total Syncs</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className='col-xl-3'>
        <div className='card card-flush h-xl-100'>
          <div className='card-body'>
            <div className='d-flex align-items-center mb-5'>
              <div className='symbol symbol-40px me-3'>
                <div className='symbol-label bg-light-success'>
                  <i className='ki-duotone ki-check-circle fs-1 text-success'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                  </i>
                </div>
              </div>
              <div>
                <div className='fs-4 fw-bold text-gray-900'>{syncStats.successfulSyncs}</div>
                <div className='fs-7 text-gray-600'>Successful</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className='col-xl-3'>
        <div className='card card-flush h-xl-100'>
          <div className='card-body'>
            <div className='d-flex align-items-center mb-5'>
              <div className='symbol symbol-40px me-3'>
                <div className='symbol-label bg-light-danger'>
                  <i className='ki-duotone ki-cross-circle fs-1 text-danger'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                  </i>
                </div>
              </div>
              <div>
                <div className='fs-4 fw-bold text-gray-900'>{syncStats.failedSyncs}</div>
                <div className='fs-7 text-gray-600'>Failed</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className='col-xl-3'>
        <div className='card card-flush h-xl-100'>
          <div className='card-body'>
            <div className='d-flex align-items-center mb-5'>
              <div className='symbol symbol-40px me-3'>
                <div className='symbol-label bg-light-info'>
                  <i className='ki-duotone ki-data fs-1 text-info'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                    <span className='path3'></span>
                    <span className='path4'></span>
                    <span className='path5'></span>
                  </i>
                </div>
              </div>
              <div>
                <div className='fs-4 fw-bold text-gray-900'>{syncStats.syncedTables.size}</div>
                <div className='fs-7 text-gray-600'>Synced Tables</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Subscriptions */}
      <div className='col-xl-12'>
        <KTCard>
          <div className='card-header'>
            <h3 className='card-title'>Active Real-time Subscriptions</h3>
          </div>
          <KTCardBody>
            <div className='table-responsive'>
              <table className='table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4'>
                <thead>
                  <tr className='fw-bold text-muted'>
                    <th className='min-w-200px'>Table</th>
                    <th className='min-w-100px'>Status</th>
                    <th className='min-w-100px text-end'>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSubscriptions.map((sub, index) => (
                    <tr key={index}>
                      <td>
                        <span className='text-dark fw-bold fs-6'>{sub.table}</span>
                      </td>
                      <td>
                        <span className={`badge ${sub.active ? 'badge-light-success' : 'badge-light-danger'}`}>
                          {sub.active ? 'Active' : 'Paused'}
                        </span>
                      </td>
                      <td className='text-end'>
                        <button
                          className='btn btn-sm btn-light-primary'
                          onClick={() => toggleTableSync(sub.table, sub.active)}
                        >
                          {sub.active ? 'Pause' : 'Resume'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </KTCardBody>
        </KTCard>
      </div>
    </div>
  )

  const renderSyncLogs = () => (
    <KTCard>
      <div className='card-header'>
        <h3 className='card-title'>Sync History</h3>
        <div className='card-toolbar'>
          <select
            className='form-select form-select-sm w-200px'
            value={selectedForm}
            onChange={(e) => setSelectedForm(e.target.value)}
          >
            <option value=''>All Forms</option>
            {Object.entries(formSchemas).map(([id, schema]) => (
              <option key={id} value={id}>{schema.formName}</option>
            ))}
          </select>
        </div>
      </div>
      <KTCardBody>
        <div className='table-responsive'>
          <table className='table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4'>
            <thead>
              <tr className='fw-bold text-muted'>
                <th className='min-w-150px'>Date/Time</th>
                <th className='min-w-150px'>Form</th>
                <th className='min-w-100px'>Status</th>
                <th className='min-w-200px'>Synced Tables</th>
                <th className='min-w-150px'>Records</th>
                <th className='min-w-100px text-end'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {syncLogs.map((log) => (
                <tr key={log.id}>
                  <td>
                    <span className='text-dark fw-bold fs-6'>
                      {format(new Date(log.sync_date), 'MMM dd, yyyy HH:mm')}
                    </span>
                  </td>
                  <td>
                    <span className='text-dark fw-semibold'>
                      {formSchemas[log.form_id]?.formName || log.form_id}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${
                      log.status === 'success' ? 'badge-light-success' : 
                      log.status === 'failed' ? 'badge-light-danger' : 
                      'badge-light-warning'
                    }`}>
                      {log.status}
                    </span>
                  </td>
                  <td>
                    <div className='d-flex flex-wrap gap-1'>
                      {log.synced_tables?.map((table, idx) => (
                        <span key={idx} className='badge badge-light-primary'>
                          {table}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className='text-muted fs-7'>
                      Created: {log.created_records?.length || 0}<br />
                      Updated: {log.updated_records?.length || 0}
                    </div>
                  </td>
                  <td className='text-end'>
                    {log.status === 'failed' && (
                      <button
                        className='btn btn-sm btn-light-primary'
                        onClick={() => retrySync(log.id)}
                      >
                        Retry
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </KTCardBody>
    </KTCard>
  )

  const renderSyncRules = () => (
    <KTCard>
      <div className='card-header'>
        <h3 className='card-title'>Form Sync Rules</h3>
      </div>
      <KTCardBody>
        <div className='accordion' id='syncRulesAccordion'>
          {Object.entries(formSchemas).map(([formId, schema], index) => (
            <div className='accordion-item' key={formId}>
              <h2 className='accordion-header' id={`heading${index}`}>
                <button
                  className='accordion-button collapsed'
                  type='button'
                  data-bs-toggle='collapse'
                  data-bs-target={`#collapse${index}`}
                >
                  {schema.formName}
                  <span className='badge badge-light-primary ms-2'>
                    {schema.syncRules.length} rules
                  </span>
                </button>
              </h2>
              <div
                id={`collapse${index}`}
                className='accordion-collapse collapse'
                data-bs-parent='#syncRulesAccordion'
              >
                <div className='accordion-body'>
                  {schema.syncRules.map((rule) => (
                    <div key={rule.id} className='mb-4 p-4 bg-light rounded'>
                      <h5 className='mb-3'>{rule.name}</h5>
                      <div className='row'>
                        <div className='col-md-4'>
                          <strong>Trigger:</strong> {rule.triggerEvent}
                        </div>
                        <div className='col-md-4'>
                          <strong>Actions:</strong> {rule.actions.length}
                        </div>
                        <div className='col-md-4'>
                          <strong>Conditions:</strong> {rule.conditions?.length || 0}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </KTCardBody>
    </KTCard>
  )

  const renderFieldMappings = () => (
    <KTCard>
      <div className='card-header'>
        <h3 className='card-title'>Field Mappings</h3>
      </div>
      <KTCardBody>
        <div className='table-responsive'>
          <table className='table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4'>
            <thead>
              <tr className='fw-bold text-muted'>
                <th>Form</th>
                <th>Source Field</th>
                <th>Target Table</th>
                <th>Target Field</th>
                <th>Sync Behavior</th>
                <th>Required</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(formSchemas).flatMap(([formId, schema]) =>
                schema.fieldMappings.map((mapping, idx) => (
                  <tr key={`${formId}-${idx}`}>
                    <td>{schema.formName}</td>
                    <td>
                      <code className='text-primary'>{mapping.sourceField}</code>
                    </td>
                    <td>
                      <code className='text-info'>{mapping.targetTable}</code>
                    </td>
                    <td>
                      <code className='text-success'>{mapping.targetField}</code>
                    </td>
                    <td>
                      <span className='badge badge-light-primary'>
                        {mapping.syncBehavior}
                      </span>
                    </td>
                    <td>
                      {mapping.required && (
                        <i className='ki-duotone ki-check-circle fs-2 text-success'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                        </i>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </KTCardBody>
    </KTCard>
  )

  return (
    <>
      <PageTitle breadcrumbs={[]}>Form Sync Dashboard</PageTitle>
      
      <div className='row g-5'>
        <div className='col-12'>
          <ul className='nav nav-tabs nav-line-tabs nav-line-tabs-2x mb-5 fs-6'>
            <li className='nav-item'>
              <a
                className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
                style={{ cursor: 'pointer' }}
              >
                Overview
              </a>
            </li>
            <li className='nav-item'>
              <a
                className={`nav-link ${activeTab === 'logs' ? 'active' : ''}`}
                onClick={() => setActiveTab('logs')}
                style={{ cursor: 'pointer' }}
              >
                Sync Logs
              </a>
            </li>
            <li className='nav-item'>
              <a
                className={`nav-link ${activeTab === 'rules' ? 'active' : ''}`}
                onClick={() => setActiveTab('rules')}
                style={{ cursor: 'pointer' }}
              >
                Sync Rules
              </a>
            </li>
            <li className='nav-item'>
              <a
                className={`nav-link ${activeTab === 'mappings' ? 'active' : ''}`}
                onClick={() => setActiveTab('mappings')}
                style={{ cursor: 'pointer' }}
              >
                Field Mappings
              </a>
            </li>
          </ul>

          {loading ? (
            <div className='d-flex justify-content-center py-10'>
              <div className='spinner-border text-primary' role='status'>
                <span className='visually-hidden'>Loading...</span>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && renderOverview()}
              {activeTab === 'logs' && renderSyncLogs()}
              {activeTab === 'rules' && renderSyncRules()}
              {activeTab === 'mappings' && renderFieldMappings()}
            </>
          )}
        </div>
      </div>
    </>
  )
}

export default FormSyncDashboard