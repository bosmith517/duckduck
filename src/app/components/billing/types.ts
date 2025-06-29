// TradeWorks Pro Advanced Billing System - Type Definitions
// Comprehensive TypeScript interfaces for the billing module

// Estimate Line Items
export interface EstimateLineItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  total_price: number
  markup_percentage?: number
  labor_hours?: number
  material_cost?: number
  service_id?: string
}

// Tiered Estimates (Good/Better/Best)
export interface EstimateTier {
  tier_level: 'good' | 'better' | 'best'
  tier_name: string
  description: string
  line_items: EstimateLineItem[]
  subtotal: number
  tax_amount: number
  total_amount: number
  is_recommended?: boolean
  tier_color?: string
}

// Service Catalog
export interface ServiceItem {
  id: string
  tenant_id: string
  category_id: string
  name: string
  description: string
  unit_type: string
  default_rate: number
  markup_percentage: number
  is_taxable: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ServiceCategory {
  id: string
  tenant_id: string
  name: string
  description: string
  color: string
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

// Payment Processing
export interface PaymentResult {
  payment_id: string
  amount: number
  payment_method: string
  transaction_id: string
  processor_fee: number
  net_amount: number
}

export interface PaymentAttempt {
  id: string
  tenant_id: string
  invoice_id: string
  stripe_payment_intent_id?: string
  amount: number
  currency: string
  customer_email: string
  status: 'pending' | 'succeeded' | 'failed'
  error_message?: string
  created_at: string
  completed_at?: string
}

// Job Costing
export interface JobCostData {
  id: string
  job_number: string
  title: string
  status: string
  start_date: string
  contact_name: string
  
  // Financial data
  estimated_cost: number
  actual_cost: number
  total_invoiced: number
  
  // Labor
  labor_hours_estimated: number
  labor_hours_actual: number
  labor_rate: number
  
  // Materials & other costs
  material_cost_estimated: number
  material_cost_actual: number
  overhead_percentage: number
  profit_margin_percentage: number
  
  // Calculated fields
  gross_profit: number
  profit_margin: number
  cost_variance: number
  labor_variance: number
  is_profitable: boolean
}

export interface CostEntry {
  id: string
  job_id: string
  cost_type: 'labor' | 'material' | 'equipment' | 'subcontractor' | 'overhead' | 'other'
  description: string
  quantity: number
  unit_cost: number
  total_cost: number
  cost_date: string
  vendor?: string
  receipt_url?: string
  created_by_name?: string
}

// Profitability Reports
export interface ProfitabilityData {
  customer_reports: CustomerProfitability[]
  service_reports: ServiceProfitability[]
  monthly_pnl: MonthlyPnL[]
  total_revenue: number
  total_costs: number
  total_profit: number
  average_margin: number
  most_profitable_month: string
  least_profitable_month: string
}

export interface CustomerProfitability {
  customer_id: string
  customer_name: string
  total_jobs: number
  total_revenue: number
  total_costs: number
  gross_profit: number
  profit_margin: number
  average_job_value: number
  last_job_date: string
  is_profitable: boolean
}

export interface ServiceProfitability {
  service_category: string
  job_count: number
  total_revenue: number
  total_costs: number
  gross_profit: number
  profit_margin: number
  average_job_size: number
  most_profitable_job: string
  trend: 'increasing' | 'decreasing' | 'stable'
}

export interface MonthlyPnL {
  month: string
  revenue: number
  costs: number
  gross_profit: number
  profit_margin: number
  job_count: number
  average_job_value: number
}

// E-Signature
export interface DocumentSignature {
  id: string
  document_id: string
  document_type: 'estimate' | 'contract' | 'invoice'
  signature_image_url: string
  signed_by_name: string
  signed_by_email: string
  signed_at: string
  ip_address: string
  user_agent: string
  created_at: string
}

// Invoice Payments
export interface InvoicePayment {
  id: string
  invoice_id: string
  tenant_id: string
  payment_method: 'credit_card' | 'ach' | 'check' | 'cash' | 'paypal'
  amount: number
  transaction_id: string
  processor: 'stripe' | 'square' | 'paypal' | 'manual'
  processor_fee: number
  payment_date: string
  metadata?: Record<string, any>
  created_at: string
}

// Stripe Customer Storage
export interface StripeCustomer {
  id: string
  tenant_id: string
  email: string
  name: string
  stripe_customer_id: string
  created_at: string
  updated_at: string
}

// Invoice Reminder Settings
export interface InvoiceReminderSetting {
  id: string
  tenant_id: string
  reminder_name: string
  days_after_due: number
  email_subject: string
  email_template: string
  is_active: boolean
  created_at: string
  updated_at: string
}