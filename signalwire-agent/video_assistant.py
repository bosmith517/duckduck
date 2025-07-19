#!/usr/bin/env python3
"""
SignalWire AI Video Assistant Agent
This agent can join video rooms and provide assistance
"""

from signalwire_agents import AgentBase
from typing import Optional, Dict, Any

class VideoAssistant(AgentBase):
    def __init__(
        self,
        name: str = "Alex",
        role: str = "estimator",
        company: str = "TradeWorks Pro",
        expertise: Optional[list] = None,
        **kwargs
    ):
        # Set default name for the agent
        kwargs.setdefault('name', 'video-assistant')
        kwargs.setdefault('route', '/video-agent')
        kwargs.setdefault('host', '0.0.0.0')
        kwargs.setdefault('port', 3000)
        kwargs.setdefault('use_pom', True)  # Enable perception of motion for video
        
        super().__init__(**kwargs)
        
        # Store configuration
        self.agent_name = name
        self.role = role
        self.company = company
        self.expertise = expertise or ["general assistance", "cost estimation", "technical support"]
        
        # Define agent personality
        self.prompt_add_section(
            "Personality", 
            body="You are Alex, a helpful AI assistant in video calls. You're professional, friendly, and knowledgeable."
        )
        
        self.prompt_add_section(
            "Goal", 
            body="Assist participants in video calls with estimation, technical support, and general questions."
        )
        
        self.prompt_add_section(
            "Instructions", 
            bullets=[
                "Greet participants when you join the call",
                "Listen carefully to questions and provide clear answers",
                "If discussing estimates, be thorough but concise",
                "If you can't see something clearly, ask for clarification",
                "Always maintain a professional demeanor",
                "End conversations politely"
            ]
        )
        
        # Add visual context for video
        self.prompt_add_section(
            "Visual Context",
            body="You can see participants through video. Pay attention to what they show you and reference visual elements when relevant."
        )

    async def on_join_room(self, room_name: str):
        """Called when agent joins a video room"""
        print(f"Joined video room: {room_name}")
        # You can add custom logic here
        
    async def on_leave_room(self):
        """Called when agent leaves a video room"""
        print("Left video room")

def main():
    agent = VideoAssistant()
    agent.run()  # Auto-detects deployment environment

if __name__ == "__main__":
    main()