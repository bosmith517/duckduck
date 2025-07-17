import React, { useState, useEffect } from 'react'
import { clearAllCaches, forceUpdate } from '../../../utils/serviceWorkerRegistration'

interface CacheInfo {
  name: string
  size: number
  count: number
}

export const CacheManager: React.FC = () => {
  const [caches, setCaches] = useState<CacheInfo[]>([])
  const [isClearing, setIsClearing] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  useEffect(() => {
    loadCacheInfo()
  }, [])

  const loadCacheInfo = async () => {
    if ('caches' in window) {
      try {
        const cacheNames = await window.caches.keys()
        const cacheInfo: CacheInfo[] = []
        
        for (const name of cacheNames) {
          const cache = await window.caches.open(name)
          const keys = await cache.keys()
          
          // Estimate size (rough approximation)
          let totalSize = 0
          for (const request of keys) {
            const response = await cache.match(request)
            if (response) {
              const blob = await response.blob()
              totalSize += blob.size
            }
          }
          
          cacheInfo.push({
            name,
            size: totalSize,
            count: keys.length
          })
        }
        
        setCaches(cacheInfo)
      } catch (error) {
        console.error('Error loading cache info:', error)
      }
    }
  }

  const handleClearCache = async () => {
    setIsClearing(true)
    try {
      await clearAllCaches()
      await loadCacheInfo()
      showNotification('Cache cleared successfully!')
      
      // Force update service worker
      forceUpdate()
      
      // Reload after a short delay
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (error) {
      console.error('Error clearing cache:', error)
      showNotification('Failed to clear cache')
    } finally {
      setIsClearing(false)
    }
  }

  const showNotification = (message: string) => {
    setToastMessage(message)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 3000)
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const totalSize = caches.reduce((sum, cache) => sum + cache.size, 0)
  const totalCount = caches.reduce((sum, cache) => sum + cache.count, 0)

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Cache Management</h3>
        <div className="card-toolbar">
          <button
            className="btn btn-sm btn-light-danger"
            onClick={handleClearCache}
            disabled={isClearing}
          >
            {isClearing ? (
              <>
                <span className="spinner-border spinner-border-sm me-2"></span>
                Clearing...
              </>
            ) : (
              <>
                <i className="ki-duotone ki-trash fs-5 me-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                  <span className="path3"></span>
                  <span className="path4"></span>
                  <span className="path5"></span>
                </i>
                Clear All Caches
              </>
            )}
          </button>
        </div>
      </div>
      <div className="card-body">
        <div className="row mb-5">
          <div className="col-md-6">
            <div className="d-flex align-items-center">
              <div className="symbol symbol-50px me-3">
                <div className="symbol-label bg-light-primary">
                  <i className="ki-duotone ki-data fs-2x text-primary">
                    <span className="path1"></span>
                    <span className="path2"></span>
                    <span className="path3"></span>
                    <span className="path4"></span>
                    <span className="path5"></span>
                  </i>
                </div>
              </div>
              <div>
                <div className="fs-5 fw-bold text-gray-900">{formatBytes(totalSize)}</div>
                <div className="fs-7 text-muted">Total Cache Size</div>
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="d-flex align-items-center">
              <div className="symbol symbol-50px me-3">
                <div className="symbol-label bg-light-info">
                  <i className="ki-duotone ki-file fs-2x text-info">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                </div>
              </div>
              <div>
                <div className="fs-5 fw-bold text-gray-900">{totalCount}</div>
                <div className="fs-7 text-muted">Cached Items</div>
              </div>
            </div>
          </div>
        </div>

        {caches.length > 0 && (
          <div className="table-responsive">
            <table className="table table-row-dashed table-row-gray-300 align-middle">
              <thead>
                <tr className="fw-bold text-muted">
                  <th>Cache Name</th>
                  <th>Items</th>
                  <th>Size</th>
                </tr>
              </thead>
              <tbody>
                {caches.map((cache, index) => (
                  <tr key={index}>
                    <td className="fw-semibold">{cache.name}</td>
                    <td>{cache.count}</td>
                    <td>{formatBytes(cache.size)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="notice d-flex bg-light-warning rounded border-warning border border-dashed p-6 mt-5">
          <i className="ki-duotone ki-information-5 fs-2tx text-warning me-4">
            <span className="path1"></span>
            <span className="path2"></span>
            <span className="path3"></span>
          </i>
          <div className="d-flex flex-column">
            <h6 className="fw-bold text-gray-800 mb-1">Cache Information</h6>
            <span className="text-gray-700 fs-7">
              Clearing the cache will remove all stored data and force the app to download fresh content. 
              This can help resolve issues with outdated information but may temporarily slow down the app.
            </span>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {showToast && (
        <div
          className="position-fixed bottom-0 end-0 p-3"
          style={{ zIndex: 9999 }}
        >
          <div className="toast show align-items-center text-white bg-primary border-0">
            <div className="d-flex">
              <div className="toast-body">{toastMessage}</div>
              <button
                type="button"
                className="btn-close btn-close-white me-2 m-auto"
                onClick={() => setShowToast(false)}
              ></button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}