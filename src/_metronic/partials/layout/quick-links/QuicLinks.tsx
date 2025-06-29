
import React, {FC} from 'react'
import {Link} from 'react-router-dom'
import {KTIcon, toAbsoluteUrl} from '../../../helpers'

const QuickLinks: FC = () => (
  <div
    className='menu menu-sub menu-sub-dropdown menu-column w-250px w-lg-325px'
    data-kt-menu='true'
  >
    <div
      className='d-flex flex-column flex-center bgi-no-repeat rounded-top px-9 py-10'
      style={{backgroundImage: `url('${toAbsoluteUrl('media/misc/menu-header-bg.jpg')}')`}}
    >
      <h3 className='text-white fw-semibold mb-3'>Quick Links</h3>

      <span className='badge bg-primary py-2 px-3'>25 pending tasks</span>
    </div>

    <div className='row g-0'>
      <div className='col-6'>
        <Link
          to='/billing'
          className='d-flex flex-column flex-center h-100 p-6 bg-hover-light border-end border-bottom'
        >
          <KTIcon iconName='euro' className='fs-3x text-primary mb-2' />
          <span className='fs-5 fw-semibold text-gray-800 mb-0'>Billing</span>
          <span className='fs-7 text-gray-500'>Invoices & Payments</span>
        </Link>
      </div>

      <div className='col-6'>
        <Link
          to='/settings'
          className='d-flex flex-column flex-center h-100 p-6 bg-hover-light border-bottom'
        >
          <KTIcon iconName='setting-3' className='fs-3x text-primary mb-2' />
          <span className='fs-5 fw-semibold text-gray-800 mb-0'>Settings</span>
          <span className='fs-7 text-gray-500'>Configuration</span>
        </Link>
      </div>

      <div className='col-6'>
        <Link to='/jobs' className='d-flex flex-column flex-center h-100 p-6 bg-hover-light border-end'>
          <KTIcon iconName='abstract-41' className='fs-3x text-primary mb-2' />
          <span className='fs-5 fw-semibold text-gray-800 mb-0'>Projects</span>
          <span className='fs-7 text-gray-500'>Active Jobs</span>
        </Link>
      </div>

      <div className='col-6'>
        <Link to='/contacts' className='d-flex flex-column flex-center h-100 p-6 bg-hover-light'>
          <KTIcon iconName='profile-user' className='fs-3x text-primary mb-2' />
          <span className='fs-5 fw-semibold text-gray-800 mb-0'>Contacts</span>
          <span className='fs-7 text-gray-500'>Customer Directory</span>
        </Link>
      </div>
    </div>

    <div className='py-2 text-center border-top'>
      <Link to='/dashboard' className='btn btn-color-gray-600 btn-active-color-primary'>
        View All <KTIcon iconName='arrow-right' className='fs-5' />
      </Link>
    </div>
  </div>
)

export {QuickLinks}
