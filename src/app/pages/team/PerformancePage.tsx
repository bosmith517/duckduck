import React from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody, KTIcon } from '../../../_metronic/helpers'

const PerformancePage: React.FC = () => {
  return (
    <>
      <PageTitle breadcrumbs={[
        { title: 'Team', path: '/team' },
        { title: 'Performance', path: '/team/performance' }
      ]}>
        Team Performance Analytics
      </PageTitle>
      
      <div className="row g-5">
        {/* Performance Overview */}
        <div className="col-12">
          <div className="row g-5">
            <div className="col-md-3">
              <div className="card bg-light-primary">
                <div className="card-body text-center py-8">
                  <KTIcon iconName="chart-line-up" className="fs-2x text-primary mb-3" />
                  <div className="fs-2 fw-bold text-dark">94.2%</div>
                  <div className="text-primary fw-bold">Job Completion Rate</div>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-light-success">
                <div className="card-body text-center py-8">
                  <KTIcon iconName="star" className="fs-2x text-success mb-3" />
                  <div className="fs-2 fw-bold text-dark">4.8</div>
                  <div className="text-success fw-bold">Avg Customer Rating</div>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-light-warning">
                <div className="card-body text-center py-8">
                  <KTIcon iconName="time" className="fs-2x text-warning mb-3" />
                  <div className="fs-2 fw-bold text-dark">2.3h</div>
                  <div className="text-warning fw-bold">Avg Job Time</div>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-light-info">
                <div className="card-body text-center py-8">
                  <KTIcon iconName="dollar" className="fs-2x text-info mb-3" />
                  <div className="fs-2 fw-bold text-dark">$2,340</div>
                  <div className="text-info fw-bold">Avg Revenue/Tech</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Team Performance Table */}
        <div className="col-12">
          <KTCard>
            <div className="card-header">
              <h3 className="card-title">Individual Performance</h3>
              <div className="card-toolbar">
                <select className="form-select form-select-sm w-150px">
                  <option>Last 30 days</option>
                  <option>Last 7 days</option>
                  <option>This month</option>
                </select>
              </div>
            </div>
            <KTCardBody>
              <div className="table-responsive">
                <table className="table align-middle table-row-dashed fs-6 gy-5">
                  <thead>
                    <tr className="text-start text-muted fw-bold fs-7 text-uppercase gs-0">
                      <th>Technician</th>
                      <th>Jobs Completed</th>
                      <th>Avg Rating</th>
                      <th>Revenue Generated</th>
                      <th>Efficiency</th>
                      <th>Performance</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-600 fw-semibold">
                    <tr>
                      <td>
                        <div className="d-flex align-items-center">
                          <div className="symbol symbol-40px me-3">
                            <div className="symbol-label bg-light-primary text-primary fw-bold fs-7">JD</div>
                          </div>
                          <div>
                            <div className="text-dark fw-bold">John Davis</div>
                            <div className="text-muted fs-7">Senior HVAC Tech</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="fw-bold">28</span>
                        <span className="text-muted fs-7 ms-2">jobs</span>
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <KTIcon iconName="star" className="fs-6 text-warning me-1" />
                          <span className="fw-bold">4.9</span>
                        </div>
                      </td>
                      <td>
                        <span className="fw-bold text-success">$12,450</span>
                      </td>
                      <td>
                        <div className="progress h-6px w-100px">
                          <div className="progress-bar bg-success" style={{ width: '95%' }}></div>
                        </div>
                        <span className="text-muted fs-7">95%</span>
                      </td>
                      <td>
                        <span className="badge badge-light-success">Excellent</span>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <div className="d-flex align-items-center">
                          <div className="symbol symbol-40px me-3">
                            <div className="symbol-label bg-light-info text-info fw-bold fs-7">MS</div>
                          </div>
                          <div>
                            <div className="text-dark fw-bold">Mike Smith</div>
                            <div className="text-muted fs-7">Plumbing Specialist</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="fw-bold">22</span>
                        <span className="text-muted fs-7 ms-2">jobs</span>
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <KTIcon iconName="star" className="fs-6 text-warning me-1" />
                          <span className="fw-bold">4.7</span>
                        </div>
                      </td>
                      <td>
                        <span className="fw-bold text-success">$9,860</span>
                      </td>
                      <td>
                        <div className="progress h-6px w-100px">
                          <div className="progress-bar bg-primary" style={{ width: '88%' }}></div>
                        </div>
                        <span className="text-muted fs-7">88%</span>
                      </td>
                      <td>
                        <span className="badge badge-light-primary">Good</span>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <div className="d-flex align-items-center">
                          <div className="symbol symbol-40px me-3">
                            <div className="symbol-label bg-light-warning text-warning fw-bold fs-7">SJ</div>
                          </div>
                          <div>
                            <div className="text-dark fw-bold">Sarah Johnson</div>
                            <div className="text-muted fs-7">Electrical Tech</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="fw-bold">15</span>
                        <span className="text-muted fs-7 ms-2">jobs</span>
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <KTIcon iconName="star" className="fs-6 text-warning me-1" />
                          <span className="fw-bold">4.8</span>
                        </div>
                      </td>
                      <td>
                        <span className="fw-bold text-success">$7,230</span>
                      </td>
                      <td>
                        <div className="progress h-6px w-100px">
                          <div className="progress-bar bg-warning" style={{ width: '75%' }}></div>
                        </div>
                        <span className="text-muted fs-7">75%</span>
                      </td>
                      <td>
                        <span className="badge badge-light-warning">Improving</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </KTCardBody>
          </KTCard>
        </div>
      </div>
    </>
  )
}

export default PerformancePage