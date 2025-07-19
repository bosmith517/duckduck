#!/usr/bin/env python3
"""
Simple deployment script for SignalWire AI Agent
"""

import os
import json
import base64
import urllib.request
import urllib.error

def deploy_agent():
    # Get credentials from environment or prompt
    project_id = os.environ.get('SIGNALWIRE_PROJECT_ID', 'fe885b9e-34ce-4786-bf8d-df202da35cf3')
    api_token = os.environ.get('SIGNALWIRE_API_TOKEN', 'PT70e642ccbae2047db2638b911fd81a0c8051b720eb882747')
    space_url = os.environ.get('SIGNALWIRE_SPACE_URL', 'taurustech.signalwire.com')
    
    print(f"Deploying to SignalWire Space: {space_url}")
    
    # Read the agent code
    with open('video_assistant.py', 'r') as f:
        agent_code = f.read()
    
    # Prepare the deployment payload
    payload = {
        "name": "video-assistant",
        "code": agent_code,
        "language": "python",
        "route": "/video-agent",
        "config": {
            "enable_vision": True,
            "enable_voice": True,
            "model": "gpt-4",
            "voice": "alloy"
        }
    }
    
    # Create the request
    url = f"https://{space_url}/api/agents"
    auth = base64.b64encode(f"{project_id}:{api_token}".encode()).decode()
    
    req = urllib.request.Request(url)
    req.add_header('Authorization', f'Basic {auth}')
    req.add_header('Content-Type', 'application/json')
    
    try:
        response = urllib.request.urlopen(req, json.dumps(payload).encode())
        result = json.loads(response.read())
        
        print("\n✅ Agent deployed successfully!")
        print(f"Agent ID: {result.get('id', 'N/A')}")
        print(f"Agent URL: {result.get('url', 'N/A')}")
        print(f"Status: {result.get('status', 'N/A')}")
        
        # Save the agent ID for later use
        with open('.agent_id', 'w') as f:
            f.write(result.get('id', ''))
            
        return result
        
    except urllib.error.HTTPError as e:
        print(f"\n❌ Deployment failed: {e.code} {e.reason}")
        if e.code == 404:
            print("API endpoint not found. The deployment API might be different.")
            print("\nPlease deploy manually via SignalWire dashboard:")
            print(f"1. Go to https://{space_url}")
            print("2. Navigate to AI Agents section")
            print("3. Create new Python agent")
            print("4. Upload video_assistant.py")
        else:
            error_data = e.read().decode()
            print(f"Error details: {error_data}")
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")

if __name__ == "__main__":
    print("SignalWire AI Agent Deployment")
    print("=" * 40)
    deploy_agent()