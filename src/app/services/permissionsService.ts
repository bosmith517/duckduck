import { Camera } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
//import { NativeSettings, AndroidSettings, IOSSettings } from 'capacitor-native-settings';

export interface PermissionStatus {
  camera: boolean;
  location: boolean;
}

class PermissionsService {
  private static instance: PermissionsService;
  
  private constructor() {}
  
  static getInstance(): PermissionsService {
    if (!PermissionsService.instance) {
      PermissionsService.instance = new PermissionsService();
    }
    return PermissionsService.instance;
  }

  async checkAllPermissions(): Promise<PermissionStatus> {
    const cameraStatus = await this.checkCameraPermission();
    const locationStatus = await this.checkLocationPermission();
    
    return {
      camera: cameraStatus,
      location: locationStatus,
    };
  }

  async checkCameraPermission(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        const permissions = await Camera.checkPermissions();
        return permissions.camera === 'granted' || permissions.photos === 'granted';
      } catch (error) {
        console.error('Error checking camera permissions:', error);
        return false;
      }
    }
    // For web, check if mediaDevices is available
    return 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices;
  }

  async checkLocationPermission(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        const permissions = await Geolocation.checkPermissions();
        return permissions.location === 'granted' || permissions.coarseLocation === 'granted';
      } catch (error) {
        console.error('Error checking location permissions:', error);
        return false;
      }
    }
    // For web, check if geolocation is available
    return 'geolocation' in navigator;
  }

  async requestCameraPermission(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        const permissions = await Camera.requestPermissions();
        return permissions.camera === 'granted' || permissions.photos === 'granted';
      } catch (error) {
        console.error('Error requesting camera permissions:', error);
        return false;
      }
    }
    
    // For web, request camera access
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Stop the stream immediately as we just needed to request permission
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Error requesting camera permission on web:', error);
      return false;
    }
  }

  async requestLocationPermission(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        const permissions = await Geolocation.requestPermissions();
        return permissions.location === 'granted' || permissions.coarseLocation === 'granted';
      } catch (error) {
        console.error('Error requesting location permissions:', error);
        return false;
      }
    }
    
    // For web, request location access
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve(true),
        () => resolve(false),
        { timeout: 5000 }
      );
    });
  }

  async requestAllPermissions(): Promise<PermissionStatus> {
    const [camera, location] = await Promise.all([
      this.requestCameraPermission(),
      this.requestLocationPermission(),
    ]);
    
    return { camera, location };
  }

  // Show app settings for manual permission management
  async openAppSettings(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try {
        // TODO: Implement using @capacitor/app when API is available
        // For now, show a message to the user
        alert('Please go to your device settings to manage app permissions.');
      } catch (error) {
        console.error('Error opening app settings:', error);
      }
    } else {
      alert('Please check your browser settings to manage permissions.');
    }
  }
}

export const permissionsService = PermissionsService.getInstance();