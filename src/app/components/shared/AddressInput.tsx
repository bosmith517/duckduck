import React, { useState } from 'react'
import clsx from 'clsx'
import { FormattedAddress } from '../../utils/addressUtils'

interface AddressInputProps {
  value?: string
  onChange: (address: FormattedAddress) => void
  onInputChange?: (inputValue: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  required?: boolean
  label?: string
  error?: string
}

export const AddressInput: React.FC<AddressInputProps> = ({
  value = '',
  onChange,
  onInputChange,
  placeholder = 'Enter address...',
  className = '',
  disabled = false,
  required = false,
  label,
  error
}) => {
  const [inputValue, setInputValue] = useState(value || '')

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    onInputChange?.(newValue)
  }

  const handleBlur = () => {
    // Create a basic address object when user finishes typing
    if (inputValue.trim()) {
      const address: FormattedAddress = {
        full_address: inputValue.trim(),
        street_address: inputValue.trim(),
        city: '',
        state: '',
        state_code: '',
        zip: '',
        country: 'United States',
        country_code: 'US'
      }
      onChange(address)
    }
  }

  return (
    <div className='mb-3'>
      {label && (
        <label className={clsx('form-label fw-semibold fs-6 mb-2', required && 'required')}>
          {label}
        </label>
      )}
      
      <input
        type='text'
        className={clsx(
          'form-control form-control-solid',
          className,
          error && 'is-invalid',
          !error && inputValue && 'is-valid'
        )}
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete='street-address'
      />
      
      {error && (
        <div className='fv-plugins-message-container'>
          <span role='alert' className='text-danger'>{error}</span>
        </div>
      )}
    </div>
  )
}