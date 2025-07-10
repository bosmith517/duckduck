import { supabase } from '../../supabaseClient';

interface TrackingSession {
  jobId: string;
  technicianId: string;
  isActive: boolean;
  startTime: Date;
}

class MobileTrackingService {
  private currentSession: TrackingSession | null = null;
  private watchId: number | null = null;
  private updateInterval: NodeJS.Timeout | null = null;

  async startTracking(jobId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, message: 'User not authenticated' };
      }

      // Update job status to "On Route"
      const { error: statusError } = await supabase
        .from('jobs')
        .update({ 
          status: 'On Route',
          started_travel_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (statusError) {
        console.error('Status update error:', statusError);
        return { success: false, message: 'Failed to update job status' };
      }

      // Create tracking session
      this.currentSession = {
        jobId,
        technicianId: user.id,
        isActive: true,
        startTime: new Date()
      };

      // Start location updates
      this.startLocationUpdates();

      // Log activity
      await supabase.from('job_activity_log').insert({
        job_id: jobId,
        user_id: user.id,
        action: 'status_changed',
        details: { 
          old_status: 'Scheduled', 
          new_status: 'On Route',
          tracking_started: true 
        }
      });

      return { 
        success: true, 
        message: 'Tracking started! Customer will be notified of your progress.' 
      };

    } catch (error) {
      console.error('Error starting tracking:', error);
      return { 
        success: false, 
        message: 'Failed to start tracking. Please try again.' 
      };
    }
  }

  private startLocationUpdates() {
    if (!this.currentSession) return;

    // Get location immediately
    this.updateLocation();

    // Update location every 30 seconds
    this.updateInterval = setInterval(() => {
      if (this.currentSession?.isActive) {
        this.updateLocation();
      }
    }, 30000);

    // Also use watch position for real-time updates
    if (navigator.geolocation) {
      this.watchId = navigator.geolocation.watchPosition(
        (position) => {
          this.saveLocationUpdate(
            position.coords.latitude,
            position.coords.longitude,
            position.coords.accuracy
          );
        },
        (error) => {
          console.warn('Location watch error:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000
        }
      );
    }
  }

  private async updateLocation() {
    if (!this.currentSession || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.saveLocationUpdate(
          position.coords.latitude,
          position.coords.longitude,
          position.coords.accuracy
        );
      },
      (error) => {
        console.warn('Location update error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
      }
    );
  }

  private async saveLocationUpdate(latitude: number, longitude: number, accuracy?: number) {
    if (!this.currentSession) return;

    try {
      // Save to technician_locations table
      const { error } = await supabase
        .from('technician_locations')
        .insert({
          technician_id: this.currentSession.technicianId,
          job_id: this.currentSession.jobId,
          latitude,
          longitude,
          accuracy,
          timestamp: new Date().toISOString()
        });

      if (error) {
        console.error('Error saving location:', error);
      } else {
        console.log('Location updated:', { latitude, longitude });
      }
    } catch (error) {
      console.error('Location save error:', error);
    }
  }

  async stopTracking(): Promise<void> {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    if (this.currentSession) {
      this.currentSession.isActive = false;
      this.currentSession = null;
    }

    console.log('Tracking stopped');
  }

  async completeJob(jobId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Stop tracking
      await this.stopTracking();

      // Update job status
      const { error } = await supabase
        .from('jobs')
        .update({ 
          status: 'Completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (error) {
        return { success: false, message: 'Failed to complete job' };
      }

      return { 
        success: true, 
        message: 'Job completed successfully!' 
      };

    } catch (error) {
      console.error('Error completing job:', error);
      return { 
        success: false, 
        message: 'Failed to complete job' 
      };
    }
  }

  isCurrentlyTracking(): boolean {
    return this.currentSession?.isActive || false;
  }

  getCurrentSession(): TrackingSession | null {
    return this.currentSession;
  }
}

export const mobileTrackingService = new MobileTrackingService();