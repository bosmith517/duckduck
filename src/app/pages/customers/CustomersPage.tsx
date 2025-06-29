import React from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'

const CustomersPage: React.FC = () => {
  return (
    <>
      <PageTitle breadcrumbs={[]}>Customer Management</PageTitle>
      
      <div className='row g-5 g-xl-8'>
        <div className='col-xl-12'>
          <KTCard>
            <div className='card-header border-0 pt-5'>
              <h3 className='card-title align-items-start flex-column'>
                <span className='card-label fw-bold fs-3 mb-1'>Customer Relationship Center</span>
                <span className='text-muted mt-1 fw-semibold fs-7'>Manage all customer relationships and interactions</span>
              </h3>
            </div>
            <KTCardBody className='py-3'>
              {/* Navigation Tiles */}
              <div className='row g-6 g-xl-9 mb-6 mb-xl-9'>
                <div className='col-md-6 col-xxl-4'>
                  <a href='/accounts' className='card bg-light hoverable'>
                    <div className='card-body'>
                      <div className='d-flex flex-center flex-column p-4'>
                        <i className='ki-duotone ki-office-bag fs-3x text-primary mb-3'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                        </i>
                        <div className='fw-bold fs-5'>Accounts</div>
                        <div className='text-gray-400 fw-semibold'>Manage customer accounts</div>
                      </div>
                    </div>
                  </a>
                </div>
                
                <div className='col-md-6 col-xxl-4'>
                  <a href='/contacts' className='card bg-light hoverable'>
                    <div className='card-body'>
                      <div className='d-flex flex-center flex-column p-4'>
                        <i className='ki-duotone ki-address-book fs-3x text-success mb-3'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                          <span className='path3'></span>
                        </i>
                        <div className='fw-bold fs-5'>Contacts</div>
                        <div className='text-gray-400 fw-semibold'>Individual contact management</div>
                      </div>
                    </div>
                  </a>
                </div>
                
                <div className='col-md-6 col-xxl-4'>
                  <a href='/reports/customers' className='card bg-light hoverable'>
                    <div className='card-body'>
                      <div className='d-flex flex-center flex-column p-4'>
                        <i className='ki-duotone ki-chart-simple fs-3x text-info mb-3'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                          <span className='path3'></span>
                        </i>
                        <div className='fw-bold fs-5'>Customer Analytics</div>
                        <div className='text-gray-400 fw-semibold'>Insights & metrics</div>
                      </div>
                    </div>
                  </a>
                </div>
                
                <div className='col-md-6 col-xxl-4'>
                  <a href='/customer-portal' className='card bg-light hoverable'>
                    <div className='card-body'>
                      <div className='d-flex flex-center flex-column p-4'>
                        <i className='ki-duotone ki-monitor-mobile fs-3x text-warning mb-3'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                          <span className='path3'></span>
                        </i>
                        <div className='fw-bold fs-5'>Portal Preview</div>
                        <div className='text-gray-400 fw-semibold'>See customer view</div>
                      </div>
                    </div>
                  </a>
                </div>
                
                <div className='col-md-6 col-xxl-4'>
                  <a href='/communications' className='card bg-light hoverable'>
                    <div className='card-body'>
                      <div className='d-flex flex-center flex-column p-4'>
                        <i className='ki-duotone ki-message-text-2 fs-3x text-danger mb-3'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                          <span className='path3'></span>
                        </i>
                        <div className='fw-bold fs-5'>Communications</div>
                        <div className='text-gray-400 fw-semibold'>Customer interactions</div>
                      </div>
                    </div>
                  </a>
                </div>
                
                <div className='col-md-6 col-xxl-4'>
                  <a href='/estimates' className='card bg-light hoverable'>
                    <div className='card-body'>
                      <div className='d-flex flex-center flex-column p-4'>
                        <i className='ki-duotone ki-star fs-3x text-dark mb-3'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                        </i>
                        <div className='fw-bold fs-5'>Customer Feedback</div>
                        <div className='text-gray-400 fw-semibold'>Reviews & ratings</div>
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
                        <div className='text-gray-700 fw-bold fs-6 me-2'>Total Customers</div>
                        <div className='d-flex align-items-senter'>
                          <span className='text-gray-900 fw-bolder fs-6'>342</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className='col-md-6 col-xl-3'>
                  <div className='card card-flush'>
                    <div className='card-body p-9'>
                      <div className='d-flex flex-stack'>
                        <div className='text-gray-700 fw-bold fs-6 me-2'>Active This Month</div>
                        <div className='d-flex align-items-senter'>
                          <span className='text-success fw-bolder fs-6'>89</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className='col-md-6 col-xl-3'>
                  <div className='card card-flush'>
                    <div className='card-body p-9'>
                      <div className='d-flex flex-stack'>
                        <div className='text-gray-700 fw-bold fs-6 me-2'>Avg Satisfaction</div>
                        <div className='d-flex align-items-senter'>
                          <span className='text-primary fw-bolder fs-6'>4.8/5</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className='col-md-6 col-xl-3'>
                  <div className='card card-flush'>
                    <div className='card-body p-9'>
                      <div className='d-flex flex-stack'>
                        <div className='text-gray-700 fw-bold fs-6 me-2'>Lifetime Value</div>
                        <div className='d-flex align-items-senter'>
                          <span className='text-info fw-bolder fs-6'>$3,420</span>
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

export default CustomersPage