import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { extractText, getDocumentProxy } from 'https://esm.sh/unpdf@0.11.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WhitepaperAnalysis {
  content_breakdown: {
    mathematical_proofs: number;
    performance_claims: number;
    technical_architecture: number;
    marketing_language: number;
    academic_citations: number;
    use_cases: number;
    security_analysis: number;
    team_credentials: number;
    comparisons: number;
    other: number;
  };
  other_content_explanation?: string;
  character_assessment: string;
  key_insights: string[];
  red_flags: string[];
  green_flags: string[];
  kimi_verdict: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol, whitepaper_url, force_refresh = false } = await req.json();

    if (!symbol) {
      throw new Error('Symbol parameter is required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get project data and whitepaper URL if not provided
    let wpUrl = whitepaper_url;
    const { data: project, error } = await supabase
      .from('crypto_projects_rated')
      .select('whitepaper_url, whitepaper_content, whitepaper_analysis, whitepaper_extraction_status')
      .eq('symbol', symbol)
      .single();

    if (error) throw error;

    if (!wpUrl) {
      wpUrl = project.whitepaper_url;
    }

    if (!wpUrl) {
      throw new Error('No whitepaper URL found for this project');
    }

    // Check if we already have analysis and not forcing refresh
    if (project.whitepaper_analysis && !force_refresh) {
      return new Response(
        JSON.stringify({
          message: 'Analysis already exists',
          analysis: project.whitepaper_analysis
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if PDF extraction is in progress
    if (project.whitepaper_extraction_status === 'extracting') {
      return new Response(
        JSON.stringify({
          message: 'PDF extraction in progress',
          status: 'extracting',
          retry_after: 30
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If we have extracted content, use it for analysis
    if (project.whitepaper_content && project.whitepaper_extraction_status === 'extracted') {
      console.log('Using previously extracted content for analysis');

      const startTime = Date.now();
      const analysis = await analyzeWithKimiK2(symbol, project.whitepaper_content);
      const duration = Date.now() - startTime;

      const { error: updateError } = await supabase
        .from('crypto_projects_rated')
        .update({
          whitepaper_analysis: analysis,
          whitepaper_analyzed_at: new Date().toISOString(),
          whitepaper_analysis_duration_ms: duration
        })
        .eq('symbol', symbol);

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({
          success: true,
          symbol,
          analysis,
          duration_ms: duration
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Track analysis start time
    const startTime = Date.now();

    // Step 1: Fetch and parse whitepaper to clean text
    console.log(`Fetching whitepaper from: ${wpUrl}`);
    const wpContent = await fetchAndParseWhitepaper(wpUrl);

    // Step 2: Send to AI for complete analysis (including content breakdown)
    const analysis = await analyzeWithKimiK2(symbol, wpContent);

    // Calculate duration
    const duration = Date.now() - startTime;
    console.log(`Analysis completed in ${duration}ms`);

    // Step 3: Store in database
    const { error: updateError } = await supabase
      .from('crypto_projects_rated')
      .update({
        whitepaper_content: wpContent.substring(0, 50000), // Store first 50k chars
        whitepaper_analysis: analysis,
        whitepaper_analyzed_at: new Date().toISOString(),
        whitepaper_analysis_duration_ms: duration
      })
      .eq('symbol', symbol);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        symbol,
        analysis
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in whitepaper-analyzer:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

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
      const { text } = await extractText(pdf, { mergePages: true });

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
            const { text } = await extractText(pdf, { mergePages: true });

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

  // Handle JavaScript-heavy documentation sites
  if (url.includes('gitbook') || url.includes('docs') || url.includes('docusaurus')) {
    const browserlessUrl = Deno.env.get('BROWSERLESS_URL');
    const browserlessToken = Deno.env.get('BROWSERLESS_TOKEN');

    if (browserlessUrl && browserlessToken) {
      try {
        console.log('Using Browserless for JavaScript-rendered site...');

        const response = await fetch(`${browserlessUrl}/content?token=${browserlessToken}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            url: url,
            gotoOptions: {
              waitUntil: 'networkidle2',
              timeout: 30000
            },
            evaluate: `(() => {
              // Remove navigation, headers, footers
              const elementsToRemove = document.querySelectorAll('nav, header, footer, .sidebar, .navigation, .menu');
              elementsToRemove.forEach(el => el.remove());

              // Get main content
              const main = document.querySelector('main, article, .content, .docs-content, [role="main"]');
              return main ? main.innerText : document.body.innerText;
            })()`
          })
        });

        if (response.ok) {
          const content = await response.text();
          console.log(`Browserless extracted ${content.length} chars from JS site`);
          return cleanPdfText(content);
        }
      } catch (error) {
        console.error('Browserless JS rendering failed:', error);
      }
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

async function analyzeWithKimiK2(symbol: string, content: string): Promise<WhitepaperAnalysis> {
  const kimiApiKey = Deno.env.get('KIMI_K2_API_KEY');
  if (!kimiApiKey) {
    console.warn('Kimi K2 API key not configured');
    throw new Error('Kimi K2 API key not configured');
  }

  // Truncate content if too long (Kimi has token limits)
  const maxChars = 30000;
  const truncatedContent = content.length > maxChars
    ? content.substring(0, maxChars) + '... [truncated]'
    : content;

  const prompt = `You are analyzing a cryptocurrency whitepaper for project ${symbol}.

Here is the whitepaper content:

${truncatedContent}

Please analyze this whitepaper and provide a detailed breakdown.

First, categorize what percentage of the content is dedicated to each of these areas (must add up to 100%):
- Mathematical proofs/formulas (theorems, lemmas, formal proofs, mathematical notation)
- Performance claims (TPS, throughput, speed comparisons)
- Technical architecture (consensus, algorithms, system design)
- Marketing language (revolutionary, unprecedented, game-changing)
- Academic citations (references to papers, research)
- Use cases/applications (real-world applications, business cases)
- Security analysis (threat models, attack vectors, security proofs)
- Team credentials (founder backgrounds, advisors, experience)
- Comparisons (to Bitcoin, Ethereum, other projects)
- Other (anything not covered above - SPECIFY what this includes)

For the "Other" category, you MUST explain what type of content this includes.

Then provide:

1. CHARACTER ASSESSMENT: One sentence describing what type of document this really is (e.g., "Academic research paper with formal mathematical rigor" or "Marketing pitch disguised as technical documentation")

2. KEY INSIGHTS: List 2-3 most important technical or business insights

3. RED FLAGS: List any concerning signs (missing proofs, impossible claims, too much marketing, etc.)

4. GREEN FLAGS: List any positive indicators (peer review, mathematical rigor, real innovation, etc.)

5. VERDICT: One sentence - Is this creating genuine value or just noise?

Format your response as JSON with this exact structure:
{
  "content_breakdown": {
    "mathematical_proofs": <number>,
    "performance_claims": <number>,
    "technical_architecture": <number>,
    "marketing_language": <number>,
    "academic_citations": <number>,
    "use_cases": <number>,
    "security_analysis": <number>,
    "team_credentials": <number>,
    "comparisons": <number>,
    "other": <number>
  },
  "other_content_explanation": "<explanation of what 'other' includes>",
  "character_assessment": "<one sentence>",
  "key_insights": ["<insight 1>", "<insight 2>", "<insight 3>"],
  "red_flags": ["<flag 1>", "<flag 2>"],
  "green_flags": ["<flag 1>", "<flag 2>"],
  "kimi_verdict": "<one sentence verdict>"
}`;

  try {
    const response = await fetch('https://api.moonshot.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${kimiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'kimi-k2-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a blockchain technology expert analyzing whitepapers. Always respond with valid JSON in the exact format requested.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Kimi K2 API error:', errorText);
      throw new Error(`Kimi API error: ${response.status}`);
    }

    const result = await response.json();
    const aiResponse = result.choices[0].message.content;

    // Parse JSON response
    try {
      const analysis = JSON.parse(aiResponse);
      return analysis as WhitepaperAnalysis;
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', aiResponse);
      // Try to extract JSON from the response if it's wrapped in text
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as WhitepaperAnalysis;
      }
      throw new Error('Failed to parse AI response');
    }

  } catch (error) {
    console.error('Error calling Kimi K2:', error);
    throw error;
  }
}