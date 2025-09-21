import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const symbol = searchParams.get('symbol');
  const handle = searchParams.get('handle');
  const projectId = searchParams.get('projectId');

  if (!action || !symbol || !handle || !projectId) {
    return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Proxy to Supabase Edge Function with proper Authorization header
  const targetUrl = `${supabaseUrl}/functions/v1/x-signal-analyzer-v3?` +
    new URLSearchParams({
      action,
      symbol,
      handle,
      projectId,
      apikey: supabaseAnonKey
    });

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Failed to connect to analyzer' }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Stream the SSE response back to client
    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}