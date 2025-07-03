import React from 'react'

// Debug component to ensure chat widget is visible
export const ChatWidgetDebug: React.FC = () => {
  return (
    <div 
      style={{
        position: 'fixed',
        bottom: '80px',
        right: '20px',
        zIndex: 10000,
        background: 'red',
        color: 'white',
        padding: '10px',
        borderRadius: '5px',
        fontWeight: 'bold'
      }}
    >
      Chat Debug: If you see this but no chat button below, there's a CSS issue
    </div>
  )
}

export default ChatWidgetDebug