import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Types for our database schema
export interface UserProfile {
  id: string // This IS the auth.users.id (no separate user_id needed)
  tenant_id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: 'admin' | 'user' | 'manager' // Legacy role field for existing policies
  role_name?: 'platform_admin' | 'platform_support' | 'owner' | 'admin' | 'sales' | 'technician' | 'dispatcher' | 'viewer' | 'homeowner' | 'property_manager' // New role system
  user_type?: string
  role_permissions?: any
  is_platform_user?: boolean
  can_impersonate?: boolean
  access_level?: number
  created_at: string
  updated_at: string
}

export interface Tenant {
  id: string
  name: string
  company_name?: string
  service_type?: string
  service_subtypes?: string[]
  onboarding_completed?: boolean
  workflow_preferences?: any
  business_info?: any
  created_at: string
  updated_at: string
}

export interface Account {
  id: string
  tenant_id: string
  created_at: string
  updated_at: string
  name: string
  account_status?: string
  type?: string
  industry?: string
  phone?: string
  email?: string
  website?: string
  address_line1?: string
  address_line2?: string
  city?: string
  state?: string
  zip_code?: string
  country?: string
  notes?: string
}

export interface Contact {
  id: string
  tenant_id: string
  account_id?: string | null // Nullable for individual customers
  lead_id?: string // Original lead that was converted
  contact_type?: 'individual' | 'business_contact' // Type of contact
  name?: string
  first_name: string
  last_name: string
  title?: string
  company?: string
  job_title?: string
  email?: string
  phone?: string
  mobile?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  is_primary?: boolean // Local storage only field
  notes?: string
  created_at: string
  updated_at: string
  // Joined data
  account?: Account
}

export interface Job {
  id: string
  tenant_id: string
  account_id: string
  contact_id?: string
  lead_id?: string
  assigned_technician_id?: string
  created_at: string
  updated_at: string
  status: string
  description?: string
  start_date?: string
  job_number?: string
  title: string
  priority: string
  due_date?: string
  estimated_hours?: number
  actual_hours?: number
  estimated_cost?: number
  actual_cost?: number
  location_address?: string
  location_city?: string
  location_state?: string
  location_zip?: string
  notes?: string
  // Joined data
  account?: Account
  contact?: Contact
}

export interface Lead {
  id: string
  tenant_id: string
  caller_name: string
  phone_number: string
  email?: string
  lead_source: string
  initial_request: string
  status: 'new' | 'qualified' | 'unqualified' | 'converted'
  urgency: 'low' | 'medium' | 'high' | 'emergency'
  estimated_value?: number
  follow_up_date?: string
  notes?: string
  converted_to_job_id?: string
  created_at: string
  updated_at: string
}

export interface CallLog {
  id: string
  tenant_id: string
  lead_id?: string
  contact_id?: string
  caller_name?: string
  caller_phone?: string
  call_type: 'inbound' | 'outbound'
  call_direction: 'inbound' | 'outbound'
  duration?: number
  status: 'missed' | 'completed' | 'voicemail' | 'busy'
  notes?: string
  created_at: string
}

export interface PropertyData {
  id: string
  tenant_id: string
  address: string
  normalized_address: string
  city?: string
  state?: string
  zip_code?: string
  
  // Property details
  property_type?: string
  year_built?: number
  square_footage?: number
  lot_size?: string
  bedrooms?: number
  bathrooms?: number
  
  // Enhanced Attom fields
  attom_id?: string
  attom_onboard?: string
  attom_fips_code?: string
  parcel_number?: string
  stories?: number
  total_rooms?: number
  garage_spaces?: number
  pool?: boolean
  fireplace?: boolean
  central_air?: boolean
  heating_type?: string
  cooling_type?: string
  roof_material?: string
  exterior_walls?: string
  construction_quality?: string
  condition_rating?: string
  
  // Financial data
  estimated_value?: number
  market_value_estimate?: number
  market_value_date?: string
  last_sold_price?: number
  last_sold_date?: string
  tax_assessment?: number
  tax_year?: number
  
  // Enhanced data arrays
  comparable_sales?: any[]
  price_history?: any[]
  tax_history?: any[]
  rental_estimates?: any
  demographic_data?: any
  environmental_data?: any
  attom_raw_data?: any
  
  // Sync metadata
  data_source: 'redfin' | 'attom' | 'manual' | 'zillow' | 'mls' | 'public_records'
  last_attom_sync?: string
  attom_sync_status?: 'pending' | 'syncing' | 'success' | 'error' | 'not_found'
  attom_error_message?: string
  
  // Images and URLs
  street_view_url?: string
  property_image_url?: string
  redfin_url?: string
  
  // Timestamps
  scraped_at?: string
  created_at: string
  updated_at: string
}
