#!/usr/bin/env node

/**
 * Test reprocessing for specific tokens
 * Usage: node test-reprocess.js KTA MMA EPEP
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

async function fetchTokenBySymbol(symbol) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/crypto_projects_rated?select=*&symbol=eq.${symbol}&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch token: ${response.status}`);
    }
    
    const tokens = await response.json();
    return tokens[0] || null;
  } catch (error) {
    console.error(`${colors.red}Error fetching ${symbol}:${colors.reset}`, error);
    return null;
  }
}

async function processToken(token) {
  console.log(`\n${colors.bright}${colors.cyan}Processing ${token.symbol}${colors.reset}`);
  console.log(`${'='.repeat(50)}`);
  console.log(`ID: ${token.id}`);
  console.log(`Website: ${token.website_url}`);
  console.log(`Network: ${token.network}`);
  console.log(`Current Phase 1: ${token.extraction_status || 'not started'}`);
  console.log(`Current Phase 2: ${token.comparison_status || 'not started'}`);
  console.log(`Current Score: ${token.website_stage1_score || 'N/A'}`);
  console.log(`Current Tier: ${token.website_stage1_tier || 'N/A'}`);
  
  console.log(`\n${colors.yellow}Calling Phase 1...${colors.reset}`);
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/website-analyzer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phase: 1,
        projectId: token.id,
        symbol: token.symbol,
        websiteUrl: token.website_url,
        contractAddress: token.contract_address,
        network: token.network
      })
    });
    
    const responseText = await response.text();
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${responseText}`);
    }
    
    const result = JSON.parse(responseText);
    
    if (result.success) {
      console.log(`${colors.green}✓ Phase 1 complete!${colors.reset}`);
      console.log(`  Signals found: ${result.signals_count || 0}`);
      console.log(`  Red flags: ${result.red_flags?.length || 0}`);
      console.log(`  Has rich summary: ${result.has_rich_summary ? 'Yes' : 'No'}`);
      console.log(`  Extraction status: ${result.extraction_status}`);
      
      console.log(`\n${colors.yellow}Phase 2 will auto-trigger in ~2 seconds...${colors.reset}`);
      
      // Wait a bit then check Phase 2 results
      console.log(`Waiting 15 seconds for Phase 2 to complete...`);
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      // Fetch updated token to see Phase 2 results
      const updatedToken = await fetchTokenBySymbol(token.symbol);
      if (updatedToken) {
        console.log(`\n${colors.bright}Final Results:${colors.reset}`);
        console.log(`  Phase 2 Status: ${updatedToken.comparison_status || 'pending'}`);
        console.log(`  Final Score: ${updatedToken.website_stage1_score || 'N/A'}`);
        console.log(`  Final Tier: ${updatedToken.website_stage1_tier || 'N/A'}`);
        
        if (updatedToken.benchmark_comparison?.strongest_signal) {
          console.log(`  Strongest Signal: ${updatedToken.benchmark_comparison.strongest_signal.signal}`);
        }
      }
      
      return true;
    } else {
      throw new Error(result.error || 'Unknown error');
    }
    
  } catch (error) {
    console.error(`${colors.red}✗ Failed: ${error.message}${colors.reset}`);
    return false;
  }
}

async function main() {
  console.log(`${colors.bright}${colors.magenta}Token Reprocessing Test${colors.reset}`);
  console.log(`${colors.magenta}${'='.repeat(50)}${colors.reset}\n`);
  
  // Get symbols from command line
  const symbols = process.argv.slice(2);
  
  if (symbols.length === 0) {
    console.log(`${colors.yellow}Usage: node test-reprocess.js [SYMBOL1] [SYMBOL2] ...${colors.reset}`);
    console.log(`Example: node test-reprocess.js KTA MMA EPEP`);
    console.log(`\nOr run without arguments to test default tokens...`);
    
    // Default test tokens
    symbols.push('KTA', 'MMA', 'EPEP', 'BRAINROT');
    console.log(`\n${colors.cyan}Testing with default tokens: ${symbols.join(', ')}${colors.reset}\n`);
  }
  
  const results = {
    successful: [],
    failed: [],
    notFound: []
  };
  
  for (const symbol of symbols) {
    const token = await fetchTokenBySymbol(symbol);
    
    if (!token) {
      console.log(`${colors.red}✗ Token ${symbol} not found in database${colors.reset}`);
      results.notFound.push(symbol);
      continue;
    }
    
    const success = await processToken(token);
    if (success) {
      results.successful.push(symbol);
    } else {
      results.failed.push(symbol);
    }
    
    // Wait between tokens
    if (symbols.indexOf(symbol) < symbols.length - 1) {
      console.log(`\n${colors.cyan}Waiting 5 seconds before next token...${colors.reset}`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  // Print summary
  console.log(`\n${colors.bright}${'='.repeat(50)}${colors.reset}`);
  console.log(`${colors.bright}Test Complete${colors.reset}`);
  console.log(`${'='.repeat(50)}\n`);
  
  if (results.successful.length > 0) {
    console.log(`${colors.green}✓ Successful: ${results.successful.join(', ')}${colors.reset}`);
  }
  if (results.failed.length > 0) {
    console.log(`${colors.red}✗ Failed: ${results.failed.join(', ')}${colors.reset}`);
  }
  if (results.notFound.length > 0) {
    console.log(`${colors.yellow}⚠ Not Found: ${results.notFound.join(', ')}${colors.reset}`);
  }
}

// Run the script
main().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});