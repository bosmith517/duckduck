import React, { useState, useEffect } from 'react'
import { useFormik, FieldArray, FormikProvider, useFormikContext } from 'formik'
import * as Yup from 'yup'
import clsx from 'clsx'
import { EstimateWithAccount } from '../../../services/estimatesService'

interface LineItem {
  id?: string
  description: string
  quantity: number
  unit_price: number
}

interface EstimateFormValues {
  client: string
  projectTitle: string
  description: string
  status: string
  lineItems: LineItem[]
  totalAmount: number
  validUntil: string
  notes: string
}

interface EstimateFormProps {
  estimate?: EstimateWithAccount | null
  onSave: (data: any) => void
  onCancel: () => void
}

const lineItemSchema = Yup.object().shape({
  description: Yup.string()
    .min(2, 'Minimum 2 characters')
    .max(200, 'Maximum 200 characters')
    .required('Description is required'),
  quantity: Yup.number()
    .min(0.01, 'Quantity must be greater than 0')
    .max(9999, 'Maximum 9999')
    .required('Quantity is required'),
  unit_price: Yup.number()
    .min(0, 'Price must be positive')
    .max(999999, 'Maximum $999,999')
    .required('Unit price is required'),
})

const estimateSchema = Yup.object().shape({
  client: Yup.string()
    .min(2, 'Minimum 2 characters')
    .max(100, 'Maximum 100 characters')
    .required('Client name is required'),
  projectTitle: Yup.string()
    .min(2, 'Minimum 2 characters')
    .max(200, 'Maximum 200 characters')
    .required('Project title is required'),
  description: Yup.string()
    .max(1000, 'Maximum 1000 characters')
    .required('Description is required'),
  status: Yup.string()
    .oneOf(['draft', 'sent', 'approved', 'rejected', 'expired'])
    .required('Status is required'),
  lineItems: Yup.array()
    .of(lineItemSchema)
    .min(1, 'At least one line item is required'),
  totalAmount: Yup.number()
    .min(0, 'Amount must be positive'),
  validUntil: Yup.date()
    .min(new Date(), 'Valid until date must be in the future')
    .required('Valid until date is required'),
  notes: Yup.string().max(1000, 'Maximum 1000 characters'),
})

// Component to handle auto-calculation
const TotalCalculator: React.FC = () => {
  const { values, setFieldValue } = useFormikContext<EstimateFormValues>()

  useEffect(() => {
    const total = values.lineItems.reduce((sum, item) => {
      return sum + (item.quantity * item.unit_price)
    }, 0)
    setFieldValue('totalAmount', total)
  }, [values.lineItems, setFieldValue])

  return null
}

export const EstimateForm: React.FC<EstimateFormProps> = ({ estimate, onSave, onCancel }) => {
  const [loading, setLoading] = useState(false)

  const formik = useFormik<EstimateFormValues>({
    initialValues: {
      client: estimate?.accounts?.name || '',
      projectTitle: estimate?.project_title || '',
      description: estimate?.description || '',
      status: estimate?.status || 'draft',
      lineItems: [
        { description: '', quantity: 1, unit_price: 0 }
      ],
      totalAmount: 0,
      validUntil: estimate?.valid_until ? estimate.valid_until.split('T')[0] : '',
      notes: estimate?.notes || '',
    },
    validationSchema: estimateSchema,
    onSubmit: async (values) => {
      setLoading(true)
      try {
        const submitData = {
          project_title: values.projectTitle,
          description: values.description,
          status: values.status,
          total_amount: values.totalAmount,
          valid_until: values.validUntil,
          notes: values.notes,
          lineItems: values.lineItems,
        }
        await onSave(submitData)
      } catch (error) {
        console.error('Error saving estimate:', error)
      } finally {
        setLoading(false)
      }
    },
  })

  return (
    <div className='modal fade show d-block' tabIndex={-1} role='dialog'>
      <div className='modal-dialog modal-dialog-centered modal-xl' role='document'>
        <div className='modal-content'>
          <div className='modal-header'>
            <h5 className='modal-title'>
              {estimate ? 'Edit Estimate' : 'Create New Estimate'}
            </h5>
            <button
              type='button'
              className='btn-close'
              onClick={onCancel}
              aria-label='Close'
            ></button>
          </div>

          <form onSubmit={formik.handleSubmit} noValidate>
            <div className='modal-body'>
              <div className='row'>
                {/* Client */}
                <div className='col-md-6 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>Client</label>
                  <input
                    type='text'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.client && formik.errors.client},
                      {'is-valid': formik.touched.client && !formik.errors.client}
                    )}
                    placeholder='Enter client name'
                    {...formik.getFieldProps('client')}
                    disabled={!!estimate} // Disable if editing existing estimate
                  />
                  {formik.touched.client && formik.errors.client && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.client}</span>
                    </div>
                  )}
                </div>

                {/* Status */}
                <div className='col-md-6 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>Status</label>
                  <select
                    className={clsx(
                      'form-select form-select-solid',
                      {'is-invalid': formik.touched.status && formik.errors.status},
                      {'is-valid': formik.touched.status && !formik.errors.status}
                    )}
                    {...formik.getFieldProps('status')}
                  >
                    <option value='draft'>Draft</option>
                    <option value='sent'>Sent</option>
                    <option value='approved'>Approved</option>
                    <option value='rejected'>Rejected</option>
                    <option value='expired'>Expired</option>
                  </select>
                  {formik.touched.status && formik.errors.status && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.status}</span>
                    </div>
                  )}
                </div>

                {/* Project Title */}
                <div className='col-md-12 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>Project Title</label>
                  <input
                    type='text'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.projectTitle && formik.errors.projectTitle},
                      {'is-valid': formik.touched.projectTitle && !formik.errors.projectTitle}
                    )}
                    placeholder='Enter project title'
                    {...formik.getFieldProps('projectTitle')}
                  />
                  {formik.touched.projectTitle && formik.errors.projectTitle && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.projectTitle}</span>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div className='col-md-12 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>Description</label>
                  <textarea
                    className={clsx(
                      'form-control form-control-solid',
                      {'is-invalid': formik.touched.description && formik.errors.description},
                      {'is-valid': formik.touched.description && !formik.errors.description}
                    )}
                    rows={4}
                    placeholder='Enter project description'
                    {...formik.getFieldProps('description')}
                  />
                  {formik.touched.description && formik.errors.description && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.description}</span>
                    </div>
                  )}
                </div>

                {/* Line Items Section */}
                <div className='col-md-12 mb-7'>
                  <FormikProvider value={formik}>
                    <TotalCalculator />
                    <div className='card card-bordered'>
                      <div className='card-header'>
                        <h6 className='card-title'>Line Items</h6>
                        <div className='card-toolbar'>
                          <span className='text-muted fs-7'>
                            {formik.values.lineItems.length} item{formik.values.lineItems.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <div className='card-body'>
                        <FieldArray name='lineItems'>
                          {({ push, remove }) => (
                            <div>
                              {formik.values.lineItems.map((item, index) => (
                                <div key={index} className='row align-items-end mb-4 border-bottom pb-4'>
                                  {/* Description */}
                                  <div className='col-md-5'>
                                    <label className='required fw-semibold fs-6 mb-2'>Description</label>
                                    <input
                                      type='text'
                                      className={clsx(
                                        'form-control form-control-solid',
                                        {
                                          'is-invalid': formik.touched.lineItems?.[index]?.description && 
                                                        formik.errors.lineItems?.[index] && 
                                                        typeof formik.errors.lineItems[index] === 'object' && 
                                                        'description' in formik.errors.lineItems[index]
                                        }
                                      )}
                                      placeholder='Enter item description'
                                      {...formik.getFieldProps(`lineItems.${index}.description`)}
                                    />
                                  </div>

                                  {/* Quantity */}
                                  <div className='col-md-2'>
                                    <label className='required fw-semibold fs-6 mb-2'>Qty</label>
                                    <input
                                      type='number'
                                      step='0.01'
                                      min='0'
                                      className={clsx(
                                        'form-control form-control-solid',
                                        {
                                          'is-invalid': formik.touched.lineItems?.[index]?.quantity && 
                                                        formik.errors.lineItems?.[index] && 
                                                        typeof formik.errors.lineItems[index] === 'object' && 
                                                        'quantity' in formik.errors.lineItems[index]
                                        }
                                      )}
                                      placeholder='1'
                                      {...formik.getFieldProps(`lineItems.${index}.quantity`)}
                                    />
                                  </div>

                                  {/* Unit Price */}
                                  <div className='col-md-2'>
                                    <label className='required fw-semibold fs-6 mb-2'>Unit Price</label>
                                    <div className='input-group'>
                                      <span className='input-group-text'>$</span>
                                      <input
                                        type='number'
                                        step='0.01'
                                        min='0'
                                        className={clsx(
                                          'form-control form-control-solid',
                                          {
                                            'is-invalid': formik.touched.lineItems?.[index]?.unit_price && 
                                                          formik.errors.lineItems?.[index] && 
                                                          typeof formik.errors.lineItems[index] === 'object' && 
                                                          'unit_price' in formik.errors.lineItems[index]
                                          }
                                        )}
                                        placeholder='0.00'
                                        {...formik.getFieldProps(`lineItems.${index}.unit_price`)}
                                      />
                                    </div>
                                  </div>

                                  {/* Total */}
                                  <div className='col-md-2'>
                                    <label className='fw-semibold fs-6 mb-2'>Total</label>
                                    <div className='form-control form-control-solid bg-light'>
                                      ${(item.quantity * item.unit_price).toFixed(2)}
                                    </div>
                                  </div>

                                  {/* Remove Button */}
                                  <div className='col-md-1'>
                                    <button
                                      type='button'
                                      className='btn btn-icon btn-bg-light btn-active-color-danger btn-sm'
                                      onClick={() => remove(index)}
                                      disabled={formik.values.lineItems.length === 1}
                                      title='Remove item'
                                    >
                                      <i className='ki-duotone ki-trash fs-3'>
                                        <span className='path1'></span>
                                        <span className='path2'></span>
                                        <span className='path3'></span>
                                        <span className='path4'></span>
                                        <span className='path5'></span>
                                      </i>
                                    </button>
                                  </div>
                                </div>
                              ))}

                              {/* Add Line Item Button */}
                              <div className='d-flex justify-content-center mt-4'>
                                <button
                                  type='button'
                                  className='btn btn-light-primary'
                                  onClick={() => push({ description: '', quantity: 1, unit_price: 0 })}
                                >
                                  <i className='ki-duotone ki-plus fs-2'></i>
                                  Add Line Item
                                </button>
                              </div>
                            </div>
                          )}
                        </FieldArray>

                        {/* Line Items Validation Error */}
                        {formik.touched.lineItems && formik.errors.lineItems && typeof formik.errors.lineItems === 'string' && (
                          <div className='fv-plugins-message-container mt-3'>
                            <span role='alert' className='text-danger'>{formik.errors.lineItems}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </FormikProvider>
                </div>

                {/* Total Amount (Read-only) */}
                <div className='col-md-6 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Total Amount</label>
                  <div className='input-group'>
                    <span className='input-group-text'>$</span>
                    <input
                      type='text'
                      className='form-control form-control-solid bg-light'
                      value={formik.values.totalAmount.toFixed(2)}
                      readOnly
                    />
                  </div>
                  <div className='form-text text-muted'>
                    Automatically calculated from line items
                  </div>
                </div>

                {/* Valid Until */}
                <div className='col-md-6 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>Valid Until</label>
                  <input
                    type='date'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.validUntil && formik.errors.validUntil},
                      {'is-valid': formik.touched.validUntil && !formik.errors.validUntil}
                    )}
                    {...formik.getFieldProps('validUntil')}
                  />
                  {formik.touched.validUntil && formik.errors.validUntil && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.validUntil}</span>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className='col-md-12 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Notes</label>
                  <textarea
                    className={clsx(
                      'form-control form-control-solid',
                      {'is-invalid': formik.touched.notes && formik.errors.notes},
                      {'is-valid': formik.touched.notes && !formik.errors.notes}
                    )}
                    rows={3}
                    placeholder='Enter additional notes'
                    {...formik.getFieldProps('notes')}
                  />
                  {formik.touched.notes && formik.errors.notes && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className='modal-footer'>
              <button
                type='button'
                className='btn btn-light'
                onClick={onCancel}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type='submit'
                className='btn btn-primary'
                disabled={loading || !formik.isValid}
              >
                {loading ? (
                  <>
                    <span className='spinner-border spinner-border-sm align-middle me-2'></span>
                    Saving...
                  </>
                ) : (
                  <>Save Estimate</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
