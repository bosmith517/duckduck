import React from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody, KTIcon } from '../../../_metronic/helpers'

const TeamAnalyticsPage: React.FC = () => {
  return (
    <>
      <PageTitle breadcrumbs={[
        { title: 'Team', path: '/team' },
        { title: 'Analytics', path: '/team/analytics' }
      ]}>
        Team Analytics & Insights
      </PageTitle>
      
      <div className="row g-5">
        {/* Key Metrics */}
        <div className="col-12">
          <div className="row g-5">
            <div className="col-md-3">
              <div className="card bg-light-primary">
                <div className="card-body text-center py-8">
                  <KTIcon iconName="profile-user" className="fs-2x text-primary mb-3" />
                  <div className="fs-2 fw-bold text-dark">12</div>
                  <div className="text-primary fw-bold">Active Technicians</div>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-light-success">
                <div className="card-body text-center py-8">
                  <KTIcon iconName="chart-line-up" className="fs-2x text-success mb-3" />
                  <div className="fs-2 fw-bold text-dark">+15%</div>
                  <div className="text-success fw-bold">Productivity Growth</div>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-light-warning">
                <div className="card-body text-center py-8">
                  <KTIcon iconName="time" className="fs-2x text-warning mb-3" />
                  <div className="fs-2 fw-bold text-dark">38.5h</div>
                  <div className="text-warning fw-bold">Avg Weekly Hours</div>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-light-info">
                <div className="card-body text-center py-8">
                  <KTIcon iconName="dollar" className="fs-2x text-info mb-3" />
                  <div className="fs-2 fw-bold text-dark">$4,250</div>
                  <div className="text-info fw-bold">Avg Monthly Revenue</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Trends */}
        <div className="col-xl-8">
          <KTCard>
            <div className="card-header">
              <h3 className="card-title">Performance Trends</h3>
              <div className="card-toolbar">
                <select className="form-select form-select-sm w-150px">
                  <option>Last 3 months</option>
                  <option>Last 6 months</option>
                  <option>Last year</option>
                </select>
              </div>
            </div>
            <KTCardBody>
              <div className="row g-5">
                <div className="col-md-6">
                  <div className="card border border-dashed border-primary">
                    <div className="card-body text-center">
                      <KTIcon iconName="chart-simple" className="fs-2x text-primary mb-3" />
                      <h4 className="text-dark">Job Completion Rate</h4>
                      <div className="fs-1 fw-bold text-primary mb-2">94.2%</div>
                      <div className="text-success fs-7">
                        <KTIcon iconName="arrow-up" className="fs-7 me-1" />
                        +2.1% from last month
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="card border border-dashed border-success">
                    <div className="card-body text-center">
                      <KTIcon iconName="star" className="fs-2x text-success mb-3" />
                      <h4 className="text-dark">Customer Satisfaction</h4>
                      <div className="fs-1 fw-bold text-success mb-2">4.8/5</div>
                      <div className="text-success fs-7">
                        <KTIcon iconName="arrow-up" className="fs-7 me-1" />
                        +0.2 from last month
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="card border border-dashed border-warning">
                    <div className="card-body text-center">
                      <KTIcon iconName="timer" className="fs-2x text-warning mb-3" />
                      <h4 className="text-dark">Response Time</h4>
                      <div className="fs-1 fw-bold text-warning mb-2">23min</div>
                      <div className="text-success fs-7">
                        <KTIcon iconName="arrow-down" className="fs-7 me-1" />
                        -5min improvement
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="card border border-dashed border-info">
                    <div className="card-body text-center">
                      <KTIcon iconName="briefcase" className="fs-2x text-info mb-3" />
                      <h4 className="text-dark">Jobs per Technician</h4>
                      <div className="fs-1 fw-bold text-info mb-2">18.5</div>
                      <div className="text-success fs-7">
                        <KTIcon iconName="arrow-up" className="fs-7 me-1" />
                        +1.2 from last month
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="separator my-6"></div>
              
              <div className="alert alert-primary d-flex align-items-center p-5">
                <KTIcon iconName="information-5" className="fs-2hx text-primary me-4" />
                <div>
                  <h4 className="mb-1 text-dark">Performance Insights</h4>
                  <span>Your team's productivity has increased by 15% this quarter. Job completion rates are above industry average, and customer satisfaction scores continue to improve.</span>
                </div>
              </div>
            </KTCardBody>
          </KTCard>
        </div>

        {/* Team Workload */}
        <div className="col-xl-4">
          <KTCard>
            <div className="card-header">
              <h3 className="card-title">Current Workload</h3>
            </div>
            <KTCardBody>
              <div className="mb-5">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="text-dark fw-bold">John Davis</span>
                  <span className="badge badge-light-success">Available</span>
                </div>
                <div className="progress h-6px mb-2">
                  <div className="progress-bar bg-success" style={{ width: '75%' }}></div>
                </div>
                <div className="text-muted fs-7">3 active jobs • 75% capacity</div>
              </div>
              
              <div className="mb-5">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="text-dark fw-bold">Mike Smith</span>
                  <span className="badge badge-light-warning">Busy</span>
                </div>
                <div className="progress h-6px mb-2">
                  <div className="progress-bar bg-warning" style={{ width: '90%' }}></div>
                </div>
                <div className="text-muted fs-7">4 active jobs • 90% capacity</div>
              </div>
              
              <div className="mb-5">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="text-dark fw-bold">Sarah Johnson</span>
                  <span className="badge badge-light-primary">Available</span>
                </div>
                <div className="progress h-6px mb-2">
                  <div className="progress-bar bg-primary" style={{ width: '60%' }}></div>
                </div>
                <div className="text-muted fs-7">2 active jobs • 60% capacity</div>
              </div>
              
              <div className="mb-5">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="text-dark fw-bold">Tom Wilson</span>
                  <span className="badge badge-light-danger">Overloaded</span>
                </div>
                <div className="progress h-6px mb-2">
                  <div className="progress-bar bg-danger" style={{ width: '100%' }}></div>
                </div>
                <div className="text-muted fs-7">5 active jobs • 100% capacity</div>
              </div>

              <div className="separator my-4"></div>
              
              <div className="text-center">
                <h5 className="text-dark mb-3">Workload Distribution</h5>
                <div className="d-flex justify-content-between mb-2">
                  <span className="text-muted fs-7">Optimal</span>
                  <span className="text-success fw-bold">8 techs</span>
                </div>
                <div className="d-flex justify-content-between mb-2">
                  <span className="text-muted fs-7">Busy</span>
                  <span className="text-warning fw-bold">3 techs</span>
                </div>
                <div className="d-flex justify-content-between">
                  <span className="text-muted fs-7">Overloaded</span>
                  <span className="text-danger fw-bold">1 tech</span>
                </div>
              </div>
            </KTCardBody>
          </KTCard>
        </div>

        {/* Skill Matrix */}
        <div className="col-12">
          <KTCard>
            <div className="card-header">
              <h3 className="card-title">Team Skill Matrix</h3>
            </div>
            <KTCardBody>
              <div className="table-responsive">
                <table className="table align-middle table-row-dashed fs-6 gy-5">
                  <thead>
                    <tr className="text-start text-muted fw-bold fs-7 text-uppercase gs-0">
                      <th>Technician</th>
                      <th>HVAC</th>
                      <th>Plumbing</th>
                      <th>Electrical</th>
                      <th>Appliance Repair</th>
                      <th>Customer Service</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-600 fw-semibold">
                    <tr>
                      <td>
                        <div className="text-dark fw-bold">John Davis</div>
                        <div className="text-muted fs-7">Senior Technician</div>
                      </td>
                      <td><span className="badge badge-light-success">Expert</span></td>
                      <td><span className="badge badge-light-primary">Advanced</span></td>
                      <td><span className="badge badge-light-warning">Intermediate</span></td>
                      <td><span className="badge badge-light-primary">Advanced</span></td>
                      <td><span className="badge badge-light-success">Expert</span></td>
                    </tr>
                    <tr>
                      <td>
                        <div className="text-dark fw-bold">Mike Smith</div>
                        <div className="text-muted fs-7">Plumbing Specialist</div>
                      </td>
                      <td><span className="badge badge-light-warning">Intermediate</span></td>
                      <td><span className="badge badge-light-success">Expert</span></td>
                      <td><span className="badge badge-light-secondary">Beginner</span></td>
                      <td><span className="badge badge-light-warning">Intermediate</span></td>
                      <td><span className="badge badge-light-primary">Advanced</span></td>
                    </tr>
                    <tr>
                      <td>
                        <div className="text-dark fw-bold">Sarah Johnson</div>
                        <div className="text-muted fs-7">Electrical Technician</div>
                      </td>
                      <td><span className="badge badge-light-secondary">Beginner</span></td>
                      <td><span className="badge badge-light-warning">Intermediate</span></td>
                      <td><span className="badge badge-light-success">Expert</span></td>
                      <td><span className="badge badge-light-primary">Advanced</span></td>
                      <td><span className="badge badge-light-success">Expert</span></td>
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

export default TeamAnalyticsPage