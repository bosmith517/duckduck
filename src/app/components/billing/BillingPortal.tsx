import React, { useState, useEffect } from 'react'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'

interface Invoice {
  id: string
  invoice_number: string
  project_title: string
  total_amount: number
  due_date: string
  status: 'sent' | 'paid' | 'overdue' | 'partial'
  created_at: string
  contacts: {
    first_name: string
    last_name: string
    email: string
  }
}

interface Estimate {
  id: string
  estimate_number: string
  project_title: string
  total_amount: number
  status: 'sent' | 'approved' | 'rejected' | 'expired'
  created_at: string
  expires_at: string
  contacts: {
    first_name: string
    last_name: string
    email: string
  }
}

interface BillingPortalProps {
  customerId?: string
  showSummaryOnly?: boolean
}

const BillingPortal: React.FC<BillingPortalProps> = ({
  customerId,
  showSummaryOnly = false
}) => {
  const { userProfile } = useSupabaseAuth()
  
  // State
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [estimates, setEstimates] = useState<Estimate[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'invoices' | 'estimates'>('invoices')
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [selectedEstimate, setSelectedEstimate] = useState<Estimate | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  useEffect(() => {
    if (userProfile?.tenant_id) {
      loadData()
    }
  }, [userProfile?.tenant_id, customerId])

  const loadData = async () => {
    setLoading(true)
    try {
      await Promise.all([loadInvoices(), loadEstimates()])
    } finally {
      setLoading(false)
    }
  }

  const loadInvoices = async () => {
    try {
      let query = supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          project_title,
          total_amount,
          due_date,
          status,
          created_at,
          contacts!inner(first_name, last_name, email)
        `)
        .eq('tenant_id', userProfile?.tenant_id)
        .order('created_at', { ascending: false })

      if (customerId) {
        query = query.eq('contact_id', customerId)
      }

      const { data, error } = await query

      if (error) throw error
      
      // Transform the data to match our interface
      const transformedInvoices = (data || []).map(invoice => ({
        ...invoice,
        contacts: Array.isArray(invoice.contacts) ? invoice.contacts[0] : invoice.contacts
      }))
      
      setInvoices(transformedInvoices)
    } catch (error) {
      console.error('Error loading invoices:', error)
      showToast.error('Failed to load invoices')
    }
  }

  const loadEstimates = async () => {
    try {
      let query = supabase
        .from('estimates')
        .select(`
          id,
          estimate_number,
          project_title,
          total_amount,
          status,
          created_at,
          expires_at,
          contacts!inner(first_name, last_name, email)
        `)
        .eq('tenant_id', userProfile?.tenant_id)
        .order('created_at', { ascending: false })

      if (customerId) {
        query = query.eq('contact_id', customerId)
      }

      const { data, error } = await query

      if (error) throw error
      
      // Transform the data to match our interface
      const transformedEstimates = (data || []).map(estimate => ({
        ...estimate,
        contacts: Array.isArray(estimate.contacts) ? estimate.contacts[0] : estimate.contacts
      }))
      
      setEstimates(transformedEstimates)
    } catch (error) {
      console.error('Error loading estimates:', error)
      showToast.error('Failed to load estimates')
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusBadge = (type: 'invoice' | 'estimate', status: string) => {
    const statusConfig = {
      invoice: {
        sent: { class: 'badge-light-primary', text: 'Sent' },
        paid: { class: 'badge-light-success', text: 'Paid' },
        overdue: { class: 'badge-light-danger', text: 'Overdue' },
        partial: { class: 'badge-light-warning', text: 'Partial' }
      },
      estimate: {
        sent: { class: 'badge-light-primary', text: 'Sent' },
        approved: { class: 'badge-light-success', text: 'Approved' },
        rejected: { class: 'badge-light-danger', text: 'Rejected' },
        expired: { class: 'badge-light-secondary', text: 'Expired' }
      }
    }
    
    const config = statusConfig[type][status as keyof typeof statusConfig[typeof type]] || { class: 'badge-light-secondary', text: status }
    return <span className={`badge ${config.class}`}>{config.text}</span>
  }

  const handlePayInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setShowPaymentModal(true)
  }

  const handleApproveEstimate = async (estimate: Estimate) => {
    try {
      const { error } = await supabase
        .from('estimates')
        .update({ 
          status: 'approved',
          approved_at: new Date().toISOString()
        })
        .eq('id', estimate.id)

      if (error) throw error
      
      showToast.success('Estimate approved successfully!')
      loadEstimates()
    } catch (error) {
      console.error('Error approving estimate:', error)
      showToast.error('Failed to approve estimate')
    }
  }

  const getTotalOutstanding = () => {
    return invoices
      .filter(inv => inv.status !== 'paid')
      .reduce((sum, inv) => sum + inv.total_amount, 0)
  }

  const getPendingEstimates = () => {
    return estimates.filter(est => est.status === 'sent').length
  }

  if (loading) {
    return (
      <div className="d-flex justify-content-center py-10">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  if (showSummaryOnly) {
    return (
      <div className="row g-4">
        <div className="col-md-6">
          <div className="card border border-light">
            <div className="card-body text-center">
              <i className="ki-duotone ki-bill fs-2x text-danger mb-3">
                <span className="path1"></span>
                <span className="path2"></span>
                <span className="path3"></span>
                <span className="path4"></span>
                <span className="path5"></span>
                <span className="path6"></span>
              </i>
              <div className="fs-2x fw-bold text-dark">
                {formatCurrency(getTotalOutstanding())}
              </div>
              <div className="text-muted fs-7">Outstanding Balance</div>
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card border border-light">
            <div className="card-body text-center">
              <i className="ki-duotone ki-document fs-2x text-warning mb-3">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              <div className="fs-2x fw-bold text-dark">
                {getPendingEstimates()}
              </div>
              <div className="text-muted fs-7">Pending Estimates</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">
          <i className="ki-duotone ki-wallet fs-2 text-primary me-3">
            <span className="path1"></span>
            <span className="path2"></span>
            <span className="path3"></span>
            <span className="path4"></span>
          </i>
          Customer Billing Portal
        </h3>
        <div className="card-toolbar">
          <ul className="nav nav-tabs nav-line-tabs nav-line-tabs-2x nav-stretch fs-6 border-0">
            <li className="nav-item">
              <a
                className={`nav-link ${activeTab === 'invoices' ? 'active' : ''}`}
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  setActiveTab('invoices')
                }}
              >
                <i className="ki-duotone ki-bill fs-4 me-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                  <span className="path3"></span>
                  <span className="path4"></span>
                  <span className="path5"></span>
                  <span className="path6"></span>
                </i>
                Invoices ({invoices.length})
              </a>
            </li>
            <li className="nav-item">
              <a
                className={`nav-link ${activeTab === 'estimates' ? 'active' : ''}`}
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  setActiveTab('estimates')
                }}
              >
                <i className="ki-duotone ki-document fs-4 me-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                Estimates ({estimates.length})
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="card-body">
        {/* Summary Cards */}
        <div className="row g-4 mb-6">
          <div className="col-md-3">
            <div className="card border border-light h-100">
              <div className="card-body text-center">
                <i className="ki-duotone ki-dollar fs-2x text-success mb-3">
                  <span className="path1"></span>
                  <span className="path2"></span>
                  <span className="path3"></span>
                </i>
                <div className="fs-2x fw-bold text-dark">
                  {formatCurrency(getTotalOutstanding())}
                </div>
                <div className="text-muted fs-7">Outstanding Balance</div>
              </div>
            </div>
          </div>
          
          <div className="col-md-3">
            <div className="card border border-light h-100">
              <div className="card-body text-center">
                <i className="ki-duotone ki-check-circle fs-2x text-success mb-3">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                <div className="fs-2x fw-bold text-dark">
                  {invoices.filter(inv => inv.status === 'paid').length}
                </div>
                <div className="text-muted fs-7">Paid Invoices</div>
              </div>
            </div>
          </div>
          
          <div className="col-md-3">
            <div className="card border border-light h-100">
              <div className="card-body text-center">
                <i className="ki-duotone ki-time fs-2x text-warning mb-3">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                <div className="fs-2x fw-bold text-dark">
                  {getPendingEstimates()}
                </div>
                <div className="text-muted fs-7">Pending Estimates</div>
              </div>
            </div>
          </div>
          
          <div className="col-md-3">
            <div className="card border border-light h-100">
              <div className="card-body text-center">
                <i className="ki-duotone ki-like fs-2x text-info mb-3">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                <div className="fs-2x fw-bold text-dark">
                  {estimates.filter(est => est.status === 'approved').length}
                </div>
                <div className="text-muted fs-7">Approved Estimates</div>
              </div>
            </div>
          </div>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'invoices' && (
          <div>
            {invoices.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4">
                  <thead>
                    <tr className="fw-bold text-muted">
                      <th className="min-w-150px">Invoice #</th>
                      <th className="min-w-200px">Project</th>
                      <th className="min-w-150px">Customer</th>
                      <th className="w-100px">Amount</th>
                      <th className="w-100px">Due Date</th>
                      <th className="w-80px">Status</th>
                      <th className="w-100px text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td>
                          <span className="text-dark fw-bold">{invoice.invoice_number}</span>
                        </td>
                        <td>
                          <span className="text-dark">{invoice.project_title}</span>
                        </td>
                        <td>
                          <div className="d-flex flex-column">
                            <span className="text-dark fw-semibold">
                              {invoice.contacts.first_name} {invoice.contacts.last_name}
                            </span>
                            <span className="text-muted fs-7">{invoice.contacts.email}</span>
                          </div>
                        </td>
                        <td>
                          <span className="text-dark fw-bold">{formatCurrency(invoice.total_amount)}</span>
                        </td>
                        <td>
                          <span className="text-dark">{formatDate(invoice.due_date)}</span>
                        </td>
                        <td>
                          {getStatusBadge('invoice', invoice.status)}
                        </td>
                        <td className="text-end">
                          <div className="d-flex gap-1 justify-content-end">
                            <button
                              className="btn btn-sm btn-icon btn-light-primary"
                              title="View Invoice"
                            >
                              <i className="ki-duotone ki-eye fs-6">
                                <span className="path1"></span>
                                <span className="path2"></span>
                                <span className="path3"></span>
                              </i>
                            </button>
                            {invoice.status !== 'paid' && (
                              <button
                                className="btn btn-sm btn-icon btn-light-success"
                                onClick={() => handlePayInvoice(invoice)}
                                title="Pay Invoice"
                              >
                                <i className="ki-duotone ki-dollar fs-6">
                                  <span className="path1"></span>
                                  <span className="path2"></span>
                                  <span className="path3"></span>
                                </i>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-10">
                <i className="ki-duotone ki-bill fs-3x text-muted mb-3">
                  <span className="path1"></span>
                  <span className="path2"></span>
                  <span className="path3"></span>
                  <span className="path4"></span>
                  <span className="path5"></span>
                  <span className="path6"></span>
                </i>
                <h5 className="text-muted">No Invoices Found</h5>
                <p className="text-muted">
                  {customerId 
                    ? 'This customer has no invoices yet.'
                    : 'No invoices have been created yet.'
                  }
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'estimates' && (
          <div>
            {estimates.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4">
                  <thead>
                    <tr className="fw-bold text-muted">
                      <th className="min-w-150px">Estimate #</th>
                      <th className="min-w-200px">Project</th>
                      <th className="min-w-150px">Customer</th>
                      <th className="w-100px">Amount</th>
                      <th className="w-100px">Expires</th>
                      <th className="w-80px">Status</th>
                      <th className="w-100px text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimates.map((estimate) => (
                      <tr key={estimate.id}>
                        <td>
                          <span className="text-dark fw-bold">{estimate.estimate_number}</span>
                        </td>
                        <td>
                          <span className="text-dark">{estimate.project_title}</span>
                        </td>
                        <td>
                          <div className="d-flex flex-column">
                            <span className="text-dark fw-semibold">
                              {estimate.contacts.first_name} {estimate.contacts.last_name}
                            </span>
                            <span className="text-muted fs-7">{estimate.contacts.email}</span>
                          </div>
                        </td>
                        <td>
                          <span className="text-dark fw-bold">{formatCurrency(estimate.total_amount)}</span>
                        </td>
                        <td>
                          <span className="text-dark">{formatDate(estimate.expires_at)}</span>
                        </td>
                        <td>
                          {getStatusBadge('estimate', estimate.status)}
                        </td>
                        <td className="text-end">
                          <div className="d-flex gap-1 justify-content-end">
                            <button
                              className="btn btn-sm btn-icon btn-light-primary"
                              title="View Estimate"
                            >
                              <i className="ki-duotone ki-eye fs-6">
                                <span className="path1"></span>
                                <span className="path2"></span>
                                <span className="path3"></span>
                              </i>
                            </button>
                            {estimate.status === 'sent' && (
                              <button
                                className="btn btn-sm btn-icon btn-light-success"
                                onClick={() => handleApproveEstimate(estimate)}
                                title="Approve Estimate"
                              >
                                <i className="ki-duotone ki-check fs-6">
                                  <span className="path1"></span>
                                  <span className="path2"></span>
                                </i>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-10">
                <i className="ki-duotone ki-document fs-3x text-muted mb-3">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                <h5 className="text-muted">No Estimates Found</h5>
                <p className="text-muted">
                  {customerId 
                    ? 'This customer has no estimates yet.'
                    : 'No estimates have been created yet.'
                  }
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Pay Invoice</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowPaymentModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-light-primary">
                  <h6 className="alert-heading">Invoice Details</h6>
                  <p className="mb-2">
                    <strong>Invoice:</strong> {selectedInvoice.invoice_number}
                  </p>
                  <p className="mb-2">
                    <strong>Project:</strong> {selectedInvoice.project_title}
                  </p>
                  <p className="mb-0">
                    <strong>Amount:</strong> {formatCurrency(selectedInvoice.total_amount)}
                  </p>
                </div>
                
                <div className="text-center py-6">
                  <i className="ki-duotone ki-credit-cart fs-3x text-primary mb-3">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  <h6>Payment Processing</h6>
                  <p className="text-muted">
                    Payment processing integration would be implemented here using Stripe, Square, or similar payment processor.
                  </p>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => setShowPaymentModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    showToast.info('Payment processing would be handled here')
                    setShowPaymentModal(false)
                  }}
                >
                  Process Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BillingPortal
