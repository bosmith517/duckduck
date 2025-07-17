import { supabase } from '../../supabaseClient'
import { jobActivityService } from './jobActivityService'

export interface PhotoUploadOptions {
  jobId?: string
  costEntryId?: string
  photoType: 'receipt' | 'job_progress' | 'before' | 'after' | 'general' | 'reference'
  description?: string
  location?: {
    latitude: number
    longitude: number
  }
  metadata?: Record<string, any>
}

export interface PhotoUploadResult {
  id: string
  url: string
  fileName: string
  success: boolean
  error?: string
}

export interface BatchUploadProgress {
  total: number
  completed: number
  failed: number
  inProgress: number
  percentage: number
}

export interface BatchUploadResult {
  successful: PhotoUploadResult[]
  failed: PhotoUploadResult[]
  totalUploaded: number
  totalFailed: number
}

type ProgressCallback = (progress: BatchUploadProgress) => void

class PhotoBatchUploadService {
  private uploadQueue: Map<string, File> = new Map()
  private concurrentUploads = 3
  private uploadInProgress = false
  private abortController: AbortController | null = null

  /**
   * Upload multiple photos with progress tracking
   */
  async uploadBatch(
    files: File[],
    options: PhotoUploadOptions,
    tenantId: string,
    userId: string,
    onProgress?: ProgressCallback
  ): Promise<BatchUploadResult> {
    this.uploadInProgress = true
    this.abortController = new AbortController()

    const results: PhotoUploadResult[] = []
    const total = files.length
    let completed = 0
    let failed = 0

    // Update progress
    const updateProgress = () => {
      if (onProgress) {
        onProgress({
          total,
          completed,
          failed,
          inProgress: total - completed - failed,
          percentage: Math.round((completed / total) * 100)
        })
      }
    }

    // Process files in batches
    const batches = this.createBatches(files, this.concurrentUploads)
    
    for (const batch of batches) {
      if (this.abortController.signal.aborted) break

      const batchPromises = batch.map(async (file, index) => {
        try {
          const result = await this.uploadSinglePhoto(
            file,
            options,
            tenantId,
            userId,
            completed + index
          )
          
          if (result.success) {
            completed++
          } else {
            failed++
          }
          
          updateProgress()
          return result
        } catch (error) {
          failed++
          updateProgress()
          return {
            id: '',
            url: '',
            fileName: file.name,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
    }

    this.uploadInProgress = false
    this.abortController = null

    // Categorize results
    const successful = results.filter(r => r.success)
    const failedResults = results.filter(r => !r.success)

    // Log batch upload activity if job ID is provided
    if (options.jobId && successful.length > 0) {
      await jobActivityService.logPhotoBatchUploaded(
        options.jobId,
        successful.length,
        options.photoType,
        userId
      )
    }

    return {
      successful,
      failed: failedResults,
      totalUploaded: successful.length,
      totalFailed: failedResults.length
    }
  }

  /**
   * Upload a single photo
   */
  private async uploadSinglePhoto(
    file: File,
    options: PhotoUploadOptions,
    tenantId: string,
    userId: string,
    batchIndex: number
  ): Promise<PhotoUploadResult> {
    try {
      // Validate file
      if (!this.validateFile(file)) {
        throw new Error('Invalid file type or size')
      }

      // Generate unique filename
      const timestamp = Date.now()
      const random = Math.random().toString(36).substr(2, 9)
      const extension = this.getFileExtension(file.name)
      const fileName = `${tenantId}/${options.jobId || 'general'}/${options.photoType}_${timestamp}_${random}.${extension}`

      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('job-photos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('job-photos')
        .getPublicUrl(fileName)

      // Save photo record to database
      const photoRecord = {
        tenant_id: tenantId,
        job_id: options.jobId,
        cost_entry_id: options.costEntryId,
        photo_type: options.photoType,
        file_path: fileName,
        file_url: publicUrl,
        file_size: file.size,
        file_name: file.name,
        mime_type: file.type,
        description: options.description || '',
        latitude: options.location?.latitude,
        longitude: options.location?.longitude,
        taken_by: userId,
        taken_at: new Date().toISOString(),
        batch_upload: true,
        batch_index: batchIndex,
        metadata: options.metadata || {}
      }

      const { data: savedPhoto, error: saveError } = await supabase
        .from('job_photos')
        .insert(photoRecord)
        .select()
        .single()

      if (saveError) throw saveError

      return {
        id: savedPhoto.id,
        url: publicUrl,
        fileName: file.name,
        success: true
      }
    } catch (error) {
      console.error('Error uploading photo:', error)
      return {
        id: '',
        url: '',
        fileName: file.name,
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      }
    }
  }

  /**
   * Create batches of files for concurrent upload
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }
    return batches
  }

  /**
   * Validate file type and size
   */
  private validateFile(file: File): boolean {
    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return false
    }

    // Check file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif']
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif']
    
    if (file.type && validTypes.includes(file.type.toLowerCase())) {
      return true
    }

    // Check by extension if type is not available
    const extension = this.getFileExtension(file.name).toLowerCase()
    return validExtensions.includes(`.${extension}`)
  }

  /**
   * Get file extension
   */
  private getFileExtension(filename: string): string {
    const parts = filename.split('.')
    return parts.length > 1 ? parts[parts.length - 1] : 'jpg'
  }

  /**
   * Cancel ongoing uploads
   */
  cancelUploads(): void {
    if (this.abortController) {
      this.abortController.abort()
    }
    this.uploadInProgress = false
  }

  /**
   * Check if upload is in progress
   */
  isUploading(): boolean {
    return this.uploadInProgress
  }

  /**
   * Compress image before upload (optional)
   */
  async compressImage(file: File, maxWidth: number = 1920, quality: number = 0.9): Promise<File> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          
          if (!ctx) {
            resolve(file)
            return
          }

          // Calculate new dimensions
          let width = img.width
          let height = img.height
          
          if (width > maxWidth) {
            height = (maxWidth / width) * height
            width = maxWidth
          }

          canvas.width = width
          canvas.height = height

          // Draw and compress
          ctx.drawImage(img, 0, 0, width, height)
          
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now()
                })
                resolve(compressedFile)
              } else {
                resolve(file)
              }
            },
            'image/jpeg',
            quality
          )
        }
        
        img.onerror = () => resolve(file)
        img.src = e.target?.result as string
      }
      
      reader.onerror = () => resolve(file)
      reader.readAsDataURL(file)
    })
  }

  /**
   * Generate thumbnail for photo
   */
  async generateThumbnail(file: File, size: number = 200): Promise<Blob | null> {
    return new Promise((resolve) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          
          if (!ctx) {
            resolve(null)
            return
          }

          // Square thumbnail
          canvas.width = size
          canvas.height = size

          // Calculate crop dimensions
          const aspectRatio = img.width / img.height
          let sourceWidth = img.width
          let sourceHeight = img.height
          let sourceX = 0
          let sourceY = 0

          if (aspectRatio > 1) {
            sourceWidth = img.height
            sourceX = (img.width - sourceWidth) / 2
          } else {
            sourceHeight = img.width
            sourceY = (img.height - sourceHeight) / 2
          }

          // Draw cropped and scaled image
          ctx.drawImage(
            img,
            sourceX, sourceY, sourceWidth, sourceHeight,
            0, 0, size, size
          )
          
          canvas.toBlob(
            (blob) => resolve(blob),
            'image/jpeg',
            0.8
          )
        }
        
        img.onerror = () => resolve(null)
        img.src = e.target?.result as string
      }
      
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
    })
  }

  /**
   * Get photos by job ID with pagination
   */
  async getJobPhotos(
    jobId: string,
    tenantId: string,
    page: number = 1,
    limit: number = 20,
    photoType?: string
  ) {
    let query = supabase
      .from('job_photos')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('job_id', jobId)
      .order('taken_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (photoType) {
      query = query.eq('photo_type', photoType)
    }

    const { data, error, count } = await query

    if (error) throw error

    return {
      photos: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    }
  }

  /**
   * Delete photo
   */
  async deletePhoto(photoId: string, tenantId: string): Promise<boolean> {
    try {
      // Get photo record
      const { data: photo, error: fetchError } = await supabase
        .from('job_photos')
        .select('file_path, job_id')
        .eq('id', photoId)
        .eq('tenant_id', tenantId)
        .single()

      if (fetchError || !photo) throw new Error('Photo not found')

      // Delete from storage
      const { error: deleteStorageError } = await supabase.storage
        .from('job-photos')
        .remove([photo.file_path])

      if (deleteStorageError) throw deleteStorageError

      // Delete from database
      const { error: deleteDbError } = await supabase
        .from('job_photos')
        .delete()
        .eq('id', photoId)
        .eq('tenant_id', tenantId)

      if (deleteDbError) throw deleteDbError

      // Log activity
      if (photo.job_id) {
        await jobActivityService.logPhotoDeleted(photo.job_id, tenantId)
      }

      return true
    } catch (error) {
      console.error('Error deleting photo:', error)
      return false
    }
  }

  /**
   * Update photo description
   */
  async updatePhotoDescription(
    photoId: string,
    description: string,
    tenantId: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('job_photos')
        .update({ 
          description,
          updated_at: new Date().toISOString()
        })
        .eq('id', photoId)
        .eq('tenant_id', tenantId)

      if (error) throw error

      return true
    } catch (error) {
      console.error('Error updating photo description:', error)
      return false
    }
  }
}

// Export singleton instance
export const photoBatchUploadService = new PhotoBatchUploadService()