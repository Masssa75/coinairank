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
    message: `Starting C3 pattern recognition analysis for ${symbol}...`
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
    message: 'C3: Conducting pattern recognition analysis of whitepaper...'
  });

  const systemPrompt = 'You are an expert at pattern recognition who can infer author characteristics and project viability from document patterns, structure, and linguistic choices rather than explicit content.';

  const userPrompt = `Based solely on how this whitepaper is written and structured, describe what you can infer about the authors and their likelihood of achieving their stated goals. Include what would be necessary for success.

Analyze patterns in:

**Writing & Communication Patterns:**
- What does the prose style reveal about the authors' background?
- How do they handle complexity - do they oversimplify or overcomplicate?
- What does their use of jargon, analogies, and examples suggest?
- How do they structure arguments - logical progression or scattered thoughts?

**Document Organization & Focus:**
- What gets the most attention and detail vs what's glossed over?
- How do they prioritize different aspects (technical, economic, social)?
- What's the ratio of vision to implementation details?
- How much space is devoted to risks vs opportunities?

**Language Choice & Framing:**
- What metaphors and mental models do they consistently use?
- How do they position themselves relative to existing solutions?
- What assumptions do they make about their readers?
- How do they handle uncertainty - confident assertions vs acknowledging unknowns?

**Success Likelihood Patterns:**
- Based on these writing patterns, what type of execution would you expect?
- What do successful projects with similar communication patterns tend to have?
- What gaps between communication style and stated ambitions do you notice?
- What would need to align for authors with this communication style to succeed?

**Requirements for Success:**
- Given these communication patterns, what capabilities would be essential?
- What type of team structure and processes would they need?
- What external factors would need to align with their approach?
- What are the most likely failure modes based on these patterns?

Focus on what you can infer from HOW they communicate rather than WHAT they claim. Respond in unstructured text - let your pattern recognition insights flow naturally.

Whitepaper content:
${content}`;

  const apiKey = Deno.env.get('MOONSHOT_API_KEY');
  if (!apiKey) {
    throw new Error('MOONSHOT_API_KEY not configured');
  }

  const aiStartTime = Date.now();
  const aiResponse = await fetch('https://api.moonshot.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'moonshot-v1-128k',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.4,
      max_tokens: 4000
    }),
    signal: AbortSignal.timeout(300000)
  });
  const aiEndTime = Date.now();

  if (!aiResponse.ok) {
    throw new Error(`AI API error: ${aiResponse.status}`);
  }

  const aiData = await aiResponse.json();
  const analysisText = aiData.choices[0].message.content;

  await sendEvent('ai_complete', {
    message: `C3 pattern recognition analysis complete in ${Math.round((aiEndTime - aiStartTime) / 1000)}s`,
    duration_ms: aiEndTime - aiStartTime
  });

  await sendEvent('saving', {
    message: 'Saving C3 pattern recognition analysis...'
  });

  // Save to experiments table with unstructured text
  const { error: saveError } = await supabase
    .from('whitepaper_experiments')
    .upsert({
      symbol,
      version: 'c3-patterns',
      analysis_text: analysisText,
      metadata: {
        approach: 'Pattern recognition - communication style and structure analysis',
        model: 'moonshot-v1-128k',
        track: 'C',
        description: 'Infers author characteristics and success likelihood from writing patterns and document structure'
      }
    }, {
      onConflict: 'symbol,version'
    });

  if (saveError) {
    console.error(`Failed to save C3 results: ${saveError.message}`);
    // Don't throw, just log the error
  }

  return {
    success: true,
    version: 'c3-patterns',
    symbol,
    analysis_text: analysisText
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const acceptHeader = req.headers.get('accept') || '';
    const wantsSSE = acceptHeader.includes('text/event-stream');

    const { symbol } = await req.json();

    if (!symbol) {
      throw new Error('Symbol is required');
    }

    if (wantsSSE) {
      const encoder = new TextEncoder();
      const stream = new TransformStream();
      const writer = stream.writable.getWriter();

      const sendEvent = async (event: string, data: any) => {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        await writer.write(encoder.encode(message));
      };

      (async () => {
        try {
          const result = await processWithSSE(symbol, sendEvent);
          await sendEvent('complete', {
            message: 'C3 pattern recognition analysis complete',
            result
          });
        } catch (error) {
          await sendEvent('error', {
            message: error.message || 'An error occurred',
            details: error.toString()
          });
        } finally {
          await writer.close();
        }
      })();

      return new Response(stream.readable, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    return new Response(
      JSON.stringify({
        error: 'Non-SSE mode not implemented. Please use SSE by setting Accept: text/event-stream header.'
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});