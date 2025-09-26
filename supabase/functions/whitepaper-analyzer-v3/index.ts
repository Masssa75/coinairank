import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Removed fetching functions - content is now provided by whitepaper-fetcher

// Phase 2: Two-stage comparison using claim ceiling + evidence quality
async function compareWithTwoStageBenchmarks(mainClaim: string, evidenceClaims: any[], claimBenchmarks: any[], evidenceBenchmarks: any[], symbol: string) {
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
    "tier_name": "ALPHA/SOLID/BASIC/TRASH",
    "reasoning": "why this claim ambition deserves this ceiling"
  },
  "evidence_quality": {
    "tier": 1-4,
    "tier_name": "ALPHA/SOLID/BASIC/TRASH",
    "reasoning": "how evidence quality compares to benchmarks"
  },
  "final_tier": 1-4,
  "tier_name": "ALPHA/SOLID/BASIC/TRASH",
  "final_score": 0-100,
  "explanation": "2-3 sentences explaining how claim ceiling and evidence quality determined final tier"
}`;

  try {
    const apiKey = Deno.env.get('KIMI_K2_API_KEY');
    if (!apiKey) {
      throw new Error('KIMI_K2_API_KEY not configured');
    }

    const response = await fetch('https://api.moonshot.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'kimi-k2-0905-preview',
        messages: [{ role: 'user', content: COMPARISON_PROMPT }],
        temperature: 0.3,
        max_tokens: 10000
      }),
      signal: AbortSignal.timeout(180000) // 3 minute timeout
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleanContent);

    console.log(`Phase 2 two-stage comparison complete: Claim ceiling ${result.claim_ceiling?.tier_name}, Evidence ${result.evidence_quality?.tier_name}, Final: ${result.tier_name} (Score: ${result.final_score})`);

    return result;
  } catch (error) {
    console.error(`Phase 2 two-stage comparison error: ${error}`);
    throw error;
  }
}

// Removed adaptive content evaluation - content validation handled by whitepaper-fetcher

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      phase = 1,
      projectId: initialProjectId,
      symbol,
      whitepaperUrl: initialWhitepaperUrl,
      whitepaperText
    } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // PHASE 2: Benchmark comparison and final scoring
    if (phase === 2) {
      if (!initialProjectId) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Phase 2 requires projectId'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      console.log(`📊 Phase 2: Starting benchmark comparison for ${symbol} (Project ID: ${initialProjectId})`);

      // Get project data and evidence claims
      const { data: project, error: fetchError } = await supabase
        .from('crypto_projects_rated')
        .select('whitepaper_evidence_claims')
        .eq('id', initialProjectId)
        .single();

      if (fetchError || !project) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Failed to fetch project: ${fetchError?.message || 'Not found'}`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Load claim and evidence benchmarks from split tables
      const [claimBenchmarksResult, evidenceBenchmarksResult] = await Promise.all([
        supabase
          .from('whitepaper_claim_benchmarks')
          .select('*')
          .eq('is_active', true)
          .order('claim_rank', { ascending: true }),
        supabase
          .from('whitepaper_evidence_benchmarks')
          .select('*')
          .eq('is_active', true)
          .order('evidence_rank', { ascending: true })
      ]);

      const claimBenchmarks = claimBenchmarksResult.data;
      const evidenceBenchmarks = evidenceBenchmarksResult.data;
      const benchmarksError = claimBenchmarksResult.error || evidenceBenchmarksResult.error;

      if (benchmarksError || !claimBenchmarks || !evidenceBenchmarks || claimBenchmarks.length === 0 || evidenceBenchmarks.length === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Failed to load benchmarks: ${benchmarksError?.message || 'Missing claim or evidence benchmarks'}`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      console.log(`Loaded ${claimBenchmarks.length} claim benchmarks, ${evidenceBenchmarks.length} evidence benchmarks, and ${project.whitepaper_evidence_claims?.length || 0} evidence claims`);

      // Run Phase 2 two-stage comparison using AI
      const comparison = await compareWithTwoStageBenchmarks(
        project.whitepaper_main_claim || '',
        project.whitepaper_evidence_claims || [],
        claimBenchmarks,
        evidenceBenchmarks,
        symbol
      );

      // Update database with Phase 2 results using existing v1 field names + new evidence fields
      const { error: updateError } = await supabase
        .from('crypto_projects_rated')
        .update({
          whitepaper_stage1_score: comparison.final_score,
          whitepaper_stage1_tier: comparison.tier_name,
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
        .eq('id', initialProjectId);

      if (updateError) {
        console.error(`Failed to update Phase 2 results: ${updateError.message}`);
      }

      console.log(`✅ Phase 2 completed: ${comparison.tier_name} (Score: ${comparison.final_score})`);

      return new Response(
        JSON.stringify({
          success: true,
          phase: 2,
          symbol,
          final_tier: comparison.final_tier,
          tier_name: comparison.tier_name,
          final_score: comparison.final_score,
          strongest_evidence: comparison.strongest_evidence,
          evidence_evaluations: comparison.evidence_evaluations,
          explanation: comparison.explanation
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PHASE 1: Whitepaper analysis and signal extraction
    console.log(`🚀 Whitepaper Analyzer V3: Starting Phase 1 for ${symbol}`);

    // Initialize timing for metrics

    // Get project data and check status
    let project = null;
    let currentProjectId = initialProjectId;

    if (currentProjectId) {
      const { data, error } = await supabase
        .from('crypto_projects_rated')
        .select('whitepaper_content, whitepaper_analysis, whitepaper_evidence_claims, whitepaper_extraction_status, whitepaper_url')
        .eq('id', currentProjectId)
        .single();

      if (!error) project = data;
    } else if (symbol) {
      const { data, error } = await supabase
        .from('crypto_projects_rated')
        .select('id, whitepaper_content, whitepaper_analysis, whitepaper_evidence_claims, whitepaper_extraction_status, whitepaper_url')
        .eq('symbol', symbol)
        .single();

      if (!error && data) {
        project = data;
        currentProjectId = data.id;
      }
    }

    if (!project || !currentProjectId) {
      throw new Error('Project not found. Please ensure whitepaper content has been fetched first using whitepaper-fetcher.');
    }

    // Removed caching logic - if function is called, analysis should run

    // Validate that we have whitepaper content (should be provided by whitepaper-fetcher)
    if (!project?.whitepaper_content) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No whitepaper content found. Please run whitepaper-fetcher first to extract content.',
          extraction_status: project?.whitepaper_extraction_status || 'not_attempted'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Use stored content from whitepaper-fetcher
    let content = project.whitepaper_content;
    console.log(`📄 Using stored whitepaper content: ${content.length} characters`);
    console.log(`📄 Extraction status: ${project.whitepaper_extraction_status}`);

    // Track analysis start time
    const startTime = Date.now();

    // Truncate content if too long (using v1's 30k limit for AI)
    const maxLength = 30000;
    const originalSize = content.length;
    if (content.length > maxLength) {
      console.log(`⚠️ Truncating whitepaper from ${content.length} to ${maxLength} characters`);
      content = content.substring(0, maxLength) + '... [truncated]';
    }

    // Phase 1 AI Analysis - Evidence Claims Extraction with V3 improvements
    console.log('🤖 Analyzing whitepaper content with V3 evidence-based approach...');

    // Estimate input tokens (rough estimate: 1 token ≈ 4 characters)
    const estimatedInputTokens = Math.ceil((content.length + 2000) / 4); // content + prompt
    console.log(`📊 Estimated input tokens: ${estimatedInputTokens}`);

    const systemPrompt = `You are an expert blockchain whitepaper analyst. Your specialty is evaluating whether the evidence presented in a whitepaper actually supports the claims being made. You provide both factual analysis and crucial contextual perspective to help judge significance in the broader crypto landscape.`;

    const userPrompt = `I need you to analyze this whitepaper with a critical eye, focusing on whether the evidence actually supports the claims. For each evaluation, provide BOTH factual statements AND comparative context.

Your analysis should identify:

1. The main claim - What is the most ambitious or revolutionary thing this project claims to achieve? Look for specific performance metrics, breakthrough innovations, or revolutionary features.

2. Evidence evaluation - For each major piece of evidence or technical detail they provide to support their main claim, write a comprehensive evaluation that follows this structure:

**Strengths:** Identify the 3 most compelling pieces of evidence they provide. For EACH strength, provide:
   - FACTUAL STATEMENT: What evidence they actually present to support their claims (specific numbers, proofs, implementations)
   - CONTEXTUAL PERSPECTIVE: Why this matters compared to other projects (e.g., "This puts them in the top X% of projects" or "Unlike 90% of projects that..." or "This is significant because most projects only...")

**Areas Needing Development:** Identify the 3 most important gaps or limitations. For EACH area, provide:
   - FACTUAL STATEMENT: What crucial information is missing or unclear (specific gaps in reasoning, missing data, unproven claims)
   - CONTEXTUAL PERSPECTIVE: How significant this limitation is compared to the ecosystem (e.g., "This is a minor gap that most projects share" vs "This is a critical oversight rarely seen in serious projects" or "While X% of projects struggle with this...")

Frame limitations as "areas needing development" or "questions requiring clarification" rather than fatal flaws, unless the evidence genuinely suggests the project is fundamentally impossible.

Each evidence evaluation should be a complete, detailed statement that includes both factual observation and comparative context to help judge significance.

3. Red flags - Identify any concerning issues not covered in the evidence evaluations.

4. Content breakdown - Categorize what percentage of the content is dedicated to each area (must add up to 100%):
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

5. Character assessment - Evaluate if this project feels LEGITIMATE or QUESTIONABLE

6. Simple description - A clear, simple 1-2 sentence explanation of what this project does

Focus on being specific and quantitative. Compare to real projects with real numbers. Always provide contextual perspective to help judge the significance of both strengths and weaknesses.

Whitepaper content:
${content}

Output your analysis as structured JSON with main_claim, evidence_claims array (each with the full evaluation text including factual statements and contextual perspective), red_flags array, content_breakdown object, character_assessment, and simple_description.`;

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
        model: 'kimi-k2-0905-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 240000
      }),
      signal: AbortSignal.timeout(180000) // 3 minute timeout
    });
    const aiEndTime = Date.now();
    console.log(`⏱️ AI processing took ${aiEndTime - aiStartTime}ms`);

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices[0].message.content;

    // Extract token usage if available
    if (aiData.usage) {
      console.log(`📊 Token usage - Input: ${aiData.usage.prompt_tokens}, Output: ${aiData.usage.completion_tokens}`);
    }

    // Log the raw AI response for debugging
    console.log(`📝 AI Response length: ${aiContent.length} characters`);
    console.log(`📝 First 1000 chars of AI response: ${aiContent.substring(0, 1000)}`);
    console.log(`📝 Last 500 chars of AI response: ${aiContent.substring(Math.max(0, aiContent.length - 500))}`);

    let analysis;
    try {
      const cleanContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(cleanContent);
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      console.error('Cleaned content that failed to parse:', aiContent.substring(0, 2000));
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to parse AI analysis'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`✅ Extracted evidence claims:
      - Main claim: ${analysis.main_claim?.substring(0, 80)}...
      - Evidence claims: ${analysis.evidence_claims?.length || 0}
      - Red flags: ${analysis.red_flags?.length || 0}`);

    // Calculate total duration
    const totalDuration = Date.now() - startTime;
    console.log(`✅ Analysis completed in ${totalDuration}ms`);

    // Store analysis results in database (content already stored by whitepaper-fetcher)
    const updateData = {
      whitepaper_analysis: analysis,
      whitepaper_simple_description: analysis.simple_description,
      // New evidence-based fields
      whitepaper_main_claim: analysis.main_claim,
      whitepaper_evidence_claims: analysis.evidence_claims,
      // Keep old fields for backward compatibility (Phase 2 will update these)
      whitepaper_stage1_analysis: {
        ...analysis,
        evidence_claims_extracted: analysis.evidence_claims
      },
      whitepaper_red_flags: analysis.red_flags,
      whitepaper_analyzed_at: new Date().toISOString(),
      whitepaper_analysis_duration_ms: totalDuration
    };

    if (currentProjectId) {
      // Update existing record
      const { error: updateError } = await supabase
        .from('crypto_projects_rated')
        .update(updateData)
        .eq('id', currentProjectId);

      if (updateError) {
        console.error(`Database update error: ${updateError.message}`);
      }
    } else {
      // Create new record
      const { data: newProject, error: insertError } = await supabase
        .from('crypto_projects_rated')
        .insert({
          ...updateData,
          symbol,
          contract_address: `pending_${symbol}`,
          network: 'unknown'
        })
        .select()
        .single();

      if (!insertError && newProject) {
        currentProjectId = newProject.id;
      }
    }

    // Auto-trigger Phase 2 if we have a project ID
    if (currentProjectId) {
      console.log(`🚀 Auto-triggering Phase 2 for project ${currentProjectId}`);

      // Small delay to ensure Phase 1 data is committed
      await new Promise(resolve => setTimeout(resolve, 500));

      try {
        const phase2Response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/whitepaper-analyzer-v3`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phase: 2,
            projectId: currentProjectId,
            symbol
          })
        });

        if (!phase2Response.ok) {
          const errorText = await phase2Response.text();
          console.error(`Phase 2 trigger failed: ${errorText}`);
        } else {
          const phase2Result = await phase2Response.json();
          console.log(`✅ Phase 2 triggered successfully: ${phase2Result.tier_name} (${phase2Result.final_score})`);

          return new Response(
            JSON.stringify({
              success: true,
              phase: 1,
              symbol,
              analysis,
              evidence_claims: analysis.evidence_claims,
              content_length: content.length,
              phase2_triggered: true,
              phase2_result: {
                tier: phase2Result.tier_name,
                score: phase2Result.final_score
              }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (error) {
        console.error(`Failed to trigger Phase 2: ${error}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        phase: 1,
        symbol,
        analysis,
        evidence_claims: analysis.evidence_claims,
        content_length: content.length,
        phase2_triggered: false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});