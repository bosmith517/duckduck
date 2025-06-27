import React from 'react'
import {useIntl} from 'react-intl'
import {KTIcon} from '../../../helpers'
import {AsideMenuItemWithSub} from './AsideMenuItemWithSub'
import {AsideMenuItem} from './AsideMenuItem'

export function AsideMenuMain() {
  const intl = useIntl()

  return (
    <>
      <AsideMenuItem
        to='/dashboard'
        icon='element-11'
        title='Dashboard'
        fontIcon='bi-app-indicator'
      />
      
      <div className='menu-item'>
        <div className='menu-content pt-8 pb-2'>
          <span className='menu-section text-muted text-uppercase fs-8 ls-1'>Project Management</span>
        </div>
      </div>
      
      <AsideMenuItem
        to='/jobs'
        icon='briefcase'
        title='Jobs'
        fontIcon='bi-briefcase'
      />
      
      <AsideMenuItem
        to='/accounts'
        icon='office-bag'
        title='Accounts'
        fontIcon='bi-building'
      />
      
      <AsideMenuItem
        to='/clients'
        icon='profile-circle'
        title='Clients'
        fontIcon='bi-person'
      />
      
      <AsideMenuItem
        to='/contacts'
        icon='address-book'
        title='Contacts'
        fontIcon='bi-person-lines-fill'
      />
      
      <AsideMenuItem
        to='/estimates'
        icon='file-text'
        title='Estimates'
        fontIcon='bi-file-text'
      />
      
      <AsideMenuItem
        to='/invoices'
        icon='bill'
        title='Invoices'
        fontIcon='bi-receipt'
      />
      
      <div className='menu-item'>
        <div className='menu-content pt-8 pb-2'>
          <span className='menu-section text-muted text-uppercase fs-8 ls-1'>Communications</span>
        </div>
      </div>
      
      <AsideMenuItemWithSub to='/communications' title='Communications' icon='message-text-2' fontIcon='bi-chat-dots'>
        <AsideMenuItem to='/communications/call-center' title='Call Center' hasBullet={true} />
        <AsideMenuItem to='/communications/voicemail' title='Voicemail' hasBullet={true} />
        <AsideMenuItem to='/communications/sms' title='SMS Messages' hasBullet={true} />
        <AsideMenuItem to='/communications/video' title='Video Meetings' hasBullet={true} />
      </AsideMenuItemWithSub>
      
      <div className='menu-item'>
        <div className='menu-content pt-8 pb-2'>
          <span className='menu-section text-muted text-uppercase fs-8 ls-1'>Operations</span>
        </div>
      </div>
      
      <AsideMenuItem
        to='/inventory'
        icon='package'
        title='Inventory'
        fontIcon='bi-box'
      />
      
      <AsideMenuItem
        to='/schedule'
        icon='calendar-8'
        title='Schedule'
        fontIcon='bi-calendar3'
      />
      
      <AsideMenuItem
        to='/team'
        icon='people'
        title='Team'
        fontIcon='bi-people'
      />
      
      <div className='menu-item'>
        <div className='menu-content pt-8 pb-2'>
          <span className='menu-section text-muted text-uppercase fs-8 ls-1'>Analytics</span>
        </div>
      </div>
      
      <AsideMenuItem
        to='/reports'
        icon='chart-simple'
        title='Reports'
        fontIcon='bi-graph-up'
      />
      
      <div className='menu-item'>
        <div className='menu-content pt-8 pb-2'>
          <span className='menu-section text-muted text-uppercase fs-8 ls-1'>Account</span>
        </div>
      </div>
      
      <AsideMenuItemWithSub to='/profile' title='Profile' icon='profile-circle' fontIcon='bi-person'>
        <AsideMenuItem to='/profile/overview' title='Overview' hasBullet={true} />
        <AsideMenuItem to='/profile/projects' title='Projects' hasBullet={true} />
        <AsideMenuItem to='/profile/campaigns' title='Campaigns' hasBullet={true} />
        <AsideMenuItem to='/profile/documents' title='Documents' hasBullet={true} />
        <AsideMenuItem to='/profile/connections' title='Connections' hasBullet={true} />
      </AsideMenuItemWithSub>
      
      <AsideMenuItem
        to='/settings'
        icon='setting-2'
        title='Settings'
        fontIcon='bi-gear'
      />
    </>
  )
}
