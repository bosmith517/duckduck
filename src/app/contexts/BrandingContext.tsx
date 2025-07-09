import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { useSupabaseAuth } from '../modules/auth/core/SupabaseAuth'

interface BrandingSettings {
  company_name: string
  logo_url?: string
  primary_color: string
  secondary_color: string
  favicon_url?: string
  tagline?: string
  white_label_enabled: boolean
}

interface BrandingContextType {
  branding: BrandingSettings | null
  loading: boolean
  refreshBranding: () => Promise<void>
}

const defaultBranding: BrandingSettings = {
  company_name: 'TradeWorks Pro',
  primary_color: '#007bff',
  secondary_color: '#6c757d',
  white_label_enabled: false
}

const BrandingContext = createContext<BrandingContextType>({
  branding: defaultBranding,
  loading: true,
  refreshBranding: async () => {}
})

export const useBranding = () => useContext(BrandingContext)

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile, tenant } = useSupabaseAuth()
  const [branding, setBranding] = useState<BrandingSettings | null>(null)
  const [loading, setLoading] = useState(true)

  const loadBranding = async () => {
    if (!userProfile?.tenant_id) {
      setBranding(defaultBranding)
      setLoading(false)
      return
    }

    try {
      // Try to load from tenant_branding table
      const { data: brandingData, error } = await supabase
        .from('tenant_branding')
        .select('*')
        .eq('tenant_id', userProfile.tenant_id)
        .single()

      if (brandingData && !error) {
        setBranding({
          company_name: brandingData.company_name || tenant?.company_name || defaultBranding.company_name,
          logo_url: brandingData.logo_url,
          primary_color: brandingData.primary_color || defaultBranding.primary_color,
          secondary_color: brandingData.secondary_color || defaultBranding.secondary_color,
          favicon_url: brandingData.favicon_url,
          tagline: brandingData.tagline,
          white_label_enabled: brandingData.white_label_enabled || false
        })
      } else {
        // Fallback to tenant business_info
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', userProfile.tenant_id)
          .single()

        if (tenantData?.business_info?.branding_settings) {
          const brandingSettings = tenantData.business_info.branding_settings
          setBranding({
            company_name: brandingSettings.company_name || tenantData.company_name || defaultBranding.company_name,
            logo_url: brandingSettings.logo_url,
            primary_color: brandingSettings.primary_color || defaultBranding.primary_color,
            secondary_color: brandingSettings.secondary_color || defaultBranding.secondary_color,
            favicon_url: brandingSettings.favicon_url,
            tagline: brandingSettings.tagline,
            white_label_enabled: brandingSettings.white_label_enabled || false
          })
        } else {
          setBranding({
            ...defaultBranding,
            company_name: tenant?.company_name || defaultBranding.company_name
          })
        }
      }

    } catch (error) {
      console.error('Error loading branding:', error)
      setBranding(defaultBranding)
    } finally {
      setLoading(false)
    }
  }

  const hexToRgb = (hex: string): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    if (result) {
      const r = parseInt(result[1], 16)
      const g = parseInt(result[2], 16)
      const b = parseInt(result[3], 16)
      return `${r}, ${g}, ${b}`
    }
    return '0, 123, 255' // Default primary color RGB
  }

  useEffect(() => {
    loadBranding()
  }, [userProfile?.tenant_id])

  // Apply CSS variables for colors when branding changes
  useEffect(() => {
    if (branding) {
      document.documentElement.style.setProperty('--bs-primary', branding.primary_color)
      document.documentElement.style.setProperty('--bs-primary-rgb', hexToRgb(branding.primary_color))
      document.documentElement.style.setProperty('--bs-secondary', branding.secondary_color)
      document.documentElement.style.setProperty('--bs-secondary-rgb', hexToRgb(branding.secondary_color))
    }
  }, [branding])

  // Apply dynamic favicon
  useEffect(() => {
    if (branding?.favicon_url) {
      const favicon = document.querySelector("link[rel*='icon']") as HTMLLinkElement
      if (favicon) {
        favicon.href = branding.favicon_url
      }
    }
  }, [branding?.favicon_url])

  // Update document title
  useEffect(() => {
    if (branding?.company_name && branding.white_label_enabled) {
      document.title = branding.company_name
    }
  }, [branding?.company_name, branding?.white_label_enabled])

  return (
    <BrandingContext.Provider value={{ 
      branding: branding || defaultBranding, 
      loading,
      refreshBranding: loadBranding
    }}>
      {children}
    </BrandingContext.Provider>
  )
}