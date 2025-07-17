import { Camera, CameraResultType, CameraSource, GalleryPhotos, GalleryPhoto } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface PhotoResult {
  dataUrl: string;
  format: string;
  saved: boolean;
}

export interface MultiPhotoResult {
  photos: PhotoResult[];
  count: number;
}

export class MobileService {
  static isNativePlatform(): boolean {
    return Capacitor.isNativePlatform();
  }

  static getPlatform(): string {
    return Capacitor.getPlatform();
  }

  // Camera functionality
  static async takePhoto(): Promise<PhotoResult> {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
      });

      return {
        dataUrl: image.dataUrl || '',
        format: image.format,
        saved: image.saved || false,
      };
    } catch (error) {
      console.error('Error taking photo:', error);
      throw new Error('Failed to take photo');
    }
  }

  static async selectPhoto(): Promise<PhotoResult> {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
      });

      return {
        dataUrl: image.dataUrl || '',
        format: image.format,
        saved: image.saved || false,
      };
    } catch (error) {
      console.error('Error selecting photo:', error);
      throw new Error('Failed to select photo');
    }
  }

  static async selectMultiplePhotos(limit?: number): Promise<MultiPhotoResult> {
    try {
      // Check if pickImages is available (Capacitor Camera v5.0.0+)
      if ('pickImages' in Camera) {
        const result = await (Camera as any).pickImages({
          quality: 90,
          limit: limit || 0, // 0 = no limit
        }) as GalleryPhotos;

        const photos: PhotoResult[] = [];
        
        for (const photo of result.photos) {
          // Convert web path to data URL
          const response = await fetch(photo.webPath);
          const blob = await response.blob();
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });

          photos.push({
            dataUrl,
            format: photo.format || 'jpeg',
            saved: false,
          });
        }

        return {
          photos,
          count: photos.length,
        };
      } else {
        // Fallback to single selection for older versions
        const photo = await this.selectPhoto();
        return {
          photos: [photo],
          count: 1,
        };
      }
    } catch (error) {
      console.error('Error selecting multiple photos:', error);
      throw new Error('Failed to select photos');
    }
  }

  static async takeMultiplePhotos(count: number): Promise<MultiPhotoResult> {
    const photos: PhotoResult[] = [];
    
    try {
      for (let i = 0; i < count; i++) {
        const shouldContinue = await new Promise<boolean>((resolve) => {
          if (i === 0) {
            resolve(true);
          } else {
            // Show confirmation for next photo
            const message = `Photo ${i} captured. Take photo ${i + 1} of ${count}?`;
            resolve(window.confirm(message));
          }
        });

        if (!shouldContinue) break;

        const photo = await this.takePhoto();
        photos.push(photo);
      }

      return {
        photos,
        count: photos.length,
      };
    } catch (error) {
      console.error('Error taking multiple photos:', error);
      throw new Error('Failed to take photos');
    }
  }

  // Geolocation functionality
  static async getCurrentPosition(): Promise<LocationData> {
    try {
      const coordinates = await Geolocation.getCurrentPosition();
      
      return {
        latitude: coordinates.coords.latitude,
        longitude: coordinates.coords.longitude,
        accuracy: coordinates.coords.accuracy,
        timestamp: coordinates.timestamp,
      };
    } catch (error) {
      console.error('Error getting location:', error);
      throw new Error('Failed to get current location');
    }
  }

  static async watchPosition(callback: (position: LocationData) => void): Promise<string> {
    try {
      const watchId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 10000,
        },
        (position, err) => {
          if (err) {
            console.error('Error watching position:', err);
            return;
          }

          if (position) {
            callback({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: position.timestamp,
            });
          }
        }
      );

      return watchId;
    } catch (error) {
      console.error('Error watching position:', error);
      throw new Error('Failed to watch position');
    }
  }

  static async clearWatch(watchId: string): Promise<void> {
    try {
      await Geolocation.clearWatch({ id: watchId });
    } catch (error) {
      console.error('Error clearing watch:', error);
    }
  }

  // Push Notifications
  static async initializePushNotifications(): Promise<void> {
    try {
      const permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        const permResult = await PushNotifications.requestPermissions();
        if (permResult.receive !== 'granted') {
          throw new Error('Push notification permissions not granted');
        }
      }

      await PushNotifications.register();

      // Listen for registration
      PushNotifications.addListener('registration', (token) => {
        console.log('Push registration success, token:', token.value);
        // Store token for sending notifications
        localStorage.setItem('pushToken', token.value);
      });

      // Listen for registration errors
      PushNotifications.addListener('registrationError', (err) => {
        console.error('Push registration error:', err.error);
      });

      // Listen for incoming notifications
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push notification received:', notification);
      });

      // Listen for notification actions
      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('Push notification action performed:', notification);
      });
    } catch (error) {
      console.error('Error initializing push notifications:', error);
    }
  }

  // Local Notifications
  static async scheduleLocalNotification(
    title: string,
    body: string,
    schedule?: { at: Date }
  ): Promise<void> {
    try {
      const permissions = await LocalNotifications.checkPermissions();
      
      if (permissions.display === 'prompt') {
        const result = await LocalNotifications.requestPermissions();
        if (result.display !== 'granted') {
          throw new Error('Local notification permissions not granted');
        }
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id: Math.floor(Math.random() * 1000000),
            schedule: schedule,
            sound: 'default',
            attachments: undefined,
            actionTypeId: '',
            extra: null,
          },
        ],
      });
    } catch (error) {
      console.error('Error scheduling notification:', error);
    }
  }

  // Status Bar
  static async setStatusBarStyle(style: 'light' | 'dark'): Promise<void> {
    try {
      if (this.isNativePlatform()) {
        await StatusBar.setStyle({
          style: style === 'light' ? Style.Light : Style.Dark,
        });
      }
    } catch (error) {
      console.error('Error setting status bar style:', error);
    }
  }

  static async hideStatusBar(): Promise<void> {
    try {
      if (this.isNativePlatform()) {
        await StatusBar.hide();
      }
    } catch (error) {
      console.error('Error hiding status bar:', error);
    }
  }

  static async showStatusBar(): Promise<void> {
    try {
      if (this.isNativePlatform()) {
        await StatusBar.show();
      }
    } catch (error) {
      console.error('Error showing status bar:', error);
    }
  }

  // Splash Screen
  static async hideSplashScreen(): Promise<void> {
    try {
      await SplashScreen.hide();
    } catch (error) {
      console.error('Error hiding splash screen:', error);
    }
  }

  // Utility functions
  static async shareContent(title: string, text: string, url?: string): Promise<void> {
    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text,
          url,
        });
      } else {
        // Fallback for platforms without native sharing
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(`${title}\n${text}\n${url || ''}`);
          alert('Content copied to clipboard');
        }
      }
    } catch (error) {
      console.error('Error sharing content:', error);
    }
  }

  static async hapticFeedback(type: 'light' | 'medium' | 'heavy' = 'medium'): Promise<void> {
    try {
      if ('vibrate' in navigator) {
        const patterns = {
          light: [50],
          medium: [100],
          heavy: [150],
        };
        navigator.vibrate(patterns[type]);
      }
    } catch (error) {
      console.error('Error with haptic feedback:', error);
    }
  }

  // Network status
  static isOnline(): boolean {
    return navigator.onLine;
  }

  static onNetworkChange(callback: (isOnline: boolean) => void): void {
    window.addEventListener('online', () => callback(true));
    window.addEventListener('offline', () => callback(false));
  }
}