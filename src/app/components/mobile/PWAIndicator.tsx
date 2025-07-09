import React from 'react'

const PWAIndicator: React.FC = () => {
  // Detect if running as installed PWA
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                (window.navigator as any).standalone === true ||
                document.referrer.includes('android-app://');
  
  if (!isPWA) return null;
  
  return (
    <div 
      className="position-fixed bottom-0 start-50 translate-middle-x mb-3 badge bg-success"
      style={{ zIndex: 9999 }}
    >
      <i className="bi bi-app-indicator me-1"></i>
      Running as Installed App
    </div>
  );
};

export default PWAIndicator;