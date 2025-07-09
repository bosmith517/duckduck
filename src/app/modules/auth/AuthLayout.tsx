import {useEffect} from 'react'
import {Outlet, Link} from 'react-router-dom'
import {toAbsoluteUrl} from '../../../_metronic/helpers'
import {useBranding} from '../../contexts/BrandingContext'

const AuthLayout = () => {
  const {branding} = useBranding()
  useEffect(() => {
    document.body.style.backgroundImage = `none`
    const root = document.getElementById('root')
    if (root) {
      root.style.height = '100%'
    }
    return () => {
      document.body.style.backgroundImage = `url(${toAbsoluteUrl('media/patterns/header-bg.jpg')})`
      if (root) {
        root.style.height = 'auto'
      }
    }
  }, [])

  return (
    <div className='d-flex flex-column flex-lg-row flex-column-fluid h-100'>
      {/* begin::Body */}
      <div className='d-flex flex-column flex-lg-row-fluid w-lg-50 p-10 order-2 order-lg-1'>
        {/* begin::Form */}
        <div className='d-flex flex-center flex-column flex-lg-row-fluid'>
          {/* begin::Wrapper */}
          <div className='w-lg-500px p-10'>
            <Outlet />
          </div>
          {/* end::Wrapper */}
        </div>
        {/* end::Form */}

        {/* begin::Footer */}
        <div className='d-flex flex-center flex-wrap px-5'>
          {/* begin::Links */}
          <div className='d-flex fw-semibold text-primary fs-base'>
            <a href='#' className='px-5' target='_blank'>
              Terms
            </a>

            <a href='#' className='px-5' target='_blank'>
              Privacy
            </a>

            <a href='#' className='px-5' target='_blank'>
              Contact Us
            </a>
          </div>
          {/* end::Links */}
        </div>
        {/* end::Footer */}
      </div>
      {/* end::Body */}

      {/* begin::Aside */}
      <div
        className='d-flex flex-lg-row-fluid w-lg-50 bgi-size-cover bgi-position-center order-1 order-lg-2'
        style={{backgroundImage: `url(${toAbsoluteUrl('media/misc/auth-bg.png')})`}}
      >
        {/* begin::Content */}
        <div className='d-flex flex-column flex-center py-15 px-5 px-md-15 w-100'>
          {/* begin::Logo */}
          <Link to='/' className='mb-12'>
            <div className='d-flex align-items-center'>
              {branding?.logo_url ? (
                <img 
                  src={branding.logo_url} 
                  alt={branding.company_name} 
                  className='me-3'
                  style={{height: '60px', width: 'auto', objectFit: 'contain'}}
                />
              ) : (
                <div className='symbol symbol-60px me-3'>
                  <span className='symbol-label' style={{backgroundColor: branding?.primary_color || '#007bff'}}>
                    <i className='ki-duotone ki-technology-4 fs-2x text-white'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                    </i>
                  </span>
                </div>
              )}
              <span className='text-white fs-2x fw-bold'>
                {branding?.white_label_enabled ? branding.company_name : 'TradeWorks Pro'}
              </span>
            </div>
          </Link>
          {/* end::Logo */}

          {/* begin::Image */}
          <div className='mx-auto w-275px w-md-50 w-xl-500px mb-10 mb-lg-20 d-flex align-items-center justify-content-center'>
            <div className='text-center'>
              <div className='symbol symbol-150px mx-auto mb-8'>
                <span className='symbol-label bg-white bg-opacity-10'>
                  <i className='ki-duotone ki-home-2 fs-4x text-white'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                  </i>
                </span>
              </div>
            </div>
          </div>
          {/* end::Image */}

          {/* begin::Title */}
          <h1 className='text-white fs-2qx fw-bolder text-center mb-7'>
            {branding?.white_label_enabled && branding?.tagline 
              ? branding.tagline 
              : 'Transform Your Customer Experience'}
          </h1>
          {/* end::Title */}

          {/* begin::Text */}
          <div className='text-white fs-base text-center'>
            {branding?.white_label_enabled ? (
              <>
                {branding.company_name} provides{' '}
                <span className='text-warning fw-bold'>
                  exceptional service
                </span>
                {' '}with powerful tools and{' '}
                <span className='text-warning fw-bold'>
                  seamless communication
                </span>
                {' '}<br /> to deliver outstanding customer experiences.
              </>
            ) : (
              <>
                TradeWorks Pro provides{' '}
                <span className='text-warning fw-bold'>
                  service companies
                </span>
                {' '}with powerful customer portals, <br /> real-time tracking, AI-powered recommendations, and{' '}
                <span className='text-warning fw-bold'>
                  seamless communication tools
                </span>
                {' '}<br /> to delight customers and grow your business.
              </>
            )}
          </div>
          {/* end::Text */}
        </div>
        {/* end::Content */}
      </div>
      {/* end::Aside */}
    </div>
  )
}

export {AuthLayout}