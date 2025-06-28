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
  role: 'admin' | 'user' | 'manager'
  created_at: string
  updated_at: string
}

export interface Tenant {
  id: string
  name: string
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
  account_id: string
  first_name: string
  last_name: string
  title?: string
  email?: string
  phone?: string
  mobile?: string
  is_primary?: boolean // Made optional since it doesn't exist in the database
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
