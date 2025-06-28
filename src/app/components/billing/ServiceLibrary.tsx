import React, { useState, useEffect } from 'react'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'

interface ServiceItem {
  id: string
  tenant_id: string
  category_id: string
  name: string
  description: string
  unit_type: 'hour' | 'unit' | 'sq_ft' | 'linear_ft' | 'each'
  default_rate: number
  markup_percentage: number
  is_taxable: boolean
  is_active: boolean
  created_at: string
  updated_at: string
  service_categories?: {
    name: string
    color: string
  }
}

interface ServiceCategory {
  id: string
  tenant_id: string
  name: string
  description: string
  color: string
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

const ServiceLibrary: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  
  // State
  const [services, setServices] = useState<ServiceItem[]>([])
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [showServiceModal, setShowServiceModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingService, setEditingService] = useState<ServiceItem | null>(null)
  const [editingCategory, setEditingCategory] = useState<ServiceCategory | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Form states
  const [serviceForm, setServiceForm] = useState<{
    name: string
    description: string
    category_id: string
    unit_type: 'hour' | 'unit' | 'sq_ft' | 'linear_ft' | 'each'
    default_rate: number
    markup_percentage: number
    is_taxable: boolean
    is_active: boolean
  }>({
    name: '',
    description: '',
    category_id: '',
    unit_type: 'hour',
    default_rate: 0,
    markup_percentage: 20,
    is_taxable: true,
    is_active: true
  })

  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    color: 'primary',
    is_active: true,
    sort_order: 0
  })

  useEffect(() => {
    if (userProfile?.tenant_id) {
      loadData()
    }
  }, [userProfile?.tenant_id])

  const loadData = async () => {
    setLoading(true)
    try {
      await Promise.all([loadServices(), loadCategories()])
    } finally {
      setLoading(false)
    }
  }

  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from('service_items')
        .select(`
          *,
          service_categories(name, color)
        `)
        .eq('tenant_id', userProfile?.tenant_id)
        .order('name')

      if (error) throw error
      setServices(data || [])
    } catch (error) {
      console.error('Error loading services:', error)
      showToast.error('Failed to load services')
    }
  }

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .eq('tenant_id', userProfile?.tenant_id)
        .order('sort_order')

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error('Error loading categories:', error)
      showToast.error('Failed to load categories')
    }
  }

  const handleSaveService = async () => {
    try {
      const serviceData = {
        ...serviceForm,
        tenant_id: userProfile?.tenant_id
      }

      if (editingService) {
        const { error } = await supabase
          .from('service_items')
          .update(serviceData)
          .eq('id', editingService.id)

        if (error) throw error
        showToast.success('Service updated successfully')
      } else {
        const { error } = await supabase
          .from('service_items')
          .insert(serviceData)

        if (error) throw error
        showToast.success('Service created successfully')
      }

      setShowServiceModal(false)
      resetServiceForm()
      loadServices()
    } catch (error) {
      console.error('Error saving service:', error)
      showToast.error('Failed to save service')
    }
  }

  const handleSaveCategory = async () => {
    try {
      const categoryData = {
        ...categoryForm,
        tenant_id: userProfile?.tenant_id
      }

      if (editingCategory) {
        const { error } = await supabase
          .from('service_categories')
          .update(categoryData)
          .eq('id', editingCategory.id)

        if (error) throw error
        showToast.success('Category updated successfully')
      } else {
        const { error } = await supabase
          .from('service_categories')
          .insert(categoryData)

        if (error) throw error
        showToast.success('Category created successfully')
      }

      setShowCategoryModal(false)
      resetCategoryForm()
      loadCategories()
    } catch (error) {
      console.error('Error saving category:', error)
      showToast.error('Failed to save category')
    }
  }

  const resetServiceForm = () => {
    setServiceForm({
      name: '',
      description: '',
      category_id: '',
      unit_type: 'hour',
      default_rate: 0,
      markup_percentage: 20,
      is_taxable: true,
      is_active: true
    })
    setEditingService(null)
  }

  const resetCategoryForm = () => {
    setCategoryForm({
      name: '',
      description: '',
      color: 'primary',
      is_active: true,
      sort_order: 0
    })
    setEditingCategory(null)
  }

  const filteredServices = services.filter(service => {
    const matchesCategory = selectedCategory === 'all' || service.category_id === selectedCategory
    const matchesSearch = service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         service.description.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
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
          <i className="ki-duotone ki-category fs-2 text-primary me-3">
            <span className="path1"></span>
            <span className="path2"></span>
            <span className="path3"></span>
            <span className="path4"></span>
          </i>
          Service Library
        </h3>
        <div className="card-toolbar">
          <div className="d-flex gap-2">
            <button
              className="btn btn-light-primary"
              onClick={() => {
                resetCategoryForm()
                setShowCategoryModal(true)
              }}
            >
              <i className="ki-duotone ki-plus fs-5 me-2">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              Add Category
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                resetServiceForm()
                setShowServiceModal(true)
              }}
            >
              <i className="ki-duotone ki-plus fs-5 me-2">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              Add Service
            </button>
          </div>
        </div>
      </div>

      <div className="card-body">
        {/* Filters */}
        <div className="row g-4 mb-6">
          <div className="col-md-6">
            <label className="form-label">Search Services</label>
            <div className="input-group">
              <span className="input-group-text">
                <i className="ki-duotone ki-magnifier fs-6">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
              </span>
              <input
                type="text"
                className="form-control"
                placeholder="Search by name or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="col-md-6">
            <label className="form-label">Filter by Category</label>
            <select
              className="form-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Services Table */}
        {filteredServices.length > 0 ? (
          <div className="table-responsive">
            <table className="table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4">
              <thead>
                <tr className="fw-bold text-muted">
                  <th className="min-w-200px">Service</th>
                  <th className="min-w-150px">Category</th>
                  <th className="w-100px">Unit Type</th>
                  <th className="w-100px">Rate</th>
                  <th className="w-80px">Markup</th>
                  <th className="w-80px">Taxable</th>
                  <th className="w-80px">Status</th>
                  <th className="w-100px text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredServices.map((service) => (
                  <tr key={service.id}>
                    <td>
                      <div className="d-flex flex-column">
                        <span className="text-dark fw-bold">{service.name}</span>
                        <span className="text-muted fs-7">{service.description}</span>
                      </div>
                    </td>
                    <td>
                      {service.service_categories && (
                        <span className={`badge badge-light-${service.service_categories.color}`}>
                          {service.service_categories.name}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="text-dark">{service.unit_type}</span>
                    </td>
                    <td>
                      <span className="text-dark fw-semibold">
                        {formatCurrency(service.default_rate)}
                      </span>
                    </td>
                    <td>
                      <span className="text-dark">{service.markup_percentage}%</span>
                    </td>
                    <td>
                      <span className={`badge ${service.is_taxable ? 'badge-light-success' : 'badge-light-secondary'}`}>
                        {service.is_taxable ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${service.is_active ? 'badge-light-success' : 'badge-light-danger'}`}>
                        {service.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-end">
                      <button
                        className="btn btn-sm btn-icon btn-light-primary"
                        onClick={() => {
                          setEditingService(service)
                          setServiceForm({
                            name: service.name,
                            description: service.description,
                            category_id: service.category_id,
                            unit_type: service.unit_type,
                            default_rate: service.default_rate,
                            markup_percentage: service.markup_percentage,
                            is_taxable: service.is_taxable,
                            is_active: service.is_active
                          })
                          setShowServiceModal(true)
                        }}
                      >
                        <i className="ki-duotone ki-pencil fs-6">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10">
            <i className="ki-duotone ki-category fs-3x text-muted mb-3">
              <span className="path1"></span>
              <span className="path2"></span>
              <span className="path3"></span>
              <span className="path4"></span>
            </i>
            <h5 className="text-muted">No Services Found</h5>
            <p className="text-muted">
              {searchTerm || selectedCategory !== 'all' 
                ? 'Try adjusting your search or filter criteria.'
                : 'Start building your service library by adding your first service.'
              }
            </p>
            {!searchTerm && selectedCategory === 'all' && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  resetServiceForm()
                  setShowServiceModal(true)
                }}
              >
                Add First Service
              </button>
            )}
          </div>
        )}
      </div>

      {/* Service Modal */}
      {showServiceModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editingService ? 'Edit Service' : 'Add New Service'}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowServiceModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="row g-4">
                  <div className="col-md-8">
                    <label className="form-label required">Service Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={serviceForm.name}
                      onChange={(e) => setServiceForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Plumbing Installation"
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label required">Category</label>
                    <select
                      className="form-select"
                      value={serviceForm.category_id}
                      onChange={(e) => setServiceForm(prev => ({ ...prev, category_id: e.target.value }))}
                    >
                      <option value="">Select Category</option>
                      {categories.map(category => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={serviceForm.description}
                      onChange={(e) => setServiceForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Detailed description of the service..."
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label required">Unit Type</label>
                    <select
                      className="form-select"
                      value={serviceForm.unit_type}
                      onChange={(e) => setServiceForm(prev => ({ ...prev, unit_type: e.target.value as 'hour' | 'unit' | 'sq_ft' | 'linear_ft' | 'each' }))}
                    >
                      <option value="hour">Hour</option>
                      <option value="unit">Unit</option>
                      <option value="sq_ft">Square Foot</option>
                      <option value="linear_ft">Linear Foot</option>
                      <option value="each">Each</option>
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label required">Default Rate</label>
                    <div className="input-group">
                      <span className="input-group-text">$</span>
                      <input
                        type="number"
                        className="form-control"
                        value={serviceForm.default_rate}
                        onChange={(e) => setServiceForm(prev => ({ ...prev, default_rate: parseFloat(e.target.value) || 0 }))}
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Markup %</label>
                    <div className="input-group">
                      <input
                        type="number"
                        className="form-control"
                        value={serviceForm.markup_percentage}
                        onChange={(e) => setServiceForm(prev => ({ ...prev, markup_percentage: parseFloat(e.target.value) || 0 }))}
                        min="0"
                        step="1"
                      />
                      <span className="input-group-text">%</span>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="form-check form-check-custom form-check-solid">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={serviceForm.is_taxable}
                        onChange={(e) => setServiceForm(prev => ({ ...prev, is_taxable: e.target.checked }))}
                      />
                      <label className="form-check-label">
                        Taxable Service
                      </label>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="form-check form-check-custom form-check-solid">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={serviceForm.is_active}
                        onChange={(e) => setServiceForm(prev => ({ ...prev, is_active: e.target.checked }))}
                      />
                      <label className="form-check-label">
                        Active Service
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => setShowServiceModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveService}
                  disabled={!serviceForm.name || !serviceForm.category_id}
                >
                  {editingService ? 'Update' : 'Create'} Service
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editingCategory ? 'Edit Category' : 'Add New Category'}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowCategoryModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="row g-4">
                  <div className="col-12">
                    <label className="form-label required">Category Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Plumbing, Electrical, HVAC"
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={categoryForm.description}
                      onChange={(e) => setCategoryForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Description of this service category..."
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Color Theme</label>
                    <select
                      className="form-select"
                      value={categoryForm.color}
                      onChange={(e) => setCategoryForm(prev => ({ ...prev, color: e.target.value }))}
                    >
                      <option value="primary">Primary (Blue)</option>
                      <option value="success">Success (Green)</option>
                      <option value="info">Info (Cyan)</option>
                      <option value="warning">Warning (Yellow)</option>
                      <option value="danger">Danger (Red)</option>
                      <option value="secondary">Secondary (Gray)</option>
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Sort Order</label>
                    <input
                      type="number"
                      className="form-control"
                      value={categoryForm.sort_order}
                      onChange={(e) => setCategoryForm(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                      min="0"
                    />
                  </div>
                  <div className="col-12">
                    <div className="form-check form-check-custom form-check-solid">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={categoryForm.is_active}
                        onChange={(e) => setCategoryForm(prev => ({ ...prev, is_active: e.target.checked }))}
                      />
                      <label className="form-check-label">
                        Active Category
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => setShowCategoryModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveCategory}
                  disabled={!categoryForm.name}
                >
                  {editingCategory ? 'Update' : 'Create'} Category
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ServiceLibrary
