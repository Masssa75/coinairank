import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Missing environment variables' }, { status: 500 });
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  try {
    const { tokenId, feedback } = await request.json();
    
    if (!tokenId) {
      return NextResponse.json({ error: 'Token ID required' }, { status: 400 });
    }

    // Update the signal_feedback column for this token
    const { data, error } = await supabase
      .from('crypto_projects_rated')
      .update({ signal_feedback: feedback })
      .eq('id', tokenId)
      .select()
      .single();

    if (error) {
      console.error('Error updating signal feedback:', error);
      return NextResponse.json({ error: 'Failed to update feedback' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in signal-feedback API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}