import React, { useState, useEffect } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'

interface ServiceCategory {
  id: string
  name: string
  parent_category_id?: string
  sort_order: number
  is_active: boolean
  children?: ServiceCategory[]
}

interface ServiceItem {
  id: string
  category_id?: string
  name: string
  description: string
  unit_type: 'hour' | 'unit' | 'sq_ft' | 'linear_ft' | 'each'
  default_rate: number
  labor_rate: number
  material_rate: number
  markup_percentage: number
  is_active: boolean
  created_at: string
  category?: { name: string }
}

const ServiceLibraryPage: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  
  // State
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [services, setServices] = useState<ServiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  
  // Modal states
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showServiceModal, setShowServiceModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<ServiceCategory | null>(null)
  const [editingService, setEditingService] = useState<ServiceItem | null>(null)
  
  // Form data
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    parent_category_id: '',
    sort_order: 0
  })
  
  const [serviceForm, setServiceForm] = useState<{
    category_id: string
    name: string
    description: string
    unit_type: 'hour' | 'unit' | 'sq_ft' | 'linear_ft' | 'each'
    default_rate: number
    labor_rate: number
    material_rate: number
    markup_percentage: number
  }>({
    category_id: '',
    name: '',
    description: '',
    unit_type: 'hour',
    default_rate: 0,
    labor_rate: 0,
    material_rate: 0,
    markup_percentage: 15
  })

  useEffect(() => {
    if (userProfile?.tenant_id) {
      loadData()
    }
  }, [userProfile?.tenant_id])

  const loadData = async () => {
    setLoading(true)
    try {
      await Promise.all([loadCategories(), loadServices()])
    } finally {
      setLoading(false)
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

  const loadServices = async () => {
    try {
      let query = supabase
        .from('service_catalog')
        .select(`
          *,
          service_categories(name)
        `)
        .eq('tenant_id', userProfile?.tenant_id)
        .order('name')

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
      }

      if (selectedCategory !== 'all') {
        query = query.eq('category_id', selectedCategory)
      }

      const { data, error } = await query
      if (error) throw error
      setServices(data || [])
    } catch (error) {
      console.error('Error loading services:', error)
      showToast.error('Failed to load services')
    }
  }

  useEffect(() => {
    if (userProfile?.tenant_id) {
      loadServices()
    }
  }, [searchTerm, selectedCategory, userProfile?.tenant_id])

  const handleSaveCategory = async () => {
    try {
      const categoryData = {
        ...categoryForm,
        tenant_id: userProfile?.tenant_id,
        parent_category_id: categoryForm.parent_category_id || null
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

  const handleSaveService = async () => {
    try {
      const serviceData = {
        ...serviceForm,
        tenant_id: userProfile?.tenant_id,
        category_id: serviceForm.category_id || null
      }

      if (editingService) {
        const { error } = await supabase
          .from('service_catalog')
          .update(serviceData)
          .eq('id', editingService.id)

        if (error) throw error
        showToast.success('Service updated successfully')
      } else {
        const { error } = await supabase
          .from('service_catalog')
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

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return

    try {
      const { error } = await supabase
        .from('service_catalog')
        .update({ is_active: false })
        .eq('id', serviceId)

      if (error) throw error
      showToast.success('Service deleted successfully')
      loadServices()
    } catch (error) {
      console.error('Error deleting service:', error)
      showToast.error('Failed to delete service')
    }
  }

  const handleEditCategory = (category: ServiceCategory) => {
    setEditingCategory(category)
    setCategoryForm({
      name: category.name,
      parent_category_id: category.parent_category_id || '',
      sort_order: category.sort_order
    })
    setShowCategoryModal(true)
  }

  const handleEditService = (service: ServiceItem) => {
    setEditingService(service)
    setServiceForm({
      category_id: service.category_id || '',
      name: service.name,
      description: service.description,
      unit_type: service.unit_type as 'hour' | 'unit' | 'sq_ft' | 'linear_ft' | 'each',
      default_rate: service.default_rate,
      labor_rate: service.labor_rate,
      material_rate: service.material_rate,
      markup_percentage: service.markup_percentage
    })
    setShowServiceModal(true)
  }

  const resetCategoryForm = () => {
    setCategoryForm({
      name: '',
      parent_category_id: '',
      sort_order: 0
    })
    setEditingCategory(null)
  }

  const resetServiceForm = () => {
    setServiceForm({
      category_id: '',
      name: '',
      description: '',
      unit_type: 'hour',
      default_rate: 0,
      labor_rate: 0,
      material_rate: 0,
      markup_percentage: 15
    })
    setEditingService(null)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '400px' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <>
      <PageTitle breadcrumbs={[]}>Service Library</PageTitle>
      
      <div className="row g-6">
        {/* Categories Sidebar */}
        <div className="col-lg-3">
          <KTCard>
            <div className="card-header">
              <h5 className="card-title mb-0">Categories</h5>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => {
                  resetCategoryForm()
                  setShowCategoryModal(true)
                }}
              >
                <i className="ki-duotone ki-plus fs-6 me-1">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                Add
              </button>
            </div>
            <KTCardBody className="p-0">
              <div className="list-group list-group-flush">
                <button
                  className={`list-group-item list-group-item-action ${
                    selectedCategory === 'all' ? 'active' : ''
                  }`}
                  onClick={() => setSelectedCategory('all')}
                >
                  <i className="ki-duotone ki-element-11 fs-4 me-3">
                    <span className="path1"></span>
                    <span className="path2"></span>
                    <span className="path3"></span>
                    <span className="path4"></span>
                  </i>
                  All Services
                  <span className="badge badge-light-primary ms-auto">
                    {services.length}
                  </span>
                </button>
                
                {categories.map((category) => (
                  <button
                    key={category.id}
                    className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${
                      selectedCategory === category.id ? 'active' : ''
                    }`}
                    onClick={() => setSelectedCategory(category.id)}
                  >
                    <div className="d-flex align-items-center">
                      <i className="ki-duotone ki-category fs-4 me-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                        <span className="path3"></span>
                        <span className="path4"></span>
                      </i>
                      {category.name}
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <span className="badge badge-light-primary">
                        {services.filter(s => s.category_id === category.id).length}
                      </span>
                      <button
                        className="btn btn-sm btn-icon btn-light-primary"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditCategory(category)
                        }}
                      >
                        <i className="ki-duotone ki-pencil fs-6">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                      </button>
                    </div>
                  </button>
                ))}
              </div>
            </KTCardBody>
          </KTCard>
        </div>

        {/* Services List */}
        <div className="col-lg-9">
          <KTCard>
            <div className="card-header">
              <div className="d-flex justify-content-between align-items-center w-100">
                <div className="d-flex align-items-center">
                  <h5 className="card-title mb-0 me-4">Services & Products</h5>
                  <div className="position-relative">
                    <i className="ki-duotone ki-magnifier fs-3 position-absolute ms-3 mt-1">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    <input
                      type="text"
                      className="form-control form-control-sm ps-10"
                      placeholder="Search services..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={{ width: '300px' }}
                    />
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    resetServiceForm()
                    setShowServiceModal(true)
                  }}
                >
                  <i className="ki-duotone ki-plus fs-3 me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Add Service
                </button>
              </div>
            </div>

            <KTCardBody className="p-0">
              {services.length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4">
                    <thead>
                      <tr className="fw-bold text-muted">
                        <th className="min-w-200px">Service Name</th>
                        <th className="min-w-150px">Category</th>
                        <th className="w-100px">Unit Type</th>
                        <th className="w-100px">Default Rate</th>
                        <th className="w-100px">Labor Rate</th>
                        <th className="w-100px">Material Rate</th>
                        <th className="w-80px">Markup</th>
                        <th className="w-80px text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {services.map((service) => (
                        <tr key={service.id}>
                          <td>
                            <div className="d-flex flex-column">
                              <div className="text-dark fw-bold text-hover-primary fs-6">
                                {service.name}
                              </div>
                              {service.description && (
                                <span className="text-muted fs-7">
                                  {service.description}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-light-primary">
                              {service.category?.name || 'Uncategorized'}
                            </span>
                          </td>
                          <td>
                            <span className="text-dark fw-semibold">
                              {service.unit_type.replace('_', ' ')}
                            </span>
                          </td>
                          <td>
                            <span className="text-dark fw-bold">
                              {formatCurrency(service.default_rate)}
                            </span>
                          </td>
                          <td>
                            <span className="text-dark">
                              {formatCurrency(service.labor_rate)}
                            </span>
                          </td>
                          <td>
                            <span className="text-dark">
                              {formatCurrency(service.material_rate)}
                            </span>
                          </td>
                          <td>
                            <span className="badge badge-light-info">
                              {service.markup_percentage}%
                            </span>
                          </td>
                          <td className="text-end">
                            <div className="d-flex justify-content-end gap-2">
                              <button
                                className="btn btn-sm btn-icon btn-light-primary"
                                onClick={() => handleEditService(service)}
                              >
                                <i className="ki-duotone ki-pencil fs-6">
                                  <span className="path1"></span>
                                  <span className="path2"></span>
                                </i>
                              </button>
                              <button
                                className="btn btn-sm btn-icon btn-light-danger"
                                onClick={() => handleDeleteService(service.id)}
                              >
                                <i className="ki-duotone ki-trash fs-6">
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
              ) : (
                <div className="d-flex flex-column align-items-center justify-content-center py-10">
                  <i className="ki-duotone ki-technology-4 fs-3x text-muted mb-4">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  <h5 className="text-muted mb-3">No Services Found</h5>
                  <p className="text-muted mb-4">
                    {searchTerm || selectedCategory !== 'all'
                      ? 'Try adjusting your search or category filter'
                      : 'Start building your service library by adding your first service'
                    }
                  </p>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      resetServiceForm()
                      setShowServiceModal(true)
                    }}
                  >
                    <i className="ki-duotone ki-plus fs-3 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    Add Your First Service
                  </button>
                </div>
              )}
            </KTCardBody>
          </KTCard>
        </div>
      </div>

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editingCategory ? 'Edit Category' : 'Add Category'}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowCategoryModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-4">
                  <label className="form-label required">Category Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., HVAC Services"
                  />
                </div>
                <div className="mb-4">
                  <label className="form-label">Parent Category</label>
                  <select
                    className="form-select"
                    value={categoryForm.parent_category_id}
                    onChange={(e) => setCategoryForm(prev => ({ ...prev, parent_category_id: e.target.value }))}
                  >
                    <option value="">No Parent (Top Level)</option>
                    {categories
                      .filter(cat => cat.id !== editingCategory?.id)
                      .map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="mb-4">
                  <label className="form-label">Sort Order</label>
                  <input
                    type="number"
                    className="form-control"
                    value={categoryForm.sort_order}
                    onChange={(e) => setCategoryForm(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                    min="0"
                  />
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
                  disabled={!categoryForm.name.trim()}
                >
                  {editingCategory ? 'Update' : 'Create'} Category
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Service Modal */}
      {showServiceModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editingService ? 'Edit Service' : 'Add Service'}
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
                      placeholder="e.g., AC Installation"
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Category</label>
                    <select
                      className="form-select"
                      value={serviceForm.category_id}
                      onChange={(e) => setServiceForm(prev => ({ ...prev, category_id: e.target.value }))}
                    >
                      <option value="">Select Category</option>
                      {categories.map((category) => (
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
                      placeholder="Brief description of the service..."
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Unit Type</label>
                    <select
                      className="form-select"
                      value={serviceForm.unit_type}
                      onChange={(e) => setServiceForm(prev => ({ ...prev, unit_type: e.target.value as any }))}
                    >
                      <option value="hour">Hour</option>
                      <option value="unit">Unit</option>
                      <option value="sq_ft">Square Foot</option>
                      <option value="linear_ft">Linear Foot</option>
                      <option value="each">Each</option>
                    </select>
                  </div>
                  <div className="col-md-3">
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
                  <div className="col-md-3">
                    <label className="form-label">Labor Rate</label>
                    <div className="input-group">
                      <span className="input-group-text">$</span>
                      <input
                        type="number"
                        className="form-control"
                        value={serviceForm.labor_rate}
                        onChange={(e) => setServiceForm(prev => ({ ...prev, labor_rate: parseFloat(e.target.value) || 0 }))}
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Material Rate</label>
                    <div className="input-group">
                      <span className="input-group-text">$</span>
                      <input
                        type="number"
                        className="form-control"
                        value={serviceForm.material_rate}
                        onChange={(e) => setServiceForm(prev => ({ ...prev, material_rate: parseFloat(e.target.value) || 0 }))}
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Markup Percentage</label>
                    <div className="input-group">
                      <input
                        type="number"
                        className="form-control"
                        value={serviceForm.markup_percentage}
                        onChange={(e) => setServiceForm(prev => ({ ...prev, markup_percentage: parseFloat(e.target.value) || 0 }))}
                        min="0"
                        max="100"
                        step="0.1"
                      />
                      <span className="input-group-text">%</span>
                    </div>
                  </div>
                  <div className="col-md-6 d-flex align-items-end">
                    <div className="alert alert-light-info w-100">
                      <div className="text-dark fw-bold">
                        Total with Markup: {formatCurrency(serviceForm.default_rate * (1 + serviceForm.markup_percentage / 100))}
                      </div>
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
                  disabled={!serviceForm.name.trim()}
                >
                  {editingService ? 'Update' : 'Create'} Service
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ServiceLibraryPage
