import React, { useState, useEffect } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import clsx from 'clsx'
import { AddressInput } from './AddressInput'
import { FormattedAddress, validateAddress, formatAddressString } from '../../utils/addressUtils'

interface AddressFormProps {
  initialAddress?: Partial<FormattedAddress>
  onAddressChange: (address: FormattedAddress) => void
  onValidationChange?: (isValid: boolean) => void
  fieldPrefix?: string // Prefix for field names (e.g., 'billing_', 'shipping_')
  disabled?: boolean
  showAutocomplete?: boolean
  required?: boolean
  compact?: boolean // Show only essential fields
  label?: string
}

const addressSchema = Yup.object().shape({
  street_address: Yup.string().required('Street address is required'),
  city: Yup.string().required('City is required'),
  state: Yup.string().required('State is required'),
  zip: Yup.string()
    .required('ZIP code is required')
    .matches(/^\d{5}(-\d{4})?$/, 'ZIP code must be in format 12345 or 12345-6789'),
  country: Yup.string()
})

export const AddressForm: React.FC<AddressFormProps> = ({
  initialAddress = {},
  onAddressChange,
  onValidationChange,
  fieldPrefix = '',
  disabled = false,
  showAutocomplete = true,
  required = false,
  compact = false,
  label = 'Address'
}) => {
  const [useAutocomplete, setUseAutocomplete] = useState(showAutocomplete)
  const [isAutocompleteUsed, setIsAutocompleteUsed] = useState(false)

  const formik = useFormik({
    initialValues: {
      full_address: initialAddress.full_address || '',
      street_address: initialAddress.street_address || '',
      city: initialAddress.city || '',
      state: initialAddress.state || '',
      zip: initialAddress.zip || '',
      country: initialAddress.country || 'United States'
    },
    validationSchema: addressSchema,
    onSubmit: () => {}, // Not used, we handle changes in real-time
  })

  // Update parent component when address changes
  useEffect(() => {
    const address: FormattedAddress = {
      full_address: formatAddressString({
        street_address: formik.values.street_address,
        city: formik.values.city,
        state: formik.values.state,
        zip: formik.values.zip,
        country: formik.values.country
      }),
      street_address: formik.values.street_address,
      city: formik.values.city,
      state: formik.values.state,
      state_code: formik.values.state,
      zip: formik.values.zip,
      country: formik.values.country,
      country_code: formik.values.country === 'United States' ? 'US' : ''
    }

    onAddressChange(address)

    // Validate and notify parent of validation status
    if (onValidationChange) {
      const validation = validateAddress(address)
      onValidationChange(validation.isValid)
    }
  }, [formik.values, onAddressChange, onValidationChange])

  // Handle autocomplete selection
  const handleAutocompleteChange = (address: FormattedAddress) => {
    setIsAutocompleteUsed(true)
    formik.setValues({
      full_address: address.full_address,
      street_address: address.street_address,
      city: address.city,
      state: address.state,
      zip: address.zip,
      country: address.country || 'United States'
    })
  }

  // Handle manual address input change
  const handleManualInputChange = (field: string, value: string) => {
    setIsAutocompleteUsed(false)
    formik.setFieldValue(field, value)
  }

  const getFieldName = (field: string) => `${fieldPrefix}${field}`

  const renderManualFields = () => (
    <div className='row'>
      {/* Street Address */}
      <div className='col-12 mb-3'>
        <label className={clsx('form-label fw-semibold fs-6 mb-2', required && 'required')}>
          Street Address
        </label>
        <input
          type='text'
          className={clsx(
            'form-control form-control-solid',
            formik.touched.street_address && formik.errors.street_address && 'is-invalid',
            formik.touched.street_address && !formik.errors.street_address && 'is-valid'
          )}
          name={getFieldName('street_address')}
          value={formik.values.street_address}
          onChange={(e) => handleManualInputChange('street_address', e.target.value)}
          onBlur={formik.handleBlur}
          placeholder='Enter street address'
          disabled={disabled}
        />
        {formik.touched.street_address && formik.errors.street_address && (
          <div className='fv-plugins-message-container'>
            <span role='alert' className='text-danger'>{formik.errors.street_address}</span>
          </div>
        )}
      </div>

      {/* City, State, ZIP Row */}
      <div className='col-md-5 mb-3'>
        <label className={clsx('form-label fw-semibold fs-6 mb-2', required && 'required')}>
          City
        </label>
        <input
          type='text'
          className={clsx(
            'form-control form-control-solid',
            formik.touched.city && formik.errors.city && 'is-invalid',
            formik.touched.city && !formik.errors.city && 'is-valid'
          )}
          name={getFieldName('city')}
          value={formik.values.city}
          onChange={(e) => handleManualInputChange('city', e.target.value)}
          onBlur={formik.handleBlur}
          placeholder='Enter city'
          disabled={disabled}
        />
        {formik.touched.city && formik.errors.city && (
          <div className='fv-plugins-message-container'>
            <span role='alert' className='text-danger'>{formik.errors.city}</span>
          </div>
        )}
      </div>

      <div className='col-md-4 mb-3'>
        <label className={clsx('form-label fw-semibold fs-6 mb-2', required && 'required')}>
          State
        </label>
        <input
          type='text'
          className={clsx(
            'form-control form-control-solid',
            formik.touched.state && formik.errors.state && 'is-invalid',
            formik.touched.state && !formik.errors.state && 'is-valid'
          )}
          name={getFieldName('state')}
          value={formik.values.state}
          onChange={(e) => handleManualInputChange('state', e.target.value)}
          onBlur={formik.handleBlur}
          placeholder='State'
          disabled={disabled}
        />
        {formik.touched.state && formik.errors.state && (
          <div className='fv-plugins-message-container'>
            <span role='alert' className='text-danger'>{formik.errors.state}</span>
          </div>
        )}
      </div>

      <div className='col-md-3 mb-3'>
        <label className={clsx('form-label fw-semibold fs-6 mb-2', required && 'required')}>
          ZIP Code
        </label>
        <input
          type='text'
          className={clsx(
            'form-control form-control-solid',
            formik.touched.zip && formik.errors.zip && 'is-invalid',
            formik.touched.zip && !formik.errors.zip && 'is-valid'
          )}
          name={getFieldName('zip')}
          value={formik.values.zip}
          onChange={(e) => handleManualInputChange('zip', e.target.value)}
          onBlur={formik.handleBlur}
          placeholder='ZIP'
          disabled={disabled}
        />
        {formik.touched.zip && formik.errors.zip && (
          <div className='fv-plugins-message-container'>
            <span role='alert' className='text-danger'>{formik.errors.zip}</span>
          </div>
        )}
      </div>

      {/* Country (if not compact) */}
      {!compact && (
        <div className='col-md-6 mb-3'>
          <label className='form-label fw-semibold fs-6 mb-2'>Country</label>
          <select
            className='form-select form-select-solid'
            name={getFieldName('country')}
            value={formik.values.country}
            onChange={(e) => handleManualInputChange('country', e.target.value)}
            disabled={disabled}
          >
            <option value='United States'>United States</option>
            <option value='Canada'>Canada</option>
            <option value='Mexico'>Mexico</option>
            <option value='United Kingdom'>United Kingdom</option>
            <option value='Australia'>Australia</option>
            {/* Add more countries as needed */}
          </select>
        </div>
      )}
    </div>
  )

  return (
    <div className='address-form'>
      {label && (
        <h6 className='fw-bold text-gray-800 fs-6 mb-4'>{label}</h6>
      )}

      {showAutocomplete && useAutocomplete && (
        <div className='mb-4'>
          <AddressInput
            value={isAutocompleteUsed ? formik.values.full_address : ''}
            onChange={handleAutocompleteChange}
            placeholder='Start typing an address...'
            label='Search Address'
            disabled={disabled}
            required={required}
          />
          
          <div className='d-flex justify-content-end mt-2'>
            <button
              type='button'
              className='btn btn-link btn-sm text-muted'
              onClick={() => setUseAutocomplete(false)}
            >
              Enter address manually instead
            </button>
          </div>
        </div>
      )}

      {(!showAutocomplete || !useAutocomplete || isAutocompleteUsed) && (
        <div>
          {showAutocomplete && !useAutocomplete && (
            <div className='d-flex justify-content-between align-items-center mb-3'>
              <span className='text-muted fs-7'>Manual address entry</span>
              <button
                type='button'
                className='btn btn-link btn-sm'
                onClick={() => setUseAutocomplete(true)}
              >
                Use address lookup instead
              </button>
            </div>
          )}
          
          {renderManualFields()}
        </div>
      )}
    </div>
  )
}
