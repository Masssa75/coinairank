import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createHash } from "https://deno.land/std@0.192.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScreenshotRequest {
  url: string;
  tokenId?: string;
  table?: string;
  forceRefresh?: boolean;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, tokenId, table = 'crypto_calls', forceRefresh = false } = await req.json() as ScreenshotRequest;

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate hash for the URL (for deduplication)
    const encoder = new TextEncoder();
    const data = encoder.encode(url);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const urlHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Check if we already have this screenshot (unless force refresh)
    if (!forceRefresh && tokenId) {
      // Select appropriate columns based on table
      const selectColumns = table === 'crypto_projects_rated' 
        ? 'website_screenshot_url, website_screenshot_updated_at'
        : 'website_screenshot_url, website_screenshot_captured_at';
      
      const { data: existingToken } = await supabase
        .from(table)
        .select(selectColumns)
        .eq('id', tokenId)
        .single();

      if (existingToken?.website_screenshot_url) {
        // Check if screenshot is less than 7 days old
        const timestampField = table === 'crypto_projects_rated' 
          ? existingToken.website_screenshot_updated_at
          : existingToken.website_screenshot_captured_at;
        
        const capturedAt = new Date(timestampField);
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        
        if (capturedAt > sevenDaysAgo) {
          return new Response(
            JSON.stringify({
              screenshot_url: existingToken.website_screenshot_url,
              cached: true,
              captured_at: timestampField
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Capture screenshot using ApiFlash
    const apiFlashKey = Deno.env.get('APIFLASH_KEY') || 'fc3f86dcb87d4e01b34de1bc925bf12d';
    const screenshotParams = new URLSearchParams({
      access_key: apiFlashKey,
      url: url,
      format: 'png',
      width: '430',  // iPhone 14 Pro Max width
      height: '932', // iPhone 14 Pro Max height
      response_type: 'image',
      wait_until: 'page_loaded',
      delay: '2',
      quality: '80',
      fresh: forceRefresh ? 'true' : 'false'
    });

    const screenshotUrl = `https://api.apiflash.com/v1/urltoimage?${screenshotParams}`;
    
    // Fetch the screenshot
    const screenshotResponse = await fetch(screenshotUrl);
    
    if (!screenshotResponse.ok) {
      throw new Error(`Failed to capture screenshot: ${screenshotResponse.statusText}`);
    }

    const screenshotBlob = await screenshotResponse.blob();
    const arrayBuffer = await screenshotBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Generate filename
    const timestamp = Date.now();
    const fileName = `${urlHash.substring(0, 12)}_${timestamp}.png`;
    const filePath = `screenshots/${fileName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('token-screenshots')
      .upload(filePath, uint8Array, {
        contentType: 'image/png',
        cacheControl: '31536000', // 1 year cache
        upsert: true
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('token-screenshots')
      .getPublicUrl(filePath);

    // Update the database if tokenId provided
    if (tokenId) {
      // Prepare update data based on table
      const updateData = table === 'token_discovery' 
        ? {
            website_screenshot_url: publicUrl,
            website_screenshot_captured_at: new Date().toISOString()
          }
        : table === 'crypto_projects_rated'
        ? {
            website_screenshot_url: publicUrl,
            website_screenshot_updated_at: new Date().toISOString(),
            website_screenshot_hash: urlHash
          }
        : {
            website_screenshot_url: publicUrl,
            website_screenshot_captured_at: new Date().toISOString(),
            website_screenshot_hash: urlHash
          };

      const { error: updateError } = await supabase
        .from(table)
        .update(updateData)
        .eq('id', tokenId);

      if (updateError) {
        console.error(`Failed to update ${table}:`, updateError);
        // Don't throw - screenshot was still captured successfully
      }
    }

    return new Response(
      JSON.stringify({
        screenshot_url: publicUrl,
        cached: false,
        captured_at: new Date().toISOString(),
        hash: urlHash
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Screenshot capture error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});