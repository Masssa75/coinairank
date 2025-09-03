import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  // Check if admin is enabled (optional security)
  if (process.env.ADMIN_PANEL_DISABLED === 'true') {
    return NextResponse.json({ error: 'Admin panel is disabled' }, { status: 403 });
  }

  try {
    // Read the edge function file
    const edgeFunctionPath = path.join(
      process.cwd(),
      'supabase',
      'functions',
      'website-analyzer',
      'index.ts'
    );
    
    const fileContent = fs.readFileSync(edgeFunctionPath, 'utf-8');
    
    // Extract the prompt from the analyzeWithAI function
    // Find the prompt variable assignment
    const promptMatch = fileContent.match(/const prompt = `([\s\S]*?)`;/);
    
    if (!promptMatch) {
      return NextResponse.json({ error: 'Could not find prompt in edge function' }, { status: 404 });
    }
    
    const promptTemplate = promptMatch[1];
    
    // Also extract the scoring logic and tier classifications
    const scoringInfo = {
      memeTokenCategories: [
        'community_strength (0-14): Social media presence, community links, engagement indicators',
        'brand_identity (0-14): Memorable concept, clear theme/character, viral potential',
        'website_quality (0-14): Professional design, working features, visual appeal',
        'authenticity (0-14): Original concept vs copycat, unique value proposition',
        'transparency (0-14): Clear tokenomics, supply info, no hidden mechanics',
        'safety_signals (0-14): Contract verification, security measures, liquidity info',
        'accessibility (0-14): Team communication, community access, clear social links'
      ],
      utilityTokenCategories: [
        'technical_infrastructure (0-14): GitHub repos, APIs, developer resources',
        'business_utility (0-14): Real use case, problem-solving, market need',
        'documentation_quality (0-14): Whitepapers, technical docs, guides',
        'community_social (0-14): Active community, social presence, user engagement',
        'security_trust (0-14): Audits, security info, transparency measures',
        'team_transparency (0-14): Team info, backgrounds, LinkedIn, credentials',
        'website_presentation (0-14): Professional design, working features'
      ],
      tierClassifications: [
        '0-29: "TRASH" (Poor quality, likely scam or very low effort)',
        '30-59: "BASIC" (Some effort, but missing key elements)',
        '60-84: "SOLID" (Good quality, professional, most elements present)',
        '85-100: "ALPHA" (Exceptional, all elements perfect for its type)'
      ]
    };
    
    // Extract the parseHtmlContent function to show what data is extracted
    const parseLogicMatch = fileContent.match(/function parseHtmlContent[\s\S]*?return \{[\s\S]*?\};/);
    
    // Extract key configuration
    const config = {
      scraperApiUsed: fileContent.includes('SCRAPERAPI_KEY'),
      aiModel: fileContent.includes('moonshotai/kimi-k2') ? 'moonshotai/kimi-k2' : 'unknown',
      renderWaitTime: '3000ms (with 5000ms retry)',
      maxTextContent: '15000 characters',
      temperature: '0.3',
      maxTokens: '1000'
    };
    
    return NextResponse.json({
      promptTemplate,
      scoringInfo,
      config,
      lastModified: new Date().toISOString(),
      filePath: 'supabase/functions/website-analyzer/index.ts'
    });
    
  } catch (error) {
    console.error('Error reading AI prompts:', error);
    return NextResponse.json(
      { error: 'Failed to read AI prompts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}