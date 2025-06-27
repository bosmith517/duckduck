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

    const { customerId, equipmentId } = await req.json()

    if (!customerId) {
      return new Response(
        JSON.stringify({ error: 'Customer ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get customer's equipment and service history
    let equipmentQuery = supabase
      .from('customer_equipment')
      .select(`
        *,
        equipment_service_history(*)
      `)
      .eq('contact_id', customerId)

    if (equipmentId) {
      equipmentQuery = equipmentQuery.eq('id', equipmentId)
    }

    const { data: equipment, error: equipmentError } = await equipmentQuery

    if (equipmentError) {
      console.error('Error fetching equipment:', equipmentError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch equipment data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!equipment || equipment.length === 0) {
      return new Response(
        JSON.stringify({ recommendations: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get smart device data for IoT-enabled equipment
    const { data: smartDevices } = await supabase
      .from('smart_devices')
      .select(`
        *,
        device_telemetry(*)
      `)
      .eq('contact_id', customerId)

    // Generate AI recommendations based on equipment data
    const recommendations = []

    for (const item of equipment) {
      const serviceHistory = item.equipment_service_history || []
      const lastService = serviceHistory.length > 0 
        ? new Date(Math.max(...serviceHistory.map((s: any) => new Date(s.service_date).getTime())))
        : null

      // Time-based recommendations
      if (item.next_service_due && new Date(item.next_service_due) <= new Date()) {
        recommendations.push({
          tenant_id: item.tenant_id,
          contact_id: customerId,
          equipment_id: item.id,
          recommendation_type: 'preventive',
          title: `${item.name} Maintenance Due`,
          description: `Your ${item.name} is due for routine maintenance. Regular service helps maintain efficiency and prevents costly repairs.`,
          priority: 'medium',
          estimated_cost: getEstimatedCost(item.equipment_type, 'maintenance'),
          estimated_labor_hours: 2.0,
          timeframe: 'next 2 weeks',
          benefits: [
            'Maintain peak efficiency',
            'Prevent unexpected breakdowns',
            'Extend equipment lifespan',
            'Maintain warranty coverage'
          ],
          is_ai_generated: true,
          ai_confidence_score: 85,
          ai_model_version: 'maintenance-ai-v1.0',
          data_sources: ['service_schedule', 'equipment_age']
        })
      }

      // Efficiency-based recommendations
      if (item.efficiency_rating < 75) {
        const urgency = item.efficiency_rating < 60 ? 'high' : 'medium'
        recommendations.push({
          tenant_id: item.tenant_id,
          contact_id: customerId,
          equipment_id: item.id,
          recommendation_type: item.efficiency_rating < 50 ? 'repair' : 'upgrade',
          title: `${item.name} Efficiency Alert`,
          description: `Your ${item.name} is operating at ${item.efficiency_rating}% efficiency. ${item.efficiency_rating < 50 ? 'Immediate service recommended.' : 'Consider scheduling maintenance or upgrades.'}`,
          priority: urgency,
          estimated_cost: getEstimatedCost(item.equipment_type, item.efficiency_rating < 50 ? 'repair' : 'tune_up'),
          estimated_labor_hours: item.efficiency_rating < 50 ? 4.0 : 2.5,
          timeframe: item.efficiency_rating < 50 ? 'within 1 week' : 'next month',
          benefits: [
            'Reduce energy costs',
            'Improve comfort',
            'Environmental impact',
            'Prevent equipment failure'
          ],
          is_ai_generated: true,
          ai_confidence_score: 90,
          ai_model_version: 'efficiency-ai-v1.0',
          data_sources: ['efficiency_monitoring']
        })
      }

      // Age-based recommendations
      if (item.install_date) {
        const installDate = new Date(item.install_date)
        const ageInYears = (new Date().getTime() - installDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
        
        const lifespanMap: Record<string, number> = {
          'hvac': 15,
          'electrical': 25,
          'plumbing': 20,
          'appliance': 10,
          'security': 8,
          'smart_device': 5
        }

        const expectedLifespan = lifespanMap[item.equipment_type] || 15

        if (ageInYears >= expectedLifespan * 0.8) {
          recommendations.push({
            tenant_id: item.tenant_id,
            contact_id: customerId,
            equipment_id: item.id,
            recommendation_type: ageInYears >= expectedLifespan ? 'replacement' : 'upgrade',
            title: `${item.name} Replacement Planning`,
            description: `Your ${item.name} is ${Math.floor(ageInYears)} years old. ${ageInYears >= expectedLifespan ? 'Consider replacement to avoid unexpected failures.' : 'Start planning for future replacement.'}`,
            priority: ageInYears >= expectedLifespan ? 'high' : 'low',
            estimated_cost: getEstimatedCost(item.equipment_type, 'replacement'),
            estimated_labor_hours: 8.0,
            timeframe: ageInYears >= expectedLifespan ? '1-3 months' : '6-12 months',
            benefits: [
              'Latest technology features',
              'Improved energy efficiency',
              'Better reliability',
              'Warranty protection'
            ],
            is_ai_generated: true,
            ai_confidence_score: 88,
            ai_model_version: 'lifecycle-ai-v1.0',
            data_sources: ['equipment_age', 'industry_standards']
          })
        }
      }

      // Smart device integration recommendations
      if (!item.is_smart_enabled && ['hvac', 'electrical', 'security'].includes(item.equipment_type)) {
        recommendations.push({
          tenant_id: item.tenant_id,
          contact_id: customerId,
          equipment_id: item.id,
          recommendation_type: 'upgrade',
          title: `Smart Integration for ${item.name}`,
          description: `Add smart monitoring capabilities to your ${item.name} for real-time insights, remote control, and predictive maintenance alerts.`,
          priority: 'low',
          estimated_cost: getEstimatedCost('smart_device', 'installation'),
          estimated_labor_hours: 3.0,
          timeframe: 'next 3 months',
          benefits: [
            'Real-time monitoring',
            'Remote control capability',
            'Predictive maintenance',
            'Energy usage tracking',
            'Mobile app integration'
          ],
          is_ai_generated: true,
          ai_confidence_score: 82,
          ai_model_version: 'smart-integration-ai-v1.0',
          data_sources: ['equipment_compatibility', 'smart_home_trends']
        })
      }
    }

    // Smart device specific recommendations
    for (const device of smartDevices || []) {
      const telemetryData = device.device_telemetry || []
      
      // Analyze recent telemetry for anomalies
      if (telemetryData.length > 0) {
        const recentData = telemetryData.filter((t: any) => 
          new Date(t.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        )

        // Check for efficiency issues based on telemetry
        const avgEfficiency = recentData
          .filter((t: any) => t.metric_name === 'efficiency')
          .reduce((sum: number, t: any) => sum + (t.metric_value || 0), 0) / 
          Math.max(1, recentData.filter((t: any) => t.metric_name === 'efficiency').length)

        if (avgEfficiency < 80) {
          recommendations.push({
            tenant_id: device.tenant_id,
            contact_id: customerId,
            equipment_id: device.equipment_id,
            recommendation_type: 'repair',
            title: `Smart Device Performance Alert`,
            description: `Your ${device.device_brand} ${device.device_model} is showing decreased performance. IoT data indicates potential issues requiring attention.`,
            priority: avgEfficiency < 60 ? 'high' : 'medium',
            estimated_cost: 150.00,
            estimated_labor_hours: 1.5,
            timeframe: 'next week',
            benefits: [
              'Restore optimal performance',
              'Prevent device failure',
              'Maintain smart home integration'
            ],
            is_ai_generated: true,
            ai_confidence_score: 92,
            ai_model_version: 'iot-analytics-ai-v1.0',
            data_sources: ['iot_telemetry', 'performance_baselines']
          })
        }
      }
    }

    // Save recommendations to database
    if (recommendations.length > 0) {
      const { error: insertError } = await supabase
        .from('maintenance_recommendations')
        .insert(recommendations)

      if (insertError) {
        console.error('Error saving recommendations:', insertError)
      }
    }

    return new Response(
      JSON.stringify({
        generated: recommendations.length,
        recommendations: recommendations.slice(0, 10) // Return top 10
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in generate-ai-recommendations:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function getEstimatedCost(equipmentType: string, serviceType: string): number {
  const costMatrix: Record<string, Record<string, number>> = {
    'hvac': {
      'maintenance': 150,
      'tune_up': 200,
      'repair': 400,
      'replacement': 5000
    },
    'electrical': {
      'maintenance': 100,
      'tune_up': 150,
      'repair': 300,
      'replacement': 2000
    },
    'plumbing': {
      'maintenance': 120,
      'tune_up': 180,
      'repair': 350,
      'replacement': 1500
    },
    'appliance': {
      'maintenance': 80,
      'tune_up': 120,
      'repair': 250,
      'replacement': 1200
    },
    'security': {
      'maintenance': 75,
      'tune_up': 100,
      'repair': 200,
      'replacement': 800
    },
    'smart_device': {
      'installation': 200,
      'maintenance': 50,
      'repair': 100,
      'replacement': 300
    }
  }

  return costMatrix[equipmentType]?.[serviceType] || 150
}