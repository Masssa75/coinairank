import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simplified polling function for token_discovery table
async function pollGeckoTerminal(supabase: any) {
  const networks = ['solana', 'eth', 'base', 'bsc', 'pulsechain'];
  let totalNewTokens = 0;
  
  for (const network of networks) {
    // Fetch 1-3 pages based on network activity
    let pagesToFetch = 1;
    if (network === 'solana') pagesToFetch = 3;  // High volume
    else if (network === 'eth') pagesToFetch = 2;  // Medium volume
    else if (network === 'base') pagesToFetch = 2;  // Medium volume
    else if (network === 'pulsechain') pagesToFetch = 2;  // Medium volume
    
    for (let page = 1; page <= pagesToFetch; page++) {
      try {
        const response = await fetch(
          `https://api.geckoterminal.com/api/v2/networks/${network}/new_pools?page=${page}`,
          {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'CAR Token Discovery Bot'
            }
          }
        );

        if (!response.ok) continue;

        const data = await response.json();
        const pools = data.data || [];
        
        for (const pool of pools) {
          try {
            const attrs = pool.attributes || {};
            const relationships = pool.relationships || {};
            const baseToken = relationships.base_token?.data || {};
            const baseTokenId = baseToken.id || '';
            const tokenAddress = baseTokenId.split('_').pop() || '';
            
            if (!tokenAddress) continue;
            
            // Skip if liquidity is too low
            const liquidity = parseFloat(attrs.reserve_in_usd || '0');
            if (liquidity < 100) continue;

            // Complete data for token_discovery table with all required fields
            const tokenData = {
              contract_address: tokenAddress,
              network: network === 'eth' ? 'ethereum' : network === 'pulsechain' ? 'pulsechain' : network,
              symbol: attrs.name?.split(' / ')[0] || null,
              name: attrs.name || null,
              pool_address: attrs.address || null,
              initial_liquidity_usd: parseFloat(attrs.reserve_in_usd || '0'),
              initial_volume_24h: parseFloat(attrs.volume_usd?.h24 || '0'),
              source: 'geckoterminal',
              processed: false
            };

            const { error } = await supabase
              .from('token_discovery')
              .insert(tokenData)
              .select()
              .single();

            if (!error) {
              totalNewTokens++;
              console.log(`✅ Discovered: ${tokenData.symbol} on ${network} - $${liquidity.toFixed(0)} liquidity`);
            }
          } catch (e) {
            // Silent fail for duplicates (expected behavior)
          }
        }
      } catch (e) {
        console.error(`Error polling ${network} page ${page}:`, e);
      }
    }
  }
  
  return totalNewTokens;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    console.log('🚀 Starting GeckoTerminal discovery at', new Date().toISOString());
    
    const newTokens = await pollGeckoTerminal(supabase);
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Discovery completed - ${newTokens} new tokens found`,
        new_tokens: newTokens,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});