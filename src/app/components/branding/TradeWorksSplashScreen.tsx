import React from 'react'
import TradeWorksLogo from './TradeWorksLogo'

const TradeWorksSplashScreen: React.FC = () => {
  const splashStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    zIndex: 99999,
  }

  const loaderWrapperStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    marginTop: '2rem',
  }

  const loaderStyle: React.CSSProperties = {
    width: '2rem',
    height: '2rem',
    border: '0.185rem solid #FFD700',
    borderBottomColor: 'transparent',
    borderRadius: '50%',
    display: 'inline-block',
    boxSizing: 'border-box',
    animation: 'rotation 0.65s linear infinite',
  }

  const loadingTextStyle: React.CSSProperties = {
    color: '#808080',
    marginLeft: '1.25rem',
    fontSize: '1.075rem',
    fontWeight: 500,
    fontFamily: 'Inter, Helvetica, sans-serif',
  }

  return (
    <>
      <style>
        {`
          @keyframes rotation {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      <div style={splashStyle}>
        <TradeWorksLogo width={250} height={75} />
        <div style={loaderWrapperStyle}>
          <span style={loaderStyle}></span>
          <span style={loadingTextStyle}>Loading...</span>
        </div>
      </div>
    </>
  )
}

export default TradeWorksSplashScreen
