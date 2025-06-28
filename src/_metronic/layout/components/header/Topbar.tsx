import {FC} from 'react'
import {useNavigate} from 'react-router-dom'
import clsx from 'clsx'
import {KTIcon, toAbsoluteUrl} from '../../../helpers'
import {
  HeaderNotificationsMenu,
  HeaderUserMenu,
  QuickLinks,
  Search,
  ThemeModeSwitcher,
} from '../../../partials'
import { useSoftphoneContext } from '../../../../app/contexts/SoftphoneContext'

const toolbarButtonMarginClass = 'ms-1 ms-lg-3',
  toolbarButtonHeightClass = 'btn-active-primary btn-custom w-30px h-30px w-md-40px h-md-40px bg-light-primary',
  toolbarUserAvatarHeightClass = 'symbol-30px symbol-md-40px',
  toolbarButtonIconSizeClass = 'fs-1 text-primary'

const Topbar: FC = () => {
  const navigate = useNavigate()
  const { showDialer } = useSoftphoneContext()
  
  return (
    <div className='d-flex align-items-stretch flex-shrink-0'>
      <div className='topbar d-flex align-items-stretch flex-shrink-0'>
        {/* Search */}
        <div className={clsx('d-flex align-items-stretch', toolbarButtonMarginClass)}>
          <Search />
        </div>
        {/* Activities */}
        <div className={clsx('d-flex align-items-center ', toolbarButtonMarginClass)}>
          {/* begin::Reports button */}
          <div
            className={clsx(
              'btn btn-icon btn-active-light-primary btn-custom',
              toolbarButtonHeightClass
            )}
            onClick={() => navigate('/reports')}
            title='View Reports'
            style={{ cursor: 'pointer' }}
          >
            <KTIcon iconName='chart-simple' className={toolbarButtonIconSizeClass} />
          </div>
          {/* end::Reports button */}
        </div>

        {/* NOTIFICATIONS */}
        <div className={clsx('d-flex align-items-center', toolbarButtonMarginClass)}>
          {/* begin::Menu- wrapper */}
          <div
            className={clsx(
              'btn btn-icon btn-active-light-primary btn-custom',
              toolbarButtonHeightClass
            )}
            data-kt-menu-trigger='click'
            data-kt-menu-attach='parent'
            data-kt-menu-placement='bottom-end'
            data-kt-menu-flip='bottom'
          >
            <KTIcon iconName='element-plus' className={toolbarButtonIconSizeClass} />
          </div>
          <HeaderNotificationsMenu />
          {/* end::Menu wrapper */}
        </div>

        {/* CHAT */}
        <div className={clsx('d-flex align-items-center', toolbarButtonMarginClass)}>
          {/* begin::Chat button */}
          <div
            className={clsx(
              'btn btn-icon btn-active-light-primary btn-custom position-relative',
              toolbarButtonHeightClass
            )}
            onClick={() => navigate('/team')}
            title='Team Chat'
            style={{ cursor: 'pointer' }}
          >
            <KTIcon iconName='message-text-2' className={toolbarButtonIconSizeClass} />

            <span className='bullet bullet-dot bg-success h-6px w-6px position-absolute translate-middle top-0 start-50 animation-blink'></span>
          </div>
          {/* end::Chat button */}
        </div>

        {/* SOFTPHONE */}
        <div className={clsx('d-flex align-items-center', toolbarButtonMarginClass)}>
          {/* begin::Softphone button */}
          <div
            className={clsx(
              'btn btn-icon btn-active-light-primary btn-custom',
              toolbarButtonHeightClass
            )}
            onClick={showDialer}
            title='Open Softphone'
            style={{ cursor: 'pointer' }}
          >
            <KTIcon iconName='phone' className={toolbarButtonIconSizeClass} />
          </div>
          {/* end::Softphone button */}
        </div>

        {/* Quick links */}
        <div className={clsx('d-flex align-items-center', toolbarButtonMarginClass)}>
          {/* begin::Menu wrapper */}
          <div
            className={clsx(
              'btn btn-icon btn-active-light-primary btn-custom',
              toolbarButtonHeightClass
            )}
            data-kt-menu-trigger='click'
            data-kt-menu-attach='parent'
            data-kt-menu-placement='bottom-end'
            data-kt-menu-flip='bottom'
          >
            <KTIcon iconName='element-11' className={toolbarButtonIconSizeClass} />
          </div>
          <QuickLinks />
          {/* end::Menu wrapper */}
        </div>

        {/* begin::Theme mode */}
        <div className={clsx('d-flex align-items-center', toolbarButtonMarginClass)}>
          <ThemeModeSwitcher toggleBtnClass={toolbarButtonHeightClass} />
        </div>
        {/* end::Theme mode */}

        {/* begin::User */}
        <div
          className={clsx('d-flex align-items-center', toolbarButtonMarginClass)}
          id='kt_header_user_menu_toggle'
          style={{position: 'relative', zIndex: 1052}}
        >
          {/* begin::Toggle */}
          <div
            className={clsx('cursor-pointer symbol', toolbarUserAvatarHeightClass)}
            data-kt-menu-trigger='click'
            data-kt-menu-attach='parent'
            data-kt-menu-placement='bottom-end'
            data-kt-menu-flip='bottom'
            style={{
              border: '2px solid #ffffff',
              borderRadius: '50%',
              backgroundColor: '#495057',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <img
              className='h-30px w-30px rounded'
              src={toAbsoluteUrl('media/avatars/300-2.jpg')}
              alt='User Avatar'
              style={{borderRadius: '50%'}}
            />
          </div>
          <HeaderUserMenu />
          {/* end::Toggle */}
        </div>
        {/* end::User */}
      </div>
    </div>
  )
}

export {Topbar}
