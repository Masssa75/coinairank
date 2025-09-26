import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept',
};

// Phase 2: Two-stage comparison using claim ceiling + evidence quality
async function compareWithTwoStageBenchmarks(mainClaim: string, evidenceClaims: any[], claimBenchmarks: any[], evidenceBenchmarks: any[], symbol: string, sendEvent?: (event: string, data: any) => Promise<void>) {
  const COMPARISON_PROMPT = `Evaluate this whitepaper using a TWO-STAGE process: claim ceiling check + evidence quality evaluation.

PROJECT MAIN CLAIM:
${mainClaim}

PROJECT EVIDENCE CLAIMS:
${JSON.stringify(evidenceClaims, null, 2)}

CLAIM BENCHMARKS (for ceiling check):
${JSON.stringify(claimBenchmarks, null, 2)}

EVIDENCE BENCHMARKS (for quality evaluation):
${JSON.stringify(evidenceBenchmarks, null, 2)}

TWO-STAGE EVALUATION PROCESS:

STAGE 1 - CLAIM CEILING CHECK:
Compare the project's main claim against claim benchmarks to determine the MAXIMUM possible tier.
- Look for similar ambition levels, revolutionary scope, technical complexity
- The claim ceiling sets the upper limit of what this project can achieve

STAGE 2 - EVIDENCE QUALITY EVALUATION:
Compare the project's evidence claims against evidence benchmarks to determine ACTUAL tier.
- Evidence must support the main claim with concrete data, proofs, implementations
- Use bottom-up comparison: start weak, progressively test if stronger than benchmark tiers
- Final tier = MIN(claim_ceiling, evidence_quality_tier)

COMPARISON CRITERIA:
- Mathematical proofs and models
- Working code and implementations
- Real-world metrics (users, volume, performance)
- Academic rigor and citations
- Completeness vs gaps in reasoning

Return JSON:
{
  "claim_ceiling": {
    "tier": 1-4,
    "tier_name": "REVOLUTIONARY|SOLID|BASIC|WEAK",
    "explanation": "why main claim can reach this tier",
    "stronger_than": [benchmark symbols clearly weaker],
    "weaker_than": [benchmark symbols clearly stronger]
  },
  "evidence_quality": {
    "tier": 1-4,
    "tier_name": "REVOLUTIONARY|SOLID|BASIC|WEAK",
    "explanation": "why evidence supports this tier",
    "stronger_than": [benchmark symbols with weaker evidence],
    "weaker_than": [benchmark symbols with stronger evidence]
  },
  "final_tier": 1-4,
  "tier_name": "REVOLUTIONARY|SOLID|BASIC|WEAK",
  "final_score": 0-100,
  "strongest_evidence": ["top 2-3 evidence points"],
  "evidence_evaluations": [
    {
      "claim_number": 1,
      "title": "brief title",
      "evaluation": "why this is strong/weak compared to benchmarks"
    }
  ],
  "explanation": "2-3 sentences on why final tier is appropriate"
}`;

  if (sendEvent) {
    await sendEvent('phase2_ai_start', {
      message: 'AI comparing claims against benchmarks...',
      claimBenchmarks: claimBenchmarks.length,
      evidenceBenchmarks: evidenceBenchmarks.length
    });
  }

  const apiKey = Deno.env.get('MOONSHOT_API_KEY');
  if (!apiKey) {
    throw new Error('MOONSHOT_API_KEY not configured');
  }

  const aiResponse = await fetch('https://api.moonshot.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'kimi-k2-0905-preview',
      messages: [
        { role: 'system', content: 'You are an expert at evaluating crypto whitepapers using a two-stage comparison process. Always use bottom-up comparison for evidence evaluation, testing progressively stronger tiers.' },
        { role: 'user', content: COMPARISON_PROMPT }
      ],
      temperature: 0.1,
      max_tokens: 12000
    }),
    signal: AbortSignal.timeout(60000)
  });

  if (!aiResponse.ok) {
    throw new Error(`AI API error: ${aiResponse.status}`);
  }

  const aiData = await aiResponse.json();
  const result = JSON.parse(aiData.choices[0].message.content);

  if (sendEvent) {
    await sendEvent('phase2_ai_complete', {
      message: `Phase 2 complete: ${result.tier_name} (Score: ${result.final_score})`,
      tier_name: result.tier_name,
      final_score: result.final_score
    });
  }

  console.log(`Phase 2 two-stage comparison complete: Claim ceiling ${result.claim_ceiling?.tier_name}, Evidence ${result.evidence_quality?.tier_name}, Final: ${result.tier_name} (Score: ${result.final_score})`);

  return result;
}

async function processWithSSE(
  symbol: string,
  phase: number,
  initialProjectId: string | undefined,
  sendEvent: (event: string, data: any) => Promise<void>
) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Phase 2: Benchmark comparison
  if (phase === 2) {
    await sendEvent('phase2_starting', {
      message: `Starting Phase 2 benchmark comparison for ${symbol}...`
    });

    // Get project data
    const { data: project, error: projectError } = await supabase
      .from('crypto_projects_rated')
      .select('id, symbol, whitepaper_main_claim, whitepaper_evidence_claims')
      .eq('symbol', symbol)
      .single();

    if (projectError || !project) {
      throw new Error(`Project ${symbol} not found or missing whitepaper data`);
    }

    await sendEvent('phase2_loading', {
      message: 'Loading benchmark data...'
    });

    // Load benchmarks
    const { data: claimBenchmarks } = await supabase
      .from('whitepaper_claim_benchmarks')
      .select('*')
      .order('tier', { ascending: false });

    const { data: evidenceBenchmarks } = await supabase
      .from('whitepaper_evidence_benchmarks')
      .select('*')
      .order('tier', { ascending: false });

    await sendEvent('phase2_comparing', {
      message: `Comparing against ${claimBenchmarks?.length || 0} claim and ${evidenceBenchmarks?.length || 0} evidence benchmarks...`,
      benchmarks: {
        claims: claimBenchmarks?.length || 0,
        evidence: evidenceBenchmarks?.length || 0
      }
    });

    // Run comparison
    const comparison = await compareWithTwoStageBenchmarks(
      project.whitepaper_main_claim,
      project.whitepaper_evidence_claims || [],
      claimBenchmarks || [],
      evidenceBenchmarks || [],
      symbol,
      sendEvent
    );

    await sendEvent('phase2_saving', {
      message: 'Saving Phase 2 results...'
    });

    // Update project with Phase 2 results
    const { error: updateError } = await supabase
      .from('crypto_projects_rated')
      .update({
        whitepaper_tier: comparison.tier_name,
        whitepaper_evidence_evaluations: comparison.evidence_evaluations,
        whitepaper_stage1_analysis: {
          benchmark_comparison: {
            final_tier: comparison.final_tier,
            tier_name: comparison.tier_name,
            final_score: comparison.final_score,
            strongest_evidence: comparison.strongest_evidence,
            evidence_evaluations: comparison.evidence_evaluations,
            explanation: comparison.explanation,
            completed_at: new Date().toISOString()
          }
        }
      })
      .eq('id', project.id);

    if (updateError) {
      console.error(`Failed to update Phase 2 results: ${updateError.message}`);
    }

    return {
      success: true,
      phase: 2,
      symbol,
      final_tier: comparison.final_tier,
      tier_name: comparison.tier_name,
      final_score: comparison.final_score,
      strongest_evidence: comparison.strongest_evidence,
      evidence_evaluations: comparison.evidence_evaluations,
      explanation: comparison.explanation
    };
  }

  // PHASE 1: Whitepaper analysis and signal extraction
  await sendEvent('phase1_starting', {
    message: `Starting Phase 1 whitepaper analysis for ${symbol}...`
  });

  // Get project data
  let project = null;
  let currentProjectId = initialProjectId;

  if (currentProjectId) {
    const { data, error } = await supabase
      .from('crypto_projects_rated')
      .select('whitepaper_content, whitepaper_analysis, whitepaper_evidence_claims, whitepaper_extraction_status, whitepaper_url')
      .eq('id', currentProjectId)
      .single();

    if (data) {
      project = data;
    }
  }

  if (!project) {
    const { data, error } = await supabase
      .from('crypto_projects_rated')
      .select('id, whitepaper_content, whitepaper_analysis, whitepaper_evidence_claims, whitepaper_extraction_status, whitepaper_url')
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

  await sendEvent('phase1_content_loaded', {
    message: `Whitepaper content loaded: ${project.whitepaper_content.length} characters`,
    contentLength: project.whitepaper_content.length
  });

  let content = project.whitepaper_content;
  // With 240K token limit, we can handle much larger documents
  // Rough estimate: 1 token ≈ 4 characters, so 240K tokens ≈ 960K characters
  const maxLength = 200000; // Conservative limit of 200K chars (≈50K tokens)
  if (content.length > maxLength) {
    await sendEvent('phase1_truncating', {
      message: `Truncating whitepaper from ${content.length} to ${maxLength} characters`,
      originalLength: content.length,
      truncatedLength: maxLength
    });
    content = content.substring(0, maxLength);
  }

  await sendEvent('phase1_ai_preparing', {
    message: 'Preparing AI analysis with V3 evidence-based approach...',
    estimatedTokens: Math.round(content.length / 4)
  });

  const systemPrompt = 'You are an expert crypto whitepaper analyst. Focus on extracting the main claim and providing detailed evidence evaluation with both factual statements and contextual perspective.';

  const userPrompt = `Analyze this whitepaper and extract:

1. Main claim - The primary value proposition or innovation in ONE clear sentence

2. Top evidence claim - Extract and evaluate the SINGLE most important supporting claim with:

**Strengths:**
   - FACTUAL STATEMENT: What the whitepaper actually shows/proves
   - CONTEXTUAL PERSPECTIVE: Why this matters compared to other projects (e.g., "This puts them in the top X% of projects" or "Unlike 90% of projects that...")

**Areas Needing Development:**
   - FACTUAL STATEMENT: What crucial information is missing or unclear
   - CONTEXTUAL PERSPECTIVE: How significant this limitation is (e.g., "This is a minor gap that most projects share" vs "This is a critical oversight rarely seen in serious projects")

Be specific and quantitative. Compare to real projects with real numbers.

Whitepaper content:
${content}

Output JSON with:
{
  "main_claim": "one sentence",
  "evidence_claims": [
    {
      "title": "brief title",
      "evaluation": "Full evaluation with Strengths (FACTUAL + CONTEXTUAL) and Areas Needing Development (FACTUAL + CONTEXTUAL)"
    }
  ]
}`;

  const apiKey = Deno.env.get('MOONSHOT_API_KEY');
  if (!apiKey) {
    throw new Error('MOONSHOT_API_KEY not configured');
  }

  await sendEvent('phase1_ai_analyzing', {
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
      temperature: 0.1,
      max_tokens: 240000
    }),
    signal: AbortSignal.timeout(300000) // 5 minute timeout
  });
  const aiEndTime = Date.now();

  if (!aiResponse.ok) {
    throw new Error(`AI API error: ${aiResponse.status}`);
  }

  const aiData = await aiResponse.json();
  const aiContent = aiData.choices[0].message.content;

  await sendEvent('phase1_ai_complete', {
    message: `AI analysis complete in ${Math.round((aiEndTime - aiStartTime) / 1000)}s`,
    duration_ms: aiEndTime - aiStartTime,
    tokens: aiData.usage ? {
      input: aiData.usage.prompt_tokens,
      output: aiData.usage.completion_tokens
    } : null
  });

  let analysis;
  try {
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      analysis = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No valid JSON found in response');
    }
  } catch (parseError) {
    console.error('Failed to parse AI response:', parseError);
    throw new Error(`Failed to parse AI response: ${parseError.message}`);
  }

  await sendEvent('phase1_saving', {
    message: 'Saving Phase 1 analysis results...',
    evidenceClaims: analysis.evidence_claims?.length || 0
  });

  // Update project with Phase 1 results (streamlined version)
  const updateData: any = {
    whitepaper_analysis: analysis,
    whitepaper_main_claim: analysis.main_claim,
    whitepaper_evidence_claims: analysis.evidence_claims
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

  await sendEvent('phase1_complete', {
    message: 'Phase 1 complete, auto-triggering Phase 2...'
  });

  // Auto-trigger Phase 2
  try {
    const phase2Result = await processWithSSE(symbol, 2, currentProjectId, sendEvent);

    return {
      success: true,
      phase: 'both',
      symbol,
      phase1: {
        main_claim: analysis.main_claim,
        evidence_claims: analysis.evidence_claims,
        character_assessment: analysis.character_assessment
      },
      phase2: phase2Result
    };
  } catch (phase2Error) {
    console.error('Phase 2 failed:', phase2Error);
    await sendEvent('phase2_failed', {
      message: 'Phase 2 failed but Phase 1 data was saved',
      error: phase2Error.message
    });

    return {
      success: true,
      phase: 1,
      symbol,
      main_claim: analysis.main_claim,
      evidence_claims: analysis.evidence_claims,
      character_assessment: analysis.character_assessment,
      phase2_error: phase2Error.message
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check if client wants SSE streaming
    const acceptHeader = req.headers.get('accept') || '';
    const wantsSSE = acceptHeader.includes('text/event-stream');

    const { symbol, phase = 1, projectId: initialProjectId } = await req.json();

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
          const result = await processWithSSE(symbol, phase, initialProjectId, sendEvent);

          await sendEvent('complete', {
            message: 'Analysis complete',
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

    // Non-SSE path - return regular JSON response
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // For non-SSE, just run the original logic
    // (This would be the full original V3 code, but for brevity, returning error)
    return new Response(
      JSON.stringify({
        error: 'Non-SSE mode not fully implemented in this version. Please use SSE by setting Accept: text/event-stream header.'
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