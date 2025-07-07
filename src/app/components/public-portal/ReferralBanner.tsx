import React from 'react'

interface ReferralBannerProps {
  referralCode: string
}

const ReferralBanner: React.FC<ReferralBannerProps> = ({ referralCode }) => {
  return (
    <div className="bg-success text-white py-3">
      <div className="container">
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center">
            <i className="ki-duotone ki-gift fs-2x me-3">
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
            <div>
              <h6 className="mb-0">You were referred by a valued customer!</h6>
              <p className="mb-0 fs-7 opacity-75">
                Your referral code <strong>{referralCode}</strong> has been applied
              </p>
            </div>
          </div>
          <div className="text-end">
            <p className="mb-0 fs-7">Special offers may apply</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReferralBanner