import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const KIMI_K2_API_KEY = Deno.env.get('KIMI_K2_API_KEY');
    
    if (!KIMI_K2_API_KEY) {
      return new Response(JSON.stringify({
        success: false,
        error: 'KIMI_K2_API_KEY environment variable not found',
        env_keys: Object.keys(Deno.env.toObject()).filter(k => k.includes('KIMI'))
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('🔑 API Key found, testing connection...');
    
    // Simple test call to Kimi K2 API
    const response = await fetch('https://api.moonshot.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIMI_K2_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'kimi-k2-0905-preview',
        messages: [
          {
            role: 'user',
            content: 'Hello, can you respond with just the word "SUCCESS" to test this API connection?'
          }
        ],
        max_tokens: 10,
        temperature: 0.1
      })
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      return new Response(JSON.stringify({
        success: false,
        error: 'API call failed',
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        response: responseText
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data = JSON.parse(responseText);
    
    return new Response(JSON.stringify({
      success: true,
      api_response: data,
      message: 'Kimi K2 API connection successful!'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('🔥 Error testing Kimi API:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});