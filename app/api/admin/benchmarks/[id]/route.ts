import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// PUT /api/admin/benchmarks/[id] - Update benchmark
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const cookieStore = cookies();
    const adminAuth = cookieStore.get('admin_auth');

    if (!adminAuth?.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const benchmarkId = parseInt(params.id);

    if (isNaN(benchmarkId)) {
      return NextResponse.json({ error: 'Invalid benchmark ID' }, { status: 400 });
    }

    // Update benchmark
    const { data, error } = await supabase
      .from('website_tier_benchmarks')
      .update({
        tier: body.tier,
        tier_name: body.tier_name,
        min_score: body.min_score,
        max_score: body.max_score,
        benchmark_signal: body.benchmark_signal,
        signal_category: body.signal_category,
        is_active: body.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', benchmarkId)
      .select()
      .single();

    if (error) {
      console.error('Error updating benchmark:', error);
      return NextResponse.json({ error: 'Failed to update benchmark' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in PUT /api/admin/benchmarks/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/benchmarks/[id] - Delete benchmark
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const cookieStore = cookies();
    const adminAuth = cookieStore.get('admin_auth');

    if (!adminAuth?.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const benchmarkId = parseInt(params.id);

    if (isNaN(benchmarkId)) {
      return NextResponse.json({ error: 'Invalid benchmark ID' }, { status: 400 });
    }

    // Delete benchmark
    const { error } = await supabase
      .from('website_tier_benchmarks')
      .delete()
      .eq('id', benchmarkId);

    if (error) {
      console.error('Error deleting benchmark:', error);
      return NextResponse.json({ error: 'Failed to delete benchmark' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/admin/benchmarks/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}