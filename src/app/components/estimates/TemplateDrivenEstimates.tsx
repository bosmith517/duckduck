import React, { useState, useEffect } from 'react'
import { KTCard, KTCardBody, KTIcon } from '../../../_metronic/helpers'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
// import EstimateTemplateBuilder from './EstimateTemplateBuilder'

interface EstimateTemplate {
  id: string
  name: string
  description: string
  service_type: string
  category: string
  base_price: number
  pricing_tiers: {
    basic: {
      name: string
      description: string
      price: number
      includes: string[]
    }
    standard: {
      name: string
      description: string
      price: number
      includes: string[]
    }
    premium: {
      name: string
      description: string
      price: number
      includes: string[]
    }
  }
  line_items: EstimateLineItem[]
  variables: TemplateVariable[]
  markup_percentage: number
  tax_rate: number
  is_default: boolean
  usage_count: number
  created_at: string
  updated_at: string
}

interface EstimateLineItem {
  id: string
  name: string
  description: string
  category: 'labor' | 'materials' | 'equipment' | 'permits' | 'disposal' | 'travel'
  unit_type: 'hour' | 'day' | 'item' | 'sqft' | 'linear_ft' | 'cubic_yard'
  unit_price: number
  quantity: number
  is_variable: boolean
  variable_name?: string
  markup_percentage?: number
  notes?: string
}

interface TemplateVariable {
  name: string
  display_name: string
  type: 'number' | 'text' | 'select' | 'checkbox' | 'area_measurement'
  options?: string[]
  default_value?: any
  required: boolean
  affects_pricing: boolean
  multiplier?: number
  description?: string
}

interface QuickEstimate {
  template_id: string
  customer_id: string
  customer_type: 'contact' | 'account'
  project_details: any
  selected_tier: 'basic' | 'standard' | 'premium'
  custom_variables: Record<string, any>
  final_price: number
  estimated_duration_days: number
}

const TemplateDrivenEstimates: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  const [activeTab, setActiveTab] = useState<'templates' | 'quick-create' | 'library'>('quick-create')
  const [templates, setTemplates] = useState<EstimateTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<EstimateTemplate | null>(null)
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creatingEstimate, setCreatingEstimate] = useState(false)
  
  // Quick estimate form
  const [quickEstimate, setQuickEstimate] = useState<Partial<QuickEstimate>>({
    selected_tier: 'standard',
    custom_variables: {},
    final_price: 0
  })

  // Template creation/editing
  const [editingTemplate, setEditingTemplate] = useState<Partial<EstimateTemplate> | null>(null)

  useEffect(() => {
    fetchData()
  }, [userProfile?.tenant_id])

  const fetchData = async () => {
    if (!userProfile?.tenant_id) return

    setLoading(true)
    try {
      // Fetch estimate templates
      const { data: templatesData, error: templatesError } = await supabase
        .from('estimate_templates')
        .select('*')
        .eq('tenant_id', userProfile.tenant_id)
        .order('usage_count', { ascending: false })

      if (templatesError && templatesError.code !== 'PGRST116') throw templatesError
      
      // If no templates exist, create sample templates for demo
      if (!templatesData || templatesData.length === 0) {
        const sampleTemplates: EstimateTemplate[] = [
          {
            id: 'sample-hvac-repair',
            name: 'HVAC System Repair',
            description: 'Complete HVAC system diagnostic and repair service',
            service_type: 'HVAC',
            category: 'Repair',
            base_price: 299,
            pricing_tiers: {
              basic: {
                name: 'Basic Repair',
                description: 'Standard diagnostic and basic component repair',
                price: 299,
                includes: ['System diagnostic', 'Basic component repair', 'Filter replacement', '30-day warranty']
              },
              standard: {
                name: 'Standard Repair',
                description: 'Comprehensive repair with premium parts',
                price: 499,
                includes: ['Full system diagnostic', 'Premium parts', 'Filter replacement', 'System tune-up', '90-day warranty']
              },
              premium: {
                name: 'Premium Repair',
                description: 'Complete system overhaul with 1-year warranty',
                price: 799,
                includes: ['Complete system analysis', 'Premium parts', 'Full system cleaning', 'Performance optimization', '1-year warranty', 'Priority support']
              }
            },
            line_items: [
              {
                id: '1',
                name: 'Diagnostic Fee',
                description: 'Complete system diagnostic and issue identification',
                category: 'labor',
                unit_type: 'hour',
                unit_price: 120,
                quantity: 1,
                is_variable: false
              },
              {
                id: '2',
                name: 'Repair Labor',
                description: 'Skilled technician labor for repairs',
                category: 'labor',
                unit_type: 'hour',
                unit_price: 85,
                quantity: 2,
                is_variable: true,
                variable_name: 'repair_hours'
              }
            ],
            variables: [
              {
                name: 'repair_hours',
                display_name: 'Estimated Repair Hours',
                type: 'number',
                default_value: 2,
                required: true,
                affects_pricing: true,
                multiplier: 85,
                description: 'Number of hours required for repair work'
              },
              {
                name: 'system_size',
                display_name: 'System Size (Sq Ft)',
                type: 'area_measurement',
                default_value: 1500,
                required: true,
                affects_pricing: true,
                multiplier: 0.05,
                description: 'Square footage of area served by HVAC system'
              }
            ],
            markup_percentage: 15,
            tax_rate: 8.25,
            is_default: true,
            usage_count: 25,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 'sample-plumbing-emergency',
            name: 'Emergency Plumbing Service',
            description: 'Emergency plumbing repair for urgent issues',
            service_type: 'Plumbing',
            category: 'Emergency',
            base_price: 199,
            pricing_tiers: {
              basic: {
                name: 'Emergency Call',
                description: 'Emergency diagnostic and basic repair',
                price: 199,
                includes: ['Emergency response', 'Basic repair', 'Temporary fix if needed']
              },
              standard: {
                name: 'Emergency Repair',
                description: 'Complete emergency repair service',
                price: 349,
                includes: ['Emergency response', 'Complete repair', 'Quality parts', '60-day warranty']
              },
              premium: {
                name: 'Emergency + Prevention',
                description: 'Emergency repair plus preventive maintenance',
                price: 549,
                includes: ['Emergency response', 'Complete repair', 'System inspection', 'Preventive maintenance', '6-month warranty']
              }
            },
            line_items: [
              {
                id: '1',
                name: 'Emergency Service Call',
                description: 'Emergency response and initial assessment',
                category: 'labor',
                unit_type: 'item',
                unit_price: 150,
                quantity: 1,
                is_variable: false
              }
            ],
            variables: [
              {
                name: 'after_hours',
                display_name: 'After Hours Service',
                type: 'checkbox',
                default_value: false,
                required: false,
                affects_pricing: true,
                multiplier: 50,
                description: 'Additional fee for after-hours emergency service'
              }
            ],
            markup_percentage: 20,
            tax_rate: 8.25,
            is_default: false,
            usage_count: 12,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 'sample-electrical-inspection',
            name: 'Electrical Safety Inspection',
            description: 'Comprehensive electrical system safety inspection',
            service_type: 'Electrical',
            category: 'Inspection',
            base_price: 175,
            pricing_tiers: {
              basic: {
                name: 'Basic Inspection',
                description: 'Standard electrical safety inspection',
                price: 175,
                includes: ['Panel inspection', 'Outlet testing', 'Basic safety report']
              },
              standard: {
                name: 'Comprehensive Inspection',
                description: 'Detailed inspection with recommendations',
                price: 299,
                includes: ['Full system inspection', 'Load testing', 'Detailed report', 'Upgrade recommendations']
              },
              premium: {
                name: 'Complete Assessment',
                description: 'Full assessment with thermal imaging',
                price: 449,
                includes: ['Complete system analysis', 'Thermal imaging', 'Load calculations', 'Detailed report', 'Priority support']
              }
            },
            line_items: [
              {
                id: '1',
                name: 'Inspection Service',
                description: 'Professional electrical system inspection',
                category: 'labor',
                unit_type: 'hour',
                unit_price: 95,
                quantity: 2,
                is_variable: false
              }
            ],
            variables: [
              {
                name: 'panel_count',
                display_name: 'Number of Electrical Panels',
                type: 'number',
                default_value: 1,
                required: true,
                affects_pricing: true,
                multiplier: 25,
                description: 'Additional panels require extra inspection time'
              }
            ],
            markup_percentage: 10,
            tax_rate: 8.25,
            is_default: false,
            usage_count: 8,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]
        setTemplates(sampleTemplates)
      } else {
        setTemplates(templatesData)
      }

      // Fetch customers for quick estimate creation
      const { data: contactsData } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, phone, email')
        .eq('tenant_id', userProfile.tenant_id)
        .limit(50)

      const { data: accountsData } = await supabase
        .from('accounts')
        .select('id, name, phone, email')
        .eq('tenant_id', userProfile.tenant_id)
        .limit(50)

      const allCustomers = [
        ...(contactsData || []).map(c => ({ ...c, type: 'contact', display_name: `${c.first_name} ${c.last_name}` })),
        ...(accountsData || []).map(a => ({ ...a, type: 'account', display_name: a.name }))
      ]
      setCustomers(allCustomers)

    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateEstimatePrice = (template: EstimateTemplate, tier: 'basic' | 'standard' | 'premium', variables: Record<string, any>) => {
    let basePrice = template.pricing_tiers[tier].price
    let totalPrice = basePrice

    // Apply variable-based pricing adjustments
    template.variables.forEach(variable => {
      if (variable.affects_pricing && variables[variable.name] !== undefined) {
        const value = variables[variable.name]
        
        if (variable.type === 'area_measurement' && variable.multiplier) {
          totalPrice += (value * variable.multiplier)
        } else if (variable.type === 'number' && variable.multiplier) {
          totalPrice += (value * variable.multiplier)
        } else if (variable.type === 'checkbox' && value && variable.multiplier) {
          totalPrice += variable.multiplier
        }
      }
    })

    // Apply markup
    totalPrice *= (1 + (template.markup_percentage || 0) / 100)
    
    // Apply tax
    totalPrice *= (1 + (template.tax_rate || 0) / 100)

    return Math.round(totalPrice * 100) / 100
  }

  const createQuickEstimate = async () => {
    if (!selectedTemplate || !quickEstimate.customer_id) {
      alert('Please select a template and customer')
      return
    }

    setCreatingEstimate(true)
    try {
      const finalPrice = calculateEstimatePrice(
        selectedTemplate, 
        quickEstimate.selected_tier!, 
        quickEstimate.custom_variables || {}
      )

      // Create the estimate record (using only existing columns)
      const { data: estimate, error: estimateError } = await supabase
        .from('estimates')
        .insert({
          tenant_id: userProfile?.tenant_id,
          account_id: quickEstimate.customer_id, // estimates table uses account_id
          project_title: `${selectedTemplate.name} - ${quickEstimate.selected_tier?.toUpperCase()} Package`,
          description: selectedTemplate.description,
          total_amount: finalPrice,
          status: 'Draft',
          valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days, date only
          template_id: selectedTemplate.id,
          selected_tier: quickEstimate.selected_tier,
          custom_variables: quickEstimate.custom_variables,
          created_from_template: true,
          estimated_duration_days: calculateEstimatedDuration(selectedTemplate, quickEstimate.custom_variables || {})
        })
        .select()
        .single()

      if (estimateError) throw estimateError

      // Create line items from template
      const lineItems = selectedTemplate.line_items.map(item => {
        let quantity = item.quantity
        let unitPrice = item.unit_price

        // Apply variable-based quantity/price adjustments
        if (item.is_variable && item.variable_name && quickEstimate.custom_variables) {
          const variableValue = quickEstimate.custom_variables[item.variable_name]
          if (variableValue !== undefined) {
            if (item.unit_type === 'sqft' || item.unit_type === 'linear_ft') {
              quantity = variableValue
            } else if (typeof variableValue === 'number') {
              quantity = variableValue
            }
          }
        }

        return {
          tenant_id: userProfile?.tenant_id,
          estimate_id: estimate.id,
          name: item.name,
          description: item.description,
          category: item.category,
          unit_type: item.unit_type,
          unit_price: unitPrice,
          quantity: quantity,
          total_price: unitPrice * quantity,
          markup_percentage: item.markup_percentage || 0,
          notes: item.notes
        }
      })

      const { error: lineItemsError } = await supabase
        .from('estimate_line_items')
        .insert(lineItems)

      if (lineItemsError) throw lineItemsError

      // Update template usage count
      await supabase
        .from('estimate_templates')
        .update({ usage_count: selectedTemplate.usage_count + 1 })
        .eq('id', selectedTemplate.id)

      alert(`✅ Estimate created successfully! Total: $${finalPrice.toLocaleString()}`)
      
      // Reset form
      setQuickEstimate({
        selected_tier: 'standard',
        custom_variables: {},
        final_price: 0
      })
      setSelectedTemplate(null)
      fetchData() // Refresh data

    } catch (error) {
      console.error('Error creating estimate:', error)
      alert('Failed to create estimate')
    } finally {
      setCreatingEstimate(false)
    }
  }

  const calculateEstimatedDuration = (template: EstimateTemplate, variables: Record<string, any>): number => {
    // Base duration calculation logic
    let baseDays = 1
    
    const sqft = variables.square_footage || variables.area || 0
    if (sqft > 0) {
      if (template.service_type === 'roofing') baseDays = Math.ceil(sqft / 1000) + 1
      else if (template.service_type === 'flooring') baseDays = Math.ceil(sqft / 500) + 1
      else if (template.service_type === 'painting') baseDays = Math.ceil(sqft / 800) + 1
      else baseDays = Math.ceil(sqft / 400) + 1
    }

    return Math.max(1, baseDays)
  }

  const createDefaultTemplates = async () => {
    const defaultTemplates = [
      {
        name: 'HVAC System Installation',
        description: 'Complete HVAC system installation with ductwork',
        service_type: 'hvac',
        category: 'installation',
        base_price: 5000,
        pricing_tiers: {
          basic: {
            name: 'Basic Package',
            description: 'Standard efficiency unit with basic installation',
            price: 4500,
            includes: ['Standard efficiency unit', 'Basic installation', '1-year warranty']
          },
          standard: {
            name: 'Standard Package', 
            description: 'High efficiency unit with professional installation',
            price: 6500,
            includes: ['High efficiency unit', 'Professional installation', 'Ductwork inspection', '2-year warranty']
          },
          premium: {
            name: 'Premium Package',
            description: 'Top-tier system with smart controls and extended warranty',
            price: 9500,
            includes: ['Premium efficiency unit', 'Smart thermostat', 'Complete ductwork replacement', '5-year warranty', 'Annual maintenance']
          }
        },
        line_items: [
          {
            id: '1',
            name: 'HVAC Unit',
            description: 'Main heating/cooling unit',
            category: 'equipment' as const,
            unit_type: 'item' as const,
            unit_price: 3000,
            quantity: 1,
            is_variable: false
          },
          {
            id: '2', 
            name: 'Installation Labor',
            description: 'Professional installation labor',
            category: 'labor' as const,
            unit_type: 'hour' as const,
            unit_price: 85,
            quantity: 16,
            is_variable: true,
            variable_name: 'installation_complexity'
          },
          {
            id: '3',
            name: 'Ductwork',
            description: 'Ductwork materials per sq ft',
            category: 'materials' as const,
            unit_type: 'sqft' as const,
            unit_price: 8,
            quantity: 1,
            is_variable: true,
            variable_name: 'square_footage'
          }
        ],
        variables: [
          {
            name: 'square_footage',
            display_name: 'Home Square Footage',
            type: 'area_measurement' as const,
            required: true,
            affects_pricing: true,
            multiplier: 2.5,
            description: 'Total square footage of the home'
          },
          {
            name: 'installation_complexity',
            display_name: 'Installation Complexity',
            type: 'select' as const,
            options: ['Standard (16 hours)', 'Complex (24 hours)', 'Very Complex (32 hours)'],
            default_value: 'Standard (16 hours)',
            required: true,
            affects_pricing: true,
            description: 'Complexity of the installation work'
          }
        ],
        markup_percentage: 20,
        tax_rate: 8.5,
        is_default: true,
        usage_count: 0
      },
      {
        name: 'Plumbing Repair Service',
        description: 'Common plumbing repairs and maintenance',
        service_type: 'plumbing',
        category: 'repair',
        base_price: 250,
        pricing_tiers: {
          basic: {
            name: 'Basic Repair',
            description: 'Simple repairs and minor fixes',
            price: 200,
            includes: ['Diagnosis', 'Basic repair', 'Parts under $50', '30-day warranty']
          },
          standard: {
            name: 'Standard Service',
            description: 'Multiple repairs and maintenance',
            price: 350,
            includes: ['Comprehensive diagnosis', 'Multiple repairs', 'Parts under $150', '90-day warranty']
          },
          premium: {
            name: 'Complete Service',
            description: 'Full system service and upgrades',
            price: 650,
            includes: ['Full system inspection', 'All necessary repairs', 'Fixture upgrades', '1-year warranty']
          }
        },
        line_items: [
          {
            id: '1',
            name: 'Service Call',
            description: 'Initial diagnosis and service call',
            category: 'labor' as const,
            unit_type: 'hour' as const,
            unit_price: 95,
            quantity: 1,
            is_variable: false
          },
          {
            id: '2',
            name: 'Repair Labor',
            description: 'Plumbing repair labor',
            category: 'labor' as const,
            unit_type: 'hour' as const,
            unit_price: 85,
            quantity: 2,
            is_variable: true,
            variable_name: 'repair_complexity'
          }
        ],
        variables: [
          {
            name: 'repair_complexity',
            display_name: 'Repair Complexity',
            type: 'select' as const,
            options: ['Simple (1-2 hours)', 'Moderate (3-4 hours)', 'Complex (5+ hours)'],
            default_value: 'Moderate (3-4 hours)',
            required: true,
            affects_pricing: true,
            description: 'How complex is the repair work?'
          },
          {
            name: 'emergency_service',
            display_name: 'Emergency Service',
            type: 'checkbox' as const,
            required: false,
            affects_pricing: true,
            multiplier: 150,
            description: 'After-hours or emergency service surcharge'
          }
        ],
        markup_percentage: 25,
        tax_rate: 8.5,
        is_default: true,
        usage_count: 0
      }
    ]

    try {
      for (const template of defaultTemplates) {
        await supabase
          .from('estimate_templates')
          .insert({
            ...template,
            tenant_id: userProfile?.tenant_id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
      }
      alert('Default templates created successfully!')
      fetchData()
    } catch (error) {
      console.error('Error creating default templates:', error)
      alert('Failed to create default templates')
    }
  }

  if (loading) {
    return (
      <KTCard>
        <KTCardBody className="text-center py-10">
          <div className="spinner-border text-primary" style={{ width: '3rem', height: '3rem' }}></div>
          <div className="text-muted mt-3">Loading estimate templates...</div>
        </KTCardBody>
      </KTCard>
    )
  }

  return (
    <>
      {/* Tab Navigation */}
      <ul className="nav nav-tabs nav-line-tabs mb-5 fs-6">
        <li className="nav-item">
          <a
            className={`nav-link ${activeTab === 'quick-create' ? 'active' : ''}`}
            onClick={() => setActiveTab('quick-create')}
            style={{ cursor: 'pointer' }}
          >
            <KTIcon iconName="flash" className="fs-6 me-2" />
            Quick Create
          </a>
        </li>
        <li className="nav-item">
          <a
            className={`nav-link ${activeTab === 'templates' ? 'active' : ''}`}
            onClick={() => setActiveTab('templates')}
            style={{ cursor: 'pointer' }}
          >
            <KTIcon iconName="document" className="fs-6 me-2" />
            My Templates
          </a>
        </li>
        <li className="nav-item">
          <a
            className={`nav-link ${activeTab === 'library' ? 'active' : ''}`}
            onClick={() => setActiveTab('library')}
            style={{ cursor: 'pointer' }}
          >
            <KTIcon iconName="book" className="fs-6 me-2" />
            Template Library
          </a>
        </li>
      </ul>

      {/* Quick Create Tab */}
      {activeTab === 'quick-create' && (
        <div className="row g-5">
          {/* Template Selection */}
          <div className="col-xl-8">
            <KTCard>
              <div className="card-header">
                <h3 className="card-title">⚡ Create Estimate in 60 Seconds</h3>
                <div className="card-toolbar">
                  <div className="badge badge-light-success">80% Faster</div>
                </div>
              </div>
              <KTCardBody>
                {!selectedTemplate ? (
                  <div>
                    <h5 className="mb-4">1. Choose a Template</h5>
                    {templates.length === 0 ? (
                      <div className="text-center py-10">
                        <KTIcon iconName="document" className="fs-2x text-muted mb-3" />
                        <h5 className="text-muted">No Templates Yet</h5>
                        <p className="text-muted mb-5">Create your first estimate template to get started</p>
                        <button 
                          className="btn btn-primary"
                          onClick={createDefaultTemplates}
                        >
                          <KTIcon iconName="plus" className="fs-6 me-2" />
                          Create Default Templates
                        </button>
                      </div>
                    ) : (
                      <div className="row g-4">
                        {templates.map((template) => (
                          <div key={template.id} className="col-md-6">
                            <div 
                              className="card card-bordered cursor-pointer h-100"
                              onClick={() => setSelectedTemplate(template)}
                            >
                              <div className="card-body">
                                <div className="d-flex justify-content-between align-items-start mb-3">
                                  <h6 className="mb-0">{template.name}</h6>
                                  <span className="badge badge-light-primary">{template.service_type}</span>
                                </div>
                                <p className="text-muted fs-7 mb-3">{template.description}</p>
                                <div className="d-flex justify-content-between align-items-center">
                                  <div className="text-success fw-bold">
                                    From ${template.pricing_tiers.basic.price.toLocaleString()}
                                  </div>
                                  <div className="text-muted fs-8">
                                    Used {template.usage_count} times
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    {/* Template Selected - Show Configuration */}
                    <div className="d-flex justify-content-between align-items-center mb-5">
                      <div>
                        <h5 className="mb-1">{selectedTemplate.name}</h5>
                        <p className="text-muted mb-0">{selectedTemplate.description}</p>
                      </div>
                      <button 
                        className="btn btn-light btn-sm"
                        onClick={() => setSelectedTemplate(null)}
                      >
                        <KTIcon iconName="arrow-left" className="fs-6 me-1" />
                        Change Template
                      </button>
                    </div>

                    {/* Step 2: Customer Selection */}
                    <div className="mb-6">
                      <h6 className="mb-3">2. Select Customer</h6>
                      <select 
                        className="form-select"
                        value={quickEstimate.customer_id || ''}
                        onChange={(e) => {
                          const customer = customers.find(c => c.id === e.target.value)
                          setQuickEstimate(prev => ({
                            ...prev,
                            customer_id: e.target.value,
                            customer_type: customer?.type
                          }))
                        }}
                      >
                        <option value="">Choose a customer...</option>
                        {customers.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.display_name} ({customer.phone})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Step 3: Package Selection */}
                    <div className="mb-6">
                      <h6 className="mb-3">3. Choose Package Level</h6>
                      <div className="row g-3">
                        {Object.entries(selectedTemplate.pricing_tiers).map(([key, tier]) => (
                          <div key={key} className="col-md-4">
                            <label className="d-flex cursor-pointer">
                              <input
                                type="radio"
                                className="d-none"
                                name="tier"
                                value={key}
                                checked={quickEstimate.selected_tier === key}
                                onChange={(e) => setQuickEstimate(prev => ({ 
                                  ...prev, 
                                  selected_tier: e.target.value as any 
                                }))}
                              />
                              <div className={`card w-100 ${quickEstimate.selected_tier === key ? 'border-primary bg-light-primary' : ''}`}>
                                <div className="card-body text-center p-4">
                                  <h6 className="mb-2">{tier.name}</h6>
                                  <div className="fs-2 fw-bold text-primary mb-2">
                                    ${tier.price.toLocaleString()}
                                  </div>
                                  <p className="text-muted fs-7 mb-3">{tier.description}</p>
                                  <ul className="text-start fs-8">
                                    {tier.includes.map((item, i) => (
                                      <li key={i}>{item}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Step 4: Variable Inputs */}
                    {selectedTemplate.variables.length > 0 && (
                      <div className="mb-6">
                        <h6 className="mb-3">4. Project Details</h6>
                        <div className="row g-4">
                          {selectedTemplate.variables.map((variable) => (
                            <div key={variable.name} className="col-md-6">
                              <label className="form-label">
                                {variable.display_name}
                                {variable.required && <span className="text-danger">*</span>}
                              </label>
                              
                              {variable.type === 'number' || variable.type === 'area_measurement' ? (
                                <input
                                  type="number"
                                  className="form-control"
                                  placeholder={variable.description}
                                  value={quickEstimate.custom_variables?.[variable.name] || ''}
                                  onChange={(e) => setQuickEstimate(prev => ({
                                    ...prev,
                                    custom_variables: {
                                      ...prev.custom_variables,
                                      [variable.name]: Number(e.target.value)
                                    }
                                  }))}
                                />
                              ) : variable.type === 'select' ? (
                                <select
                                  className="form-select"
                                  value={quickEstimate.custom_variables?.[variable.name] || variable.default_value || ''}
                                  onChange={(e) => setQuickEstimate(prev => ({
                                    ...prev,
                                    custom_variables: {
                                      ...prev.custom_variables,
                                      [variable.name]: e.target.value
                                    }
                                  }))}
                                >
                                  {variable.options?.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                  ))}
                                </select>
                              ) : variable.type === 'checkbox' ? (
                                <div className="form-check">
                                  <input
                                    className="form-check-input"
                                    type="checkbox"
                                    checked={quickEstimate.custom_variables?.[variable.name] || false}
                                    onChange={(e) => setQuickEstimate(prev => ({
                                      ...prev,
                                      custom_variables: {
                                        ...prev.custom_variables,
                                        [variable.name]: e.target.checked
                                      }
                                    }))}
                                  />
                                  <label className="form-check-label">{variable.description}</label>
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  className="form-control"
                                  placeholder={variable.description}
                                  value={quickEstimate.custom_variables?.[variable.name] || ''}
                                  onChange={(e) => setQuickEstimate(prev => ({
                                    ...prev,
                                    custom_variables: {
                                      ...prev.custom_variables,
                                      [variable.name]: e.target.value
                                    }
                                  }))}
                                />
                              )}
                              
                              {variable.description && (
                                <div className="form-text">{variable.description}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Create Button */}
                    <div className="text-center">
                      <button
                        className="btn btn-success btn-lg"
                        onClick={createQuickEstimate}
                        disabled={!quickEstimate.customer_id || !quickEstimate.selected_tier || creatingEstimate}
                      >
                        {creatingEstimate ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2"></span>
                            Creating Estimate...
                          </>
                        ) : (
                          <>
                            <KTIcon iconName="check" className="fs-6 me-2" />
                            Create Estimate - ${quickEstimate.selected_tier && selectedTemplate ? 
                              calculateEstimatePrice(selectedTemplate, quickEstimate.selected_tier, quickEstimate.custom_variables || {}).toLocaleString() 
                              : '0'}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </KTCardBody>
            </KTCard>
          </div>

          {/* Benefits Sidebar */}
          <div className="col-xl-4">
            <KTCard>
              <div className="card-header">
                <h3 className="card-title">⚡ Speed Benefits</h3>
              </div>
              <KTCardBody>
                <div className="alert alert-success">
                  <div className="fw-bold mb-2">🚀 80% Time Savings</div>
                  <ul className="mb-0 small">
                    <li>Manual estimate: 45-60 minutes</li>
                    <li>Template estimate: 8-12 minutes</li>
                    <li>Professional consistency</li>
                    <li>Built-in profit margins</li>
                    <li>Automatic calculations</li>
                  </ul>
                </div>

                <div className="separator my-4"></div>

                <h6 className="mb-3">Template Benefits:</h6>
                <div className="d-flex align-items-center mb-3">
                  <KTIcon iconName="check-circle" className="fs-6 text-success me-2" />
                  <span className="fs-7">Tiered pricing built-in</span>
                </div>
                <div className="d-flex align-items-center mb-3">
                  <KTIcon iconName="check-circle" className="fs-6 text-success me-2" />
                  <span className="fs-7">Variable pricing based on project size</span>
                </div>
                <div className="d-flex align-items-center mb-3">
                  <KTIcon iconName="check-circle" className="fs-6 text-success me-2" />
                  <span className="fs-7">Automatic markup and tax calculation</span>
                </div>
                <div className="d-flex align-items-center mb-3">
                  <KTIcon iconName="check-circle" className="fs-6 text-success me-2" />
                  <span className="fs-7">Professional presentation</span>
                </div>
                <div className="d-flex align-items-center mb-3">
                  <KTIcon iconName="check-circle" className="fs-6 text-success me-2" />
                  <span className="fs-7">Consistent pricing across jobs</span>
                </div>
              </KTCardBody>
            </KTCard>
          </div>
        </div>
      )}

      {/* Templates Management Tab */}
      {activeTab === 'templates' && (
        <KTCard>
          <div className="card-header">
            <h3 className="card-title">My Estimate Templates</h3>
            <div className="card-toolbar">
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => setEditingTemplate({})}
              >
                <KTIcon iconName="plus" className="fs-6 me-2" />
                Create Template
              </button>
            </div>
          </div>
          <KTCardBody>
            {templates.length === 0 ? (
              <div className="text-center py-10">
                <KTIcon iconName="document" className="fs-2x text-muted mb-3" />
                <h5 className="text-muted">No Templates Created</h5>
                <p className="text-muted mb-5">Templates make estimate creation 80% faster</p>
                <button 
                  className="btn btn-primary me-3"
                  onClick={createDefaultTemplates}
                >
                  Create Default Templates
                </button>
                <button 
                  className="btn btn-light"
                  onClick={() => setEditingTemplate({})}
                >
                  Create Custom Template
                </button>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4">
                  <thead>
                    <tr className="fw-bold text-muted">
                      <th>Template Name</th>
                      <th>Service Type</th>
                      <th>Price Range</th>
                      <th>Usage</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((template) => (
                      <tr key={template.id}>
                        <td>
                          <div className="fw-bold">{template.name}</div>
                          <div className="text-muted fs-7">{template.description}</div>
                        </td>
                        <td>
                          <span className="badge badge-light-primary">{template.service_type}</span>
                        </td>
                        <td>
                          <div className="fw-bold">
                            ${template.pricing_tiers.basic.price.toLocaleString()} - ${template.pricing_tiers.premium.price.toLocaleString()}
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-light-success">{template.usage_count} times</span>
                        </td>
                        <td>
                          <button 
                            className="btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1"
                            onClick={() => setEditingTemplate(template)}
                          >
                            <KTIcon iconName="pencil" className="fs-6" />
                          </button>
                          <button 
                            className="btn btn-icon btn-bg-light btn-active-color-primary btn-sm"
                            onClick={() => {
                              setSelectedTemplate(template)
                              setActiveTab('quick-create')
                            }}
                          >
                            <KTIcon iconName="flash" className="fs-6" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </KTCardBody>
        </KTCard>
      )}

      {/* Template Library Tab */}
      {activeTab === 'library' && (
        <KTCard>
          <div className="card-header">
            <h3 className="card-title">Template Library</h3>
          </div>
          <KTCardBody>
            <div className="text-center py-10">
              <KTIcon iconName="book" className="fs-2x text-primary mb-3" />
              <h5>Coming Soon</h5>
              <p className="text-muted">Browse hundreds of industry-specific templates</p>
            </div>
          </KTCardBody>
        </KTCard>
      )}

      {/* Template Builder Modal */}
      {editingTemplate && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Template Builder</h5>
                <button 
                  className="btn-close"
                  onClick={() => setEditingTemplate(null)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-info">
                  <KTIcon iconName="information" className="fs-2 me-3" />
                  <div>
                    <h5 className="mb-1">Template Builder Coming Soon</h5>
                    <p className="mb-0">Advanced template builder with drag-and-drop interface is under development.</p>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  className="btn btn-secondary"
                  onClick={() => setEditingTemplate(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default TemplateDrivenEstimates
