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
        to='/app/communications/video'
        icon='video'
        title='Modern Video Meetings'
        fontIcon='bi-camera-video'
      />
      
      <AsideMenuItem
        to='/app/team'
        icon='message-text'
        title='Team Chat'
        fontIcon='bi-chat-dots'
      />
      
      <AsideMenuItem
        to='/app/communications/numbers'
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
      
      <AsideMenuItemWithSub to='/app/jobs' title='Jobs & Projects' icon='briefcase' fontIcon='bi-briefcase'>
        <AsideMenuItem to='/app/jobs' title='All Jobs' hasBullet={true} />
        <AsideMenuItem to='/app/jobs/costing' title='Real-Time Job Costing' hasBullet={true} />
        <AsideMenuItemWithSub to='/app/inspections' title='Inspections' hasBullet={true}>
          <AsideMenuItem to='/app/inspections' title='All Inspections' hasBullet={true} />
          <AsideMenuItem to='/app/inspections/schedule' title='Schedule Inspection' hasBullet={true} />
          <AsideMenuItem to='/app/inspections/permits' title='Permitting Process' hasBullet={true} />
          <AsideMenuItem to='/app/inspections/history' title='Inspection History' hasBullet={true} />
        </AsideMenuItemWithSub>
        <AsideMenuItem to='/app/milestones' title='Payment Milestones' hasBullet={true} />
        <AsideMenuItem to='/app/team-materials' title='Team & Materials' hasBullet={true} />
        <AsideMenuItem to='/app/reports' title='Job Analytics' hasBullet={true} />
        <AsideMenuItem to='/app/estimates/templates' title='Job Templates' hasBullet={true} />
      </AsideMenuItemWithSub>
      
      <AsideMenuItemWithSub to='/app/customers' title='Customers' icon='profile-circle' fontIcon='bi-people'>
        <AsideMenuItem to='/app/leads' title='Lead to Job Workflow' hasBullet={true} />
        <AsideMenuItem to='/app/customers/accounts' title='Accounts' hasBullet={true} />
        <AsideMenuItem to='/app/customers/contacts' title='Contacts' hasBullet={true} />
        <AsideMenuItem to='/app/homeowner-portal' title='Homeowner Portal' hasBullet={true} />
        <AsideMenuItem to='/app/customers/portal-preview' title='Portal Preview' hasBullet={true} />
        <AsideMenuItem to='/app/reports/financial' title='Customer Analytics' hasBullet={true} />
        <AsideMenuItem to='/app/communications' title='Communications' hasBullet={true} />
      </AsideMenuItemWithSub>
      
      <AsideMenuItemWithSub to='/app/schedule' title='Scheduling & Dispatch' icon='calendar-8' fontIcon='bi-calendar3'>
        <AsideMenuItem to='/app/schedule' title='Schedule Overview' hasBullet={true} />
        <AsideMenuItem to='/app/mobile/tracking' title='Mobile Tracking' hasBullet={true} />
        <AsideMenuItem to='/app/tracking/overview' title='Fleet Tracking' hasBullet={true} />
        <AsideMenuItem to='/app/tracking/routes' title='Route Optimization' hasBullet={true} />
        <AsideMenuItem to='/app/tracking/live' title='Live Monitoring' hasBullet={true} />
        <AsideMenuItem to='/app/tracking/dispatch' title='Technician Dispatch' hasBullet={true} />
      </AsideMenuItemWithSub>
      
      <AsideMenuItemWithSub to='/app/services' title='Services & Inventory' icon='package' fontIcon='bi-box'>
        <AsideMenuItem to='/app/services/inventory' title='Inventory' hasBullet={true} />
        <AsideMenuItem to='/app/services/catalog' title='Service Catalog' hasBullet={true} />
        <AsideMenuItem to='/app/vendors' title='Vendor Management' hasBullet={true} />
        <AsideMenuItem to='/app/subcontractors' title='Subcontractor Network' hasBullet={true} />
        <AsideMenuItem to='/app/mobile/tracking' title='Equipment Tracking' hasBullet={true} />
        <AsideMenuItem to='/app/reports' title='Service Analytics' hasBullet={true} />
      </AsideMenuItemWithSub>

      {/* REVENUE ENGINE */}
      <div className='menu-item'>
        <div className='menu-content pt-8 pb-2'>
          <span className='menu-section text-muted text-uppercase fs-8 ls-1'>Revenue Engine</span>
        </div>
      </div>
      
      <AsideMenuItemWithSub to='/app/billing' title='Billing & Payments' icon='bill' fontIcon='bi-credit-card'>
        <AsideMenuItem to='/app/billing/invoices' title='Invoices' hasBullet={true} />
        <AsideMenuItem to='/app/estimates' title='Estimates & Quotes' hasBullet={true} />
        <AsideMenuItem to='/app/estimates/templates' title='Template-Driven Estimates' hasBullet={true} />
        <AsideMenuItem to='/app/billing' title='Payment Processing' hasBullet={true} />
        <AsideMenuItem to='/app/reports/financial' title='Financial Reports' hasBullet={true} />
        <AsideMenuItem to='/app/billing/customer-portal' title='Customer Portal' hasBullet={true} />
      </AsideMenuItemWithSub>
      
      <AsideMenuItemWithSub to='/app/reports' title='Reports & Analytics' icon='chart-simple' fontIcon='bi-graph-up'>
        <AsideMenuItem to='/app/reports' title='All Reports' hasBullet={true} />
        <AsideMenuItem to='/app/reports/financial' title='Financial Reports' hasBullet={true} />
      </AsideMenuItemWithSub>

      {/* COMMUNICATION COMMAND */}
      <div className='menu-item'>
        <div className='menu-content pt-8 pb-2'>
          <span className='menu-section text-muted text-uppercase fs-8 ls-1'>Communication Command</span>
        </div>
      </div>
      
      <AsideMenuItemWithSub to='/app/communications' title='Communications Hub' icon='message-text-2' fontIcon='bi-chat-dots'>
        <AsideMenuItem to='/app/communications' title='AI Features & Analytics' hasBullet={true} />
        <AsideMenuItem to='/app/communications/call-center' title='Call Center' hasBullet={true} />
        <AsideMenuItem to='/app/communications/voicemail' title='Voicemail Center' hasBullet={true} />
        <AsideMenuItem to='/app/communications/sms' title='SMS Messages' hasBullet={true} />
        <AsideMenuItem to='/app/communications/email' title='Email System' hasBullet={true} />
        <AsideMenuItem to='/app/communications/team-chat' title='Team Chat' hasBullet={true} />
        <AsideMenuItem to='/app/communications/video' title='Video Meetings' hasBullet={true} />
        <AsideMenuItem to='/app/communications/numbers' title='Phone Numbers' hasBullet={true} />
        <AsideMenuItem to='/app/communications/users' title='User Provisioning' hasBullet={true} />
        <AsideMenuItem to='/app/communications/analytics' title='Analytics' hasBullet={true} />
      </AsideMenuItemWithSub>

      {/* TEAM EXCELLENCE */}
      <div className='menu-item'>
        <div className='menu-content pt-8 pb-2'>
          <span className='menu-section text-muted text-uppercase fs-8 ls-1'>Team Excellence</span>
        </div>
      </div>
      
      <AsideMenuItemWithSub to='/app/team' title='Team & Resources' icon='people' fontIcon='bi-people'>
        <AsideMenuItem to='/app/team/members' title='Team Members' hasBullet={true} />
        <AsideMenuItem to='/app/team/profiles' title='Technician Profiles' hasBullet={true} />
        <AsideMenuItem to='/app/team-materials' title='Team & Materials Hub' hasBullet={true} />
        <AsideMenuItem to='/app/team/users' title='User Management' hasBullet={true} />
        <AsideMenuItem to='/app/team/performance' title='Performance' hasBullet={true} />
        <AsideMenuItem to='/app/team/training' title='Training' hasBullet={true} />
        <AsideMenuItem to='/app/team/analytics' title='Team Analytics' hasBullet={true} />
      </AsideMenuItemWithSub>

      {/* SETTINGS & CONFIGURATION */}
      <div className='menu-item'>
        <div className='menu-content pt-8 pb-2'>
          <span className='menu-section text-muted text-uppercase fs-8 ls-1'>Configuration</span>
        </div>
      </div>
      
      <AsideMenuItemWithSub to='/app/settings' title='Settings' icon='setting-2' fontIcon='bi-gear'>
        <AsideMenuItem to='/app/settings/company' title='Company Settings' hasBullet={true} />
        <AsideMenuItem to='/app/settings/branding' title='White-Label Branding' hasBullet={true} />
        <AsideMenuItem to='/app/settings/billing' title='Billing Config' hasBullet={true} />
        <AsideMenuItem to='/app/settings/communications' title='Communication Settings' hasBullet={true} />
        <AsideMenuItem to='/app/settings/users' title='User & Permissions' hasBullet={true} />
        <AsideMenuItem to='/app/settings/notifications' title='Notifications' hasBullet={true} />
        <AsideMenuItem to='/app/settings/workflow-automation' title='Workflow Automation' hasBullet={true} />
        <AsideMenuItem to='/app/settings/security' title='Security' hasBullet={true} />
        <AsideMenuItem to='/app/settings/integrations' title='Integrations' hasBullet={true} />
      </AsideMenuItemWithSub>
      
      <AsideMenuItemWithSub to='/app/profile' title='My Profile' icon='profile-circle' fontIcon='bi-person'>
        <AsideMenuItem to='/app/profile/account' title='Account Settings' hasBullet={true} />
        <AsideMenuItem to='/app/profile/company' title='Company Information' hasBullet={true} />
        <AsideMenuItem to='/app/profile/notifications' title='Notifications' hasBullet={true} />
        <AsideMenuItem to='/app/profile/security' title='Security' hasBullet={true} />
        <AsideMenuItem to='/app/profile/documents' title='Documents' hasBullet={true} />
      </AsideMenuItemWithSub>
    </>
  )
}
