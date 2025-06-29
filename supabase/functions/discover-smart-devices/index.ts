import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    const { customerId } = await req.json()

    if (!customerId) {
      return new Response(
        JSON.stringify({ error: 'Customer ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get customer's network information
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', customerId)
      .single()

    if (contactError || !contact) {
      return new Response(
        JSON.stringify({ error: 'Customer not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Mock device discovery - in real implementation, would scan network
    const discoveredDevices = [
      {
        deviceType: 'nest_thermostat',
        brand: 'Nest',
        model: 'Learning Thermostat 4th Gen',
        macAddress: '00:1A:2B:3C:4D:5E',
        ipAddress: '192.168.1.100',
        capabilities: ['heating', 'cooling', 'scheduling', 'learning'],
        isOnline: true
      },
      {
        deviceType: 'ring_doorbell',
        brand: 'Ring',
        model: 'Video Doorbell Pro 2',
        macAddress: '00:1A:2B:3C:4D:5F',
        ipAddress: '192.168.1.101',
        capabilities: ['video', 'audio', 'motion_detection'],
        isOnline: true
      },
      {
        deviceType: 'ecobee_sensor',
        brand: 'Ecobee',
        model: 'SmartSensor',
        macAddress: '00:1A:2B:3C:4D:60',
        ipAddress: '192.168.1.102',
        capabilities: ['temperature', 'occupancy', 'humidity'],
        isOnline: true
      }
    ]

    // Check which devices are already registered
    const { data: existingDevices } = await supabase
      .from('smart_devices')
      .select('device_id, mac_address')
      .eq('contact_id', customerId)

    const existingMacs = new Set(existingDevices?.map(d => d.mac_address) || [])
    const newDevices = discoveredDevices.filter(d => !existingMacs.has(d.macAddress))

    return new Response(
      JSON.stringify({
        discovered: discoveredDevices.length,
        new: newDevices.length,
        devices: newDevices
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in discover-smart-devices:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})