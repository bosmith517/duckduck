import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export const NewFeaturesNotification: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true)
  const navigate = useNavigate()

  if (!isVisible) return null

  return (
    <div className="alert alert-dismissible bg-light-primary border border-primary d-flex flex-column flex-sm-row w-100 p-5 mb-5">
      <div className="d-flex flex-column pe-0 pe-sm-10">
        <h5 className="mb-1">🎉 New Communication Features Available!</h5>
        <span>
          We've just launched our modern video meeting system with AI transcription, 
          updated team chat, and enhanced phone management. 
          <strong> Try them now!</strong>
        </span>
      </div>
      <div className="d-flex flex-center flex-sm-auto">
        <button 
          className="btn btn-primary btn-sm me-3"
          onClick={() => navigate('/communications/video')}
        >
          Try Video Meetings
        </button>
        <button 
          type="button" 
          className="position-absolute position-sm-relative m-2 m-sm-0 top-0 end-0 btn btn-icon ms-sm-auto" 
          onClick={() => setIsVisible(false)}
        >
          <i className="ki-duotone ki-cross fs-1 text-primary">
            <span className="path1"></span>
            <span className="path2"></span>
          </i>
        </button>
      </div>
    </div>
  )
}

export default NewFeaturesNotification