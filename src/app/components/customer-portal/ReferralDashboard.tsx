import React, { useState, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'

interface ReferralCode {
  id: string
  code: string
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  total_referrals: number
  successful_conversions: number
  total_earned: number
  pending_rewards: number
  qr_code_url?: string
  custom_message?: string
}

interface ReferralTracking {
  id: string
  referred_name: string
  referred_at: string
  status: string
  conversion_value?: number
  reward_amount?: number
}

interface ReferralDashboardProps {
  customerId: string
  customerName: string
  tenantId: string
}

const ReferralDashboard: React.FC<ReferralDashboardProps> = ({ 
  customerId, 
  customerName,
  tenantId 
}) => {
  const [referralCode, setReferralCode] = useState<ReferralCode | null>(null)
  const [referrals, setReferrals] = useState<ReferralTracking[]>([])
  const [loading, setLoading] = useState(true)
  const [showShareModal, setShowShareModal] = useState(false)
  const [customMessage, setCustomMessage] = useState('')
  const [leaderboardRank, setLeaderboardRank] = useState<number | null>(null)

  useEffect(() => {
    loadReferralData()
  }, [customerId])

  const loadReferralData = async () => {
    try {
      setLoading(true)

      // Get or create referral code
      const { data: codeData } = await supabase
        .from('referral_codes')
        .select('*')
        .eq('customer_id', customerId)
        .single()

      if (codeData) {
        setReferralCode(codeData)
        setCustomMessage(codeData.custom_message || '')
        
        // Load referral history
        const { data: trackingData } = await supabase
          .from('referral_tracking')
          .select('*')
          .eq('referral_code_id', codeData.id)
          .order('referred_at', { ascending: false })

        if (trackingData) {
          setReferrals(trackingData)
        }

        // Get leaderboard rank
        const { data: rankData } = await supabase
          .from('v_referral_leaderboard')
          .select('overall_rank')
          .eq('customer_id', customerId)
          .single()

        if (rankData) {
          setLeaderboardRank(rankData.overall_rank)
        }
      } else {
        // Create referral code
        await createReferralCode()
      }
    } catch (error) {
      console.error('Error loading referral data:', error)
    } finally {
      setLoading(false)
    }
  }

  const createReferralCode = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('create-referral-code', {
        body: { customerId, customMessage }
      })

      if (error) throw error

      if (data.success && data.referralCode) {
        setReferralCode(data.referralCode)
        showToast.success('Your referral code has been created!')
      }
    } catch (error) {
      console.error('Error creating referral code:', error)
      showToast.error('Failed to create referral code')
    }
  }

  const getReferralLink = () => {
    const baseUrl = window.location.origin
    return `${baseUrl}/refer/${referralCode?.code}`
  }

  const shareViaEmail = () => {
    const subject = `Check out ${customerName}'s recommended service!`
    const body = customMessage || 
      `I've had a great experience with this company and thought you might be interested. Use my referral link to get started: ${getReferralLink()}`
    
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  const shareViaSMS = () => {
    const message = customMessage || 
      `I recommend this great service! Check them out: ${getReferralLink()}`
    
    window.location.href = `sms:?body=${encodeURIComponent(message)}`
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(getReferralLink())
    showToast.success('Referral link copied to clipboard!')
  }

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'bronze':
        return '🥉'
      case 'silver':
        return '🥈'
      case 'gold':
        return '🥇'
      case 'platinum':
        return '💎'
      default:
        return '🏆'
    }
  }

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'bronze':
        return 'warning'
      case 'silver':
        return 'secondary'
      case 'gold':
        return 'warning'
      case 'platinum':
        return 'info'
      default:
        return 'primary'
    }
  }

  const getNextTierInfo = () => {
    if (!referralCode) return null
    
    const thresholds = {
      bronze: { next: 'silver', needed: 3 },
      silver: { next: 'gold', needed: 6 },
      gold: { next: 'platinum', needed: 10 },
      platinum: { next: null, needed: 0 }
    }
    
    const current = thresholds[referralCode.tier]
    if (!current.next) return null
    
    const needed = current.needed - referralCode.successful_conversions
    return { nextTier: current.next, referralsNeeded: needed }
  }

  if (loading) {
    return (
      <div className="text-center py-10">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  const nextTierInfo = getNextTierInfo()

  return (
    <div className="referral-dashboard">
      {/* Stats Overview */}
      <div className="row g-6 mb-6">
        <div className="col-md-3">
          <div className="card bg-light-primary">
            <div className="card-body">
              <div className="d-flex align-items-center mb-3">
                <span className="fs-1">{getTierIcon(referralCode?.tier || 'bronze')}</span>
                <div className="ms-3">
                  <h6 className="mb-0 text-primary">Current Tier</h6>
                  <h4 className="mb-0 text-capitalize">{referralCode?.tier}</h4>
                </div>
              </div>
              {nextTierInfo && (
                <div className="progress" style={{ height: '10px' }}>
                  <div 
                    className="progress-bar bg-primary" 
                    role="progressbar" 
                    style={{ width: `${((referralCode?.successful_conversions || 0) / (referralCode?.successful_conversions || 0 + nextTierInfo.referralsNeeded)) * 100}%` }}
                  ></div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="col-md-3">
          <div className="card bg-light-success">
            <div className="card-body">
              <div className="d-flex align-items-center">
                <i className="ki-duotone ki-people fs-2x text-success">
                  <span className="path1"></span>
                  <span className="path2"></span>
                  <span className="path3"></span>
                  <span className="path4"></span>
                  <span className="path5"></span>
                </i>
                <div className="ms-3">
                  <h6 className="mb-0 text-success">Total Referrals</h6>
                  <h4 className="mb-0">{referralCode?.total_referrals || 0}</h4>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="col-md-3">
          <div className="card bg-light-info">
            <div className="card-body">
              <div className="d-flex align-items-center">
                <i className="ki-duotone ki-verify fs-2x text-info">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                <div className="ms-3">
                  <h6 className="mb-0 text-info">Conversions</h6>
                  <h4 className="mb-0">{referralCode?.successful_conversions || 0}</h4>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="col-md-3">
          <div className="card bg-light-warning">
            <div className="card-body">
              <div className="d-flex align-items-center">
                <i className="ki-duotone ki-dollar fs-2x text-warning">
                  <span className="path1"></span>
                  <span className="path2"></span>
                  <span className="path3"></span>
                </i>
                <div className="ms-3">
                  <h6 className="mb-0 text-warning">Total Earned</h6>
                  <h4 className="mb-0">${referralCode?.total_earned || 0}</h4>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Referral Code Section */}
      <div className="card mb-6">
        <div className="card-header">
          <h3 className="card-title">Your Referral Code</h3>
          <div className="card-toolbar">
            <button 
              className="btn btn-sm btn-primary"
              onClick={() => setShowShareModal(true)}
            >
              <i className="ki-duotone ki-share fs-4 me-2">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              Share
            </button>
          </div>
        </div>
        <div className="card-body">
          <div className="row align-items-center">
            <div className="col-md-8">
              <div className="d-flex align-items-center mb-4">
                <div className="bg-light-primary rounded p-6 me-4">
                  <h1 className="mb-0 text-primary fw-bold">{referralCode?.code}</h1>
                </div>
                <div>
                  <p className="text-muted mb-2">Share this code with friends and family</p>
                  <div className="d-flex gap-2">
                    <button 
                      className="btn btn-sm btn-light-primary"
                      onClick={copyToClipboard}
                    >
                      <i className="ki-duotone ki-copy fs-5"></i> Copy Link
                    </button>
                    <button 
                      className="btn btn-sm btn-light-success"
                      onClick={shareViaEmail}
                    >
                      <i className="ki-duotone ki-sms fs-5"></i> Email
                    </button>
                    <button 
                      className="btn btn-sm btn-light-info"
                      onClick={shareViaSMS}
                    >
                      <i className="ki-duotone ki-message-text fs-5"></i> SMS
                    </button>
                  </div>
                </div>
              </div>
              
              {nextTierInfo && (
                <div className="alert alert-info d-flex align-items-center">
                  <i className="ki-duotone ki-information-5 fs-2x me-3">
                    <span className="path1"></span>
                    <span className="path2"></span>
                    <span className="path3"></span>
                  </i>
                  <div>
                    <strong>{nextTierInfo.referralsNeeded} more successful referral{nextTierInfo.referralsNeeded !== 1 ? 's' : ''}</strong> to reach {nextTierInfo.nextTier} tier!
                  </div>
                </div>
              )}
            </div>
            <div className="col-md-4 text-center">
              <div className="bg-white p-4 rounded shadow-sm">
                <div className="bg-light d-flex align-items-center justify-content-center" style={{ width: '150px', height: '150px', margin: '0 auto' }}>
                  <div className="text-center">
                    <i className="ki-duotone ki-qr-code fs-5x text-primary">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    <p className="text-muted fs-8 mt-2 mb-0">QR Code</p>
                  </div>
                </div>
                <p className="text-muted fs-7 mt-2 mb-0">Scan to share</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Referral History */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Referral History</h3>
          {leaderboardRank && (
            <div className="card-toolbar">
              <span className="badge badge-light-primary fs-7">
                Rank #{leaderboardRank}
              </span>
            </div>
          )}
        </div>
        <div className="card-body">
          {referrals.length > 0 ? (
            <div className="table-responsive">
              <table className="table align-middle table-row-dashed fs-6 gy-3">
                <thead>
                  <tr className="text-muted fw-bold fs-7 text-uppercase gs-0">
                    <th>Referred Person</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Reward</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((referral) => (
                    <tr key={referral.id}>
                      <td>{referral.referred_name}</td>
                      <td>{new Date(referral.referred_at).toLocaleDateString()}</td>
                      <td>
                        <span className={`badge badge-light-${
                          referral.status === 'converted' ? 'success' :
                          referral.status === 'qualified' ? 'info' :
                          referral.status === 'contacted' ? 'warning' :
                          'secondary'
                        }`}>
                          {referral.status}
                        </span>
                      </td>
                      <td>
                        {referral.reward_amount ? (
                          <span className="text-success fw-bold">
                            ${referral.reward_amount}
                          </span>
                        ) : (
                          <span className="text-muted">Pending</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-10">
              <i className="ki-duotone ki-people fs-5x text-muted mb-4">
                <span className="path1"></span>
                <span className="path2"></span>
                <span className="path3"></span>
                <span className="path4"></span>
                <span className="path5"></span>
              </i>
              <h4 className="text-muted">No referrals yet</h4>
              <p className="text-muted">Share your referral code to start earning rewards!</p>
            </div>
          )}
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="modal fade show d-block" tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Customize Your Referral Message</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowShareModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-4">
                  <label className="form-label">Personal Message (Optional)</label>
                  <textarea
                    className="form-control"
                    rows={4}
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Add a personal touch to your referral..."
                  />
                </div>
                <div className="mb-4">
                  <label className="form-label">Your Referral Link</label>
                  <div className="input-group">
                    <input 
                      type="text" 
                      className="form-control" 
                      value={getReferralLink()}
                      readOnly
                    />
                    <button 
                      className="btn btn-primary"
                      onClick={copyToClipboard}
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div className="d-flex gap-2 justify-content-center">
                  <button 
                    className="btn btn-light-primary"
                    onClick={shareViaEmail}
                  >
                    <i className="ki-duotone ki-sms fs-4 me-2"></i>
                    Email
                  </button>
                  <button 
                    className="btn btn-light-info"
                    onClick={shareViaSMS}
                  >
                    <i className="ki-duotone ki-message-text fs-4 me-2"></i>
                    SMS
                  </button>
                  <button 
                    className="btn btn-light-success"
                    onClick={() => {
                      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(customMessage + ' ' + getReferralLink())}`)
                    }}
                  >
                    <i className="ki-duotone ki-whatsapp fs-4 me-2"></i>
                    WhatsApp
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </div>
      )}
    </div>
  )
}

export default ReferralDashboard