import React, { useState } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import clsx from 'clsx'
import { InvoiceWithDetails } from '../../../services/invoicesService'

interface PaymentFormProps {
  invoice: InvoiceWithDetails
  onSave: (paymentAmount: number, paymentDate: string) => Promise<void>
  onCancel: () => void
}

const paymentSchema = Yup.object().shape({
  paymentAmount: Yup.number()
    .min(0.01, 'Payment amount must be greater than 0')
    .max(Yup.ref('maxAmount'), 'Payment amount cannot exceed the outstanding balance')
    .required('Payment amount is required'),
  paymentDate: Yup.date()
    .max(new Date(), 'Payment date cannot be in the future')
    .required('Payment date is required'),
  paymentMethod: Yup.string()
    .oneOf(['cash', 'check', 'credit_card', 'bank_transfer', 'other'])
    .required('Payment method is required'),
  notes: Yup.string()
    .max(500, 'Maximum 500 characters'),
})

export const PaymentForm: React.FC<PaymentFormProps> = ({ 
  invoice, 
  onSave, 
  onCancel 
}) => {
  const [loading, setLoading] = useState(false)

  const outstandingBalance = invoice.total_amount - (invoice.paid_amount || 0)

  const formik = useFormik({
    initialValues: {
      paymentAmount: outstandingBalance,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'check',
      notes: '',
      maxAmount: outstandingBalance,
    },
    validationSchema: paymentSchema,
    onSubmit: async (values) => {
      setLoading(true)
      try {
        await onSave(values.paymentAmount, values.paymentDate)
      } catch (error) {
        console.error('Error recording payment:', error)
      } finally {
        setLoading(false)
      }
    },
  })

  const getPaymentMethodLabel = (method: string) => {
    const labels = {
      'cash': 'Cash',
      'check': 'Check',
      'credit_card': 'Credit Card',
      'bank_transfer': 'Bank Transfer',
      'other': 'Other'
    }
    return labels[method as keyof typeof labels] || method
  }

  return (
    <div className='modal fade show d-block' tabIndex={-1} role='dialog'>
      <div className='modal-dialog modal-dialog-centered modal-lg' role='document'>
        <div className='modal-content'>
          <div className='modal-header'>
            <h5 className='modal-title'>Record Payment</h5>
            <button
              type='button'
              className='btn-close'
              onClick={onCancel}
              aria-label='Close'
            ></button>
          </div>

          <form onSubmit={formik.handleSubmit} noValidate>
            <div className='modal-body'>
              {/* Invoice Summary */}
              <div className='card card-bordered mb-7'>
                <div className='card-header'>
                  <h6 className='card-title'>Invoice Summary</h6>
                </div>
                <div className='card-body'>
                  <div className='row'>
                    <div className='col-md-6'>
                      <div className='d-flex flex-column mb-4'>
                        <span className='text-muted fw-semibold fs-7'>Invoice Number</span>
                        <span className='fw-bold fs-6'>{invoice.invoice_number}</span>
                      </div>
                      <div className='d-flex flex-column mb-4'>
                        <span className='text-muted fw-semibold fs-7'>Client</span>
                        <span className='fw-bold fs-6'>{invoice.accounts?.name || 'Unknown Client'}</span>
                      </div>
                    </div>
                    <div className='col-md-6'>
                      <div className='d-flex flex-column mb-4'>
                        <span className='text-muted fw-semibold fs-7'>Total Amount</span>
                        <span className='fw-bold fs-6'>${invoice.total_amount.toLocaleString()}</span>
                      </div>
                      <div className='d-flex flex-column mb-4'>
                        <span className='text-muted fw-semibold fs-7'>Previously Paid</span>
                        <span className='fw-bold fs-6'>${(invoice.paid_amount || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className='separator separator-dashed my-4'></div>
                  <div className='d-flex justify-content-between align-items-center'>
                    <span className='text-muted fw-semibold fs-6'>Outstanding Balance:</span>
                    <span className='fw-bold fs-4 text-danger'>${outstandingBalance.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className='row'>
                {/* Payment Amount */}
                <div className='col-md-6 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>Payment Amount</label>
                  <div className='input-group'>
                    <span className='input-group-text'>$</span>
                    <input
                      type='number'
                      step='0.01'
                      min='0'
                      max={outstandingBalance}
                      className={clsx(
                        'form-control form-control-solid',
                        {'is-invalid': formik.touched.paymentAmount && formik.errors.paymentAmount},
                        {'is-valid': formik.touched.paymentAmount && !formik.errors.paymentAmount}
                      )}
                      placeholder='0.00'
                      {...formik.getFieldProps('paymentAmount')}
                    />
                  </div>
                  {formik.touched.paymentAmount && formik.errors.paymentAmount && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.paymentAmount}</span>
                    </div>
                  )}
                  <div className='form-text text-muted'>
                    Maximum: ${outstandingBalance.toLocaleString()}
                  </div>
                </div>

                {/* Payment Date */}
                <div className='col-md-6 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>Payment Date</label>
                  <input
                    type='date'
                    className={clsx(
                      'form-control form-control-solid',
                      {'is-invalid': formik.touched.paymentDate && formik.errors.paymentDate},
                      {'is-valid': formik.touched.paymentDate && !formik.errors.paymentDate}
                    )}
                    {...formik.getFieldProps('paymentDate')}
                  />
                  {formik.touched.paymentDate && formik.errors.paymentDate && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.paymentDate}</span>
                    </div>
                  )}
                </div>

                {/* Payment Method */}
                <div className='col-md-6 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>Payment Method</label>
                  <select
                    className={clsx(
                      'form-select form-select-solid',
                      {'is-invalid': formik.touched.paymentMethod && formik.errors.paymentMethod},
                      {'is-valid': formik.touched.paymentMethod && !formik.errors.paymentMethod}
                    )}
                    {...formik.getFieldProps('paymentMethod')}
                  >
                    <option value='check'>Check</option>
                    <option value='cash'>Cash</option>
                    <option value='credit_card'>Credit Card</option>
                    <option value='bank_transfer'>Bank Transfer</option>
                    <option value='other'>Other</option>
                  </select>
                  {formik.touched.paymentMethod && formik.errors.paymentMethod && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.paymentMethod}</span>
                    </div>
                  )}
                </div>

                {/* Quick Amount Buttons */}
                <div className='col-md-6 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Quick Amount</label>
                  <div className='d-flex flex-wrap gap-2'>
                    <button
                      type='button'
                      className='btn btn-sm btn-light-primary'
                      onClick={() => formik.setFieldValue('paymentAmount', outstandingBalance)}
                    >
                      Full Amount
                    </button>
                    <button
                      type='button'
                      className='btn btn-sm btn-light-info'
                      onClick={() => formik.setFieldValue('paymentAmount', outstandingBalance / 2)}
                    >
                      50%
                    </button>
                    <button
                      type='button'
                      className='btn btn-sm btn-light-warning'
                      onClick={() => formik.setFieldValue('paymentAmount', outstandingBalance / 4)}
                    >
                      25%
                    </button>
                  </div>
                  <div className='form-text text-muted'>
                    Click to quickly set common payment amounts
                  </div>
                </div>

                {/* Notes */}
                <div className='col-md-12 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Notes (Optional)</label>
                  <textarea
                    className={clsx(
                      'form-control form-control-solid',
                      {'is-invalid': formik.touched.notes && formik.errors.notes},
                      {'is-valid': formik.touched.notes && !formik.errors.notes}
                    )}
                    rows={3}
                    placeholder='Enter payment notes or reference information'
                    {...formik.getFieldProps('notes')}
                  />
                  {formik.touched.notes && formik.errors.notes && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.notes}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Summary */}
              {formik.values.paymentAmount > 0 && (
                <div className='card card-bordered bg-light-success'>
                  <div className='card-body'>
                    <h6 className='card-title text-success'>Payment Summary</h6>
                    <div className='row'>
                      <div className='col-md-6'>
                        <div className='d-flex justify-content-between mb-2'>
                          <span className='text-muted'>Payment Amount:</span>
                          <span className='fw-bold'>${formik.values.paymentAmount.toLocaleString()}</span>
                        </div>
                        <div className='d-flex justify-content-between mb-2'>
                          <span className='text-muted'>Payment Method:</span>
                          <span className='fw-bold'>{getPaymentMethodLabel(formik.values.paymentMethod)}</span>
                        </div>
                      </div>
                      <div className='col-md-6'>
                        <div className='d-flex justify-content-between mb-2'>
                          <span className='text-muted'>Remaining Balance:</span>
                          <span className='fw-bold'>
                            ${(outstandingBalance - formik.values.paymentAmount).toLocaleString()}
                          </span>
                        </div>
                        <div className='d-flex justify-content-between'>
                          <span className='text-muted'>New Status:</span>
                          <span className='fw-bold'>
                            {(outstandingBalance - formik.values.paymentAmount) <= 0 ? 'Paid' : 'Partial'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
                className='btn btn-success'
                disabled={loading || !formik.isValid || formik.values.paymentAmount <= 0}
              >
                {loading ? (
                  <>
                    <span className='spinner-border spinner-border-sm align-middle me-2'></span>
                    Recording...
                  </>
                ) : (
                  <>
                    <i className='ki-duotone ki-check fs-2 me-2'></i>
                    Record Payment
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
