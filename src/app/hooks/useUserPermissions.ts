import { useSupabaseAuth } from '../modules/auth/core/SupabaseAuth'

interface UserPermissions {
  hasPermission: (permission: string) => boolean
  isPlatformUser: () => boolean
  canAccessTenantData: (tenantId: string) => boolean
  userType: string | undefined
  accessLevel: number
  canManageInfrastructure: () => boolean
  canViewAllTenants: () => boolean
  canManageCompany: () => boolean
  canManageTeam: () => boolean
  canViewFinancials: () => boolean
  canAssignJobs: () => boolean
  canViewOwnJobsOnly: () => boolean
}

export const useUserPermissions = (): UserPermissions => {
  const { userProfile } = useSupabaseAuth()
  
  const hasPermission = (permission: string): boolean => {
    if (!userProfile) return false
    
    // Platform admins have all permissions
    if (userProfile.is_platform_user && (userProfile.access_level ?? 0) >= 5) {
      return true
    }
    
    // Check specific role permissions
    return userProfile.role_permissions?.[permission] === true
  }
  
  const isPlatformUser = (): boolean => {
    return userProfile?.is_platform_user === true
  }
  
  const canAccessTenantData = (tenantId: string): boolean => {
    if (isPlatformUser() && (userProfile?.access_level ?? 0) >= 4) {
      return true // Platform support can access any tenant
    }
    return userProfile?.tenant_id === tenantId
  }
  
  const canManageInfrastructure = (): boolean => {
    return isPlatformUser() && (userProfile?.access_level ?? 0) >= 5
  }
  
  const canViewAllTenants = (): boolean => {
    return isPlatformUser() && (userProfile?.access_level ?? 0) >= 4
  }
  
  const getEffectiveRole = (): string => {
    if (!userProfile) return 'viewer'
    
    // Use new role_name if available, otherwise map legacy role
    if (userProfile.role_name) {
      return userProfile.role_name
    }
    
    // Legacy role mapping
    switch (userProfile.role) {
      case 'admin':
      case 'manager':
        return 'admin'
      case 'user':
        return 'technician'
      default:
        return 'technician'
    }
  }
  
  const canManageCompany = (): boolean => {
    if (!userProfile) return false
    const effectiveRole = getEffectiveRole()
    return ['owner', 'admin'].includes(effectiveRole) || canManageInfrastructure()
  }
  
  const canManageTeam = (): boolean => {
    if (!userProfile) return false
    const effectiveRole = getEffectiveRole()
    return ['owner', 'admin', 'dispatcher'].includes(effectiveRole) || canManageInfrastructure()
  }
  
  const canViewFinancials = (): boolean => {
    if (!userProfile) return false
    const effectiveRole = getEffectiveRole()
    return ['owner', 'admin'].includes(effectiveRole) || canManageInfrastructure()
  }
  
  const canAssignJobs = (): boolean => {
    if (!userProfile) return false
    const effectiveRole = getEffectiveRole()
    return ['owner', 'admin', 'dispatcher'].includes(effectiveRole) || canManageInfrastructure()
  }
  
  const canViewOwnJobsOnly = (): boolean => {
    if (!userProfile) return false
    const effectiveRole = getEffectiveRole()
    return effectiveRole === 'technician' && !canManageInfrastructure()
  }
  
  return {
    hasPermission,
    isPlatformUser,
    canAccessTenantData,
    userType: getEffectiveRole(),
    accessLevel: userProfile?.access_level || 1,
    canManageInfrastructure,
    canViewAllTenants,
    canManageCompany,
    canManageTeam,
    canViewFinancials,
    canAssignJobs,
    canViewOwnJobsOnly
  }
}