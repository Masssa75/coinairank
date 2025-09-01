import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TokenIngestionRequest {
  // Required fields
  contract_address: string;
  network: string;
  website_url: string;
  source: 'token_discovery' | 'manual' | 'api';
  
  // Optional fields
  symbol?: string;
  name?: string;
  
  // Market data from discovery
  initial_liquidity_usd?: number;
  initial_volume_24h?: number;
  
  // Flags for immediate analysis
  trigger_analysis?: boolean; // Default true
}

// Map network names for consistency
function normalizeNetwork(network: string): string {
  const mapping: Record<string, string> = {
    'ethereum': 'ethereum',
    'eth': 'ethereum',
    'solana': 'solana',
    'sol': 'solana',
    'bsc': 'bsc',
    'binance': 'bsc',
    'base': 'base',
  };
  const normalized = mapping[network.toLowerCase()] || network;
  
  const validNetworks = ['ethereum', 'solana', 'bsc', 'base'];
  if (!validNetworks.includes(normalized)) {
    throw new Error(`Invalid network: ${network}. Must be one of: ${validNetworks.join(', ')}`);
  }
  
  return normalized;
}

// Trigger website analysis
async function triggerWebsiteAnalysis(projectId: number, contractAddress: string, websiteUrl: string, symbol: string) {
  try {
    const functionUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/website-analyzer`;
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId,
        contractAddress,
        websiteUrl,
        symbol,
        source: 'project-ingestion'
      })
    });
    
    if (!response.ok) {
      console.error(`Website analysis trigger failed: ${response.status}`);
      return false;
    }
    
    console.log(`✅ Website analysis triggered for project ${projectId}`);
    return true;
  } catch (error) {
    console.error('Error triggering website analysis:', error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role for write access
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    const body: TokenIngestionRequest = await req.json();
    
    // Validate required fields
    if (!body.contract_address || !body.network || !body.website_url || !body.source) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: contract_address, network, website_url, source' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }
    
    // Normalize network name
    const network = normalizeNetwork(body.network);
    
    // Check if project already exists
    const { data: existing, error: checkError } = await supabase
      .from('crypto_projects_rated')
      .select('id, symbol, website_stage1_score')
      .eq('contract_address', body.contract_address.toLowerCase())
      .eq('network', network)
      .single();
    
    if (existing) {
      console.log(`Project already exists: ${existing.symbol} (ID: ${existing.id})`);
      
      // If it exists but hasn't been analyzed, trigger analysis
      if (!existing.website_stage1_score && (body.trigger_analysis !== false)) {
        await triggerWebsiteAnalysis(
          existing.id, 
          body.contract_address, 
          body.website_url, 
          existing.symbol || body.symbol || 'UNKNOWN'
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Project already exists',
          project_id: existing.id,
          action: 'skipped'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }
    
    // Prepare data for insertion
    const projectData = {
      contract_address: body.contract_address.toLowerCase(),
      network,
      symbol: body.symbol || 'UNKNOWN',
      name: body.name || body.symbol || 'Unknown Project',
      website_url: body.website_url,
      source: body.source,
      initial_liquidity_usd: body.initial_liquidity_usd || 0,
      initial_volume_24h: body.initial_volume_24h || 0
      // created_at and updated_at are handled automatically by Supabase
    };
    
    // Insert into crypto_projects_rated
    const { data: newProject, error: insertError } = await supabase
      .from('crypto_projects_rated')
      .insert(projectData)
      .select('id, symbol')
      .single();
    
    if (insertError) {
      console.error('Failed to insert project:', insertError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to ingest project',
          details: insertError.message 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }
    
    console.log(`✅ New project ingested: ${newProject.symbol} (ID: ${newProject.id})`);
    
    // Trigger website analysis if requested (default: true)
    if (body.trigger_analysis !== false) {
      await triggerWebsiteAnalysis(
        newProject.id,
        body.contract_address,
        body.website_url,
        newProject.symbol
      );
    }
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Project ingested successfully',
        project_id: newProject.id,
        symbol: newProject.symbol,
        action: 'created'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
    
  } catch (error) {
    console.error('Error in project ingestion:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});