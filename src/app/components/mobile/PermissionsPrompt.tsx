import React, { useState, useEffect } from 'react';
import { permissionsService, PermissionStatus } from '../../services/permissionsService';

interface PermissionsPromptProps {
  onPermissionsGranted?: () => void;
  requiredPermissions?: ('camera' | 'location')[];
}

const PermissionsPrompt: React.FC<PermissionsPromptProps> = ({ 
  onPermissionsGranted,
  requiredPermissions = ['camera', 'location']
}) => {
  const [permissions, setPermissions] = useState<PermissionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    setLoading(true);
    const status = await permissionsService.checkAllPermissions();
    setPermissions(status);
    
    // Check if all required permissions are granted
    const allGranted = requiredPermissions.every(perm => status[perm]);
    
    if (allGranted) {
      onPermissionsGranted?.();
      setShowPrompt(false);
    } else {
      setShowPrompt(true);
    }
    
    setLoading(false);
  };

  const handleRequestPermissions = async () => {
    setLoading(true);
    const status = await permissionsService.requestAllPermissions();
    setPermissions(status);
    
    // Check if all required permissions are granted
    const allGranted = requiredPermissions.every(perm => status[perm]);
    
    if (allGranted) {
      onPermissionsGranted?.();
      setShowPrompt(false);
    }
    
    setLoading(false);
  };

  const handleOpenSettings = async () => {
    await permissionsService.openAppSettings();
  };

  if (loading) {
    return (
      <div className="permissions-loading d-flex justify-content-center align-items-center p-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Checking permissions...</span>
        </div>
      </div>
    );
  }

  if (!showPrompt) {
    return null;
  }

  const missingPermissions = requiredPermissions.filter(perm => !permissions?.[perm]);

  return (
    <div className="permissions-prompt">
      <div className="card border-0 shadow-lg">
        <div className="card-body p-4">
          <div className="text-center mb-4">
            <i className="bi bi-shield-check display-1 text-primary"></i>
            <h3 className="mt-3">Permissions Required</h3>
            <p className="text-muted">
              TradeWorks Pro needs access to the following features to work properly:
            </p>
          </div>

          <div className="permissions-list mb-4">
            {requiredPermissions.includes('camera') && (
              <div className="permission-item d-flex align-items-start mb-3">
                <div className="permission-icon">
                  <i className={`bi bi-camera-fill ${permissions?.camera ? 'text-success' : 'text-muted'}`}></i>
                </div>
                <div className="permission-details ms-3">
                  <h6 className="mb-1">Camera Access</h6>
                  <p className="text-muted small mb-0">
                    Take photos of job sites, equipment, and completed work
                  </p>
                  {!permissions?.camera && (
                    <span className="badge bg-warning text-dark mt-1">Not Granted</span>
                  )}
                </div>
              </div>
            )}

            {requiredPermissions.includes('location') && (
              <div className="permission-item d-flex align-items-start mb-3">
                <div className="permission-icon">
                  <i className={`bi bi-geo-alt-fill ${permissions?.location ? 'text-success' : 'text-muted'}`}></i>
                </div>
                <div className="permission-details ms-3">
                  <h6 className="mb-1">Location Access</h6>
                  <p className="text-muted small mb-0">
                    Track your location for job routing and time tracking
                  </p>
                  {!permissions?.location && (
                    <span className="badge bg-warning text-dark mt-1">Not Granted</span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="d-grid gap-2">
            <button
              className="btn btn-primary btn-lg"
              onClick={handleRequestPermissions}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Requesting Permissions...
                </>
              ) : (
                <>
                  <i className="bi bi-check-circle me-2"></i>
                  Grant Permissions
                </>
              )}
            </button>

            {missingPermissions.length > 0 && (
              <button
                className="btn btn-outline-secondary"
                onClick={handleOpenSettings}
              >
                <i className="bi bi-gear me-2"></i>
                Open App Settings
              </button>
            )}
          </div>

          <div className="alert alert-info mt-3 mb-0">
            <i className="bi bi-info-circle me-2"></i>
            <small>
              You can change these permissions anytime in your device settings.
            </small>
          </div>
        </div>
      </div>

      <style>{`
        .permissions-prompt {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          z-index: 9999;
        }

        .permissions-prompt .card {
          max-width: 500px;
          width: 100%;
        }

        .permission-icon {
          width: 40px;
          height: 40px;
          background: var(--bs-light);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
        }

        .permission-item {
          padding: 1rem;
          background: var(--bs-light);
          border-radius: 0.5rem;
        }

        @media (max-width: 576px) {
          .permissions-prompt .card {
            margin: 1rem;
          }
        }
      `}</style>
    </div>
  );
};

export default PermissionsPrompt;