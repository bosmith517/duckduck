import React from 'react'

interface TradeWorksLogoProps {
  width?: number
  height?: number
  className?: string
}

const TradeWorksLogo: React.FC<TradeWorksLogoProps> = ({ 
  width = 200, 
  height = 60, 
  className = '' 
}) => {
  return (
    <svg 
      width={width} 
      height={height} 
      viewBox="0 0 200 60" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Wrench icon */}
      <g transform="translate(10, 10)">
        <path 
          d="M8 2C8 0.895 8.895 0 10 0C11.105 0 12 0.895 12 2C12 3.105 11.105 4 10 4C8.895 4 8 3.105 8 2Z" 
          fill="#141414"
        />
        <path 
          d="M6 6C6 4.895 6.895 4 8 4C9.105 4 10 4.895 10 6L10 20C10 21.105 9.105 22 8 22C6.895 22 6 21.105 6 20L6 6Z" 
          fill="#141414"
        />
        <path 
          d="M2 8C0.895 8 0 8.895 0 10C0 11.105 0.895 12 2 12L6 12L6 8L2 8Z" 
          fill="#141414"
        />
        <path 
          d="M10 8L10 12L14 12C15.105 12 16 11.105 16 10C16 8.895 15.105 8 14 8L10 8Z" 
          fill="#141414"
        />
      </g>
      
      {/* Text */}
      <text 
        x="40" 
        y="35" 
        fontFamily="Arial, sans-serif" 
        fontSize="18" 
        fontWeight="bold" 
        fill="#141414"
      >
        TRADEWORKS
      </text>
      <rect x="165" y="25" width="25" height="12" fill="#FFD700"/>
      <text 
        x="167" 
        y="33" 
        fontFamily="Arial, sans-serif" 
        fontSize="8" 
        fontWeight="bold" 
        fill="#141414"
      >
        PRO
      </text>
    </svg>
  )
}

export default TradeWorksLogo
