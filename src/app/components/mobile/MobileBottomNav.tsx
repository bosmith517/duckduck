import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const MobileBottomNav: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  
  const isActive = (path: string) => location.pathname === path
  
  return (
    <div className="mobile-quick-nav">
      <div className="nav-item">
        <a 
          href="#" 
          onClick={(e) => { e.preventDefault(); navigate('/mobile/my-day') }}
          className={isActive('/mobile/my-day') ? 'active' : ''}
        >
          <i className="bi bi-calendar-check"></i>
          <span>My Day</span>
        </a>
      </div>
      
      <div className="nav-item">
        <a 
          href="#" 
          onClick={(e) => { e.preventDefault(); navigate('/jobs') }}
          className={isActive('/jobs') ? 'active' : ''}
        >
          <i className="bi bi-briefcase"></i>
          <span>Jobs</span>
        </a>
      </div>
      
      <div className="nav-item">
        <a 
          href="#" 
          onClick={(e) => { e.preventDefault(); navigate('/mobile/camera') }}
          className={isActive('/mobile/camera') ? 'active' : ''}
        >
          <i className="bi bi-camera"></i>
          <span>Camera</span>
        </a>
      </div>
      
      <div className="nav-item">
        <a 
          href="#" 
          onClick={(e) => { e.preventDefault(); navigate('/leads') }}
          className={isActive('/leads') ? 'active' : ''}
        >
          <i className="bi bi-people"></i>
          <span>Leads</span>
        </a>
      </div>
      
      <div className="nav-item">
        <a 
          href="#" 
          onClick={(e) => { e.preventDefault(); navigate('/profile/account') }}
          className={location.pathname.startsWith('/profile') ? 'active' : ''}
        >
          <i className="bi bi-person-circle"></i>
          <span>Profile</span>
        </a>
      </div>
    </div>
  )
}

export default MobileBottomNav