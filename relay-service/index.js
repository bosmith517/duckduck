import { createClient } from '@supabase/supabase-js';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// Store active calls
const activeCalls = new Map();

// SignalWire REST API helper
class SignalWireAPI {
  constructor(projectId, apiToken) {
    this.projectId = projectId;
    this.apiToken = apiToken;
    this.baseUrl = `https://${projectId}.signalwire.com/api/laml/v2`;
    this.auth = Buffer.from(`${projectId}:${apiToken}`).toString('base64');
  }

  async makeCall(from, to) {
    const response = await fetch(`${this.baseUrl}/Accounts/${this.projectId}/Calls`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${this.auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: from,
        To: to,
        Url: 'http://demo.twilio.com/docs/voice.xml', // Simple TwiML for testing
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SignalWire API error: ${error}`);
    }

    return await response.json();
  }

  async hangupCall(callSid) {
    const response = await fetch(`${this.baseUrl}/Accounts/${this.projectId}/Calls/${callSid}`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${this.auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        Status: 'completed',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SignalWire API error: ${error}`);
    }

    return await response.json();
  }
}

// Initialize SignalWire API client
const signalWireAPI = new SignalWireAPI(
  process.env.SIGNALWIRE_PROJECT_ID,
  process.env.SIGNALWIRE_API_TOKEN
);

// Update call status in database
async function updateCallStatus(callRecordId, status) {
  try {
    const { error } = await supabase
      .from('calls')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', callRecordId);

    if (error) {
      console.error('❌ Error updating call status:', error);
    } else {
      console.log(`✅ Call ${callRecordId} status updated to: ${status}`);
    }
  } catch (error) {
    console.error('❌ Error updating call status:', error);
  }
}

// API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    activeCalls: activeCalls.size
  });
});

// Originate outbound call
app.post('/call/originate', async (req, res) => {
  try {
    const { to, from, tenantId, userId } = req.body;

    if (!to || !from) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required parameters: to, from' 
      });
    }

    console.log(`📞 Originating call from ${from} to ${to}`);

    // Make the call using SignalWire REST API
    const callResult = await signalWireAPI.makeCall(from, to);

    // Store the call info
    activeCalls.set(callResult.sid, {
      sid: callResult.sid,
      from: from,
      to: to,
      status: callResult.status
    });

    // Create call record in database
    const { data, error } = await supabase
      .from('calls')
      .insert({
        call_sid: callResult.sid,
        from_number: from,
        to_number: to,
        status: 'ringing',
        direction: 'outbound',
        tenant_id: tenantId,
        user_id: userId,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating outbound call record:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to create call record' 
      });
    }

    console.log(`✅ Outbound call initiated: ${callResult.sid}`);

    res.json({ 
      success: true, 
      callId: callResult.sid,
      callRecordId: data.id
    });

  } catch (error) {
    console.error('❌ Error originating call:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Hangup call
app.post('/call/hangup', async (req, res) => {
  try {
    const { callSid } = req.body;

    if (!callSid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing callSid' 
      });
    }

    // Hangup via SignalWire REST API
    await signalWireAPI.hangupCall(callSid);

    // Remove from active calls
    activeCalls.delete(callSid);

    console.log(`📴 Call ${callSid} hung up via API`);

    res.json({ success: true });

  } catch (error) {
    console.error('❌ Error hanging up call:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Mute call (placeholder - would need WebRTC for actual muting)
app.post('/call/mute', async (req, res) => {
  try {
    const { callSid } = req.body;

    if (!callSid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing callSid' 
      });
    }

    console.log(`🔇 Call ${callSid} mute requested (placeholder)`);
    res.json({ success: true });

  } catch (error) {
    console.error('❌ Error muting call:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Unmute call (placeholder)
app.post('/call/unmute', async (req, res) => {
  try {
    const { callSid } = req.body;

    if (!callSid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing callSid' 
      });
    }

    console.log(`🎤 Call ${callSid} unmute requested (placeholder)`);
    res.json({ success: true });

  } catch (error) {
    console.error('❌ Error unmuting call:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Send DTMF digits (placeholder)
app.post('/call/dtmf', async (req, res) => {
  try {
    const { callSid, digits } = req.body;

    if (!callSid || !digits) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing callSid or digits' 
      });
    }

    console.log(`🔢 DTMF digits ${digits} requested for call ${callSid} (placeholder)`);
    res.json({ success: true });

  } catch (error) {
    console.error('❌ Error sending DTMF:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Get active calls
app.get('/calls/active', (req, res) => {
  const calls = Array.from(activeCalls.entries()).map(([id, call]) => ({
    id,
    from: call.from,
    to: call.to,
    status: call.status
  }));

  res.json({ calls });
});

// Webhook endpoint for SignalWire call status updates
app.post('/webhooks/call-status', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { CallSid, CallStatus, From, To } = req.body;
    
    console.log(`📞 Webhook: Call ${CallSid} status: ${CallStatus}`);

    // Update call status in database
    const { error } = await supabase
      .from('calls')
      .update({ 
        status: CallStatus.toLowerCase(),
        updated_at: new Date().toISOString()
      })
      .eq('call_sid', CallSid);

    if (error) {
      console.error('❌ Error updating call status from webhook:', error);
    }

    // Update active calls
    if (activeCalls.has(CallSid)) {
      activeCalls.get(CallSid).status = CallStatus;
    }

    // Remove from active calls if completed
    if (['completed', 'failed', 'canceled'].includes(CallStatus.toLowerCase())) {
      activeCalls.delete(CallSid);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    res.status(500).send('Error');
  }
});

// Start the server
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 TradeWorks Relay Service running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 Webhook endpoint: http://localhost:${PORT}/webhooks/call-status`);
  console.log(`✅ SignalWire REST API initialized`);
  console.log(`🎧 Ready to handle voice calls`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  
  // Hangup all active calls
  for (const [callSid, call] of activeCalls) {
    try {
      await signalWireAPI.hangupCall(callSid);
      console.log(`📴 Hung up call ${callSid}`);
    } catch (error) {
      console.error(`❌ Error hanging up call ${callSid}:`, error);
    }
  }
  
  process.exit(0);
});
