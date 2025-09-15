import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// GET /api/admin/benchmarks - Fetch all benchmarks
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const cookieStore = await cookies();
    const adminAuth = cookieStore.get('admin_auth');

    if (!adminAuth?.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch benchmarks from Supabase
    const { data, error } = await supabase
      .from('website_tier_benchmarks')
      .select('*')
      .order('tier', { ascending: true })
      .order('signal_category', { ascending: true });

    if (error) {
      console.error('Error fetching benchmarks:', error);
      return NextResponse.json({ error: 'Failed to fetch benchmarks' }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in GET /api/admin/benchmarks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/benchmarks - Create new benchmark
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const cookieStore = await cookies();
    const adminAuth = cookieStore.get('admin_auth');

    if (!adminAuth?.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.benchmark_signal || !body.signal_category) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Insert new benchmark
    const { data, error } = await supabase
      .from('website_tier_benchmarks')
      .insert([{
        tier: body.tier,
        tier_name: body.tier_name,
        min_score: body.min_score,
        max_score: body.max_score,
        benchmark_signal: body.benchmark_signal,
        signal_category: body.signal_category,
        is_active: body.is_active ?? true,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating benchmark:', error);
      return NextResponse.json({ error: 'Failed to create benchmark' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in POST /api/admin/benchmarks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}