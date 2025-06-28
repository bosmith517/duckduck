import React from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'

const CommunicationsHubPage: React.FC = () => {
  return (
    <>
      <PageTitle breadcrumbs={[]}>Communications Hub</PageTitle>
      
      <div className='row g-5 g-xl-8'>
        <div className='col-xl-12'>
          <KTCard>
            <div className='card-header border-0 pt-5'>
              <h3 className='card-title align-items-start flex-column'>
                <span className='card-label fw-bold fs-3 mb-1'>Communication Command Center</span>
                <span className='text-muted mt-1 fw-semibold fs-7'>Manage all customer and team communications</span>
              </h3>
            </div>
            <KTCardBody className='py-3'>
              {/* Navigation Tiles */}
              <div className='row g-6 g-xl-9 mb-6 mb-xl-9'>
                <div className='col-md-6 col-xxl-4'>
                  <a href='/communications/call-center' className='card bg-light hoverable'>
                    <div className='card-body'>
                      <div className='d-flex flex-center flex-column p-4'>
                        <i className='ki-duotone ki-phone fs-3x text-primary mb-3'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                        </i>
                        <div className='fw-bold fs-5'>Call Center</div>
                        <div className='text-gray-400 fw-semibold'>VoIP calls & softphone</div>
                      </div>
                    </div>
                  </a>
                </div>
                
                <div className='col-md-6 col-xxl-4'>
                  <a href='/communications/sms' className='card bg-light hoverable'>
                    <div className='card-body'>
                      <div className='d-flex flex-center flex-column p-4'>
                        <i className='ki-duotone ki-sms fs-3x text-success mb-3'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                        </i>
                        <div className='fw-bold fs-5'>SMS Messages</div>
                        <div className='text-gray-400 fw-semibold'>Text messaging</div>
                      </div>
                    </div>
                  </a>
                </div>
                
                <div className='col-md-6 col-xxl-4'>
                  <a href='/communications/video' className='card bg-light hoverable'>
                    <div className='card-body'>
                      <div className='d-flex flex-center flex-column p-4'>
                        <i className='ki-duotone ki-video fs-3x text-info mb-3'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                        </i>
                        <div className='fw-bold fs-5'>Video Meetings</div>
                        <div className='text-gray-400 fw-semibold'>Video consultations</div>
                      </div>
                    </div>
                  </a>
                </div>
                
                <div className='col-md-6 col-xxl-4'>
                  <a href='/communications/voicemail' className='card bg-light hoverable'>
                    <div className='card-body'>
                      <div className='d-flex flex-center flex-column p-4'>
                        <i className='ki-duotone ki-message-text-2 fs-3x text-warning mb-3'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                          <span className='path3'></span>
                        </i>
                        <div className='fw-bold fs-5'>Voicemail Center</div>
                        <div className='text-gray-400 fw-semibold'>Manage voicemails</div>
                      </div>
                    </div>
                  </a>
                </div>
                
                <div className='col-md-6 col-xxl-4'>
                  <a href='/team' className='card bg-light hoverable'>
                    <div className='card-body'>
                      <div className='d-flex flex-center flex-column p-4'>
                        <i className='ki-duotone ki-people fs-3x text-danger mb-3'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                          <span className='path3'></span>
                          <span className='path4'></span>
                          <span className='path5'></span>
                        </i>
                        <div className='fw-bold fs-5'>Team Chat</div>
                        <div className='text-gray-400 fw-semibold'>Internal messaging</div>
                      </div>
                    </div>
                  </a>
                </div>
                
                <div className='col-md-6 col-xxl-4'>
                  <a href='/settings/communications' className='card bg-light hoverable'>
                    <div className='card-body'>
                      <div className='d-flex flex-center flex-column p-4'>
                        <i className='ki-duotone ki-setting-2 fs-3x text-dark mb-3'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                        </i>
                        <div className='fw-bold fs-5'>Phone Numbers</div>
                        <div className='text-gray-400 fw-semibold'>Manage phone system</div>
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
                        <div className='text-gray-700 fw-bold fs-6 me-2'>Calls Today</div>
                        <div className='d-flex align-items-senter'>
                          <span className='text-gray-900 fw-bolder fs-6'>47</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className='col-md-6 col-xl-3'>
                  <div className='card card-flush'>
                    <div className='card-body p-9'>
                      <div className='d-flex flex-stack'>
                        <div className='text-gray-700 fw-bold fs-6 me-2'>SMS Sent</div>
                        <div className='d-flex align-items-senter'>
                          <span className='text-success fw-bolder fs-6'>156</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className='col-md-6 col-xl-3'>
                  <div className='card card-flush'>
                    <div className='card-body p-9'>
                      <div className='d-flex flex-stack'>
                        <div className='text-gray-700 fw-bold fs-6 me-2'>Video Meetings</div>
                        <div className='d-flex align-items-senter'>
                          <span className='text-primary fw-bolder fs-6'>8</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className='col-md-6 col-xl-3'>
                  <div className='card card-flush'>
                    <div className='card-body p-9'>
                      <div className='d-flex flex-stack'>
                        <div className='text-gray-700 fw-bold fs-6 me-2'>Response Rate</div>
                        <div className='d-flex align-items-senter'>
                          <span className='text-info fw-bolder fs-6'>94%</span>
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

export default CommunicationsHubPage