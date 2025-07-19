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
    if (!roomName) {
      setStatus('No room available')
      return
    }

    setIsLoading(true)
    setStatus('Adding AI agent...')

    try {
      // Custom SWML configuration for the agent
      const agentConfig = {
        sections: {
          main: [
            {
              ai: {
                voice: "alloy",
                engine: "openai", 
                model: "gpt-4",
                enable_vision: true,
                params: {
                  name: agentName,
                  role: agentRole
                },
                context: {
                  persona: `You are ${agentName}, a professional ${agentRole} in this video call.`,
                  greeting: `Hello! I'm ${agentName}, your ${agentRole}. I'm here to help assess your project and provide an estimate. What can I help you with today?`,
                  task: "Help participants with project estimation, answer technical questions, and gather necessary information for accurate quotes.",
                  rules: [
                    "Always be professional and helpful",
                    "Use the video feed to understand context and assess the project",
                    "Ask for clarification when something is unclear",
                    "Provide accurate and helpful information",
                    "Take note of important details for the estimate",
                    "Guide the customer to show relevant areas"
                  ]
                }
              }
            }
          ]
        }
      }

      console.log('Adding AI agent to room:', roomName)
      
      // Using simplified version until full SWML deployment is ready
      const { data, error } = await supabase.functions.invoke('add-ai-agent-simple', {
        body: {
          room_name: roomName,
          agent_config: agentConfig
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