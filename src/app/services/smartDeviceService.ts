// Smart Device Integration Service
// Handles integration with popular smart home devices

import { supabase } from '../../supabaseClient'

export interface SmartDevice {
  id: string
  deviceType: string
  brand: string
  model: string
  name: string
  isOnline: boolean
  lastSeen: string
  capabilities: string[]
  currentStatus: Record<string, any>
  energyUsage?: number
  efficiency?: number
}

export interface DeviceTelemetry {
  deviceId: string
  timestamp: string
  metrics: Record<string, { value: number; unit: string }>
}

class SmartDeviceService {
  private baseUrl: string

  constructor() {
    this.baseUrl = import.meta.env.VITE_SUPABASE_URL + '/functions/v1'
  }

  // Get smart devices for customer from database
  async getCustomerDevices(customerId: string): Promise<SmartDevice[]> {
    try {
      const { data: devices, error } = await supabase
        .from('smart_devices')
        .select(`
          *,
          device_telemetry(
            metric_name,
            metric_value,
            metric_unit,
            timestamp
          )
        `)
        .eq('contact_id', customerId)
        .eq('integration_status', 'connected')
        .order('created_at', { ascending: false })

      if (error) throw error

      return devices.map(device => {
        const telemetry = device.device_telemetry || []
        const currentStatus = this.buildCurrentStatus(device.device_type, telemetry)
        
        return {
          id: device.id,
          deviceType: device.device_type,
          brand: device.device_brand,
          model: device.device_model || 'Unknown',
          name: `${device.device_brand} ${device.device_model}`,
          isOnline: device.is_online,
          lastSeen: device.last_seen,
          capabilities: Object.keys(device.capabilities || {}),
          currentStatus,
          efficiency: this.calculateEfficiency(device.device_type, telemetry)
        }
      })
    } catch (error) {
      console.error('Error getting customer devices:', error)
      return []
    }
  }

  // Discover smart devices on customer's network
  async discoverDevices(customerId: string): Promise<SmartDevice[]> {
    try {
      const response = await fetch(`${this.baseUrl}/discover-smart-devices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ customerId })
      })

      if (!response.ok) throw new Error('Failed to discover devices')
      return await response.json()
    } catch (error) {
      console.error('Error discovering smart devices:', error)
      return []
    }
  }

  // Get real-time data from specific device
  async getDeviceData(deviceId: string): Promise<DeviceTelemetry | null> {
    try {
      const response = await fetch(`${this.baseUrl}/get-device-telemetry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ deviceId })
      })

      if (!response.ok) throw new Error('Failed to get device data')
      return await response.json()
    } catch (error) {
      console.error('Error getting device data:', error)
      return null
    }
  }

  // Connect to Nest Thermostat
  async connectNestThermostat(customerId: string, accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/connect-nest-device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ customerId, accessToken })
      })

      return response.ok
    } catch (error) {
      console.error('Error connecting Nest thermostat:', error)
      return false
    }
  }

  // Connect to Ring doorbell/security
  async connectRingDevice(customerId: string, credentials: any): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/connect-ring-device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ customerId, credentials })
      })

      return response.ok
    } catch (error) {
      console.error('Error connecting Ring device:', error)
      return false
    }
  }

  // Get energy usage insights
  async getEnergyInsights(customerId: string, timeframe: string = '30d'): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/get-energy-insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ customerId, timeframe })
      })

      if (!response.ok) throw new Error('Failed to get energy insights')
      return await response.json()
    } catch (error) {
      console.error('Error getting energy insights:', error)
      return null
    }
  }

  // Control smart device remotely
  async controlDevice(deviceId: string, command: string, parameters: any): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/control-smart-device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ deviceId, command, parameters })
      })

      return response.ok
    } catch (error) {
      console.error('Error controlling device:', error)
      return false
    }
  }

  // Set up device monitoring alerts
  async setupDeviceAlerts(deviceId: string, alertConfig: any): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/setup-device-alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ deviceId, alertConfig })
      })

      return response.ok
    } catch (error) {
      console.error('Error setting up device alerts:', error)
      return false
    }
  }

  // Get device health score
  async getDeviceHealthScore(deviceId: string): Promise<number> {
    try {
      const response = await fetch(`${this.baseUrl}/get-device-health`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ deviceId })
      })

      if (!response.ok) return 0
      const data = await response.json()
      return data.healthScore || 0
    } catch (error) {
      console.error('Error getting device health score:', error)
      return 0
    }
  }

  // Build current status from telemetry data
  private buildCurrentStatus(deviceType: string, telemetry: any[]): Record<string, any> {
    const status: Record<string, any> = {}
    
    // Get the most recent value for each metric
    const latestMetrics = telemetry.reduce((acc: any, item: any) => {
      if (!acc[item.metric_name] || new Date(item.timestamp) > new Date(acc[item.metric_name].timestamp)) {
        acc[item.metric_name] = item
      }
      return acc
    }, {})

    // Convert to current status based on device type
    Object.values(latestMetrics).forEach((metric: any) => {
      switch (metric.metric_name) {
        case 'temperature':
          status.temperature = Math.round(metric.metric_value)
          break
        case 'target_temperature':
          status.targetTemperature = Math.round(metric.metric_value)
          break
        case 'humidity':
          status.humidity = Math.round(metric.metric_value)
          break
        case 'battery_level':
          status.batteryLevel = Math.round(metric.metric_value)
          break
        case 'motion_detected':
          status.motionDetected = metric.metric_value > 0
          break
        case 'occupied':
          status.occupied = metric.metric_value > 0
          break
        default:
          status[metric.metric_name] = metric.metric_value
      }
    })

    return status
  }

  // Calculate efficiency based on device type and telemetry
  private calculateEfficiency(deviceType: string, telemetry: any[]): number {
    // Mock efficiency calculation - in real implementation would use complex algorithms
    const baseEfficiency = 85
    const variance = Math.random() * 20 - 10 // ±10%
    return Math.max(0, Math.min(100, Math.round(baseEfficiency + variance)))
  }

  // Connect a new device to the system
  async connectDevice(customerId: string, deviceInfo: any): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/connect-smart-device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ customerId, ...deviceInfo })
      })

      return response.ok
    } catch (error) {
      console.error('Error connecting device:', error)
      return false
    }
  }

  // Mock data for demonstration
  getMockSmartDevices(customerId: string): SmartDevice[] {
    return [
      {
        id: 'nest-001',
        deviceType: 'thermostat',
        brand: 'Nest',
        model: 'Learning Thermostat 4th Gen',
        name: 'Main Thermostat',
        isOnline: true,
        lastSeen: new Date().toISOString(),
        capabilities: ['heating', 'cooling', 'scheduling', 'learning', 'remote_control'],
        currentStatus: {
          temperature: 72,
          targetTemperature: 75,
          mode: 'cooling',
          humidity: 45,
          isHeating: false,
          isCooling: true
        },
        energyUsage: 4.2,
        efficiency: 95
      },
      {
        id: 'ring-001',
        deviceType: 'doorbell',
        brand: 'Ring',
        model: 'Video Doorbell Pro 2',
        name: 'Front Door',
        isOnline: true,
        lastSeen: new Date().toISOString(),
        capabilities: ['video', 'audio', 'motion_detection', 'night_vision'],
        currentStatus: {
          batteryLevel: 87,
          motionDetected: false,
          lastMotion: '2024-06-22T14:30:00Z',
          recordingEnabled: true
        },
        efficiency: 92
      },
      {
        id: 'ecobee-001',
        deviceType: 'smart_sensor',
        brand: 'Ecobee',
        model: 'SmartSensor',
        name: 'Living Room Sensor',
        isOnline: true,
        lastSeen: new Date().toISOString(),
        capabilities: ['temperature', 'occupancy', 'humidity'],
        currentStatus: {
          temperature: 74,
          humidity: 42,
          occupied: true,
          batteryLevel: 95
        },
        efficiency: 98
      },
      {
        id: 'august-001',
        deviceType: 'smart_lock',
        brand: 'August',
        model: 'Smart Lock Pro',
        name: 'Front Door Lock',
        isOnline: true,
        lastSeen: new Date().toISOString(),
        capabilities: ['remote_lock', 'auto_lock', 'access_codes', 'activity_log'],
        currentStatus: {
          locked: true,
          batteryLevel: 78,
          lastActivity: '2024-06-22T08:30:00Z',
          autoLockEnabled: true
        },
        efficiency: 89
      }
    ]
  }
}

export const smartDeviceService = new SmartDeviceService()
export default smartDeviceService