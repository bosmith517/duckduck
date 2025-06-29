import React, { useState } from 'react'
import { KTCard, KTCardBody, KTIcon } from '../../../_metronic/helpers'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'

interface TemplateBuilderProps {
  template?: any
  onSave: (template: any) => void
  onCancel: () => void
}

const EstimateTemplateBuilder: React.FC<TemplateBuilderProps> = ({ template, onSave, onCancel }) => {
  const { userProfile } = useSupabaseAuth()
  const [saving, setSaving] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  
  const [templateData, setTemplateData] = useState({
    name: template?.name || '',
    description: template?.description || '',
    service_type: template?.service_type || '',
    category: template?.category || 'installation',
    base_price: template?.base_price || 0,
    markup_percentage: template?.markup_percentage || 20,
    tax_rate: template?.tax_rate || 8.5,
    estimated_duration_days: template?.estimated_duration_days || 1,
    pricing_tiers: template?.pricing_tiers || {
      basic: { name: 'Basic Package', description: '', price: 0, includes: [] },
      standard: { name: 'Standard Package', description: '', price: 0, includes: [] },
      premium: { name: 'Premium Package', description: '', price: 0, includes: [] }
    },
    line_items: template?.line_items || [],
    variables: template?.variables || []
  })

  const steps = [
    { id: 'basic', title: 'Basic Info', icon: 'information' },
    { id: 'pricing', title: 'Pricing Tiers', icon: 'dollar' },
    { id: 'line_items', title: 'Line Items', icon: 'notepad' },
    { id: 'variables', title: 'Variables', icon: 'setting-2' },
    { id: 'review', title: 'Review', icon: 'check' }
  ]

  const serviceTypes = [
    'hvac', 'plumbing', 'electrical', 'roofing', 'flooring', 'painting', 
    'landscaping', 'concrete', 'carpentry', 'cleaning', 'pest_control', 'custom'
  ]

  const categories = [
    { value: 'installation', label: 'Installation' },
    { value: 'repair', label: 'Repair' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'consultation', label: 'Consultation' },
    { value: 'emergency', label: 'Emergency' },
    { value: 'custom', label: 'Custom' }
  ]

  const lineItemCategories = [
    { value: 'labor', label: 'Labor' },
    { value: 'materials', label: 'Materials' },
    { value: 'equipment', label: 'Equipment' },
    { value: 'permits', label: 'Permits' },
    { value: 'disposal', label: 'Disposal' },
    { value: 'travel', label: 'Travel' }
  ]

  const unitTypes = [
    { value: 'hour', label: 'Hour' },
    { value: 'day', label: 'Day' },
    { value: 'item', label: 'Item' },
    { value: 'sqft', label: 'Square Foot' },
    { value: 'linear_ft', label: 'Linear Foot' },
    { value: 'cubic_yard', label: 'Cubic Yard' },
    { value: 'gallon', label: 'Gallon' },
    { value: 'ton', label: 'Ton' }
  ]

  const variableTypes = [
    { value: 'number', label: 'Number' },
    { value: 'text', label: 'Text' },
    { value: 'select', label: 'Dropdown' },
    { value: 'checkbox', label: 'Checkbox' },
    { value: 'area_measurement', label: 'Area Measurement' }
  ]

  const addLineItem = () => {
    const newItem = {
      id: Date.now().toString(),
      name: '',
      description: '',
      category: 'materials',
      unit_type: 'item',
      unit_price: 0,
      quantity: 1,
      is_variable: false,
      variable_name: '',
      markup_percentage: 0
    }
    setTemplateData(prev => ({
      ...prev,
      line_items: [...prev.line_items, newItem]
    }))
  }

  const updateLineItem = (index: number, field: string, value: any) => {
    setTemplateData(prev => ({
      ...prev,
      line_items: prev.line_items.map((item: any, i: number) => 
        i === index ? { ...item, [field]: value } : item
      )
    }))
  }

  const removeLineItem = (index: number) => {
    setTemplateData(prev => ({
      ...prev,
      line_items: prev.line_items.filter((_: any, i: number) => i !== index)
    }))
  }

  const addVariable = () => {
    const newVariable = {
      name: '',
      display_name: '',
      type: 'number',
      required: false,
      affects_pricing: false,
      description: ''
    }
    setTemplateData(prev => ({
      ...prev,
      variables: [...prev.variables, newVariable]
    }))
  }

  const updateVariable = (index: number, field: string, value: any) => {
    setTemplateData(prev => ({
      ...prev,
      variables: prev.variables.map((variable: any, i: number) => 
        i === index ? { ...variable, [field]: value } : variable
      )
    }))
  }

  const removeVariable = (index: number) => {
    setTemplateData(prev => ({
      ...prev,
      variables: prev.variables.filter((_: any, i: number) => i !== index)
    }))
  }

  const updatePricingTier = (tier: string, field: string, value: any) => {
    setTemplateData(prev => ({
      ...prev,
      pricing_tiers: {
        ...prev.pricing_tiers,
        [tier]: {
          ...prev.pricing_tiers[tier],
          [field]: value
        }
      }
    }))
  }

  const addTierInclude = (tier: string) => {
    setTemplateData(prev => ({
      ...prev,
      pricing_tiers: {
        ...prev.pricing_tiers,
        [tier]: {
          ...prev.pricing_tiers[tier],
          includes: [...(prev.pricing_tiers[tier].includes || []), '']
        }
      }
    }))
  }

  const updateTierInclude = (tier: string, index: number, value: string) => {
    setTemplateData(prev => ({
      ...prev,
      pricing_tiers: {
        ...prev.pricing_tiers,
        [tier]: {
          ...prev.pricing_tiers[tier],
          includes: prev.pricing_tiers[tier].includes.map((item: string, i: number) => 
            i === index ? value : item
          )
        }
      }
    }))
  }

  const removeTierInclude = (tier: string, index: number) => {
    setTemplateData(prev => ({
      ...prev,
      pricing_tiers: {
        ...prev.pricing_tiers,
        [tier]: {
          ...prev.pricing_tiers[tier],
          includes: prev.pricing_tiers[tier].includes.filter((_: string, i: number) => i !== index)
        }
      }
    }))
  }

  const saveTemplate = async () => {
    setSaving(true)
    try {
      const templateToSave = {
        ...templateData,
        tenant_id: userProfile?.tenant_id,
        updated_at: new Date().toISOString()
      }

      if (template?.id) {
        // Update existing template
        const { error } = await supabase
          .from('estimate_templates')
          .update(templateToSave)
          .eq('id', template.id)
        
        if (error) throw error
      } else {
        // Create new template
        const { error } = await supabase
          .from('estimate_templates')
          .insert({
            ...templateToSave,
            created_at: new Date().toISOString()
          })
        
        if (error) throw error
      }

      onSave(templateToSave)
    } catch (error) {
      console.error('Error saving template:', error)
      alert('Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  const renderStepContent = () => {
    const step = steps[currentStep]

    switch (step.id) {
      case 'basic':
        return (
          <div>
            <h4 className="mb-5">Basic Template Information</h4>
            <div className="row g-5">
              <div className="col-md-6">
                <label className="form-label required">Template Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={templateData.name}
                  onChange={(e) => setTemplateData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., HVAC Installation Standard"
                />
              </div>
              <div className="col-md-6">
                <label className="form-label required">Service Type</label>
                <select
                  className="form-select"
                  value={templateData.service_type}
                  onChange={(e) => setTemplateData(prev => ({ ...prev, service_type: e.target.value }))}
                >
                  <option value="">Select service type...</option>
                  {serviceTypes.map(type => (
                    <option key={type} value={type}>{type.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-12">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={templateData.description}
                  onChange={(e) => setTemplateData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this template is used for..."
                />
              </div>
              <div className="col-md-4">
                <label className="form-label required">Category</label>
                <select
                  className="form-select"
                  value={templateData.category}
                  onChange={(e) => setTemplateData(prev => ({ ...prev, category: e.target.value }))}
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Markup Percentage</label>
                <div className="input-group">
                  <input
                    type="number"
                    className="form-control"
                    value={templateData.markup_percentage}
                    onChange={(e) => setTemplateData(prev => ({ ...prev, markup_percentage: Number(e.target.value) }))}
                  />
                  <span className="input-group-text">%</span>
                </div>
              </div>
              <div className="col-md-4">
                <label className="form-label">Tax Rate</label>
                <div className="input-group">
                  <input
                    type="number"
                    step="0.1"
                    className="form-control"
                    value={templateData.tax_rate}
                    onChange={(e) => setTemplateData(prev => ({ ...prev, tax_rate: Number(e.target.value) }))}
                  />
                  <span className="input-group-text">%</span>
                </div>
              </div>
            </div>
          </div>
        )

      case 'pricing':
        return (
          <div>
            <h4 className="mb-5">Pricing Tiers</h4>
            <div className="row g-5">
              {Object.entries(templateData.pricing_tiers).map(([tier, data]) => (
                <div key={tier} className="col-md-4">
                  <div className="card h-100">
                    <div className="card-body">
                      <h5 className="text-capitalize mb-4">{tier} Package</h5>
                      
                      <div className="mb-3">
                        <label className="form-label">Package Name</label>
                        <input
                          type="text"
                          className="form-control"
                          value={(data as any).name}
                          onChange={(e) => updatePricingTier(tier, 'name', e.target.value)}
                        />
                      </div>

                      <div className="mb-3">
                        <label className="form-label">Price</label>
                        <div className="input-group">
                          <span className="input-group-text">$</span>
                          <input
                            type="number"
                            className="form-control"
                            value={(data as any).price}
                            onChange={(e) => updatePricingTier(tier, 'price', Number(e.target.value))}
                          />
                        </div>
                      </div>

                      <div className="mb-3">
                        <label className="form-label">Description</label>
                        <textarea
                          className="form-control"
                          rows={2}
                          value={(data as any).description}
                          onChange={(e) => updatePricingTier(tier, 'description', e.target.value)}
                        />
                      </div>

                      <div className="mb-3">
                        <label className="form-label">What's Included</label>
                        {((data as any).includes || []).map((include: string, index: number) => (
                          <div key={index} className="input-group mb-2">
                            <input
                              type="text"
                              className="form-control"
                              value={include}
                              onChange={(e) => updateTierInclude(tier, index, e.target.value)}
                              placeholder="Included item..."
                            />
                            <button
                              type="button"
                              className="btn btn-outline-danger"
                              onClick={() => removeTierInclude(tier, index)}
                            >
                              <KTIcon iconName="trash" className="fs-6" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="btn btn-light btn-sm"
                          onClick={() => addTierInclude(tier)}
                        >
                          <KTIcon iconName="plus" className="fs-6 me-1" />
                          Add Item
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )

      case 'line_items':
        return (
          <div>
            <div className="d-flex justify-content-between align-items-center mb-5">
              <h4 className="mb-0">Line Items</h4>
              <button
                type="button"
                className="btn btn-primary"
                onClick={addLineItem}
              >
                <KTIcon iconName="plus" className="fs-6 me-2" />
                Add Line Item
              </button>
            </div>

            {templateData.line_items.length === 0 ? (
              <div className="text-center py-10">
                <KTIcon iconName="notepad" className="fs-2x text-muted mb-3" />
                <h5 className="text-muted">No Line Items Added</h5>
                <p className="text-muted">Add line items to break down the estimate components</p>
              </div>
            ) : (
              <div className="accordion" id="lineItemsAccordion">
                {templateData.line_items.map((item: any, index: number) => (
                  <div key={item.id} className="accordion-item">
                    <h2 className="accordion-header">
                      <button
                        className="accordion-button collapsed"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target={`#collapse${index}`}
                      >
                        <div className="d-flex justify-content-between w-100 me-3">
                          <span>{item.name || `Line Item ${index + 1}`}</span>
                          <span className="text-muted">{item.category} - ${item.unit_price}/{{item.unit_type}}</span>
                        </div>
                      </button>
                    </h2>
                    <div
                      id={`collapse${index}`}
                      className="accordion-collapse collapse"
                      data-bs-parent="#lineItemsAccordion"
                    >
                      <div className="accordion-body">
                        <div className="row g-4">
                          <div className="col-md-6">
                            <label className="form-label">Item Name</label>
                            <input
                              type="text"
                              className="form-control"
                              value={item.name}
                              onChange={(e) => updateLineItem(index, 'name', e.target.value)}
                            />
                          </div>
                          <div className="col-md-6">
                            <label className="form-label">Category</label>
                            <select
                              className="form-select"
                              value={item.category}
                              onChange={(e) => updateLineItem(index, 'category', e.target.value)}
                            >
                              {lineItemCategories.map(cat => (
                                <option key={cat.value} value={cat.value}>{cat.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="col-md-12">
                            <label className="form-label">Description</label>
                            <input
                              type="text"
                              className="form-control"
                              value={item.description}
                              onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                            />
                          </div>
                          <div className="col-md-3">
                            <label className="form-label">Unit Type</label>
                            <select
                              className="form-select"
                              value={item.unit_type}
                              onChange={(e) => updateLineItem(index, 'unit_type', e.target.value)}
                            >
                              {unitTypes.map(type => (
                                <option key={type.value} value={type.value}>{type.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="col-md-3">
                            <label className="form-label">Unit Price</label>
                            <div className="input-group">
                              <span className="input-group-text">$</span>
                              <input
                                type="number"
                                className="form-control"
                                value={item.unit_price}
                                onChange={(e) => updateLineItem(index, 'unit_price', Number(e.target.value))}
                              />
                            </div>
                          </div>
                          <div className="col-md-3">
                            <label className="form-label">Quantity</label>
                            <input
                              type="number"
                              className="form-control"
                              value={item.quantity}
                              onChange={(e) => updateLineItem(index, 'quantity', Number(e.target.value))}
                            />
                          </div>
                          <div className="col-md-3">
                            <label className="form-label">Markup %</label>
                            <input
                              type="number"
                              className="form-control"
                              value={item.markup_percentage || 0}
                              onChange={(e) => updateLineItem(index, 'markup_percentage', Number(e.target.value))}
                            />
                          </div>
                          <div className="col-md-12">
                            <div className="form-check">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={item.is_variable}
                                onChange={(e) => updateLineItem(index, 'is_variable', e.target.checked)}
                              />
                              <label className="form-check-label">
                                Variable quantity (based on project variables)
                              </label>
                            </div>
                            {item.is_variable && (
                              <input
                                type="text"
                                className="form-control mt-2"
                                placeholder="Variable name (e.g., square_footage)"
                                value={item.variable_name || ''}
                                onChange={(e) => updateLineItem(index, 'variable_name', e.target.value)}
                              />
                            )}
                          </div>
                        </div>
                        <div className="text-end mt-4">
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => removeLineItem(index)}
                          >
                            <KTIcon iconName="trash" className="fs-6 me-1" />
                            Remove Item
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )

      case 'variables':
        return (
          <div>
            <div className="d-flex justify-content-between align-items-center mb-5">
              <h4 className="mb-0">Template Variables</h4>
              <button
                type="button"
                className="btn btn-primary"
                onClick={addVariable}
              >
                <KTIcon iconName="plus" className="fs-6 me-2" />
                Add Variable
              </button>
            </div>

            <p className="text-muted mb-5">
              Variables allow you to customize estimates based on project-specific details like square footage, complexity, or special requirements.
            </p>

            {templateData.variables.length === 0 ? (
              <div className="text-center py-10">
                <KTIcon iconName="setting-2" className="fs-2x text-muted mb-3" />
                <h5 className="text-muted">No Variables Added</h5>
                <p className="text-muted">Variables make your templates flexible for different project sizes and requirements</p>
              </div>
            ) : (
              <div className="row g-4">
                {templateData.variables.map((variable: any, index: number) => (
                  <div key={index} className="col-md-6">
                    <div className="card">
                      <div className="card-body">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <h6 className="mb-0">Variable {index + 1}</h6>
                          <button
                            type="button"
                            className="btn btn-sm btn-light-danger"
                            onClick={() => removeVariable(index)}
                          >
                            <KTIcon iconName="trash" className="fs-7" />
                          </button>
                        </div>
                        
                        <div className="row g-3">
                          <div className="col-12">
                            <label className="form-label">Variable Name (code)</label>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="e.g., square_footage"
                              value={variable.name}
                              onChange={(e) => updateVariable(index, 'name', e.target.value)}
                            />
                          </div>
                          <div className="col-12">
                            <label className="form-label">Display Name</label>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="e.g., Square Footage"
                              value={variable.display_name}
                              onChange={(e) => updateVariable(index, 'display_name', e.target.value)}
                            />
                          </div>
                          <div className="col-12">
                            <label className="form-label">Type</label>
                            <select
                              className="form-select"
                              value={variable.type}
                              onChange={(e) => updateVariable(index, 'type', e.target.value)}
                            >
                              {variableTypes.map(type => (
                                <option key={type.value} value={type.value}>{type.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="col-12">
                            <label className="form-label">Description</label>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="Help text for the user"
                              value={variable.description}
                              onChange={(e) => updateVariable(index, 'description', e.target.value)}
                            />
                          </div>
                          <div className="col-6">
                            <div className="form-check">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={variable.required}
                                onChange={(e) => updateVariable(index, 'required', e.target.checked)}
                              />
                              <label className="form-check-label">Required</label>
                            </div>
                          </div>
                          <div className="col-6">
                            <div className="form-check">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={variable.affects_pricing}
                                onChange={(e) => updateVariable(index, 'affects_pricing', e.target.checked)}
                              />
                              <label className="form-check-label">Affects Pricing</label>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )

      case 'review':
        return (
          <div>
            <h4 className="mb-5">Review Template</h4>
            <div className="row g-5">
              <div className="col-md-8">
                <KTCard>
                  <div className="card-header">
                    <h3 className="card-title">{templateData.name}</h3>
                    <div className="card-toolbar">
                      <span className="badge badge-light-primary">{templateData.service_type}</span>
                    </div>
                  </div>
                  <KTCardBody>
                    <p className="text-muted mb-4">{templateData.description}</p>
                    
                    <div className="row mb-5">
                      {Object.entries(templateData.pricing_tiers).map(([tier, data]) => (
                        <div key={tier} className="col-md-4">
                          <div className="border rounded p-3 text-center">
                            <h6>{(data as any).name}</h6>
                            <div className="fs-2 fw-bold text-primary">${(data as any).price}</div>
                            <p className="text-muted fs-7">{(data as any).description}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <h6 className="mb-3">Line Items ({templateData.line_items.length})</h6>
                    <div className="table-responsive mb-5">
                      <table className="table table-sm">
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th>Category</th>
                            <th>Unit Price</th>
                            <th>Quantity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {templateData.line_items.map((item: any, index: number) => (
                            <tr key={index}>
                              <td>{item.name}</td>
                              <td>{item.category}</td>
                              <td>${item.unit_price}/{item.unit_type}</td>
                              <td>{item.is_variable ? 'Variable' : item.quantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <h6 className="mb-3">Variables ({templateData.variables.length})</h6>
                    {templateData.variables.map((variable: any, index: number) => (
                      <div key={index} className="d-flex justify-content-between align-items-center py-2">
                        <span>{variable.display_name}</span>
                        <span className="text-muted">{variable.type}{variable.required ? ' (required)' : ''}</span>
                      </div>
                    ))}
                  </KTCardBody>
                </KTCard>
              </div>
              
              <div className="col-md-4">
                <KTCard>
                  <div className="card-header">
                    <h3 className="card-title">Template Settings</h3>
                  </div>
                  <KTCardBody>
                    <div className="d-flex justify-content-between mb-3">
                      <span>Category:</span>
                      <span className="fw-bold">{templateData.category}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-3">
                      <span>Markup:</span>
                      <span className="fw-bold">{templateData.markup_percentage}%</span>
                    </div>
                    <div className="d-flex justify-content-between mb-3">
                      <span>Tax Rate:</span>
                      <span className="fw-bold">{templateData.tax_rate}%</span>
                    </div>
                    <div className="d-flex justify-content-between mb-3">
                      <span>Duration:</span>
                      <span className="fw-bold">{templateData.estimated_duration_days} days</span>
                    </div>
                  </KTCardBody>
                </KTCard>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              {template ? 'Edit' : 'Create'} Estimate Template
            </h5>
            <button 
              className="btn-close"
              onClick={onCancel}
            ></button>
          </div>
          <div className="modal-body">
            {/* Step Navigation */}
            <div className="stepper stepper-pills mb-8">
              <div className="stepper-nav flex-row">
                {steps.map((step, index) => (
                  <div
                    key={step.id}
                    className={`stepper-item ${index === currentStep ? 'current' : ''} ${index < currentStep ? 'completed' : ''}`}
                    onClick={() => setCurrentStep(index)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="stepper-wrapper">
                      <div className="stepper-icon">
                        <KTIcon iconName={step.icon} className="fs-6" />
                      </div>
                      <div className="stepper-label">
                        <h6 className="stepper-title">{step.title}</h6>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Step Content */}
            {renderStepContent()}
          </div>
          <div className="modal-footer">
            <div className="d-flex justify-content-between w-100">
              <button
                className="btn btn-light"
                onClick={() => currentStep > 0 ? setCurrentStep(currentStep - 1) : onCancel()}
              >
                {currentStep === 0 ? 'Cancel' : 'Previous'}
              </button>
              
              <div>
                {currentStep < steps.length - 1 ? (
                  <button
                    className="btn btn-primary"
                    onClick={() => setCurrentStep(currentStep + 1)}
                    disabled={
                      (currentStep === 0 && (!templateData.name || !templateData.service_type)) ||
                      (currentStep === 1 && Object.values(templateData.pricing_tiers).some((tier: any) => !tier.price))
                    }
                  >
                    Next
                  </button>
                ) : (
                  <button
                    className="btn btn-success"
                    onClick={saveTemplate}
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Saving...
                      </>
                    ) : (
                      <>
                        <KTIcon iconName="check" className="fs-6 me-2" />
                        Save Template
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EstimateTemplateBuilder