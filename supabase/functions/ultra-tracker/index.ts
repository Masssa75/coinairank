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
  'polygon': 'polygon',
  'arbitrum': 'arbitrum',
  'optimism': 'optimism',
  'avalanche': 'avalanche',
}

interface TokenData {
  id: number
  symbol: string
  network: string
  contract_address: string
  pool_address: string
  initial_price_usd: number
  current_price_usd: number
  ath_price: number
  ath_timestamp: string
  ath_roi_percent: number
  ath_market_cap: number
  current_liquidity_usd: number
  is_dead: boolean
  // Social fields
  website_url: string | null
  twitter_url: string | null
  telegram_url: string | null
  discord_url: string | null
}

interface DexScreenerPair {
  chainId: string
  pairAddress: string
  baseToken: {
    address: string
    name: string
    symbol: string
  }
  quoteToken: {
    address: string
    name: string
    symbol: string
  }
  priceUsd: string
  priceNative: string
  liquidity?: {
    usd: number
    base: number
    quote: number
  }
  fdv?: number
  marketCap?: number
  volume?: {
    h24: number
    h6: number
    h1: number
    m5: number
  }
  priceChange?: {
    h24: number
    h6: number
    h1: number
    m5: number
  }
  txns?: {
    h24: {
      buys: number
      sells: number
    }
  }
  info?: {
    socials?: Array<{
      type: string
      url: string
    }>
    websites?: string[]
  }
}

// Helper function to extract social links from DexScreener data
function extractSocialLinks(pairData: DexScreenerPair) {
  const socials = {
    website_url: null as string | null,
    twitter_url: null as string | null,
    telegram_url: null as string | null,
    discord_url: null as string | null,
  }

  // Check info.socials array
  if (pairData.info?.socials) {
    for (const social of pairData.info.socials) {
      if (!social?.type) continue
      
      const socialType = social.type.toLowerCase()
      const socialUrl = social.url
      
      if (socialType === 'website' && !socials.website_url) {
        socials.website_url = socialUrl
      } else if (socialType === 'twitter' && !socials.twitter_url) {
        socials.twitter_url = socialUrl
      } else if (socialType === 'telegram' && !socials.telegram_url) {
        socials.telegram_url = socialUrl
      } else if (socialType === 'discord' && !socials.discord_url) {
        socials.discord_url = socialUrl
      }
    }
  }

  // Also check info.websites array
  if (!socials.website_url && pairData.info?.websites && pairData.info.websites.length > 0) {
    socials.website_url = typeof pairData.info.websites[0] === 'string' 
      ? pairData.info.websites[0] 
      : (pairData.info.websites[0] as any)?.url || null
  }

  return socials
}

// Process and update a batch of tokens
async function processAndUpdateBatch(
  pairs: DexScreenerPair[],
  batch: TokenData[],
  supabase: any,
  newATHs: any[],
  deadTokens: string[],
  revivals: string[]
): Promise<{ processed: number; updated: number }> {
  let processed = 0
  let updated = 0
  
  for (const token of batch) {
    try {
      // Find the pair matching this token's pool address (case-insensitive)
      const matchingPair = pairs.find((p) => 
        p.pairAddress?.toLowerCase() === token.pool_address?.toLowerCase()
      )

      // OPTION C: Mark as dead if no data OR liquidity < threshold
      const LIQUIDITY_THRESHOLD = 1000
      let isDead = false
      let updateData: any = {
        price_data_updated_at: new Date().toISOString()
      }

      if (!matchingPair) {
        // Token not found on DexScreener - mark as dead
        console.log(`Token ${token.symbol} not found on DexScreener - marking as dead`)
        isDead = true
        updateData.is_dead = true
        updateData.current_liquidity_usd = 0
        updateData.current_volume_24h = 0
        updateData.current_price_usd = 0
        updateData.current_market_cap = 0
        deadTokens.push(token.symbol)
      } else {
        // Process the pair data
        const currentPrice = parseFloat(matchingPair.priceUsd || '0')
        const liquidityUsd = matchingPair.liquidity?.usd || 0
        const volume24h = matchingPair.volume?.h24 || 0
        const marketCap = matchingPair.marketCap || matchingPair.fdv || 0
        const priceChange24h = matchingPair.priceChange?.h24 || 0
        const txns24h = (matchingPair.txns?.h24?.buys || 0) + (matchingPair.txns?.h24?.sells || 0)

        // Check liquidity threshold
        if (liquidityUsd < LIQUIDITY_THRESHOLD) {
          console.log(`Token ${token.symbol} has low liquidity ($${liquidityUsd.toFixed(2)}) - marking as dead`)
          isDead = true
          deadTokens.push(token.symbol)
        } else if (token.is_dead && liquidityUsd >= LIQUIDITY_THRESHOLD) {
          // Token revival - was dead but now has liquidity
          console.log(`Token ${token.symbol} REVIVED! Liquidity: $${liquidityUsd.toLocaleString()}`)
          revivals.push(token.symbol)
        }

        // Skip if no valid price
        if (currentPrice <= 0 && !isDead) {
          console.log(`Token ${token.symbol} has no price data - skipping`)
          continue
        }

        processed++

        // Update market data
        updateData = {
          ...updateData,
          current_price_usd: currentPrice,
          current_liquidity_usd: liquidityUsd,
          current_volume_24h: volume24h,
          current_market_cap: marketCap,
          current_price_change_24h: priceChange24h,
          current_txns_24h: txns24h,
          is_dead: isDead
        }

        // Calculate ROI if we have initial price and not dead
        if (!isDead && token.initial_price_usd > 0 && currentPrice > 0) {
          const currentROI = ((currentPrice - token.initial_price_usd) / token.initial_price_usd) * 100
          updateData.roi_percent = currentROI

          // Check for new ATH
          const existingATH = token.ath_price || 0
          
          // Only update ATH if current price is higher
          if (existingATH === 0 || currentPrice > existingATH) {
            const newATH = existingATH === 0 
              ? Math.max(currentPrice, token.initial_price_usd)
              : currentPrice
            
            if (newATH > existingATH) {
              updateData.ath_price = newATH
              updateData.ath_timestamp = new Date().toISOString()
              updateData.ath_roi_percent = Math.max(0, ((newATH - token.initial_price_usd) / token.initial_price_usd) * 100)
              updateData.ath_market_cap = marketCap

              console.log(`New ATH for ${token.symbol}: $${newATH.toFixed(8)} (${updateData.ath_roi_percent.toFixed(2)}% ROI)`)

              // Check if this qualifies for notification (250% ROI + 20% increase)
              const previousATH = token.ath_price || token.initial_price_usd
              const athIncrease = ((newATH - previousATH) / previousATH) * 100
              
              if (updateData.ath_roi_percent >= 250 && athIncrease >= 20) {
                newATHs.push({
                  symbol: token.symbol,
                  network: token.network,
                  poolAddress: token.pool_address,
                  contractAddress: token.contract_address,
                  oldATH: previousATH,
                  newATH: newATH,
                  roi: updateData.ath_roi_percent.toFixed(2),
                  volume24h: volume24h,
                  liquidity: liquidityUsd
                })
                console.log(`ATH Alert queued: ${token.symbol} at ${updateData.ath_roi_percent.toFixed(2)}% ROI`)
              }
            }
          }
        }

        // Extract social links (only update if current field is null)
        const socialLinks = extractSocialLinks(matchingPair)
        
        // Only add social fields if they're not already populated
        if (!token.website_url && socialLinks.website_url) {
          updateData.website_url = socialLinks.website_url
          console.log(`Found website for ${token.symbol}: ${socialLinks.website_url}`)
        }
        if (!token.twitter_url && socialLinks.twitter_url) {
          updateData.twitter_url = socialLinks.twitter_url
        }
        if (!token.telegram_url && socialLinks.telegram_url) {
          updateData.telegram_url = socialLinks.telegram_url
        }
        if (!token.discord_url && socialLinks.discord_url) {
          updateData.discord_url = socialLinks.discord_url
        }
        
        // Update socials_fetched_at if we found any new social links
        if ((socialLinks.website_url && !token.website_url) || 
            (socialLinks.twitter_url && !token.twitter_url) || 
            (socialLinks.telegram_url && !token.telegram_url) || 
            (socialLinks.discord_url && !token.discord_url)) {
          updateData.socials_fetched_at = new Date().toISOString()
        }
      }

      // Update database
      const { error: updateError } = await supabase
        .from('crypto_projects_rated')
        .update(updateData)
        .eq('id', token.id)

      if (updateError) {
        console.error(`Failed to update token ${token.symbol}:`, updateError)
      } else {
        updated++
      }
    } catch (error) {
      console.error(`Error processing token ${token.symbol}:`, error)
    }
  }

  return { processed, updated }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()
  
  try {
    // Parameters with defaults
    const { batchSize = 30, delayMs = 100, maxTokens = 1000 } = await req.json().catch(() => ({}))
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })

    console.log(`Starting CAR ultra-tracker...`)

    // Get all tokens with pool addresses that need price updates
    // Order by price_data_updated_at to prioritize tokens that haven't been updated recently
    const { data: tokens, error: fetchError } = await supabase
      .from('crypto_projects_rated')
      .select(`
        id, 
        symbol, 
        network, 
        contract_address, 
        pool_address, 
        initial_price_usd, 
        current_price_usd, 
        ath_price, 
        ath_timestamp, 
        ath_roi_percent,
        ath_market_cap,
        current_liquidity_usd,
        is_dead,
        website_url,
        twitter_url,
        telegram_url,
        discord_url
      `)
      .not('pool_address', 'is', null)
      .order('price_data_updated_at', { ascending: true, nullsFirst: true })
      .limit(maxTokens)
    
    if (fetchError) throw fetchError
    
    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ message: 'No tokens with pool addresses to process' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`Found ${tokens.length} tokens to process`)

    // Group tokens by network for efficient API calls
    const tokensByNetwork: Record<string, typeof tokens> = {}
    tokens.forEach(token => {
      const network = token.network.toLowerCase()
      if (!tokensByNetwork[network]) {
        tokensByNetwork[network] = []
      }
      tokensByNetwork[network].push(token)
    })
    
    console.log(`Networks: ${Object.entries(tokensByNetwork).map(([net, toks]) => `${net}(${toks.length})`).join(', ')}`)

    let totalProcessed = 0
    let totalUpdated = 0
    const newATHs: any[] = []
    const deadTokens: string[] = []
    const revivals: string[] = []
    let apiCalls = 0

    // Process each network's tokens
    for (const [network, networkTokens] of Object.entries(tokensByNetwork)) {
      const dexScreenerNetwork = NETWORK_MAP[network]
      
      if (!dexScreenerNetwork) {
        console.log(`Skipping unsupported network: ${network}`)
        continue
      }

      // Process in batches (DexScreener allows up to 30 pairs per request)
      for (let i = 0; i < networkTokens.length; i += batchSize) {
        const batch = networkTokens.slice(i, i + batchSize)
        const poolAddresses = batch.map(t => t.pool_address).join(',')
        
        try {
          // Rate limit: DexScreener allows 300 req/min (5 per second)
          if (apiCalls > 0 && delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, delayMs))
          }
          
          // Fetch batch from DexScreener
          const apiUrl = `https://api.dexscreener.com/latest/dex/pairs/${dexScreenerNetwork}/${poolAddresses}`
          console.log(`API call ${++apiCalls}: Fetching ${batch.length} ${network} tokens`)
          
          const response = await fetch(apiUrl)
          if (!response.ok) {
            console.error(`DexScreener API error: ${response.status}`)
            continue
          }

          const data = await response.json()
          const pairs = data.pairs || (data.pair ? [data.pair] : [])
          
          if (!pairs || pairs.length === 0) {
            console.log(`No data returned for batch`)
            // Mark all tokens in batch as dead (no data from DexScreener)
            for (const token of batch) {
              await supabase
                .from('crypto_projects_rated')
                .update({ 
                  is_dead: true,
                  current_liquidity_usd: 0,
                  current_volume_24h: 0,
                  price_data_updated_at: new Date().toISOString()
                })
                .eq('id', token.id)
              deadTokens.push(token.symbol)
            }
            continue
          }

          // Process and update this batch
          const result = await processAndUpdateBatch(pairs, batch, supabase, newATHs, deadTokens, revivals)
          totalProcessed += result.processed
          totalUpdated += result.updated

        } catch (error) {
          console.error(`Error fetching batch:`, error)
        }
      }
    }

    // Send Telegram notifications for significant new ATHs
    if (newATHs.length > 0) {
      const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN_CAR')
      const telegramChatId = Deno.env.get('TELEGRAM_GROUP_ID_CAR')
      
      if (telegramBotToken && telegramChatId) {
        for (const ath of newATHs) {
          const dexScreenerUrl = `https://dexscreener.com/${ath.network}/${ath.poolAddress}`
          const message = `🚀 *NEW ATH ALERT!*\n\n` +
            `Token: ${ath.symbol}\n` +
            `Network: ${ath.network}\n` +
            `New ATH: $${ath.newATH.toFixed(8)}\n` +
            `ROI: ${ath.roi}%\n` +
            `Volume 24h: $${(ath.volume24h / 1000).toFixed(1)}K\n` +
            `Liquidity: $${(ath.liquidity / 1000).toFixed(1)}K\n\n` +
            `[View on DexScreener](${dexScreenerUrl})\n` +
            `[View on CoinAIRank](https://coinairank.com/project/${ath.contractAddress})`

          try {
            await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: telegramChatId,
                text: message,
                parse_mode: 'Markdown',
                disable_web_page_preview: true
              })
            })
          } catch (error) {
            console.error('Failed to send Telegram notification:', error)
          }
        }
      }
    }

    const processingTime = Date.now() - startTime
    const result = {
      success: true,
      totalTokens: tokens.length,
      totalProcessed,
      totalUpdated,
      newATHs: newATHs.length,
      deadTokens: deadTokens.length,
      revivals: revivals.length,
      apiCalls,
      processingTimeMs: processingTime,
      tokensPerSecond: (totalProcessed / (processingTime / 1000)).toFixed(1),
      networksProcessed: Object.keys(tokensByNetwork).length,
      deadTokensList: deadTokens.slice(0, 10), // First 10 for visibility
      revivalsList: revivals
    }

    console.log(`Ultra-tracker completed:`, result)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in ultra-tracker:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})