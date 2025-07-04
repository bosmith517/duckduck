

import React from 'react'
import {Link} from 'react-router-dom'
import {KTIcon} from '../../../helpers'

const HelpDrawer = () => {
  return (
    <div
      id='kt_help'
      className='bg-body'
      data-kt-drawer='true'
      data-kt-drawer-name='help'
      data-kt-drawer-activate='true'
      data-kt-drawer-overlay='true'
      data-kt-drawer-width="{default:'350px', 'md': '525px'}"
      data-kt-drawer-direction='end'
      data-kt-drawer-toggle='#kt_help_toggle'
      data-kt-drawer-close='#kt_help_close'
    >
      {/* begin::Card */}
      <div className='card shadow-none rounded-0 w-100'>
        {/* begin::Header */}
        <div className='card-header' id='kt_help_header'>
          <h5 className='card-title fw-semibold text-gray-600'>Help & Support</h5>

          <div className='card-toolbar'>
            <button
              type='button'
              className='btn btn-sm btn-icon explore-btn-dismiss me-n5'
              id='kt_help_close'
            >
              <KTIcon iconName='cross' className='fs-2' />
            </button>
          </div>
        </div>
        {/* end::Header */}

        {/* begin::Body */}
        <div className='card-body' id='kt_help_body'>
          {/* begin::Content */}
          <div
            id='kt_help_scroll'
            className='hover-scroll-overlay-y'
            data-kt-scroll='true'
            data-kt-scroll-height='auto'
            data-kt-scroll-wrappers='#kt_help_body'
            data-kt-scroll-dependencies='#kt_help_header'
            data-kt-scroll-offset='5px'
          >
            {/* begin::Support */}
            <div className='rounded border border-dashed border-gray-300 p-6 p-lg-8 mb-10'>
              {/* begin::Heading */}
              <h2 className='fw-bold mb-5'>
                TradeWorks Pro Support
              </h2>
              {/* end::Heading */}

              {/* begin::Description */}
              <div className='fs-5 fw-semibold mb-5'>
                <span className='text-gray-500'>
                  Get help with your TradeWorks Pro account, features, and technical issues.
                </span>
              </div>
              {/* end::Description */}

              {/* begin::Link */}
              <a
                href='mailto:support@tradeworkspro.com'
                className='btn btn-lg btn-primary w-100'
              >
                Contact Support
              </a>
              {/* end::Link */}
            </div>
            {/* end::Support */}

            {/* begin::Link */}
            <div className='d-flex align-items-center mb-7'>
              {/* begin::Icon */}
              <div className='d-flex flex-center w-50px h-50px w-lg-75px h-lg-75px flex-shrink-0 rounded bg-light-warning'>
                <KTIcon iconName='book-open' className='text-warning fs-2x text-lg-3x' />
              </div>
              {/* end::Icon */}
              {/* begin::Info */}
              <div className='d-flex flex-stack flex-grow-1 ms-4 ms-lg-6'>
                {/* begin::Wrapper */}
                <div className='d-flex flex-column me-2 me-lg-5'>
                  {/* begin::Title */}
                  <a
                    href='#'
                    className='text-gray-900 text-hover-primary fw-bold fs-6 fs-lg-4 mb-1'
                  >
                    User Guide
                  </a>
                  {/* end::Title */}
                  {/* begin::Description */}
                  <div className='text-muted fw-semibold fs-7 fs-lg-6'>
                    Learn how to use TradeWorks Pro features effectively.
                  </div>
                  {/* end::Description */}
                </div>
                {/* end::Wrapper */}
                <KTIcon iconName='arrow-right' className='text-gray-500 fs-2' />
              </div>
              {/* end::Info */}
            </div>
            {/* end::Link */}
            
            {/* begin::Link */}
            <div className='d-flex align-items-center mb-7'>
              {/* begin::Icon */}
              <div className='d-flex flex-center w-50px h-50px w-lg-75px h-lg-75px flex-shrink-0 rounded bg-light-primary'>
                <KTIcon iconName='message-text-2' className='text-primary fs-2x text-lg-3x' />
              </div>
              {/* end::Icon */}
              {/* begin::Info */}
              <div className='d-flex flex-stack flex-grow-1 ms-4 ms-lg-6'>
                {/* begin::Wrapper */}
                <div className='d-flex flex-column me-2 me-lg-5'>
                  {/* begin::Title */}
                  <a
                    href='#'
                    className='text-gray-900 text-hover-primary fw-bold fs-6 fs-lg-4 mb-1'
                  >
                    Live Chat
                  </a>
                  {/* end::Title */}
                  {/* begin::Description */}
                  <div className='text-muted fw-semibold fs-7 fs-lg-6'>
                    Chat with our support team for immediate assistance.
                  </div>
                  {/* end::Description */}
                </div>
                {/* end::Wrapper */}
                <KTIcon iconName='arrow-right' className='text-gray-500 fs-2' />
              </div>
              {/* end::Info */}
            </div>
            {/* end::Link */}

            {/* begin::Link */}
            <div className='d-flex align-items-center mb-7'>
              {/* begin::Icon */}
              <div className='d-flex flex-center w-50px h-50px w-lg-75px h-lg-75px flex-shrink-0 rounded bg-light-info'>
                <KTIcon iconName='questionnaire-tablet' className='text-info fs-2x text-lg-3x' />
              </div>
              {/* end::Icon */}
              {/* begin::Info */}
              <div className='d-flex flex-stack flex-grow-1 ms-4 ms-lg-6'>
                {/* begin::Wrapper */}
                <div className='d-flex flex-column me-2 me-lg-5'>
                  {/* begin::Title */}
                  <a
                    href='#'
                    className='text-gray-900 text-hover-primary fw-bold fs-6 fs-lg-4 mb-1'
                  >
                    Feature Requests
                  </a>
                  {/* end::Title */}
                  {/* begin::Description */}
                  <div className='text-muted fw-semibold fs-7 fs-lg-6'>
                    Suggest new features or improvements to TradeWorks Pro.
                  </div>
                  {/* end::Description */}
                </div>
                {/* end::Wrapper */}
                <KTIcon iconName='arrow-right' className='text-gray-500 fs-2' />
              </div>
              {/* end::Info */}
            </div>
            {/* end::Link */}

            {/* begin::Link */}
            <div className='d-flex align-items-center mb-7'>
              {/* begin::Icon */}
              <div className='d-flex flex-center w-50px h-50px w-lg-75px h-lg-75px flex-shrink-0 rounded bg-light-success'>
                <KTIcon iconName='rocket' className='text-success fs-2x text-lg-3x' />
              </div>
              {/* end::Icon */}
              {/* begin::Info */}
              <div className='d-flex flex-stack flex-grow-1 ms-4 ms-lg-6'>
                {/* begin::Wrapper */}
                <div className='d-flex flex-column me-2 me-lg-5'>
                  {/* begin::Title */}
                  <a
                    href='#'
                    className='text-gray-900 text-hover-primary fw-bold fs-6 fs-lg-4 mb-1'
                  >
                    What's New
                  </a>
                  {/* end::Title */}
                  {/* begin::Description */}
                  <div className='text-muted fw-semibold fs-7 fs-lg-6'>
                    Latest features and updates to TradeWorks Pro.
                  </div>
                  {/* end::Description */}
                </div>
                {/* end::Wrapper */}
                <KTIcon iconName='arrow-right' className='text-gray-500 fs-2' />
              </div>
              {/* end::Info */}
            </div>
            {/* end::Link */}
          </div>
          {/* end::Content */}
        </div>
        {/* end::Body */}
      </div>
      {/* end::Card */}
    </div>
  )
}

export {HelpDrawer}
