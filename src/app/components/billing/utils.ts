// TradeWorks Pro Advanced Billing System - Utility Functions
// Common utilities for billing calculations and formatting

// Currency formatting
export const formatCurrency = (amount: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount)
}

// Percentage formatting
export const formatPercentage = (value: number, decimals: number = 1): string => {
  return `${value.toFixed(decimals)}%`
}

// Calculate line item total
export const calculateLineItemTotal = (quantity: number, unitPrice: number): number => {
  return quantity * unitPrice
}

// Calculate estimate tier total with tax
export const calculateTierTotal = (subtotal: number, taxRate: number = 0): number => {
  const taxAmount = subtotal * (taxRate / 100)
  return subtotal + taxAmount
}

// Calculate markup amount
export const calculateMarkup = (cost: number, markupPercentage: number): number => {
  return cost * (markupPercentage / 100)
}

// Calculate profit margin
export const calculateProfitMargin = (revenue: number, costs: number): number => {
  if (revenue === 0) return 0
  return ((revenue - costs) / revenue) * 100
}

// Calculate variance between estimated and actual
export const calculateVariance = (estimated: number, actual: number): number => {
  return actual - estimated
}

// Calculate variance percentage
export const calculateVariancePercentage = (estimated: number, actual: number): number => {
  if (estimated === 0) return 0
  return ((actual - estimated) / estimated) * 100
}

// Determine profitability status
export const isProfitable = (revenue: number, costs: number): boolean => {
  return revenue > costs
}

// Calculate processing fee (typical Stripe fee structure)
export const calculateProcessingFee = (amount: number, rate: number = 0.029, fixed: number = 0.30): number => {
  return (amount * rate) + fixed
}

// Generate estimate tier colors
export const getTierColors = () => ({
  good: '#17a2b8', // Info blue
  better: '#28a745', // Success green  
  best: '#ffc107' // Warning gold
})

// Get status color classes
export const getStatusColor = (status: string): string => {
  const statusColors: Record<string, string> = {
    'draft': 'secondary',
    'sent': 'primary',
    'viewed': 'info',
    'approved': 'success',
    'rejected': 'danger',
    'expired': 'warning',
    'pending': 'warning',
    'paid': 'success',
    'partial': 'warning',
    'overdue': 'danger',
    'cancelled': 'secondary',
    'in_progress': 'primary',
    'completed': 'success',
    'on_hold': 'warning'
  }
  return statusColors[status.toLowerCase()] || 'secondary'
}

// Format date for display
export const formatDate = (dateString: string, includeTime: boolean = false): string => {
  const date = new Date(dateString)
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }
  
  if (includeTime) {
    options.hour = '2-digit'
    options.minute = '2-digit'
  }
  
  return date.toLocaleDateString('en-US', options)
}

// Calculate days between dates
export const daysBetween = (startDate: string, endDate: string): number => {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffTime = Math.abs(end.getTime() - start.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

// Check if invoice is overdue
export const isOverdue = (dueDate: string): boolean => {
  const today = new Date()
  const due = new Date(dueDate)
  return due < today
}

// Generate invoice number
export const generateInvoiceNumber = (prefix: string = 'INV', sequence: number): string => {
  return `${prefix}-${sequence.toString().padStart(4, '0')}`
}

// Generate estimate number
export const generateEstimateNumber = (prefix: string = 'EST', sequence: number): string => {
  return `${prefix}-${sequence.toString().padStart(4, '0')}`
}

// Validate email format
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Generate random ID
export const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9)
}

// Round to 2 decimal places (for currency)
export const roundCurrency = (amount: number): number => {
  return Math.round(amount * 100) / 100
}

// Calculate tax amount
export const calculateTax = (subtotal: number, taxRate: number): number => {
  return roundCurrency(subtotal * (taxRate / 100))
}

// Get cost type icon
export const getCostTypeIcon = (costType: string): string => {
  const icons: Record<string, string> = {
    'labor': 'ki-user',
    'material': 'ki-package',
    'equipment': 'ki-gear',
    'subcontractor': 'ki-profile-user',
    'overhead': 'ki-home-3',
    'other': 'ki-more-horizontal'
  }
  return icons[costType] || 'ki-more-horizontal'
}

// Get trend icon based on direction
export const getTrendIcon = (trend: 'increasing' | 'decreasing' | 'stable'): string => {
  switch (trend) {
    case 'increasing':
      return 'ki-arrow-up'
    case 'decreasing':
      return 'ki-arrow-down'
    default:
      return 'ki-minus'
  }
}

// Get trend color based on direction
export const getTrendColor = (trend: 'increasing' | 'decreasing' | 'stable'): string => {
  switch (trend) {
    case 'increasing':
      return 'success'
    case 'decreasing':
      return 'danger'
    default:
      return 'muted'
  }
}

// Extract service category from job title (basic implementation)
export const extractServiceCategory = (jobTitle: string): string => {
  const title = jobTitle.toLowerCase()
  
  if (title.includes('plumbing') || title.includes('pipe') || title.includes('drain')) {
    return 'Plumbing'
  }
  if (title.includes('electrical') || title.includes('electric') || title.includes('wire')) {
    return 'Electrical'
  }
  if (title.includes('hvac') || title.includes('heating') || title.includes('cooling') || title.includes('air')) {
    return 'HVAC'
  }
  if (title.includes('roof') || title.includes('gutter') || title.includes('shingle')) {
    return 'Roofing'
  }
  if (title.includes('paint') || title.includes('drywall') || title.includes('wall')) {
    return 'Painting & Drywall'
  }
  if (title.includes('floor') || title.includes('carpet') || title.includes('tile')) {
    return 'Flooring'
  }
  if (title.includes('kitchen') || title.includes('bathroom') || title.includes('remodel')) {
    return 'Remodeling'
  }
  
  return 'General Services'
}

// Determine performance trend based on data
export const determineTrend = (currentValue: number, previousValue: number): 'increasing' | 'decreasing' | 'stable' => {
  const threshold = 0.05 // 5% threshold for considering change significant
  const changePercent = Math.abs(currentValue - previousValue) / previousValue
  
  if (changePercent < threshold) {
    return 'stable'
  }
  
  return currentValue > previousValue ? 'increasing' : 'decreasing'
}

// Export all utilities
export default {
  formatCurrency,
  formatPercentage,
  calculateLineItemTotal,
  calculateTierTotal,
  calculateMarkup,
  calculateProfitMargin,
  calculateVariance,
  calculateVariancePercentage,
  isProfitable,
  calculateProcessingFee,
  getTierColors,
  getStatusColor,
  formatDate,
  daysBetween,
  isOverdue,
  generateInvoiceNumber,
  generateEstimateNumber,
  isValidEmail,
  generateId,
  roundCurrency,
  calculateTax,
  getCostTypeIcon,
  getTrendIcon,
  getTrendColor,
  extractServiceCategory,
  determineTrend
}