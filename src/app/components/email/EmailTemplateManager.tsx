import React, { useState, useEffect } from 'react'
import { emailService, EmailTemplate } from '../../services/emailService'

interface EmailTemplateManagerProps {
  className?: string
}

const EmailTemplateManager: React.FC<EmailTemplateManagerProps> = ({ className = '' }) => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const [formData, setFormData] = useState({
    template_name: '',
    subject_template: '',
    html_template: '',
    text_template: '',
    description: '',
    variables: [] as string[]
  })

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const result = await emailService.getTemplates()
      setTemplates(result.templates)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!formData.template_name || !formData.subject_template) {
      setError('Template name and subject are required')
      return
    }

    setLoading(true)
    try {
      await emailService.createTemplate({
        template_name: formData.template_name,
        subject_template: formData.subject_template,
        html_template: formData.html_template,
        text_template: formData.text_template,
        description: formData.description,
        variables: formData.variables
      })

      await loadTemplates()
      setShowCreateModal(false)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template)
    setFormData({
      template_name: template.template_name,
      subject_template: template.subject_template,
      html_template: template.html_template || '',
      text_template: template.text_template || '',
      description: template.description || '',
      variables: template.variables || []
    })
    setShowCreateModal(true)
  }

  const handleUpdate = async () => {
    if (!editingTemplate) return

    setLoading(true)
    try {
      await emailService.updateTemplate(editingTemplate.id, {
        template_name: formData.template_name,
        subject_template: formData.subject_template,
        html_template: formData.html_template,
        text_template: formData.text_template,
        description: formData.description,
        variables: formData.variables
      })

      await loadTemplates()
      setShowCreateModal(false)
      setEditingTemplate(null)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update template')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return

    setLoading(true)
    try {
      await emailService.deleteTemplate(templateId)
      await loadTemplates()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      template_name: '',
      subject_template: '',
      html_template: '',
      text_template: '',
      description: '',
      variables: []
    })
    setEditingTemplate(null)
  }

  const filteredTemplates = templates.filter(template =>
    template.template_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.subject_template.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{\{([^}]+)\}\}/g)
    if (!matches) return []
    return [...new Set(matches.map(match => match.replace(/[{}]/g, '')))]
  }

  const updateVariables = () => {
    const subjectVars = extractVariables(formData.subject_template)
    const htmlVars = extractVariables(formData.html_template)
    const textVars = extractVariables(formData.text_template)
    const allVars = [...new Set([...subjectVars, ...htmlVars, ...textVars])]
    setFormData(prev => ({ ...prev, variables: allVars }))
  }

  return (
    <div className={`email-template-manager ${className}`}>
      <div className="card">
        <div className="card-header border-0 pt-5">
          <h3 className="card-title align-items-start flex-column">
            <span className="card-label fw-bold fs-3 mb-1">
              <span className="me-2">📝</span>
              Email Templates
            </span>
            <span className="text-muted mt-1 fw-semibold fs-7">
              Manage reusable email templates
            </span>
          </h3>
          <div className="card-toolbar">
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              <span className="me-2">➕</span>
              New Template
            </button>
          </div>
        </div>

        <div className="card-body py-3">
          {error && (
            <div className="alert alert-danger">
              <span>❌ {error}</span>
            </div>
          )}

          {/* Search */}
          <div className="row mb-6">
            <div className="col-md-6">
              <div className="position-relative">
                <input
                  type="text"
                  className="form-control ps-10"
                  placeholder="Search templates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <span className="position-absolute top-50 start-0 translate-middle-y ms-3">
                  🔍
                </span>
              </div>
            </div>
          </div>

          {/* Templates List */}
          {loading ? (
            <div className="d-flex justify-content-center py-10">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : (
            <div className="row g-4">
              {filteredTemplates.map(template => (
                <div key={template.id} className="col-md-6 col-lg-4">
                  <div className="card border">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <h5 className="card-title mb-0">{template.template_name}</h5>
                        <div className="dropdown">
                          <button
                            className="btn btn-sm btn-light btn-icon"
                            type="button"
                            data-bs-toggle="dropdown"
                          >
                            ⋮
                          </button>
                          <ul className="dropdown-menu">
                            <li>
                              <a
                                className="dropdown-item"
                                href="#"
                                onClick={() => handleEdit(template)}
                              >
                                ✏️ Edit
                              </a>
                            </li>
                            <li>
                              <a
                                className="dropdown-item text-danger"
                                href="#"
                                onClick={() => handleDelete(template.id)}
                              >
                                🗑️ Delete
                              </a>
                            </li>
                          </ul>
                        </div>
                      </div>

                      <p className="text-muted small mb-2">
                        <strong>Subject:</strong> {template.subject_template}
                      </p>

                      {template.description && (
                        <p className="text-muted small mb-3">{template.description}</p>
                      )}

                      {/* Variables */}
                      {template.variables && template.variables.length > 0 && (
                        <div className="mb-3">
                          <div className="text-muted small mb-2">Variables:</div>
                          <div className="d-flex flex-wrap gap-1">
                            {template.variables.map(variable => (
                              <span key={variable} className="badge badge-light-primary">
                                {`{{${variable}}}`}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="d-flex justify-content-between align-items-center">
                        <small className="text-muted">
                          v{template.version} • {template.is_active ? '✅ Active' : '⏸️ Inactive'}
                        </small>
                        <button
                          className="btn btn-sm btn-light"
                          onClick={() => handleEdit(template)}
                        >
                          Preview
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {filteredTemplates.length === 0 && !loading && (
                <div className="col-12">
                  <div className="text-center py-10">
                    <h4>No templates found</h4>
                    <p className="text-muted">
                      {searchTerm ? 'Try adjusting your search criteria' : 'Create your first email template to get started'}
                    </p>
                    {!searchTerm && (
                      <button
                        className="btn btn-primary"
                        onClick={() => setShowCreateModal(true)}
                      >
                        <span className="me-2">➕</span>
                        Create Template
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="modal fade show d-block" tabIndex={-1}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editingTemplate ? 'Edit Template' : 'Create Template'}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setShowCreateModal(false)
                    resetForm()
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <div className="row mb-4">
                  <div className="col-md-8">
                    <label className="form-label required">Template Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.template_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, template_name: e.target.value }))}
                      placeholder="Welcome Email"
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Auto-detect Variables</label>
                    <button
                      type="button"
                      className="btn btn-light w-100"
                      onClick={updateVariables}
                    >
                      🔍 Detect
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="form-label">Description</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of this template"
                  />
                </div>

                <div className="mb-4">
                  <label className="form-label required">Subject Template</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.subject_template}
                    onChange={(e) => setFormData(prev => ({ ...prev, subject_template: e.target.value }))}
                    placeholder="Welcome to {{company_name}}, {{customer_name}}!"
                  />
                </div>

                <div className="mb-4">
                  <label className="form-label">HTML Template</label>
                  <textarea
                    className="form-control"
                    rows={8}
                    value={formData.html_template}
                    onChange={(e) => setFormData(prev => ({ ...prev, html_template: e.target.value }))}
                    placeholder="<h1>Hello {{customer_name}}!</h1><p>Welcome to our service...</p>"
                  />
                </div>

                <div className="mb-4">
                  <label className="form-label">Plain Text Template</label>
                  <textarea
                    className="form-control"
                    rows={6}
                    value={formData.text_template}
                    onChange={(e) => setFormData(prev => ({ ...prev, text_template: e.target.value }))}
                    placeholder="Hello {{customer_name}}! Welcome to our service..."
                  />
                </div>

                {/* Variables Display */}
                {formData.variables.length > 0 && (
                  <div className="mb-4">
                    <label className="form-label">Detected Variables</label>
                    <div className="d-flex flex-wrap gap-2">
                      {formData.variables.map(variable => (
                        <span key={variable} className="badge badge-light-info">
                          {`{{${variable}}}`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => {
                    setShowCreateModal(false)
                    resetForm()
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`btn btn-primary ${loading ? 'loading' : ''}`}
                  onClick={editingTemplate ? handleUpdate : handleCreate}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : editingTemplate ? 'Update Template' : 'Create Template'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EmailTemplateManager