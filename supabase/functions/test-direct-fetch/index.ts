import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

// Constants
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

// Function to scrape website using direct fetch()
async function directFetchWebsite(url: string) {
  try {
    console.log(`🌐 Direct fetch: ${url}`);
    
    const startTime = Date.now();
    
    // Direct fetch with proper headers to mimic a real browser
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });

    const endTime = Date.now();
    const fetchDuration = endTime - startTime;

    // Collect response headers
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    console.log(`📋 Response headers:`, headers);

    if (!response.ok) {
      const errorText = await response.text();
      return { 
        html: '', 
        status: 'error', 
        reason: `Direct fetch failed: ${response.status} - ${errorText}`,
        fetchDuration,
        responseHeaders: headers
      };
    }

    const html = await response.text();
    console.log(`✅ Direct fetch successful: ${html.length} chars in ${fetchDuration}ms`);
    
    return { 
      html, 
      status: 'success', 
      fetchDuration,
      htmlLength: html.length,
      responseHeaders: headers
    };
  } catch (error) {
    console.error(`❌ Direct fetch error: ${error}`);
    return { 
      html: '', 
      status: 'error', 
      reason: `Direct fetch failed: ${error}`,
      fetchDuration: 0,
      responseHeaders: null
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

    console.log(`🧪 TEST DIRECT FETCH: ${symbol} - ${websiteUrl}`);

    // Step 1: Direct fetch website
    const fetchResult = await directFetchWebsite(websiteUrl);
    
    // Step 2: Store results in test table
    const testRecord = {
      symbol: symbol,
      website_url: websiteUrl,
      scraped_html_temp: fetchResult.status === 'success' ? fetchResult.html : null,
      test_analysis_data: {
        test_type: 'direct_fetch_only',
        fetch_status: fetchResult.status,
        fetch_duration_ms: fetchResult.fetchDuration,
        html_length: fetchResult.htmlLength || 0,
        error_reason: fetchResult.reason || null,
        response_headers: fetchResult.responseHeaders || null,
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

    // Return direct fetch test results
    const responseData = {
      success: fetchResult.status === 'success',
      test_type: 'direct_fetch_only',
      symbol,
      websiteUrl,
      fetch_status: fetchResult.status,
      fetch_duration_ms: fetchResult.fetchDuration,
      html_length: fetchResult.htmlLength || 0,
      error_reason: fetchResult.reason || null,
      response_headers: fetchResult.responseHeaders || null,
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
    console.error('Error in test-direct-fetch:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        test_type: 'direct_fetch_only',
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});