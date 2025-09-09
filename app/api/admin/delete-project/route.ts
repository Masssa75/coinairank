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

export async function DELETE(request: NextRequest) {
  try {
    // Check admin authentication
    if (!verifyAdmin(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
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

    // Delete the project from the database
    const { error } = await supabase
      .from('crypto_projects_rated')
      .delete()
      .eq('id', projectId);

    if (error) {
      console.error('Error deleting project:', error);
      return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Project deleted successfully' 
    });

  } catch (error) {
    console.error('Error in delete-project API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}