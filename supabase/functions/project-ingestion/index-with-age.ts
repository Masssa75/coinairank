import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Add age-related interfaces
interface AgeData {
  project_age_years: number | null;
  launch_date: string | null;
  age_source: 'genesis' | 'cmc_launch' | 'cmc_added' | 'dexscreener' | 'atl_date' | null;
}

interface CMCData {
  date_launched?: string;
  date_added?: string;
}

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
  pairCreatedAt?: number; // Unix timestamp when pair was created - THIS IS THE KEY FIELD
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

// Fetch age data from CoinMarketCap
async function fetchCMCAge(symbol: string): Promise<CMCData | null> {
  const cmcApiKey = Deno.env.get('COINMARKETCAP_API_KEY');
  if (!cmcApiKey) {
    console.log('No CMC API key configured');
    return null;
  }

  try {
    console.log(`Fetching CMC age data for ${symbol}...`);

    const response = await fetch(
      `https://pro-api.coinmarketcap.com/v1/cryptocurrency/info?symbol=${symbol.toUpperCase()}`,
      {
        headers: {
          'X-CMC_PRO_API_KEY': cmcApiKey,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.log(`CMC API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data?.data?.[symbol.toUpperCase()]) {
      const coinData = data.data[symbol.toUpperCase()];
      return {
        date_launched: coinData.date_launched,
        date_added: coinData.date_added
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching CMC data:', error);
    return null;
  }
}

// Fetch CoinGecko data including genesis date and ATL
async function fetchCoinGeckoAge(symbol: string): Promise<{ genesis_date?: string; atl_date?: string } | null> {
  const cgApiKey = Deno.env.get('COINGECKO_API_KEY');

  try {
    // First search for the coin ID
    const searchResponse = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${symbol}`,
      {
        headers: cgApiKey ? { 'x-cg-demo-api-key': cgApiKey } : {}
      }
    );

    if (!searchResponse.ok) return null;

    const searchData = await searchResponse.json();
    const coins = searchData?.coins || [];

    // Find matching coin
    const coin = coins.find((c: any) => c.symbol?.toUpperCase() === symbol.toUpperCase());
    if (!coin?.id) return null;

    // Fetch coin details
    const detailsResponse = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coin.id}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`,
      {
        headers: cgApiKey ? { 'x-cg-demo-api-key': cgApiKey } : {}
      }
    );

    if (!detailsResponse.ok) return null;

    const coinData = await detailsResponse.json();

    return {
      genesis_date: coinData.genesis_date,
      atl_date: coinData.market_data?.atl_date?.usd
    };
  } catch (error) {
    console.error('Error fetching CoinGecko data:', error);
    return null;
  }
}

// Calculate age from multiple sources with priority
async function calculateAge(
  symbol: string,
  dexData?: DexScreenerPairData | null,
  contractAddress?: string
): Promise<AgeData> {
  const ageData: AgeData = {
    project_age_years: null,
    launch_date: null,
    age_source: null
  };

  // Priority 1: Try CoinGecko genesis date (most accurate)
  const cgData = await fetchCoinGeckoAge(symbol);
  if (cgData?.genesis_date) {
    const launch = new Date(cgData.genesis_date);
    const ageDays = (Date.now() - launch.getTime()) / (1000 * 60 * 60 * 24);
    ageData.project_age_years = Math.round(ageDays / 365.25 * 10) / 10;
    ageData.launch_date = cgData.genesis_date;
    ageData.age_source = 'genesis';
    console.log(`✅ Using genesis date: ${cgData.genesis_date} (${ageData.project_age_years} years)`);
    return ageData;
  }

  // Priority 2: Try CMC launch date
  const cmcData = await fetchCMCAge(symbol);
  if (cmcData?.date_launched) {
    const launch = new Date(cmcData.date_launched);
    const ageDays = (Date.now() - launch.getTime()) / (1000 * 60 * 60 * 24);
    ageData.project_age_years = Math.round(ageDays / 365.25 * 10) / 10;
    ageData.launch_date = cmcData.date_launched.split('T')[0];
    ageData.age_source = 'cmc_launch';
    console.log(`✅ Using CMC launch date: ${ageData.launch_date} (${ageData.project_age_years} years)`);
    return ageData;
  }

  // Priority 3: Try CMC added date
  if (cmcData?.date_added) {
    const added = new Date(cmcData.date_added);
    const ageDays = (Date.now() - added.getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > 30) { // Only use if at least a month old
      ageData.project_age_years = Math.round(ageDays / 365.25 * 10) / 10;
      ageData.launch_date = cmcData.date_added.split('T')[0];
      ageData.age_source = 'cmc_added';
      console.log(`✅ Using CMC added date: ${ageData.launch_date} (~${ageData.project_age_years} years)`);
      return ageData;
    }
  }

  // Priority 4: Try DexScreener pair creation date
  if (dexData?.pairCreatedAt) {
    const created = new Date(dexData.pairCreatedAt);
    const ageDays = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > 7) { // Only use if at least a week old
      ageData.project_age_years = Math.round(ageDays / 365.25 * 10) / 10;
      ageData.launch_date = created.toISOString().split('T')[0];
      ageData.age_source = 'dexscreener';
      console.log(`✅ Using DexScreener pair creation: ${ageData.launch_date} (~${ageData.project_age_years} years)`);
      return ageData;
    }
  }

  // Priority 5: Try CoinGecko ATL date (last resort)
  if (cgData?.atl_date) {
    const atl = new Date(cgData.atl_date);
    const ageDays = (Date.now() - atl.getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > 30) { // Only use if at least a month old
      ageData.project_age_years = Math.round(ageDays / 365.25 * 10) / 10;
      ageData.launch_date = cgData.atl_date.split('T')[0];
      ageData.age_source = 'atl_date';
      console.log(`✅ Using ATL date: ${ageData.launch_date} (~${ageData.project_age_years} years)`);
      return ageData;
    }
  }

  console.log('⚠️ No age data available from any source');
  return ageData;
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

  // Use mapping if exists, otherwise use the network as-is (for L1s like bittensor)
  const normalized = mapping[network.toLowerCase()] || network.toLowerCase();

  // Don't validate - accept any network name
  console.log(`Network normalized: ${network} -> ${normalized}`);

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
    const functionUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/website-analyzer-v3`;

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
    let dexData: DexScreenerPairData | null = null;
    if (poolAddress) {
      dexData = await fetchDexScreenerData(network, poolAddress);

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

    // CALCULATE AGE FROM MULTIPLE SOURCES
    const ageData = await calculateAge(projectData.symbol, dexData, body.contract_address);

    // Add age data to project
    if (ageData.project_age_years !== null) {
      projectData = {
        ...projectData,
        project_age_years: ageData.project_age_years,
        launch_date: ageData.launch_date,
        age_source: ageData.age_source
      };
      console.log(`📅 Age data added: ${ageData.project_age_years} years (source: ${ageData.age_source})`);
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

    console.log(`✅ New project ingested: ${newProject.symbol} (ID: ${newProject.id}) with price and age data`);

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
        message: 'Project ingested successfully with price and age data',
        project_id: newProject.id,
        symbol: newProject.symbol,
        price_usd: projectData.current_price_usd,
        market_cap: projectData.current_market_cap,
        liquidity_usd: projectData.current_liquidity_usd,
        age_years: projectData.project_age_years,
        age_source: projectData.age_source,
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