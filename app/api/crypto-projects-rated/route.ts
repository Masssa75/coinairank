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
    const tier = searchParams.get('tier');
    const searchQuery = searchParams.get('search') || '';
    const minLiquidity = parseFloat(searchParams.get('minLiquidity') || '0');
    const maxLiquidity = parseFloat(searchParams.get('maxLiquidity') || '1000000000');
    const tokenType = searchParams.get('tokenType');
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Build query
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
    
    // Apply network filter
    if (network && network !== 'all') {
      query = query.eq('network', network);
    }
    
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
    
    // Apply sorting
    const validSortColumns = [
      'website_stage1_score',
      'current_liquidity_usd',
      'current_market_cap',
      'current_roi_percent',
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