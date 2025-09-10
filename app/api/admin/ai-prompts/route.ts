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
    // Find the EXTRACTION_PROMPT variable assignment
    const promptMatch = fileContent.match(/const EXTRACTION_PROMPT = `([\s\S]*?)`;/);
    
    if (!promptMatch) {
      return NextResponse.json({ error: 'Could not find prompt in edge function' }, { status: 404 });
    }
    
    const promptTemplate = promptMatch[1];
    
    // Extract current signal-based scoring from the prompt
    const tier1SignalsMatch = promptTemplate.match(/🎯 TIER 1 SIGNALS.*?:([\s\S]*?)🔍 DEEP DIVE/);
    const step1Step2Match = promptTemplate.match(/STEP 1:([\s\S]*?)STEP 2:([\s\S]*?)From your discovered links/);
    const stage2LinksMatch = promptTemplate.match(/"stage_2_links": \[([\s\S]*?)\]/);
    
    const scoringInfo = {
      tier1Signals: tier1SignalsMatch ? tier1SignalsMatch[1].trim().split('\n').filter(line => line.trim().startsWith('-')).map(line => line.trim()) : [],
      extractionInstructions: [
        'Extract ALL links found in the HTML and return them in discovered_links array',
        'Find every <a>, <button>, and clickable element with URLs',
        'From discovered links, select most valuable for Stage 2 analysis',
        'Explain WHY each stage_2_link was selected for deeper analysis'
      ],
      stage2Structure: stage2LinksMatch ? `"stage_2_links": [${stage2LinksMatch[1].trim()}]` : '"stage_2_links": [{ "url": "link-url", "reasoning": "why selected" }]',
      currentFocus: 'Stage 2 Link Selection (Phase 1) - 2-step process with reasoning'
    };
    
    // Extract the parseHtmlContent function to show what data is extracted
    const parseLogicMatch = fileContent.match(/function parseHtmlContent[\s\S]*?return \{[\s\S]*?\};/);
    
    // Extract key configuration from actual edge function
    const config = {
      scraperApiUsed: fileContent.includes('SCRAPERAPI_KEY'),
      aiModel: fileContent.includes('moonshotai/kimi-k2') ? 'moonshotai/kimi-k2' : (fileContent.includes('moonshotai/kimi-k1') ? 'moonshotai/kimi-k1' : 'unknown'),
      renderWaitTime: '3000ms (with 5000ms retry)',
      maxTextContent: '15000 characters',
      temperature: fileContent.includes('temperature: 0.4') ? '0.4' : '0.3',
      maxTokens: fileContent.includes('max_tokens: 3000') ? '3000' : '1000',
      responseFormat: fileContent.includes('response_format: { type: "json_object" }') ? 'JSON Object' : 'Text'
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