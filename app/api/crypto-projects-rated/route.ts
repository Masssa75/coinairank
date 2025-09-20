import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sortBy = searchParams.get('sortBy') || 'website_stage1_score';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const minScore = parseFloat(searchParams.get('minScore') || '0');
    const maxScore = parseFloat(searchParams.get('maxScore') || '100');  // CAR uses 0-100 scale
    const network = searchParams.get('network');
    const networks = searchParams.get('networks'); // Support comma-separated list
    const tier = searchParams.get('tier');
    const searchQuery = searchParams.get('search') || '';
    const minLiquidity = parseFloat(searchParams.get('minLiquidity') || '0');
    const maxLiquidity = parseFloat(searchParams.get('maxLiquidity') || '1000000000');
    const tokenType = searchParams.get('tokenType');
    const includeUnverified = searchParams.get('includeUnverified') === 'true';
    const includeImposters = searchParams.get('includeImposters') === 'true';
    const minAge = searchParams.get('minAge') ? parseFloat(searchParams.get('minAge')!) : undefined;
    const maxAge = searchParams.get('maxAge') ? parseFloat(searchParams.get('maxAge')!) : undefined;
    const minMarketCap = searchParams.get('minMarketCap') ? parseFloat(searchParams.get('minMarketCap')!) : undefined;
    const maxMarketCap = searchParams.get('maxMarketCap') ? parseFloat(searchParams.get('maxMarketCap')!) : undefined;
    const projectId = searchParams.get('id'); // Add support for specific project ID
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // If requesting a specific project by ID, return just that project
    if (projectId) {
      const { data: project, error } = await supabase
        .from('crypto_projects_rated')
        .select('*')
        .eq('id', parseInt(projectId))
        .single();

      if (error) {
        console.error('Error fetching project by ID:', error);
        return NextResponse.json({ 
          error: 'Project not found',
          projects: [],
          totalCount: 0,
          totalPages: 0,
          currentPage: 1 
        }, { status: 404 });
      }

      return NextResponse.json({
        projects: [project],
        totalCount: 1,
        totalPages: 1,
        currentPage: 1
      });
    }
    
    // Build query for general listing
    let query = supabase
      .from('crypto_projects_rated')
      .select('*', { count: 'exact' });
    
    // Only apply score filters if minScore > 0 (to include unanalyzed tokens with null scores)
    if (minScore > 0) {
      query = query.gte('website_stage1_score', minScore);
    }
    if (maxScore < 100) {
      query = query.lte('website_stage1_score', maxScore);
    }
    
    // Only apply liquidity filters if they're not the defaults
    if (minLiquidity > 0) {
      query = query.gte('current_liquidity_usd', minLiquidity);
    }
    if (maxLiquidity < 1000000000) {
      query = query.lte('current_liquidity_usd', maxLiquidity);
    }
    
    // Filter out dead websites - only show active or pending (not yet checked)
    query = query.or('website_status.eq.active,website_status.eq.pending,website_status.is.null');
    
    // Apply network filter - support both single and multiple networks
    // By default (no filter), show ALL networks including custom ones
    if (networks) {
      // Multiple networks via comma-separated string
      const networkList = networks.split(',').filter(n => n.trim());

      // Check if "other" is included
      const hasOther = networkList.includes('other');
      const standardNetworks = ['ethereum', 'solana', 'bsc', 'base', 'pulsechain'];

      if (hasOther) {
        // Remove "other" from the list
        const withoutOther = networkList.filter(n => n !== 'other');

        if (withoutOther.length > 0) {
          // Include specific networks AND all non-standard networks
          // Build a list of all networks to include: specified ones + anything not in standardNetworks
          // This is complex with Supabase filters, so we'll use a different approach
          // Get all networks EXCEPT the standard ones we DON'T want
          const excludedNetworks = standardNetworks.filter(n => !withoutOther.includes(n));
          for (const net of excludedNetworks) {
            query = query.neq('network', net);
          }
        } else {
          // Only "other" selected - get all non-standard networks
          // Chain multiple neq conditions (they are AND by default)
          for (const net of standardNetworks) {
            query = query.neq('network', net);
          }
        }
      } else if (networkList.length > 0) {
        // No "other" - just filter by selected networks
        query = query.in('network', networkList);
      }
    } else if (network && network !== 'all') {
      // Single network (legacy support)
      query = query.eq('network', network);
    }
    // If no network filter specified, return ALL projects (default behavior)
    
    // Apply tier filter
    if (tier && tier !== 'all') {
      query = query.eq('website_stage1_tier', tier);
    }
    
    // Apply search filter
    if (searchQuery) {
      query = query.or(`symbol.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`);
    }
    
    // Apply token type filter
    if (tokenType && tokenType !== 'all') {
      query = query.eq('token_type', tokenType);
    }
    
    // Apply imposter filter - by default exclude imposters
    if (!includeImposters) {
      // Exclude tokens marked as imposters
      query = query.or('is_imposter.eq.false,is_imposter.is.null');
    }
    
    // Apply verified filter - by default exclude unverified tokens
    if (!includeUnverified) {
      // Only show tokens where contract_verification.found_on_site is true
      query = query.eq('contract_verification->>found_on_site', 'true');
    }

    // Apply age filters
    if (minAge !== undefined && minAge > 0) {
      query = query.gte('project_age_years', minAge);
    }
    if (maxAge !== undefined && maxAge < 10) {
      query = query.lte('project_age_years', maxAge);
    }

    // Apply market cap filters
    if (minMarketCap !== undefined && minMarketCap > 0) {
      query = query.gte('current_market_cap', minMarketCap);
    }
    if (maxMarketCap !== undefined && maxMarketCap > 0) {
      query = query.lte('current_market_cap', maxMarketCap);
    }
    
    // Apply sorting
    const validSortColumns = [
      'website_stage1_score',
      'current_liquidity_usd',
      'current_market_cap',
      'roi_percent',
      'project_age_years',
      'created_at',
      'website_stage1_analyzed_at'
    ];

    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'website_stage1_score';
    // Put nulls last when sorting by score (unanalyzed tokens go to the end)
    const nullsFirst = sortColumn === 'website_stage1_score' ? false : sortOrder === 'desc';
    query = query.order(sortColumn, { ascending: sortOrder === 'asc', nullsFirst });
    
    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);
    
    const { data, error, count } = await query;
    
    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // Calculate total pages
    const totalPages = Math.ceil((count || 0) / limit);
    
    return NextResponse.json({
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasMore: page < totalPages
      },
      filters: {
        sortBy: sortColumn,
        sortOrder,
        minScore,
        maxScore,
        network,
        tier,
        search: searchQuery,
        minLiquidity,
        maxLiquidity
      }
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}