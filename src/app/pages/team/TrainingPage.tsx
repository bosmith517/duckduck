import React from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody, KTIcon } from '../../../_metronic/helpers'

const TrainingPage: React.FC = () => {
  return (
    <>
      <PageTitle breadcrumbs={[
        { title: 'Team', path: '/team' },
        { title: 'Training', path: '/team/training' }
      ]}>
        Team Training & Development
      </PageTitle>
      
      <div className="row g-5">
        {/* Training Overview */}
        <div className="col-12">
          <div className="row g-5">
            <div className="col-md-3">
              <div className="card bg-light-primary">
                <div className="card-body text-center py-8">
                  <KTIcon iconName="book" className="fs-2x text-primary mb-3" />
                  <div className="fs-2 fw-bold text-dark">24</div>
                  <div className="text-primary fw-bold">Active Courses</div>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-light-success">
                <div className="card-body text-center py-8">
                  <KTIcon iconName="profile-user" className="fs-2x text-success mb-3" />
                  <div className="fs-2 fw-bold text-dark">89%</div>
                  <div className="text-success fw-bold">Completion Rate</div>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-light-warning">
                <div className="card-body text-center py-8">
                  <KTIcon iconName="medal" className="fs-2x text-warning mb-3" />
                  <div className="fs-2 fw-bold text-dark">156</div>
                  <div className="text-warning fw-bold">Certificates Earned</div>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-light-info">
                <div className="card-body text-center py-8">
                  <KTIcon iconName="time" className="fs-2x text-info mb-3" />
                  <div className="fs-2 fw-bold text-dark">42h</div>
                  <div className="text-info fw-bold">Avg Training Hours</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Available Courses */}
        <div className="col-xl-8">
          <KTCard>
            <div className="card-header">
              <h3 className="card-title">Available Training Courses</h3>
              <div className="card-toolbar">
                <button className="btn btn-primary btn-sm">
                  <KTIcon iconName="plus" className="fs-6 me-1" />
                  Add Course
                </button>
              </div>
            </div>
            <KTCardBody>
              <div className="row g-5">
                <div className="col-md-6">
                  <div className="card border border-dashed border-primary">
                    <div className="card-body">
                      <div className="d-flex align-items-center mb-3">
                        <KTIcon iconName="wrench" className="fs-2x text-primary me-3" />
                        <div>
                          <h4 className="text-dark mb-1">HVAC Fundamentals</h4>
                          <div className="text-muted fs-7">8 hours • Beginner</div>
                        </div>
                      </div>
                      <p className="text-muted mb-4">
                        Complete introduction to HVAC systems, maintenance, and troubleshooting.
                      </p>
                      <div className="d-flex justify-content-between align-items-center">
                        <div className="progress w-75 h-6px">
                          <div className="progress-bar bg-primary" style={{ width: '65%' }}></div>
                        </div>
                        <span className="text-muted fs-7">65%</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="card border border-dashed border-success">
                    <div className="card-body">
                      <div className="d-flex align-items-center mb-3">
                        <KTIcon iconName="shield-tick" className="fs-2x text-success me-3" />
                        <div>
                          <h4 className="text-dark mb-1">Safety Protocols</h4>
                          <div className="text-muted fs-7">4 hours • Required</div>
                        </div>
                      </div>
                      <p className="text-muted mb-4">
                        Essential safety procedures and OSHA compliance for field technicians.
                      </p>
                      <div className="d-flex justify-content-between align-items-center">
                        <div className="progress w-75 h-6px">
                          <div className="progress-bar bg-success" style={{ width: '100%' }}></div>
                        </div>
                        <span className="text-success fs-7">✓ Complete</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="card border border-dashed border-warning">
                    <div className="card-body">
                      <div className="d-flex align-items-center mb-3">
                        <KTIcon iconName="people" className="fs-2x text-warning me-3" />
                        <div>
                          <h4 className="text-dark mb-1">Customer Service</h4>
                          <div className="text-muted fs-7">6 hours • Intermediate</div>
                        </div>
                      </div>
                      <p className="text-muted mb-4">
                        Advanced customer communication and service excellence training.
                      </p>
                      <div className="d-flex justify-content-between align-items-center">
                        <div className="progress w-75 h-6px">
                          <div className="progress-bar bg-warning" style={{ width: '30%' }}></div>
                        </div>
                        <span className="text-muted fs-7">30%</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="card border border-dashed border-info">
                    <div className="card-body">
                      <div className="d-flex align-items-center mb-3">
                        <KTIcon iconName="code" className="fs-2x text-info me-3" />
                        <div>
                          <h4 className="text-dark mb-1">New Technology</h4>
                          <div className="text-muted fs-7">5 hours • Advanced</div>
                        </div>
                      </div>
                      <p className="text-muted mb-4">
                        Latest smart home technology and IoT device integration.
                      </p>
                      <div className="d-flex justify-content-between align-items-center">
                        <button className="btn btn-light-info btn-sm">Start Course</button>
                        <span className="text-muted fs-7">Not Started</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </KTCardBody>
          </KTCard>
        </div>

        {/* Team Progress */}
        <div className="col-xl-4">
          <KTCard>
            <div className="card-header">
              <h3 className="card-title">Team Progress</h3>
            </div>
            <KTCardBody>
              <div className="mb-5">
                <div className="d-flex align-items-center mb-2">
                  <div className="symbol symbol-30px me-3">
                    <div className="symbol-label bg-light-primary text-primary fw-bold fs-7">JD</div>
                  </div>
                  <div className="flex-grow-1">
                    <div className="text-dark fw-bold fs-7">John Davis</div>
                    <div className="progress h-4px">
                      <div className="progress-bar bg-primary" style={{ width: '85%' }}></div>
                    </div>
                  </div>
                  <span className="text-muted fs-8">85%</span>
                </div>
              </div>
              
              <div className="mb-5">
                <div className="d-flex align-items-center mb-2">
                  <div className="symbol symbol-30px me-3">
                    <div className="symbol-label bg-light-success text-success fw-bold fs-7">MS</div>
                  </div>
                  <div className="flex-grow-1">
                    <div className="text-dark fw-bold fs-7">Mike Smith</div>
                    <div className="progress h-4px">
                      <div className="progress-bar bg-success" style={{ width: '92%' }}></div>
                    </div>
                  </div>
                  <span className="text-muted fs-8">92%</span>
                </div>
              </div>
              
              <div className="mb-5">
                <div className="d-flex align-items-center mb-2">
                  <div className="symbol symbol-30px me-3">
                    <div className="symbol-label bg-light-warning text-warning fw-bold fs-7">SJ</div>
                  </div>
                  <div className="flex-grow-1">
                    <div className="text-dark fw-bold fs-7">Sarah Johnson</div>
                    <div className="progress h-4px">
                      <div className="progress-bar bg-warning" style={{ width: '67%' }}></div>
                    </div>
                  </div>
                  <span className="text-muted fs-8">67%</span>
                </div>
              </div>

              <div className="separator my-4"></div>

              <div className="text-center">
                <h4 className="text-dark">Upcoming Deadlines</h4>
                <div className="text-muted fs-7 mb-3">Training requirements due soon</div>
                
                <div className="alert alert-warning d-flex align-items-center p-4">
                  <KTIcon iconName="information-5" className="fs-2hx text-warning me-3" />
                  <div>
                    <div className="fw-bold">Safety Recertification</div>
                    <div className="fs-7">Due in 5 days</div>
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

export default TrainingPage