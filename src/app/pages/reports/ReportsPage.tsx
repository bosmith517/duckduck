import React, { useState } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'

interface ReportData {
  totalRevenue: number
  totalJobs: number
  activeJobs: number
  completedJobs: number
  pendingInvoices: number
  overdueInvoices: number
  inventoryValue: number
  lowStockItems: number
}

const ReportsPage: React.FC = () => {
  const [reportData] = useState<ReportData>({
    totalRevenue: 125000,
    totalJobs: 45,
    activeJobs: 12,
    completedJobs: 28,
    pendingInvoices: 8,
    overdueInvoices: 3,
    inventoryValue: 25000,
    lowStockItems: 5
  })

  const [selectedPeriod, setSelectedPeriod] = useState('month')

  const recentJobs = [
    { id: 'JOB-001', client: 'Smith Family', value: 15000, status: 'completed' },
    { id: 'JOB-002', client: 'Johnson Residence', value: 8500, status: 'in-progress' },
    { id: 'JOB-003', client: 'Williams Property', value: 5200, status: 'completed' },
    { id: 'JOB-004', client: 'Davis Home', value: 3500, status: 'pending' }
  ]

  const topClients = [
    { name: 'Smith Family', totalValue: 45000, jobs: 3 },
    { name: 'Corporate Office Building', totalValue: 35000, jobs: 2 },
    { name: 'Johnson Residence', totalValue: 18500, jobs: 2 },
    { name: 'Williams Property', totalValue: 12000, jobs: 2 }
  ]

  return (
    <>
      <PageTitle breadcrumbs={[]}>Reports & Analytics</PageTitle>
      
      {/* Summary Cards */}
      <div className='row g-5 g-xl-8 mb-8'>
        <div className='col-xl-3'>
          <div className='card card-xl-stretch mb-xl-8'>
            <div className='card-body'>
              <div className='d-flex align-items-center'>
                <div className='symbol symbol-50px me-5'>
                  <div className='symbol-label bg-light-success'>
                    <i className='ki-duotone ki-dollar fs-2x text-success'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                      <span className='path3'></span>
                    </i>
                  </div>
                </div>
                <div className='d-flex flex-column'>
                  <span className='fw-bold fs-6 text-gray-800'>${reportData.totalRevenue.toLocaleString()}</span>
                  <span className='fw-semibold fs-7 text-gray-400'>Total Revenue</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className='col-xl-3'>
          <div className='card card-xl-stretch mb-xl-8'>
            <div className='card-body'>
              <div className='d-flex align-items-center'>
                <div className='symbol symbol-50px me-5'>
                  <div className='symbol-label bg-light-primary'>
                    <i className='ki-duotone ki-briefcase fs-2x text-primary'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                    </i>
                  </div>
                </div>
                <div className='d-flex flex-column'>
                  <span className='fw-bold fs-6 text-gray-800'>{reportData.totalJobs}</span>
                  <span className='fw-semibold fs-7 text-gray-400'>Total Jobs</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className='col-xl-3'>
          <div className='card card-xl-stretch mb-xl-8'>
            <div className='card-body'>
              <div className='d-flex align-items-center'>
                <div className='symbol symbol-50px me-5'>
                  <div className='symbol-label bg-light-warning'>
                    <i className='ki-duotone ki-file-up fs-2x text-warning'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                    </i>
                  </div>
                </div>
                <div className='d-flex flex-column'>
                  <span className='fw-bold fs-6 text-gray-800'>{reportData.pendingInvoices}</span>
                  <span className='fw-semibold fs-7 text-gray-400'>Pending Invoices</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className='col-xl-3'>
          <div className='card card-xl-stretch mb-xl-8'>
            <div className='card-body'>
              <div className='d-flex align-items-center'>
                <div className='symbol symbol-50px me-5'>
                  <div className='symbol-label bg-light-info'>
                    <i className='ki-duotone ki-package fs-2x text-info'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                      <span className='path3'></span>
                    </i>
                  </div>
                </div>
                <div className='d-flex flex-column'>
                  <span className='fw-bold fs-6 text-gray-800'>${reportData.inventoryValue.toLocaleString()}</span>
                  <span className='fw-semibold fs-7 text-gray-400'>Inventory Value</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className='row g-5 g-xl-8'>
        {/* Recent Jobs */}
        <div className='col-xl-6'>
          <KTCard>
            <div className='card-header border-0 pt-5'>
              <h3 className='card-title align-items-start flex-column'>
                <span className='card-label fw-bold fs-3 mb-1'>Recent Jobs</span>
                <span className='text-muted mt-1 fw-semibold fs-7'>Latest project activity</span>
              </h3>
            </div>
            <KTCardBody className='py-3'>
              <div className='table-responsive'>
                <table className='table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4'>
                  <thead>
                    <tr className='fw-bold text-muted'>
                      <th>Job ID</th>
                      <th>Client</th>
                      <th>Value</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentJobs.map((job) => (
                      <tr key={job.id}>
                        <td className='text-dark fw-bold'>{job.id}</td>
                        <td className='text-dark fw-bold'>{job.client}</td>
                        <td className='text-dark fw-bold'>${job.value.toLocaleString()}</td>
                        <td>
                          <span className={`badge ${
                            job.status === 'completed' ? 'badge-light-success' :
                            job.status === 'in-progress' ? 'badge-light-primary' :
                            'badge-light-warning'
                          }`}>
                            {job.status.replace('-', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </KTCardBody>
          </KTCard>
        </div>

        {/* Top Clients */}
        <div className='col-xl-6'>
          <KTCard>
            <div className='card-header border-0 pt-5'>
              <h3 className='card-title align-items-start flex-column'>
                <span className='card-label fw-bold fs-3 mb-1'>Top Clients</span>
                <span className='text-muted mt-1 fw-semibold fs-7'>Highest value clients</span>
              </h3>
            </div>
            <KTCardBody className='py-3'>
              <div className='table-responsive'>
                <table className='table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4'>
                  <thead>
                    <tr className='fw-bold text-muted'>
                      <th>Client</th>
                      <th>Total Value</th>
                      <th>Jobs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topClients.map((client, index) => (
                      <tr key={index}>
                        <td className='text-dark fw-bold'>{client.name}</td>
                        <td className='text-dark fw-bold'>${client.totalValue.toLocaleString()}</td>
                        <td className='text-dark fw-bold'>{client.jobs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </KTCardBody>
          </KTCard>
        </div>
      </div>

      {/* Report Actions */}
      <div className='row g-5 g-xl-8 mt-5'>
        <div className='col-xl-12'>
          <KTCard>
            <div className='card-header border-0 pt-5'>
              <h3 className='card-title align-items-start flex-column'>
                <span className='card-label fw-bold fs-3 mb-1'>Generate Reports</span>
                <span className='text-muted mt-1 fw-semibold fs-7'>Export detailed reports</span>
              </h3>
            </div>
            <KTCardBody className='py-3'>
              <div className='row'>
                <div className='col-md-3'>
                  <button className='btn btn-light-primary w-100 mb-3'>
                    <i className='ki-duotone ki-chart-simple fs-2'></i>
                    <span className='d-block mt-2'>Financial Report</span>
                  </button>
                </div>
                <div className='col-md-3'>
                  <button className='btn btn-light-info w-100 mb-3'>
                    <i className='ki-duotone ki-profile-user fs-2'></i>
                    <span className='d-block mt-2'>Client Report</span>
                  </button>
                </div>
                <div className='col-md-3'>
                  <button className='btn btn-light-success w-100 mb-3'>
                    <i className='ki-duotone ki-briefcase fs-2'></i>
                    <span className='d-block mt-2'>Job Report</span>
                  </button>
                </div>
                <div className='col-md-3'>
                  <button className='btn btn-light-warning w-100 mb-3'>
                    <i className='ki-duotone ki-package fs-2'></i>
                    <span className='d-block mt-2'>Inventory Report</span>
                  </button>
                </div>
              </div>
            </KTCardBody>
          </KTCard>
        </div>
      </div>
    </>
  )
}

export default ReportsPage
