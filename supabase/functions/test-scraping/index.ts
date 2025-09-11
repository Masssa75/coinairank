import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

// Constants
const SCRAPERAPI_KEY = Deno.env.get('SCRAPERAPI_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

// Function to scrape website using ScraperAPI
async function scrapeWebsite(url: string) {
  try {
    console.log(`🕷️ Scraping website: ${url}`);
    
    if (!SCRAPERAPI_KEY) {
      throw new Error('SCRAPERAPI_KEY not configured');
    }
    
    const scraperUrl = `http://api.scraperapi.com/?api_key=${SCRAPERAPI_KEY}&url=${encodeURIComponent(url)}`;
    const startTime = Date.now();
    
    const scraperResponse = await fetch(scraperUrl, {
      signal: AbortSignal.timeout(120000) // 2 minute timeout for complex sites
    });

    const endTime = Date.now();
    const scrapingDuration = endTime - startTime;

    if (!scraperResponse.ok) {
      const errorText = await scraperResponse.text();
      return { 
        html: '', 
        status: 'error', 
        reason: `ScraperAPI failed: ${scraperResponse.status} - ${errorText}`,
        scrapingDuration
      };
    }

    const html = await scraperResponse.text();
    console.log(`✅ Scraping successful: ${html.length} chars in ${scrapingDuration}ms`);
    
    // Log response headers for cache analysis
    const headers: Record<string, string> = {};
    scraperResponse.headers.forEach((value, key) => {
      headers[key] = value;
    });
    console.log(`📋 Response headers:`, headers);
    
    return { 
      html, 
      status: 'success', 
      scrapingDuration,
      htmlLength: html.length,
      responseHeaders: headers
    };
  } catch (error) {
    console.error(`❌ Scraping error: ${error}`);
    return { 
      html: '', 
      status: 'error', 
      reason: `Scraping failed: ${error}`,
      scrapingDuration: 0
    };
  }
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { websiteUrl, symbol } = await req.json();

    if (!websiteUrl || !symbol) {
      throw new Error('Missing required parameters: websiteUrl and symbol');
    }

    console.log(`🧪 TEST SCRAPING: ${symbol} - ${websiteUrl}`);

    // Step 1: Scrape website
    const scrapeResult = await scrapeWebsite(websiteUrl);
    
    // Step 2: Store results in test table
    const testRecord = {
      symbol: symbol,
      website_url: websiteUrl,
      scraped_html_temp: scrapeResult.status === 'success' ? scrapeResult.html : null,
      test_analysis_data: {
        test_type: 'scraping_only',
        scraping_status: scrapeResult.status,
        scraping_duration_ms: scrapeResult.scrapingDuration,
        html_length: scrapeResult.htmlLength || 0,
        error_reason: scrapeResult.reason || null,
        response_headers: scrapeResult.responseHeaders || null,
        tested_at: new Date().toISOString()
      },
      created_at: new Date().toISOString()
    };

    const { data: insertData, error: insertError } = await supabase
      .from('crypto_projects_test')
      .insert(testRecord)
      .select();

    if (insertError) {
      console.error(`Failed to store test results: ${insertError.message}`);
    } else {
      console.log(`✅ Test results stored with ID: ${insertData?.[0]?.id}`);
    }

    // Return scraping test results
    const responseData = {
      success: scrapeResult.status === 'success',
      test_type: 'scraping_only',
      symbol,
      websiteUrl,
      scraping_status: scrapeResult.status,
      scraping_duration_ms: scrapeResult.scrapingDuration,
      html_length: scrapeResult.htmlLength || 0,
      error_reason: scrapeResult.reason || null,
      database_storage: {
        attempted: true,
        success: !insertError,
        error: insertError?.message || null,
        record_id: insertData?.[0]?.id || null
      }
    };
    
    return new Response(
      JSON.stringify(responseData),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
    
  } catch (error) {
    console.error('Error in test-scraping:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        test_type: 'scraping_only',
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});