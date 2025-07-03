import {Navigate, Outlet, Route, Routes} from 'react-router-dom'
import {PageLink, PageTitle} from '../../../_metronic/layout/core'
import {AccountSettings} from './components/AccountSettings'
import {CompanyInformation} from './components/CompanyInformation'
import {NotificationSettings} from './components/NotificationSettings'
import {SecuritySettings} from './components/SecuritySettings'
import {Documents} from './components/Documents'
import {ProfileHeader} from './ProfileHeader'

const profileBreadCrumbs: Array<PageLink> = [
  {
    title: 'Profile',
    path: '/profile/account',
    isSeparator: false,
    isActive: false,
  },
  {
    title: '',
    path: '',
    isSeparator: true,
    isActive: false,
  },
]

const ProfilePage = () => (
  <Routes>
    <Route
      element={
        <>
          <ProfileHeader />
          <Outlet />
        </>
      }
    >
      <Route
        path='account'
        element={
          <>
            <PageTitle breadcrumbs={profileBreadCrumbs}>Account Settings</PageTitle>
            <AccountSettings />
          </>
        }
      />
      <Route
        path='company'
        element={
          <>
            <PageTitle breadcrumbs={profileBreadCrumbs}>Company Information</PageTitle>
            <CompanyInformation />
          </>
        }
      />
      <Route
        path='notifications'
        element={
          <>
            <PageTitle breadcrumbs={profileBreadCrumbs}>Notifications</PageTitle>
            <NotificationSettings />
          </>
        }
      />
      <Route
        path='security'
        element={
          <>
            <PageTitle breadcrumbs={profileBreadCrumbs}>Security</PageTitle>
            <SecuritySettings />
          </>
        }
      />
      <Route
        path='documents'
        element={
          <>
            <PageTitle breadcrumbs={profileBreadCrumbs}>Documents</PageTitle>
            <Documents />
          </>
        }
      />
      <Route index element={<Navigate to='/profile/account' />} />
    </Route>
  </Routes>
)

export default ProfilePage