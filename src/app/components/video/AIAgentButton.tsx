// AIAgentButton.tsx
// Component to add AI agents to SignalWire video rooms using SWML

import React, { useState } from 'react'
import { supabase } from '../../../supabaseClient'

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
  agentRole = "AI Assistant",
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
                  greeting: `Hello! I'm ${agentName}, your ${agentRole}. How can I assist you today?`,
                  task: "Help participants with their questions and provide expert assistance.",
                  rules: [
                    "Always be professional and helpful",
                    "Use the video feed to understand context",
                    "Ask for clarification when something is unclear",
                    "Provide accurate and helpful information"
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
        className={`btn ${agentActive ? 'btn-success' : 'btn-info'}`}
        onClick={addAIAgent}
        disabled={isLoading || agentActive || !roomName}
      >
        {isLoading ? (
          <>
            <span className="spinner-border spinner-border-sm me-2" />
            Adding AI...
          </>
        ) : agentActive ? (
          <>✓ {agentName} Active</>
        ) : (
          <>Add AI {agentRole}</>
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