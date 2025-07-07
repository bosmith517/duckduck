import * as Yup from 'yup'

// Common validation rules that can be reused across forms
export const validationRules = {
  // Name validations
  firstName: Yup.string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must be less than 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/, 'First name can only contain letters, spaces, hyphens, and apostrophes')
    .required('First name is required'),
    
  lastName: Yup.string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must be less than 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/, 'Last name can only contain letters, spaces, hyphens, and apostrophes')
    .required('Last name is required'),
    
  fullName: Yup.string()
    .min(3, 'Name must be at least 3 characters')
    .max(100, 'Name must be less than 100 characters')
    .required('Name is required'),

  // Contact validations
  email: Yup.string()
    .email('Please enter a valid email address')
    .max(255, 'Email must be less than 255 characters')
    .required('Email is required'),
    
  emailOptional: Yup.string()
    .email('Please enter a valid email address')
    .max(255, 'Email must be less than 255 characters'),
    
  phone: Yup.string()
    .matches(
      /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{4,6}$/,
      'Please enter a valid phone number'
    )
    .required('Phone number is required'),
    
  phoneOptional: Yup.string()
    .matches(
      /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{4,6}$/,
      'Please enter a valid phone number'
    ),

  // Address validations
  streetAddress: Yup.string()
    .max(200, 'Street address must be less than 200 characters'),
    
  city: Yup.string()
    .max(100, 'City must be less than 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/, 'City can only contain letters, spaces, hyphens, and apostrophes'),
    
  state: Yup.string()
    .max(50, 'State must be less than 50 characters'),
    
  zipCode: Yup.string()
    .matches(/^\d{5}(-\d{4})?$/, 'Please enter a valid ZIP code (12345 or 12345-6789)'),

  // Business validations
  companyName: Yup.string()
    .min(2, 'Company name must be at least 2 characters')
    .max(100, 'Company name must be less than 100 characters')
    .required('Company name is required'),
    
  website: Yup.string()
    .url('Please enter a valid URL (e.g., https://example.com)')
    .max(255, 'Website URL must be less than 255 characters'),

  // Financial validations
  currency: Yup.number()
    .typeError('Must be a number')
    .positive('Amount must be positive')
    .test('decimal', 'Amount can have maximum 2 decimal places', (value) => {
      if (value === undefined) return true
      return /^\d+(\.\d{1,2})?$/.test(value.toString())
    }),
    
  percentage: Yup.number()
    .typeError('Must be a number')
    .min(0, 'Percentage must be between 0 and 100')
    .max(100, 'Percentage must be between 0 and 100'),

  // Date validations
  futureDate: Yup.date()
    .min(new Date(), 'Date must be in the future')
    .required('Date is required'),
    
  pastDate: Yup.date()
    .max(new Date(), 'Date must be in the past')
    .required('Date is required'),
    
  optionalDate: Yup.date()
    .nullable(),

  // Text validations
  description: Yup.string()
    .max(1000, 'Description must be less than 1000 characters'),
    
  notes: Yup.string()
    .max(5000, 'Notes must be less than 5000 characters'),
    
  requiredText: Yup.string()
    .min(1, 'This field is required')
    .required('This field is required'),

  // Selection validations
  requiredSelect: Yup.string()
    .required('Please select an option'),
    
  // Password validations
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .matches(/[a-z]/, 'Password must contain at least one lowercase letter')
    .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .matches(/[0-9]/, 'Password must contain at least one number')
    .matches(/[^a-zA-Z0-9]/, 'Password must contain at least one special character')
    .required('Password is required'),
    
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords must match')
    .required('Please confirm your password'),
}

// Common validation schemas for entire forms
export const schemas = {
  // Contact form schema
  contactForm: Yup.object().shape({
    first_name: validationRules.firstName,
    last_name: validationRules.lastName,
    email: validationRules.emailOptional,
    phone: validationRules.phoneOptional,
    title: Yup.string().max(100, 'Title must be less than 100 characters'),
    notes: validationRules.notes,
  }),

  // Account form schema
  accountForm: Yup.object().shape({
    name: validationRules.companyName,
    type: validationRules.requiredSelect,
    email: validationRules.emailOptional,
    phone: validationRules.phoneOptional,
    website: validationRules.website,
    billing_address: validationRules.streetAddress,
    billing_city: validationRules.city,
    billing_state: validationRules.state,
    billing_zip: validationRules.zipCode,
  }),

  // Lead form schema
  leadForm: Yup.object().shape({
    caller_name: validationRules.fullName,
    caller_type: Yup.string()
      .oneOf(['business', 'individual'], 'Please select caller type')
      .required('Caller type is required'),
    phone_number: validationRules.phone,
    email: validationRules.emailOptional,
    lead_source: validationRules.requiredSelect,
    initial_request: Yup.string()
      .min(10, 'Please provide more detail about the request')
      .max(500, 'Maximum 500 characters')
      .required('Initial request is required'),
    urgency: validationRules.requiredSelect,
    estimated_value: validationRules.currency,
    follow_up_date: validationRules.optionalDate,
    notes: validationRules.notes,
  }),

  // Team member form schema
  teamMemberForm: Yup.object().shape({
    firstName: validationRules.firstName,
    lastName: validationRules.lastName,
    email: validationRules.email,
    phone: validationRules.phoneOptional,
    role: Yup.string()
      .oneOf(['admin', 'agent', 'viewer'], 'Please select a valid role')
      .required('Role is required'),
    department: Yup.string().max(100, 'Department must be less than 100 characters'),
  }),

  // Job form schema
  jobForm: Yup.object().shape({
    title: Yup.string()
      .min(3, 'Job title must be at least 3 characters')
      .max(200, 'Job title must be less than 200 characters')
      .required('Job title is required'),
    description: validationRules.description,
    status: validationRules.requiredSelect,
    priority: validationRules.requiredSelect,
    start_date: validationRules.futureDate,
    end_date: Yup.date()
      .min(Yup.ref('start_date'), 'End date must be after start date')
      .required('End date is required'),
    estimated_hours: Yup.number()
      .positive('Hours must be positive')
      .max(9999, 'Hours seems too high'),
    hourly_rate: validationRules.currency,
  }),

  // Invoice form schema
  invoiceForm: Yup.object().shape({
    invoice_number: Yup.string()
      .matches(/^[A-Z0-9-]+$/, 'Invoice number can only contain letters, numbers, and hyphens')
      .required('Invoice number is required'),
    issue_date: validationRules.pastDate,
    due_date: Yup.date()
      .min(Yup.ref('issue_date'), 'Due date must be after issue date')
      .required('Due date is required'),
    subtotal: validationRules.currency.required('Subtotal is required'),
    tax_rate: validationRules.percentage,
    discount_rate: validationRules.percentage,
    notes: validationRules.notes,
  }),

  // Login form schema
  loginForm: Yup.object().shape({
    email: validationRules.email,
    password: Yup.string().required('Password is required'),
  }),

  // Registration form schema
  registrationForm: Yup.object().shape({
    firstName: validationRules.firstName,
    lastName: validationRules.lastName,
    email: validationRules.email,
    password: validationRules.password,
    confirmPassword: validationRules.confirmPassword,
    companyName: validationRules.companyName,
    phone: validationRules.phoneOptional,
    acceptTerms: Yup.boolean()
      .oneOf([true], 'You must accept the terms and conditions')
      .required('You must accept the terms and conditions'),
  }),
}

// Utility functions for validation
export const validateField = async (schema: Yup.AnySchema, value: any): Promise<string | null> => {
  try {
    await schema.validate(value)
    return null
  } catch (error) {
    if (error instanceof Yup.ValidationError) {
      return error.message
    }
    return 'Validation error'
  }
}

export const validateForm = async <T>(schema: Yup.AnySchema, values: T): Promise<{
  isValid: boolean
  errors: Record<string, string>
}> => {
  try {
    await schema.validate(values, { abortEarly: false })
    return { isValid: true, errors: {} }
  } catch (error) {
    if (error instanceof Yup.ValidationError) {
      const errors: Record<string, string> = {}
      error.inner.forEach((err) => {
        if (err.path) {
          errors[err.path] = err.message
        }
      })
      return { isValid: false, errors }
    }
    return { isValid: false, errors: { general: 'Validation error' } }
  }
}

// Custom validation methods for specific use cases
export const customValidators = {
  phoneWithExtension: (value: string): boolean => {
    const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{4,6}(\s*(ext|x|extension)\s*\d+)?$/i
    return phoneRegex.test(value)
  },

  strongPassword: (password: string): { isValid: boolean; errors: string[] } => {
    const errors: string[] = []
    
    if (password.length < 8) errors.push('At least 8 characters')
    if (!/[a-z]/.test(password)) errors.push('One lowercase letter')
    if (!/[A-Z]/.test(password)) errors.push('One uppercase letter')
    if (!/[0-9]/.test(password)) errors.push('One number')
    if (!/[^a-zA-Z0-9]/.test(password)) errors.push('One special character')
    
    return {
      isValid: errors.length === 0,
      errors
    }
  },

  businessEmail: (email: string): boolean => {
    const freeEmailDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com']
    const domain = email.split('@')[1]?.toLowerCase()
    return !freeEmailDomains.includes(domain)
  },

  futureBusinessDate: (date: Date): boolean => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const checkDate = new Date(date)
    checkDate.setHours(0, 0, 0, 0)
    
    // Must be future date and not weekend
    const dayOfWeek = checkDate.getDay()
    return checkDate > today && dayOfWeek !== 0 && dayOfWeek !== 6
  },
}

// Form field helpers
export const getFieldError = (formik: any, fieldName: string): string | undefined => {
  return formik.touched[fieldName] && formik.errors[fieldName] 
    ? formik.errors[fieldName] 
    : undefined
}

export const isFieldInvalid = (formik: any, fieldName: string): boolean => {
  return !!(formik.touched[fieldName] && formik.errors[fieldName])
}