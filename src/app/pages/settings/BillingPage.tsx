import React from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody, KTIcon } from '../../../_metronic/helpers'

const BillingPage: React.FC = () => {
  return (
    <>
      <PageTitle breadcrumbs={[
        { title: 'Settings', path: '/settings' },
        { title: 'Billing & Payments', path: '/settings/billing' }
      ]}>
        Billing & Payment Processing
      </PageTitle>
      
      <div className="row g-5">
        {/* Current Plan */}
        <div className="col-xl-8">
          <KTCard>
            <div className="card-header">
              <h3 className="card-title">Current Plan</h3>
            </div>
            <KTCardBody>
              <div className="d-flex align-items-center mb-5">
                <div className="symbol symbol-60px me-5">
                  <span className="symbol-label bg-light-primary">
                    <KTIcon iconName="crown" className="fs-2x text-primary" />
                  </span>
                </div>
                <div className="flex-grow-1">
                  <div className="d-flex align-items-center mb-2">
                    <h4 className="fw-bold text-dark mb-0 me-3">Professional Plan</h4>
                    <span className="badge badge-light-success">ACTIVE</span>
                  </div>
                  <div className="text-muted">$199/month • Up to 25 technicians</div>
                </div>
                <div className="text-end">
                  <button className="btn btn-primary">Upgrade Plan</button>
                </div>
              </div>
              
              <div className="separator my-5"></div>
              
              <div className="row g-5">
                <div className="col-md-4">
                  <div className="text-center">
                    <div className="fs-2 fw-bold text-dark">$199</div>
                    <div className="text-muted">Monthly Cost</div>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="text-center">
                    <div className="fs-2 fw-bold text-dark">25</div>
                    <div className="text-muted">Max Technicians</div>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="text-center">
                    <div className="fs-2 fw-bold text-dark">12</div>
                    <div className="text-muted">Current Users</div>
                  </div>
                </div>
              </div>
            </KTCardBody>
          </KTCard>
        </div>

        {/* Billing Info */}
        <div className="col-xl-4">
          <KTCard>
            <div className="card-header">
              <h3 className="card-title">Billing Information</h3>
            </div>
            <KTCardBody>
              <div className="mb-5">
                <div className="d-flex align-items-center mb-3">
                  <KTIcon iconName="calendar" className="fs-6 text-muted me-2" />
                  <span className="text-muted">Next billing date:</span>
                </div>
                <div className="fw-bold">January 28, 2025</div>
              </div>
              
              <div className="mb-5">
                <div className="d-flex align-items-center mb-3">
                  <KTIcon iconName="credit-cart" className="fs-6 text-muted me-2" />
                  <span className="text-muted">Payment method:</span>
                </div>
                <div className="d-flex align-items-center">
                  <div className="symbol symbol-30px me-3">
                    <span className="symbol-label bg-light-primary">
                      <KTIcon iconName="credit-cart" className="fs-6 text-primary" />
                    </span>
                  </div>
                  <div>
                    <div className="fw-bold">•••• •••• •••• 4242</div>
                    <div className="text-muted fs-7">Expires 12/25</div>
                  </div>
                </div>
              </div>
              
              <button className="btn btn-light-primary w-100">Update Payment Method</button>
            </KTCardBody>
          </KTCard>
        </div>

        {/* Payment History */}
        <div className="col-12">
          <KTCard>
            <div className="card-header">
              <h3 className="card-title">Payment History</h3>
              <div className="card-toolbar">
                <button className="btn btn-light-primary btn-sm">
                  <KTIcon iconName="download" className="fs-6 me-1" />
                  Download Invoice
                </button>
              </div>
            </div>
            <KTCardBody>
              <div className="table-responsive">
                <table className="table align-middle table-row-dashed fs-6 gy-5">
                  <thead>
                    <tr className="text-start text-muted fw-bold fs-7 text-uppercase gs-0">
                      <th>Date</th>
                      <th>Description</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Invoice</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-600 fw-semibold">
                    <tr>
                      <td>Dec 28, 2024</td>
                      <td>Professional Plan - Monthly</td>
                      <td>$199.00</td>
                      <td>
                        <span className="badge badge-light-success">Paid</span>
                      </td>
                      <td>
                        <button className="btn btn-icon btn-bg-light btn-active-color-primary btn-sm">
                          <KTIcon iconName="download" className="fs-6" />
                        </button>
                      </td>
                    </tr>
                    <tr>
                      <td>Nov 28, 2024</td>
                      <td>Professional Plan - Monthly</td>
                      <td>$199.00</td>
                      <td>
                        <span className="badge badge-light-success">Paid</span>
                      </td>
                      <td>
                        <button className="btn btn-icon btn-bg-light btn-active-color-primary btn-sm">
                          <KTIcon iconName="download" className="fs-6" />
                        </button>
                      </td>
                    </tr>
                    <tr>
                      <td>Oct 28, 2024</td>
                      <td>Professional Plan - Monthly</td>
                      <td>$199.00</td>
                      <td>
                        <span className="badge badge-light-success">Paid</span>
                      </td>
                      <td>
                        <button className="btn btn-icon btn-bg-light btn-active-color-primary btn-sm">
                          <KTIcon iconName="download" className="fs-6" />
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </KTCardBody>
          </KTCard>
        </div>

        {/* Payment Processing Settings */}
        <div className="col-12">
          <KTCard>
            <div className="card-header">
              <h3 className="card-title">Payment Processing Settings</h3>
            </div>
            <KTCardBody>
              <div className="alert alert-primary d-flex align-items-center p-5 mb-5">
                <KTIcon iconName="information-5" className="fs-2hx text-primary me-4" />
                <div className="d-flex flex-column">
                  <h4 className="mb-1 text-dark">Payment Processing Coming Soon</h4>
                  <span>We're working on integrating Stripe and Square payment processing to help you collect payments from customers directly through invoices and the customer portal.</span>
                </div>
              </div>

              <div className="row g-5">
                <div className="col-md-6">
                  <div className="card border border-dashed border-primary">
                    <div className="card-body text-center py-8">
                      <KTIcon iconName="credit-cart" className="fs-2x text-primary mb-3" />
                      <h4 className="text-dark mb-3">Stripe Integration</h4>
                      <p className="text-muted mb-4">Accept credit cards, ACH payments, and more</p>
                      <button className="btn btn-outline-primary" disabled>
                        Coming Soon
                      </button>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="card border border-dashed border-primary">
                    <div className="card-body text-center py-8">
                      <KTIcon iconName="square" className="fs-2x text-primary mb-3" />
                      <h4 className="text-dark mb-3">Square Integration</h4>
                      <p className="text-muted mb-4">Process payments in person and online</p>
                      <button className="btn btn-outline-primary" disabled>
                        Coming Soon
                      </button>
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

export default BillingPage