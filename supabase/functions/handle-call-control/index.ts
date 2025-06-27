// supabase/functions/handle-call-control/index.ts
// CORRECTED VERSION: Reads the agent identity from the URL to dynamically route the call.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  try {
    // ** THE FIX IS HERE: Read the 'agent' parameter from the request URL **
    const url = new URL(req.url);
    const agent_identity = url.searchParams.get("agent");

    if (!agent_identity) {
      // If no agent is specified, we can't connect the call.
      // We'll respond with LaML to hang up the call gracefully.
      const hangupLaML = `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`;
      console.error("handle-call-control was called without an agent identity.");
      return new Response(hangupLaML, { headers: { 'Content-Type': 'application/xml' } });
    }

    // Dynamically insert the correct agent identity into the LaML
    const laML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Dial>
        <Client>${agent_identity}</Client>
    </Dial>
</Response>`;

    return new Response(laML, {
      headers: { 'Content-Type': 'application/xml' },
      status: 200,
    });

  } catch (error) {
    console.error("Error in handle-call-control:", error.message);
    const errorLaML = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>We're sorry, an application error has occurred.</Say><Hangup/></Response>`;
    return new Response(errorLaML, { headers: { 'Content-Type': 'application/xml' }, status: 500 });
  }
})