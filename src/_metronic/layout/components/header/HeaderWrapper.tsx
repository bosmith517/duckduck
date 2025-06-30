import clsx from 'clsx'
import React from 'react'
import {Link} from 'react-router-dom'
import {KTIcon, toAbsoluteUrl} from '../../../helpers'
import {useLayout} from '../../core'
import {Header} from './Header'
import {DefaultTitle} from './page-title/DefaultTitle'
import {Topbar} from './Topbar'
import {useSupabaseAuth} from '../../../../app/modules/auth/core/SupabaseAuth'

export function HeaderWrapper() {
  const {config, classes, attributes} = useLayout()
  const {header, aside} = config
  const {signOut} = useSupabaseAuth()

  return (
    <div
      id='kt_header'
      className={clsx('header', classes.header.join(' '), 'align-items-stretch')}
      data-kt-sticky='true'
      data-kt-sticky-name='header'
      data-kt-sticky-offset="{default: '200px', lg: '300px'}"
      {...attributes.headerMenu}
    >
      <div className={clsx(classes.headerContainer.join(' '), 'd-flex align-items-center')}>
        {/* begin::Aside mobile toggle */}
        {aside.display && (
          <div className='d-flex align-items-center d-lg-none ms-n3 me-1' title='Show aside menu'>
            <div
              className='btn btn-icon btn-active-light-primary btn-custom w-30px h-30px w-md-40px h-md-40px'
              id='kt_aside_mobile_toggle'
            >
              <KTIcon iconName='abstract-14' className='fs-2x mt-1' />
            </div>
          </div>
        )}
        {/* end::Aside mobile toggle */}


        <div className='header-logo me-5 me-md-10 flex-grow-1 flex-lg-grow-0'>
          <Link to='/' className='d-flex align-items-center text-decoration-none'>
            <div className='d-flex align-items-center'>
              <div className='bg-primary rounded-circle d-flex align-items-center justify-content-center me-3' style={{width: '32px', height: '32px'}}>
                <i className='bi bi-tools text-white fs-5'></i>
              </div>
              <div className='d-flex flex-column'>
                <span className='text-dark fw-bold fs-4 lh-1'>TradeWorks</span>
                <span className='text-muted fs-7 lh-1'>Pro</span>
              </div>
            </div>
          </Link>
        </div>

        {/* begin::Wrapper */}
        <div className='d-flex align-items-stretch justify-content-between flex-lg-grow-1'>
          {/* Secondary menu removed - keeping only page title */}
          {header.left === 'page-title' && (
            <div className='d-flex align-items-center' id='kt_header_nav'>
              <DefaultTitle />
            </div>
          )}

          <div className='d-flex align-items-stretch flex-shrink-0'>
            <Topbar />
            {/* Backup logout button */}
            <button
              onClick={signOut}
              className='header-logout-btn'
              style={{
                backgroundColor: '#dc3545',
                border: '1px solid #dc3545',
                color: '#ffffff',
                padding: '8px 16px',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: '500',
                textDecoration: 'none',
                marginLeft: '10px',
                cursor: 'pointer'
              }}
            >
              Logout
            </button>
          </div>
        </div>
        {/* end::Wrapper */}
      </div>
    </div>
  )
}
