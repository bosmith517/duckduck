/* eslint-disable react-refresh/only-export-components */
import React, {FC, useState, useEffect, createContext, useContext, Dispatch, SetStateAction} from 'react'
import {LayoutSplashScreen} from '../../../../_metronic/layout/core'
import TradeWorksSplashScreen from '../../../components/branding/TradeWorksSplashScreen'
import {UserModel} from './_models'
import {WithChildren} from '../../../../_metronic/helpers'
import {supabase, UserProfile, Tenant} from '../../../../supabaseClient'
import {User, Session} from '@supabase/supabase-js'

type SupabaseAuthContextProps = {
  currentUser: UserModel | undefined
  userProfile: UserProfile | undefined
  tenant: Tenant | undefined
  setCurrentUser: Dispatch<SetStateAction<UserModel | undefined>>
  setUserProfile: Dispatch<SetStateAction<UserProfile | undefined>>
  setTenant: Dispatch<SetStateAction<Tenant | undefined>>
  session: Session | null
  user: User | null
  signIn: (email: string, password: string) => Promise<{error: any}>
  signUp: (email: string, password: string, firstName: string, lastName: string, companyName: string) => Promise<{error: any}>
  signOut: () => Promise<void>
  authLoading: boolean
}

const initSupabaseAuthContextPropsState = {
  currentUser: undefined,
  userProfile: undefined,
  tenant: undefined,
  setCurrentUser: () => {},
  setUserProfile: () => {},
  setTenant: () => {},
  session: null,
  user: null,
  signIn: async () => ({error: null}),
  signUp: async () => ({error: null}),
  signOut: async () => {},
  authLoading: true,
}

const SupabaseAuthContext = createContext<SupabaseAuthContextProps>(initSupabaseAuthContextPropsState)

const useSupabaseAuth = () => {
  return useContext(SupabaseAuthContext)
}

const SupabaseAuthProvider: FC<WithChildren> = ({children}) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [currentUser, setCurrentUser] = useState<UserModel | undefined>()
  const [userProfile, setUserProfile] = useState<UserProfile | undefined>()
  const [tenant, setTenant] = useState<Tenant | undefined>()
  const [authLoading, setAuthLoading] = useState(true) // New state specifically for initial auth check

  useEffect(() => {
    setAuthLoading(true)

    // This listener sets the session/user and loads user profile/tenant data
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      
      if (session?.user) {
        // Load profile data asynchronously without blocking
        loadUserProfile(session.user.id)
      } else {
        setCurrentUser(undefined)
        setUserProfile(undefined)
        setTenant(undefined)
        setAuthLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Separate async function to load user profile
  const loadUserProfile = async (userId: string) => {
    try {
      // Load user profile from database
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (profileError) {
        console.error('Error loading user profile:', profileError)
        setAuthLoading(false)
        return
      }

      setUserProfile(profile)

      // Load tenant information
      if (profile?.tenant_id) {
        const { data: tenantData, error: tenantError } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', profile.tenant_id)
          .single()

        if (tenantError) {
          console.error('Error loading tenant:', tenantError)
        } else {
          setTenant(tenantData)
        }
      }

      // Get the current user from Supabase auth
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      
      // Set user model
      const userModel: UserModel = {
        id: 1,
        username: currentUser?.email || 'user',
        password: undefined,
        email: currentUser?.email || '',
        first_name: profile?.first_name || currentUser?.user_metadata?.first_name || 'User',
        last_name: profile?.last_name || currentUser?.user_metadata?.last_name || '',
        fullname: `${profile?.first_name || currentUser?.user_metadata?.first_name || 'User'} ${profile?.last_name || currentUser?.user_metadata?.last_name || ''}`.trim(),
        roles: [profile?.role === 'admin' ? 1 : profile?.role === 'agent' ? 2 : 3],
      }
      setCurrentUser(userModel)

    } catch (error) {
      console.error('Error loading user profile:', error)
    } finally {
      setAuthLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      setAuthLoading(true)
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) {
        setAuthLoading(false)
        return { error }
      }
      
      // Profile will be fetched automatically via onAuthStateChange
      return { error: null }
    } catch (error) {
      setAuthLoading(false)
      return { error }
    }
  }

  const signUp = async (email: string, password: string, firstName: string, lastName: string, companyName: string) => {
    try {
      setAuthLoading(true)
      
      // Step 1: Create user account with metadata
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            company_name: companyName // This will be used by the trigger
          }
        }
      })

      if (authError) {
        console.error('Auth signup error:', authError)
        setAuthLoading(false)
        return { error: authError }
      }

      if (!authData.user) {
        setAuthLoading(false)
        return { error: new Error('User creation failed') }
      }

      console.log('User created successfully, setting up profile...')
      
      // Step 2: Call the Edge Function to create tenant and user profile
      const { data: setupData, error: setupError } = await supabase.functions.invoke('handle-new-user-signup', {
        body: {
          email,
          firstName,
          lastName,
          companyName,
          userId: authData.user.id
        }
      })

      if (setupError || !setupData?.success) {
        console.error('Profile setup error:', setupError)
        setAuthLoading(false)
        return { error: setupError || new Error('Failed to set up user profile') }
      }

      console.log('Profile setup completed:', setupData)
      setAuthLoading(false)
      return { error: null }
      
    } catch (error) {
      console.error('Error in signUp:', error)
      setAuthLoading(false)
      return { error }
    }
  }

  const signOut = async () => {
    try {
      setAuthLoading(true)
      await supabase.auth.signOut()
      setCurrentUser(undefined)
      setUserProfile(undefined)
      setTenant(undefined)
      setSession(null)
      setUser(null)
    } catch (error) {
      console.error('Error signing out:', error)
    } finally {
      setAuthLoading(false)
    }
  }

  return (
    <SupabaseAuthContext.Provider value={{
      currentUser,
      userProfile,
      tenant,
      setCurrentUser,
      setUserProfile,
      setTenant,
      session,
      user,
      signIn,
      signUp,
      signOut,
      authLoading
    }}>
      {children}
    </SupabaseAuthContext.Provider>
  )
}

const SupabaseAuthInit: FC<WithChildren> = ({children}) => {
  const { authLoading } = useSupabaseAuth()

  return authLoading ? <TradeWorksSplashScreen /> : <>{children}</>
}

export {SupabaseAuthProvider, SupabaseAuthInit, useSupabaseAuth}
