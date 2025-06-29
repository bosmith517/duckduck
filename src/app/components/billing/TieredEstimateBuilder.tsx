import React, { useState, useEffect } from 'react'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'

interface ServiceItem {
  id: string
  name: string
  description: string
  default_rate: number
  unit_type: string
  category?: string
}

interface EstimateTier {
  id?: string
  tier_level: 'good' | 'better' | 'best'
  tier_name: string
  description: string
  line_items: EstimateLineItem[]
  total_amount: number
  labor_cost: number
  material_cost: number
  markup_amount: number
  is_selected: boolean
}

interface EstimateLineItem {
  id?: string
  service_catalog_id?: string
  description: string
  quantity: number
  unit_price: number
  line_total: number
  item_type: 'service' | 'material' | 'labor' | 'other'
}

interface TieredEstimateBuilderProps {
  accountId: string
  onSave: (estimateData: any) => void
  onCancel: () => void
  existingEstimate?: any
}

const TieredEstimateBuilder: React.FC<TieredEstimateBuilderProps> = ({
  accountId,
  onSave,
  onCancel,
  existingEstimate
}) => {
  const { userProfile } = useSupabaseAuth()
  
  // Form state
  const [projectTitle, setProjectTitle] = useState('')
  const [description, setDescription] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  
  // Service catalog
  const [serviceCatalog, setServiceCatalog] = useState<ServiceItem[]>([])
  const [categories, setCategories] = useState<any[]>([])
  
  // Tiers
  const [tiers, setTiers] = useState<EstimateTier[]>([
    {
      tier_level: 'good',
      tier_name: 'Good - Basic Option',
      description: 'Essential services to meet your needs',
      line_items: [],
      total_amount: 0,
      labor_cost: 0,
      material_cost: 0,
      markup_amount: 0,
      is_selected: false
    },
    {
      tier_level: 'better',
      tier_name: 'Better - Recommended',
      description: 'Enhanced solution with additional value',
      line_items: [],
      total_amount: 0,
      labor_cost: 0,
      material_cost: 0,
      markup_amount: 0,
      is_selected: true
    },
    {
      tier_level: 'best',
      tier_name: 'Best - Premium Option',
      description: 'Complete solution with premium features',
      line_items: [],
      total_amount: 0,
      labor_cost: 0,
      material_cost: 0,
      markup_amount: 0,
      is_selected: false
    }
  ])
  
  const [loading, setLoading] = useState(false)
  const [showServiceCatalog, setShowServiceCatalog] = useState(false)
  const [activeTierIndex, setActiveTierIndex] = useState(1) // Default to "Better"

  useEffect(() => {
    loadServiceCatalog()
    if (existingEstimate) {
      loadExistingEstimate()
    }
  }, [existingEstimate])

  const loadServiceCatalog = async () => {
    try {
      const { data: services, error: servicesError } = await supabase
        .from('service_catalog')
        .select(`
          *,
          service_categories(name)
        `)
        .eq('tenant_id', userProfile?.tenant_id)
        .eq('is_active', true)
        .order('name')

      if (servicesError) throw servicesError
      setServiceCatalog(services || [])

      const { data: categoriesData, error: categoriesError } = await supabase
        .from('service_categories')
        .select('*')
        .eq('tenant_id', userProfile?.tenant_id)
        .eq('is_active', true)
        .order('name')

      if (categoriesError) throw categoriesError
      setCategories(categoriesData || [])
      
    } catch (error) {
      console.error('Error loading service catalog:', error)
      showToast.error('Failed to load service catalog')
    }
  }

  const loadExistingEstimate = async () => {
    // Load existing estimate data if editing
    // Implementation would load tiers and line items
  }

  const addLineItemToTier = (tierIndex: number, serviceItem?: ServiceItem) => {
    const newLineItem: EstimateLineItem = {
      service_catalog_id: serviceItem?.id,
      description: serviceItem?.name || '',
      quantity: 1,
      unit_price: serviceItem?.default_rate || 0,
      line_total: serviceItem?.default_rate || 0,
      item_type: 'service'
    }

    setTiers(prev => {
      const updated = [...prev]
      updated[tierIndex].line_items.push(newLineItem)
      recalculateTierTotals(updated, tierIndex)
      return updated
    })
  }

  const updateLineItem = (tierIndex: number, itemIndex: number, field: keyof EstimateLineItem, value: any) => {
    setTiers(prev => {
      const updated = [...prev]
      const item = updated[tierIndex].line_items[itemIndex]
      
      if (field === 'quantity' || field === 'unit_price') {
        item[field] = parseFloat(value) || 0
        item.line_total = item.quantity * item.unit_price
      } else {
        (item as any)[field] = value
      }
      
      recalculateTierTotals(updated, tierIndex)
      return updated
    })
  }

  const removeLineItem = (tierIndex: number, itemIndex: number) => {
    setTiers(prev => {
      const updated = [...prev]
      updated[tierIndex].line_items.splice(itemIndex, 1)
      recalculateTierTotals(updated, tierIndex)
      return updated
    })
  }

  const recalculateTierTotals = (tiersArray: EstimateTier[], tierIndex: number) => {
    const tier = tiersArray[tierIndex]
    const subtotal = tier.line_items.reduce((sum, item) => sum + item.line_total, 0)
    
    // Simple calculation - can be enhanced with more complex pricing logic
    tier.labor_cost = tier.line_items
      .filter(item => item.item_type === 'labor' || item.item_type === 'service')
      .reduce((sum, item) => sum + item.line_total, 0)
    
    tier.material_cost = tier.line_items
      .filter(item => item.item_type === 'material')
      .reduce((sum, item) => sum + item.line_total, 0)
    
    tier.markup_amount = subtotal * 0.15 // 15% markup
    tier.total_amount = subtotal + tier.markup_amount
  }

  const updateTierInfo = (tierIndex: number, field: keyof EstimateTier, value: any) => {
    setTiers(prev => {
      const updated = [...prev]
      updated[tierIndex] = { ...updated[tierIndex], [field]: value }
      return updated
    })
  }

  const duplicateTierItems = (fromTierIndex: number, toTierIndex: number) => {
    setTiers(prev => {
      const updated = [...prev]
      const fromTier = updated[fromTierIndex]
      const toTier = updated[toTierIndex]
      
      // Copy line items and adjust prices based on tier level
      const multiplier = toTierIndex > fromTierIndex ? 1.2 : 0.8 // 20% increase/decrease
      
      toTier.line_items = fromTier.line_items.map(item => ({
        ...item,
        id: undefined, // Remove ID so it creates new items
        unit_price: item.unit_price * multiplier,
        line_total: item.quantity * (item.unit_price * multiplier)
      }))
      
      recalculateTierTotals(updated, toTierIndex)
      return updated
    })
  }

  const handleSave = async () => {
    if (!projectTitle.trim()) {
      showToast.error('Project title is required')
      return
    }

    const selectedTier = tiers.find(t => t.is_selected)
    if (!selectedTier) {
      showToast.error('Please select a tier as the default')
      return
    }

    setLoading(true)
    try {
      const estimateData = {
        tenant_id: userProfile?.tenant_id,
        account_id: accountId,
        project_title: projectTitle,
        description: description,
        valid_until: validUntil || null,
        notes: notes,
        template_type: 'tiered',
        total_amount: selectedTier.total_amount,
        labor_cost: selectedTier.labor_cost,
        material_cost: selectedTier.material_cost,
        status: 'draft',
        tiers: tiers
      }

      await onSave(estimateData)
    } catch (error) {
      console.error('Error saving estimate:', error)
      showToast.error('Failed to save estimate')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <h3 className="modal-title">
              <i className="ki-duotone ki-technology-4 fs-2 text-primary me-3">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              Create Tiered Estimate
            </h3>
            <button type="button" className="btn-close" onClick={onCancel}></button>
          </div>

          <div className="modal-body">
            {/* Project Information */}
            <div className="card mb-6">
              <div className="card-header">
                <h5 className="card-title mb-0">Project Information</h5>
              </div>
              <div className="card-body">
                <div className="row g-4">
                  <div className="col-md-6">
                    <label className="form-label required">Project Title</label>
                    <input
                      type="text"
                      className="form-control"
                      value={projectTitle}
                      onChange={(e) => setProjectTitle(e.target.value)}
                      placeholder="e.g., HVAC System Installation"
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Valid Until</label>
                    <input
                      type="date"
                      className="form-control"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Brief project description..."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Tier Tabs */}
            <div className="card">
              <div className="card-header">
                <ul className="nav nav-tabs nav-line-tabs nav-line-tabs-2x border-transparent fs-6 fw-bold">
                  {tiers.map((tier, index) => (
                    <li key={index} className="nav-item">
                      <a
                        className={`nav-link ${activeTierIndex === index ? 'active' : ''} ${tier.is_selected ? 'text-primary' : ''}`}
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          setActiveTierIndex(index)
                        }}
                      >
                        <i className={`ki-duotone ki-${
                          index === 0 ? 'medal' : index === 1 ? 'crown' : 'star'
                        } fs-4 me-2`}>
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        {tier.tier_name}
                        {tier.is_selected && (
                          <span className="badge badge-circle badge-primary ms-2">✓</span>
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card-body">
                {/* Active Tier Content */}
                <div className="row mb-6">
                  <div className="col-md-8">
                    <input
                      type="text"
                      className="form-control form-control-lg fw-bold"
                      value={tiers[activeTierIndex].tier_name}
                      onChange={(e) => updateTierInfo(activeTierIndex, 'tier_name', e.target.value)}
                      placeholder="Tier name..."
                    />
                  </div>
                  <div className="col-md-4 d-flex align-items-center">
                    <label className="form-check form-check-custom form-check-solid">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="selected_tier"
                        checked={tiers[activeTierIndex].is_selected}
                        onChange={() => {
                          setTiers(prev => prev.map((t, i) => ({
                            ...t,
                            is_selected: i === activeTierIndex
                          })))
                        }}
                      />
                      <span className="form-check-label fw-bold">
                        Default Selection
                      </span>
                    </label>
                  </div>
                </div>

                <div className="row mb-6">
                  <div className="col-12">
                    <textarea
                      className="form-control"
                      rows={2}
                      value={tiers[activeTierIndex].description}
                      onChange={(e) => updateTierInfo(activeTierIndex, 'description', e.target.value)}
                      placeholder="Tier description for client..."
                    />
                  </div>
                </div>

                {/* Line Items */}
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h6 className="mb-0">Line Items</h6>
                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-sm btn-light-primary"
                      onClick={() => setShowServiceCatalog(true)}
                    >
                      <i className="ki-duotone ki-plus fs-6 me-1">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Add from Catalog
                    </button>
                    <button
                      className="btn btn-sm btn-light-success"
                      onClick={() => addLineItemToTier(activeTierIndex)}
                    >
                      <i className="ki-duotone ki-plus fs-6 me-1">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Add Custom Item
                    </button>
                    {activeTierIndex > 0 && (
                      <button
                        className="btn btn-sm btn-light-info"
                        onClick={() => duplicateTierItems(activeTierIndex - 1, activeTierIndex)}
                      >
                        <i className="ki-duotone ki-copy fs-6 me-1">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        Copy from Previous
                      </button>
                    )}
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="table-responsive">
                  <table className="table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4">
                    <thead>
                      <tr className="fw-bold text-muted">
                        <th className="min-w-200px">Description</th>
                        <th className="w-100px">Qty</th>
                        <th className="w-100px">Rate</th>
                        <th className="w-100px">Total</th>
                        <th className="w-80px">Type</th>
                        <th className="w-50px"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {tiers[activeTierIndex].line_items.map((item, itemIndex) => (
                        <tr key={itemIndex}>
                          <td>
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              value={item.description}
                              onChange={(e) => updateLineItem(activeTierIndex, itemIndex, 'description', e.target.value)}
                              placeholder="Item description..."
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="form-control form-control-sm"
                              value={item.quantity}
                              onChange={(e) => updateLineItem(activeTierIndex, itemIndex, 'quantity', e.target.value)}
                              min="0"
                              step="0.01"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="form-control form-control-sm"
                              value={item.unit_price}
                              onChange={(e) => updateLineItem(activeTierIndex, itemIndex, 'unit_price', e.target.value)}
                              min="0"
                              step="0.01"
                            />
                          </td>
                          <td>
                            <span className="fw-bold text-dark">
                              ${item.line_total.toFixed(2)}
                            </span>
                          </td>
                          <td>
                            <select
                              className="form-select form-select-sm"
                              value={item.item_type}
                              onChange={(e) => updateLineItem(activeTierIndex, itemIndex, 'item_type', e.target.value)}
                            >
                              <option value="service">Service</option>
                              <option value="material">Material</option>
                              <option value="labor">Labor</option>
                              <option value="other">Other</option>
                            </select>
                          </td>
                          <td>
                            <button
                              className="btn btn-sm btn-icon btn-light-danger"
                              onClick={() => removeLineItem(activeTierIndex, itemIndex)}
                            >
                              <i className="ki-duotone ki-trash fs-6">
                                <span className="path1"></span>
                                <span className="path2"></span>
                                <span className="path3"></span>
                                <span className="path4"></span>
                                <span className="path5"></span>
                              </i>
                            </button>
                          </td>
                        </tr>
                      ))}
                      {tiers[activeTierIndex].line_items.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center text-muted py-8">
                            No items added yet. Click "Add from Catalog" or "Add Custom Item" to get started.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Tier Summary */}
                <div className="row mt-6">
                  <div className="col-md-8"></div>
                  <div className="col-md-4">
                    <div className="card border border-dashed border-primary">
                      <div className="card-body p-4">
                        <div className="d-flex justify-content-between mb-2">
                          <span className="text-muted">Labor:</span>
                          <span className="fw-bold">${tiers[activeTierIndex].labor_cost.toFixed(2)}</span>
                        </div>
                        <div className="d-flex justify-content-between mb-2">
                          <span className="text-muted">Materials:</span>
                          <span className="fw-bold">${tiers[activeTierIndex].material_cost.toFixed(2)}</span>
                        </div>
                        <div className="d-flex justify-content-between mb-2">
                          <span className="text-muted">Markup:</span>
                          <span className="fw-bold">${tiers[activeTierIndex].markup_amount.toFixed(2)}</span>
                        </div>
                        <div className="separator my-3"></div>
                        <div className="d-flex justify-content-between">
                          <span className="fs-4 fw-bold text-dark">Total:</span>
                          <span className="fs-4 fw-bold text-primary">
                            ${tiers[activeTierIndex].total_amount.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="card mt-6">
              <div className="card-body">
                <label className="form-label">Additional Notes</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Terms, conditions, or additional information..."
                />
              </div>
            </div>

            {/* Tier Comparison */}
            <div className="card mt-6">
              <div className="card-header">
                <h5 className="card-title mb-0">Tier Comparison</h5>
              </div>
              <div className="card-body">
                <div className="row g-4">
                  {tiers.map((tier, index) => (
                    <div key={index} className="col-md-4">
                      <div className={`card h-100 ${tier.is_selected ? 'border-primary' : 'border-light'}`}>
                        <div className="card-header bg-light">
                          <h6 className="card-title mb-0 d-flex align-items-center">
                            <i className={`ki-duotone ki-${
                              index === 0 ? 'medal' : index === 1 ? 'crown' : 'star'
                            } fs-4 me-2 text-${
                              index === 0 ? 'warning' : index === 1 ? 'primary' : 'success'
                            }`}>
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                            {tier.tier_name}
                            {tier.is_selected && (
                              <span className="badge badge-primary ms-auto">Recommended</span>
                            )}
                          </h6>
                        </div>
                        <div className="card-body">
                          <div className="text-center mb-4">
                            <div className="fs-2x fw-bold text-dark">
                              ${tier.total_amount.toFixed(2)}
                            </div>
                            <div className="text-muted fs-7">
                              {tier.line_items.length} items included
                            </div>
                          </div>
                          <p className="text-muted fs-6">
                            {tier.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-light text-dark" onClick={onCancel}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={loading}
            >
              {loading && <span className="spinner-border spinner-border-sm me-2"></span>}
              Save Tiered Estimate
            </button>
          </div>
        </div>
      </div>

      {/* Service Catalog Modal */}
      {showServiceCatalog && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Service Catalog</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowServiceCatalog(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="row g-4">
                  {serviceCatalog.map((service) => (
                    <div key={service.id} className="col-md-6">
                      <div className="card border border-light h-100">
                        <div className="card-body">
                          <h6 className="card-title">{service.name}</h6>
                          <p className="text-muted fs-7 mb-3">{service.description}</p>
                          <div className="d-flex justify-content-between align-items-center">
                            <span className="fw-bold text-primary">
                              ${service.default_rate.toFixed(2)} / {service.unit_type}
                            </span>
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => {
                                addLineItemToTier(activeTierIndex, service)
                                setShowServiceCatalog(false)
                              }}
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {serviceCatalog.length === 0 && (
                  <div className="text-center py-8">
                    <i className="ki-duotone ki-information fs-3x text-muted mb-3">
                      <span className="path1"></span>
                      <span className="path2"></span>
                      <span className="path3"></span>
                    </i>
                    <p className="text-muted">No services in catalog. Set up your service library first.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TieredEstimateBuilder
