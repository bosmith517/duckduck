import React, { useState } from 'react'
import { Modal, Button } from 'react-bootstrap'

interface User {
  id: string
  name: string
  email: string
  role: string
  permissions: string[]
}

interface RoleAssignmentModalProps {
  show: boolean
  onHide: () => void
  user: User | null
  onSave: (userId: string, role: string, permissions: string[]) => void
}

const ROLES = [
  {
    id: 'admin',
    name: 'Administrator',
    description: 'Full system access - can manage all users, settings, and data',
    permissions: [
      'user_management',
      'billing_management', 
      'system_settings',
      'tenant_management',
      'job_management',
      'customer_management',
      'communication_management',
      'report_access',
      'mobile_tracking'
    ]
  },
  {
    id: 'manager',
    name: 'Manager',
    description: 'Can manage jobs, customers, and team members',
    permissions: [
      'job_management',
      'customer_management',
      'team_management',
      'communication_management',
      'report_access',
      'mobile_tracking'
    ]
  },
  {
    id: 'agent',
    name: 'Agent/Technician',
    description: 'Can handle jobs, communicate with customers, and use mobile features',
    permissions: [
      'job_access',
      'customer_communication',
      'mobile_tracking',
      'basic_reports'
    ]
  },
  {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access to dashboards and reports',
    permissions: [
      'dashboard_view',
      'basic_reports'
    ]
  },
  {
    id: 'client',
    name: 'Client/Customer',
    description: 'Access to customer portal and homeowner features',
    permissions: [
      'customer_portal',
      'homeowner_portal',
      'job_status_view'
    ]
  }
]

const RoleAssignmentModal: React.FC<RoleAssignmentModalProps> = ({
  show,
  onHide,
  user,
  onSave
}) => {
  const [selectedRole, setSelectedRole] = useState(user?.role || 'agent')
  const [customPermissions, setCustomPermissions] = useState<string[]>(user?.permissions || [])

  const handleRoleChange = (roleId: string) => {
    setSelectedRole(roleId)
    const role = ROLES.find(r => r.id === roleId)
    if (role) {
      setCustomPermissions(role.permissions)
    }
  }

  const handlePermissionToggle = (permission: string) => {
    setCustomPermissions(prev => 
      prev.includes(permission)
        ? prev.filter(p => p !== permission)
        : [...prev, permission]
    )
  }

  const handleSave = () => {
    if (user) {
      onSave(user.id, selectedRole, customPermissions)
      onHide()
    }
  }

  const selectedRoleData = ROLES.find(r => r.id === selectedRole)

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="ki-duotone ki-security-user fs-2 me-2">
            <span className="path1"></span>
            <span className="path2"></span>
          </i>
          Assign Role - {user?.name}
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        {/* Role Selection */}
        <div className="mb-6">
          <h5 className="fw-bold mb-3">Select Role</h5>
          <div className="row g-3">
            {ROLES.map(role => (
              <div key={role.id} className="col-md-6">
                <div 
                  className={`card cursor-pointer h-100 ${selectedRole === role.id ? 'border-primary bg-light-primary' : ''}`}
                  onClick={() => handleRoleChange(role.id)}
                >
                  <div className="card-body p-4">
                    <div className="d-flex align-items-start">
                      <div className="form-check">
                        <input 
                          className="form-check-input" 
                          type="radio" 
                          name="role"
                          checked={selectedRole === role.id}
                          onChange={() => handleRoleChange(role.id)}
                        />
                      </div>
                      <div className="ms-3">
                        <h6 className="mb-1">{role.name}</h6>
                        <p className="text-muted fs-7 mb-0">{role.description}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Permission Details */}
        {selectedRoleData && (
          <div className="mb-6">
            <h5 className="fw-bold mb-3">Permissions for {selectedRoleData.name}</h5>
            <div className="bg-light rounded p-4">
              <div className="row g-3">
                {[
                  { id: 'user_management', label: 'User Management', icon: 'people' },
                  { id: 'billing_management', label: 'Billing & Payments', icon: 'bill' },
                  { id: 'system_settings', label: 'System Settings', icon: 'setting-2' },
                  { id: 'tenant_management', label: 'Company Management', icon: 'office-bag' },
                  { id: 'job_management', label: 'Job Management', icon: 'briefcase' },
                  { id: 'customer_management', label: 'Customer Management', icon: 'profile-circle' },
                  { id: 'communication_management', label: 'Communications', icon: 'message-text-2' },
                  { id: 'report_access', label: 'Reports & Analytics', icon: 'chart-simple' },
                  { id: 'mobile_tracking', label: 'Mobile & Tracking', icon: 'geolocation' },
                  { id: 'job_access', label: 'Job Access', icon: 'document' },
                  { id: 'customer_communication', label: 'Customer Communication', icon: 'sms' },
                  { id: 'dashboard_view', label: 'Dashboard View', icon: 'element-11' },
                  { id: 'customer_portal', label: 'Customer Portal', icon: 'login' },
                  { id: 'homeowner_portal', label: 'Homeowner Portal', icon: 'home-2' },
                  { id: 'job_status_view', label: 'Job Status View', icon: 'eye' },
                  { id: 'basic_reports', label: 'Basic Reports', icon: 'chart-pie' },
                  { id: 'team_management', label: 'Team Management', icon: 'people' }
                ].map(permission => (
                  <div key={permission.id} className="col-md-6 col-lg-4">
                    <div className="form-check">
                      <input 
                        className="form-check-input" 
                        type="checkbox"
                        checked={customPermissions.includes(permission.id)}
                        onChange={() => handlePermissionToggle(permission.id)}
                      />
                      <label className="form-check-label d-flex align-items-center">
                        <i className={`ki-duotone ki-${permission.icon} fs-5 me-2`}>
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        {permission.label}
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Role Summary */}
        <div className="alert alert-info">
          <h6 className="alert-heading">
            <i className="ki-duotone ki-information-5 fs-4 me-2">
              <span className="path1"></span>
              <span className="path2"></span>
              <span className="path3"></span>
            </i>
            Role Assignment Summary
          </h6>
          <p className="mb-0">
            <strong>{user?.name}</strong> will be assigned the <strong>{selectedRoleData?.name}</strong> role 
            with {customPermissions.length} permissions. This user will have access to 
            {selectedRole === 'admin' ? ' all system features' : 
             selectedRole === 'manager' ? ' management features and team oversight' :
             selectedRole === 'agent' ? ' field operations and customer communication' :
             selectedRole === 'viewer' ? ' read-only access to reports and dashboards' :
             ' customer portal and homeowner features'}.
          </p>
        </div>
      </Modal.Body>
      
      <Modal.Footer>
        <Button variant="light" onClick={onHide}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave}>
          <i className="ki-duotone ki-check fs-5 me-2">
            <span className="path1"></span>
            <span className="path2"></span>
          </i>
          Assign Role
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

export default RoleAssignmentModal