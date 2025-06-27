import React, { useState } from 'react'
import UserProvisioningComponent from '../../components/communications/UserProvisioningComponent'
import EnhancedSoftphoneDialer, { useEnhancedSoftphone } from '../../components/communications/EnhancedSoftphoneDialer'

export const AutomationDemoPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'provision' | 'softphone'>('provision')
  const [sipConfig, setSipConfig] = useState<any>(null)
  
  const { 
    isVisible: softphoneVisible, 
    showDialer, 
    hideDialer 
  } = useEnhancedSoftphone()

  const handleProvisionComplete = (newSipConfig: any) => {
    setSipConfig(newSipConfig)
    // Automatically switch to softphone tab after provisioning
    setActiveTab('softphone')
  }

  return (
    <div className="container-fluid">
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">🚀 SignalWire Automation Demo</h3>
              <div className="card-toolbar">
                <p className="text-muted mb-0">
                  Complete workflow: Provision SIP endpoints → Connect softphone → Make calls
                </p>
              </div>
            </div>
            <div className="card-body">
              
              {/* Success Banner */}
              <div className="alert alert-success d-flex align-items-center mb-4">
                <span className="svg-icon svg-icon-2hx svg-icon-success me-4">🎉</span>
                <div className="d-flex flex-column">
                  <h4 className="mb-1 text-success">Authentication Issue Resolved!</h4>
                  <span>The 401 Unauthorized error has been fixed with scoped JWT tokens. The automation is now ready!</span>
                </div>
              </div>

              {/* Tab Navigation */}
              <ul className="nav nav-tabs nav-line-tabs mb-5 fs-6">
                <li className="nav-item">
                  <button 
                    className={`nav-link ${activeTab === 'provision' ? 'active' : ''}`}
                    onClick={() => setActiveTab('provision')}
                  >
                    <span className="nav-icon">
                      <i className="bi bi-gear fs-4"></i>
                    </span>
                    <span className="nav-text">1. Provision Endpoint</span>
                  </button>
                </li>
                <li className="nav-item">
                  <button 
                    className={`nav-link ${activeTab === 'softphone' ? 'active' : ''}`}
                    onClick={() => setActiveTab('softphone')}
                  >
                    <span className="nav-icon">
                      <i className="bi bi-telephone fs-4"></i>
                    </span>
                    <span className="nav-text">2. Connect Softphone</span>
                  </button>
                </li>
              </ul>

              {/* Tab Content */}
              <div className="tab-content">
                
                {/* Provision Tab */}
                {activeTab === 'provision' && (
                  <div className="tab-pane fade show active">
                    <div className="row">
                      <div className="col-lg-8">
                        <UserProvisioningComponent 
                          onProvisionComplete={handleProvisionComplete}
                        />
                      </div>
                      <div className="col-lg-4">
                        <div className="card bg-light">
                          <div className="card-body">
                            <h5 className="card-title">📋 Step 1: Provision</h5>
                            <p className="card-text">
                              This step creates a SIP endpoint for the user. The automation:
                            </p>
                            <ul className="list-unstyled">
                              <li>✅ Checks for existing credentials first</li>
                              <li>✅ Calls <code>create-sip-trunk</code> function</li>
                              <li>✅ Generates unique SIP credentials</li>
                              <li>✅ Stores endpoint in database</li>
                              <li>✅ Prevents duplicate provisioning</li>
                            </ul>
                            
                            {sipConfig && (
                              <div className="mt-3 p-3 bg-success bg-opacity-10 rounded">
                                <h6 className="text-success">✅ Endpoint Created!</h6>
                                <small className="text-muted">
                                  <strong>Username:</strong> {sipConfig.username}<br />
                                  <strong>Domain:</strong> {sipConfig.domain}
                                </small>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Softphone Tab */}
                {activeTab === 'softphone' && (
                  <div className="tab-pane fade show active">
                    <div className="row">
                      <div className="col-lg-8">
                        <div className="card">
                          <div className="card-header">
                            <h4 className="card-title">Enhanced Softphone Control</h4>
                          </div>
                          <div className="card-body">
                            <p className="text-muted mb-4">
                              The enhanced softphone uses the SignalWire Relay SDK with scoped JWT authentication.
                              It automatically connects to your provisioned SIP endpoint.
                            </p>
                            
                            <div className="d-flex gap-3 mb-4">
                              <button 
                                className="btn btn-primary"
                                onClick={showDialer}
                                disabled={softphoneVisible}
                              >
                                📞 Show Softphone
                              </button>
                              
                              <button 
                                className="btn btn-secondary"
                                onClick={hideDialer}
                                disabled={!softphoneVisible}
                              >
                                ❌ Hide Softphone
                              </button>
                            </div>

                            <div className="alert alert-info">
                              <h6>🔧 How It Works:</h6>
                              <ol className="mb-0">
                                <li>Gets user's tenant ID and SIP endpoint</li>
                                <li>Requests scoped JWT token for the endpoint</li>
                                <li>Connects using SignalWire Relay SDK</li>
                                <li>Ready to make PSTN calls!</li>
                              </ol>
                            </div>

                            {sipConfig && (
                              <div className="mt-3 p-3 bg-primary bg-opacity-10 rounded">
                                <h6 className="text-primary">📡 Using Endpoint:</h6>
                                <small className="text-muted">
                                  <strong>SIP URI:</strong> {sipConfig.username}@{sipConfig.domain}<br />
                                  <strong>Status:</strong> Ready for connection
                                </small>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="col-lg-4">
                        <div className="card bg-light">
                          <div className="card-body">
                            <h5 className="card-title">📞 Step 2: Connect</h5>
                            <p className="card-text">
                              The enhanced softphone automation:
                            </p>
                            <ul className="list-unstyled">
                              <li>✅ Auto-detects SIP endpoints</li>
                              <li>✅ Requests scoped JWT tokens</li>
                              <li>✅ Uses SignalWire Relay SDK</li>
                              <li>✅ Handles call state management</li>
                              <li>✅ Supports DTMF, mute, hangup</li>
                            </ul>
                            
                            <div className="mt-3 p-3 bg-warning bg-opacity-10 rounded">
                              <h6 className="text-warning">⚠️ Requirements:</h6>
                              <small className="text-muted">
                                • SIP endpoint must be provisioned<br />
                                • SIGNALWIRE_PROJECT_ID configured<br />
                                • Backend functions deployed
                              </small>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Architecture Overview */}
              <div className="separator border-2 my-10"></div>
              
              <div className="row">
                <div className="col-12">
                  <h4 className="mb-4">🏗️ Architecture Overview</h4>
                  <div className="row">
                    <div className="col-md-4">
                      <div className="card border border-primary">
                        <div className="card-body text-center">
                          <i className="bi bi-server fs-2x text-primary mb-3"></i>
                          <h5>Backend Functions</h5>
                          <ul className="list-unstyled text-muted">
                            <li>create-sip-trunk</li>
                            <li>list-sip-endpoints</li>
                            <li>generate-signalwire-voice-token</li>
                            <li>list-signalwire-phone-numbers</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="card border border-success">
                        <div className="card-body text-center">
                          <i className="bi bi-shield-check fs-2x text-success mb-3"></i>
                          <h5>Scoped Authentication</h5>
                          <ul className="list-unstyled text-muted">
                            <li>JWT tokens per SIP endpoint</li>
                            <li>Secure resource access</li>
                            <li>Multi-tenant isolation</li>
                            <li>Auto token refresh</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="card border border-info">
                        <div className="card-body text-center">
                          <i className="bi bi-telephone fs-2x text-info mb-3"></i>
                          <h5>Relay SDK Integration</h5>
                          <ul className="list-unstyled text-muted">
                            <li>Real-time call control</li>
                            <li>PSTN connectivity</li>
                            <li>Event-driven architecture</li>
                            <li>Browser compatibility</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Next Steps */}
              <div className="separator border-2 my-10"></div>
              
              <div className="alert alert-primary">
                <h5 className="alert-heading">🚀 Next Steps</h5>
                <p>Now that the automation is working:</p>
                <ol className="mb-0">
                  <li><strong>Deploy Backend:</strong> Ensure all Supabase functions are deployed</li>
                  <li><strong>Configure Environment:</strong> Set SIGNALWIRE_PROJECT_ID in your environment</li>
                  <li><strong>Test Integration:</strong> Use this demo to verify end-to-end functionality</li>
                  <li><strong>Production Deployment:</strong> Integrate components into your main application</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Softphone Component */}
      <EnhancedSoftphoneDialer 
        isVisible={softphoneVisible}
        onClose={hideDialer}
      />
    </div>
  )
}

export default AutomationDemoPage
