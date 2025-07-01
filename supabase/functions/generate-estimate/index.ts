// ─────────────────────────────────────────────────────────────
// Supabase Edge Function  :  generate-estimate
// Gives BOTH chatty Markdown "narrative" AND structured tiers.
// -----------------------------------------------------------------
import { serve } from 'https://deno.land/std@0.202.0/http/server.ts'
import OpenAI from 'https://deno.land/x/openai@v4.26.0/mod.ts'

/* ── ENV ─────────────────────────────────────────────────────*/
const openai        = new OpenAI(Deno.env.get('OPENAI_API_KEY')!)
const ALLOW_ORIGIN  = Deno.env.get('CORS_ORIGIN') ?? '*'
const ALLOW_HEADERS = 'Content-Type, Authorization, apikey, x-client-info'

/* ── Simple price-book (edit to taste) ───────────────────────*/
const PRICE_BOOK: Record<string, number> = {
  service_call      : 130,
  disposal_fee      : 100,
  permit_fee        : 120,

  labor_basic       : 50,
  labor_enhanced    : 75,
  labor_premium     : 100,

  materials_basic   : 200,
  materials_enhanced: 300,
  materials_premium : 400,
}

/* ── Helper: build printable price-book lines ─────────────────*/
const priceBookText = Object.entries(PRICE_BOOK)
  .map(([k, v]) => `- ${k}: $${v}`)
  .join('\n')

/* ── HTTP server ─────────────────────────────────────────────*/
serve(async (req) => {
  /* handle CORS pre-flight */
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin' : ALLOW_ORIGIN,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': ALLOW_HEADERS,
        'Access-Control-Max-Age'      : '86400',
      },
    })
  }

  try {
    const { jobDetails = {}, photoUrls = [] } = await req.json()

    /* ── Prompt to GPT ───────────────────────────────────────*/
    const prompt = `
Homeowner description: "${jobDetails.description ?? 'n/a'}"
Location: ${jobDetails.location ?? 'n/a'}
Service type: ${jobDetails.serviceType ?? 'n/a'}
Notes: ${jobDetails.notes ?? 'n/a'}

### Price-book (use these unit prices when possible)
${priceBookText}

### Task
1. Write a friendly Markdown overview for the homeowner / adjuster:
   • What we see in the photos  
   • Risks of leaving it as-is  
   • Explanation of Good / Better / Best choices with pros & cons.

2. Produce detailed line-items for three tiers:
   Good  – minimal safe repair  
   Better – enhanced repair + partial upgrades  
   Best  – comprehensive solution & code compliance  

Object keys:
{
  "narrative": "<markdown here>",
  "tiers": [
    { "tier_name": "Good",   "description": "...", "total_amount": 0,
      "line_items":[ { "description":"", "quantity":0, "unit_price":0,
                       "total_price":0, "item_type":"labor|material|service" } ] },
    { "tier_name": "Better", ... },
    { "tier_name": "Best",   ... }
  ]
}

Return **ONLY** that JSON object – no fences, no extra keys.
`.trim()

    /* ── Build messages, attach up to 5 photos ──────────────*/
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role   : 'system',
        content: `You are a licensed professional ${jobDetails.serviceType || 'contractor'} creating Good / Better / Best estimates.`,
      },
      { role: 'user', content: prompt },
    ]

    photoUrls.slice(0, 5).forEach((url) => {
      messages.push({
        role: 'user',
        content: [
          { type: 'text',      text: `Photo ${url}` },
          { type: 'image_url', image_url: { url } },
        ],
      })
    })

    /* ── Call GPT-4o with forced JSON output ────────────────*/
    const completion = await openai.chat.completions.create({
      model          : 'gpt-4o',
      temperature    : 0.3,
      max_tokens     : 1500,
      messages,
      response_format: { type: 'json_object' },   // ← guarantees valid JSON
    })

    const raw     = completion.choices[0].message.content ?? '{}'
    const parsed  = JSON.parse(raw) as { narrative: string; tiers: any[] }
    const { narrative, tiers } = parsed

    /* ── Success response ───────────────────────────────────*/
    return new Response(
      JSON.stringify({ narrative, pricingSuggestions: tiers }),
      {
        headers: {
          'Access-Control-Allow-Origin' : ALLOW_ORIGIN,
          'Access-Control-Allow-Headers': ALLOW_HEADERS,
          'Content-Type'               : 'application/json',
        },
      },
    )
  } catch (err) {
    console.error('generate-estimate error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status : 500,
        headers: {
          'Access-Control-Allow-Origin' : ALLOW_ORIGIN,
          'Access-Control-Allow-Headers': ALLOW_HEADERS,
        },
      },
    )
  }
})
