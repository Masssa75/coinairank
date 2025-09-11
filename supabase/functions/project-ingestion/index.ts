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
  pool_address?: string; // Added to support DexScreener price fetching
  
  // Market data from discovery (will be overridden by fresh data)
  initial_liquidity_usd?: number;
  initial_volume_24h?: number;
  
  // Flags for immediate analysis
  trigger_analysis?: boolean; // Default true
}

interface DexScreenerPairData {
  chainId: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceUsd: string;
  priceNative: string;
  liquidity?: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv?: number;
  marketCap?: number;
  volume?: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  priceChange?: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  txns?: {
    h24: {
      buys: number;
      sells: number;
    };
    h6: {
      buys: number;
      sells: number;
    };
    h1: {
      buys: number;
      sells: number;
    };
    m5: {
      buys: number;
      sells: number;
    };
  };
  info?: {
    socials?: Array<{
      type: string;
      url: string;
    }>;
    websites?: string[];
  };
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
    'pulsechain': 'pulsechain',
    'pulse': 'pulsechain',
  };
  const normalized = mapping[network.toLowerCase()] || network;
  
  const validNetworks = ['ethereum', 'solana', 'bsc', 'base', 'pulsechain'];
  if (!validNetworks.includes(normalized)) {
    throw new Error(`Invalid network: ${network}. Must be one of: ${validNetworks.join(', ')}`);
  }
  
  return normalized;
}

// Fetch fresh price data from DexScreener
async function fetchDexScreenerData(network: string, poolAddress: string): Promise<DexScreenerPairData | null> {
  try {
    console.log(`Fetching DexScreener data for ${network}/${poolAddress}`);
    
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/pairs/${network}/${poolAddress}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CAR Project Ingestion'
        }
      }
    );

    if (!response.ok) {
      console.error(`DexScreener API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    // DexScreener returns { pair: {...} } for single pair lookup
    return data.pair || null;
  } catch (error) {
    console.error('Error fetching DexScreener data:', error);
    return null;
  }
}

// Extract social links from DexScreener data
function extractSocialLinks(pairData: DexScreenerPairData) {
  const socials = {
    website_url: null as string | null,
    twitter_url: null as string | null,
    telegram_url: null as string | null,
    discord_url: null as string | null,
  };

  // Check info.socials array
  if (pairData.info?.socials) {
    for (const social of pairData.info.socials) {
      if (!social?.type) continue;
      
      const socialType = social.type.toLowerCase();
      const socialUrl = social.url;
      
      if (socialType === 'website' && !socials.website_url) {
        socials.website_url = socialUrl;
      } else if (socialType === 'twitter' && !socials.twitter_url) {
        socials.twitter_url = socialUrl;
      } else if (socialType === 'telegram' && !socials.telegram_url) {
        socials.telegram_url = socialUrl;
      } else if (socialType === 'discord' && !socials.discord_url) {
        socials.discord_url = socialUrl;
      }
    }
  }

  // Also check info.websites array
  if (!socials.website_url && pairData.info?.websites && pairData.info.websites.length > 0) {
    socials.website_url = pairData.info.websites[0];
  }

  return socials;
}

// Get pool address from token_discovery if not provided
async function getPoolAddressFromDiscovery(
  supabase: any,
  contractAddress: string,
  network: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('token_discovery')
      .select('pool_address')
      .ilike('contract_address', contractAddress) // Case-insensitive lookup
      .eq('network', network)
      .single();

    if (error || !data) {
      console.log(`No pool address found in token_discovery for ${contractAddress}`);
      return null;
    }

    return data.pool_address;
  } catch (error) {
    console.error('Error fetching pool address:', error);
    return null;
  }
}

// Trigger website analysis
async function triggerWebsiteAnalysis(projectId: number, contractAddress: string, websiteUrl: string, symbol: string, network: string = 'ethereum') {
  try {
    const functionUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/website-analyzer-v2`;
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phase: 1,  // Start with Phase 1
        projectId,
        contractAddress,
        websiteUrl,
        symbol,
        network,
        source: 'ingestion'
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
        // Don't await - let analysis happen in background to avoid timeout
        triggerWebsiteAnalysis(
          existing.id, 
          body.contract_address, 
          body.website_url, 
          existing.symbol || body.symbol || 'UNKNOWN',
          body.network || 'ethereum'
        ).catch(error => {
          console.error('Background website analysis failed for existing project:', error);
        });
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
    
    // Get pool address if not provided
    let poolAddress = body.pool_address;
    if (!poolAddress) {
      poolAddress = await getPoolAddressFromDiscovery(supabase, body.contract_address, network);
      if (!poolAddress) {
        console.warn(`No pool address available for ${body.contract_address} - will insert without price data`);
      }
    }

    // Initialize project data with basic fields
    let projectData: any = {
      contract_address: body.contract_address.toLowerCase(),
      network,
      symbol: body.symbol || 'UNKNOWN',
      name: body.name || body.symbol || 'Unknown Project',
      website_url: body.website_url,
      source: body.source,
      pool_address: poolAddress, // Store pool address for future use
    };

    // For manual submissions, set default contract verification
    // (user-submitted tokens are assumed legitimate unless proven otherwise)
    if (body.source === 'manual') {
      projectData.contract_verification = {
        found_on_site: true,
        confidence: 'medium',
        note: 'Manually submitted token - pending website verification'
      };
    }

    // Fetch fresh data from DexScreener if we have a pool address
    if (poolAddress) {
      const dexData = await fetchDexScreenerData(network, poolAddress);
      
      if (dexData) {
        console.log(`✅ Got DexScreener data for ${body.symbol || 'token'}`);
        
        // Determine if our token is base or quote
        const isBase = dexData.baseToken.address.toLowerCase() === body.contract_address.toLowerCase();
        const tokenInfo = isBase ? dexData.baseToken : dexData.quoteToken;
        const counterToken = isBase ? dexData.quoteToken : dexData.baseToken;
        
        // Update symbol and name from DexScreener if not provided
        if (!body.symbol && tokenInfo.symbol) {
          projectData.symbol = tokenInfo.symbol;
        }
        
        // Format name to include trading pair like "PAYAI / SOL"
        if (tokenInfo.symbol && counterToken.symbol) {
          projectData.name = `${tokenInfo.symbol} / ${counterToken.symbol}`;
        } else if (!body.name && tokenInfo.name) {
          projectData.name = tokenInfo.name;
        }
        
        // Extract price data
        const currentPrice = parseFloat(dexData.priceUsd || '0');
        const liquidityUsd = dexData.liquidity?.usd || 0;
        const volume24h = dexData.volume?.h24 || 0;
        const marketCap = dexData.marketCap || dexData.fdv || 0;
        const priceChange24h = dexData.priceChange?.h24 || 0;
        const txns24h = (dexData.txns?.h24?.buys || 0) + (dexData.txns?.h24?.sells || 0);
        
        // Add fresh market data (both initial and current are the same at ingestion)
        projectData = {
          ...projectData,
          // Initial values (snapshot at ingestion time)
          initial_price_usd: currentPrice,
          initial_liquidity_usd: liquidityUsd,
          initial_volume_24h: volume24h,
          initial_market_cap: marketCap,
          initial_price_change_24h: priceChange24h,
          initial_txns_24h: txns24h,
          
          // Current values (same as initial at ingestion)
          current_price_usd: currentPrice,
          current_liquidity_usd: liquidityUsd,
          current_volume_24h: volume24h,
          current_market_cap: marketCap,
          current_price_change_24h: priceChange24h,
          current_txns_24h: txns24h,
          
          // ROI starts at 0% (price hasn't changed yet)
          roi_percent: 0,
          
          // ATH values (at ingestion, current price IS the ATH)
          ath_price: currentPrice,
          ath_market_cap: marketCap,
          ath_roi_percent: 0, // ROI is 0 at ingestion
          ath_timestamp: new Date().toISOString(),
          
          // Track when price data was fetched
          price_data_updated_at: new Date().toISOString(),
        };
        
        // Extract and add social links
        const socialLinks = extractSocialLinks(dexData);
        
        // Override website URL if DexScreener has one and we don't
        if (socialLinks.website_url && body.website_url === 'pending') {
          projectData.website_url = socialLinks.website_url;
          console.log(`Found website from DexScreener: ${socialLinks.website_url}`);
        }
        
        // Add other social links
        if (socialLinks.twitter_url) {
          projectData.twitter_url = socialLinks.twitter_url;
          console.log(`Found Twitter: ${socialLinks.twitter_url}`);
        }
        if (socialLinks.telegram_url) {
          projectData.telegram_url = socialLinks.telegram_url;
          console.log(`Found Telegram: ${socialLinks.telegram_url}`);
        }
        if (socialLinks.discord_url) {
          projectData.discord_url = socialLinks.discord_url;
          console.log(`Found Discord: ${socialLinks.discord_url}`);
        }
        
        // Mark socials as fetched
        if (socialLinks.twitter_url || socialLinks.telegram_url || socialLinks.discord_url) {
          projectData.socials_fetched_at = new Date().toISOString();
        }
        
        console.log(`Price: $${currentPrice.toFixed(8)}, MC: $${marketCap.toLocaleString()}, Liq: $${liquidityUsd.toLocaleString()}`);
      } else {
        console.warn(`Could not fetch DexScreener data for ${poolAddress} - inserting with basic data only`);
        // Set initial values to 0 if we couldn't fetch data
        projectData = {
          ...projectData,
          initial_liquidity_usd: 0,
          initial_volume_24h: 0,
          initial_price_usd: 0,
          initial_market_cap: 0,
          current_price_usd: 0,
          current_market_cap: 0,
          current_liquidity_usd: 0,
          current_volume_24h: 0,
          roi_percent: 0,
          ath_price: 0,
          ath_market_cap: 0,
          ath_roi_percent: 0,
          ath_timestamp: new Date().toISOString(),
        };
      }
    } else {
      // No pool address available - set all price fields to 0
      projectData = {
        ...projectData,
        initial_liquidity_usd: 0,
        initial_volume_24h: 0,
        initial_price_usd: 0,
        initial_market_cap: 0,
        current_price_usd: 0,
        current_market_cap: 0,
        current_liquidity_usd: 0,
        current_volume_24h: 0,
        roi_percent: 0,
        ath_price: 0,
        ath_market_cap: 0,
        ath_roi_percent: 0,
        ath_timestamp: new Date().toISOString(),
      };
    }
    
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
    
    console.log(`✅ New project ingested: ${newProject.symbol} (ID: ${newProject.id}) with price data`);
    
    // Trigger website analysis if requested (default: true) and we have a valid website
    if (body.trigger_analysis !== false && projectData.website_url && projectData.website_url !== 'pending') {
      // Don't await - let analysis happen in background to avoid timeout
      triggerWebsiteAnalysis(
        newProject.id,
        body.contract_address,
        projectData.website_url,
        newProject.symbol,
        body.network || 'ethereum'
      ).catch(error => {
        console.error('Background website analysis failed:', error);
      });
    }
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Project ingested successfully with price data',
        project_id: newProject.id,
        symbol: newProject.symbol,
        price_usd: projectData.current_price_usd,
        market_cap: projectData.current_market_cap,
        liquidity_usd: projectData.current_liquidity_usd,
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