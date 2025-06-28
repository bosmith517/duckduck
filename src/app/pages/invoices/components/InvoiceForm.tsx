import React, { useState, useEffect } from 'react'
import { useFormik, FieldArray, FormikProvider, useFormikContext } from 'formik'
import * as Yup from 'yup'
import clsx from 'clsx'
import { InvoiceWithDetails } from '../../../services/invoicesService'

interface LineItem {
  id?: string
  description: string
  quantity: number
  unit_price: number
}

interface InvoiceFormValues {
  client: string
  jobTitle: string
  description: string
  status: string
  lineItems: LineItem[]
  totalAmount: number
  dueDate: string
  issueDate: string
  notes: string
}

interface InvoiceFormProps {
  invoice?: InvoiceWithDetails | null
  accounts: Array<{ id: string; name: string }>
  jobs: Array<{ id: string; title: string; job_number: string }>
  onSave: (data: any) => Promise<void>
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

const invoiceSchema = Yup.object().shape({
  client: Yup.string()
    .required('Client is required'),
  description: Yup.string()
    .max(1000, 'Maximum 1000 characters')
    .required('Description is required'),
  status: Yup.string()
    .oneOf(['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled'])
    .required('Status is required'),
  lineItems: Yup.array()
    .of(lineItemSchema)
    .min(1, 'At least one line item is required'),
  totalAmount: Yup.number()
    .min(0, 'Amount must be positive'),
  dueDate: Yup.date()
    .min(new Date(), 'Due date must be in the future')
    .required('Due date is required'),
  issueDate: Yup.date()
    .required('Issue date is required'),
})

// Component to handle auto-calculation
const TotalCalculator: React.FC = () => {
  const { values, setFieldValue } = useFormikContext<InvoiceFormValues>()

  useEffect(() => {
    const total = values.lineItems.reduce((sum, item) => {
      return sum + (item.quantity * item.unit_price)
    }, 0)
    setFieldValue('totalAmount', total)
  }, [values.lineItems, setFieldValue])

  return null
}

export const InvoiceForm: React.FC<InvoiceFormProps> = ({ 
  invoice, 
  accounts, 
  jobs, 
  onSave, 
  onCancel 
}) => {
  const [loading, setLoading] = useState(false)

  const formik = useFormik<InvoiceFormValues>({
    initialValues: {
      client: invoice?.account_id || '',
      jobTitle: invoice?.job_id || '',
      description: invoice?.description || '',
      status: invoice?.status || 'draft',
      lineItems: invoice?.invoice_items?.map(item => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
      })) || [{ description: '', quantity: 1, unit_price: 0 }],
      totalAmount: invoice?.total_amount || 0,
      dueDate: invoice?.due_date ? invoice.due_date.split('T')[0] : '',
      issueDate: invoice?.issue_date ? invoice.issue_date.split('T')[0] : new Date().toISOString().split('T')[0],
      notes: '',
    },
    validationSchema: invoiceSchema,
    onSubmit: async (values) => {
      setLoading(true)
      try {
        const submitData = {
          account_id: values.client,
          job_id: values.jobTitle || undefined,
          description: values.description,
          status: values.status,
          total_amount: values.totalAmount,
          due_date: values.dueDate,
          issue_date: values.issueDate,
          lineItems: values.lineItems,
        }
        await onSave(submitData)
      } catch (error) {
        console.error('Error saving invoice:', error)
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
              {invoice ? 'Edit Invoice' : 'Create New Invoice'}
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
                  <select
                    className={clsx(
                      'form-select form-select-solid',
                      {'is-invalid': formik.touched.client && formik.errors.client},
                      {'is-valid': formik.touched.client && !formik.errors.client}
                    )}
                    {...formik.getFieldProps('client')}
                  >
                    <option value=''>Select a client</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                  {formik.touched.client && formik.errors.client && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.client}</span>
                    </div>
                  )}
                </div>

                {/* Job (Optional) */}
                <div className='col-md-6 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Job (Optional)</label>
                  <select
                    className={clsx(
                      'form-select form-select-solid',
                      {'is-invalid': formik.touched.jobTitle && formik.errors.jobTitle},
                      {'is-valid': formik.touched.jobTitle && !formik.errors.jobTitle}
                    )}
                    {...formik.getFieldProps('jobTitle')}
                  >
                    <option value=''>Select a job (optional)</option>
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.job_number} - {job.title}
                      </option>
                    ))}
                  </select>
                  {formik.touched.jobTitle && formik.errors.jobTitle && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.jobTitle}</span>
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
                    <option value='partial'>Partial</option>
                    <option value='paid'>Paid</option>
                    <option value='overdue'>Overdue</option>
                    <option value='cancelled'>Cancelled</option>
                  </select>
                  {formik.touched.status && formik.errors.status && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.status}</span>
                    </div>
                  )}
                </div>

                {/* Issue Date */}
                <div className='col-md-6 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>Issue Date</label>
                  <input
                    type='date'
                    className={clsx(
                      'form-control form-control-solid',
                      {'is-invalid': formik.touched.issueDate && formik.errors.issueDate},
                      {'is-valid': formik.touched.issueDate && !formik.errors.issueDate}
                    )}
                    {...formik.getFieldProps('issueDate')}
                  />
                  {formik.touched.issueDate && formik.errors.issueDate && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.issueDate}</span>
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
                    rows={3}
                    placeholder='Enter invoice description'
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
                        <h6 className='card-title'>Invoice Items</h6>
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
                                      className='form-control form-control-solid'
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
                                      className='form-control form-control-solid'
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
                                        className='form-control form-control-solid'
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

                {/* Due Date */}
                <div className='col-md-6 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>Due Date</label>
                  <input
                    type='date'
                    className={clsx(
                      'form-control form-control-solid',
                      {'is-invalid': formik.touched.dueDate && formik.errors.dueDate},
                      {'is-valid': formik.touched.dueDate && !formik.errors.dueDate}
                    )}
                    {...formik.getFieldProps('dueDate')}
                  />
                  {formik.touched.dueDate && formik.errors.dueDate && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.dueDate}</span>
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
                  <>Save Invoice</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
