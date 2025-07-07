import React from 'react'
import clsx from 'clsx'

interface FieldProps {
  label?: string
  name: string
  required?: boolean
  className?: string
  containerClassName?: string
  helpText?: string
  error?: string
  touched?: boolean
}

interface TextFieldProps extends FieldProps {
  type?: 'text' | 'email' | 'tel' | 'password' | 'url' | 'number'
  placeholder?: string
  value: string | number
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void
  autoComplete?: string
  maxLength?: number
  min?: number
  max?: number
  step?: number
}

export const TextField: React.FC<TextFieldProps> = ({
  label,
  name,
  type = 'text',
  required = false,
  className = '',
  containerClassName = '',
  helpText,
  error,
  touched,
  ...inputProps
}) => {
  const showError = touched && error
  
  return (
    <div className={`mb-5 ${containerClassName}`}>
      {label && (
        <label htmlFor={name} className={`form-label ${required ? 'required' : ''}`}>
          {label}
        </label>
      )}
      <input
        id={name}
        name={name}
        type={type}
        className={clsx('form-control form-control-solid', className, {
          'is-invalid': showError
        })}
        {...inputProps}
      />
      {helpText && !showError && (
        <div className="form-text">{helpText}</div>
      )}
      {showError && (
        <div className="fv-plugins-message-container">
          <span role="alert" className="text-danger">{error}</span>
        </div>
      )}
    </div>
  )
}

interface TextAreaFieldProps extends FieldProps {
  placeholder?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onBlur: (e: React.FocusEvent<HTMLTextAreaElement>) => void
  rows?: number
  maxLength?: number
}

export const TextAreaField: React.FC<TextAreaFieldProps> = ({
  label,
  name,
  required = false,
  className = '',
  containerClassName = '',
  helpText,
  error,
  touched,
  rows = 3,
  ...textareaProps
}) => {
  const showError = touched && error
  
  return (
    <div className={`mb-5 ${containerClassName}`}>
      {label && (
        <label htmlFor={name} className={`form-label ${required ? 'required' : ''}`}>
          {label}
        </label>
      )}
      <textarea
        id={name}
        name={name}
        rows={rows}
        className={clsx('form-control form-control-solid', className, {
          'is-invalid': showError
        })}
        {...textareaProps}
      />
      {helpText && !showError && (
        <div className="form-text">{helpText}</div>
      )}
      {showError && (
        <div className="fv-plugins-message-container">
          <span role="alert" className="text-danger">{error}</span>
        </div>
      )}
    </div>
  )
}

interface SelectFieldProps extends FieldProps {
  placeholder?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  onBlur: (e: React.FocusEvent<HTMLSelectElement>) => void
  options: Array<{ value: string; label: string }> | string[]
  emptyOption?: boolean
  emptyOptionLabel?: string
}

export const SelectField: React.FC<SelectFieldProps> = ({
  label,
  name,
  required = false,
  className = '',
  containerClassName = '',
  helpText,
  error,
  touched,
  options,
  emptyOption = true,
  emptyOptionLabel = '-- Select --',
  ...selectProps
}) => {
  const showError = touched && error
  
  return (
    <div className={`mb-5 ${containerClassName}`}>
      {label && (
        <label htmlFor={name} className={`form-label ${required ? 'required' : ''}`}>
          {label}
        </label>
      )}
      <select
        id={name}
        name={name}
        className={clsx('form-select form-select-solid', className, {
          'is-invalid': showError
        })}
        {...selectProps}
      >
        {emptyOption && <option value="">{emptyOptionLabel}</option>}
        {options.map((option) => {
          if (typeof option === 'string') {
            return (
              <option key={option} value={option}>
                {option}
              </option>
            )
          }
          return (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          )
        })}
      </select>
      {helpText && !showError && (
        <div className="form-text">{helpText}</div>
      )}
      {showError && (
        <div className="fv-plugins-message-container">
          <span role="alert" className="text-danger">{error}</span>
        </div>
      )}
    </div>
  )
}

interface CheckboxFieldProps extends FieldProps {
  checked: boolean
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
  label: string
}

export const CheckboxField: React.FC<CheckboxFieldProps> = ({
  name,
  className = '',
  containerClassName = '',
  error,
  touched,
  checked,
  onChange,
  onBlur,
  label
}) => {
  const showError = touched && error
  
  return (
    <div className={`mb-5 ${containerClassName}`}>
      <div className="form-check form-check-custom form-check-solid">
        <input
          id={name}
          name={name}
          type="checkbox"
          className={clsx('form-check-input', className, {
            'is-invalid': showError
          })}
          checked={checked}
          onChange={onChange}
          onBlur={onBlur}
        />
        <label className="form-check-label" htmlFor={name}>
          {label}
        </label>
      </div>
      {showError && (
        <div className="fv-plugins-message-container">
          <span role="alert" className="text-danger">{error}</span>
        </div>
      )}
    </div>
  )
}

interface RadioGroupProps extends FieldProps {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
  options: Array<{ value: string; label: string }>
  inline?: boolean
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  label,
  name,
  required = false,
  className = '',
  containerClassName = '',
  error,
  touched,
  value,
  onChange,
  onBlur,
  options,
  inline = false
}) => {
  const showError = touched && error
  
  return (
    <div className={`mb-5 ${containerClassName}`}>
      {label && (
        <label className={`form-label ${required ? 'required' : ''}`}>
          {label}
        </label>
      )}
      <div className={inline ? 'd-flex gap-5' : ''}>
        {options.map((option) => (
          <div key={option.value} className="form-check form-check-custom form-check-solid">
            <input
              id={`${name}-${option.value}`}
              name={name}
              type="radio"
              className={clsx('form-check-input', className, {
                'is-invalid': showError
              })}
              value={option.value}
              checked={value === option.value}
              onChange={onChange}
              onBlur={onBlur}
            />
            <label className="form-check-label" htmlFor={`${name}-${option.value}`}>
              {option.label}
            </label>
          </div>
        ))}
      </div>
      {showError && (
        <div className="fv-plugins-message-container">
          <span role="alert" className="text-danger">{error}</span>
        </div>
      )}
    </div>
  )
}

interface DateFieldProps extends FieldProps {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void
  min?: string
  max?: string
  includeTime?: boolean
}

export const DateField: React.FC<DateFieldProps> = ({
  label,
  name,
  required = false,
  className = '',
  containerClassName = '',
  helpText,
  error,
  touched,
  includeTime = false,
  ...inputProps
}) => {
  const showError = touched && error
  
  return (
    <div className={`mb-5 ${containerClassName}`}>
      {label && (
        <label htmlFor={name} className={`form-label ${required ? 'required' : ''}`}>
          {label}
        </label>
      )}
      <input
        id={name}
        name={name}
        type={includeTime ? 'datetime-local' : 'date'}
        className={clsx('form-control form-control-solid', className, {
          'is-invalid': showError
        })}
        {...inputProps}
      />
      {helpText && !showError && (
        <div className="form-text">{helpText}</div>
      )}
      {showError && (
        <div className="fv-plugins-message-container">
          <span role="alert" className="text-danger">{error}</span>
        </div>
      )}
    </div>
  )
}

// Phone field with formatting
interface PhoneFieldProps extends Omit<TextFieldProps, 'type'> {
  format?: boolean
}

export const PhoneField: React.FC<PhoneFieldProps> = ({
  format = true,
  onChange,
  value,
  ...props
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value
    
    if (format) {
      // Remove all non-digit characters
      const digits = inputValue.replace(/\D/g, '')
      
      // Format as (123) 456-7890
      if (digits.length <= 3) {
        inputValue = digits
      } else if (digits.length <= 6) {
        inputValue = `(${digits.slice(0, 3)}) ${digits.slice(3)}`
      } else if (digits.length <= 10) {
        inputValue = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
      } else {
        // Don't allow more than 10 digits
        return
      }
      
      e.target.value = inputValue
    }
    
    onChange(e)
  }
  
  return (
    <TextField
      {...props}
      type="tel"
      value={value}
      onChange={handleChange}
      placeholder="(123) 456-7890"
      maxLength={format ? 14 : undefined}
    />
  )
}

// Currency field with formatting
interface CurrencyFieldProps extends Omit<TextFieldProps, 'type'> {
  currencySymbol?: string
}

export const CurrencyField: React.FC<CurrencyFieldProps> = ({
  currencySymbol = '$',
  className = '',
  ...props
}) => {
  return (
    <div className="position-relative">
      <span className="position-absolute top-50 start-0 translate-middle-y ms-3 text-gray-500">
        {currencySymbol}
      </span>
      <TextField
        {...props}
        type="number"
        step={0.01}
        min={0}
        className={`ps-7 ${className}`}
        placeholder="0.00"
      />
    </div>
  )
}

// Form actions component
interface FormActionsProps {
  submitLabel?: string
  cancelLabel?: string
  onCancel?: () => void
  isSubmitting?: boolean
  isDirty?: boolean
  className?: string
}

export const FormActions: React.FC<FormActionsProps> = ({
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  onCancel,
  isSubmitting = false,
  isDirty = false,
  className = ''
}) => {
  return (
    <div className={`d-flex justify-content-end gap-3 ${className}`}>
      {onCancel && (
        <button
          type="button"
          className="btn btn-light"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          {cancelLabel}
        </button>
      )}
      <button
        type="submit"
        className="btn btn-primary"
        disabled={isSubmitting || !isDirty}
      >
        {isSubmitting ? (
          <>
            <span className="spinner-border spinner-border-sm align-middle me-2"></span>
            Saving...
          </>
        ) : (
          submitLabel
        )}
      </button>
    </div>
  )
}