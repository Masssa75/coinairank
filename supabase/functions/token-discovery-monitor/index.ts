import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration for how many pages each chain currently fetches
const CURRENT_CONFIG = {
  'solana': 5,
  'eth': 2,
  'base': 2,
  'bsc': 1,
  'pulsechain': 3
};

// Send Telegram notification
async function sendTelegramNotification(message: string) {
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN_CAR');
  const chatId = Deno.env.get('TELEGRAM_GROUP_ID_CAR');
  
  if (!botToken || !chatId) {
    console.warn('Telegram credentials not configured');
    return;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        })
      }
    );

    if (!response.ok) {
      console.error('Telegram notification failed:', await response.text());
    }
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
  }
}

// Check coverage for a single network
async function checkNetworkCoverage(
  network: string, 
  configuredPages: number,
  supabase: any
): Promise<{missing: boolean, details: string}> {
  const networkName = network === 'eth' ? 'ethereum' : network;
  const results: string[] = [];
  let totalNewTokens = 0;
  let totalTokensChecked = 0;
  
  try {
    // Check one page beyond what we currently fetch
    const pageToCheck = configuredPages + 1;
    
    console.log(`Checking ${network} page ${pageToCheck} for missed tokens...`);
    
    const response = await fetch(
      `https://api.geckoterminal.com/api/v2/networks/${network}/new_pools?page=${pageToCheck}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CAR Token Discovery Monitor'
        }
      }
    );

    if (!response.ok) {
      return {missing: false, details: `Failed to fetch page ${pageToCheck}`};
    }

    const data = await response.json();
    const pools = data.data || [];
    
    if (pools.length === 0) {
      return {missing: false, details: 'No tokens on next page'};
    }
    
    // Check each pool to see if we already have it
    for (const pool of pools) {
      const attrs = pool.attributes || {};
      const relationships = pool.relationships || {};
      const baseToken = relationships.base_token?.data || {};
      const baseTokenId = baseToken.id || '';
      const tokenAddress = baseTokenId.split('_').pop()?.toLowerCase() || '';
      
      if (!tokenAddress) continue;
      
      // Skip low liquidity tokens (we don't track these anyway)
      const liquidity = parseFloat(attrs.reserve_in_usd || '0');
      if (liquidity < 100) continue;
      
      totalTokensChecked++;
      
      // Check if we have this token in our discovery table
      const { data: existing } = await supabase
        .from('token_discovery')
        .select('id')
        .eq('contract_address', tokenAddress)
        .eq('network', networkName)
        .single();
      
      if (!existing) {
        totalNewTokens++;
        const symbol = attrs.name?.split(' / ')[0] || 'Unknown';
        console.log(`  - Missing: ${symbol} ($${liquidity.toFixed(0)} liquidity)`);
      }
    }
    
    // Calculate percentage of new tokens
    const missedPercentage = totalTokensChecked > 0 
      ? (totalNewTokens / totalTokensChecked * 100).toFixed(0)
      : 0;
    
    if (totalNewTokens > 3 || Number(missedPercentage) > 30) {
      return {
        missing: true,
        details: `Missing ${totalNewTokens}/${totalTokensChecked} tokens (${missedPercentage}%) on page ${pageToCheck}`
      };
    }
    
    return {
      missing: false,
      details: `Coverage OK (${totalNewTokens}/${totalTokensChecked} new)`
    };
    
  } catch (error) {
    console.error(`Error checking ${network}:`, error);
    return {missing: false, details: `Error: ${error.message}`};
  }
}

// Main monitoring function
async function monitorTokenDiscovery(supabase: any) {
  console.log('🔍 Starting token discovery coverage monitor...');
  
  const alerts: string[] = [];
  const summary: string[] = [];
  
  for (const [network, pages] of Object.entries(CURRENT_CONFIG)) {
    const result = await checkNetworkCoverage(network, pages, supabase);
    
    if (result.missing) {
      alerts.push(`⚠️ <b>${network.toUpperCase()}</b>: ${result.details}`);
    }
    
    summary.push(`${network}: ${result.details}`);
    console.log(`${network}: ${result.details}`);
    
    // Add small delay between chains to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Send Telegram notification if we found issues
  if (alerts.length > 0) {
    const message = `🚨 <b>Token Discovery Coverage Alert</b>\n\n${alerts.join('\n')}\n\n` +
      `Current configuration may need adjustment.\n` +
      `Check: supabase/functions/gecko-token-discovery`;
    
    await sendTelegramNotification(message);
  } else {
    console.log('✅ All chains have good coverage');
  }
  
  return {
    hasAlerts: alerts.length > 0,
    alerts,
    summary
  };
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

    const result = await monitorTokenDiscovery(supabase);
    
    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        hasAlerts: result.hasAlerts,
        summary: result.summary,
        message: result.hasAlerts 
          ? 'Coverage issues detected and reported' 
          : 'All chains have good coverage'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
    
  } catch (error) {
    console.error('Monitor error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});