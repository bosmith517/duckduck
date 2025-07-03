import React, { useState } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import clsx from 'clsx'
import { useSupabaseAuth } from '../../../modules/auth/core/SupabaseAuth'
import { supabase } from '../../../../supabaseClient'
import { showToast } from '../../../utils/toast'
import { AddressInput } from '../../../components/shared/AddressInput'
import { FormattedAddress } from '../../../utils/addressUtils'

const companySchema = Yup.object().shape({
  name: Yup.string()
    .min(2, 'Minimum 2 characters')
    .max(100, 'Maximum 100 characters')
    .required('Company name is required'),
  website: Yup.string()
    .url('Invalid website URL'),
  phone: Yup.string()
    .matches(/^[\+]?[\d\s\-\(\)]+$/, 'Invalid phone number format'),
  email: Yup.string()
    .email('Invalid email format'),
  address_line1: Yup.string()
    .max(200, 'Maximum 200 characters'),
  city: Yup.string()
    .max(100, 'Maximum 100 characters'),
  state: Yup.string()
    .max(50, 'Maximum 50 characters'),
  zip_code: Yup.string()
    .max(20, 'Maximum 20 characters'),
  tax_id: Yup.string()
    .max(50, 'Maximum 50 characters'),
  business_license: Yup.string()
    .max(100, 'Maximum 100 characters')
})

export const CompanyInformation: React.FC = () => {
  const { tenant } = useSupabaseAuth()
  const [loading, setLoading] = useState(false)

  const formik = useFormik({
    initialValues: {
      name: tenant?.name || '',
      website: tenant?.website || '',
      phone: tenant?.phone || '',
      email: tenant?.email || '',
      address_line1: tenant?.address_line1 || '',
      address_line2: tenant?.address_line2 || '',
      city: tenant?.city || '',
      state: tenant?.state || '',
      zip_code: tenant?.zip_code || '',
      tax_id: tenant?.tax_id || '',
      business_license: tenant?.business_license || '',
      description: tenant?.description || ''
    },
    validationSchema: companySchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      if (!tenant?.id) return

      setLoading(true)
      const loadingToast = showToast.loading('Updating company information...')

      try {
        const { error } = await supabase
          .from('tenants')
          .update({
            name: values.name,
            website: values.website,
            phone: values.phone,
            email: values.email,
            address_line1: values.address_line1,
            address_line2: values.address_line2,
            city: values.city,
            state: values.state,
            zip_code: values.zip_code,
            tax_id: values.tax_id,
            business_license: values.business_license,
            description: values.description,
            updated_at: new Date().toISOString()
          })
          .eq('id', tenant.id)

        if (error) throw error

        showToast.dismiss(loadingToast)
        showToast.success('Company information updated successfully!')

      } catch (error: any) {
        console.error('Error updating company:', error)
        showToast.dismiss(loadingToast)
        showToast.error(error.message || 'Failed to update company information')
      } finally {
        setLoading(false)
      }
    }
  })

  const handleAddressChange = (address: FormattedAddress) => {
    formik.setFieldValue('address_line1', address.street_address)
    formik.setFieldValue('city', address.city)
    formik.setFieldValue('state', address.state)
    formik.setFieldValue('zip_code', address.zip)
  }

  if (!tenant) {
    return (
      <div className='card'>
        <div className='card-body'>
          <div className='text-center'>
            <h3>No Company Information Available</h3>
            <p className='text-muted'>Please contact your administrator to set up company information.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='card'>
      <div className='card-header border-0 cursor-pointer'>
        <div className='card-title m-0'>
          <h3 className='fw-bolder m-0'>Company Information</h3>
        </div>
      </div>

      <div className='card-body border-top p-9'>
        <form onSubmit={formik.handleSubmit} noValidate className='form'>
          {/* Basic Company Info */}
          <div className='row mb-6'>
            <div className='col-lg-6'>
              <label className='required fw-bold fs-6 mb-2'>Company Name</label>
              <input
                type='text'
                className={clsx(
                  'form-control form-control-solid mb-3 mb-lg-0',
                  {'is-invalid': formik.touched.name && formik.errors.name},
                  {'is-valid': formik.touched.name && !formik.errors.name}
                )}
                placeholder='Company name'
                {...formik.getFieldProps('name')}
              />
              {formik.touched.name && formik.errors.name && (
                <div className='fv-plugins-message-container'>
                  <span role='alert'>{formik.errors.name}</span>
                </div>
              )}
            </div>

            <div className='col-lg-6'>
              <label className='fw-bold fs-6 mb-2'>Website</label>
              <input
                type='url'
                className={clsx(
                  'form-control form-control-solid',
                  {'is-invalid': formik.touched.website && formik.errors.website},
                  {'is-valid': formik.touched.website && !formik.errors.website}
                )}
                placeholder='https://yourcompany.com'
                {...formik.getFieldProps('website')}
              />
              {formik.touched.website && formik.errors.website && (
                <div className='fv-plugins-message-container'>
                  <span role='alert'>{formik.errors.website}</span>
                </div>
              )}
            </div>
          </div>

          {/* Contact Information */}
          <div className='row mb-6'>
            <div className='col-lg-6'>
              <label className='fw-bold fs-6 mb-2'>Phone Number</label>
              <input
                type='text'
                className={clsx(
                  'form-control form-control-solid',
                  {'is-invalid': formik.touched.phone && formik.errors.phone},
                  {'is-valid': formik.touched.phone && !formik.errors.phone}
                )}
                placeholder='Company phone number'
                {...formik.getFieldProps('phone')}
              />
              {formik.touched.phone && formik.errors.phone && (
                <div className='fv-plugins-message-container'>
                  <span role='alert'>{formik.errors.phone}</span>
                </div>
              )}
            </div>

            <div className='col-lg-6'>
              <label className='fw-bold fs-6 mb-2'>Email</label>
              <input
                type='email'
                className={clsx(
                  'form-control form-control-solid',
                  {'is-invalid': formik.touched.email && formik.errors.email},
                  {'is-valid': formik.touched.email && !formik.errors.email}
                )}
                placeholder='Company email address'
                {...formik.getFieldProps('email')}
              />
              {formik.touched.email && formik.errors.email && (
                <div className='fv-plugins-message-container'>
                  <span role='alert'>{formik.errors.email}</span>
                </div>
              )}
            </div>
          </div>

          {/* Address with Autocomplete */}
          <div className='row mb-6'>
            <div className='col-lg-12'>
              <AddressInput
                value={formik.values.address_line1}
                onChange={handleAddressChange}
                onInputChange={(value) => formik.setFieldValue('address_line1', value)}
                label='Business Address'
                placeholder='Enter business address...'
                error={formik.touched.address_line1 && formik.errors.address_line1 ? formik.errors.address_line1 : undefined}
              />
            </div>
          </div>

          {/* Address Details */}
          <div className='row mb-6'>
            <div className='col-lg-12'>
              <label className='fw-bold fs-6 mb-2'>Address Line 2</label>
              <input
                type='text'
                className='form-control form-control-solid'
                placeholder='Suite, unit, building, floor, etc.'
                {...formik.getFieldProps('address_line2')}
              />
            </div>
          </div>

          <div className='row mb-6'>
            <div className='col-lg-5'>
              <label className='fw-bold fs-6 mb-2'>City</label>
              <input
                type='text'
                className='form-control form-control-solid'
                placeholder='City (auto-filled)'
                value={formik.values.city}
                onChange={(e) => formik.setFieldValue('city', e.target.value)}
              />
            </div>

            <div className='col-lg-4'>
              <label className='fw-bold fs-6 mb-2'>State</label>
              <input
                type='text'
                className='form-control form-control-solid'
                placeholder='State (auto-filled)'
                value={formik.values.state}
                onChange={(e) => formik.setFieldValue('state', e.target.value)}
              />
            </div>

            <div className='col-lg-3'>
              <label className='fw-bold fs-6 mb-2'>ZIP Code</label>
              <input
                type='text'
                className='form-control form-control-solid'
                placeholder='ZIP (auto-filled)'
                value={formik.values.zip_code}
                onChange={(e) => formik.setFieldValue('zip_code', e.target.value)}
              />
            </div>
          </div>

          {/* Business Details */}
          <div className='row mb-6'>
            <div className='col-lg-6'>
              <label className='fw-bold fs-6 mb-2'>Tax ID / EIN</label>
              <input
                type='text'
                className={clsx(
                  'form-control form-control-solid',
                  {'is-invalid': formik.touched.tax_id && formik.errors.tax_id},
                  {'is-valid': formik.touched.tax_id && !formik.errors.tax_id}
                )}
                placeholder='Tax ID or EIN'
                {...formik.getFieldProps('tax_id')}
              />
              {formik.touched.tax_id && formik.errors.tax_id && (
                <div className='fv-plugins-message-container'>
                  <span role='alert'>{formik.errors.tax_id}</span>
                </div>
              )}
            </div>

            <div className='col-lg-6'>
              <label className='fw-bold fs-6 mb-2'>Business License</label>
              <input
                type='text'
                className={clsx(
                  'form-control form-control-solid',
                  {'is-invalid': formik.touched.business_license && formik.errors.business_license},
                  {'is-valid': formik.touched.business_license && !formik.errors.business_license}
                )}
                placeholder='Business license number'
                {...formik.getFieldProps('business_license')}
              />
              {formik.touched.business_license && formik.errors.business_license && (
                <div className='fv-plugins-message-container'>
                  <span role='alert'>{formik.errors.business_license}</span>
                </div>
              )}
            </div>
          </div>

          {/* Company Description */}
          <div className='row mb-6'>
            <div className='col-lg-12'>
              <label className='fw-bold fs-6 mb-2'>Company Description</label>
              <textarea
                className='form-control form-control-solid'
                rows={4}
                placeholder='Brief description of your company and services'
                {...formik.getFieldProps('description')}
              />
            </div>
          </div>

          <div className='card-footer d-flex justify-content-end py-6 px-9'>
            <button
              type='reset'
              className='btn btn-light btn-active-light-primary me-2'
              onClick={() => formik.resetForm()}
            >
              Reset
            </button>
            <button
              type='submit'
              className='btn btn-primary'
              disabled={loading}
            >
              {loading && <span className='spinner-border spinner-border-sm align-middle me-2'></span>}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}