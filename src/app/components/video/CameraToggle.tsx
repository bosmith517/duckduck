import React, { useState, useEffect } from 'react'

interface CameraToggleProps {
  roomSession: any
  onCameraSwitch?: (deviceId: string) => void
}

export const CameraToggle: React.FC<CameraToggleProps> = ({ roomSession, onCameraSwitch }) => {
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [currentCamera, setCurrentCamera] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Get available cameras
    const loadCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = devices.filter(device => device.kind === 'videoinput')
        setCameras(videoDevices)
        
        // Set current camera if available
        if (videoDevices.length > 0 && !currentCamera) {
          setCurrentCamera(videoDevices[0].deviceId)
        }
      } catch (error) {
        console.error('Error loading cameras:', error)
      }
    }

    loadCameras()
  }, [currentCamera])

  const switchCamera = async () => {
    if (cameras.length < 2 || !roomSession || isLoading) return

    setIsLoading(true)
    try {
      // Find next camera
      const currentIndex = cameras.findIndex(cam => cam.deviceId === currentCamera)
      const nextIndex = (currentIndex + 1) % cameras.length
      const nextCamera = cameras[nextIndex]

      console.log('Switching to camera:', nextCamera.label || nextCamera.deviceId)

      // Update video constraints with new camera
      // SignalWire doesn't have updateCamera, so we need to update the stream
      if (roomSession.updateCamera) {
        await roomSession.updateCamera({
          deviceId: { exact: nextCamera.deviceId }
        })
      } else {
        // Alternative: update video mute/unmute with new device
        await roomSession.videoMute()
        // Small delay to ensure mute completes
        await new Promise(resolve => setTimeout(resolve, 100))
        await roomSession.videoUnmute({
          deviceId: { exact: nextCamera.deviceId }
        })
      }

      setCurrentCamera(nextCamera.deviceId)
      onCameraSwitch?.(nextCamera.deviceId)
    } catch (error) {
      console.error('Error switching camera:', error)
      // Try alternative method if updateCamera doesn't exist
      try {
        // Get current stream
        const localStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: cameras[(cameras.findIndex(cam => cam.deviceId === currentCamera) + 1) % cameras.length].deviceId } },
          audio: false
        })
        
        // This would need SignalWire-specific implementation
        console.log('Alternative camera switch method would need SignalWire API')
      } catch (altError) {
        console.error('Alternative method also failed:', altError)
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Only show toggle if multiple cameras are available
  if (cameras.length < 2) {
    return null
  }

  return (
    <button
      type="button"
      style={{
        backgroundColor: '#007bff',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        padding: '10px 20px',
        fontSize: '16px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}
      onClick={switchCamera}
      disabled={isLoading}
      title="Switch Camera"
    >
      📷 Switch Camera
      {isLoading && (
        <span style={{ display: 'inline-block', width: '16px', height: '16px' }}>
          ⏳
        </span>
      )}
    </button>
  )
}