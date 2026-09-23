import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, payload } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

    if (!ANTHROPIC_API_KEY) {
      throw new Error("Missing ANTHROPIC_API_KEY");
    }

    if (action === 'generate-text') {
      // Used by FlipPricer and Generate Tab
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1500,
          messages: [{ role: "user", content: payload.prompt }],
        }),
      });

      const data = await response.json();
      if (!response.ok) {
         throw new Error(data.error?.message || `Anthropic error: ${response.status}`);
      }
      return new Response(JSON.stringify({ success: true, text: data.content[0].text }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'analyze-image') {
      // Used by Visual V3 Tab
      // payload expects { imageBase64: "...", mimeType: "image/jpeg" }
      const prompt = `You are a high-level antique and resale appraiser. Analyze this image. 
Identify the exact item. 
Return your response ONLY as a JSON object with these keys: 
"title" (a concise 60-char listing title),
"category" (e.g. vinyl, trading_card, clothing, electronics), 
"brand" (the maker), 
"model" (specific version/edition),
"condition_notes" (any visible wear).`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1000,
          system: "You are a JSON-only API. Do not wrap output in markdown.",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: payload.mimeType,
                    data: payload.imageBase64,
                  }
                },
                {
                  type: "text",
                  text: prompt
                }
              ]
            }
          ],
        }),
      });

      const data = await response.json();
      if (!response.ok) {
         throw new Error(data.error?.message || `Anthropic error: ${response.status}`);
      }

      let parsedData;
      try {
        const textResp = data.content[0].text.trim();
        // Remove markdown block if present
        const jsonStr = textResp.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        parsedData = JSON.parse(jsonStr);
      } catch (e) {
        throw new Error("Claude did not return valid JSON. " + data.content[0].text);
      }

      // --- Market Truth Protocol (Mock) ---
      // Here we simulate routing to eBay/Discogs based on parsedData.category
      const valuation = {
        averagePrice: Math.floor(Math.random() * 150) + 25,
        confidence: "High",
        source: parsedData.category === 'vinyl' ? 'Discogs API' : 
                parsedData.category === 'trading_card' ? 'TCGPlayer API' : 
                'eBay Sold Comps API',
        recentSales: [
          { date: new Date().toISOString().split('T')[0], price: Math.floor(Math.random() * 150) + 25 }
        ]
      };

      return new Response(JSON.stringify({ 
        success: true, 
        identification: parsedData,
        valuation 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error("Invalid action");

  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
