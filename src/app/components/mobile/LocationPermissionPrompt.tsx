import React, { useState, useEffect } from 'react';

interface LocationPermissionPromptProps {
  onPermissionGranted?: () => void;
  onPermissionDenied?: () => void;
}

export const LocationPermissionPrompt: React.FC<LocationPermissionPromptProps> = ({
  onPermissionGranted,
  onPermissionDenied
}) => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'prompt' | 'granted' | 'denied' | 'checking'>('checking');

  useEffect(() => {
    checkLocationPermission();
  }, []);

  const checkLocationPermission = async () => {
    // Check if we've already asked before
    const hasAskedBefore = localStorage.getItem('location-permission-asked');
    
    if ('permissions' in navigator) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        setPermissionStatus(result.state as any);
        
        // Show prompt if permission is 'prompt' and we haven't asked before
        if (result.state === 'prompt' && !hasAskedBefore) {
          setShowPrompt(true);
        } else if (result.state === 'granted') {
          onPermissionGranted?.();
        }
        
        // Listen for permission changes
        result.addEventListener('change', () => {
          setPermissionStatus(result.state as any);
          if (result.state === 'granted') {
            setShowPrompt(false);
            onPermissionGranted?.();
          } else if (result.state === 'denied') {
            setShowPrompt(false);
            onPermissionDenied?.();
          }
        });
      } catch (error) {
        console.warn('Permissions API not supported:', error);
        // If permissions API not supported, show prompt if we haven't asked
        if (!hasAskedBefore) {
          setShowPrompt(true);
        }
      }
    } else {
      // Permissions API not available, show prompt if we haven't asked
      if (!hasAskedBefore) {
        setShowPrompt(true);
      }
    }
  };

  const requestLocationPermission = async () => {
    // Mark that we've asked
    localStorage.setItem('location-permission-asked', 'true');
    
    try {
      // This will trigger the browser's permission prompt
      await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setPermissionStatus('granted');
            setShowPrompt(false);
            onPermissionGranted?.();
            resolve(position);
          },
          (error) => {
            if (error.code === error.PERMISSION_DENIED) {
              setPermissionStatus('denied');
              onPermissionDenied?.();
            }
            setShowPrompt(false);
            reject(error);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
      });
    } catch (error) {
      console.error('Location permission error:', error);
    }
  };

  const handleNotNow = () => {
    localStorage.setItem('location-permission-asked', 'true');
    setShowPrompt(false);
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-flex align-items-center justify-content-center" style={{ zIndex: 1050 }}>
      <div className="bg-white rounded-3 p-4 mx-3" style={{ maxWidth: '400px' }}>
        <div className="text-center mb-4">
          <i className="bi bi-geo-alt-fill text-primary" style={{ fontSize: '4rem' }}></i>
        </div>
        <h4 className="text-center mb-3">Enable Location Services</h4>
        <p className="text-muted text-center mb-4">
          TradeWorks Pro needs your location to provide the best experience for field technicians.
        </p>
        
        <div className="mb-4">
          <h6 className="mb-3">Location helps us:</h6>
          <ul className="text-muted small">
            <li className="mb-2">
              <i className="bi bi-check-circle-fill text-success me-2"></i>
              Navigate to job sites with one tap
            </li>
            <li className="mb-2">
              <i className="bi bi-check-circle-fill text-success me-2"></i>
              Notify customers when you're on the way
            </li>
            <li className="mb-2">
              <i className="bi bi-check-circle-fill text-success me-2"></i>
              Track mileage for accurate billing
            </li>
            <li className="mb-2">
              <i className="bi bi-check-circle-fill text-success me-2"></i>
              Find the nearest jobs to reduce travel time
            </li>
          </ul>
        </div>
        
        <div className="alert alert-info small mb-4">
          <i className="bi bi-shield-check me-2"></i>
          Your location is only used during work hours and is never shared without your permission.
        </div>
        
        <div className="d-grid gap-2">
          <button 
            className="btn btn-primary"
            onClick={requestLocationPermission}
          >
            <i className="bi bi-geo-alt me-2"></i>
            Enable Location
          </button>
          <button 
            className="btn btn-light"
            onClick={handleNotNow}
          >
            Not Now
          </button>
        </div>
        
        <p className="text-muted text-center small mt-3 mb-0">
          You can change this anytime in your browser settings
        </p>
      </div>
    </div>
  );
};

export default LocationPermissionPrompt;