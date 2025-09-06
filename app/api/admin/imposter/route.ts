import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Verify admin authentication
function verifyAdmin(request: NextRequest): boolean {
  const authCookie = request.cookies.get('admin_auth');
  if (!authCookie) return false;
  
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;
  
  const expectedToken = crypto
    .createHash('sha256')
    .update(adminPassword + (process.env.ADMIN_SECRET || 'default-secret'))
    .digest('hex');
    
  return authCookie.value === expectedToken;
}

export async function POST(request: NextRequest) {
  // Check admin authentication
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { projectId, isImposter } = await request.json();
    
    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Update the is_imposter flag
    const { data, error } = await supabase
      .from('crypto_projects_rated')
      .update({ is_imposter: isImposter })
      .eq('id', projectId)
      .select()
      .single();

    if (error) {
      console.error('Database update error:', error);
      return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      data: {
        id: data.id,
        symbol: data.symbol,
        is_imposter: data.is_imposter
      }
    });
  } catch (error) {
    console.error('Error updating imposter status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}