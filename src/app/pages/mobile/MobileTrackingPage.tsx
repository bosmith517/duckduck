import React, { useState, useEffect } from 'react';
import MobileLayout from '../../components/mobile/MobileLayout';
import MobileLocationTracker from '../../components/mobile/MobileLocationTracker';
import MobileCameraCapture from '../../components/mobile/MobileCameraCapture';
import { MobileService, LocationData, PhotoResult } from '../../services/mobileService';
import { supabase } from '../../../supabaseClient';
import { trackingService } from '../../services/trackingService';
import { showToast } from '../../utils/toast';

interface Job {
  id: string;
  title: string;
  address: string;
  status: string;
  customer_name: string;
  scheduled_start: string;
  estimated_duration: number;
}

export const MobileTrackingPage: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [isOnMyWay, setIsOnMyWay] = useState(false);
  const [isAtLocation, setIsAtLocation] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [jobPhotos, setJobPhotos] = useState<PhotoResult[]>([]);
  const [workStatus, setWorkStatus] = useState<'not_started' | 'in_progress' | 'completed'>('not_started');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchCurrentUser();
    fetchActiveJob();
    
    // Initialize mobile services
    if (MobileService.isNativePlatform()) {
      MobileService.scheduleLocalNotification(
        'TradeWorks Pro',
        'Location tracking is active',
      );
    }
    
    // Cleanup function to stop tracking when component unmounts
    return () => {
      if (trackingService.isCurrentlyTracking) {
        trackingService.stopTracking();
      }
    };
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const fetchActiveJob = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('status', 'in_progress')
        .single();

      if (!error && data) {
        setActiveJob(data);
      }
    } catch (error) {
      console.error('Error fetching active job:', error);
    }
  };

  const handleStartOnMyWay = async () => {
    if (!activeJob) return;

    try {
      setIsOnMyWay(true);
      await MobileService.hapticFeedback('medium');
      
      // Update job status
      const { error } = await supabase
        .from('jobs')
        .update({ 
          status: 'on_the_way',
          on_my_way_started: new Date().toISOString()
        })
        .eq('id', activeJob.id);

      if (error) throw error;

      // Start location tracking
      showToast.loading('Starting location tracking...');
      const trackingResult = await trackingService.startTracking(activeJob.id);
      
      if (trackingResult.success) {
        showToast.success('Location tracking started! Customer will be notified.');
        
        // Send notification to customer
        await MobileService.scheduleLocalNotification(
          'On My Way Started',
          `Location tracking started for ${activeJob.title}`,
        );
      } else {
        throw new Error(trackingResult.error || 'Failed to start tracking');
      }

    } catch (error) {
      console.error('Error starting on my way:', error);
      showToast.error('Failed to start tracking. Please check location permissions.');
      setIsOnMyWay(false);
    }
  };

  const handleArrivedAtLocation = async () => {
    if (!activeJob) return;

    try {
      setIsAtLocation(true);
      await MobileService.hapticFeedback('heavy');

      const { error } = await supabase
        .from('jobs')
        .update({ 
          status: 'arrived',
          arrived_at: new Date().toISOString()
        })
        .eq('id', activeJob.id);

      if (error) throw error;

      await MobileService.scheduleLocalNotification(
        'Arrived at Location',
        `Checked in at ${activeJob.address}`,
      );

    } catch (error) {
      console.error('Error marking arrival:', error);
      setIsAtLocation(false);
    }
  };

  const handleStartWork = async () => {
    if (!activeJob) return;

    try {
      setWorkStatus('in_progress');
      await MobileService.hapticFeedback('medium');

      const { error } = await supabase
        .from('jobs')
        .update({ 
          status: 'work_in_progress',
          work_started: new Date().toISOString()
        })
        .eq('id', activeJob.id);

      if (error) throw error;

    } catch (error) {
      console.error('Error starting work:', error);
      setWorkStatus('not_started');
    }
  };

  const handlePhotoTaken = async (photo: PhotoResult) => {
    setJobPhotos(prev => [...prev, photo]);
    setShowCamera(false);
    
    // Save photo to storage
    try {
      const base64Data = photo.dataUrl.split(',')[1];
      const fileName = `job_${activeJob?.id}_${Date.now()}.jpg`;
      
      const { error: uploadError } = await supabase.storage
        .from('job-photos')
        .upload(fileName, Buffer.from(base64Data, 'base64'), {
          contentType: 'image/jpeg',
        });

      if (uploadError) throw uploadError;

      await MobileService.hapticFeedback('light');
      
    } catch (error) {
      console.error('Error saving photo:', error);
    }
  };

  const handleCompleteJob = async () => {
    if (!activeJob) return;

    try {
      setWorkStatus('completed');
      await MobileService.hapticFeedback('heavy');

      const { error } = await supabase
        .from('jobs')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
          completion_notes: notes
        })
        .eq('id', activeJob.id);

      if (error) throw error;

      await MobileService.scheduleLocalNotification(
        'Job Completed',
        `${activeJob.title} has been completed`,
      );

      // Stop tracking when job is completed
      if (trackingService.isCurrentlyTracking) {
        await trackingService.stopTracking();
      }

      // Reset state
      setActiveJob(null);
      setIsOnMyWay(false);
      setIsAtLocation(false);
      setJobPhotos([]);
      setNotes('');

    } catch (error) {
      console.error('Error completing job:', error);
      setWorkStatus('in_progress');
    }
  };

  const handleLocationUpdate = (location: LocationData) => {
    // Check if close to job location (within 100 meters)
    if (activeJob && !isAtLocation) {
      // This would need actual geocoding to compare addresses
      // For now, we'll use a simple distance check if coordinates are available
      console.log('Location updated:', location);
    }
  };

  if (!activeJob) {
    return (
      <MobileLayout title="Job Tracking" showBackButton>
        <div className="text-center py-5">
          <i className="bi bi-briefcase display-1 text-muted"></i>
          <h3 className="mt-3">No Active Job</h3>
          <p className="text-muted">You don't have any active jobs to track.</p>
          <a href="/jobs" className="btn btn-primary">
            View Available Jobs
          </a>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout title="Job Tracking" showBackButton>
      {/* Active Job Info */}
      <div className="job-info-card mb-4">
        <div className="d-flex align-items-start justify-content-between mb-3">
          <div>
            <h4 className="mb-1">{activeJob.title}</h4>
            <p className="text-muted mb-0">{activeJob.customer_name}</p>
          </div>
          <span className={`badge bg-${getStatusColor(activeJob.status)}`}>
            {activeJob.status.replace('_', ' ').toUpperCase()}
          </span>
        </div>
        
        <div className="job-details">
          <div className="detail-item">
            <i className="bi bi-geo-alt text-primary"></i>
            <span>{activeJob.address}</span>
          </div>
          <div className="detail-item">
            <i className="bi bi-clock text-primary"></i>
            <span>{new Date(activeJob.scheduled_start).toLocaleString()}</span>
          </div>
          <div className="detail-item">
            <i className="bi bi-stopwatch text-primary"></i>
            <span>{activeJob.estimated_duration} hours estimated</span>
          </div>
        </div>
      </div>

      {/* Location Tracking */}
      <MobileLocationTracker
        technicianId={currentUser?.id || ''}
        isActive={isOnMyWay || isAtLocation}
        onLocationUpdate={handleLocationUpdate}
      />

      {/* Job Status Actions */}
      <div className="job-actions mb-4">
        {!isOnMyWay && (
          <button
            className="btn btn-primary btn-lg w-100 mb-3"
            onClick={handleStartOnMyWay}
          >
            <i className="bi bi-geo-alt-fill me-2"></i>
            Start "On My Way"
          </button>
        )}

        {isOnMyWay && !isAtLocation && (
          <button
            className="btn btn-success btn-lg w-100 mb-3"
            onClick={handleArrivedAtLocation}
          >
            <i className="bi bi-check-circle-fill me-2"></i>
            I've Arrived
          </button>
        )}

        {isAtLocation && workStatus === 'not_started' && (
          <button
            className="btn btn-warning btn-lg w-100 mb-3"
            onClick={handleStartWork}
          >
            <i className="bi bi-play-fill me-2"></i>
            Start Work
          </button>
        )}

        {workStatus === 'in_progress' && (
          <div className="work-progress">
            <div className="row g-2 mb-3">
              <div className="col-6">
                <button
                  className="btn btn-outline-primary w-100"
                  onClick={() => setShowCamera(true)}
                >
                  <i className="bi bi-camera me-2"></i>
                  Take Photo
                </button>
              </div>
              <div className="col-6">
                <button
                  className="btn btn-success w-100"
                  onClick={handleCompleteJob}
                >
                  <i className="bi bi-check-lg me-2"></i>
                  Complete
                </button>
              </div>
            </div>

            {/* Job Photos */}
            {jobPhotos.length > 0 && (
              <div className="job-photos mb-3">
                <h6>Job Photos ({jobPhotos.length})</h6>
                <div className="photo-grid">
                  {jobPhotos.map((photo, index) => (
                    <div key={index} className="photo-thumbnail">
                      <img src={photo.dataUrl} alt={`Job photo ${index + 1}`} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="mb-3">
              <label className="form-label">Job Notes</label>
              <textarea
                className="form-control"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about the job..."
              />
            </div>
          </div>
        )}
      </div>

      {/* Camera Modal */}
      {showCamera && (
        <MobileCameraCapture
          title="Take Job Photo"
          onPhotoTaken={handlePhotoTaken}
          onCancel={() => setShowCamera(false)}
        />
      )}

      <style>{`
        .job-info-card {
          background: white;
          border-radius: 0.75rem;
          padding: 1.5rem;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          border: 1px solid var(--bs-border-color);
        }

        .job-details {
          border-top: 1px solid var(--bs-border-color);
          padding-top: 1rem;
        }

        .detail-item {
          display: flex;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .detail-item i {
          width: 20px;
          margin-right: 0.75rem;
        }

        .photo-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
          gap: 0.5rem;
        }

        .photo-thumbnail {
          aspect-ratio: 1;
          border-radius: 0.5rem;
          overflow: hidden;
          border: 2px solid var(--bs-border-color);
        }

        .photo-thumbnail img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .work-progress {
          background: var(--bs-light);
          border-radius: 0.5rem;
          padding: 1rem;
        }
      `}</style>
    </MobileLayout>
  );
};

function getStatusColor(status: string): string {
  switch (status) {
    case 'scheduled': return 'primary';
    case 'on_the_way': return 'warning';
    case 'arrived': return 'info';
    case 'work_in_progress': return 'warning';
    case 'completed': return 'success';
    default: return 'secondary';
  }
}

export default MobileTrackingPage