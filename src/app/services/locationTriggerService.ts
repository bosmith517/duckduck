import { supabase } from '../../supabaseClient'

interface LocationUpdate {
  latitude: number
  longitude: number
  accuracy?: number
  jobId: string
  technicianId: string
  tenantId: string
}

interface LocationTriggerService {
  startLocationTracking: (jobId: string) => void
  stopLocationTracking: () => void
  updateLocation: (location: LocationUpdate) => Promise<void>
  isTracking: boolean
}

class LocationTriggerServiceImpl implements LocationTriggerService {
  private watchId: number | null = null
  private lastLocationUpdate: number = 0
  private readonly UPDATE_INTERVAL = 30000 // 30 seconds
  private readonly HIGH_ACCURACY_DISTANCE = 5000 // 5km - switch to high accuracy when closer

  public isTracking: boolean = false

  public startLocationTracking(jobId: string): void {
    if (this.isTracking) {
      console.warn('Location tracking already active')
      return
    }

    if (!navigator.geolocation) {
      console.error('Geolocation is not supported by this browser')
      return
    }

    console.log('Starting location tracking for job:', jobId)
    this.isTracking = true

    // Start with low accuracy for battery conservation
    let options: PositionOptions = {
      enableHighAccuracy: false,
      timeout: 30000,
      maximumAge: 60000 // 1 minute
    }

    const successCallback = async (position: GeolocationPosition) => {
      const now = Date.now()
      
      // Throttle updates to prevent spam
      if (now - this.lastLocationUpdate < this.UPDATE_INTERVAL) {
        return
      }

      try {
        // Get job details to determine if we need high accuracy
        const { data: job } = await supabase
          .from('jobs')
          .select('service_address_lat, service_address_lng, tenant_id, assigned_technician_id')
          .eq('id', jobId)
          .single()

        if (!job) {
          console.error('Job not found for location tracking')
          return
        }

        const location: LocationUpdate = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          jobId: jobId,
          technicianId: job.assigned_technician_id,
          tenantId: job.tenant_id
        }

        // Calculate distance to job site if coordinates available
        if (job.service_address_lat && job.service_address_lng) {
          const distance = this.calculateDistance(
            position.coords.latitude,
            position.coords.longitude,
            job.service_address_lat,
            job.service_address_lng
          )

          console.log(`Distance to job site: ${Math.round(distance)}m`)

          // Switch to high accuracy when getting close
          if (distance < this.HIGH_ACCURACY_DISTANCE && !options.enableHighAccuracy) {
            console.log('Switching to high accuracy mode - approaching job site')
            this.restartWithHighAccuracy(jobId)
            return
          }
        }

        await this.updateLocation(location)
        this.lastLocationUpdate = now

      } catch (error) {
        console.error('Error processing location update:', error)
      }
    }

    const errorCallback = (error: GeolocationPositionError) => {
      console.error('Location tracking error:', error.message)
      
      switch (error.code) {
        case error.PERMISSION_DENIED:
          console.error('Location access denied by user')
          this.stopLocationTracking()
          break
        case error.POSITION_UNAVAILABLE:
          console.error('Location information unavailable')
          break
        case error.TIMEOUT:
          console.error('Location request timeout')
          break
      }
    }

    this.watchId = navigator.geolocation.watchPosition(
      successCallback,
      errorCallback,
      options
    )
  }

  private restartWithHighAccuracy(jobId: string): void {
    this.stopLocationTracking()
    
    // Restart with high accuracy
    setTimeout(() => {
      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000 // 30 seconds
      }

      const successCallback = async (position: GeolocationPosition) => {
        try {
          const { data: job } = await supabase
            .from('jobs')
            .select('tenant_id, assigned_technician_id')
            .eq('id', jobId)
            .single()

          if (!job) return

          const location: LocationUpdate = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            jobId: jobId,
            technicianId: job.assigned_technician_id,
            tenantId: job.tenant_id
          }

          await this.updateLocation(location)
        } catch (error) {
          console.error('High accuracy location error:', error)
        }
      }

      this.watchId = navigator.geolocation.watchPosition(
        successCallback,
        (error) => console.error('High accuracy location error:', error),
        options
      )
      
      this.isTracking = true
    }, 1000)
  }

  public stopLocationTracking(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId)
      this.watchId = null
    }
    this.isTracking = false
    console.log('Location tracking stopped')
  }

  public async updateLocation(location: LocationUpdate): Promise<void> {
    try {
      // Store location in database
      const { error } = await supabase
        .from('technician_locations')
        .insert({
          technician_id: location.technicianId,
          job_id: location.jobId,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          tenant_id: location.tenantId,
          timestamp: new Date().toISOString()
        })

      if (error) {
        console.error('Error storing location:', error)
        return
      }

      // The database trigger will automatically check for proximity
      // and send notifications if the technician is near the job site
      console.log('Location updated successfully')

    } catch (error) {
      console.error('Error updating location:', error)
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3 // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180
    const φ2 = lat2 * Math.PI/180
    const Δφ = (lat2-lat1) * Math.PI/180
    const Δλ = (lon2-lon1) * Math.PI/180

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

    return R * c
  }

  // Helper method to get current location once
  public getCurrentLocation(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'))
        return
      }

      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      )
    })
  }

  // Method to check if we should start tracking for a job
  public async shouldStartTracking(jobId: string): Promise<boolean> {
    try {
      const { data: job } = await supabase
        .from('jobs')
        .select('status, scheduled_start')
        .eq('id', jobId)
        .single()

      if (!job) return false

      // Start tracking when job is scheduled or technician is on route
      if (['scheduled', 'on_route'].includes(job.status)) {
        return true
      }

      // Stop tracking when job is completed
      if (['completed', 'cancelled'].includes(job.status)) {
        return false
      }

      return false
    } catch (error) {
      console.error('Error checking tracking status:', error)
      return false
    }
  }
}

// Export singleton instance
export const locationTriggerService = new LocationTriggerServiceImpl()

// Hook for React components
export const useLocationTracking = (jobId: string | null) => {
  const startTracking = () => {
    if (jobId && !locationTriggerService.isTracking) {
      locationTriggerService.startLocationTracking(jobId)
    }
  }

  const stopTracking = () => {
    locationTriggerService.stopLocationTracking()
  }

  return {
    isTracking: locationTriggerService.isTracking,
    startTracking,
    stopTracking
  }
}