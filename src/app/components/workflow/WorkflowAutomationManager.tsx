import React, { useState, useEffect } from 'react'
import { WorkflowAutomationService, WorkflowRule, WorkflowExecution } from '../../services/workflowAutomationService'
import { KTIcon } from '../../../_metronic/helpers'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'

interface WorkflowAutomationManagerProps {
  tenantId?: string
}

export const WorkflowAutomationManager: React.FC<WorkflowAutomationManagerProps> = ({
  tenantId: propTenantId
}) => {
  const { userProfile } = useSupabaseAuth()
  const tenantId = propTenantId || userProfile?.tenant_id
  
  const [activeTab, setActiveTab] = useState<'rules' | 'executions' | 'templates'>('rules')
  const [rules, setRules] = useState<WorkflowRule[]>([])
  const [executions, setExecutions] = useState<WorkflowExecution[]>([])
  const [templates, setTemplates] = useState<Partial<WorkflowRule>[]>([])
  const [loading, setLoading] = useState(false)
  const [creatingFromTemplate, setCreatingFromTemplate] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedRule, setSelectedRule] = useState<WorkflowRule | null>(null)

  useEffect(() => {
    loadData()
  }, [activeTab, tenantId])

  const loadData = async () => {
    if (!tenantId) {
      // Don't try to load data if we don't have a tenantId yet
      return
    }
    
    setLoading(true)
    try {
      if (activeTab === 'rules') {
        const rulesData = await WorkflowAutomationService.getWorkflowRules(tenantId)
        setRules(rulesData)
      } else if (activeTab === 'templates') {
        const templatesData = WorkflowAutomationService.getWorkflowTemplates()
        setTemplates(templatesData)
      }
      
      // Always load templates for initial display
      if (templates.length === 0) {
        const templatesData = WorkflowAutomationService.getWorkflowTemplates()
        setTemplates(templatesData)
      }
    } catch (error) {
      console.error('Error loading workflow data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateRule = async (ruleData: Partial<WorkflowRule>) => {
    try {
      await WorkflowAutomationService.createWorkflowRule(ruleData)
      setShowCreateModal(false)
      loadData()
    } catch (error) {
      console.error('Error creating workflow rule:', error)
    }
  }

  const handleToggleRuleStatus = async (rule: WorkflowRule) => {
    try {
      await WorkflowAutomationService.updateWorkflowRule(rule.id, {
        active: !rule.active
      })
      loadData()
    } catch (error) {
      console.error('Error updating workflow rule:', error)
    }
  }

  const handleDeleteRule = async (ruleId: string) => {
    if (window.confirm('Are you sure you want to delete this workflow rule?')) {
      try {
        await WorkflowAutomationService.deleteWorkflowRule(ruleId)
        loadData()
      } catch (error) {
        console.error('Error deleting workflow rule:', error)
      }
    }
  }

  const handleCreateFromTemplate = async (template: Partial<WorkflowRule>) => {
    try {
      setCreatingFromTemplate(template.rule_name || null)
      await WorkflowAutomationService.createWorkflowRule({
        ...template,
        active: true
      })
      // Switch to rules tab to show the newly created rule
      setActiveTab('rules')
      loadData()
      alert('Workflow rule created successfully!')
    } catch (error) {
      console.error('Error creating rule from template:', error)
      alert('Error creating workflow rule: ' + (error as Error).message)
    } finally {
      setCreatingFromTemplate(null)
    }
  }

  const handleTestWorkflow = async (rule: WorkflowRule) => {
    try {
      await WorkflowAutomationService.triggerWorkflow(
        rule.entity_type,
        'test-entity-id',
        rule.trigger_event,
        { test_mode: true }
      )
      alert('Test workflow triggered successfully!')
    } catch (error) {
      console.error('Error testing workflow:', error)
      alert('Error testing workflow: ' + (error as Error).message)
    }
  }

  return (
    <div className="card">
      <div className="card-header border-0 pt-5">
        <h3 className="card-title align-items-start flex-column">
          <span className="card-label fw-bold fs-3 mb-1">Workflow Automation</span>
          <span className="text-muted mt-1 fw-semibold fs-7">
            Manage automated workflows and business rules
          </span>
        </h3>
        <div className="card-toolbar">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <KTIcon iconName="plus" className="fs-2" />
            New Rule
          </button>
        </div>
      </div>

      <div className="card-body py-3">
        {/* Tab Navigation */}
        <ul className="nav nav-tabs nav-line-tabs nav-line-tabs-2x mb-5 fs-6">
          <li className="nav-item">
            <a
              className={`nav-link ${activeTab === 'rules' ? 'active' : ''}`}
              onClick={() => setActiveTab('rules')}
              style={{ cursor: 'pointer' }}
            >
              <KTIcon iconName="code" className="fs-2 me-2" />
              Active Rules ({rules.length})
            </a>
          </li>
          <li className="nav-item">
            <a
              className={`nav-link ${activeTab === 'executions' ? 'active' : ''}`}
              onClick={() => setActiveTab('executions')}
              style={{ cursor: 'pointer' }}
            >
              <KTIcon iconName="chart-line" className="fs-2 me-2" />
              Execution History
            </a>
          </li>
          <li className="nav-item">
            <a
              className={`nav-link ${activeTab === 'templates' ? 'active' : ''}`}
              onClick={() => setActiveTab('templates')}
              style={{ cursor: 'pointer' }}
            >
              <KTIcon iconName="copy" className="fs-2 me-2" />
              Templates ({templates.length})
            </a>
          </li>
        </ul>

        {/* Tab Content */}
        {activeTab === 'rules' && (
          <div className="tab-pane fade show active">
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4">
                  <thead>
                    <tr className="fw-bold text-muted">
                      <th className="w-25px">
                        <div className="form-check form-check-sm form-check-custom form-check-solid">
                          <input className="form-check-input" type="checkbox" />
                        </div>
                      </th>
                      <th className="min-w-150px">Rule Name</th>
                      <th className="min-w-140px">Entity Type</th>
                      <th className="min-w-120px">Trigger Event</th>
                      <th className="min-w-100px">Status</th>
                      <th className="min-w-100px text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((rule) => (
                      <tr key={rule.id}>
                        <td>
                          <div className="form-check form-check-sm form-check-custom form-check-solid">
                            <input className="form-check-input" type="checkbox" />
                          </div>
                        </td>
                        <td>
                          <div className="d-flex align-items-center">
                            <div className="symbol symbol-45px me-5">
                              <span className="symbol-label bg-light-primary text-primary fw-bold">
                                {rule.rule_name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="d-flex justify-content-start flex-column">
                              <span className="text-dark fw-bold text-hover-primary fs-6">
                                {rule.rule_name}
                              </span>
                              <span className="text-muted fw-semibold text-muted d-block fs-7">
                                {rule.description || 'No description'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-light-info">
                            {rule.entity_type}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-light-warning">
                            {rule.trigger_event}
                          </span>
                        </td>
                        <td>
                          <div className="form-check form-switch form-check-custom form-check-solid">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={rule.active}
                              onChange={() => handleToggleRuleStatus(rule)}
                            />
                          </div>
                        </td>
                        <td>
                          <div className="d-flex justify-content-end flex-shrink-0">
                            <button
                              className="btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1"
                              onClick={() => handleTestWorkflow(rule)}
                              title="Test Workflow"
                            >
                              <KTIcon iconName="play" className="fs-3" />
                            </button>
                            <button
                              className="btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1"
                              onClick={() => setSelectedRule(rule)}
                              title="Edit Rule"
                            >
                              <KTIcon iconName="pencil" className="fs-3" />
                            </button>
                            <button
                              className="btn btn-icon btn-bg-light btn-active-color-danger btn-sm"
                              onClick={() => handleDeleteRule(rule.id)}
                              title="Delete Rule"
                            >
                              <KTIcon iconName="trash" className="fs-3" />
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
        )}

        {activeTab === 'templates' && (
          <div className="tab-pane fade show active">
            <div className="row g-6 g-xl-9">
              {templates.map((template, index) => (
                template && (
                <div key={index} className="col-md-6 col-lg-4">
                  <div className="card card-flush h-md-100">
                    <div className="card-header">
                      <div className="card-title">
                        <h2 className="fs-4 fw-bold">{template.rule_name}</h2>
                      </div>
                    </div>
                    <div className="card-body pt-1">
                      <div className="fw-semibold text-gray-600 mb-5">
                        {template.description}
                      </div>
                      <div className="d-flex flex-stack mb-3">
                        <span className="badge badge-light-primary">
                          {template.entity_type}
                        </span>
                        <span className="badge badge-light-warning">
                          {template.trigger_event}
                        </span>
                      </div>
                      <div className="d-flex flex-stack">
                        <span className="fw-bold text-gray-400 fs-7">
                          {template.actions?.length || 0} actions
                        </span>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleCreateFromTemplate(template)}
                          disabled={creatingFromTemplate === template.rule_name}
                        >
                          {creatingFromTemplate === template.rule_name ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                              Creating...
                            </>
                          ) : (
                            'Use Template'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                )
              ))}
            </div>
          </div>
        )}

        {activeTab === 'executions' && (
          <div className="tab-pane fade show active">
            <div className="text-center py-10">
              <KTIcon iconName="chart-line" className="fs-1 text-primary mb-3" />
              <h3 className="text-gray-800 fw-bold">Execution History</h3>
              <p className="text-muted">
                View detailed logs of workflow executions and their outcomes
              </p>
              <div className="text-muted fs-7 mt-3">
                Feature coming soon - execution tracking and analytics
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Rule Modal */}
      {showCreateModal && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered mw-650px">
            <div className="modal-content">
              <div className="modal-header">
                <h2 className="fw-bold">Create Workflow Rule</h2>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowCreateModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="text-center py-10">
                  <KTIcon iconName="code" className="fs-1 text-primary mb-3" />
                  <h3 className="text-gray-800 fw-bold">Rule Builder</h3>
                  <p className="text-muted">
                    Advanced rule builder interface coming soon
                  </p>
                  <div className="text-muted fs-7 mt-3">
                    For now, use the templates tab to create rules from predefined templates
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}