import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractText, getDocumentProxy } from 'https://esm.sh/unpdf@0.11.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function cleanPdfText(text: string): string {
  // Remove null bytes and other control characters
  let cleaned = text.replace(/\0/g, '');

  // Remove excessive whitespace
  cleaned = cleaned.replace(/\s+/g, ' ');

  // Remove page numbers and headers/footers patterns
  cleaned = cleaned.replace(/Page \d+ of \d+/gi, '');
  cleaned = cleaned.replace(/^\d+$/gm, '');

  // Trim
  cleaned = cleaned.trim();

  return cleaned;
}

function parseHtmlToText(html: string): string {
  // Remove script and style elements
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, '');

  // Remove HTML tags but keep content
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");

  // Remove extra whitespace
  text = text.replace(/\s+/g, ' ');

  // Trim
  text = text.trim();

  return text;
}

async function fetchAndParseWhitepaper(url: string): Promise<string> {
  console.log(`Fetching whitepaper from: ${url}`);

  // Handle PDF whitepapers
  if (url.endsWith('.pdf')) {
    console.log('PDF whitepaper detected - extracting text...');

    try {
      // Download PDF directly
      console.log('Downloading PDF...');
      const pdfResponse = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; WhitepaperAnalyzer/1.0)'
        }
      });

      if (!pdfResponse.ok) {
        throw new Error(`Failed to download PDF: ${pdfResponse.status}`);
      }

      const pdfBuffer = await pdfResponse.arrayBuffer();
      console.log(`Downloaded PDF: ${pdfBuffer.byteLength / 1024}KB`);

      // Extract text using unpdf
      console.log('Extracting text from PDF...');
      const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer));
      const extractResult = await extractText(pdf, { mergePages: true });
      const text = extractResult.text;

      console.log(`Extracted ${text.length} characters from PDF`);

      const cleanedText = cleanPdfText(text);
      if (cleanedText.length > 100) {
        return cleanedText;
      } else {
        throw new Error('PDF extraction resulted in too little text');
      }

    } catch (error) {
      console.error('PDF extraction failed:', error);

      // Fallback to ScraperAPI if local extraction fails
      const scraperApiKey = Deno.env.get('SCRAPER_API_KEY') || Deno.env.get('SCRAPERAPI_KEY');
      if (scraperApiKey) {
        console.log('Falling back to ScraperAPI...');
        try {
          const scraperUrl = `https://api.scraperapi.com?api_key=${scraperApiKey}&url=${encodeURIComponent(url)}`;
          const response = await fetch(scraperUrl);

          if (response.ok) {
            const pdfData = await response.arrayBuffer();
            const pdf = await getDocumentProxy(new Uint8Array(pdfData));
            const extractResult = await extractText(pdf, { mergePages: true });
            const text = extractResult.text;

            const cleanedText = cleanPdfText(text);
            if (cleanedText.length > 100) {
              return cleanedText;
            }
          }
        } catch (scraperError) {
          console.error('ScraperAPI fallback failed:', scraperError);
        }
      }

      throw new Error(`PDF extraction failed: ${error.message}`);
    }
  }

  // Standard HTML fetch
  try {
    console.log('Using standard fetch for HTML whitepaper...');
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WhitepaperAnalyzer/1.0)'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch whitepaper: ${response.status}`);
    }

    const rawContent = await response.text();
    const cleanText = parseHtmlToText(rawContent);

    console.log(`Extracted ${cleanText.length} characters of clean text`);
    return cleanText;

  } catch (error) {
    console.error('Error fetching whitepaper:', error);
    throw error;
  }
}

// Phase 2: Bottom-up tier comparison using evidence claims (matches website-analyzer-v3 pattern)
async function compareEvidenceWithBenchmarks(evidenceClaims: any[], benchmarks: any[], symbol: string) {
  const COMPARISON_PROMPT = `Evaluate extracted evidence claims using BOTTOM-UP tier assignment.

TIER BENCHMARKS:
${JSON.stringify(benchmarks, null, 2)}

EXTRACTED EVIDENCE CLAIMS:
${JSON.stringify(evidenceClaims, null, 2)}

EVALUATION PROCESS:
1. Start by assuming all evidence claims are Tier 4 (weakest)
2. For each evidence claim, progressively test if it's STRONGER than benchmarks:
   - Stronger than ANY Tier 4 benchmark evidence? → Consider for Tier 3
   - Stronger than ANY Tier 3 benchmark evidence? → Consider for Tier 2
   - Stronger than ANY Tier 2 benchmark evidence? → Consider for Tier 1
3. Project tier = highest tier achieved by ANY evidence claim

COMPARISON CRITERIA:
Consider:
1. Completeness of evidence for the stated claim
2. Presence of mathematical proofs, code, or empirical data
3. Real-world validation (users, volume, etc.)
4. Gaps or missing elements
5. Context and comparisons to similar systems

Return JSON:
{
  "final_tier": 1-4,
  "tier_name": "ALPHA/SOLID/BASIC/TRASH",
  "final_score": 0-100,
  "strongest_evidence": "exact evidence claim that determined tier",
  "evidence_evaluations": [
    {
      "evidence": "evidence claim text",
      "assigned_tier": 1-4,
      "reasoning": "why this tier"
    }
  ],
  "explanation": "2-3 sentences on tier logic"
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
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleanContent);

    console.log(`Phase 2 comparison complete: Tier ${result.final_tier} (${result.tier_name}) - Score ${result.final_score}`);

    return result;
  } catch (error) {
    console.error(`Phase 2 comparison error: ${error}`);
    throw error;
  }
}

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
      whitepaperText,
      forceReanalysis = false
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

      // Load benchmarks from database
      const { data: benchmarks, error: benchmarksError } = await supabase
        .from('whitepaper_tier_benchmarks')
        .select('*')
        .eq('is_active', true)
        .order('tier', { ascending: true });

      if (benchmarksError || !benchmarks || benchmarks.length === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Failed to load benchmarks: ${benchmarksError?.message || 'No benchmarks found'}`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      console.log(`Loaded ${benchmarks.length} benchmarks and ${project.whitepaper_evidence_claims?.length || 0} evidence claims`);

      // Run Phase 2 comparison using AI
      const comparison = await compareEvidenceWithBenchmarks(
        project.whitepaper_evidence_claims || [],
        benchmarks,
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
    console.log(`🚀 Whitepaper Analyzer V2: Starting Phase 1 for ${symbol}`);

    // Initialize timing for metrics

    // Get project data and check status
    let project = null;
    let currentProjectId = initialProjectId; // Use mutable variable for projectId
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

    let whitepaperUrl = initialWhitepaperUrl;
    if (!whitepaperUrl && project?.whitepaper_url) {
      whitepaperUrl = project.whitepaper_url;
    }

    if (!whitepaperUrl) {
      throw new Error('No whitepaper URL found for this project');
    }

    // Check if we already have analysis and not forcing reanalysis
    if (project?.whitepaper_analysis && !forceReanalysis) {
      console.log('Note: Metrics tracking not available for cached results');
      // For cached results, we don't have metrics since we skip processing
      console.log('✅ Using cached whitepaper analysis');

      // Auto-trigger Phase 2
      console.log(`🚀 Auto-triggering Phase 2 for project ${currentProjectId}`);

      try {
        const phase2Response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/whitepaper-analyzer-v2`, {
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
        }
      } catch (error) {
        console.error(`Failed to trigger Phase 2: ${error}`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          phase: 1,
          symbol,
          cached: true,
          analysis: project.whitepaper_analysis,
          evidence_claims: project.whitepaper_evidence_claims,
          message: 'Using cached analysis, Phase 2 triggered'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if PDF extraction is in progress
    if (project?.whitepaper_extraction_status === 'extracting') {
      return new Response(
        JSON.stringify({
          message: 'PDF extraction in progress',
          status: 'extracting',
          retry_after: 30
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize whitepaperText variable
    let whitepaperTextContent = '';

    // If we have extracted content, use it for analysis
    if (project?.whitepaper_content && project?.whitepaper_extraction_status === 'extracted') {
      console.log('Using previously extracted content for analysis');
      whitepaperTextContent = project.whitepaper_content;
    }

    // Track analysis start time
    const startTime = Date.now();

    // Need to fetch and analyze whitepaper
    let content = whitepaperTextContent || whitepaperText || '';

    // Set extraction status to 'extracting' if we need to fetch
    if (!content && whitepaperUrl && currentProjectId) {
      await supabase
        .from('crypto_projects_rated')
        .update({ whitepaper_extraction_status: 'extracting' })
        .eq('id', currentProjectId);

      try {
        console.log(`📄 Fetching whitepaper from: ${whitepaperUrl}`);
        const fetchStart = Date.now();
        try {
          content = await fetchAndParseWhitepaper(whitepaperUrl);
        } catch (fetchError: any) {
          console.error(`❌ Error during fetch/parse: ${fetchError.message}`);
          if (fetchError.message === 'Assignment to constant variable.') {
            console.error('Const assignment error detected in fetchAndParseWhitepaper');
          }
          throw fetchError;
        }
        const fetchEnd = Date.now();
        console.log(`✅ Fetched whitepaper: ${content.length} characters in ${fetchEnd - fetchStart}ms`);

        // Update extraction status to 'extracted' and store content
        await supabase
          .from('crypto_projects_rated')
          .update({
            whitepaper_content: content.substring(0, 50000), // Store first 50k chars like v1
            whitepaper_extraction_status: 'extracted'
          })
          .eq('id', currentProjectId);

      } catch (error) {
        console.error(`❌ Error fetching whitepaper: ${error}`);

        // Set extraction status to 'failed'
        if (currentProjectId) {
          await supabase
            .from('crypto_projects_rated')
            .update({ whitepaper_extraction_status: 'failed' })
            .eq('id', currentProjectId);
        }

        return new Response(
          JSON.stringify({
            success: false,
            error: `Failed to fetch whitepaper: ${error.message}`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
    }

    if (!content) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No whitepaper content or URL provided'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Truncate content if too long (using v1's 30k limit for AI)
    const maxLength = 30000;
    const originalSize = content.length;
    if (content.length > maxLength) {
      console.log(`⚠️ Truncating whitepaper from ${content.length} to ${maxLength} characters`);
      content = content.substring(0, maxLength) + '... [truncated]';
    }

    // Phase 1 AI Analysis - Evidence Claims Extraction
    console.log('🤖 Analyzing whitepaper content with evidence-based approach...');

    // Estimate input tokens (rough estimate: 1 token ≈ 4 characters)
    const estimatedInputTokens = Math.ceil((content.length + 2000) / 4); // content + prompt
    console.log(`📊 Estimated input tokens: ${estimatedInputTokens}`);

    const systemPrompt = `You are an expert blockchain whitepaper analyst. Your specialty is evaluating whether the evidence presented in a whitepaper actually supports the claims being made.`;

    const userPrompt = `I need you to analyze this whitepaper with a critical eye, focusing on whether the evidence actually supports the claims.

Your analysis should identify:

1. The main claim - What is the most ambitious or revolutionary thing this project claims to achieve? Look for specific performance metrics, breakthrough innovations, or revolutionary features.

2. Evidence evaluation - For each major piece of evidence or technical detail they provide to support their main claim, write a comprehensive evaluation that follows this structure:

**Strengths:** Identify the 3 most compelling pieces of evidence they provide and explain why each matters:
   - What evidence they actually present to support their claims
   - Why this evidence is significant (what real problems it addresses, what it proves)
   - How it compares favorably to existing solutions (with specific examples and numbers)

**Areas Needing Development:** Identify the 3 most important gaps or limitations and assess their severity:
   - What crucial information is missing or unclear
   - How significant each limitation is (easily addressable vs fundamental flaw vs development need)
   - Compare to how other projects handle similar challenges (with specific examples)

Frame limitations as "areas needing development" or "questions requiring clarification" rather than fatal flaws, unless the evidence genuinely suggests the project is fundamentally impossible.

Each evidence evaluation should be a complete, detailed statement that gives full context.

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

Focus on being specific and quantitative. Compare to real projects with real numbers.

Whitepaper content:
${content}

Output your analysis as structured JSON with main_claim, evidence_claims array (each with the full evaluation text), red_flags array, content_breakdown object, character_assessment, and simple_description.`;

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
        max_tokens: 4000
      })
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

    let analysis;
    try {
      const cleanContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(cleanContent);
    } catch (e) {
      console.error('Failed to parse AI response:', e);
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

    // Store results in database with new evidence fields + keep old fields for compatibility
    const updateData = {
      whitepaper_url: whitepaperUrl,
      whitepaper_content: content.substring(0, 50000), // Store first 50k chars like v1
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
        const phase2Response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/whitepaper-analyzer-v2`, {
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