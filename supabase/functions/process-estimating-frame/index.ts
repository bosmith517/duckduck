// supabase/functions/process-estimating-frame/index.ts
//
// This Edge Function processes video frames from SignalWire for AI vision analysis
// It's called as a webhook when frames are ready for processing
//

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Mock AI detection results for development
const MOCK_DETECTIONS = {
  ROOFING: [
    { type: 'missing_shingles', confidence: 0.85, location: 'north_slope', severity: 'moderate' },
    { type: 'moss_growth', confidence: 0.72, location: 'north_slope', severity: 'minor' },
    { type: 'gutter_damage', confidence: 0.91, location: 'east_side', severity: 'moderate' }
  ],
  PLUMBING: [
    { type: 'corrosion', confidence: 0.88, location: 'main_shutoff', severity: 'moderate' },
    { type: 'leak_stain', confidence: 0.76, location: 'under_sink', severity: 'minor' }
  ],
  HVAC: [
    { type: 'rust', confidence: 0.82, location: 'outdoor_unit', severity: 'minor' },
    { type: 'dirty_filter', confidence: 0.94, location: 'return_vent', severity: 'moderate' }
  ],
  ELECTRICAL: [
    { type: 'outdated_panel', confidence: 0.89, location: 'main_panel', severity: 'major' },
    { type: 'exposed_wire', confidence: 0.95, location: 'basement', severity: 'critical' }
  ]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse webhook payload from SignalWire
    const payload = await req.json()
    console.log('Frame processing webhook received:', payload)

    const {
      room_id,
      frame_id,
      frame_url,
      timestamp,
      participant_id,
      metadata
    } = payload

    if (!room_id || !frame_url) {
      throw new Error('Missing required frame data')
    }

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get the video session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('video_sessions')
      .select('*')
      .eq('room_id', room_id)
      .single()

    if (sessionError || !session) {
      console.error('Session not found:', sessionError)
      throw new Error('Video session not found')
    }

    const trade_type = session.trade_type || metadata?.trade_type

    // In production, this would:
    // 1. Download the frame from frame_url
    // 2. Send to computer vision API (YOLO, Azure Vision, etc.)
    // 3. Get actual detection results
    
    // For now, simulate AI detection
    const detectionDelay = Math.random() * 1000 + 500 // 0.5-1.5 seconds
    await new Promise(resolve => setTimeout(resolve, detectionDelay))

    // Generate mock detection results based on trade type
    const detections = trade_type && MOCK_DETECTIONS[trade_type] 
      ? MOCK_DETECTIONS[trade_type].filter(() => Math.random() > 0.5) // Randomly include detections
      : []

    // Store frame capture record
    const { data: capture, error: captureError } = await supabaseAdmin
      .from('frame_captures')
      .insert({
        session_id: session.id,
        frame_id,
        frame_url,
        timestamp: new Date(timestamp || Date.now()).toISOString(),
        participant_id,
        ai_results: {
          detections,
          processed_at: new Date().toISOString(),
          processing_time_ms: detectionDelay,
          frame_quality: Math.random() > 0.3 ? 'good' : 'poor',
          requires_followup: detections.some(d => d.severity === 'critical' || d.severity === 'major')
        }
      })
      .select()
      .single()

    if (captureError) {
      console.error('Failed to store frame capture:', captureError)
    }

    // If critical issues detected, trigger real-time notification
    const criticalDetections = detections.filter(d => d.severity === 'critical')
    if (criticalDetections.length > 0) {
      // In production, this would send real-time updates via WebSocket
      console.log('Critical issues detected:', criticalDetections)
      
      // Update session with critical findings
      await supabaseAdmin
        .from('video_sessions')
        .update({
          metadata: {
            ...session.metadata,
            has_critical_issues: true,
            last_critical_detection: criticalDetections[0],
            total_detections: (session.metadata?.total_detections || 0) + detections.length
          }
        })
        .eq('id', session.id)
    }

    // Generate AI insights based on detections
    const insights = generateInsights(detections, trade_type)

    // Store insights for the session
    const { error: insightError } = await supabaseAdmin
      .from('vision_insights')
      .insert({
        session_id: session.id,
        frame_capture_id: capture?.id,
        insight_type: 'detection_summary',
        content: insights.summary,
        recommendations: insights.recommendations,
        confidence: insights.overall_confidence,
        created_at: new Date().toISOString()
      })

    if (insightError) {
      console.error('Failed to store insights:', insightError)
    }

    return new Response(JSON.stringify({
      success: true,
      frame_id,
      detections: detections.length,
      insights: insights.summary,
      requires_followup: capture?.ai_results?.requires_followup
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error processing frame:', error)
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to process frame' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

// Generate insights based on detections
function generateInsights(detections: any[], trade_type: string) {
  if (detections.length === 0) {
    return {
      summary: 'No issues detected in this frame',
      recommendations: [],
      overall_confidence: 1.0
    }
  }

  const severityCounts = {
    critical: detections.filter(d => d.severity === 'critical').length,
    major: detections.filter(d => d.severity === 'major').length,
    moderate: detections.filter(d => d.severity === 'moderate').length,
    minor: detections.filter(d => d.severity === 'minor').length
  }

  const avgConfidence = detections.reduce((sum, d) => sum + d.confidence, 0) / detections.length

  const recommendations = []
  
  if (severityCounts.critical > 0) {
    recommendations.push('Immediate attention required for critical issues')
  }
  if (severityCounts.major > 0) {
    recommendations.push('Schedule repair for major issues within 30 days')
  }
  if (severityCounts.moderate > 0) {
    recommendations.push('Plan maintenance for moderate issues within 90 days')
  }

  const summary = `Detected ${detections.length} issue(s): ${severityCounts.critical} critical, ${severityCounts.major} major, ${severityCounts.moderate} moderate, ${severityCounts.minor} minor`

  return {
    summary,
    recommendations,
    overall_confidence: avgConfidence
  }
}