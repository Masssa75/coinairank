import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept',
};

async function processStoryAnalysisWithSSE(
  symbol: string,
  initialProjectId: string | undefined,
  sendEvent: (event: string, data: any) => Promise<void>
) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  await sendEvent('story_starting', {
    message: `Starting story analysis for ${symbol}...`
  });

  // Get project data
  let project = null;
  let currentProjectId = initialProjectId;

  if (currentProjectId) {
    const { data, error } = await supabase
      .from('crypto_projects_rated')
      .select('id, whitepaper_content, whitepaper_story_analysis')
      .eq('id', currentProjectId)
      .single();

    if (data) {
      project = data;
    }
  }

  if (!project) {
    const { data, error } = await supabase
      .from('crypto_projects_rated')
      .select('id, whitepaper_content, whitepaper_story_analysis')
      .eq('symbol', symbol)
      .single();

    if (data) {
      project = data;
      currentProjectId = data.id;
    }
  }

  if (!project || !project.whitepaper_content) {
    throw new Error(`No whitepaper content found for ${symbol}`);
  }

  await sendEvent('story_content_loaded', {
    message: `Whitepaper content loaded: ${project.whitepaper_content.length} characters`,
    contentLength: project.whitepaper_content.length
  });

  let content = project.whitepaper_content;
  // Conservative limit of 200K chars (≈50K tokens)
  const maxLength = 200000;
  if (content.length > maxLength) {
    await sendEvent('story_truncating', {
      message: `Truncating whitepaper from ${content.length} to ${maxLength} characters`,
      originalLength: content.length,
      truncatedLength: maxLength
    });
    content = content.substring(0, maxLength);
  }

  await sendEvent('story_ai_preparing', {
    message: 'Preparing story-based AI analysis...',
    estimatedTokens: Math.round(content.length / 4)
  });

  // System prompt with anti-quip instruction for professional tone
  const systemPrompt = 'Tell the story of this project through comparisons to crypto history. Make complex ideas simple through analogies. Avoid quips and witticisms - maintain a professional tone. Use only the provided document.';

  const userPrompt = `Analyze this whitepaper by telling its story through comparisons.

The Vision Story
What are they trying to build and who has tried before?
(Tell it like a story with comparisons)

The Innovation Story
What's genuinely new here and what projects does it build upon?
(Explain through evolution of ideas)

The Market Story
If this works, what happens to crypto? What projects would it displace?
(Paint the picture through comparisons)

The Team Story
What does this whitepaper reveal about who wrote it?
(Compare writing style and depth to known teams)

The Decentralization Story
How decentralized is this really going to be?
(Compare to other projects' decentralization levels)

The Critical Flaw
What's the main weakness skeptics will point out?
(Compare to similar projects that faced this criticism)

The Risk Story
What could kill this project? What similar projects died this way?
(Tell cautionary tales from history)

The Likely Outcome
Based on all patterns, this will probably end up like...
(Give 2-3 comparable trajectories)

Content Breakdown
Categorize what percentage of the content is dedicated to each area (must add up to 100%):
- Mathematical proofs/formulas
- Performance claims
- Technical architecture
- Marketing language
- Academic citations
- Use cases/applications
- Security analysis
- Team credentials
- Comparisons
- Other

Character Assessment
Evaluate if this project feels LEGITIMATE or QUESTIONABLE and explain why based on the evidence and writing quality.

Red Flags
Identify any concerning issues, inconsistencies, or warning signs in the whitepaper that investors should be aware of.

Simple Description
Provide a clear, simple 1-2 sentence explanation of what this project does that anyone can understand.

Whitepaper content:
${content}`;

  const apiKey = Deno.env.get('MOONSHOT_API_KEY');
  if (!apiKey) {
    throw new Error('MOONSHOT_API_KEY not configured');
  }

  await sendEvent('story_ai_analyzing', {
    message: 'AI analyzing whitepaper content...'
  });

  const aiStartTime = Date.now();
  const aiResponse = await fetch('https://api.moonshot.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'kimi-k2-0905-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 20000
    }),
    signal: AbortSignal.timeout(300000) // 5 minute timeout
  });
  const aiEndTime = Date.now();

  if (!aiResponse.ok) {
    throw new Error(`AI API error: ${aiResponse.status}`);
  }

  const aiData = await aiResponse.json();
  const aiContent = aiData.choices[0].message.content;

  await sendEvent('story_ai_complete', {
    message: `Story analysis complete in ${Math.round((aiEndTime - aiStartTime) / 1000)}s`,
    duration_ms: aiEndTime - aiStartTime,
    tokens: aiData.usage ? {
      input: aiData.usage.prompt_tokens,
      output: aiData.usage.completion_tokens
    } : null
  });

  // Parse the story sections from the AI response
  const storyAnalysis = parseStoryResponse(aiContent);

  await sendEvent('story_saving', {
    message: 'Saving enhanced story analysis results...',
    sections: Object.keys(storyAnalysis).length
  });

  // Update project with story analysis
  const updateData = {
    whitepaper_story_analysis: {
      ...storyAnalysis,
      analysis_version: 'v4-sse',
      created_at: new Date().toISOString()
    }
  };

  const { data: updateResult, error: updateError } = await supabase
    .from('crypto_projects_rated')
    .update(updateData)
    .eq('id', currentProjectId)
    .select();

  if (updateError) {
    console.error(`Failed to update project: ${updateError.message}`);
    throw updateError;
  }

  await sendEvent('story_complete', {
    message: 'Story analysis complete!'
  });

  return {
    success: true,
    symbol,
    story_analysis: storyAnalysis,
    project_id: currentProjectId
  };
}

function parseStoryResponse(content: string) {
  // Parse all story sections + new V2 elements from the AI response
  const sections = {
    vision_story: '',
    innovation_story: '',
    market_story: '',
    team_story: '',
    decentralization_story: '',
    critical_flaw: '',
    risk_story: '',
    likely_outcome: '',
    content_breakdown: '',
    character_assessment: '',
    red_flags: '',
    simple_description: ''
  };

  // Try multiple patterns to be more flexible with AI responses
  const patterns = [
    // Story sections - original patterns
    { key: 'vision_story', pattern: /THE VISION STORY\s*(.*?)(?=THE INNOVATION STORY|Content Breakdown|Character Assessment|$)/s },
    { key: 'innovation_story', pattern: /THE INNOVATION STORY\s*(.*?)(?=THE MARKET STORY|Content Breakdown|Character Assessment|$)/s },
    { key: 'market_story', pattern: /THE MARKET STORY\s*(.*?)(?=THE TEAM STORY|Content Breakdown|Character Assessment|$)/s },
    { key: 'team_story', pattern: /THE TEAM STORY\s*(.*?)(?=THE DECENTRALIZATION STORY|Content Breakdown|Character Assessment|$)/s },
    { key: 'decentralization_story', pattern: /THE DECENTRALIZATION STORY\s*(.*?)(?=THE CRITICAL FLAW|Content Breakdown|Character Assessment|$)/s },
    { key: 'critical_flaw', pattern: /THE CRITICAL FLAW\s*(.*?)(?=THE RISK STORY|Content Breakdown|Character Assessment|$)/s },
    { key: 'risk_story', pattern: /THE RISK STORY\s*(.*?)(?=THE LIKELY OUTCOME|Content Breakdown|Character Assessment|$)/s },
    { key: 'likely_outcome', pattern: /THE LIKELY OUTCOME\s*(.*?)(?=Content Breakdown|Character Assessment|$)/s },

    // Story sections - alternative patterns without "THE"
    { key: 'vision_story', pattern: /VISION STORY\s*(.*?)(?=INNOVATION STORY|Content Breakdown|Character Assessment|$)/s },
    { key: 'innovation_story', pattern: /INNOVATION STORY\s*(.*?)(?=MARKET STORY|Content Breakdown|Character Assessment|$)/s },
    { key: 'market_story', pattern: /MARKET STORY\s*(.*?)(?=TEAM STORY|Content Breakdown|Character Assessment|$)/s },
    { key: 'team_story', pattern: /TEAM STORY\s*(.*?)(?=DECENTRALIZATION STORY|Content Breakdown|Character Assessment|$)/s },
    { key: 'decentralization_story', pattern: /DECENTRALIZATION STORY\s*(.*?)(?=CRITICAL FLAW|Content Breakdown|Character Assessment|$)/s },
    { key: 'critical_flaw', pattern: /CRITICAL FLAW\s*(.*?)(?=RISK STORY|Content Breakdown|Character Assessment|$)/s },
    { key: 'risk_story', pattern: /RISK STORY\s*(.*?)(?=LIKELY OUTCOME|Content Breakdown|Character Assessment|$)/s },
    { key: 'likely_outcome', pattern: /LIKELY OUTCOME\s*(.*?)(?=Content Breakdown|Character Assessment|$)/s },

    // New V2 sections
    { key: 'content_breakdown', pattern: /Content Breakdown\s*(.*?)(?=Character Assessment|Red Flags|Simple Description|$)/s },
    { key: 'character_assessment', pattern: /Character Assessment\s*(.*?)(?=Red Flags|Simple Description|$)/s },
    { key: 'red_flags', pattern: /Red Flags\s*(.*?)(?=Simple Description|$)/s },
    { key: 'simple_description', pattern: /Simple Description\s*(.*?)$/s }
  ];

  for (const { key, pattern } of patterns) {
    if (!sections[key as keyof typeof sections]) { // Only match if not already found
      const match = content.match(pattern);
      if (match && match[1]) {
        sections[key as keyof typeof sections] = match[1].trim();
      }
    }
  }

  // If parsing completely fails, store the raw content for debugging
  const totalContent = Object.values(sections).join('').trim();
  if (totalContent.length === 0) {
    console.log('Parsing failed, storing raw content for debugging');
    sections.vision_story = content; // Store raw content in first section for debugging
  }

  return sections;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check if client wants SSE streaming
    const acceptHeader = req.headers.get('accept') || '';
    const wantsSSE = acceptHeader.includes('text/event-stream');

    const { symbol, projectId: initialProjectId } = await req.json();

    if (!symbol) {
      throw new Error('Symbol is required');
    }

    // If SSE requested, set up streaming
    if (wantsSSE) {
      const encoder = new TextEncoder();
      const stream = new TransformStream();
      const writer = stream.writable.getWriter();

      // Helper to send SSE messages
      const sendEvent = async (event: string, data: any) => {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        await writer.write(encoder.encode(message));
      };

      // Process in background
      (async () => {
        try {
          const result = await processStoryAnalysisWithSSE(symbol, initialProjectId, sendEvent);

          await sendEvent('complete', {
            message: 'Story analysis complete',
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

    // Non-SSE path - return error encouraging SSE usage
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