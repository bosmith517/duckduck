import React, { useState, useEffect } from 'react';
import { MobileService, PhotoResult } from '../../services/mobileService';
import { permissionsService } from '../../services/permissionsService';
import PermissionsPrompt from './PermissionsPrompt';

interface MobileCameraCaptureProps {
  onPhotoTaken: (photo: PhotoResult) => void;
  onCancel: () => void;
  title?: string;
  allowGallery?: boolean;
}

export const MobileCameraCapture: React.FC<MobileCameraCaptureProps> = ({
  onPhotoTaken,
  onCancel,
  title = 'Take Equipment Photo',
  allowGallery = true,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    checkCameraPermission();
  }, []);

  const checkCameraPermission = async () => {
    const permission = await permissionsService.checkCameraPermission();
    setHasPermission(permission);
  };

  const handleTakePhoto = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      await MobileService.hapticFeedback('light');
      const photo = await MobileService.takePhoto();
      
      onPhotoTaken(photo);
    } catch (err) {
      setError('Failed to take photo. Please try again.');
      console.error('Camera error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectFromGallery = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      await MobileService.hapticFeedback('light');
      const photo = await MobileService.selectPhoto();
      
      onPhotoTaken(photo);
    } catch (err) {
      setError('Failed to select photo. Please try again.');
      console.error('Gallery error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    await MobileService.hapticFeedback('light');
    onCancel();
  };

  const handlePermissionsGranted = () => {
    setHasPermission(true);
  };

  if (hasPermission === false) {
    return (
      <PermissionsPrompt 
        requiredPermissions={['camera']}
        onPermissionsGranted={handlePermissionsGranted}
      />
    );
  }

  return (
    <div className="mobile-camera-capture">
      <div className="camera-overlay">
        <div className="camera-modal">
          <div className="camera-header">
            <h3>{title}</h3>
            <button 
              className="btn btn-link text-white"
              onClick={handleCancel}
              disabled={isLoading}
            >
              <i className="bi bi-x-lg"></i>
            </button>
          </div>

          <div className="camera-content">
            <div className="camera-instructions">
              <i className="bi bi-camera camera-icon"></i>
              <p>Position your device to capture the equipment clearly</p>
              {error && (
                <div className="alert alert-danger">
                  {error}
                </div>
              )}
            </div>

            <div className="camera-actions">
              <button
                className="btn btn-primary btn-lg camera-button"
                onClick={handleTakePhoto}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="spinner-border spinner-border-sm me-2"></div>
                    Taking Photo...
                  </>
                ) : (
                  <>
                    <i className="bi bi-camera-fill me-2"></i>
                    Take Photo
                  </>
                )}
              </button>

              {allowGallery && (
                <button
                  className="btn btn-outline-primary btn-lg"
                  onClick={handleSelectFromGallery}
                  disabled={isLoading}
                >
                  <i className="bi bi-images me-2"></i>
                  Choose from Gallery
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .mobile-camera-capture {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 9999;
        }

        .camera-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }

        .camera-modal {
          background: var(--bs-dark);
          border-radius: 1rem;
          padding: 0;
          width: 100%;
          max-width: 400px;
          color: white;
          overflow: hidden;
        }

        .camera-header {
          background: var(--bs-primary);
          padding: 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .camera-header h3 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
        }

        .camera-content {
          padding: 2rem;
          text-align: center;
        }

        .camera-instructions {
          margin-bottom: 2rem;
        }

        .camera-icon {
          font-size: 4rem;
          color: var(--bs-primary);
          margin-bottom: 1rem;
          display: block;
        }

        .camera-instructions p {
          color: var(--bs-light);
          margin-bottom: 0;
        }

        .camera-actions {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .camera-button {
          border-radius: 2rem;
          padding: 1rem 2rem;
          font-weight: 600;
          background: var(--bs-primary);
          border: none;
          position: relative;
        }

        .camera-button:disabled {
          opacity: 0.6;
        }

        .btn-outline-primary {
          border-radius: 2rem;
          padding: 1rem 2rem;
          font-weight: 600;
          border: 2px solid var(--bs-primary);
          color: var(--bs-primary);
          background: transparent;
        }

        .btn-outline-primary:hover {
          background: var(--bs-primary);
          color: white;
        }

        @media (max-width: 480px) {
          .camera-content {
            padding: 1.5rem;
          }
          
          .camera-icon {
            font-size: 3rem;
          }
          
          .camera-actions {
            gap: 0.75rem;
          }
          
          .camera-button,
          .btn-outline-primary {
            padding: 0.875rem 1.5rem;
            font-size: 0.9rem;
          }
        }
      `}</style>
    </div>
  );
};

export default MobileCameraCapture;