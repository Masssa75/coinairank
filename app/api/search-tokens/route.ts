import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      return NextResponse.json({ coins: [] });
    }

    // Search CoinGecko (no API key needed for search endpoint)
    const response = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`,
      {
        headers: {
          'Accept': 'application/json',
        },
        // Cache for 5 minutes to reduce API calls
        next: { revalidate: 300 }
      }
    );

    if (!response.ok) {
      console.error('CoinGecko search failed:', response.status);
      return NextResponse.json({ coins: [] });
    }

    const data = await response.json();

    // Return simplified results
    const coins = data.coins?.slice(0, 15).map((coin: any) => ({
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      thumb: coin.thumb,
      large: coin.large,
      marketCapRank: coin.market_cap_rank,
      // Add a flag to indicate if we need to fetch more data
      needsData: true
    })) || [];

    return NextResponse.json({ coins });

  } catch (error) {
    console.error('Error searching tokens:', error);
    return NextResponse.json({ coins: [] });
  }
}

// Fetch detailed token data including platforms
export async function POST(request: NextRequest) {
  try {
    const { coinId } = await request.json();

    if (!coinId) {
      return NextResponse.json({ error: 'Coin ID required' }, { status: 400 });
    }

    // Fetch detailed coin data
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false`,
      {
        headers: {
          'Accept': 'application/json',
        }
      }
    );

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch token details' }, { status: 400 });
    }

    const data = await response.json();

    // Extract platforms (contract addresses)
    const platforms = data.platforms || {};

    // Extract useful links
    const links = {
      website: data.links?.homepage?.[0] || null,
      whitepaper: data.links?.whitepaper || null,
      twitter: data.links?.twitter_screen_name ? `https://twitter.com/${data.links.twitter_screen_name}` : null,
      telegram: data.links?.telegram_channel_identifier ? `https://t.me/${data.links.telegram_channel_identifier}` : null,
    };

    // Determine if it's a native L1 token
    // A token is native if:
    // 1. It has no platforms at all
    // 2. It only has its own chain as a platform (e.g., RON only on "ronin" chain)
    const platformKeys = Object.keys(platforms);
    const isNativeToken = !platforms ||
                         platformKeys.length === 0 ||
                         (platformKeys.length === 1 && platformKeys[0] === data.id);

    return NextResponse.json({
      id: data.id,
      symbol: data.symbol,
      name: data.name,
      platforms,
      isNativeToken,
      links,
      image: data.image?.large || data.image?.small,
      marketCapRank: data.market_cap_rank,
      categories: data.categories || []
    });

  } catch (error) {
    console.error('Error fetching token details:', error);
    return NextResponse.json({ error: 'Failed to fetch token details' }, { status: 500 });
  }
}