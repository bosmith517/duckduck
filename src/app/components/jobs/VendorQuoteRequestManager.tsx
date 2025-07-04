import React, { useState, useEffect } from 'react'
import { VendorService, QuoteRequestService, Vendor, QuoteRequest, QuoteRequestItem, VendorQuote } from '../../services/vendorService'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'

interface VendorQuoteRequestManagerProps {
  jobId: string
  onQuoteUpdate?: () => void
}

export const VendorQuoteRequestManager: React.FC<VendorQuoteRequestManagerProps> = ({
  jobId,
  onQuoteUpdate
}) => {
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequest[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showSendModal, setShowSendModal] = useState(false)
  const [showQuotesModal, setShowQuotesModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<QuoteRequest | null>(null)
  const [selectedVendors, setSelectedVendors] = useState<string[]>([])
  const [quotes, setQuotes] = useState<VendorQuote[]>([])
  const [requestItems, setRequestItems] = useState<QuoteRequestItem[]>([
    { item_name: '', description: '', quantity: 1, unit: 'each', specifications: '' }
  ])

  useEffect(() => {
    if (jobId) {
      loadQuoteRequests()
      loadVendors()
    }
  }, [jobId])

  const loadQuoteRequests = async () => {
    try {
      setLoading(true)
      const data = await QuoteRequestService.getQuoteRequestsForJob(jobId)
      setQuoteRequests(data)
    } catch (error) {
      console.error('Error loading quote requests:', error)
      showToast.error('Failed to load quote requests')
    } finally {
      setLoading(false)
    }
  }

  const loadVendors = async () => {
    try {
      // Get user's tenant ID (simplified - in real app get from auth context)
      const { data: userProfile } = await supabase.auth.getUser()
      if (!userProfile.user) return

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('tenant_id')
        .eq('id', userProfile.user.id)
        .single()

      if (profile?.tenant_id) {
        const data = await VendorService.getVendors(profile.tenant_id)
        setVendors(data)
      }
    } catch (error) {
      console.error('Error loading vendors:', error)
    }
  }

  const handleCreateQuoteRequest = async (formData: FormData) => {
    try {
      const requestData = {
        job_id: jobId,
        title: formData.get('title') as string,
        description: formData.get('description') as string || undefined,
        trade_category: formData.get('trade_category') as string || undefined,
        requested_delivery_date: formData.get('requested_delivery_date') as string || undefined,
        site_address: formData.get('site_address') as string || undefined,
        response_deadline: formData.get('response_deadline') as string || undefined,
        notes: formData.get('notes') as string || undefined,
        items: requestItems.filter(item => item.item_name.trim())
      }

      await QuoteRequestService.createQuoteRequest(requestData)
      showToast.success('Quote request created successfully')
      setShowCreateModal(false)
      resetForm()
      loadQuoteRequests()
      onQuoteUpdate?.()
    } catch (error: any) {
      console.error('Error creating quote request:', error)
      showToast.error(error.message || 'Failed to create quote request')
    }
  }

  const handleSendToVendors = async () => {
    if (!selectedRequest || selectedVendors.length === 0) return

    try {
      await QuoteRequestService.sendQuoteRequestToVendors(selectedRequest.id, selectedVendors)
      showToast.success(`Quote request sent to ${selectedVendors.length} vendor(s)`)
      setShowSendModal(false)
      setSelectedRequest(null)
      setSelectedVendors([])
      loadQuoteRequests()
    } catch (error: any) {
      console.error('Error sending quote request:', error)
      showToast.error(error.message || 'Failed to send quote request')
    }
  }

  const handleViewQuotes = async (request: QuoteRequest) => {
    try {
      setSelectedRequest(request)
      const quotesData = await QuoteRequestService.getQuotesForRequest(request.id)
      setQuotes(quotesData)
      setShowQuotesModal(true)
    } catch (error) {
      console.error('Error loading quotes:', error)
      showToast.error('Failed to load quotes')
    }
  }

  const handleAwardQuote = async (quoteId: string) => {
    if (!selectedRequest) return

    try {
      await QuoteRequestService.awardQuote(quoteId, selectedRequest.id)
      showToast.success('Quote awarded successfully')
      setShowQuotesModal(false)
      loadQuoteRequests()
      onQuoteUpdate?.()
    } catch (error: any) {
      console.error('Error awarding quote:', error)
      showToast.error(error.message || 'Failed to award quote')
    }
  }

  const resetForm = () => {
    setRequestItems([{ item_name: '', description: '', quantity: 1, unit: 'each', specifications: '' }])
  }

  const addRequestItem = () => {
    setRequestItems([...requestItems, { item_name: '', description: '', quantity: 1, unit: 'each', specifications: '' }])
  }

  const removeRequestItem = (index: number) => {
    if (requestItems.length > 1) {
      setRequestItems(requestItems.filter((_, i) => i !== index))
    }
  }

  const updateRequestItem = (index: number, field: keyof QuoteRequestItem, value: any) => {
    const updatedItems = [...requestItems]
    updatedItems[index] = { ...updatedItems[index], [field]: value }
    setRequestItems(updatedItems)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'badge-light-secondary'
      case 'sent': return 'badge-light-info'
      case 'responses_received': return 'badge-light-warning'
      case 'awarded': return 'badge-light-success'
      case 'cancelled': return 'badge-light-danger'
      default: return 'badge-light-secondary'
    }
  }

  const getQuoteStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': return 'badge-light-info'
      case 'under_review': return 'badge-light-warning'
      case 'accepted': return 'badge-light-success'
      case 'rejected': return 'badge-light-danger'
      default: return 'badge-light-secondary'
    }
  }

  if (loading) {
    return <div className="text-center">Loading quote requests...</div>
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Vendor Quote Requests</h3>
        <button 
          className="btn btn-primary btn-sm"
          onClick={() => setShowCreateModal(true)}
        >
          <i className="ki-duotone ki-plus fs-2 me-1">
            <span className="path1"></span>
            <span className="path2"></span>
          </i>
          Request Quotes
        </button>
      </div>
      
      <div className="card-body">
        {quoteRequests.length === 0 ? (
          <div className="text-center text-muted py-10">
            <i className="ki-duotone ki-message-question fs-3x text-muted mb-3">
              <span className="path1"></span>
              <span className="path2"></span>
              <span className="path3"></span>
            </i>
            <div className="mb-3">No quote requests created yet.</div>
            <div className="fs-7">Click "Request Quotes" to start getting bids from vendors.</div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-row-bordered">
              <thead>
                <tr className="fw-semibold fs-6 text-gray-800">
                  <th>Request #</th>
                  <th>Title</th>
                  <th>Trade</th>
                  <th>Status</th>
                  <th>Delivery Date</th>
                  <th>Quotes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {quoteRequests.map((request) => (
                  <tr key={request.id}>
                    <td>
                      <div className="fw-bold">{request.request_number}</div>
                      <div className="text-muted fs-7">
                        {new Date(request.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td>
                      <div className="fw-bold">{request.title}</div>
                      {request.description && (
                        <div className="text-muted fs-7">{request.description}</div>
                      )}
                    </td>
                    <td>
                      {request.trade_category ? (
                        <span className="badge badge-light-primary">
                          {request.trade_category.replace('_', ' ').toUpperCase()}
                        </span>
                      ) : (
                        <span className="text-muted">General</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${getStatusColor(request.status)}`}>
                        {request.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {request.requested_delivery_date ? 
                        new Date(request.requested_delivery_date).toLocaleDateString() :
                        'TBD'
                      }
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-light-info"
                        onClick={() => handleViewQuotes(request)}
                      >
                        View Quotes
                      </button>
                    </td>
                    <td>
                      <div className="d-flex gap-1">
                        {request.status === 'draft' && (
                          <button
                            className="btn btn-sm btn-light-success"
                            onClick={() => {
                              setSelectedRequest(request)
                              setShowSendModal(true)
                            }}
                            title="Send to Vendors"
                          >
                            <i className="ki-duotone ki-send fs-5">
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
        )}
      </div>

      {/* Create Quote Request Modal */}
      {showCreateModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Create Quote Request</h5>
                <button 
                  className="btn-close"
                  onClick={() => setShowCreateModal(false)}
                />
              </div>
              <form onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                handleCreateQuoteRequest(formData)
              }}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-8">
                      <div className="mb-3">
                        <label className="form-label required">Title</label>
                        <input type="text" className="form-control" name="title" required />
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="mb-3">
                        <label className="form-label">Trade Category</label>
                        <select className="form-select" name="trade_category">
                          <option value="">General</option>
                          <option value="electrical">Electrical</option>
                          <option value="plumbing">Plumbing</option>
                          <option value="hvac">HVAC</option>
                          <option value="general">General Construction</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Description</label>
                    <textarea className="form-control" name="description" rows={2}
                              placeholder="Brief description of what you need"></textarea>
                  </div>

                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Requested Delivery Date</label>
                        <input type="date" className="form-control" name="requested_delivery_date" />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Response Deadline</label>
                        <input type="datetime-local" className="form-control" name="response_deadline" />
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Site Address</label>
                    <input type="text" className="form-control" name="site_address" 
                           placeholder="Job site address for delivery" />
                  </div>

                  {/* Request Items */}
                  <div className="mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <label className="form-label required">Items Needed</label>
                      <button type="button" className="btn btn-sm btn-light-primary" onClick={addRequestItem}>
                        <i className="ki-duotone ki-plus fs-5 me-1">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        Add Item
                      </button>
                    </div>

                    <div className="table-responsive">
                      <table className="table table-bordered">
                        <thead>
                          <tr className="fw-bold fs-7 text-gray-800">
                            <th>Item Name</th>
                            <th>Description</th>
                            <th>Qty</th>
                            <th>Unit</th>
                            <th>Specifications</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {requestItems.map((item, index) => (
                            <tr key={index}>
                              <td>
                                <input 
                                  type="text" 
                                  className="form-control form-control-sm"
                                  value={item.item_name}
                                  onChange={(e) => updateRequestItem(index, 'item_name', e.target.value)}
                                  placeholder="Item name"
                                  required
                                />
                              </td>
                              <td>
                                <input 
                                  type="text" 
                                  className="form-control form-control-sm"
                                  value={item.description || ''}
                                  onChange={(e) => updateRequestItem(index, 'description', e.target.value)}
                                  placeholder="Brief description"
                                />
                              </td>
                              <td>
                                <input 
                                  type="number" 
                                  className="form-control form-control-sm"
                                  value={item.quantity}
                                  onChange={(e) => updateRequestItem(index, 'quantity', Number(e.target.value))}
                                  min="1"
                                  required
                                />
                              </td>
                              <td>
                                <select 
                                  className="form-select form-select-sm"
                                  value={item.unit}
                                  onChange={(e) => updateRequestItem(index, 'unit', e.target.value)}
                                >
                                  <option value="each">Each</option>
                                  <option value="linear_ft">Linear Ft</option>
                                  <option value="sq_ft">Sq Ft</option>
                                  <option value="hours">Hours</option>
                                  <option value="boxes">Boxes</option>
                                  <option value="rolls">Rolls</option>
                                </select>
                              </td>
                              <td>
                                <input 
                                  type="text" 
                                  className="form-control form-control-sm"
                                  value={item.specifications || ''}
                                  onChange={(e) => updateRequestItem(index, 'specifications', e.target.value)}
                                  placeholder="Brand, model, specs"
                                />
                              </td>
                              <td>
                                {requestItems.length > 1 && (
                                  <button 
                                    type="button" 
                                    className="btn btn-sm btn-light-danger"
                                    onClick={() => removeRequestItem(index)}
                                  >
                                    <i className="ki-duotone ki-trash fs-6">
                                      <span className="path1"></span>
                                      <span className="path2"></span>
                                      <span className="path3"></span>
                                      <span className="path4"></span>
                                      <span className="path5"></span>
                                    </i>
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Additional Notes</label>
                    <textarea className="form-control" name="notes" rows={3} 
                              placeholder="Special instructions, delivery requirements, etc."></textarea>
                  </div>
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Create Request
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Send to Vendors Modal */}
      {showSendModal && selectedRequest && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Send Quote Request to Vendors</h5>
                <button 
                  className="btn-close"
                  onClick={() => setShowSendModal(false)}
                />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <div className="fw-bold mb-2">Request: {selectedRequest.title}</div>
                  <div className="text-muted fs-7">{selectedRequest.description}</div>
                </div>

                <div className="mb-3">
                  <label className="form-label required">Select Vendors</label>
                  <div className="d-flex flex-column gap-2 max-h-300px overflow-auto">
                    {vendors.length === 0 ? (
                      <div className="text-muted">No vendors available. Add vendors first.</div>
                    ) : (
                      vendors
                        .filter(vendor => 
                          !selectedRequest.trade_category || 
                          vendor.trade_specialties.includes(selectedRequest.trade_category)
                        )
                        .map(vendor => (
                          <div key={vendor.id} className="form-check">
                            <input 
                              className="form-check-input" 
                              type="checkbox" 
                              value={vendor.id}
                              checked={selectedVendors.includes(vendor.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedVendors([...selectedVendors, vendor.id])
                                } else {
                                  setSelectedVendors(selectedVendors.filter(id => id !== vendor.id))
                                }
                              }}
                            />
                            <label className="form-check-label">
                              <div className="fw-bold">{vendor.company_name}</div>
                              <div className="text-muted fs-7">
                                {vendor.contact_name} • {vendor.email}
                                {vendor.preferred_vendor && (
                                  <span className="badge badge-light-success ms-2">Preferred</span>
                                )}
                              </div>
                            </label>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowSendModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={handleSendToVendors}
                  disabled={selectedVendors.length === 0}
                >
                  Send to {selectedVendors.length} Vendor(s)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Quotes Modal */}
      {showQuotesModal && selectedRequest && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-xl">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Quotes for: {selectedRequest.title}</h5>
                <button 
                  className="btn-close"
                  onClick={() => setShowQuotesModal(false)}
                />
              </div>
              <div className="modal-body">
                {quotes.length === 0 ? (
                  <div className="text-center text-muted py-10">
                    <i className="ki-duotone ki-message-question fs-3x text-muted mb-3">
                      <span className="path1"></span>
                      <span className="path2"></span>
                      <span className="path3"></span>
                    </i>
                    <div>No quotes received yet.</div>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-row-bordered">
                      <thead>
                        <tr className="fw-semibold fs-6 text-gray-800">
                          <th>Vendor</th>
                          <th>Total Amount</th>
                          <th>Delivery Date</th>
                          <th>Payment Terms</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quotes.map((quote) => (
                          <tr key={quote.id}>
                            <td>
                              <div className="fw-bold">{quote.vendor?.company_name}</div>
                              <div className="text-muted fs-7">
                                Quote #{quote.quote_number || quote.id.slice(-6)}
                              </div>
                            </td>
                            <td>
                              <div className="fw-bold text-success">
                                {QuoteRequestService.formatCurrency(quote.total_amount || 0)}
                              </div>
                              {quote.tax_amount && (
                                <div className="text-muted fs-7">
                                  +{QuoteRequestService.formatCurrency(quote.tax_amount)} tax
                                </div>
                              )}
                            </td>
                            <td>
                              {quote.quoted_delivery_date ? 
                                new Date(quote.quoted_delivery_date).toLocaleDateString() :
                                'TBD'
                              }
                            </td>
                            <td>
                              {quote.payment_terms || 'Standard'}
                            </td>
                            <td>
                              <span className={`badge ${getQuoteStatusColor(quote.status)}`}>
                                {quote.status.replace('_', ' ').toUpperCase()}
                              </span>
                            </td>
                            <td>
                              {quote.status === 'submitted' && selectedRequest.status !== 'awarded' && (
                                <button
                                  className="btn btn-sm btn-light-success"
                                  onClick={() => handleAwardQuote(quote.id)}
                                >
                                  Award Quote
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowQuotesModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}