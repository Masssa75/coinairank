import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';

export async function GET() {
  // Check authentication
  const cookieStore = await cookies();
  const adminAuth = cookieStore.get('admin-auth');
  
  if (!adminAuth?.value || adminAuth.value !== 'true') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Read the edge function file
    const edgeFunctionPath = path.join(process.cwd(), 'supabase/functions/website-discovery/index.ts');
    const fileContent = fs.readFileSync(edgeFunctionPath, 'utf-8');
    
    // Extract the TRADING_PLATFORM_DOMAINS array
    const match = fileContent.match(/const TRADING_PLATFORM_DOMAINS = \[([\s\S]*?)\];/);
    
    if (!match) {
      return NextResponse.json({ error: 'Could not find domains in edge function' }, { status: 500 });
    }
    
    // Parse the domains from the matched content
    const domainsContent = match[1];
    const domains = domainsContent
      .split('\n')
      .map(line => {
        // Extract domain from lines like '  'pump.fun',' or '  // Comment'
        const domainMatch = line.match(/['"]([^'"]+)['"]/);
        return domainMatch ? domainMatch[1] : null;
      })
      .filter(domain => domain !== null);
    
    return NextResponse.json({ domains });
  } catch (error) {
    console.error('Error reading edge function:', error);
    return NextResponse.json({ 
      error: 'Failed to read edge function file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}