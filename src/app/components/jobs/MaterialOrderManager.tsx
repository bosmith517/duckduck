import React, { useState, useEffect } from 'react'
import { MaterialOrderService, JobMaterialOrder, MaterialOrderItem } from '../../services/teamAssignmentService'
import { VendorQuoteRequestManager } from './VendorQuoteRequestManager'
import { showToast } from '../../utils/toast'

interface MaterialOrderManagerProps {
  jobId: string
  onOrderUpdate?: () => void
}

export const MaterialOrderManager: React.FC<MaterialOrderManagerProps> = ({
  jobId,
  onOrderUpdate
}) => {
  const [orders, setOrders] = useState<JobMaterialOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('orders')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<JobMaterialOrder | null>(null)
  const [orderItems, setOrderItems] = useState<MaterialOrderItem[]>([
    { item_name: '', quantity: 1, unit_price: 0, total_price: 0 }
  ])

  useEffect(() => {
    loadMaterialOrders()
  }, [jobId])

  const loadMaterialOrders = async () => {
    try {
      setLoading(true)
      const data = await MaterialOrderService.getMaterialOrdersForJob(jobId)
      setOrders(data)
    } catch (error) {
      console.error('Error loading material orders:', error)
      showToast.error('Failed to load material orders')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateOrder = async (orderData: any) => {
    try {
      await MaterialOrderService.createMaterialOrder({
        ...orderData,
        job_id: jobId,
        items: orderItems.filter(item => item.item_name.trim())
      })
      showToast.success('Material order created successfully')
      setShowCreateModal(false)
      resetForm()
      loadMaterialOrders()
      onOrderUpdate?.()
    } catch (error: any) {
      console.error('Error creating material order:', error)
      showToast.error(error.message || 'Failed to create material order')
    }
  }

  const handleUpdateOrderStatus = async (
    orderId: string, 
    status: string,
    actualDelivery?: string,
    notes?: string
  ) => {
    try {
      await MaterialOrderService.updateOrderStatus(orderId, status as any, actualDelivery, notes)
      showToast.success('Order status updated')
      setShowUpdateModal(false)
      setSelectedOrder(null)
      loadMaterialOrders()
      onOrderUpdate?.()
    } catch (error) {
      console.error('Error updating order status:', error)
      showToast.error('Failed to update order status')
    }
  }

  const resetForm = () => {
    setOrderItems([{ item_name: '', quantity: 1, unit_price: 0, total_price: 0 }])
  }

  const addOrderItem = () => {
    setOrderItems([...orderItems, { item_name: '', quantity: 1, unit_price: 0, total_price: 0 }])
  }

  const removeOrderItem = (index: number) => {
    if (orderItems.length > 1) {
      setOrderItems(orderItems.filter((_, i) => i !== index))
    }
  }

  const updateOrderItem = (index: number, field: keyof MaterialOrderItem, value: any) => {
    const updatedItems = [...orderItems]
    updatedItems[index] = { ...updatedItems[index], [field]: value }
    
    // Recalculate total price
    if (field === 'quantity' || field === 'unit_price') {
      updatedItems[index].total_price = updatedItems[index].quantity * updatedItems[index].unit_price
    }
    
    setOrderItems(updatedItems)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'badge-light-warning'
      case 'ordered': return 'badge-light-info'
      case 'partial': return 'badge-light-primary'
      case 'delivered': return 'badge-light-success'
      case 'cancelled': return 'badge-light-danger'
      default: return 'badge-light-secondary'
    }
  }

  const getOrderTotal = () => {
    return orderItems.reduce((sum, item) => sum + item.total_price, 0)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const isOverdue = (order: JobMaterialOrder) => {
    if (!order.expected_delivery) return false
    return new Date(order.expected_delivery) < new Date() && 
           (order.status === 'ordered' || order.status === 'partial')
  }

  if (loading) {
    return <div className="text-center">Loading material orders...</div>
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Material Procurement</h3>
        <div className="card-toolbar">
          <ul className="nav nav-tabs nav-line-tabs nav-stretch fs-6 border-0">
            <li className="nav-item">
              <a
                className={`nav-link ${activeTab === 'orders' ? 'active' : ''}`}
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  setActiveTab('orders')
                }}
              >
                <i className="ki-duotone ki-package fs-6 me-1">
                  <span className="path1"></span>
                  <span className="path2"></span>
                  <span className="path3"></span>
                </i>
                Orders
              </a>
            </li>
            <li className="nav-item">
              <a
                className={`nav-link ${activeTab === 'quotes' ? 'active' : ''}`}
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  setActiveTab('quotes')
                }}
              >
                <i className="ki-duotone ki-message-question fs-6 me-1">
                  <span className="path1"></span>
                  <span className="path2"></span>
                  <span className="path3"></span>
                </i>
                Quote Requests
              </a>
            </li>
          </ul>
        </div>
      </div>
      
      <div className="card-body">
        {activeTab === 'orders' && (
          <>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h5 className="mb-0">Material Orders</h5>
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => setShowCreateModal(true)}
              >
                <i className="ki-duotone ki-plus fs-2 me-1">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                Create Order
              </button>
            </div>

            {orders.length === 0 ? (
              <div className="text-center text-muted py-10">
                <i className="ki-duotone ki-package fs-3x text-muted mb-3">
                  <span className="path1"></span>
                  <span className="path2"></span>
                  <span className="path3"></span>
                </i>
                <div className="mb-3">No material orders created yet.</div>
                <div className="fs-7">Click "Create Order" to start tracking material procurement for this job.</div>
              </div>
            ) : (
          <div className="table-responsive">
            <table className="table table-row-bordered">
              <thead>
                <tr className="fw-semibold fs-6 text-gray-800">
                  <th>Order #</th>
                  <th>Vendor</th>
                  <th>Status</th>
                  <th>Order Date</th>
                  <th>Expected Delivery</th>
                  <th>Total Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className={isOverdue(order) ? 'bg-light-danger' : ''}>
                    <td>
                      <div className="d-flex flex-column">
                        <span className="fw-bold">{order.order_number || `ORD-${order.id.slice(-6)}`}</span>
                        <span className="text-muted fs-7">
                          {order.items.length} item{order.items.length === 1 ? '' : 's'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="d-flex flex-column">
                        <span className="fw-bold">{order.vendor_name}</span>
                        {order.vendor_contact && (
                          <span className="text-muted fs-7">{order.vendor_contact}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${getStatusColor(order.status)}`}>
                        {order.status.replace('_', ' ').toUpperCase()}
                      </span>
                      {isOverdue(order) && (
                        <div className="text-danger fs-8 fw-bold mt-1">OVERDUE</div>
                      )}
                    </td>
                    <td>
                      <span className="fw-bold">
                        {order.order_date ? 
                          new Date(order.order_date).toLocaleDateString() :
                          'Not set'
                        }
                      </span>
                    </td>
                    <td>
                      <span className="fw-bold">
                        {order.expected_delivery ? 
                          new Date(order.expected_delivery).toLocaleDateString() :
                          'TBD'
                        }
                      </span>
                      {order.actual_delivery && (
                        <div className="text-success fs-8">
                          Delivered: {new Date(order.actual_delivery).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="fw-bold text-success">
                        {formatCurrency(order.order_total || 0)}
                      </span>
                    </td>
                    <td>
                      <div className="d-flex gap-1">
                        {order.status === 'pending' && (
                          <button
                            className="btn btn-sm btn-light-info"
                            onClick={() => handleUpdateOrderStatus(order.id, 'ordered')}
                            title="Mark as Ordered"
                          >
                            <i className="ki-duotone ki-send fs-5">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                          </button>
                        )}
                        {(order.status === 'ordered' || order.status === 'partial') && (
                          <button
                            className="btn btn-sm btn-light-success"
                            onClick={() => {
                              setSelectedOrder(order)
                              setShowUpdateModal(true)
                            }}
                            title="Update Delivery Status"
                          >
                            <i className="ki-duotone ki-check fs-5">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                          </button>
                        )}
                        <button
                          className="btn btn-sm btn-light-primary"
                          onClick={() => {
                            // TODO: Show order details modal
                            alert('Order details view will be implemented')
                          }}
                          title="View Details"
                        >
                          <i className="ki-duotone ki-eye fs-5">
                            <span className="path1"></span>
                            <span className="path2"></span>
                            <span className="path3"></span>
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
          </>
        )}

        {activeTab === 'quotes' && (
          <VendorQuoteRequestManager 
            jobId={jobId}
            onQuoteUpdate={() => {
              // Refresh when quotes are updated
              onOrderUpdate?.()
            }}
          />
        )}
      </div>

      {/* Create Order Modal */}
      {showCreateModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Create Material Order</h5>
                <button 
                  className="btn-close"
                  onClick={() => setShowCreateModal(false)}
                />
              </div>
              <form onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                handleCreateOrder({
                  vendor_name: formData.get('vendor_name'),
                  vendor_contact: formData.get('vendor_contact'),
                  expected_delivery: formData.get('expected_delivery'),
                  notes: formData.get('notes')
                })
              }}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label required">Vendor Name</label>
                        <input type="text" className="form-control" name="vendor_name" required />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Vendor Contact</label>
                        <input type="text" className="form-control" name="vendor_contact" 
                               placeholder="Phone or email" />
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Expected Delivery Date</label>
                    <input type="date" className="form-control" name="expected_delivery" />
                  </div>

                  {/* Order Items */}
                  <div className="mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <label className="form-label required">Order Items</label>
                      <button type="button" className="btn btn-sm btn-light-primary" onClick={addOrderItem}>
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
                            <th>Unit Price</th>
                            <th>Total</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orderItems.map((item, index) => (
                            <tr key={index}>
                              <td>
                                <input 
                                  type="text" 
                                  className="form-control form-control-sm"
                                  value={item.item_name}
                                  onChange={(e) => updateOrderItem(index, 'item_name', e.target.value)}
                                  placeholder="Item name"
                                  required
                                />
                              </td>
                              <td>
                                <input 
                                  type="text" 
                                  className="form-control form-control-sm"
                                  value={item.description || ''}
                                  onChange={(e) => updateOrderItem(index, 'description', e.target.value)}
                                  placeholder="Description"
                                />
                              </td>
                              <td>
                                <input 
                                  type="number" 
                                  className="form-control form-control-sm"
                                  value={item.quantity}
                                  onChange={(e) => updateOrderItem(index, 'quantity', Number(e.target.value))}
                                  min="1"
                                  required
                                />
                              </td>
                              <td>
                                <input 
                                  type="number" 
                                  className="form-control form-control-sm"
                                  value={item.unit_price}
                                  onChange={(e) => updateOrderItem(index, 'unit_price', Number(e.target.value))}
                                  step="0.01"
                                  min="0"
                                  required
                                />
                              </td>
                              <td>
                                <span className="fw-bold text-success">
                                  {formatCurrency(item.total_price)}
                                </span>
                              </td>
                              <td>
                                {orderItems.length > 1 && (
                                  <button 
                                    type="button" 
                                    className="btn btn-sm btn-light-danger"
                                    onClick={() => removeOrderItem(index)}
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
                        <tfoot>
                          <tr>
                            <td colSpan={4} className="text-end fw-bold">Order Total:</td>
                            <td className="fw-bold text-success">{formatCurrency(getOrderTotal())}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Notes</label>
                    <textarea className="form-control" name="notes" rows={3} 
                              placeholder="Special instructions or notes"></textarea>
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
                    Create Order ({formatCurrency(getOrderTotal())})
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Update Order Status Modal */}
      {showUpdateModal && selectedOrder && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Update Order Status</h5>
                <button 
                  className="btn-close"
                  onClick={() => setShowUpdateModal(false)}
                />
              </div>
              <form onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                handleUpdateOrderStatus(
                  selectedOrder.id,
                  formData.get('status') as string,
                  formData.get('actual_delivery') as string || undefined,
                  formData.get('notes') as string || undefined
                )
              }}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label required">New Status</label>
                    <select className="form-select" name="status" required>
                      <option value="">Select status...</option>
                      <option value="ordered">Ordered</option>
                      <option value="partial">Partially Delivered</option>
                      <option value="delivered">Fully Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Actual Delivery Date</label>
                    <input type="date" className="form-control" name="actual_delivery" />
                    <div className="form-text">
                      Only set this if the order has been delivered (partial or full).
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Update Notes</label>
                    <textarea className="form-control" name="notes" rows={3} 
                              placeholder="Any notes about this status update..."></textarea>
                  </div>
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => setShowUpdateModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Update Status
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}