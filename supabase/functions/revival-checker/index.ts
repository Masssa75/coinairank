import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// DexScreener network mapping
const NETWORK_MAP: Record<string, string> = {
  'ethereum': 'ethereum',
  'solana': 'solana',
  'bsc': 'bsc',
  'base': 'base',
  'pulsechain': 'pulsechain',
}

interface DeadToken {
  id: number
  symbol: string
  network: string
  contract_address: string
  pool_address: string
  current_liquidity_usd: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()
  
  try {
    // Parameters with defaults
    const { batchSize = 30, delayMs = 200 } = await req.json().catch(() => ({}))
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })

    console.log(`Starting revival-checker for dead tokens...`)

    // Get all DEAD tokens with pool addresses to check for revivals
    const { data: deadTokens, error: fetchError } = await supabase
      .from('crypto_projects_rated')
      .select(`
        id,
        symbol,
        network,
        contract_address,
        pool_address,
        current_liquidity_usd
      `)
      .not('pool_address', 'is', null)
      .eq('is_dead', true)
      .order('symbol')
    
    if (fetchError) throw fetchError
    
    if (!deadTokens || deadTokens.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No dead tokens to check for revival',
        checkedTokens: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`Found ${deadTokens.length} dead tokens to check`)

    // Group by network
    const tokensByNetwork: Record<string, typeof deadTokens> = {}
    deadTokens.forEach(token => {
      const network = token.network.toLowerCase()
      if (!tokensByNetwork[network]) {
        tokensByNetwork[network] = []
      }
      tokensByNetwork[network].push(token)
    })

    const revivals: string[] = []
    const stillDead: string[] = []
    let apiCalls = 0

    // Process each network's dead tokens
    for (const [network, networkTokens] of Object.entries(tokensByNetwork)) {
      const dexScreenerNetwork = NETWORK_MAP[network]
      
      if (!dexScreenerNetwork) {
        console.log(`Skipping unsupported network: ${network}`)
        continue
      }

      // Process in batches
      for (let i = 0; i < networkTokens.length; i += batchSize) {
        const batch = networkTokens.slice(i, i + batchSize)
        const poolAddresses = batch.map(t => t.pool_address).join(',')
        
        try {
          // Add delay between API calls
          if (apiCalls > 0 && delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, delayMs))
          }
          
          // Fetch batch from DexScreener
          const apiUrl = `https://api.dexscreener.com/latest/dex/pairs/${dexScreenerNetwork}/${poolAddresses}`
          console.log(`API call ${++apiCalls}: Checking ${batch.length} dead ${network} tokens`)
          
          const response = await fetch(apiUrl)
          if (!response.ok) {
            console.error(`DexScreener API error: ${response.status}`)
            continue
          }

          const data = await response.json()
          const pairs = data.pairs || (data.pair ? [data.pair] : [])
          
          // Check each token for revival
          for (const token of batch) {
            const matchingPair = pairs.find((p: any) => 
              p.pairAddress?.toLowerCase() === token.pool_address?.toLowerCase()
            )

            if (matchingPair) {
              const liquidityUsd = matchingPair.liquidity?.usd || 0
              const REVIVAL_THRESHOLD = 1000 // $1,000 liquidity to revive
              
              if (liquidityUsd >= REVIVAL_THRESHOLD) {
                // Token has revived!
                console.log(`🎉 REVIVAL: ${token.symbol} - Liquidity: $${liquidityUsd.toLocaleString()}`)
                revivals.push(token.symbol)
                
                // Update token as alive with new data
                const currentPrice = parseFloat(matchingPair.priceUsd || '0')
                const volume24h = matchingPair.volume?.h24 || 0
                const marketCap = matchingPair.marketCap || matchingPair.fdv || 0
                
                await supabase
                  .from('crypto_projects_rated')
                  .update({
                    is_dead: false,
                    current_price_usd: currentPrice,
                    current_liquidity_usd: liquidityUsd,
                    current_volume_24h: volume24h,
                    current_market_cap: marketCap,
                    price_data_updated_at: new Date().toISOString()
                  })
                  .eq('id', token.id)
              } else {
                // Still dead (low liquidity)
                stillDead.push(token.symbol)
                console.log(`Still dead: ${token.symbol} - Liquidity: $${liquidityUsd}`)
              }
            } else {
              // No data from DexScreener - still dead
              stillDead.push(token.symbol)
              console.log(`Still dead (no data): ${token.symbol}`)
            }
          }
        } catch (error) {
          console.error(`Error checking batch:`, error)
        }
      }
    }

    const processingTime = Date.now() - startTime
    const result = {
      success: true,
      checkedTokens: deadTokens.length,
      revivals: revivals.length,
      stillDead: stillDead.length,
      revivalsList: revivals,
      apiCalls,
      processingTimeMs: processingTime
    }

    console.log(`Revival check completed:`, result)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in revival-checker:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})