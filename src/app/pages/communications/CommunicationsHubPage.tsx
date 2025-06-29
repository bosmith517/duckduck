import React, { useState } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'
import AICallAssistant from '../../components/communications/AICallAssistant'
import AICallAnalytics from '../../components/communications/AICallAnalytics'
import AutomatedTriggers from '../../components/communications/AutomatedTriggers'
import CustomerPortalAnalytics from '../../components/communications/CustomerPortalAnalytics'
import SmartCommunicationIntelligence from '../../components/communications/SmartCommunicationIntelligence'

const CommunicationsHubPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <>
      <PageTitle breadcrumbs={[]}>Communications Hub</PageTitle>
      
      {/* Tab Navigation */}
      <ul className="nav nav-tabs nav-line-tabs mb-5 fs-6">
        <li className="nav-item">
          <a
            className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
            style={{ cursor: 'pointer' }}
          >
            Overview
          </a>
        </li>
        <li className="nav-item">
          <a
            className={`nav-link ${activeTab === 'ai-assistant' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai-assistant')}
            style={{ cursor: 'pointer' }}
          >
            <i className="ki-duotone ki-robot fs-6 me-2">
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
            AI Assistant
          </a>
        </li>
        <li className="nav-item">
          <a
            className={`nav-link ${activeTab === 'ai-analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai-analytics')}
            style={{ cursor: 'pointer' }}
          >
            <i className="ki-duotone ki-chart-line-star fs-6 me-2">
              <span className="path1"></span>
              <span className="path2"></span>
              <span className="path3"></span>
            </i>
            AI Analytics
          </a>
        </li>
        <li className="nav-item">
          <a
            className={`nav-link ${activeTab === 'automated-triggers' ? 'active' : ''}`}
            onClick={() => setActiveTab('automated-triggers')}
            style={{ cursor: 'pointer' }}
          >
            <i className="ki-duotone ki-notification-status fs-6 me-2">
              <span className="path1"></span>
              <span className="path2"></span>
              <span className="path3"></span>
              <span className="path4"></span>
            </i>
            Auto Messages
          </a>
        </li>
        <li className="nav-item">
          <a
            className={`nav-link ${activeTab === 'portal-analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('portal-analytics')}
            style={{ cursor: 'pointer' }}
          >
            <i className="ki-duotone ki-chart-simple fs-6 me-2">
              <span className="path1"></span>
              <span className="path2"></span>
              <span className="path3"></span>
            </i>
            Portal Analytics
          </a>
        </li>
        <li className="nav-item">
          <a
            className={`nav-link ${activeTab === 'smart-intelligence' ? 'active' : ''}`}
            onClick={() => setActiveTab('smart-intelligence')}
            style={{ cursor: 'pointer' }}
          >
            <i className="ki-duotone ki-brain fs-6 me-2">
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
            Smart Intelligence
          </a>
        </li>
      </ul>

      {/* Tab Content */}
      {activeTab === 'overview' && (
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
                  <a 
                    onClick={() => setActiveTab('ai-assistant')} 
                    className='card bg-light hoverable' 
                    style={{ cursor: 'pointer' }}
                  >
                    <div className='card-body'>
                      <div className='d-flex flex-center flex-column p-4'>
                        <i className='ki-duotone ki-robot fs-3x text-primary mb-3'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                        </i>
                        <div className='fw-bold fs-5'>AI Assistant</div>
                        <div className='text-gray-400 fw-semibold'>Intelligent voice AI</div>
                      </div>
                    </div>
                  </a>
                </div>
                
                <div className='col-md-6 col-xxl-4'>
                  <a 
                    onClick={() => setActiveTab('ai-analytics')} 
                    className='card bg-light hoverable' 
                    style={{ cursor: 'pointer' }}
                  >
                    <div className='card-body'>
                      <div className='d-flex flex-center flex-column p-4'>
                        <i className='ki-duotone ki-chart-line-star fs-3x text-success mb-3'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                          <span className='path3'></span>
                        </i>
                        <div className='fw-bold fs-5'>AI Analytics</div>
                        <div className='text-gray-400 fw-semibold'>Call transcripts & insights</div>
                      </div>
                    </div>
                  </a>
                </div>
                
                <div className='col-md-6 col-xxl-4'>
                  <a 
                    onClick={() => setActiveTab('automated-triggers')} 
                    className='card bg-light hoverable' 
                    style={{ cursor: 'pointer' }}
                  >
                    <div className='card-body'>
                      <div className='d-flex flex-center flex-column p-4'>
                        <i className='ki-duotone ki-notification-status fs-3x text-info mb-3'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                          <span className='path3'></span>
                          <span className='path4'></span>
                        </i>
                        <div className='fw-bold fs-5'>Auto Messages</div>
                        <div className='text-gray-400 fw-semibold'>Smart customer notifications</div>
                      </div>
                    </div>
                  </a>
                </div>
                
                <div className='col-md-6 col-xxl-4'>
                  <a 
                    onClick={() => setActiveTab('portal-analytics')} 
                    className='card bg-light hoverable' 
                    style={{ cursor: 'pointer' }}
                  >
                    <div className='card-body'>
                      <div className='d-flex flex-center flex-column p-4'>
                        <i className='ki-duotone ki-chart-simple fs-3x text-warning mb-3'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                          <span className='path3'></span>
                        </i>
                        <div className='fw-bold fs-5'>Portal Analytics</div>
                        <div className='text-gray-400 fw-semibold'>Customer engagement insights</div>
                      </div>
                    </div>
                  </a>
                </div>
                
                <div className='col-md-6 col-xxl-4'>
                  <a 
                    onClick={() => setActiveTab('smart-intelligence')} 
                    className='card bg-light hoverable' 
                    style={{ cursor: 'pointer' }}
                  >
                    <div className='card-body'>
                      <div className='d-flex flex-center flex-column p-4'>
                        <i className='ki-duotone ki-brain fs-3x text-purple mb-3'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                        </i>
                        <div className='fw-bold fs-5'>Smart Intelligence</div>
                        <div className='text-gray-400 fw-semibold'>AI-powered communication insights</div>
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
      )}

      {/* AI Assistant Tab */}
      {activeTab === 'ai-assistant' && (
        <div className='row g-5 g-xl-8'>
          <div className='col-xl-12'>
            <AICallAssistant />
          </div>
        </div>
      )}

      {/* AI Analytics Tab */}
      {activeTab === 'ai-analytics' && (
        <div className='row g-5 g-xl-8'>
          <div className='col-xl-12'>
            <AICallAnalytics />
          </div>
        </div>
      )}

      {/* Automated Triggers Tab */}
      {activeTab === 'automated-triggers' && (
        <div className='row g-5 g-xl-8'>
          <div className='col-xl-12'>
            <AutomatedTriggers />
          </div>
        </div>
      )}

      {/* Portal Analytics Tab */}
      {activeTab === 'portal-analytics' && (
        <div className='row g-5 g-xl-8'>
          <div className='col-xl-12'>
            <CustomerPortalAnalytics />
          </div>
        </div>
      )}

      {/* Smart Intelligence Tab */}
      {activeTab === 'smart-intelligence' && (
        <div className='row g-5 g-xl-8'>
          <div className='col-xl-12'>
            <SmartCommunicationIntelligence />
          </div>
        </div>
      )}
    </>
  )
}

export default CommunicationsHubPage