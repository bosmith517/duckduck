import React, { useState, useEffect } from 'react'
import { VendorService, Vendor } from '../../services/vendorService'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { showToast } from '../../utils/toast'

interface VendorManagerProps {
  onVendorUpdate?: () => void
}

export const VendorManager: React.FC<VendorManagerProps> = ({ onVendorUpdate }) => {
  const { userProfile } = useSupabaseAuth()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [selectedTrades, setSelectedTrades] = useState<string[]>([])

  const tradeOptions = [
    { value: 'electrical', label: 'Electrical' },
    { value: 'plumbing', label: 'Plumbing' },
    { value: 'hvac', label: 'HVAC' },
    { value: 'general', label: 'General Construction' },
    { value: 'roofing', label: 'Roofing' },
    { value: 'flooring', label: 'Flooring' },
    { value: 'painting', label: 'Painting' },
    { value: 'landscaping', label: 'Landscaping' }
  ]

  useEffect(() => {
    if (userProfile?.tenant_id) {
      loadVendors()
    }
  }, [userProfile?.tenant_id])

  const loadVendors = async () => {
    if (!userProfile?.tenant_id) return

    try {
      setLoading(true)
      const data = await VendorService.getVendors(userProfile.tenant_id)
      setVendors(data)
    } catch (error) {
      console.error('Error loading vendors:', error)
      showToast.error('Failed to load vendors')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    try {
      const vendorData = {
        company_name: formData.get('company_name') as string,
        contact_name: formData.get('contact_name') as string || undefined,
        email: formData.get('email') as string,
        phone: formData.get('phone') as string || undefined,
        address: formData.get('address') as string || undefined,
        city: formData.get('city') as string || undefined,
        state: formData.get('state') as string || undefined,
        zip: formData.get('zip') as string || undefined,
        website: formData.get('website') as string || undefined,
        trade_specialties: selectedTrades,
        preferred_vendor: formData.get('preferred_vendor') === 'on',
        payment_terms: formData.get('payment_terms') as string || undefined,
        tax_id: formData.get('tax_id') as string || undefined,
        license_number: formData.get('license_number') as string || undefined,
        insurance_expiry: formData.get('insurance_expiry') as string || undefined,
        notes: formData.get('notes') as string || undefined
      }

      if (editingVendor) {
        await VendorService.updateVendor(editingVendor.id, vendorData)
        showToast.success('Vendor updated successfully')
      } else {
        await VendorService.createVendor(vendorData)
        showToast.success('Vendor created successfully')
      }

      setShowCreateModal(false)
      setEditingVendor(null)
      setSelectedTrades([])
      loadVendors()
      onVendorUpdate?.()
    } catch (error: any) {
      console.error('Error saving vendor:', error)
      showToast.error(error.message || 'Failed to save vendor')
    }
  }

  const handleEdit = (vendor: Vendor) => {
    setEditingVendor(vendor)
    setSelectedTrades(vendor.trade_specialties || [])
    setShowCreateModal(true)
  }

  const handleDelete = async (vendorId: string) => {
    if (!confirm('Are you sure you want to deactivate this vendor?')) return

    try {
      await VendorService.deleteVendor(vendorId)
      showToast.success('Vendor deactivated successfully')
      loadVendors()
    } catch (error: any) {
      console.error('Error deactivating vendor:', error)
      showToast.error(error.message || 'Failed to deactivate vendor')
    }
  }

  const handleTradeToggle = (trade: string) => {
    setSelectedTrades(prev => 
      prev.includes(trade) 
        ? prev.filter(t => t !== trade)
        : [...prev, trade]
    )
  }

  const resetForm = () => {
    setEditingVendor(null)
    setSelectedTrades([])
    setShowCreateModal(false)
  }

  if (loading) {
    return <div className="text-center">Loading vendors...</div>
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Vendor Management</h3>
        <button 
          className="btn btn-primary btn-sm"
          onClick={() => setShowCreateModal(true)}
        >
          <i className="ki-duotone ki-plus fs-2 me-1">
            <span className="path1"></span>
            <span className="path2"></span>
          </i>
          Add Vendor
        </button>
      </div>
      
      <div className="card-body">
        {vendors.length === 0 ? (
          <div className="text-center text-muted py-10">
            <i className="ki-duotone ki-shop fs-3x text-muted mb-3">
              <span className="path1"></span>
              <span className="path2"></span>
              <span className="path3"></span>
              <span className="path4"></span>
            </i>
            <div className="mb-3">No vendors added yet.</div>
            <div className="fs-7">Add vendors to send quote requests and manage supplier relationships.</div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-row-bordered">
              <thead>
                <tr className="fw-semibold fs-6 text-gray-800">
                  <th>Company</th>
                  <th>Contact</th>
                  <th>Trade Specialties</th>
                  <th>Status</th>
                  <th>Payment Terms</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((vendor) => (
                  <tr key={vendor.id}>
                    <td>
                      <div className="d-flex flex-column">
                        <div className="fw-bold">{vendor.company_name}</div>
                        {vendor.preferred_vendor && (
                          <span className="badge badge-light-success badge-sm">Preferred</span>
                        )}
                        {vendor.email && (
                          <div className="text-muted fs-7">{vendor.email}</div>
                        )}
                        {vendor.website && (
                          <a href={vendor.website} target="_blank" rel="noopener noreferrer" 
                             className="text-primary fs-7">
                            Website
                          </a>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="d-flex flex-column">
                        {vendor.contact_name && (
                          <div className="fw-bold">{vendor.contact_name}</div>
                        )}
                        {vendor.phone && (
                          <div className="text-muted fs-7">{vendor.phone}</div>
                        )}
                        {vendor.city && vendor.state && (
                          <div className="text-muted fs-7">{vendor.city}, {vendor.state}</div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="d-flex flex-wrap gap-1">
                        {vendor.trade_specialties.map(trade => (
                          <span key={trade} className="badge badge-light-primary badge-sm">
                            {trade.replace('_', ' ').toUpperCase()}
                          </span>
                        ))}
                        {vendor.trade_specialties.length === 0 && (
                          <span className="text-muted">General</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${vendor.active ? 'badge-light-success' : 'badge-light-danger'}`}>
                        {vendor.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      {vendor.payment_terms || 'Standard'}
                    </td>
                    <td>
                      <div className="d-flex gap-1">
                        <button
                          className="btn btn-sm btn-light-primary"
                          onClick={() => handleEdit(vendor)}
                          title="Edit Vendor"
                        >
                          <i className="ki-duotone ki-pencil fs-5">
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                        </button>
                        <button
                          className="btn btn-sm btn-light-danger"
                          onClick={() => handleDelete(vendor.id)}
                          title="Deactivate Vendor"
                        >
                          <i className="ki-duotone ki-trash fs-5">
                            <span className="path1"></span>
                            <span className="path2"></span>
                            <span className="path3"></span>
                            <span className="path4"></span>
                            <span className="path5"></span>
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
      </div>

      {/* Create/Edit Vendor Modal */}
      {showCreateModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editingVendor ? 'Edit Vendor' : 'Add New Vendor'}
                </h5>
                <button 
                  className="btn-close"
                  onClick={resetForm}
                />
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-8">
                      <div className="mb-3">
                        <label className="form-label required">Company Name</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          name="company_name" 
                          defaultValue={editingVendor?.company_name || ''}
                          required 
                        />
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="mb-3">
                        <div className="form-check form-switch">
                          <input 
                            className="form-check-input" 
                            type="checkbox" 
                            name="preferred_vendor"
                            defaultChecked={editingVendor?.preferred_vendor || false}
                          />
                          <label className="form-check-label">Preferred Vendor</label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Contact Name</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          name="contact_name"
                          defaultValue={editingVendor?.contact_name || ''}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label required">Email</label>
                        <input 
                          type="email" 
                          className="form-control" 
                          name="email"
                          defaultValue={editingVendor?.email || ''}
                          required 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Phone</label>
                        <input 
                          type="tel" 
                          className="form-control" 
                          name="phone"
                          defaultValue={editingVendor?.phone || ''}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Website</label>
                        <input 
                          type="url" 
                          className="form-control" 
                          name="website"
                          defaultValue={editingVendor?.website || ''}
                          placeholder="https://"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Address</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      name="address"
                      defaultValue={editingVendor?.address || ''}
                    />
                  </div>

                  <div className="row">
                    <div className="col-md-4">
                      <div className="mb-3">
                        <label className="form-label">City</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          name="city"
                          defaultValue={editingVendor?.city || ''}
                        />
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="mb-3">
                        <label className="form-label">State</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          name="state"
                          defaultValue={editingVendor?.state || ''}
                        />
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="mb-3">
                        <label className="form-label">ZIP Code</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          name="zip"
                          defaultValue={editingVendor?.zip || ''}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Trade Specialties</label>
                    <div className="d-flex flex-wrap gap-2">
                      {tradeOptions.map(trade => (
                        <div key={trade.value} className="form-check">
                          <input 
                            className="form-check-input" 
                            type="checkbox" 
                            checked={selectedTrades.includes(trade.value)}
                            onChange={() => handleTradeToggle(trade.value)}
                          />
                          <label className="form-check-label">
                            {trade.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-md-4">
                      <div className="mb-3">
                        <label className="form-label">Payment Terms</label>
                        <select className="form-select" name="payment_terms" 
                                defaultValue={editingVendor?.payment_terms || ''}>
                          <option value="">Standard</option>
                          <option value="net_15">Net 15</option>
                          <option value="net_30">Net 30</option>
                          <option value="net_60">Net 60</option>
                          <option value="cod">Cash on Delivery</option>
                          <option value="prepaid">Prepaid</option>
                        </select>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="mb-3">
                        <label className="form-label">License Number</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          name="license_number"
                          defaultValue={editingVendor?.license_number || ''}
                        />
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="mb-3">
                        <label className="form-label">Insurance Expiry</label>
                        <input 
                          type="date" 
                          className="form-control" 
                          name="insurance_expiry"
                          defaultValue={editingVendor?.insurance_expiry || ''}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Tax ID</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      name="tax_id"
                      defaultValue={editingVendor?.tax_id || ''}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Notes</label>
                    <textarea 
                      className="form-control" 
                      name="notes" 
                      rows={3}
                      defaultValue={editingVendor?.notes || ''}
                      placeholder="Special instructions, certifications, etc."
                    ></textarea>
                  </div>
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={resetForm}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingVendor ? 'Update Vendor' : 'Create Vendor'}
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