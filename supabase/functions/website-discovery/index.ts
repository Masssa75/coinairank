import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Send Telegram notification when website is found
async function sendTelegramNotification(token: any) {
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN_CAR');
  const chatId = Deno.env.get('TELEGRAM_GROUP_ID_CAR');

  if (!botToken || !chatId) {
    console.log('Telegram credentials not configured');
    return;
  }

  // Format liquidity and volume with commas
  const liquidity = token.current_liquidity_usd
    ? `$${token.current_liquidity_usd.toLocaleString()}`
    : 'Unknown';
  const volume = token.current_volume_24h
    ? `$${token.current_volume_24h.toLocaleString()}`
    : 'Unknown';

  const message = `🔍 <b>New Website Found!</b>

🪙 <b>${token.symbol || 'Unknown'}</b> on ${token.network}
🌐 <b>Website:</b> ${token.website_url}
💰 <b>Liquidity:</b> ${liquidity}
📊 <b>Volume 24h:</b> ${volume}

📍 <b>Contract:</b> <code>${token.contract_address}</code>
🔗 <a href="https://dexscreener.com/${token.network}/${token.contract_address}">View on DexScreener</a>

<i>Found after ${token.website_check_count || 1} check(s)</i>`;

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: false
      })
    });

    if (response.ok) {
      console.log(`✅ Telegram notification sent for ${token.symbol}`);
    } else {
      const error = await response.text();
      console.error('Telegram API error:', error);
    }
  } catch (error) {
    console.error('Failed to send Telegram notification:', error);
  }
}

// List of trading/launch platforms and social media that shouldn't be considered project websites
const TRADING_PLATFORM_DOMAINS = [
  'pump.fun',
  // DEX aggregators and exchanges - legitimate platforms that scam tokens falsely claim
  'jup.ag',
  'raydium.io',
  'orca.so',
  'uniswap.org',
  '1inch.io',
  'sushiswap.com',
  // Social media platforms
  'youtube.com',
  'instagram.com',
  'tiktok.com',
  'reddit.com',
  'twitter.com',
  'x.com',
  'facebook.com',
  'linkedin.com',
  'line.me',
  'telegram.org',
  't.me',
  'discord.com',
  'discord.gg',
  // Archive sites
  'web.archive.org',
  'archive.org',
  // Other non-project sites
  'medium.com',
  'msn.com',
  'testingcatalog.com',  // Testing/demo site - not a real project
  // Government/regulatory sites - ALL .gov domains are excluded
  '.gov'  // This will block ALL government domains (dhs.gov, sec.gov, etc.)
];

// Check if URL is a trading platform (not a real project website)
function isTradingPlatform(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase().replace('www.', '');
    return TRADING_PLATFORM_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

// Check DexScreener for website and social links
async function checkDexScreener(addresses: string[]) {
  try {
    const addressList = addresses.join(',');
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${addressList}`,
      { headers: { 'Accept': 'application/json' } }
    );
    
    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    console.error('DexScreener API error:', e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Test endpoint for Telegram notifications
  if (req.url.includes('test-notification')) {
    await sendTelegramNotification({
      symbol: 'TEST',
      network: 'ethereum',
      website_url: 'https://example.com',
      current_liquidity_usd: 50000,
      current_volume_24h: 10000,
      contract_address: '0x1234567890abcdef1234567890abcdef12345678',
      website_check_count: 1
    });
    return new Response('Test notification sent', { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    console.log('🔍 Starting website discovery...');

    let totalChecked = 0;
    let websitesFound = 0;

    // Priority 1: Never-checked tokens with good liquidity
    const { data: neverChecked, error: error1 } = await supabase
      .from('token_discovery')
      .select('id, contract_address, symbol, network, name, initial_liquidity_usd')
      .is('website_checked_at', null)
      .is('website_url', null)
      .gt('initial_liquidity_usd', 1000) // Min $1K liquidity
      .order('initial_liquidity_usd', { ascending: false })
      .limit(60); // Process more tokens

    if (error1) {
      console.error('❌ Failed to query never-checked tokens:', error1);
      throw new Error(`Database query failed: ${error1.message}`);
    }

    const tokensToCheck = neverChecked || [];
    
    if (tokensToCheck.length === 0) {
      console.log('No high-liquidity tokens need website discovery');
      return new Response(JSON.stringify({
        success: true,
        message: 'No qualified tokens to process',
        checked: 0,
        websites_found: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${tokensToCheck.length} tokens to check for websites`);
    
    // Process in batches of 30
    for (let i = 0; i < tokensToCheck.length; i += 30) {
      const batch = tokensToCheck.slice(i, i + 30);
      const addresses = batch.map(t => t.contract_address);
      const dexData = await checkDexScreener(addresses);
      
      if (!dexData || !dexData.pairs) continue;

      for (const token of batch) {
        // Find pairs for this token
        const pairs = dexData.pairs.filter(
          (p: any) => p.baseToken?.address?.toLowerCase() === token.contract_address.toLowerCase()
        );

        let websiteUrl = null;
        const now = new Date().toISOString();
        let updateData: any = {
          website_checked_at: now,
          last_check_at: now,
          website_check_count: 1
        };

        for (const pair of pairs) {
          // Update current market data from DexScreener
          if (pair.liquidity?.usd) {
            updateData.current_liquidity_usd = pair.liquidity.usd;
          }
          if (pair.volume?.h24) {
            updateData.current_volume_24h = pair.volume.h24;
          }
          // Don't update price fields that don't exist in token_discovery
          // These would go in crypto_projects_rated table

          const info = pair.info;
          if (!info) continue;

          // Extract website (filter out trading platforms)
          const websites = info.websites || [];
          for (const website of websites) {
            if (website.url && !isTradingPlatform(website.url)) {
              websiteUrl = website.url;
              updateData.website_url = websiteUrl;
              updateData.website_found_at = now;
              websitesFound++;
              console.log(`  ✅ ${token.symbol}: Website found - ${websiteUrl}`);
              break;
            } else if (website.url && isTradingPlatform(website.url)) {
              console.log(`  ⚠️ ${token.symbol}: Skipping trading platform URL - ${website.url}`);
            }
          }

          // Note: twitter_url, telegram_url, discord_url columns don't exist in token_discovery
          // These will be passed to project-ingestion for crypto_projects_rated table

          if (websiteUrl) break; // Found what we need
        }

        // Mark as processed only if website found
        if (websiteUrl) {
          updateData.processed = true;
        }
        
        const { error: updateError } = await supabase
          .from('token_discovery')
          .update(updateData)
          .eq('id', token.id);

        if (updateError) {
          console.error(`❌ Failed to update token ${token.symbol}:`, updateError);
        } else {
          console.log(`✅ Updated token ${token.symbol}, website: ${websiteUrl || 'none'}`);
        }

        totalChecked++;

        // If website found, send notification and trigger ingestion
        if (websiteUrl) {
          // Send Telegram notification
          await sendTelegramNotification({
            ...token,
            website_url: websiteUrl,
            current_liquidity_usd: updateData.current_liquidity_usd,
            current_volume_24h: updateData.current_volume_24h,
            website_check_count: updateData.website_check_count
          });

          // Trigger ingestion to main table
          try {
            const ingestionUrl = `${supabaseUrl}/functions/v1/project-ingestion`;
            const ingestionResponse = await fetch(ingestionUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                contract_address: token.contract_address,
                network: token.network,
                symbol: token.symbol,
                name: token.name,
                website_url: websiteUrl,
                initial_liquidity_usd: token.initial_liquidity_usd,
                source: 'token_discovery'
              })
            });
            
            if (ingestionResponse.ok) {
              const result = await ingestionResponse.json();
              console.log(`    → Promoted to crypto_projects_rated: ${result.project_id}`);
            }
          } catch (ingestionError) {
            console.error(`    ⚠️ Ingestion error: ${ingestionError}`);
          }
        }
      }
    }
    
    console.log(`\n✅ Website discovery completed:`);
    console.log(`  Total checked: ${totalChecked}`);
    console.log(`  Websites found: ${websitesFound}`);

    return new Response(JSON.stringify({
      success: true,
      checked: totalChecked,
      websites_found: websitesFound,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in website discovery:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});