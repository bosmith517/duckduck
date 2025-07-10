import { supabase } from '../../supabaseClient'

export interface TrackingLocation {
  latitude: number
  longitude: number
  timestamp: string
}

export interface TrackingSession {
  id: string
  job_id: string
  technician_id: string
  tracking_token: string
  is_active: boolean
  started_at: string
  ended_at?: string
  current_latitude?: number
  current_longitude?: number
}

class TrackingService {
  private locationWatchId: number | null = null
  private updateInterval: NodeJS.Timeout | null = null
  private isTracking = false

  // Method for technicians to update job status
  async updateJobStatus(
    jobId: string, 
    newStatus: string, 
    notes?: string
  ): Promise<{ success: boolean; shouldStartTracking?: boolean; error?: string }> {
    try {
      // Capture current location for context (but don't start tracking yet)
      let locationContext = null
      if (navigator.geolocation) {
        try {
          const position = await this.getCurrentPosition()
          locationContext = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          }
        } catch (error) {
          console.warn('Could not get location for status update:', error)
        }
      }

      // Insert status update (technicians CAN do this)
      const { error } = await supabase
        .from('job_status_updates')
        .insert({
          job_id: jobId,
          new_status: newStatus,
          status_notes: notes,
          location_latitude: locationContext?.latitude,
          location_longitude: locationContext?.longitude,
          location_accuracy: locationContext?.accuracy
        })

      if (error) {
        throw new Error(error.message || 'Failed to update job status')
      }

      // Check if this status change should prompt for tracking
      const trackingStatuses = ['on_the_way', 'en_route', 'driving_to_job']
      const shouldStartTracking = trackingStatuses.includes(newStatus)

      return { 
        success: true, 
        shouldStartTracking 
      }
    } catch (error: any) {
      console.error('Error updating job status:', error)
      return { success: false, error: error.message }
    }
  }

  // Method to start location tracking (called after status update when needed)
  async startTracking(jobId: string): Promise<{ success: boolean; trackingToken?: string; error?: string }> {
    try {
      // Request location permission first
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by this browser')
      }

      // Get initial position with better error handling
      let position: GeolocationPosition;
      try {
        position = await this.getCurrentPosition()
      } catch (locationError: any) {
        console.error('Location error:', locationError)
        
        // Provide helpful guidance for common scenarios
        let helpMessage = locationError.message;
        if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
          helpMessage += '\n\nNote: Location services require HTTPS. Please use HTTPS or test on localhost.';
        } else if (window.location.hostname === 'localhost') {
          helpMessage += '\n\nTo enable location on localhost:\n1. Click the info/lock icon in your address bar\n2. Find Location and set to "Allow"\n3. Refresh the page and try again';
        }
        
        throw new Error(helpMessage)
      }
      
      // Start tracking session with backend (system-managed)
      console.log('Calling start-technician-tracking with:', {
        job_id: jobId,
        initial_latitude: position.coords.latitude,
        initial_longitude: position.coords.longitude
      })
      
      let data, error;
      try {
        const response = await supabase.functions.invoke('start-mobile-tracking', {
          body: { 
            job_id: jobId,
            initial_latitude: position.coords.latitude,
            initial_longitude: position.coords.longitude
          }
        })
        data = response.data
        error = response.error
      } catch (invokeError: any) {
        console.error('Function invoke error:', invokeError)
        error = invokeError
      }

      if (error) {
        console.error('Edge function error:', error)
        console.error('Error details:', { error, data })
        
        // Check if there's an error message in the response data
        if (data && data.error) {
          throw new Error(data.error)
        }
        
        throw new Error(error.message || 'Failed to start tracking')
      }

      if (data?.success) {
        this.isTracking = true
        this.startLocationUpdates(jobId)
        return { success: true, trackingToken: data.tracking_token }
      } else {
        throw new Error(data?.error || 'Failed to start tracking')
      }
    } catch (error: any) {
      console.error('Error in startTracking:', error)
      return { success: false, error: error.message }
    }
  }

  async stopTracking(): Promise<void> {
    this.isTracking = false
    
    if (this.locationWatchId !== null) {
      navigator.geolocation.clearWatch(this.locationWatchId)
      this.locationWatchId = null
    }

    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }
  }

  private async getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        (error) => {
          let errorMessage = 'Unable to get location';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location permission denied. Please enable location services in your browser settings.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable. Make sure location services are enabled on your device.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out. Please try again.';
              break;
          }
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      )
    })
  }

  private startLocationUpdates(jobId: string): void {
    // Update location every 20 seconds
    this.updateInterval = setInterval(async () => {
      if (!this.isTracking) {
        this.stopTracking()
        return
      }

      try {
        const position = await this.getCurrentPosition()
        await this.updateLocation(jobId, position.coords.latitude, position.coords.longitude)
      } catch (error) {
        console.error('Error updating location:', error)
      }
    }, 20000) // 20 seconds
  }

  private async updateLocation(jobId: string, latitude: number, longitude: number): Promise<void> {
    try {
      const { error } = await supabase.functions.invoke('update-technician-location', {
        body: {
          job_id: jobId,
          latitude,
          longitude
        }
      })

      if (error) {
        console.error('Error updating location:', error)
      }
    } catch (error) {
      console.error('Error in updateLocation:', error)
    }
  }

  async getTrackingLocation(trackingToken: string): Promise<TrackingLocation | null> {
    try {
      // The edge function expects the token as a URL query parameter
      const { data, error } = await supabase.functions.invoke(`get-technician-location?token=${encodeURIComponent(trackingToken)}`)

      if (error) {
        console.error('Error getting tracking location:', error)
        throw new Error(error.message)
      }

      // The edge function returns {latitude, longitude} directly, not nested in a location object
      if (data && data.latitude && data.longitude) {
        return {
          latitude: data.latitude,
          longitude: data.longitude,
          timestamp: new Date().toISOString()
        }
      }

      return null
    } catch (error) {
      console.error('Error in getTrackingLocation:', error)
      throw error
    }
  }

  // Check if currently tracking
  get isCurrentlyTracking(): boolean {
    return this.isTracking
  }
}

export const trackingService = new TrackingService()
