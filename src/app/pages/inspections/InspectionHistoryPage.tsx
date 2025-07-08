import React, { useState, useEffect } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'

interface InspectionHistory {
  id: string
  job_id: string
  tenant_id: string
  trade: string
  phase: string
  inspection_type: string
  status: string
  scheduled_date?: string
  completed_date?: string
  inspector_name?: string
  inspector_contact?: string
  result?: string
  certificate_number?: string
  notes?: string
  punch_list?: string[]
  created_at: string
  job?: {
    title: string
    job_number: string
    location_address: string
    account?: { name: string }
  }
}

const InspectionHistoryPage: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  const [inspections, setInspections] = useState<InspectionHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedInspection, setSelectedInspection] = useState<InspectionHistory | null>(null)
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })
  const [tradeFilter, setTradeFilter] = useState('all')
  const [resultFilter, setResultFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (userProfile?.tenant_id) {
      loadInspectionHistory()
    }
  }, [userProfile?.tenant_id, dateRange, tradeFilter, resultFilter])

  const loadInspectionHistory = async () => {
    if (!userProfile?.tenant_id) return

    try {
      setLoading(true)
      
      let query = supabase
        .from('job_inspections')
        .select(`
          *,
          job:jobs (
            title,
            job_number,
            location_address,
            account:accounts(name)
          )
        `)
        .eq('tenant_id', userProfile.tenant_id)
        .in('status', ['passed', 'failed', 'waived'])
        .order('completed_date', { ascending: false })

      // Apply date range filter
      if (dateRange.start) {
        query = query.gte('completed_date', dateRange.start)
      }
      if (dateRange.end) {
        query = query.lte('completed_date', dateRange.end + 'T23:59:59')
      }

      // Apply trade filter
      if (tradeFilter !== 'all') {
        query = query.eq('trade', tradeFilter)
      }

      // Apply result filter
      if (resultFilter !== 'all') {
        if (resultFilter === 'passed') {
          query = query.eq('status', 'passed')
        } else if (resultFilter === 'failed') {
          query = query.eq('status', 'failed')
        } else if (resultFilter === 'conditional') {
          query = query.eq('result', 'conditional')
        }
      }

      const { data, error } = await query

      if (error) throw error
      setInspections(data || [])
    } catch (error) {
      console.error('Error loading inspection history:', error)
      showToast.error('Failed to load inspection history')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string, result?: string) => {
    if (status === 'passed') return 'text-success'
    if (status === 'failed') return 'text-danger'
    if (status === 'waived') return 'text-warning'
    if (result === 'conditional') return 'text-warning'
    return 'text-muted'
  }

  const getStatusIcon = (status: string) => {
    if (status === 'passed') return 'ki-check-circle'
    if (status === 'failed') return 'ki-cross-circle'
    if (status === 'waived') return 'ki-information-5'
    return 'ki-question'
  }

  const exportToCSV = () => {
    const headers = [
      'Job Number',
      'Job Title',
      'Trade',
      'Phase',
      'Type',
      'Inspector',
      'Inspection Date',
      'Result',
      'Certificate Number',
      'Notes'
    ]

    const rows = filteredInspections.map(inspection => [
      inspection.job?.job_number || '',
      inspection.job?.title || '',
      inspection.trade,
      inspection.phase,
      inspection.inspection_type,
      inspection.inspector_name || '',
      inspection.completed_date ? new Date(inspection.completed_date).toLocaleDateString() : '',
      inspection.status.toUpperCase(),
      inspection.certificate_number || '',
      inspection.notes || ''
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inspection-history-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const trades = ['electrical', 'plumbing', 'hvac', 'structural', 'roofing']
  
  const filteredInspections = inspections.filter(inspection => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      return (
        inspection.job?.title?.toLowerCase().includes(search) ||
        inspection.job?.job_number?.toLowerCase().includes(search) ||
        inspection.job?.location_address?.toLowerCase().includes(search) ||
        inspection.inspector_name?.toLowerCase().includes(search) ||
        inspection.certificate_number?.toLowerCase().includes(search)
      )
    }
    return true
  })

  // Calculate statistics
  const stats = {
    total: filteredInspections.length,
    passed: filteredInspections.filter(i => i.status === 'passed').length,
    failed: filteredInspections.filter(i => i.status === 'failed').length,
    conditional: filteredInspections.filter(i => i.result === 'conditional').length,
    passRate: filteredInspections.length > 0 
      ? Math.round((filteredInspections.filter(i => i.status === 'passed').length / filteredInspections.length) * 100)
      : 0
  }

  return (
    <>
      <PageTitle breadcrumbs={[]}>Inspection History</PageTitle>

      <div className='row g-5'>
        {/* Statistics */}
        <div className='col-12'>
          <div className='row g-5'>
            <div className='col-md-3'>
              <div className='card bg-light-primary'>
                <div className='card-body'>
                  <div className='text-center'>
                    <div className='fs-1 fw-bold text-primary'>{stats.total}</div>
                    <div className='fs-6 text-muted'>Total Inspections</div>
                  </div>
                </div>
              </div>
            </div>
            <div className='col-md-3'>
              <div className='card bg-light-success'>
                <div className='card-body'>
                  <div className='text-center'>
                    <div className='fs-1 fw-bold text-success'>{stats.passed}</div>
                    <div className='fs-6 text-muted'>Passed</div>
                  </div>
                </div>
              </div>
            </div>
            <div className='col-md-3'>
              <div className='card bg-light-danger'>
                <div className='card-body'>
                  <div className='text-center'>
                    <div className='fs-1 fw-bold text-danger'>{stats.failed}</div>
                    <div className='fs-6 text-muted'>Failed</div>
                  </div>
                </div>
              </div>
            </div>
            <div className='col-md-3'>
              <div className='card bg-light-info'>
                <div className='card-body'>
                  <div className='text-center'>
                    <div className='fs-1 fw-bold text-info'>{stats.passRate}%</div>
                    <div className='fs-6 text-muted'>Pass Rate</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className='col-12'>
          <KTCard>
            <div className='card-header border-0 pt-5'>
              <h3 className='card-title align-items-start flex-column'>
                <span className='card-label fw-bold fs-3 mb-1'>Inspection History</span>
                <span className='text-muted mt-1 fw-semibold fs-7'>View completed inspections</span>
              </h3>
              <div className='card-toolbar'>
                <button
                  className='btn btn-sm btn-light-primary'
                  onClick={exportToCSV}
                >
                  <i className='ki-duotone ki-exit-down fs-2 me-2'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                  </i>
                  Export CSV
                </button>
              </div>
            </div>
            <KTCardBody>
              <div className='row g-3 mb-5'>
                <div className='col-md-3'>
                  <label className='form-label'>Search</label>
                  <input
                    type='text'
                    className='form-control form-control-solid'
                    placeholder='Search inspections...'
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className='col-md-2'>
                  <label className='form-label'>Start Date</label>
                  <input
                    type='date'
                    className='form-control form-control-solid'
                    value={dateRange.start}
                    onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                  />
                </div>
                <div className='col-md-2'>
                  <label className='form-label'>End Date</label>
                  <input
                    type='date'
                    className='form-control form-control-solid'
                    value={dateRange.end}
                    onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                  />
                </div>
                <div className='col-md-2'>
                  <label className='form-label'>Trade</label>
                  <select
                    className='form-select form-select-solid'
                    value={tradeFilter}
                    onChange={(e) => setTradeFilter(e.target.value)}
                  >
                    <option value='all'>All Trades</option>
                    {trades.map(trade => (
                      <option key={trade} value={trade}>
                        {trade.charAt(0).toUpperCase() + trade.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className='col-md-2'>
                  <label className='form-label'>Result</label>
                  <select
                    className='form-select form-select-solid'
                    value={resultFilter}
                    onChange={(e) => setResultFilter(e.target.value)}
                  >
                    <option value='all'>All Results</option>
                    <option value='passed'>Passed</option>
                    <option value='failed'>Failed</option>
                    <option value='conditional'>Conditional</option>
                  </select>
                </div>
              </div>

              {loading ? (
                <div className='text-center py-10'>
                  <div className='spinner-border text-primary' role='status'>
                    <span className='visually-hidden'>Loading...</span>
                  </div>
                </div>
              ) : filteredInspections.length === 0 ? (
                <div className='text-center py-10'>
                  <div className='text-muted'>No inspection history found for the selected filters.</div>
                </div>
              ) : (
                <div className='table-responsive'>
                  <table className='table table-row-bordered table-row-gray-100 align-middle gs-0 gy-3'>
                    <thead>
                      <tr className='fw-bold text-muted'>
                        <th className='min-w-120px'>Job</th>
                        <th className='min-w-100px'>Trade/Phase</th>
                        <th className='min-w-80px'>Type</th>
                        <th className='min-w-100px'>Inspector</th>
                        <th className='min-w-100px'>Date</th>
                        <th className='min-w-80px'>Result</th>
                        <th className='min-w-100px'>Certificate</th>
                        <th className='min-w-80px text-end'>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInspections.map(inspection => (
                        <tr key={inspection.id}>
                          <td>
                            <div className='d-flex flex-column'>
                              <span className='text-dark fw-bold fs-6'>
                                {inspection.job?.title || 'Unknown Job'}
                              </span>
                              <span className='text-muted fs-7'>
                                {inspection.job?.job_number} - {inspection.job?.account?.name || inspection.job?.location_address}
                              </span>
                            </div>
                          </td>
                          <td>
                            <div className='d-flex flex-column'>
                              <span className='text-gray-800 fw-bold'>
                                {inspection.trade}
                              </span>
                              <span className='text-muted fs-7'>
                                {inspection.phase} phase
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className='text-gray-800'>
                              {inspection.inspection_type}
                            </span>
                          </td>
                          <td>
                            <span className='text-gray-800'>
                              {inspection.inspector_name || '-'}
                            </span>
                          </td>
                          <td>
                            <span className='text-gray-800'>
                              {inspection.completed_date 
                                ? new Date(inspection.completed_date).toLocaleDateString()
                                : '-'}
                            </span>
                          </td>
                          <td>
                            <div className='d-flex align-items-center'>
                              <i className={`ki-duotone ${getStatusIcon(inspection.status)} fs-2 ${getStatusColor(inspection.status, inspection.result)} me-2`}>
                                <span className='path1'></span>
                                <span className='path2'></span>
                              </i>
                              <span className={`fw-bold ${getStatusColor(inspection.status, inspection.result)}`}>
                                {inspection.result === 'conditional' ? 'CONDITIONAL' : inspection.status.toUpperCase()}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className='text-gray-800'>
                              {inspection.certificate_number || '-'}
                            </span>
                          </td>
                          <td className='text-end'>
                            <button
                              className='btn btn-sm btn-light-primary'
                              onClick={() => setSelectedInspection(inspection)}
                              title='View Details'
                            >
                              <i className='ki-duotone ki-eye fs-4'>
                                <span className='path1'></span>
                                <span className='path2'></span>
                                <span className='path3'></span>
                              </i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </KTCardBody>
          </KTCard>
        </div>
      </div>

      {/* Inspection Details Modal */}
      {selectedInspection && (
        <div className='modal show d-block' style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className='modal-dialog modal-lg'>
            <div className='modal-content'>
              <div className='modal-header'>
                <h5 className='modal-title'>Inspection Details</h5>
                <button
                  className='btn-close'
                  onClick={() => setSelectedInspection(null)}
                />
              </div>
              <div className='modal-body'>
                <div className='row g-4'>
                  <div className='col-md-6'>
                    <label className='form-label fw-bold'>Job</label>
                    <div className='text-gray-800'>
                      {selectedInspection.job?.title}<br />
                      <span className='text-muted'>
                        {selectedInspection.job?.job_number} - {selectedInspection.job?.location_address}
                      </span>
                    </div>
                  </div>
                  <div className='col-md-6'>
                    <label className='form-label fw-bold'>Inspection Type</label>
                    <div className='text-gray-800'>
                      {selectedInspection.trade} - {selectedInspection.phase} Phase<br />
                      <span className='text-muted'>{selectedInspection.inspection_type}</span>
                    </div>
                  </div>
                  <div className='col-md-6'>
                    <label className='form-label fw-bold'>Inspector</label>
                    <div className='text-gray-800'>
                      {selectedInspection.inspector_name || 'Not recorded'}<br />
                      {selectedInspection.inspector_contact && (
                        <span className='text-muted'>{selectedInspection.inspector_contact}</span>
                      )}
                    </div>
                  </div>
                  <div className='col-md-6'>
                    <label className='form-label fw-bold'>Inspection Date</label>
                    <div className='text-gray-800'>
                      {selectedInspection.completed_date 
                        ? new Date(selectedInspection.completed_date).toLocaleString()
                        : 'Not recorded'}
                    </div>
                  </div>
                  <div className='col-md-6'>
                    <label className='form-label fw-bold'>Result</label>
                    <div>
                      <i className={`ki-duotone ${getStatusIcon(selectedInspection.status)} fs-2 ${getStatusColor(selectedInspection.status, selectedInspection.result)} me-2`}>
                        <span className='path1'></span>
                        <span className='path2'></span>
                      </i>
                      <span className={`fw-bold ${getStatusColor(selectedInspection.status, selectedInspection.result)}`}>
                        {selectedInspection.result === 'conditional' ? 'CONDITIONAL PASS' : selectedInspection.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className='col-md-6'>
                    <label className='form-label fw-bold'>Certificate Number</label>
                    <div className='text-gray-800'>
                      {selectedInspection.certificate_number || 'Not provided'}
                    </div>
                  </div>
                  {selectedInspection.punch_list && selectedInspection.punch_list.length > 0 && (
                    <div className='col-12'>
                      <label className='form-label fw-bold'>Punch List Items</label>
                      <ul className='text-gray-800'>
                        {selectedInspection.punch_list.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {selectedInspection.notes && (
                    <div className='col-12'>
                      <label className='form-label fw-bold'>Notes</label>
                      <div className='text-gray-800'>{selectedInspection.notes}</div>
                    </div>
                  )}
                </div>
              </div>
              <div className='modal-footer'>
                <button
                  className='btn btn-light'
                  onClick={() => setSelectedInspection(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default InspectionHistoryPage