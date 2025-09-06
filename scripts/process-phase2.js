#!/usr/bin/env node

/**
 * Process Phase 2 for tokens stuck with extraction_status='completed' but comparison_status!='completed'
 */

require('dotenv').config({ path: '/Users/marcschwyn/Desktop/projects/CAR/.env' });
const fetch = require('node-fetch');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

async function fetchStuckTokens() {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/crypto_projects_rated?select=id,symbol,extraction_status,comparison_status&extraction_status=eq.completed&comparison_status=neq.completed`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch tokens: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`${colors.red}Error fetching stuck tokens:${colors.reset}`, error);
    return [];
  }
}

async function processPhase2(token) {
  console.log(`\n${colors.cyan}Processing Phase 2 for ${token.symbol}...${colors.reset}`);
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/website-analyzer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phase: 2,
        projectId: token.id,
        symbol: token.symbol
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API ${response.status}: ${errorText.substring(0, 200)}`);
    }
    
    const result = await response.json();
    
    if (result.success || result.final_tier) {
      console.log(`  ${colors.green}✓ Phase 2 complete!${colors.reset}`);
      console.log(`    Tier: ${result.final_tier || result.website_stage1_tier}`);
      console.log(`    Score: ${result.final_score || result.website_stage1_score}`);
      return { success: true, tier: result.final_tier, score: result.final_score };
    } else {
      throw new Error(result.error || 'Unknown error');
    }
    
  } catch (error) {
    console.error(`  ${colors.red}✗ Failed: ${error.message}${colors.reset}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log(`${colors.bright}${colors.magenta}Phase 2 Processing for Stuck Tokens${colors.reset}`);
  console.log(`${colors.magenta}${'='.repeat(50)}${colors.reset}\n`);
  
  // Fetch stuck tokens
  console.log(`${colors.yellow}Fetching tokens stuck between phases...${colors.reset}`);
  const stuckTokens = await fetchStuckTokens();
  
  if (stuckTokens.length === 0) {
    console.log(`${colors.green}No stuck tokens found! All tokens have completed Phase 2.${colors.reset}`);
    return;
  }
  
  console.log(`${colors.cyan}Found ${stuckTokens.length} stuck tokens${colors.reset}`);
  console.log(`Tokens: ${stuckTokens.map(t => t.symbol).join(', ')}\n`);
  
  const results = {
    successful: [],
    failed: []
  };
  
  // Process each stuck token
  for (const token of stuckTokens) {
    const result = await processPhase2(token);
    
    if (result.success) {
      results.successful.push({
        symbol: token.symbol,
        tier: result.tier,
        score: result.score
      });
    } else {
      results.failed.push({
        symbol: token.symbol,
        error: result.error
      });
    }
    
    // Small delay between tokens
    if (stuckTokens.indexOf(token) < stuckTokens.length - 1) {
      console.log(`${colors.cyan}Waiting 2 seconds...${colors.reset}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Summary
  console.log(`\n${colors.bright}${colors.magenta}${'='.repeat(50)}${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}SUMMARY${colors.reset}`);
  console.log(`${colors.magenta}${'='.repeat(50)}${colors.reset}\n`);
  
  if (results.successful.length > 0) {
    console.log(`${colors.green}✓ Successful: ${results.successful.length}${colors.reset}`);
    results.successful.forEach(s => {
      console.log(`  ${s.symbol}: Tier ${s.tier}, Score ${s.score}`);
    });
  }
  
  if (results.failed.length > 0) {
    console.log(`\n${colors.red}✗ Failed: ${results.failed.length}${colors.reset}`);
    results.failed.forEach(f => {
      console.log(`  ${f.symbol}: ${f.error}`);
    });
  }
}

main().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});