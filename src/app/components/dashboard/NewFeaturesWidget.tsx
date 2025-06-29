import React from 'react'
import { useNavigate } from 'react-router-dom'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'

export const NewFeaturesWidget: React.FC = () => {
  const navigate = useNavigate()

  const features = [
    {
      title: 'Modern Video Meetings',
      description: 'Complete meeting workflow with lobby, AI features, and post-call intelligence',
      icon: 'video',
      color: 'primary',
      route: '/communications/video',
      badge: 'New'
    },
    {
      title: 'Team Chat',
      description: 'Modern Slack-like interface with channels, reactions, and file sharing',
      icon: 'message-text',
      color: 'success',
      route: '/team',
      badge: 'Updated'
    },
    {
      title: 'Phone Management',
      description: 'Search, purchase, and manage phone numbers with team assignments',
      icon: 'phone',
      color: 'info',
      route: '/communications/numbers',
      badge: 'Enhanced'
    }
  ]

  return (
    <KTCard>
      <div className='card-header border-0 pt-5'>
        <h3 className='card-title align-items-start flex-column'>
          <span className='card-label fw-bold fs-3 mb-1'>✨ New Features Available</span>
          <span className='text-muted mt-1 fw-semibold fs-7'>Modern communication tools for your team</span>
        </h3>
      </div>
      <KTCardBody className='py-3'>
        <div className='row g-4'>
          {features.map((feature, index) => (
            <div key={index} className='col-md-4'>
              <div 
                className='card bg-light-primary cursor-pointer hover-scale'
                onClick={() => navigate(feature.route)}
                style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <div className='card-body text-center p-6'>
                  <div className='position-relative'>
                    <i className={`ki-duotone ki-${feature.icon} fs-3x text-${feature.color} mb-3`}>
                      <span className='path1'></span>
                      <span className='path2'></span>
                    </i>
                    <span className={`badge badge-${feature.color} position-absolute top-0 start-100 translate-middle`}>
                      {feature.badge}
                    </span>
                  </div>
                  <h4 className='fw-bold text-dark mb-2'>{feature.title}</h4>
                  <p className='text-muted fs-7 mb-3'>{feature.description}</p>
                  <button className={`btn btn-sm btn-${feature.color}`}>
                    Try Now →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className='separator my-5'></div>

        <div className='d-flex align-items-center bg-light-warning rounded p-4'>
          <i className='ki-duotone ki-information fs-2x text-warning me-4'>
            <span className='path1'></span>
            <span className='path2'></span>
            <span className='path3'></span>
          </i>
          <div className='flex-grow-1'>
            <h5 className='text-dark mb-1'>Modern Communication Suite</h5>
            <p className='text-muted mb-0'>
              Your platform now includes advanced video conferencing with AI transcription, 
              modern team chat, and comprehensive phone system management - all integrated 
              seamlessly with your existing workflows.
            </p>
          </div>
        </div>
      </KTCardBody>
    </KTCard>
  )
}

export default NewFeaturesWidget