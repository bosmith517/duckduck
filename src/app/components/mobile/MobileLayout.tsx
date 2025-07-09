import React, { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'

const MobileLayout: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { currentUser } = useSupabaseAuth()
  
  // Hide desktop navigation elements in PWA mode
  useEffect(() => {
    document.body.classList.add('mobile-layout')
    return () => {
      document.body.classList.remove('mobile-layout')
    }
  }, [])
  
  return (
    <div className="d-flex flex-column vh-100">
      {/* Mobile Header */}
      <div className="mobile-header bg-primary text-white p-3 d-flex align-items-center justify-content-between">
        <h1 className="h5 mb-0">TradeWorks Pro</h1>
        <div className="d-flex align-items-center gap-2">
          <span className="small">{currentUser?.email}</span>
          <button 
            className="btn btn-sm btn-outline-light"
            onClick={() => navigate('/logout')}
          >
            <i className="bi bi-box-arrow-right"></i>
          </button>
        </div>
      </div>
      
      {/* Content Area */}
      <div className="flex-grow-1 overflow-auto">
        <Outlet />
      </div>
      
      {/* Mobile Bottom Navigation */}
      <div className="mobile-nav bg-light border-top">
        <div className="d-flex justify-content-around py-2">
          <button 
            className={`btn btn-sm ${location.pathname === '/mobile/my-day' ? 'btn-primary' : 'btn-light'}`}
            onClick={() => navigate('/mobile/my-day')}
          >
            <i className="bi bi-calendar-day d-block"></i>
            <small>My Day</small>
          </button>
          
          <button 
            className={`btn btn-sm ${location.pathname === '/jobs' ? 'btn-primary' : 'btn-light'}`}
            onClick={() => navigate('/jobs')}
          >
            <i className="bi bi-briefcase d-block"></i>
            <small>Jobs</small>
          </button>
          
          <button 
            className={`btn btn-sm ${location.pathname === '/mobile/camera' ? 'btn-primary' : 'btn-light'}`}
            onClick={() => navigate('/mobile/camera')}
          >
            <i className="bi bi-camera d-block"></i>
            <small>Photos</small>
          </button>
          
          <button 
            className={`btn btn-sm ${location.pathname === '/communications/call-center' ? 'btn-primary' : 'btn-light'}`}
            onClick={() => navigate('/communications/call-center')}
          >
            <i className="bi bi-telephone d-block"></i>
            <small>Call</small>
          </button>
          
          <button 
            className={`btn btn-sm ${location.pathname === '/profile' ? 'btn-primary' : 'btn-light'}`}
            onClick={() => navigate('/profile')}
          >
            <i className="bi bi-person d-block"></i>
            <small>Profile</small>
          </button>
        </div>
      </div>
    </div>
  )
}

export default MobileLayout