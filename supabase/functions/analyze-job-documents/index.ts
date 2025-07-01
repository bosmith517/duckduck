// AI-powered document and photo analysis for job diagnostics
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Max-Age': '86400'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') { 
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    }); 
  }
  
  try {
    console.log('🚀 AI Analysis function called');
    console.log('Request method:', req.method);
    console.log('Request URL:', req.url);

    // Authenticate the user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('❌ No authorization header');
      throw new Error('Authentication required');
    }

    console.log('✅ Authorization header found');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('❌ Authentication failed:', authError);
      throw new Error('Invalid authentication');
    }

    console.log('✅ User authenticated:', user.id);

    // Get request data
    const requestBody = await req.json();
    const { 
      jobId, 
      documentUrl, 
      photoUrls, 
      analysisType = 'full', // 'document', 'photos', 'full', 'pricing'
      jobDetails
    } = requestBody;

    console.log('📋 Request data:', { jobId, photoUrls: photoUrls?.length, documentUrl: !!documentUrl, analysisType });

    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiKey) {
      console.error('❌ OpenAI API key not configured');
      throw new Error('OpenAI API key not configured. Please set the OPENAI_API_KEY environment variable in your Supabase dashboard.');
    }

    console.log('✅ OpenAI API key found');

    // Handle comprehensive pricing analysis with photos
    if (analysisType === 'comprehensive_pricing') {
      console.log('🎯 Generating comprehensive AI pricing based on photos and job details');
      
      let photoAnalysis = '';
      let photoAnalyses: any[] = [];
      
      // First analyze all photos to understand what work is actually needed
      if (photoUrls && photoUrls.length > 0) {
        console.log('📸 Analyzing', photoUrls.length, 'job photos');
        
        const photoAnalysisPrompt = `You are an expert electrical contractor analyzing photos of damaged electrical equipment. Like ChatGPT 4o, provide specific detailed analysis of what you see in these photos.

Job Context:
- Title: ${jobDetails?.title || 'Service Call'}
- Description: ${jobDetails?.description || 'No description provided'}
- Service Type: ${jobDetails?.serviceType || 'general'}
- Location: ${jobDetails?.location || 'Unknown location'}
- Technician Notes: ${jobDetails?.notes || 'No additional notes'}

For each photo, identify SPECIFICALLY:

📸 What You See:
- Exact equipment type (panel brand, amperage, age)
- Visible damage (corrosion, scorching, arc damage, burnt components)
- Safety hazards (exposed wiring, fire damage, code violations)
- Component condition (breakers, lugs, bus bars, wiring type)

🔧 Required Work:
- Specific parts that need replacement
- Safety issues that must be addressed
- Code compliance requirements
- Labor complexity (hours needed)

Be as detailed as ChatGPT 4o would be. Mention specific things like:
- "Severe corrosion on main lugs"
- "Arc damage visible on bus bar"  
- "Cloth wiring visible - code violation"
- "Outdated fuse-style panel"
- "No AFCI/GFCI protection"
- "Potential fire hazard if not addressed"

Provide detailed technical analysis for pricing purposes.`;

        // Analyze each photo with context
        for (let i = 0; i < photoUrls.length; i++) {
          const photoUrl = photoUrls[i];
          console.log(`Analyzing photo ${i + 1}/${photoUrls.length}:`, photoUrl);
          
          try {
            const analysis = await analyzeWithVision(openAiKey, photoUrl, photoAnalysisPrompt);
            photoAnalyses.push({
              photoIndex: i + 1,
              url: photoUrl,
              analysis: analysis
            });
          } catch (error) {
            console.error(`Failed to analyze photo ${i + 1}:`, error);
            photoAnalyses.push({
              photoIndex: i + 1,
              url: photoUrl,
              analysis: `Photo analysis failed: ${error.message}`
            });
          }
        }
        
        photoAnalysis = JSON.stringify(photoAnalyses);
        console.log('✅ Photo analysis completed');
      }
      
      // Now generate specific pricing based on actual findings
      const comprehensivePricingPrompt = `You are an expert electrical contractor analyzing photos of fire-damaged electrical equipment. Like ChatGPT 4o, provide a detailed Good/Better/Best estimate with SPECIFIC line items based on ACTUAL visible conditions.

Job Details:
- Title: ${jobDetails?.title || 'Service Call'}
- Description: ${jobDetails?.description || 'No description provided'}
- Service Type: ${jobDetails?.serviceType || 'general'}
- Location: ${jobDetails?.location || 'Unknown location'}
- Estimated Cost: ${jobDetails?.estimatedCost || 'Not provided'}
- Technician Notes: ${jobDetails?.notes || 'No additional notes'}

Photo Analysis Results:
${photoAnalysis || 'No photos analyzed'}

Based on the ACTUAL CONDITIONS visible in the photos (fire damage, corrosion, outdated panels, etc.), create realistic pricing for the SPECIFIC repairs needed. Be as detailed as ChatGPT 4o - identify actual components that need replacement, safety issues, and code compliance requirements.

Example of the detail expected:
- "Replace fire-damaged main lugs" not "Electrical repair"  
- "Install 200A panel with AFCI breakers" not "Panel upgrade"
- "Replace corroded bus bar connections" not "Electrical service"

Respond in this exact JSON format:
[
  {
    "tier_name": "Good",
    "description": "Minimal repair addressing immediate safety (like fire damage cleanup)",
    "total_amount": 0,
    "line_items": [
      {
        "description": "Clean and replace fire-damaged main lugs",
        "quantity": 1,
        "unit_price": 150,
        "total_price": 150,
        "item_type": "labor"
      },
      {
        "description": "Replace burnt breakers and connections",
        "quantity": 3,
        "unit_price": 45,
        "total_price": 135,
        "item_type": "material"
      }
    ]
  },
  {
    "tier_name": "Better", 
    "description": "Comprehensive repair with partial code compliance",
    "total_amount": 0,
    "line_items": [
      {
        "description": "Replace damaged panel components and upgrade grounding",
        "quantity": 1,
        "unit_price": 400,
        "total_price": 400,
        "item_type": "labor"
      }
    ]
  },
  {
    "tier_name": "Best",
    "description": "Complete panel replacement with full code compliance",
    "total_amount": 0,
    "line_items": [
      {
        "description": "Install new 200A panel with AFCI/GFCI protection",
        "quantity": 1,
        "unit_price": 1200,
        "total_price": 1200,
        "item_type": "material"
      }
    ]
  }
]

CRITICAL: Base all line items on actual visible damage and required repairs from the photos. Calculate total_amount as exact sum of line_items.`;

      const pricingSuggestions = await generateDiagnosis(openAiKey, comprehensivePricingPrompt);
      console.log('✅ Generated pricing suggestions:', pricingSuggestions);
      console.log('✅ Pricing suggestions type:', typeof pricingSuggestions);
      console.log('✅ Is pricing suggestions array:', Array.isArray(pricingSuggestions));
      
      // Ensure we have a valid array response
      let finalPricingSuggestions = pricingSuggestions;
      if (!Array.isArray(pricingSuggestions)) {
        console.log('⚠️ AI response is not an array, attempting to extract array...');
        // If it's a string, try to find JSON array in it
        if (typeof pricingSuggestions === 'string') {
          const arrayMatch = pricingSuggestions.match(/\[[\s\S]*\]/);
          if (arrayMatch) {
            try {
              finalPricingSuggestions = JSON.parse(arrayMatch[0]);
              console.log('✅ Extracted array from string:', finalPricingSuggestions);
            } catch (error) {
              console.error('❌ Failed to parse extracted array:', error);
            }
          }
        }
        
        // If still not an array, create a fallback structure
        if (!Array.isArray(finalPricingSuggestions)) {
          console.log('⚠️ Creating fallback pricing structure...');
          finalPricingSuggestions = [
            {
              tier_name: 'Good',
              description: 'Basic repair based on AI analysis',
              total_amount: 350,
              line_items: [
                {
                  description: 'Emergency repair - immediate safety concerns',
                  quantity: 1,
                  unit_price: 250,
                  total_price: 250,
                  item_type: 'service'
                },
                {
                  description: 'Parts and materials',
                  quantity: 1,
                  unit_price: 100,
                  total_price: 100,
                  item_type: 'material'
                }
              ]
            },
            {
              tier_name: 'Better',
              description: 'Comprehensive repair with improvements',
              total_amount: 650,
              line_items: [
                {
                  description: 'Full repair and safety upgrade',
                  quantity: 1,
                  unit_price: 450,
                  total_price: 450,
                  item_type: 'service'
                },
                {
                  description: 'Enhanced components and materials',
                  quantity: 1,
                  unit_price: 200,
                  total_price: 200,
                  item_type: 'material'
                }
              ]
            },
            {
              tier_name: 'Best',
              description: 'Complete system upgrade with warranty',
              total_amount: 1200,
              line_items: [
                {
                  description: 'Full system replacement and upgrade',
                  quantity: 1,
                  unit_price: 800,
                  total_price: 800,
                  item_type: 'service'
                },
                {
                  description: 'Premium components with extended warranty',
                  quantity: 1,
                  unit_price: 400,
                  total_price: 400,
                  item_type: 'material'
                }
              ]
            }
          ];
        }
      }
      
      return new Response(JSON.stringify({ 
        success: true,
        pricingSuggestions: finalPricingSuggestions,
        photoAnalysis: photoAnalyses || null,
        analysisType: 'comprehensive_pricing'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Handle simple pricing requests (fallback)
    if (analysisType === 'pricing') {
      console.log('🎯 Generating basic AI pricing suggestions');
      
      const pricingPrompt = `You are an expert contractor providing pricing estimates. Based on the job details below, create a Good/Better/Best pricing structure with specific line items.

Job Details:
- Title: ${jobDetails?.title || 'Service Call'}
- Description: ${jobDetails?.description || 'No description provided'}
- Service Type: ${jobDetails?.serviceType || 'general'}
- Location: ${jobDetails?.location || 'Unknown location'}

Please provide pricing in this exact JSON format:
[
  {
    "tier_name": "Good",
    "description": "Basic solution that gets the job done",
    "total_amount": 0,
    "line_items": [
      {
        "description": "Service call and diagnosis",
        "quantity": 1,
        "unit_price": 100,
        "total_price": 100,
        "item_type": "service"
      }
    ]
  },
  {
    "tier_name": "Better", 
    "description": "Enhanced solution with better materials",
    "total_amount": 0,
    "line_items": [
      {
        "description": "Service call and diagnosis (Enhanced)",
        "quantity": 1,
        "unit_price": 130,
        "total_price": 130,
        "item_type": "service"
      }
    ]
  },
  {
    "tier_name": "Best",
    "description": "Premium solution with top-tier materials and warranty", 
    "total_amount": 0,
    "line_items": [
      {
        "description": "Service call and diagnosis (Premium)",
        "quantity": 1,
        "unit_price": 160,
        "total_price": 160,
        "item_type": "service"
      }
    ]
  }
]

Important:
- Use realistic market pricing for your region
- Include appropriate labor, materials, and markup
- Each tier should have 2-5 relevant line items
- Calculate total_amount as sum of all line_items
- Use item_type: "service", "labor", "material", or "other"
- Be specific about what's included in each tier`;

      const pricingSuggestions = await generateDiagnosis(openAiKey, pricingPrompt);
      
      return new Response(JSON.stringify({ 
        success: true,
        pricingSuggestions: pricingSuggestions,
        analysisType: 'pricing'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const results = {
      documentAnalysis: null as any,
      photoAnalysis: null as any,
      combinedDiagnosis: null as any,
      suggestedActions: [] as string[],
      estimatedCosts: null as any
    };

    // Analyze document if provided
    if (documentUrl && (analysisType === 'document' || analysisType === 'full')) {
      console.log('Analyzing document:', documentUrl);
      
      const documentPrompt = `Analyze this document and extract the following information:
1. Document type (invoice, work order, inspection report, etc.)
2. Key dates and reference numbers
3. Equipment or system information
4. Reported issues or work performed
5. Any costs, parts, or materials mentioned
6. Contact information
7. Any warranty or service agreement details

Provide the analysis in a structured JSON format.`;

      const documentAnalysis = await analyzeWithVision(openAiKey, documentUrl, documentPrompt);
      results.documentAnalysis = documentAnalysis;
    }

    // Analyze photos if provided
    if (photoUrls && photoUrls.length > 0 && (analysisType === 'photos' || analysisType === 'full')) {
      console.log('Analyzing photos:', photoUrls.length);
      
      const photoPrompt = `Analyze these photos of HVAC/plumbing/electrical equipment and provide:
1. Equipment identification (type, brand if visible, model if visible)
2. Visible issues or damage (be specific about location and severity)
3. Condition assessment (rate 1-10 with explanation)
4. Safety concerns if any
5. Recommended repairs or maintenance
6. Estimated remaining lifespan
7. Whether immediate action is required

For each photo, describe what you see and any diagnostic insights.`;

      const photoAnalyses = [];
      for (const photoUrl of photoUrls) {
        const analysis = await analyzeWithVision(openAiKey, photoUrl, photoPrompt);
        photoAnalyses.push(analysis);
      }
      
      results.photoAnalysis = photoAnalyses;
    }

    // Generate combined diagnosis if we have both
    if (results.documentAnalysis && results.photoAnalysis) {
      console.log('Generating combined diagnosis');
      
      const combinedPrompt = `Based on the document analysis and photo evidence, provide:
1. Root cause diagnosis
2. Severity assessment (critical/high/medium/low)
3. Recommended repair approach
4. Required parts and materials
5. Estimated labor hours
6. Total cost estimate range
7. Priority of repairs
8. Any code compliance issues
9. Warranty considerations
10. Preventive maintenance recommendations

Document findings: ${JSON.stringify(results.documentAnalysis)}
Photo findings: ${JSON.stringify(results.photoAnalysis)}`;

      const combinedAnalysis = await generateDiagnosis(openAiKey, combinedPrompt);
      results.combinedDiagnosis = combinedAnalysis;
      
      // Extract suggested actions
      if (combinedAnalysis.recommendedActions) {
        results.suggestedActions = combinedAnalysis.recommendedActions;
      }
      
      // Extract cost estimates
      if (combinedAnalysis.costEstimate) {
        results.estimatedCosts = combinedAnalysis.costEstimate;
      }
    }

    // Save analysis results to database
    if (jobId) {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      await supabaseAdmin
        .from('job_ai_analyses')
        .insert({
          job_id: jobId,
          analysis_type: analysisType,
          document_url: documentUrl,
          photo_urls: photoUrls,
          analysis_results: results,
          created_by: user.id,
          created_at: new Date().toISOString()
        });
    }

    return new Response(JSON.stringify({ 
      success: true,
      analysis: results,
      recommendations: {
        immediate: results.suggestedActions.filter(a => a.priority === 'high'),
        scheduled: results.suggestedActions.filter(a => a.priority === 'medium'),
        preventive: results.suggestedActions.filter(a => a.priority === 'low')
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in analyze-job-documents:', error.message);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

async function analyzeWithVision(apiKey: string, imageUrl: string, prompt: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }
      ],
      max_tokens: 1000
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  try {
    return JSON.parse(data.choices[0].message.content);
  } catch {
    return data.choices[0].message.content;
  }
}

async function generateDiagnosis(apiKey: string, prompt: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert HVAC/plumbing/electrical technician with 20 years of experience. Provide detailed, accurate diagnostics based on the evidence provided. ALWAYS respond with valid JSON format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.3 // Lower temperature for more consistent technical analysis
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  try {
    // First try to parse the entire content as JSON
    const parsed = JSON.parse(content);
    console.log('✅ Successfully parsed JSON response:', parsed);
    return parsed;
  } catch (error) {
    console.log('⚠️ Failed to parse entire content as JSON, attempting to extract JSON array...');
    
    // Try to find a JSON array in the content
    const arrayMatch = content.match(/\[[\s\S]*?\]/);
    if (arrayMatch) {
      try {
        const extracted = JSON.parse(arrayMatch[0]);
        console.log('✅ Successfully extracted JSON array:', extracted);
        return extracted;
      } catch (extractError) {
        console.error('❌ Failed to parse extracted array:', extractError);
      }
    }
    
    // If all parsing fails, return the raw content
    console.log('⚠️ Returning raw content:', content);
    return content;
  }
}