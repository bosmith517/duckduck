import React from 'react'
import {useIntl} from 'react-intl'
import {KTIcon} from '../../../helpers'
import {AsideMenuItemWithSub} from './AsideMenuItemWithSub'
import {AsideMenuItem} from './AsideMenuItem'

export function AsideMenuMain() {
  const intl = useIntl()

  return (
    <>
      {/* COMMAND CENTER */}
      <AsideMenuItem
        to='/dashboard'
        icon='element-11'
        title='Command Center'
        fontIcon='bi-speedometer2'
      />
      
      {/* NEW FEATURES SHOWCASE */}
      <div className='menu-item'>
        <div className='menu-content pt-4 pb-2'>
          <span className='menu-section text-primary text-uppercase fs-8 ls-1 fw-bold'>✨ New Features</span>
        </div>
      </div>
      
      <AsideMenuItem
        to='/communications/video'
        icon='video'
        title='Modern Video Meetings'
        fontIcon='bi-camera-video'
      />
      
      <AsideMenuItem
        to='/team'
        icon='message-text'
        title='Team Chat'
        fontIcon='bi-chat-dots'
      />
      
      <AsideMenuItem
        to='/communications/numbers'
        icon='phone'
        title='Phone Management'
        fontIcon='bi-telephone'
      />
      
      {/* BUSINESS OPERATIONS */}
      <div className='menu-item'>
        <div className='menu-content pt-8 pb-2'>
          <span className='menu-section text-muted text-uppercase fs-8 ls-1'>Business Operations</span>
        </div>
      </div>
      
      <AsideMenuItemWithSub to='/jobs' title='Jobs & Projects' icon='briefcase' fontIcon='bi-briefcase'>
        <AsideMenuItem to='/jobs' title='All Jobs' hasBullet={true} />
        <AsideMenuItem to='/jobs/costing' title='Real-Time Job Costing' hasBullet={true} />
        <AsideMenuItemWithSub to='/inspections' title='Inspections' hasBullet={true}>
          <AsideMenuItem to='/inspections' title='All Inspections' hasBullet={true} />
          <AsideMenuItem to='/inspections/schedule' title='Schedule Inspection' hasBullet={true} />
          <AsideMenuItem to='/inspections/permits' title='Permitting Process' hasBullet={true} />
          <AsideMenuItem to='/inspections/history' title='Inspection History' hasBullet={true} />
        </AsideMenuItemWithSub>
        <AsideMenuItem to='/milestones' title='Payment Milestones' hasBullet={true} />
        <AsideMenuItem to='/team-materials' title='Team & Materials' hasBullet={true} />
        <AsideMenuItem to='/reports' title='Job Analytics' hasBullet={true} />
        <AsideMenuItem to='/estimates/templates' title='Job Templates' hasBullet={true} />
      </AsideMenuItemWithSub>
      
      <AsideMenuItemWithSub to='/customers' title='Customers' icon='profile-circle' fontIcon='bi-people'>
        <AsideMenuItem to='/leads' title='Lead to Job Workflow' hasBullet={true} />
        <AsideMenuItem to='/customers/accounts' title='Accounts' hasBullet={true} />
        <AsideMenuItem to='/customers/contacts' title='Contacts' hasBullet={true} />
        <AsideMenuItem to='/homeowner-portal' title='Homeowner Portal' hasBullet={true} />
        <AsideMenuItem to='/customers/portal-preview' title='Portal Preview' hasBullet={true} />
        <AsideMenuItem to='/reports/financial' title='Customer Analytics' hasBullet={true} />
        <AsideMenuItem to='/communications' title='Communications' hasBullet={true} />
      </AsideMenuItemWithSub>
      
      <AsideMenuItemWithSub to='/schedule' title='Scheduling & Dispatch' icon='calendar-8' fontIcon='bi-calendar3'>
        <AsideMenuItem to='/schedule' title='Schedule Overview' hasBullet={true} />
        <AsideMenuItem to='/bookings' title='Online Booking' hasBullet={true} />
        <AsideMenuItem to='/mobile/tracking' title='Mobile Tracking' hasBullet={true} />
        <AsideMenuItem to='/tracking/overview' title='Fleet Tracking' hasBullet={true} />
        <AsideMenuItem to='/tracking/routes' title='Route Optimization' hasBullet={true} />
        <AsideMenuItem to='/tracking/live' title='Live Monitoring' hasBullet={true} />
        <AsideMenuItem to='/tracking/dispatch' title='Technician Dispatch' hasBullet={true} />
      </AsideMenuItemWithSub>
      
      <AsideMenuItemWithSub to='/services' title='Services & Inventory' icon='package' fontIcon='bi-box'>
        <AsideMenuItem to='/services/inventory' title='Inventory' hasBullet={true} />
        <AsideMenuItem to='/services/catalog' title='Service Catalog' hasBullet={true} />
        <AsideMenuItem to='/vendors' title='Vendor Management' hasBullet={true} />
        <AsideMenuItem to='/subcontractors' title='Subcontractor Network' hasBullet={true} />
        <AsideMenuItem to='/mobile/tracking' title='Equipment Tracking' hasBullet={true} />
        <AsideMenuItem to='/reports' title='Service Analytics' hasBullet={true} />
      </AsideMenuItemWithSub>

      {/* REVENUE ENGINE */}
      <div className='menu-item'>
        <div className='menu-content pt-8 pb-2'>
          <span className='menu-section text-muted text-uppercase fs-8 ls-1'>Revenue Engine</span>
        </div>
      </div>
      
      <AsideMenuItemWithSub to='/billing' title='Billing & Payments' icon='bill' fontIcon='bi-credit-card'>
        <AsideMenuItem to='/billing/invoices' title='Invoices' hasBullet={true} />
        <AsideMenuItem to='/estimates' title='Estimates & Quotes' hasBullet={true} />
        <AsideMenuItem to='/estimates/templates' title='Template-Driven Estimates' hasBullet={true} />
        <AsideMenuItem to='/billing' title='Payment Processing' hasBullet={true} />
        <AsideMenuItem to='/reports/financial' title='Financial Reports' hasBullet={true} />
        <AsideMenuItem to='/billing/customer-portal' title='Customer Portal' hasBullet={true} />
      </AsideMenuItemWithSub>
      
      <AsideMenuItemWithSub to='/reports' title='Reports & Analytics' icon='chart-simple' fontIcon='bi-graph-up'>
        <AsideMenuItem to='/reports' title='All Reports' hasBullet={true} />
        <AsideMenuItem to='/reports/financial' title='Financial Reports' hasBullet={true} />
      </AsideMenuItemWithSub>

      {/* COMMUNICATION COMMAND */}
      <div className='menu-item'>
        <div className='menu-content pt-8 pb-2'>
          <span className='menu-section text-muted text-uppercase fs-8 ls-1'>Communication Command</span>
        </div>
      </div>
      
      <AsideMenuItemWithSub to='/communications' title='Communications Hub' icon='message-text-2' fontIcon='bi-chat-dots'>
        <AsideMenuItem to='/communications' title='AI Features & Analytics' hasBullet={true} />
        <AsideMenuItem to='/communications/call-center' title='Call Center' hasBullet={true} />
        <AsideMenuItem to='/communications/voicemail' title='Voicemail Center' hasBullet={true} />
        <AsideMenuItem to='/communications/sms' title='SMS Messages' hasBullet={true} />
        <AsideMenuItem to='/communications/email' title='Email System' hasBullet={true} />
        <AsideMenuItem to='/communications/team-chat' title='Team Chat' hasBullet={true} />
        <AsideMenuItem to='/communications/video' title='Video Meetings' hasBullet={true} />
        <AsideMenuItem to='/communications/numbers' title='Phone Numbers' hasBullet={true} />
        <AsideMenuItem to='/communications/users' title='User Provisioning' hasBullet={true} />
        <AsideMenuItem to='/communications/analytics' title='Analytics' hasBullet={true} />
      </AsideMenuItemWithSub>

      {/* TEAM EXCELLENCE */}
      <div className='menu-item'>
        <div className='menu-content pt-8 pb-2'>
          <span className='menu-section text-muted text-uppercase fs-8 ls-1'>Team Excellence</span>
        </div>
      </div>
      
      <AsideMenuItemWithSub to='/team' title='Team & Resources' icon='people' fontIcon='bi-people'>
        <AsideMenuItem to='/team/members' title='Team Members' hasBullet={true} />
        <AsideMenuItem to='/team/profiles' title='Technician Profiles' hasBullet={true} />
        <AsideMenuItem to='/team-materials' title='Team & Materials Hub' hasBullet={true} />
        <AsideMenuItem to='/team/users' title='User Management' hasBullet={true} />
        <AsideMenuItem to='/team/performance' title='Performance' hasBullet={true} />
        <AsideMenuItem to='/team/training' title='Training' hasBullet={true} />
        <AsideMenuItem to='/team/analytics' title='Team Analytics' hasBullet={true} />
      </AsideMenuItemWithSub>

      {/* SETTINGS & CONFIGURATION */}
      <div className='menu-item'>
        <div className='menu-content pt-8 pb-2'>
          <span className='menu-section text-muted text-uppercase fs-8 ls-1'>Configuration</span>
        </div>
      </div>
      
      <AsideMenuItemWithSub to='/settings' title='Settings' icon='setting-2' fontIcon='bi-gear'>
        <AsideMenuItem to='/settings/company' title='Company Settings' hasBullet={true} />
        <AsideMenuItem to='/settings/branding' title='White-Label Branding' hasBullet={true} />
        <AsideMenuItem to='/settings/billing' title='Billing Config' hasBullet={true} />
        <AsideMenuItem to='/settings/communications' title='Communication Settings' hasBullet={true} />
        <AsideMenuItem to='/settings/users' title='User & Permissions' hasBullet={true} />
        <AsideMenuItem to='/settings/notifications' title='Notifications' hasBullet={true} />
        <AsideMenuItem to='/settings/workflow-automation' title='Workflow Automation' hasBullet={true} />
        <AsideMenuItem to='/settings/security' title='Security' hasBullet={true} />
        <AsideMenuItem to='/settings/password-reset-logs' title='Password Reset Logs' hasBullet={true} />
        <AsideMenuItem to='/settings/integrations' title='Integrations' hasBullet={true} />
      </AsideMenuItemWithSub>
      
      <AsideMenuItemWithSub to='/profile' title='My Profile' icon='profile-circle' fontIcon='bi-person'>
        <AsideMenuItem to='/profile/account' title='Account Settings' hasBullet={true} />
        <AsideMenuItem to='/profile/company' title='Company Information' hasBullet={true} />
        <AsideMenuItem to='/profile/notifications' title='Notifications' hasBullet={true} />
        <AsideMenuItem to='/profile/security' title='Security' hasBullet={true} />
        <AsideMenuItem to='/profile/documents' title='Documents' hasBullet={true} />
      </AsideMenuItemWithSub>
    </>
  )
}
