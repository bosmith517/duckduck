import {FC, useEffect} from 'react'
import {Outlet, useLocation} from 'react-router-dom'
import {Footer} from './components/Footer'
import {HeaderWrapper} from './components/header/HeaderWrapper'
import {ScrollTop} from './components/ScrollTop'
import {PageDataProvider, useLayout} from './core'
import {ActivityDrawer, DrawerMessenger, InviteUsers, RightToolbar, UpgradePlan} from '../partials'
import {themeModeSwitchHelper, useThemeMode} from '../partials/layout/theme-mode/ThemeModeProvider'
import {
    DrawerComponent,
    MenuComponent,
    ScrollComponent,
    ScrollTopComponent,
    SwapperComponent,
    ToggleComponent
} from '../assets/ts/components'
import clsx from 'clsx'
import {WithChildren} from '../helpers'
import { AsideDefault } from './components/aside/AsideDefault'
import { useSupabaseAuth } from '../../app/modules/auth/core/SupabaseAuth'
import { supabase } from '../../supabaseClient'
import { SoftphoneDialer } from '../../app/components/communications/SoftphoneDialer'
import { SoftphoneProvider, useSoftphoneContext } from '../../app/contexts/SoftphoneContext'

const MasterLayout: FC<WithChildren> = ({children}) => {
  const {classes} = useLayout()
  const {mode} = useThemeMode()
  const location = useLocation()
  
  // Get user from auth context
  const { user, setUserProfile, setTenant, userProfile, setCurrentUser } = useSupabaseAuth()
  
  // Global softphone state
  const { isVisible, hideDialer } = useSoftphoneContext()

  useEffect(() => {
    setTimeout(() => {
        ToggleComponent.reinitialization();
        ScrollTopComponent.reinitialization();
        DrawerComponent.reinitialization();
        MenuComponent.reinitialization();
        ScrollComponent.reinitialization();
        SwapperComponent.reinitialization();
    }, 500)
  }, [location.key])

  useEffect(() => {
    themeModeSwitchHelper(mode)
  }, [mode])

  // Fetch detailed profile data after user is authenticated
  useEffect(() => {
    // If we have a user but we haven't fetched their detailed profile yet...
    if (user && !userProfile) {
      const fetchDetails = async () => {
        try {
          const { data: profile, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .single()

          if (error) {
            console.error('Error fetching profile:', error)
            // Create a fallback profile if database doesn't exist
            const fallbackProfile = {
              id: user.id,
              email: user.email || '',
              first_name: user.user_metadata?.first_name || 'User',
              last_name: user.user_metadata?.last_name || '',
              tenant_id: '1', // Default tenant
              role: 'admin' as const,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
            setUserProfile(fallbackProfile)
            return
          }
          
          if (profile) {
            setUserProfile(profile)

            // Update the currentUser with proper profile data only if ID changed
            const newId = parseInt(profile.id) || 1
            const userModel = {
              id: newId,
              username: profile.email,
              password: undefined,
              email: profile.email,
              first_name: profile.first_name || '',
              last_name: profile.last_name || '',
              fullname: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
              roles: profile.role === 'admin' ? [1] : [2],
            }
            // Only update if the user data actually changed to prevent infinite loops
            setCurrentUser(prev => prev?.id !== newId ? userModel : prev)

            // Fetch tenant data
            const { data: tenant } = await supabase
              .from('tenants')
              .select('*')
              .eq('id', profile.tenant_id)
              .single()
            
            if (tenant) {
              setTenant(tenant)
            }
          }
        } catch (error) {
          console.error('Error fetching details after login:', error)
        }
      }

      fetchDetails()
    }
  }, [user?.id]) // Only run when user ID changes

  return (
    <PageDataProvider>
      <div className='page d-flex flex-row flex-column-fluid'>
        <AsideDefault />
        <div className='wrapper d-flex flex-column flex-row-fluid' id='kt_wrapper'>
          <HeaderWrapper />
          <div className='content d-flex flex-column flex-column-fluid' id='kt_content'>
            <Outlet />
          </div>
          <Footer />
        </div>
      </div>

      {/* begin:: Drawers */}
      <ActivityDrawer />
      <RightToolbar />
      <DrawerMessenger />
      {/* end:: Drawers */}

      {/* begin:: Modals */}
      <InviteUsers />
      <UpgradePlan />
      {/* end:: Modals */}
      <ScrollTop />
      
      {/* Global Softphone Dialer */}
      <SoftphoneDialer isVisible={isVisible} onClose={hideDialer} />
    </PageDataProvider>
  )
}

export {MasterLayout}
