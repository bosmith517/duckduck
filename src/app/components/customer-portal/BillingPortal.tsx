import React, { useState, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'

interface EstimateTier {
  id: string
  tier_level: string
  tier_name: string
  description: string
  total_amount: number
  labor_cost: number
  material_cost: number
  markup_amount: number
  is_selected: boolean
  line_items: EstimateLineItem[]
}

interface EstimateLineItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  line_total: number
  item_type: string
}

interface Estimate {
  id: string
  estimate_number: string
  project_title: string
  description: string
  status: string
  total_amount: number
  valid_until: string
  created_at: string
  template_type: string
  tiers: EstimateTier[]
  signature_status: string
  signed_at?: string
  signed_by_name?: string
}

interface Invoice {
  id: string
  invoice_number: string
  project_title: string
  description: string
  status: string
  payment_status: string
  total_amount: number
  due_date: string
  created_at: string
  sent_at?: string
  viewed_at?: string
  line_items: any[]
  payments: any[]
}

interface BillingPortalProps {
  customerId: string
  customerName: string
}

const BillingPortal: React.FC<BillingPortalProps> = ({
  customerId,
  customerName
}) => {
  const [activeTab, setActiveTab] = useState<'estimates' | 'invoices'>('estimates')
  const [estimates, setEstimates] = useState<Estimate[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEstimate, setSelectedEstimate] = useState<Estimate | null>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [showEstimateModal, setShowEstimateModal] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  useEffect(() => {
    loadBillingData()
    markPortalViewed()
  }, [customerId])

  const loadBillingData = async () => {
    setLoading(true)
    try {
      await Promise.all([loadEstimates(), loadInvoices()])
    } finally {
      setLoading(false)
    }
  }

  const loadEstimates = async () => {
    try {
      // Get estimates for this customer's account
      const { data: accountData } = await supabase
        .from('contacts')
        .select('account_id')
        .eq('id', customerId)
        .single()

      if (!accountData?.account_id) return

      const { data: estimates, error } = await supabase
        .from('estimates')
        .select(`
          *,
          estimate_tiers(*),
          estimate_line_items(*)
        `)
        .eq('account_id', accountData.account_id)
        .in('status', ['sent', 'approved', 'rejected'])
        .order('created_at', { ascending: false })

      if (error) throw error

      // Process estimates with tiers
      const processedEstimates = estimates?.map(estimate => ({
        ...estimate,
        tiers: estimate.estimate_tiers || [],
        line_items: estimate.estimate_line_items || []
      })) || []

      setEstimates(processedEstimates)
    } catch (error) {
      console.error('Error loading estimates:', error)
    }
  }

  const loadInvoices = async () => {
    try {
      const { data: accountData } = await supabase
        .from('contacts')
        .select('account_id')
        .eq('id', customerId)
        .single()

      if (!accountData?.account_id) return

      const { data: invoices, error } = await supabase
        .from('invoices')
        .select(`
          *,
          invoice_items(*),
          invoice_payments(*)
        `)
        .eq('account_id', accountData.account_id)
        .in('status', ['sent', 'paid', 'overdue'])
        .order('created_at', { ascending: false })

      if (error) throw error

      const processedInvoices = invoices?.map(invoice => ({
        ...invoice,
        line_items: invoice.invoice_items || [],
        payments: invoice.invoice_payments || []
      })) || []

      setInvoices(processedInvoices)
    } catch (error) {
      console.error('Error loading invoices:', error)
    }
  }

  const markPortalViewed = async () => {
    try {
      await supabase
        .from('portal_activity_log')
        .insert({
          contact_id: customerId,
          activity_type: 'login',
          ip_address: '0.0.0.0', // Would get real IP in production
          created_at: new Date().toISOString()
        })
    } catch (error) {
      console.error('Error logging portal access:', error)
    }
  }

  const handleEstimateAction = async (estimateId: string, action: 'accept' | 'decline', selectedTierId?: string) => {
    try {
      const newStatus = action === 'accept' ? 'approved' : 'rejected'
      
      const updateData: any = {
        status: newStatus,
        signature_status: 'signed',
        signed_at: new Date().toISOString(),
        signed_by_name: customerName
      }

      // If accepting a tiered estimate, update selected tier
      if (action === 'accept' && selectedTierId) {
        // Update selected tier
        await supabase
          .from('estimate_tiers')
          .update({ is_selected: false })
          .eq('estimate_id', estimateId)

        await supabase
          .from('estimate_tiers')
          .update({ is_selected: true })
          .eq('id', selectedTierId)

        // Update main estimate total from selected tier
        const { data: tierData } = await supabase
          .from('estimate_tiers')
          .select('total_amount')
          .eq('id', selectedTierId)
          .single()

        if (tierData) {
          updateData.total_amount = tierData.total_amount
        }
      }

      const { error } = await supabase
        .from('estimates')
        .update(updateData)
        .eq('id', estimateId)

      if (error) throw error

      // Log the activity
      await supabase
        .from('portal_activity_log')
        .insert({
          contact_id: customerId,
          activity_type: action === 'accept' ? 'accept_estimate' : 'decline_estimate',
          reference_id: estimateId,
          ip_address: '0.0.0.0'
        })

      showToast.success(`Estimate ${action === 'accept' ? 'accepted' : 'declined'} successfully`)
      setShowEstimateModal(false)
      loadEstimates()
    } catch (error) {
      console.error('Error updating estimate:', error)
      showToast.error('Failed to update estimate')
    }
  }

  const handleViewEstimate = async (estimate: Estimate) => {
    setSelectedEstimate(estimate)
    setShowEstimateModal(true)

    // Log view activity
    try {
      await supabase
        .from('portal_activity_log')
        .insert({
          contact_id: customerId,
          activity_type: 'view_estimate',
          reference_id: estimate.id,
          ip_address: '0.0.0.0'
        })
    } catch (error) {
      console.error('Error logging estimate view:', error)
    }
  }

  const handleViewInvoice = async (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setShowInvoiceModal(true)

    // Mark invoice as viewed
    try {
      if (!invoice.viewed_at) {
        await supabase
          .from('invoices')
          .update({ viewed_at: new Date().toISOString() })
          .eq('id', invoice.id)
      }

      await supabase
        .from('portal_activity_log')
        .insert({
          contact_id: customerId,
          activity_type: 'view_invoice',
          reference_id: invoice.id,
          ip_address: '0.0.0.0'
        })
    } catch (error) {
      console.error('Error logging invoice view:', error)
    }
  }

  const handlePayInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setShowPaymentModal(true)
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
      month: 'long',
      day: 'numeric'
    })
  }

  const getStatusBadge = (status: string, type: 'estimate' | 'invoice') => {
    const statusConfig: Record<string, Record<string, { class: string; text: string }>> = {
      estimate: {
        sent: { class: 'badge-light-warning', text: 'Pending Review' },
        approved: { class: 'badge-light-success', text: 'Approved' },
        rejected: { class: 'badge-light-danger', text: 'Declined' },
        expired: { class: 'badge-light-secondary', text: 'Expired' }
      },
      invoice: {
        sent: { class: 'badge-light-info', text: 'Sent' },
        paid: { class: 'badge-light-success', text: 'Paid' },
        overdue: { class: 'badge-light-danger', text: 'Overdue' },
        partial: { class: 'badge-light-warning', text: 'Partially Paid' }
      }
    }

    const config = statusConfig[type]?.[status] || { class: 'badge-light-secondary', text: status }
    return <span className={`badge ${config.class}`}>{config.text}</span>
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

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">
          <i className="ki-duotone ki-bill fs-2 text-primary me-3">
            <span className="path1"></span>
            <span className="path2"></span>
            <span className="path3"></span>
            <span className="path4"></span>
            <span className="path5"></span>
            <span className="path6"></span>
          </i>
          Estimates & Invoices
        </h3>
        <div className="card-toolbar">
          <ul className="nav nav-tabs nav-line-tabs nav-line-tabs-2x nav-stretch fs-6 border-0">
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
          </ul>
        </div>
      </div>

      <div className="card-body">
        {activeTab === 'estimates' && (
          <div className="row g-6">
            {estimates.length > 0 ? (
              estimates.map((estimate) => (
                <div key={estimate.id} className="col-lg-6">
                  <div className="card border border-light h-100">
                    <div className="card-header">
                      <div className="d-flex justify-content-between align-items-center w-100">
                        <h6 className="card-title mb-0">
                          {estimate.estimate_number || `EST-${estimate.id.substring(0, 8)}`}
                        </h6>
                        {getStatusBadge(estimate.status, 'estimate')}
                      </div>
                    </div>
                    <div className="card-body">
                      <h5 className="text-dark mb-3">{estimate.project_title}</h5>
                      <p className="text-muted fs-6 mb-4">{estimate.description}</p>
                      
                      <div className="d-flex justify-content-between mb-3">
                        <span className="text-muted">Total Amount:</span>
                        <span className="fw-bold text-dark">
                          {formatCurrency(estimate.total_amount)}
                        </span>
                      </div>
                      
                      <div className="d-flex justify-content-between mb-3">
                        <span className="text-muted">Valid Until:</span>
                        <span className="fw-semibold">
                          {estimate.valid_until ? formatDate(estimate.valid_until) : 'No expiration'}
                        </span>
                      </div>

                      {estimate.template_type === 'tiered' && (
                        <div className="d-flex justify-content-between mb-4">
                          <span className="text-muted">Options:</span>
                          <span className="badge badge-light-info">
                            {estimate.tiers?.length || 0} Tiers Available
                          </span>
                        </div>
                      )}

                      <div className="d-flex gap-2">
                        <button
                          className="btn btn-primary btn-sm flex-fill"
                          onClick={() => handleViewEstimate(estimate)}
                        >
                          <i className="ki-duotone ki-eye fs-6 me-1">
                            <span className="path1"></span>
                            <span className="path2"></span>
                            <span className="path3"></span>
                          </i>
                          View Details
                        </button>
                        {estimate.status === 'sent' && (
                          <>
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleEstimateAction(estimate.id, 'accept')}
                            >
                              <i className="ki-duotone ki-check fs-6 me-1">
                                <span className="path1"></span>
                                <span className="path2"></span>
                              </i>
                              Accept
                            </button>
                            <button
                              className="btn btn-light-danger btn-sm"
                              onClick={() => handleEstimateAction(estimate.id, 'decline')}
                            >
                              <i className="ki-duotone ki-cross fs-6 me-1">
                                <span className="path1"></span>
                                <span className="path2"></span>
                              </i>
                              Decline
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-12">
                <div className="text-center py-10">
                  <i className="ki-duotone ki-document fs-3x text-muted mb-3">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  <h5 className="text-muted">No Estimates Available</h5>
                  <p className="text-muted">
                    You don't have any estimates at the moment. They'll appear here when sent.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'invoices' && (
          <div className="row g-6">
            {invoices.length > 0 ? (
              invoices.map((invoice) => (
                <div key={invoice.id} className="col-lg-6">
                  <div className="card border border-light h-100">
                    <div className="card-header">
                      <div className="d-flex justify-content-between align-items-center w-100">
                        <h6 className="card-title mb-0">
                          {invoice.invoice_number || `INV-${invoice.id.substring(0, 8)}`}
                        </h6>
                        {getStatusBadge(invoice.payment_status, 'invoice')}
                      </div>
                    </div>
                    <div className="card-body">
                      <h5 className="text-dark mb-3">{invoice.project_title}</h5>
                      <p className="text-muted fs-6 mb-4">{invoice.description}</p>
                      
                      <div className="d-flex justify-content-between mb-3">
                        <span className="text-muted">Amount Due:</span>
                        <span className="fw-bold text-dark">
                          {formatCurrency(invoice.total_amount)}
                        </span>
                      </div>
                      
                      <div className="d-flex justify-content-between mb-3">
                        <span className="text-muted">Due Date:</span>
                        <span className={`fw-semibold ${
                          new Date(invoice.due_date) < new Date() && invoice.payment_status !== 'paid' 
                            ? 'text-danger' : ''
                        }`}>
                          {formatDate(invoice.due_date)}
                        </span>
                      </div>

                      {invoice.payments && invoice.payments.length > 0 && (
                        <div className="d-flex justify-content-between mb-4">
                          <span className="text-muted">Payments Made:</span>
                          <span className="fw-semibold text-success">
                            {formatCurrency(
                              invoice.payments.reduce((sum, payment) => sum + payment.amount, 0)
                            )}
                          </span>
                        </div>
                      )}

                      <div className="d-flex gap-2">
                        <button
                          className="btn btn-primary btn-sm flex-fill"
                          onClick={() => handleViewInvoice(invoice)}
                        >
                          <i className="ki-duotone ki-eye fs-6 me-1">
                            <span className="path1"></span>
                            <span className="path2"></span>
                            <span className="path3"></span>
                          </i>
                          View Details
                        </button>
                        {invoice.payment_status !== 'paid' && (
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => handlePayInvoice(invoice)}
                          >
                            <i className="ki-duotone ki-credit-card fs-6 me-1">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                            Pay Now
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-12">
                <div className="text-center py-10">
                  <i className="ki-duotone ki-bill fs-3x text-muted mb-3">
                    <span className="path1"></span>
                    <span className="path2"></span>
                    <span className="path3"></span>
                    <span className="path4"></span>
                    <span className="path5"></span>
                    <span className="path6"></span>
                  </i>
                  <h5 className="text-muted">No Invoices Available</h5>
                  <p className="text-muted">
                    You don't have any invoices at the moment. They'll appear here when sent.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Estimate Detail Modal */}
      {showEstimateModal && selectedEstimate && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-xl">
            <div className="modal-content">
              <div className="modal-header">
                <h3 className="modal-title">
                  {selectedEstimate.estimate_number || `EST-${selectedEstimate.id.substring(0, 8)}`}
                </h3>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowEstimateModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                {/* Estimate content would go here - full estimate display with tiers, line items, etc. */}
                <div className="alert alert-light-info">
                  <h4 className="alert-heading">{selectedEstimate.project_title}</h4>
                  <p className="mb-0">{selectedEstimate.description}</p>
                </div>

                {selectedEstimate.template_type === 'tiered' && selectedEstimate.tiers && (
                  <div className="row g-4">
                    {selectedEstimate.tiers.map((tier) => (
                      <div key={tier.id} className="col-md-4">
                        <div className={`card h-100 ${tier.is_selected ? 'border-primary' : 'border-light'}`}>
                          <div className="card-header">
                            <h6 className="card-title mb-0">{tier.tier_name}</h6>
                            {tier.is_selected && (
                              <span className="badge badge-primary">Recommended</span>
                            )}
                          </div>
                          <div className="card-body">
                            <div className="text-center mb-4">
                              <div className="fs-2x fw-bold text-dark">
                                {formatCurrency(tier.total_amount)}
                              </div>
                            </div>
                            <p className="text-muted">{tier.description}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => setShowEstimateModal(false)}
                >
                  Close
                </button>
                {selectedEstimate.status === 'sent' && (
                  <>
                    <button
                      type="button"
                      className="btn btn-success"
                      onClick={() => handleEstimateAction(selectedEstimate.id, 'accept')}
                    >
                      Accept Estimate
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => handleEstimateAction(selectedEstimate.id, 'decline')}
                    >
                      Decline Estimate
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {showInvoiceModal && selectedInvoice && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h3 className="modal-title">
                  {selectedInvoice.invoice_number || `INV-${selectedInvoice.id.substring(0, 8)}`}
                </h3>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowInvoiceModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                {/* Invoice content would go here - full invoice display */}
                <div className="alert alert-light-info">
                  <h4 className="alert-heading">{selectedInvoice.project_title}</h4>
                  <p className="mb-0">{selectedInvoice.description}</p>
                </div>

                <div className="row">
                  <div className="col-md-6">
                    <strong>Amount Due:</strong> {formatCurrency(selectedInvoice.total_amount)}
                  </div>
                  <div className="col-md-6">
                    <strong>Due Date:</strong> {formatDate(selectedInvoice.due_date)}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => setShowInvoiceModal(false)}
                >
                  Close
                </button>
                {selectedInvoice.payment_status !== 'paid' && (
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={() => handlePayInvoice(selectedInvoice)}
                  >
                    Pay Invoice
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
                  <h6>Invoice: {selectedInvoice.invoice_number}</h6>
                  <p className="mb-0">
                    Amount Due: <strong>{formatCurrency(selectedInvoice.total_amount)}</strong>
                  </p>
                </div>
                
                <div className="text-center py-6">
                  <i className="ki-duotone ki-credit-card fs-3x text-primary mb-3">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  <h5 className="mb-3">Secure Payment</h5>
                  <p className="text-muted mb-4">
                    Payment processing integration would be implemented here using Stripe, Square, or similar service.
                  </p>
                  <button className="btn btn-success btn-lg">
                    <i className="ki-duotone ki-shield-tick fs-3 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                      <span className="path3"></span>
                    </i>
                    Pay Securely
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BillingPortal
