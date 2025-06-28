import React, { useState, useEffect } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'
import { invoicesService, InvoiceWithDetails } from '../../services/invoicesService'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { InvoiceForm } from './components/InvoiceForm'
import { PaymentForm } from './components/PaymentForm'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'
import { TableSkeleton, StatCardSkeleton } from '../../components/shared/skeletons/TableSkeleton'

const InvoicesPage: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  const [invoices, setInvoices] = useState<InvoiceWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  
  // Modal states
  const [showInvoiceForm, setShowInvoiceForm] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<InvoiceWithDetails | null>(null)
  const [paymentInvoice, setPaymentInvoice] = useState<InvoiceWithDetails | null>(null)
  
  // Form data
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([])
  const [jobs, setJobs] = useState<Array<{ id: string; title: string; job_number: string }>>([])

  useEffect(() => {
    if (userProfile?.tenant_id) {
      fetchInvoices()
      fetchAccounts()
      fetchJobs()
    }
  }, [userProfile?.tenant_id, searchTerm, statusFilter])

  const fetchInvoices = async () => {
    try {
      setLoading(true)
      const data = await invoicesService.getInvoices(searchTerm, statusFilter)
      setInvoices(data)
    } catch (error) {
      console.error('Error fetching invoices:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('id, name')
        .order('name', { ascending: true })

      if (error) throw error
      setAccounts(data || [])
    } catch (error) {
      console.error('Error fetching accounts:', error)
    }
  }

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, job_number')
        .order('created_at', { ascending: false })

      if (error) throw error
      setJobs(data || [])
    } catch (error) {
      console.error('Error fetching jobs:', error)
    }
  }

  const handleNewInvoice = () => {
    setEditingInvoice(null)
    setShowInvoiceForm(true)
  }

  const handleEditInvoice = (invoice: InvoiceWithDetails) => {
    setEditingInvoice(invoice)
    setShowInvoiceForm(true)
  }

  const handleSaveInvoice = async (invoiceData: any) => {
    const loadingToast = showToast.loading(editingInvoice ? 'Updating invoice...' : 'Creating invoice...')
    
    try {
      if (editingInvoice) {
        await invoicesService.updateInvoice(editingInvoice.id, invoiceData)
        showToast.dismiss(loadingToast)
        showToast.success('Invoice updated successfully!')
      } else {
        await invoicesService.createInvoice(invoiceData, invoiceData.lineItems)
        showToast.dismiss(loadingToast)
        showToast.success('Invoice created successfully!')
      }
      setShowInvoiceForm(false)
      setEditingInvoice(null)
      fetchInvoices()
    } catch (error) {
      console.error('Error saving invoice:', error)
      showToast.dismiss(loadingToast)
      showToast.error('Failed to save invoice. Please try again.')
    }
  }

  const handleRecordPayment = (invoice: InvoiceWithDetails) => {
    setPaymentInvoice(invoice)
    setShowPaymentForm(true)
  }

  const handleSavePayment = async (paymentAmount: number, paymentDate: string) => {
    if (!paymentInvoice) return

    const loadingToast = showToast.loading('Recording payment...')

    try {
      await invoicesService.recordPayment(paymentInvoice.id, paymentAmount, paymentDate)
      setShowPaymentForm(false)
      setPaymentInvoice(null)
      fetchInvoices()
      showToast.dismiss(loadingToast)
      showToast.success('Payment recorded successfully!')
    } catch (error) {
      console.error('Error recording payment:', error)
      showToast.dismiss(loadingToast)
      showToast.error('Failed to record payment. Please try again.')
    }
  }

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return

    // Optimistic UI update - remove invoice immediately
    const originalInvoices = [...invoices]
    setInvoices(prev => prev.filter(inv => inv.id !== invoiceId))
    
    const loadingToast = showToast.loading('Deleting invoice...')

    try {
      await invoicesService.deleteInvoice(invoiceId)
      showToast.dismiss(loadingToast)
      showToast.warning('Invoice deleted successfully')
    } catch (error) {
      console.error('Error deleting invoice:', error)
      // Revert optimistic update on error
      setInvoices(originalInvoices)
      showToast.dismiss(loadingToast)
      showToast.error('Failed to delete invoice. Please try again.')
    }
  }

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      'draft': 'badge-light-secondary',
      'sent': 'badge-light-info',
      'paid': 'badge-light-success',
      'partial': 'badge-light-warning',
      'overdue': 'badge-light-danger',
      'cancelled': 'badge-light-dark'
    }
    return `badge ${statusClasses[status as keyof typeof statusClasses] || 'badge-light-secondary'}`
  }

  const getBalanceAmount = (total: number, paid: number) => {
    return total - (paid || 0)
  }

  const isOverdue = (dueDate: string | undefined, status: string) => {
    if (!dueDate) return false
    return new Date(dueDate) < new Date() && status !== 'paid' && status !== 'cancelled'
  }

  const getTotalStats = () => {
    const total = invoices.reduce((sum, inv) => sum + inv.total_amount, 0)
    const paid = invoices.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0)
    const outstanding = total - paid
    const overdue = invoices
      .filter(inv => isOverdue(inv.due_date, inv.status))
      .reduce((sum, inv) => sum + getBalanceAmount(inv.total_amount, inv.paid_amount || 0), 0)

    return { total, paid, outstanding, overdue }
  }

  const stats = getTotalStats()

  return (
    <>
      <PageTitle breadcrumbs={[]}>Invoices Management</PageTitle>
      
      {/* Stats Cards */}
      <div className='row g-5 g-xl-8 mb-5'>
        {loading ? (
          <>
            <div className='col-xl-3'><StatCardSkeleton /></div>
            <div className='col-xl-3'><StatCardSkeleton /></div>
            <div className='col-xl-3'><StatCardSkeleton /></div>
            <div className='col-xl-3'><StatCardSkeleton /></div>
          </>
        ) : (
          <>
            <div className='col-xl-3'>
              <div className='card card-bordered'>
                <div className='card-body'>
                  <div className='d-flex align-items-center'>
                    <div className='symbol symbol-50px me-5'>
                      <span className='symbol-label bg-light-primary'>
                        <i className='ki-duotone ki-dollar fs-2x text-primary'></i>
                      </span>
                    </div>
                    <div className='d-flex flex-column'>
                      <span className='fw-bold fs-6 text-gray-800'>${stats.total.toLocaleString()}</span>
                      <span className='fw-semibold fs-7 text-gray-400'>Total Invoiced</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className='col-xl-3'>
              <div className='card card-bordered'>
                <div className='card-body'>
                  <div className='d-flex align-items-center'>
                    <div className='symbol symbol-50px me-5'>
                      <span className='symbol-label bg-light-success'>
                        <i className='ki-duotone ki-check fs-2x text-success'></i>
                      </span>
                    </div>
                    <div className='d-flex flex-column'>
                      <span className='fw-bold fs-6 text-gray-800'>${stats.paid.toLocaleString()}</span>
                      <span className='fw-semibold fs-7 text-gray-400'>Total Paid</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className='col-xl-3'>
              <div className='card card-bordered'>
                <div className='card-body'>
                  <div className='d-flex align-items-center'>
                    <div className='symbol symbol-50px me-5'>
                      <span className='symbol-label bg-light-warning'>
                        <i className='ki-duotone ki-time fs-2x text-warning'></i>
                      </span>
                    </div>
                    <div className='d-flex flex-column'>
                      <span className='fw-bold fs-6 text-gray-800'>${stats.outstanding.toLocaleString()}</span>
                      <span className='fw-semibold fs-7 text-gray-400'>Outstanding</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className='col-xl-3'>
              <div className='card card-bordered'>
                <div className='card-body'>
                  <div className='d-flex align-items-center'>
                    <div className='symbol symbol-50px me-5'>
                      <span className='symbol-label bg-light-danger'>
                        <i className='ki-duotone ki-cross fs-2x text-danger'></i>
                      </span>
                    </div>
                    <div className='d-flex flex-column'>
                      <span className='fw-bold fs-6 text-gray-800'>${stats.overdue.toLocaleString()}</span>
                      <span className='fw-semibold fs-7 text-gray-400'>Overdue</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className='row g-5 g-xl-8'>
        <div className='col-xl-12'>
          <KTCard>
            <div className='card-header border-0 pt-5'>
              <div className='card-title'>
                <div className='d-flex align-items-center position-relative my-1'>
                  <i className='ki-duotone ki-magnifier fs-1 position-absolute ms-6'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                  </i>
                  <input
                    type='text'
                    className='form-control form-control-solid w-250px ps-14'
                    placeholder='Search invoices...'
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className='card-toolbar'>
                <div className='d-flex justify-content-end align-items-center'>
                  <select
                    className='form-select form-select-solid form-select-sm w-150px me-3'
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value='all'>All Statuses</option>
                    <option value='draft'>Draft</option>
                    <option value='sent'>Sent</option>
                    <option value='partial'>Partial</option>
                    <option value='paid'>Paid</option>
                    <option value='overdue'>Overdue</option>
                    <option value='cancelled'>Cancelled</option>
                  </select>
                  <button className='btn btn-sm btn-primary' onClick={handleNewInvoice}>
                    <i className='ki-duotone ki-plus fs-2'></i>
                    New Invoice
                  </button>
                </div>
              </div>
            </div>
            <KTCardBody className='py-3'>
              {loading ? (
                <TableSkeleton rows={5} columns={9} />
              ) : invoices.length === 0 ? (
                <div className='text-center py-10'>
                  <div className='text-muted mb-3'>
                    <i className='ki-duotone ki-file fs-3x text-muted mb-3'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                    </i>
                  </div>
                  <div className='text-muted'>
                    No invoices found. Generate your first invoice from a job milestone or create a new one.
                  </div>
                </div>
              ) : (
                <div className='table-responsive'>
                  <table className='table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4'>
                    <thead>
                      <tr className='fw-bold text-muted'>
                        <th className='min-w-120px'>Invoice #</th>
                        <th className='min-w-150px'>Client</th>
                        <th className='min-w-150px'>Job</th>
                        <th className='min-w-120px'>Status</th>
                        <th className='min-w-120px'>Total</th>
                        <th className='min-w-120px'>Paid</th>
                        <th className='min-w-120px'>Balance</th>
                        <th className='min-w-120px'>Due Date</th>
                        <th className='min-w-100px text-end'>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice) => (
                        <tr key={invoice.id}>
                          <td>
                            <a href='#' className='text-dark fw-bold text-hover-primary fs-6'>
                              {invoice.invoice_number}
                            </a>
                          </td>
                          <td>
                            <span className='text-dark fw-bold d-block fs-6'>
                              {invoice.accounts?.name || 'Unknown Client'}
                            </span>
                          </td>
                          <td>
                            <div className='d-flex flex-column'>
                              <span className='text-dark fw-bold fs-6'>
                                {invoice.jobs?.title || 'One-off Invoice'}
                              </span>
                              <span className='text-muted fw-semibold fs-7'>
                                {invoice.jobs?.job_number || invoice.description}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className={getStatusBadge(invoice.status)}>
                              {invoice.status}
                            </span>
                            {isOverdue(invoice.due_date, invoice.status) && (
                              <span className='badge badge-light-danger ms-2'>overdue</span>
                            )}
                          </td>
                          <td>
                            <span className='text-dark fw-bold d-block fs-6'>
                              ${invoice.total_amount.toLocaleString()}
                            </span>
                          </td>
                          <td>
                            <span className='text-dark fw-bold d-block fs-6'>
                              ${(invoice.paid_amount || 0).toLocaleString()}
                            </span>
                          </td>
                          <td>
                            <span className={`fw-bold d-block fs-6 ${getBalanceAmount(invoice.total_amount, invoice.paid_amount || 0) > 0 ? 'text-danger' : 'text-success'}`}>
                              ${getBalanceAmount(invoice.total_amount, invoice.paid_amount || 0).toLocaleString()}
                            </span>
                          </td>
                          <td>
                            <span className={`text-dark fw-bold d-block fs-6 ${isOverdue(invoice.due_date, invoice.status) ? 'text-danger' : ''}`}>
                              {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'No due date'}
                            </span>
                          </td>
                          <td>
                            <div className='d-flex justify-content-end flex-shrink-0'>
                              <button
                                className='btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1'
                                title='View/Edit'
                                onClick={() => handleEditInvoice(invoice)}
                              >
                                <i className='ki-duotone ki-pencil fs-3'>
                                  <span className='path1'></span>
                                  <span className='path2'></span>
                                </i>
                              </button>
                              <button
                                className='btn btn-icon btn-bg-light btn-active-color-info btn-sm me-1'
                                title='Send Invoice'
                                onClick={() => alert('Invoice sending functionality will be added in a future update.')}
                              >
                                <i className='ki-duotone ki-send fs-3'>
                                  <span className='path1'></span>
                                  <span className='path2'></span>
                                </i>
                              </button>
                              {getBalanceAmount(invoice.total_amount, invoice.paid_amount || 0) > 0 && (
                                <button
                                  className='btn btn-icon btn-bg-light btn-active-color-success btn-sm me-1'
                                  title='Record Payment'
                                  onClick={() => handleRecordPayment(invoice)}
                                >
                                  <i className='ki-duotone ki-dollar fs-3'>
                                    <span className='path1'></span>
                                    <span className='path2'></span>
                                    <span className='path3'></span>
                                  </i>
                                </button>
                              )}
                              <button
                                className='btn btn-icon btn-bg-light btn-active-color-danger btn-sm'
                                title='Delete'
                                onClick={() => handleDeleteInvoice(invoice.id)}
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
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </KTCardBody>
          </KTCard>
        </div>
      </div>

      {/* Modals */}
      {showInvoiceForm && (
        <InvoiceForm
          invoice={editingInvoice}
          accounts={accounts}
          jobs={jobs}
          onSave={handleSaveInvoice}
          onCancel={() => {
            setShowInvoiceForm(false)
            setEditingInvoice(null)
          }}
        />
      )}

      {showPaymentForm && paymentInvoice && (
        <PaymentForm
          invoice={paymentInvoice}
          onSave={handleSavePayment}
          onCancel={() => {
            setShowPaymentForm(false)
            setPaymentInvoice(null)
          }}
        />
      )}
    </>
  )
}

export default InvoicesPage
