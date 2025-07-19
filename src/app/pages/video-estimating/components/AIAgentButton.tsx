// AIAgentButton.tsx
// Component to add AI agents to SignalWire video rooms using SWML

import React, { useState } from 'react'
import { supabase } from '../../../../supabaseClient'

interface AIAgentButtonProps {
  roomName: string
  agentName?: string
  agentRole?: string
  onAgentAdded?: () => void
  onError?: (error: string) => void
}

export const AIAgentButton: React.FC<AIAgentButtonProps> = ({ 
  roomName, 
  agentName = "Alex",
  agentRole = "AI Estimator",
  onAgentAdded,
  onError 
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [agentActive, setAgentActive] = useState(false)
  const [status, setStatus] = useState('')

  const addAIAgent = async () => {
    console.log('=== AI Agent Button Clicked ===')
    console.log('Room Name:', roomName)
    console.log('Agent Name:', agentName)
    console.log('Agent Role:', agentRole)
    
    if (!roomName) {
      console.error('No room name provided!')
      setStatus('No room available')
      return
    }

    setIsLoading(true)
    setStatus('Adding AI agent...')

    try {
      console.log('Invoking add-ai-agent-simple Edge Function...')
      
      const { data, error } = await supabase.functions.invoke('add-ai-agent-simple', {
        body: {
          room_name: roomName,
          agent_name: agentName,
          agent_role: agentRole
        }
      })

      if (error) throw error

      if (data?.success) {
        setStatus(`${agentName} joined the room!`)
        setAgentActive(true)
        onAgentAdded?.()
        console.log('AI agent added successfully:', data)
      } else {
        throw new Error(data?.error || 'Failed to add AI agent')
      }
    } catch (err: any) {
      console.error('Failed to add AI agent:', err)
      const errorMsg = err.message || 'Unknown error'
      setStatus(`Error: ${errorMsg}`)
      onError?.(errorMsg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="d-flex align-items-center gap-2">
      <button
        className={`btn ${agentActive ? 'btn-success' : 'btn-primary'}`}
        onClick={addAIAgent}
        disabled={isLoading || agentActive || !roomName}
      >
        {isLoading ? (
          <>
            <span className="spinner-border spinner-border-sm me-2" />
            Adding AI Estimator...
          </>
        ) : agentActive ? (
          <>
            <i className="fas fa-check-circle me-2"></i>
            {agentName} Active
          </>
        ) : (
          <>
            <i className="fas fa-robot me-2"></i>
            Add AI {agentRole}
          </>
        )}
      </button>
      
      {status && (
        <small className={agentActive ? 'text-success' : 'text-muted'}>
          {status}
        </small>
      )}
    </div>
  )
}