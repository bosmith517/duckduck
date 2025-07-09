import React, { useState } from 'react';
import MobileLayout from '../../components/mobile/MobileLayout';
import MobileLocationTracker from '../../components/mobile/MobileLocationTracker';
import { LocationData } from '../../services/mobileService';
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth';
import { permissionsService } from '../../services/permissionsService';

const MobileLocationPage: React.FC = () => {
  const { currentUser } = useSupabaseAuth();
  const [isTracking, setIsTracking] = useState(false);
  const [locationHistory, setLocationHistory] = useState<LocationData[]>([]);

  const handleLocationUpdate = (location: LocationData) => {
    setLocationHistory(prev => [...prev, location]);
  };

  const toggleTracking = async () => {
    if (!isTracking) {
      // Check permission first when starting tracking
      const hasPermission = await permissionsService.checkLocationPermission();
      if (!hasPermission) {
        // Request permission if not granted
        const granted = await permissionsService.requestLocationPermission();
        if (!granted) {
          alert('Location permission is required for tracking. Please enable it in your device settings.');
          return;
        }
      }
    }
    setIsTracking(prev => !prev);
  };

  return (
    <MobileLayout title="Location Tracking" showBackButton>
      <div className="p-3">
        <div className="mb-4">
          <h4>Location Tracking Test</h4>
          <p>Test location tracking functionality for technicians.</p>
          
          <button
            className={`btn ${isTracking ? 'btn-danger' : 'btn-primary'} btn-lg w-100`}
            onClick={toggleTracking}
          >
            {isTracking ? (
              <>
                <i className="bi bi-stop-circle me-2"></i>
                Stop Tracking
              </>
            ) : (
              <>
                <i className="bi bi-play-circle me-2"></i>
                Start Tracking
              </>
            )}
          </button>
        </div>

        <MobileLocationTracker
          technicianId={String(currentUser?.id || 'test-user')}
          isActive={isTracking}
          onLocationUpdate={handleLocationUpdate}
        />

        {locationHistory.length > 0 && (
          <div className="location-history mt-4">
            <h5>Location History ({locationHistory.length} points)</h5>
            <div className="history-list">
              {locationHistory.slice(-5).reverse().map((location, index) => (
                <div key={index} className="history-item">
                  <div className="d-flex justify-content-between">
                    <small className="text-muted">
                      {new Date(location.timestamp).toLocaleTimeString()}
                    </small>
                    <small className="text-primary">
                      ±{Math.round(location.accuracy)}m
                    </small>
                  </div>
                  <div className="coordinates">
                    {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .history-list {
          max-height: 300px;
          overflow-y: auto;
        }

        .history-item {
          padding: 0.75rem;
          border: 1px solid var(--bs-border-color);
          border-radius: 0.5rem;
          margin-bottom: 0.5rem;
          background: var(--bs-light);
        }

        .coordinates {
          font-family: monospace;
          font-size: 0.875rem;
        }
      `}</style>
    </MobileLayout>
  );
};

export default MobileLocationPage;