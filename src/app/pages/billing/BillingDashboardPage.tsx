import React, { useState } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'

const BillingDashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <>
      <PageTitle breadcrumbs={[]}>Billing & Payments</PageTitle>
      
      <div className='row g-5 g-xl-8'>
        <div className='col-xl-12'>
          <KTCard>
            <div className='card-header border-0 pt-5'>
              <h3 className='card-title align-items-start flex-column'>
                <span className='card-label fw-bold fs-3 mb-1'>Revenue Engine</span>
                <span className='text-muted mt-1 fw-semibold fs-7'>Manage all billing and payment operations</span>
              </h3>
            </div>
            <KTCardBody className='py-3'>
              {/* Navigation Tiles */}
              <div className='row g-6 g-xl-9 mb-6 mb-xl-9'>
                <div className='col-md-6 col-xxl-4'>
                  <a href='/billing/invoices' className='card bg-light hoverable'>
                    <div className='card-body'>
                      <div className='d-flex flex-center flex-column p-4'>
                        <i className='ki-duotone ki-bill fs-3x text-primary mb-3'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                        </i>
                        <div className='fw-bold fs-5'>Invoices</div>
                        <div className='text-gray-400 fw-semibold'>Create and manage invoices</div>
                      </div>
                    </div>
                  </a>
                </div>
                
                <div className='col-md-6 col-xxl-4'>
                  <a href='/billing/estimates' className='card bg-light hoverable'>
                    <div className='card-body'>
                      <div className='d-flex flex-center flex-column p-4'>
                        <i className='ki-duotone ki-file-text fs-3x text-success mb-3'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                        </i>
                        <div className='fw-bold fs-5'>Estimates & Quotes</div>
                        <div className='text-gray-400 fw-semibold'>Good/Better/Best pricing</div>
                      </div>
                    </div>
                  </a>
                </div>
                
                <div className='col-md-6 col-xxl-4'>
                  <a href='/reports/financial' className='card bg-light hoverable'>
                    <div className='card-body'>
                      <div className='d-flex flex-center flex-column p-4'>
                        <i className='ki-duotone ki-chart-simple fs-3x text-info mb-3'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                          <span className='path3'></span>
                        </i>
                        <div className='fw-bold fs-5'>Financial Reports</div>
                        <div className='text-gray-400 fw-semibold'>Profitability analytics</div>
                      </div>
                    </div>
                  </a>
                </div>
                
                <div className='col-md-6 col-xxl-4'>
                  <a href='/settings/billing' className='card bg-light hoverable'>
                    <div className='card-body'>
                      <div className='d-flex flex-center flex-column p-4'>
                        <i className='ki-duotone ki-setting-2 fs-3x text-warning mb-3'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                        </i>
                        <div className='fw-bold fs-5'>Payment Processing</div>
                        <div className='text-gray-400 fw-semibold'>Configure payment methods</div>
                      </div>
                    </div>
                  </a>
                </div>
                
                <div className='col-md-6 col-xxl-4'>
                  <a href='/customers/portal-preview' className='card bg-light hoverable'>
                    <div className='card-body'>
                      <div className='d-flex flex-center flex-column p-4'>
                        <i className='ki-duotone ki-profile-circle fs-3x text-danger mb-3'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                        </i>
                        <div className='fw-bold fs-5'>Customer Portal</div>
                        <div className='text-gray-400 fw-semibold'>Client billing interface</div>
                      </div>
                    </div>
                  </a>
                </div>
                
                <div className='col-md-6 col-xxl-4'>
                  <a href='/services/catalog' className='card bg-light hoverable'>
                    <div className='card-body'>
                      <div className='d-flex flex-center flex-column p-4'>
                        <i className='ki-duotone ki-package fs-3x text-dark mb-3'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                          <span className='path3'></span>
                        </i>
                        <div className='fw-bold fs-5'>Service Catalog</div>
                        <div className='text-gray-400 fw-semibold'>Manage pricing & services</div>
                      </div>
                    </div>
                  </a>
                </div>
              </div>
              
              {/* Quick Stats */}
              <div className='row g-6 g-xl-9'>
                <div className='col-md-6 col-xl-3'>
                  <div className='card card-flush'>
                    <div className='card-body p-9'>
                      <div className='d-flex flex-stack'>
                        <div className='text-gray-700 fw-bold fs-6 me-2'>This Month Revenue</div>
                        <div className='d-flex align-items-senter'>
                          <span className='text-gray-900 fw-bolder fs-6'>$24,500</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className='col-md-6 col-xl-3'>
                  <div className='card card-flush'>
                    <div className='card-body p-9'>
                      <div className='d-flex flex-stack'>
                        <div className='text-gray-700 fw-bold fs-6 me-2'>Outstanding Invoices</div>
                        <div className='d-flex align-items-senter'>
                          <span className='text-warning fw-bolder fs-6'>$8,750</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className='col-md-6 col-xl-3'>
                  <div className='card card-flush'>
                    <div className='card-body p-9'>
                      <div className='d-flex flex-stack'>
                        <div className='text-gray-700 fw-bold fs-6 me-2'>Pending Estimates</div>
                        <div className='d-flex align-items-senter'>
                          <span className='text-primary fw-bolder fs-6'>12</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className='col-md-6 col-xl-3'>
                  <div className='card card-flush'>
                    <div className='card-body p-9'>
                      <div className='d-flex flex-stack'>
                        <div className='text-gray-700 fw-bold fs-6 me-2'>Profit Margin</div>
                        <div className='d-flex align-items-senter'>
                          <span className='text-success fw-bolder fs-6'>28.5%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </KTCardBody>
          </KTCard>
        </div>
      </div>
    </>
  )
}

export default BillingDashboardPage