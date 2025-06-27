import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    const { 
      customerId, 
      deviceType, 
      deviceBrand,
      deviceModel,
      macAddress,
      ipAddress,
      accessToken,
      capabilities 
    } = await req.json()

    if (!customerId || !deviceType) {
      return new Response(
        JSON.stringify({ error: 'Customer ID and device type are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get tenant_id from contact
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('tenant_id')
      .eq('id', customerId)
      .single()

    if (contactError || !contact) {
      return new Response(
        JSON.stringify({ error: 'Customer not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Encrypt access token if provided
    let encryptedToken = null
    if (accessToken) {
      const encoder = new TextEncoder()
      const data = encoder.encode(accessToken)
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      )
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: new Uint8Array(12) },
        key,
        data
      )
      encryptedToken = Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join('')
    }

    // Insert smart device record
    const { data: deviceData, error: deviceError } = await supabase
      .from('smart_devices')
      .insert({
        tenant_id: contact.tenant_id,
        contact_id: customerId,
        device_type: deviceType,
        device_brand: deviceBrand || 'Unknown',
        device_model: deviceModel || 'Unknown',
        device_id: `${deviceType}_${macAddress?.replace(/:/g, '') || Date.now()}`,
        mac_address: macAddress,
        ip_address: ipAddress,
        access_token_encrypted: encryptedToken,
        capabilities: capabilities || {},
        integration_status: 'connected',
        is_online: true
      })
      .select()
      .single()

    if (deviceError) {
      console.error('Error inserting device:', deviceError)
      return new Response(
        JSON.stringify({ error: 'Failed to connect device' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create initial telemetry record based on device type
    let initialMetrics = {}
    switch (deviceType) {
      case 'nest_thermostat':
        initialMetrics = {
          temperature: Math.floor(Math.random() * 10) + 68,
          target_temperature: 72,
          humidity: Math.floor(Math.random() * 20) + 40
        }
        break
      case 'ring_doorbell':
        initialMetrics = {
          battery_level: Math.floor(Math.random() * 20) + 80,
          motion_detected: false
        }
        break
      case 'ecobee_sensor':
        initialMetrics = {
          temperature: Math.floor(Math.random() * 10) + 68,
          humidity: Math.floor(Math.random() * 20) + 40,
          occupied: false,
          battery_level: Math.floor(Math.random() * 10) + 90
        }
        break
    }

    // Insert initial telemetry data
    for (const [metric, value] of Object.entries(initialMetrics)) {
      await supabase
        .from('device_telemetry')
        .insert({
          device_id: deviceData.id,
          metric_name: metric,
          metric_value: typeof value === 'number' ? value : (value ? 1 : 0),
          metric_unit: getMetricUnit(metric),
          quality_score: 100
        })
    }

    return new Response(
      JSON.stringify({
        success: true,
        device: deviceData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in connect-smart-device:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function getMetricUnit(metricName: string): string {
  const units: Record<string, string> = {
    'temperature': 'fahrenheit',
    'target_temperature': 'fahrenheit',
    'humidity': 'percent',
    'battery_level': 'percent',
    'motion_detected': 'boolean',
    'occupied': 'boolean'
  }
  return units[metricName] || 'unknown'
}