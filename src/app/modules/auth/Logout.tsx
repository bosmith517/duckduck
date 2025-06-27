import {useEffect} from 'react'
import {Navigate} from 'react-router-dom'
import {useSupabaseAuth} from './core/SupabaseAuth'

export function Logout() {
  const {signOut} = useSupabaseAuth()
  useEffect(() => {
    signOut()
    document.location.reload()
  }, [signOut])

  return <Navigate to='/auth/login' replace />
}
