import React, { useState, useEffect, useRef } from 'react';
import { MobileService, LocationData } from '../../services/mobileService';
import { supabase } from '../../../supabaseClient';
import { permissionsService } from '../../services/permissionsService';
import PermissionsPrompt from './PermissionsPrompt';

interface MobileLocationTrackerProps {
  technicianId: string;
  isActive: boolean;
  onLocationUpdate?: (location: LocationData) => void;
}

export const MobileLocationTracker: React.FC<MobileLocationTrackerProps> = ({
  technicianId,
  isActive,
  onLocationUpdate,
}) => {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [watchId, setWatchId] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<'high' | 'medium' | 'low'>('medium');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  
  const locationBuffer = useRef<LocationData[]>([]);
  const lastSyncTime = useRef<number>(0);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    checkLocationPermission();
  }, []);

  useEffect(() => {
    if (isActive && !isTracking && hasPermission) {
      startTracking();
    } else if (!isActive && isTracking) {
      stopTracking();
    }

    return () => {
      stopTracking();
    };
  }, [isActive, hasPermission]);

  const checkLocationPermission = async () => {
    const permission = await permissionsService.checkLocationPermission();
    setHasPermission(permission);
  };

  const startTracking = async () => {
    try {
      setError(null);
      setIsTracking(true);

      // Get initial position
      const initialPosition = await MobileService.getCurrentPosition();
      setCurrentLocation(initialPosition);
      locationBuffer.current.push(initialPosition);

      if (onLocationUpdate) {
        onLocationUpdate(initialPosition);
      }

      // Start watching position
      const id = await MobileService.watchPosition((location) => {
        setCurrentLocation(location);
        locationBuffer.current.push(location);

        // Determine accuracy based on GPS accuracy
        if (location.accuracy <= 10) {
          setAccuracy('high');
        } else if (location.accuracy <= 50) {
          setAccuracy('medium');
        } else {
          setAccuracy('low');
        }

        if (onLocationUpdate) {
          onLocationUpdate(location);
        }

        // Buffer locations and sync periodically
        if (locationBuffer.current.length >= 5 || 
            Date.now() - lastSyncTime.current > 30000) { // 30 seconds
          syncLocationData();
        }
      });

      setWatchId(id);

      // Set up periodic sync
      syncIntervalRef.current = setInterval(() => {
        if (locationBuffer.current.length > 0) {
          syncLocationData();
        }
      }, 60000); // Sync every minute

    } catch (err) {
      setError('Failed to start location tracking. Please check permissions.');
      setIsTracking(false);
      console.error('Location tracking error:', err);
    }
  };

  const stopTracking = async () => {
    if (watchId) {
      await MobileService.clearWatch(watchId);
      setWatchId(null);
    }

    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }

    // Sync any remaining location data
    if (locationBuffer.current.length > 0) {
      await syncLocationData();
    }

    setIsTracking(false);
  };

  const syncLocationData = async () => {
    if (locationBuffer.current.length === 0) return;

    try {
      const locationsToSync = [...locationBuffer.current];
      locationBuffer.current = [];

      // Prepare location data for database
      const locationRecords = locationsToSync.map(location => ({
        technician_id: technicianId,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        timestamp: new Date(location.timestamp).toISOString(),
        created_at: new Date().toISOString(),
      }));

      // Insert into database
      const { error: dbError } = await supabase
        .from('technician_locations')
        .insert(locationRecords);

      if (dbError) {
        console.error('Error syncing location data:', dbError);
        // Put data back in buffer for retry
        locationBuffer.current = [...locationsToSync, ...locationBuffer.current];
      } else {
        lastSyncTime.current = Date.now();
        console.log(`Synced ${locationsToSync.length} location points`);
      }
    } catch (error) {
      console.error('Error syncing location data:', error);
    }
  };

  const getAccuracyColor = () => {
    switch (accuracy) {
      case 'high': return 'text-success';
      case 'medium': return 'text-warning';
      case 'low': return 'text-danger';
      default: return 'text-secondary';
    }
  };

  const getAccuracyText = () => {
    switch (accuracy) {
      case 'high': return 'High Accuracy';
      case 'medium': return 'Medium Accuracy';
      case 'low': return 'Low Accuracy';
      default: return 'Unknown';
    }
  };

  const formatCoordinates = (lat: number, lng: number) => {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  const handlePermissionsGranted = () => {
    setHasPermission(true);
  };

  if (hasPermission === false) {
    return (
      <PermissionsPrompt 
        requiredPermissions={['location']}
        onPermissionsGranted={handlePermissionsGranted}
      />
    );
  }

  return (
    <div className="mobile-location-tracker">
      <div className="location-status-card">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h5 className="mb-0">Location Tracking</h5>
          <div className={`tracking-indicator ${isTracking ? 'active' : ''}`}>
            <i className={`bi ${isTracking ? 'bi-geo-alt-fill' : 'bi-geo-alt'}`}></i>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger mb-3">
            <i className="bi bi-exclamation-triangle me-2"></i>
            {error}
          </div>
        )}

        {isTracking && currentLocation && (
          <div className="location-info">
            <div className="row g-3">
              <div className="col-12">
                <div className="location-detail">
                  <label className="form-label small text-muted">Current Position</label>
                  <div className="fw-medium">
                    {formatCoordinates(currentLocation.latitude, currentLocation.longitude)}
                  </div>
                </div>
              </div>
              
              <div className="col-6">
                <div className="location-detail">
                  <label className="form-label small text-muted">Accuracy</label>
                  <div className={`fw-medium ${getAccuracyColor()}`}>
                    ±{Math.round(currentLocation.accuracy)}m
                  </div>
                  <small className={getAccuracyColor()}>
                    {getAccuracyText()}
                  </small>
                </div>
              </div>
              
              <div className="col-6">
                <div className="location-detail">
                  <label className="form-label small text-muted">Last Update</label>
                  <div className="fw-medium">
                    {new Date(currentLocation.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>

            <div className="location-actions mt-3">
              <button
                className="btn btn-outline-primary btn-sm"
                onClick={() => {
                  if (navigator.geolocation) {
                    const url = `https://maps.google.com/maps?q=${currentLocation.latitude},${currentLocation.longitude}`;
                    window.open(url, '_blank');
                  }
                }}
              >
                <i className="bi bi-map me-1"></i>
                View on Map
              </button>
              
              {locationBuffer.current.length > 0 && (
                <button
                  className="btn btn-outline-secondary btn-sm ms-2"
                  onClick={syncLocationData}
                >
                  <i className="bi bi-cloud-upload me-1"></i>
                  Sync Now ({locationBuffer.current.length})
                </button>
              )}
            </div>
          </div>
        )}

        {!isTracking && !error && (
          <div className="text-center text-muted">
            <i className="bi bi-geo-alt display-6"></i>
            <p className="mb-0">Location tracking is stopped</p>
          </div>
        )}
      </div>

      <style>{`
        .mobile-location-tracker {
          margin-bottom: 1rem;
        }

        .location-status-card {
          background: white;
          border-radius: 0.75rem;
          padding: 1.5rem;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          border: 1px solid var(--bs-border-color);
        }

        .tracking-indicator {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--bs-light);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        }

        .tracking-indicator.active {
          background: var(--bs-success);
          color: white;
          animation: pulse 2s infinite;
        }

        .tracking-indicator i {
          font-size: 1.25rem;
        }

        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }

        .location-info {
          border-top: 1px solid var(--bs-border-color);
          padding-top: 1rem;
        }

        .location-detail {
          margin-bottom: 0.5rem;
        }

        .location-detail label {
          margin-bottom: 0.25rem;
          font-weight: 500;
        }

        .location-actions {
          border-top: 1px solid var(--bs-border-color);
          padding-top: 1rem;
        }

        @media (max-width: 576px) {
          .location-status-card {
            padding: 1rem;
          }
          
          .location-actions {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }
          
          .location-actions .btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default MobileLocationTracker;