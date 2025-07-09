import React, { useState, useEffect } from 'react'
import { NotificationService, Notification } from '../../services/workflowAutomationService'
import { KTIcon } from '../../../_metronic/helpers'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'

interface NotificationCenterProps {
  userId?: string
  showAsDropdown?: boolean
  maxHeight?: string
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  userId,
  showAsDropdown = false,
  maxHeight = '400px'
}) => {
  const { user, userProfile } = useSupabaseAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'read'>('all')

  useEffect(() => {
    if (user?.id) {
      loadNotifications()
      loadUnreadCount()
    }
  }, [user?.id, activeFilter])

  const loadNotifications = async () => {
    setLoading(true)
    try {
      const userNotifications = await NotificationService.getNotifications(
        userId || user?.id || ''
      )
      
      let filteredNotifications = userNotifications
      if (activeFilter === 'unread') {
        filteredNotifications = userNotifications.filter(n => !n.read_at)
      } else if (activeFilter === 'read') {
        filteredNotifications = userNotifications.filter(n => n.read_at)
      }
      
      setNotifications(filteredNotifications)
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadUnreadCount = async () => {
    try {
      const count = await NotificationService.getUnreadCount(
        userId || user?.id || ''
      )
      setUnreadCount(count)
    } catch (error) {
      console.error('Error loading unread count:', error)
    }
  }

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await NotificationService.markAsRead(notificationId)
      loadNotifications()
      loadUnreadCount()
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.read_at)
      await Promise.all(
        unreadNotifications.map(n => NotificationService.markAsRead(n.id))
      )
      loadNotifications()
      loadUnreadCount()
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  }

  const getNotificationIcon = (category: string) => {
    switch (category) {
      case 'job_status':
        return 'briefcase'
      case 'milestone':
        return 'flag'
      case 'assignment':
        return 'user'
      case 'reminder':
        return 'notification'
      case 'alert':
        return 'warning'
      case 'invoice':
        return 'bill'
      case 'quote':
        return 'document'
      default:
        return 'notification'
    }
  }

  const getNotificationColor = (category: string) => {
    switch (category) {
      case 'job_status':
        return 'primary'
      case 'milestone':
        return 'success'
      case 'assignment':
        return 'info'
      case 'reminder':
        return 'warning'
      case 'alert':
        return 'danger'
      case 'invoice':
        return 'dark'
      case 'quote':
        return 'secondary'
      default:
        return 'primary'
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) {
      return 'Just now'
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60)
      return `${minutes}m ago`
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600)
      return `${hours}h ago`
    } else {
      const days = Math.floor(diffInSeconds / 86400)
      return `${days}d ago`
    }
  }

  if (showAsDropdown) {
    return (
      <div className="menu menu-sub menu-sub-dropdown menu-column w-350px w-lg-375px">
        <div className="d-flex flex-column bgi-no-repeat rounded-top">
          <h3 className="text-white fw-semibold px-9 mt-10 mb-6">
            Notifications
            <span className="fs-8 opacity-75 ps-3">{unreadCount} unread</span>
          </h3>
          <div className="tabs-custom px-9">
            <ul className="nav nav-tabs nav-line-tabs nav-line-tabs-2x nav-line-tabs-bold justify-content-between">
              <li className="nav-item">
                <a
                  className={`nav-link text-white opacity-75 opacity-state-100 pb-4 ${
                    activeFilter === 'all' ? 'active' : ''
                  }`}
                  onClick={() => setActiveFilter('all')}
                  style={{ cursor: 'pointer' }}
                >
                  All
                </a>
              </li>
              <li className="nav-item">
                <a
                  className={`nav-link text-white opacity-75 opacity-state-100 pb-4 ${
                    activeFilter === 'unread' ? 'active' : ''
                  }`}
                  onClick={() => setActiveFilter('unread')}
                  style={{ cursor: 'pointer' }}
                >
                  Unread
                </a>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="scroll-y mh-325px my-5 px-8">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-5">
              <KTIcon iconName="notification" className="fs-1 text-muted mb-3" />
              <div className="text-muted">No notifications</div>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`d-flex flex-stack py-4 ${
                  !notification.read_at ? 'bg-light-primary rounded px-4' : ''
                }`}
              >
                <div className="d-flex align-items-center">
                  <div className="symbol symbol-35px me-4">
                    <span 
                      className={`symbol-label bg-light-${getNotificationColor(notification.category)} text-${getNotificationColor(notification.category)}`}
                    >
                      <KTIcon iconName={getNotificationIcon(notification.category)} className="fs-2" />
                    </span>
                  </div>
                  <div className="mb-0 me-2">
                    <div className="fs-6 text-gray-800 text-hover-primary fw-bold">
                      {notification.title}
                    </div>
                    <div className="text-gray-400 fs-7">
                      {notification.message}
                    </div>
                  </div>
                </div>
                <div className="d-flex flex-column align-items-end">
                  <span className="text-gray-400 fs-7">
                    {formatTimeAgo(notification.created_at)}
                  </span>
                  {!notification.read_at && (
                    <button
                      className="btn btn-sm btn-light mt-1"
                      onClick={() => handleMarkAsRead(notification.id)}
                    >
                      Mark Read
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        
        <div className="py-3 text-center border-top">
          <button
            className="btn btn-color-gray-600 btn-active-color-primary"
            onClick={handleMarkAllAsRead}
          >
            Mark All as Read
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-header border-0 pt-5">
        <h3 className="card-title align-items-start flex-column">
          <span className="card-label fw-bold fs-3 mb-1">Notifications</span>
          <span className="text-muted mt-1 fw-semibold fs-7">
            {unreadCount} unread notifications
          </span>
        </h3>
        <div className="card-toolbar">
          <button
            type="button"
            className="btn btn-sm btn-light"
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0}
          >
            Mark All Read
          </button>
        </div>
      </div>

      <div className="card-body py-3">
        {/* Filter Tabs */}
        <ul className="nav nav-tabs nav-line-tabs nav-line-tabs-2x mb-5 fs-6">
          <li className="nav-item">
            <a
              className={`nav-link ${activeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setActiveFilter('all')}
              style={{ cursor: 'pointer' }}
            >
              All ({notifications.length})
            </a>
          </li>
          <li className="nav-item">
            <a
              className={`nav-link ${activeFilter === 'unread' ? 'active' : ''}`}
              onClick={() => setActiveFilter('unread')}
              style={{ cursor: 'pointer' }}
            >
              Unread ({unreadCount})
            </a>
          </li>
          <li className="nav-item">
            <a
              className={`nav-link ${activeFilter === 'read' ? 'active' : ''}`}
              onClick={() => setActiveFilter('read')}
              style={{ cursor: 'pointer' }}
            >
              Read
            </a>
          </li>
        </ul>

        {/* Notifications List */}
        <div className="scroll-y" style={{ maxHeight }}>
          {loading ? (
            <div className="text-center py-10">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-10">
              <KTIcon iconName="notification" className="fs-1 text-muted mb-3" />
              <h3 className="text-gray-800 fw-bold">No Notifications</h3>
              <p className="text-muted">
                {activeFilter === 'all' 
                  ? 'No notifications to display' 
                  : `No ${activeFilter} notifications`}
              </p>
            </div>
          ) : (
            <div className="timeline">
              {notifications.map((notification) => (
                <div key={notification.id} className="timeline-item">
                  <div className="timeline-line w-40px"></div>
                  <div className="timeline-icon symbol symbol-circle symbol-40px">
                    <div 
                      className={`symbol-label bg-light-${getNotificationColor(notification.category)} text-${getNotificationColor(notification.category)}`}
                    >
                      <KTIcon iconName={getNotificationIcon(notification.category)} className="fs-2" />
                    </div>
                  </div>
                  <div className="timeline-content mb-10 mt-n1">
                    <div className="pe-3 mb-5">
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <div className="fs-5 fw-bold text-gray-800 text-hover-primary">
                          {notification.title}
                          {!notification.read_at && (
                            <span className="badge badge-circle badge-danger ms-2 h-10px w-10px"></span>
                          )}
                        </div>
                        <span className="text-gray-400 fs-7">
                          {formatTimeAgo(notification.created_at)}
                        </span>
                      </div>
                      <div className="overflow-auto pb-5">
                        <div className="text-gray-600 fs-6">
                          {notification.message}
                        </div>
                      </div>
                      {!notification.read_at && (
                        <button
                          className="btn btn-sm btn-light"
                          onClick={() => handleMarkAsRead(notification.id)}
                        >
                          Mark as Read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}