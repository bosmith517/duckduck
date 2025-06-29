import React, { useEffect, useState } from 'react';
import { MobileService } from '../../services/mobileService';

interface MobileLayoutProps {
  children: React.ReactNode;
  showTabBar?: boolean;
  title?: string;
  showBackButton?: boolean;
  onBackClick?: () => void;
}

export const MobileLayout: React.FC<MobileLayoutProps> = ({
  children,
  showTabBar = true,
  title,
  showBackButton = false,
  onBackClick,
}) => {
  const [isNative, setIsNative] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    setIsNative(MobileService.isNativePlatform());
    
    // Initialize mobile services
    if (MobileService.isNativePlatform()) {
      MobileService.setStatusBarStyle('dark');
      MobileService.hideSplashScreen();
      MobileService.initializePushNotifications();
    }

    // Monitor network status
    MobileService.onNetworkChange(setIsOnline);
  }, []);

  const handleBackClick = () => {
    if (onBackClick) {
      onBackClick();
    } else {
      window.history.back();
    }
  };

  return (
    <div className={`mobile-layout ${isNative ? 'native-app' : 'web-app'}`}>
      {/* Status Bar Spacer for iOS */}
      {isNative && <div className="status-bar-spacer" />}
      
      {/* Header */}
      <div className="mobile-header">
        <div className="header-content">
          {showBackButton && (
            <button 
              className="btn btn-link back-button"
              onClick={handleBackClick}
            >
              <i className="bi bi-chevron-left fs-4"></i>
            </button>
          )}
          
          {title && (
            <h1 className="header-title">{title}</h1>
          )}
          
          <div className="header-actions">
            {!isOnline && (
              <span className="offline-indicator">
                <i className="bi bi-wifi-off text-warning"></i>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mobile-content">
        {children}
      </div>

      {/* Tab Bar */}
      {showTabBar && (
        <div className="mobile-tab-bar">
          <div className="tab-item">
            <a href="/dashboard" className="tab-link">
              <i className="bi bi-house"></i>
              <span>Home</span>
            </a>
          </div>
          <div className="tab-item">
            <a href="/jobs" className="tab-link">
              <i className="bi bi-briefcase"></i>
              <span>Jobs</span>
            </a>
          </div>
          <div className="tab-item">
            <a href="/communications/call-center" className="tab-link">
              <i className="bi bi-telephone"></i>
              <span>Calls</span>
            </a>
          </div>
          <div className="tab-item">
            <a href="/schedule" className="tab-link">
              <i className="bi bi-calendar"></i>
              <span>Schedule</span>
            </a>
          </div>
          <div className="tab-item">
            <a href="/tracking" className="tab-link">
              <i className="bi bi-geo-alt"></i>
              <span>Track</span>
            </a>
          </div>
        </div>
      )}

      {/* Safe Area Bottom Spacer for iOS */}
      {isNative && <div className="safe-area-bottom" />}
    </div>
  );
};

// Mobile-specific styles
const mobileStyles = `
.mobile-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.native-app {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}

.status-bar-spacer {
  height: env(safe-area-inset-top, 0px);
  background: var(--bs-primary);
}

.mobile-header {
  background: var(--bs-primary);
  color: white;
  padding: 1rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  z-index: 1000;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.back-button {
  color: white !important;
  padding: 0.25rem;
  margin-right: 0.5rem;
}

.header-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  flex: 1;
  text-align: center;
}

.header-actions {
  min-width: 2rem;
  display: flex;
  justify-content: flex-end;
}

.offline-indicator {
  display: flex;
  align-items: center;
}

.mobile-content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 1rem;
}

.mobile-tab-bar {
  display: flex;
  background: white;
  border-top: 1px solid var(--bs-border-color);
  padding: env(safe-area-inset-bottom, 0.5rem) 0 0.5rem 0;
  box-shadow: 0 -2px 4px rgba(0,0,0,0.05);
}

.tab-item {
  flex: 1;
  text-align: center;
}

.tab-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.5rem;
  text-decoration: none;
  color: var(--bs-secondary);
  transition: color 0.2s;
}

.tab-link:hover,
.tab-link.active {
  color: var(--bs-primary);
  text-decoration: none;
}

.tab-link i {
  font-size: 1.25rem;
  margin-bottom: 0.25rem;
}

.tab-link span {
  font-size: 0.75rem;
}

.safe-area-bottom {
  height: env(safe-area-inset-bottom, 0px);
  background: white;
}

@media (max-width: 768px) {
  .mobile-content {
    padding: 0.75rem;
  }
  
  .header-title {
    font-size: 1.125rem;
  }
  
  .tab-link i {
    font-size: 1.125rem;
  }
  
  .tab-link span {
    font-size: 0.6875rem;
  }
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = mobileStyles;
  document.head.appendChild(styleElement);
}