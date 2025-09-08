import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isValidContractAddress, normalizeContractAddress, normalizeNetwork } from '@/lib/validation';

// Simple in-memory rate limiting (resets on server restart)
// In production, you'd want Redis or a database solution
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT = 50; // 50 requests per hour
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(identifier);

  if (!userLimit || now > userLimit.resetTime) {
    // First request or window expired
    rateLimitMap.set(identifier, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT) {
    return false; // Rate limit exceeded
  }

  // Increment count
  userLimit.count++;
  return true;
}

// Fetch token data from DexScreener
async function fetchTokenDataFromDexScreener(contractAddress: string, network: string) {
  try {
    // Try to get token data from DexScreener
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`,
      {
        headers: {
          'Accept': 'application/json',
        }
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    // DexScreener returns an array of pairs for a token
    // Find the pair on our target network with highest liquidity
    const pairs = data.pairs || [];
    const networkPairs = pairs.filter((p: any) => 
      p.chainId?.toLowerCase() === network.toLowerCase()
    );
    
    if (networkPairs.length === 0) {
      return null;
    }
    
    // Sort by liquidity and get the best one
    const bestPair = networkPairs.sort((a: any, b: any) => 
      (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
    )[0];
    
    // Extract useful data
    const tokenData = {
      poolAddress: bestPair.pairAddress,
      symbol: bestPair.baseToken.address.toLowerCase() === contractAddress.toLowerCase() 
        ? bestPair.baseToken.symbol 
        : bestPair.quoteToken.symbol,
      name: bestPair.baseToken.address.toLowerCase() === contractAddress.toLowerCase()
        ? bestPair.baseToken.name
        : bestPair.quoteToken.name,
      website: null as string | null,
      twitter: null as string | null,
      telegram: null as string | null,
      liquidity: bestPair.liquidity?.usd || 0
    };
    
    // Extract social links if available
    if (bestPair.info?.socials) {
      for (const social of bestPair.info.socials) {
        const type = social.type?.toLowerCase();
        if (type === 'website' && !tokenData.website) {
          tokenData.website = social.url;
        } else if (type === 'twitter' && !tokenData.twitter) {
          tokenData.twitter = social.url;
        } else if (type === 'telegram' && !tokenData.telegram) {
          tokenData.telegram = social.url;
        }
      }
    }
    
    // Also check websites array
    if (!tokenData.website && bestPair.info?.websites?.length > 0) {
      // Extract just the URL from the website object
      const websiteObj = bestPair.info.websites[0];
      tokenData.website = typeof websiteObj === 'string' ? websiteObj : websiteObj.url;
    }
    
    return tokenData;
  } catch (error) {
    console.error('Error fetching from DexScreener:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const forwardedFor = request.headers.get('x-forwarded-for');
    const clientIp = forwardedFor ? forwardedFor.split(',')[0] : 'unknown';
    
    // Check rate limit
    if (!checkRateLimit(clientIp)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { contractAddress, network, websiteUrl } = body;

    // Validate required fields
    if (!contractAddress || !network) {
      return NextResponse.json(
        { error: 'Contract address and network are required.' },
        { status: 400 }
      );
    }

    // Normalize network name
    const normalizedNetwork = normalizeNetwork(network);
    
    // Validate contract address format
    if (!isValidContractAddress(contractAddress, normalizedNetwork)) {
      return NextResponse.json(
        { error: 'Invalid contract address format for the selected network.' },
        { status: 400 }
      );
    }

    // Normalize contract address
    const normalizedAddress = normalizeContractAddress(contractAddress, normalizedNetwork);

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase credentials not configured');
      return NextResponse.json(
        { error: 'Server configuration error.' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if token already exists in crypto_projects_rated
    const { data: existingToken, error: checkError } = await supabase
      .from('crypto_projects_rated')
      .select('id, symbol, name')
      .eq('contract_address', normalizedAddress)
      .eq('network', normalizedNetwork)
      .single();

    if (existingToken) {
      return NextResponse.json(
        { 
          error: 'Token already exists in our database.',
          tokenId: existingToken.id,
          symbol: existingToken.symbol
        },
        { status: 409 } // Conflict
      );
    }

    // Fetch token data from DexScreener
    console.log(`Fetching data for ${normalizedAddress} on ${normalizedNetwork}`);
    const tokenData = await fetchTokenDataFromDexScreener(normalizedAddress, normalizedNetwork);
    
    if (!tokenData) {
      return NextResponse.json(
        { error: 'Token not found on DexScreener. Please ensure the token is listed on a DEX.' },
        { status: 404 }
      );
    }

    // If liquidity is too low, reject
    if (tokenData.liquidity < 100) {
      return NextResponse.json(
        { error: 'Token liquidity too low. Minimum $100 liquidity required.' },
        { status: 400 }
      );
    }

    // Check if we're providing a manual website URL
    let manualWebsiteUrl = body.websiteUrl;
    if (manualWebsiteUrl) {
      // Normalize the URL - add https:// if missing
      if (!manualWebsiteUrl.startsWith('http://') && !manualWebsiteUrl.startsWith('https://')) {
        manualWebsiteUrl = `https://${manualWebsiteUrl}`;
      }
      
      // Test the URL and follow redirects to get the final URL
      try {
        const testResponse = await fetch(manualWebsiteUrl, { 
          method: 'HEAD',
          redirect: 'follow'
        });
        
        // Use the final URL after redirects
        if (testResponse.ok || testResponse.status === 200 || testResponse.status === 301 || testResponse.status === 302) {
          // Get the final URL after redirects
          tokenData.website = testResponse.url || manualWebsiteUrl;
          console.log(`URL normalized: ${manualWebsiteUrl} → ${tokenData.website}`);
        } else {
          console.warn(`URL test failed with status ${testResponse.status}, using as-is`);
          tokenData.website = manualWebsiteUrl;
        }
      } catch (error) {
        console.error('Error testing URL:', error);
        // Use the URL as-is if test fails
        tokenData.website = manualWebsiteUrl;
      }
    }

    // If no website at all, return error with needsWebsite flag
    if (!tokenData.website) {
      return NextResponse.json(
        { 
          error: 'This token does not have a website listed on DexScreener.',
          needsWebsite: true,
          symbol: tokenData.symbol,
          liquidity: tokenData.liquidity
        },
        { status: 400 }
      );
    }

    // Call the project-ingestion edge function
    const ingestionUrl = `${supabaseUrl}/functions/v1/project-ingestion`;
    const ingestionResponse = await fetch(ingestionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contract_address: normalizedAddress,
        network: normalizedNetwork,
        symbol: tokenData.symbol,
        name: tokenData.name,
        pool_address: tokenData.poolAddress,
        website_url: tokenData.website || 'pending',
        source: 'manual',
        trigger_analysis: !!tokenData.website // Only trigger if we have a website
      })
    });

    if (!ingestionResponse.ok) {
      const errorText = await ingestionResponse.text();
      console.error('Ingestion failed:', errorText);
      return NextResponse.json(
        { error: 'Failed to add token. Please try again.' },
        { status: 500 }
      );
    }

    const ingestionResult = await ingestionResponse.json();

    // Prepare response with appropriate warnings
    const response: any = {
      success: true,
      tokenId: ingestionResult.project_id,
      symbol: tokenData.symbol,
      hasWebsite: !!tokenData.website,
      liquidity: tokenData.liquidity,
      priceUsd: ingestionResult.price_usd,
      marketCap: ingestionResult.market_cap,
      analysisStatus: tokenData.website ? 'pending' : 'not_applicable'
    };

    // We always have a website at this point (either from DexScreener or manual)
    response.message = 'Token added successfully! Website analysis in progress (may take 1-2 minutes).';

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in add-token API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}