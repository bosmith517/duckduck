import React from 'react'

interface LoadingSpinnerProps {
  text?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'secondary' | 'light'
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  text = 'Loading...', 
  size = 'md',
  variant = 'primary' 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8', 
    lg: 'w-12 h-12'
  }

  const variantClasses = {
    primary: 'text-primary',
    secondary: 'text-secondary', 
    light: 'text-muted'
  }

  return (
    <div className="d-flex flex-column align-items-center justify-content-center p-6">
      <div className={`spinner-border ${variantClasses[variant]} mb-3`} style={{
        width: size === 'sm' ? '1rem' : size === 'lg' ? '3rem' : '2rem',
        height: size === 'sm' ? '1rem' : size === 'lg' ? '3rem' : '2rem'
      }} role="status">
        <span className="visually-hidden">Loading...</span>
      </div>
      <div className={`${variantClasses[variant]} fs-6 fw-semibold`}>
        {text}
      </div>
    </div>
  )
}

export default LoadingSpinner