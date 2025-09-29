import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept',
};

async function processWithSSE(
  symbol: string,
  sendEvent: (event: string, data: any) => Promise<void>
) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  await sendEvent('starting', {
    message: `Starting fundamental whitepaper analysis for ${symbol}...`
  });

  // Get project data
  const { data: project, error: projectError } = await supabase
    .from('crypto_projects_rated')
    .select('id, symbol, whitepaper_content, whitepaper_url')
    .eq('symbol', symbol)
    .single();

  if (projectError || !project || !project.whitepaper_content) {
    throw new Error(`No whitepaper content found for ${symbol}`);
  }

  await sendEvent('content_loaded', {
    message: `Whitepaper content loaded: ${project.whitepaper_content.length} characters`,
    contentLength: project.whitepaper_content.length
  });

  let content = project.whitepaper_content;
  const maxLength = 200000;
  if (content.length > maxLength) {
    await sendEvent('truncating', {
      message: `Truncating whitepaper from ${content.length} to ${maxLength} characters`,
      originalLength: content.length,
      truncatedLength: maxLength
    });
    content = content.substring(0, maxLength);
  }

  await sendEvent('ai_analyzing', {
    message: 'Analyzing team capability and project fundamentals...'
  });

  const analysis = await callAI(content);

  await sendEvent('ai_complete', {
    message: 'Analysis complete',
    analysisLength: analysis.length
  });

  // Store the analysis
  const { error: updateError } = await supabase
    .from('crypto_projects_rated')
    .update({
      whitepaper_fundamental_analysis: analysis,
      whitepaper_fundamental_updated_at: new Date().toISOString()
    })
    .eq('id', project.id);

  if (updateError) {
    throw new Error(`Failed to update analysis: ${updateError.message}`);
  }

  await sendEvent('complete', {
    result: {
      symbol,
      fundamental_analysis: analysis,
      analysis_type: 'Team Capability Assessment',
      timestamp: new Date().toISOString()
    }
  });
}

async function callAI(content: string): Promise<string> {
  const moonshotApiKey = Deno.env.get('KIMI_K2_API_KEY') || Deno.env.get('MOONSHOT_API_KEY');
  if (!moonshotApiKey) {
    throw new Error('KIMI_K2_API_KEY not configured');
  }

  // APPROACH A: Pure Storytelling - Let AI determine what matters
  const systemPromptA = 'You are an insightful analyst who reads between the lines to understand what really matters about a project and its team.';

  const userPromptA = `Read this whitepaper and tell me its story - the essential narrative that reveals whether this project and team have real value.

Don't follow a template. Instead, identify what's actually important about THIS specific project and tell me only what I need to know to judge its potential.

Some whitepapers reveal team brilliance, others show market timing, some expose fatal flaws, many say nothing meaningful at all. Figure out what matters here and tell that story clearly.

Whitepaper content:
${content}`;

  // APPROACH B: Value Discovery - Focus on finding value signals
  const systemPromptB = 'You are a venture capitalist\'s top analyst, skilled at quickly identifying what has value and what doesn\'t in crypto projects.';

  const userPromptB = `I need to know if there's anything of value in this whitepaper - anything that suggests this team might build something significant.

Read it and tell me the real story: What are they actually trying to do? Who appears to be behind it? What suggests they might succeed or fail? What am I really looking at here?

Be direct and honest. If it's garbage, say so. If there's a gem hidden in there, highlight it. Tell me what I need to know, nothing more.

Whitepaper content:
${content}`;

  // APPROACH C: Adaptive Narrative - Smart context-aware storytelling
  const systemPromptC = 'You are a sharp-eyed crypto analyst who adapts your analysis to what each project actually needs to be understood.';

  const userPromptC = `Read this whitepaper and figure out what kind of project this is, then tell me the story that matters for THIS type of project.

For a meme coin, I need to know about community and viral potential.
For infrastructure, I need to know about technical credibility and adoption path.
For DeFi, I need to know about economic design and security.
For an AI project, I need to know about the team's credentials and data advantage.

Identify what this is, then tell me only the essential story that helps me judge if this specific project has real value. Skip everything that doesn't matter for this type of project.

Whitepaper content:
${content}`;

  // For now, using APPROACH A as default - will test all three
  const systemPrompt = systemPromptA;
  const userPrompt = userPromptA;

  const response = await fetch('https://api.moonshot.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${moonshotApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'kimi-k2-0905-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 4000
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI API error:', errorText);
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.choices || data.choices.length === 0) {
    throw new Error('No response from AI');
  }

  return data.choices[0].message.content;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { symbol } = await req.json();

    if (!symbol) {
      throw new Error('Symbol is required');
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = async (event: string, data: any) => {
          const chunk = encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
          controller.enqueue(chunk);
        };

        try {
          await processWithSSE(symbol, sendEvent);
        } catch (error) {
          console.error('Processing error:', error);
          await sendEvent('error', {
            message: error.message || 'Processing failed'
          });
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Request error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});