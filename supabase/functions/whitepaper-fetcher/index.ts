import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractText, getDocumentProxy } from 'https://esm.sh/unpdf@0.11.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple HTML to text parser
function parseHtmlToText(html: string): string {
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/\s+/g, ' ');
  return text.trim();
}

// Main fetch function - tries to get content from URL
async function fetchWhitepaperContent(url: string): Promise<{
  content: string;
  method: 'pdf' | 'html' | 'browserless';
  originalLength: number;
}> {
  console.log(`Fetching from: ${url}`);

  // Try direct fetch first
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WhitepaperFetcher/1.0)'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';

    // First, get the response as arrayBuffer to check for PDF magic bytes
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Check for PDF magic bytes (%PDF)
    const isPDF = (
      url.endsWith('.pdf') ||
      contentType.includes('pdf') ||
      (bytes.length > 4 &&
       bytes[0] === 0x25 && bytes[1] === 0x50 &&
       bytes[2] === 0x44 && bytes[3] === 0x46) // %PDF in hex
    );

    // Log detection result
    console.log(`Content-Type: ${contentType}`);
    console.log(`First 10 bytes: ${Array.from(bytes.slice(0, 10)).map(b => b.toString(16)).join(' ')}`);
    console.log(`Is PDF: ${isPDF}`);

    if (isPDF) {
      console.log('PDF detected (URL/content-type/magic bytes), extracting text...');
      try {
        const pdf = await getDocumentProxy(bytes);
        const extractResult = await extractText(pdf, { mergePages: true });

        return {
          content: extractResult.text,
          method: 'pdf',
          originalLength: buffer.byteLength
        };
      } catch (pdfError) {
        console.error('PDF extraction failed:', pdfError);
        // Fall back to treating as text if PDF parsing fails
        const textContent = new TextDecoder().decode(bytes);
        const parsedText = parseHtmlToText(textContent);
        return {
          content: parsedText,
          method: 'html',
          originalLength: buffer.byteLength
        };
      }
    }

    // Handle HTML/text content
    const htmlContent = new TextDecoder().decode(bytes);
    const parsedText = parseHtmlToText(htmlContent);

    return {
      content: parsedText,
      method: 'html',
      originalLength: htmlContent.length
    };

  } catch (error) {
    console.error('Direct fetch failed:', error);
    throw error;
  }
}

// AI validation - is this a full whitepaper?
async function validateWhitepaperContent(content: string, url: string): Promise<{
  isComplete: boolean;
  reason: string;
  suggestions?: Array<{
    action: 'use_browserless' | 'try_url' | 'extract_link' | 'search_pattern';
    description: string;
    url?: string;
    selector?: string;
  }>;
}> {
  // Quick heuristic check
  if (content.length > 5000 && !content.startsWith('Failed to fetch')) {
    return {
      isComplete: true,
      reason: 'Content appears complete (>5000 chars of text)'
    };
  }

  // For fetch errors or very short content, always use AI to suggest alternatives
  if (content.startsWith('Failed to fetch') || content.length < 100) {
    // Skip heuristics, go to AI for suggestions
  }

  // Ask AI for validation
  try {
    const apiKey = Deno.env.get('MOONSHOT_API_KEY');
    if (!apiKey) {
      console.warn('No API key for validation, using heuristics');
      return {
        isComplete: content.length > 1000,
        reason: `Content length: ${content.length} chars`
      };
    }

    const prompt = `Analyze this whitepaper fetch result and suggest how to extract the full content.

Content length: ${content.length} chars
URL: ${url}
First 500 chars: ${content.substring(0, 500)}

If this is NOT a complete whitepaper (< 5000 chars or error), provide multiple suggestions to find/extract it.
Look for clues like "Download PDF", iframe embeds, Google Drive links, GitHub repos, etc.

For common projects:
- Ronin: Often has Google Drive embeds, try browserless or look for iframe src
- Ethereum: Has full HTML content on their site
- Bitcoin: Direct PDF at bitcoin.org/bitcoin.pdf

Return JSON:
{
  "isComplete": true/false,
  "reason": "why this is/isn't complete",
  "suggestions": [
    {
      "action": "use_browserless"|"try_url"|"extract_link"|"search_pattern",
      "description": "what this will do",
      "url": "URL if action is try_url",
      "selector": "CSS selector if looking for specific element"
    }
  ]
}

Always provide 2-3 different suggestions when content is incomplete.
Examples:
- {"action": "use_browserless", "description": "Render JavaScript to load PDF embed"}
- {"action": "try_url", "description": "Try direct PDF link", "url": "https://example.com/whitepaper.pdf"}
- {"action": "extract_link", "description": "Look for Google Drive iframe", "selector": "iframe[src*='drive.google']"}
- {"action": "search_pattern", "description": "Try common whitepaper URLs"}`;

    const response = await fetch('https://api.moonshot.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'moonshot-v1-8k',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 300
      })
    });

    if (response.ok) {
      const data = await response.json();
      const aiResponse = data.choices[0].message.content;
      console.log('AI raw response:', aiResponse);
      const result = JSON.parse(aiResponse.replace(/```json\n?|```/g, ''));
      console.log('AI parsed result:', result);
      return result;
    }
  } catch (error) {
    console.error('AI validation error:', error);
  }

  // Fallback
  return {
    isComplete: content.length > 1000,
    reason: `Content length: ${content.length} chars (heuristic)`,
    suggestions: content.length < 1000 ? [
      { action: 'use_browserless', description: 'Try browser rendering' },
      { action: 'search_pattern', description: 'Search for common whitepaper URLs' }
    ] : undefined
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol, whitepaperUrl, projectId } = await req.json();

    if (!whitepaperUrl) {
      throw new Error('whitepaperUrl is required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`\n=== Whitepaper Fetcher ===`);
    console.log(`Symbol: ${symbol || 'N/A'}`);
    console.log(`URL: ${whitepaperUrl}`);

    // Step 1: Try to fetch content
    let fetchResult;
    let fetchError = null;

    try {
      fetchResult = await fetchWhitepaperContent(whitepaperUrl);
      console.log(`Fetched ${fetchResult.content.length} chars via ${fetchResult.method}`);
    } catch (error) {
      console.error(`Initial fetch failed: ${error.message}`);
      fetchError = error.message;
      // Create a minimal result for AI to analyze
      fetchResult = {
        content: `Failed to fetch from ${whitepaperUrl}: ${error.message}`,
        method: 'html' as const,
        originalLength: 0
      };
    }

    // Step 2: Validate - even if fetch failed, AI might suggest alternatives
    console.log('\n=== STEP 2: AI VALIDATION ===');
    console.log(`📊 Content to validate: ${fetchResult.content.length} characters`);
    console.log(`🔍 Content preview (first 300 chars): ${fetchResult.content.substring(0, 300)}...`);

    let validation = await validateWhitepaperContent(fetchResult.content, whitepaperUrl);

    console.log(`🤖 AI Decision: ${validation.isComplete ? '✅ COMPLETE' : '❌ INCOMPLETE'}`);
    console.log(`📝 AI Reason: ${validation.reason}`);
    console.log(`💡 AI Suggestions: ${validation.suggestions?.length || 0} suggestions provided`);
    if (validation.suggestions && validation.suggestions.length > 0) {
      validation.suggestions.forEach((suggestion, i) => {
        console.log(`   ${i+1}. Action: ${suggestion.action}`);
        console.log(`      Description: ${suggestion.description}`);
        if (suggestion.url) console.log(`      URL: ${suggestion.url}`);
      });
    }

    // Step 3: If not complete, try AI suggestions
    if (!validation.isComplete && validation.suggestions && validation.suggestions.length > 0) {
      console.log('\n=== STEP 3: EXECUTING AI SUGGESTIONS ===');
      console.log(`🚀 Content incomplete. Trying ${validation.suggestions.length} suggestions...`);

      for (const suggestion of validation.suggestions) {
        console.log(`\n🔄 TRYING SUGGESTION: ${suggestion.description}`);
        console.log(`🎯 Action: ${suggestion.action}`);

        if (suggestion.action === 'use_browserless') {
          const apiKey = Deno.env.get('BROWSERLESS_API_KEY');
          if (apiKey) {
            try {
              console.log('🌐 Connecting to Browserless.io...');

              const browserlessUrl = `https://production-sfo.browserless.io/content?token=${apiKey}`;

              const browserResponse = await fetch(browserlessUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  url: suggestion.url || whitepaperUrl,
                  waitForSelector: {
                    selector: suggestion.selector || 'body',
                    timeout: 30000
                  },
                  waitForTimeout: 3000  // Wait 3 seconds after selector for dynamic content
                }),
                signal: AbortSignal.timeout(60000) // 60 second timeout for the fetch itself
              });

              if (!browserResponse.ok) {
                const errorText = await browserResponse.text();
                console.error(`Browserless response: ${errorText}`);
                throw new Error(`Browserless API error: ${browserResponse.status} ${browserResponse.statusText}`);
              }

              const html = await browserResponse.text();
              const parsedContent = parseHtmlToText(html);
              console.log(`✅ Browserless fetch successful: ${html.length} chars, parsed to ${parsedContent.length} chars`);

              if (parsedContent.length > fetchResult.content.length) {
                fetchResult = {
                  content: parsedContent,
                  method: 'browserless',
                  originalLength: html.length
                };

                // Re-validate to see if we have enough now
                validation = await validateWhitepaperContent(parsedContent, whitepaperUrl);
                if (validation.isComplete) {
                  console.log('✅ Success! Browser rendering got complete whitepaper');
                  break;
                }
              }
            } catch (error) {
              console.error(`❌ Browserless fetch failed: ${error.message}`);
            }
          } else {
            console.log('❌ BROWSERLESS_API_KEY not configured');
          }

        } else if (suggestion.action === 'try_url' && suggestion.url) {
          try {
            const newResult = await fetchWhitepaperContent(suggestion.url);
            console.log(`Fetched ${newResult.content.length} chars from ${suggestion.url}`);

            if (newResult.content.length > fetchResult.content.length) {
              fetchResult = newResult;
              validation = await validateWhitepaperContent(newResult.content, suggestion.url);

              if (validation.isComplete) {
                console.log('Success! Alternative URL has complete whitepaper');
                break;
              }
            }
          } catch (error) {
            console.error(`Failed to fetch ${suggestion.url}:`, error);
          }

        } else if (suggestion.action === 'search_pattern') {
          // Try common whitepaper URL patterns
          const patterns = [
            '/whitepaper.pdf',
            '/wp.pdf',
            '/docs/whitepaper.pdf',
            '/assets/whitepaper.pdf',
            '/static/whitepaper.pdf'
          ];

          const baseUrl = new URL(whitepaperUrl).origin;
          for (const pattern of patterns) {
            const testUrl = baseUrl + pattern;
            console.log(`Trying pattern: ${testUrl}`);

            try {
              const testResult = await fetchWhitepaperContent(testUrl);
              if (testResult.content.length > fetchResult.content.length) {
                fetchResult = testResult;
                validation = await validateWhitepaperContent(testResult.content, testUrl);

                if (validation.isComplete) {
                  console.log(`Success! Found whitepaper at ${testUrl}`);
                  break;
                }
              }
            } catch (error) {
              // Silent fail, try next pattern
            }
          }
        }

        // If we found a complete whitepaper, stop trying
        if (validation.isComplete) {
          break;
        }
      }
    }

    // Step 4: Store in database if we have a projectId
    console.log('\n=== STEP 4: DATABASE STORAGE ===');
    console.log(`📊 Final content length: ${fetchResult.content.length} characters`);
    console.log(`📊 Method used: ${fetchResult.method}`);
    console.log(`✅ Final status: ${validation.isComplete ? 'COMPLETE' : 'INCOMPLETE'}`);
    console.log(`🆔 Project ID: ${projectId || 'NONE'}`);

    if (projectId && fetchResult.content.length > 100) {
      const contentToStore = fetchResult.content.substring(0, 240000);
      console.log(`💾 Storing ${contentToStore.length} characters to database...`);
      console.log(`🔍 Content preview being stored: ${contentToStore.substring(0, 200)}...`);

      const { error } = await supabase
        .from('crypto_projects_rated')
        .update({
          whitepaper_content: contentToStore,
          whitepaper_extraction_status: validation.isComplete ? 'extracted' : 'partial',
          whitepaper_url: whitepaperUrl
        })
        .eq('id', projectId);

      if (error) {
        console.error('❌ Database storage FAILED:', error);
      } else {
        console.log('✅ Database storage SUCCESSFUL');
        console.log(`📝 Status set to: ${validation.isComplete ? 'extracted' : 'partial'}`);
        console.log(`🔗 URL stored: ${whitepaperUrl}`);
      }
    } else if (!projectId) {
      console.log('⚠️ No project ID provided - skipping database storage');
    } else {
      console.log('⚠️ Content too short (<100 chars) - skipping database storage');
    }

    // Return results
    // If content was successfully stored, trigger whitepaper-analyzer-v2
    let analysisTriggered = false;
    if (projectId && fetchResult.content.length > 100) {
      try {
        console.log(`Triggering whitepaper-analyzer-v2 for ${symbol}`);
        const analyzerUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/whitepaper-analyzer-v2`;
        const analysisResponse = await fetch(analyzerUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectId: projectId,
            symbol: symbol
          })
        });

        if (analysisResponse.ok) {
          console.log(`✅ Whitepaper analysis triggered successfully for ${symbol}`);
          analysisTriggered = true;
        } else {
          console.error(`❌ Failed to trigger whitepaper analysis: ${analysisResponse.status}`);
        }
      } catch (error) {
        console.error('Error triggering whitepaper analysis:', error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        symbol,
        contentLength: fetchResult.content.length,
        method: fetchResult.method,
        isComplete: validation.isComplete,
        reason: validation.reason,
        suggestionsTried: validation.suggestions,
        stored: !!projectId && fetchResult.content.length > 100,
        analysisTriggered: analysisTriggered,
        content: fetchResult.content.substring(0, 500) // Preview
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