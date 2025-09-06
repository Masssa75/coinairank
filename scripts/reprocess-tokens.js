#!/usr/bin/env node

/**
 * Reprocess tokens through Phase 1 + Phase 2 analysis
 * Phase 1 auto-triggers Phase 2, so we only need to call Phase 1
 */

require('dotenv').config({ path: '/Users/marcschwyn/Desktop/projects/CAR/.env' });
const fetch = require('node-fetch');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BATCH_SIZE = 5; // Process 5 tokens at a time
const DELAY_BETWEEN_TOKENS = 3000; // 3 seconds between tokens
const DELAY_BETWEEN_BATCHES = 10000; // 10 seconds between batches

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

// Track results
const results = {
  successful: [],
  failed: [],
  skipped: []
};

async function fetchTokensToProcess(limit = null) {
  console.log(`${colors.cyan}Fetching tokens from database...${colors.reset}`);
  
  try {
    // Fetch tokens that have websites but might need reprocessing
    // Order by those without Phase 2 data first, then by oldest analysis
    let url = `${SUPABASE_URL}/rest/v1/crypto_projects_rated?select=id,symbol,website_url,contract_address,network,extraction_status,comparison_status,website_stage1_analyzed_at&website_url=not.is.null&website_status=neq.dead&order=comparison_status.nullsfirst,website_stage1_analyzed_at.asc`;
    
    if (limit) {
      url += `&limit=${limit}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch tokens: ${response.status}`);
    }
    
    const tokens = await response.json();
    
    console.log(`${colors.green}Found ${tokens.length} tokens to process${colors.reset}`);
    
    // Show summary of token states
    const needsPhase1 = tokens.filter(t => t.extraction_status !== 'completed').length;
    const needsPhase2 = tokens.filter(t => t.extraction_status === 'completed' && t.comparison_status !== 'completed').length;
    const fullComplete = tokens.filter(t => t.comparison_status === 'completed').length;
    
    console.log(`${colors.bright}Token Status:${colors.reset}`);
    console.log(`  - Need Phase 1: ${needsPhase1}`);
    console.log(`  - Need Phase 2: ${needsPhase2}`);
    console.log(`  - Fully complete: ${fullComplete} (will reprocess)`);
    
    return tokens;
  } catch (error) {
    console.error(`${colors.red}Error fetching tokens:${colors.reset}`, error);
    return [];
  }
}

async function processToken(token) {
  console.log(`\n${colors.bright}Processing ${token.symbol}...${colors.reset}`);
  console.log(`  Website: ${token.website_url}`);
  console.log(`  Current status: Phase 1 = ${token.extraction_status || 'pending'}, Phase 2 = ${token.comparison_status || 'pending'}`);
  
  try {
    // Call Phase 1 (which will auto-trigger Phase 2)
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
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API returned ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`  ${colors.green}✓ Phase 1 complete${colors.reset}`);
      console.log(`    - Signals found: ${result.signals_count || 0}`);
      console.log(`    - Has rich summary: ${result.has_rich_summary ? 'Yes' : 'No'}`);
      console.log(`    - ${colors.yellow}Phase 2 will auto-trigger in ~2 seconds${colors.reset}`);
      
      results.successful.push({
        symbol: token.symbol,
        signals: result.signals_count
      });
      
      return true;
    } else {
      throw new Error(result.error || 'Unknown error');
    }
    
  } catch (error) {
    console.error(`  ${colors.red}✗ Failed: ${error.message}${colors.reset}`);
    results.failed.push({
      symbol: token.symbol,
      error: error.message
    });
    return false;
  }
}

async function processBatch(tokens, batchNumber, totalBatches) {
  console.log(`\n${colors.magenta}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.magenta}Batch ${batchNumber}/${totalBatches} - Processing ${tokens.length} tokens${colors.reset}`);
  console.log(`${colors.magenta}${'='.repeat(60)}${colors.reset}`);
  
  for (let i = 0; i < tokens.length; i++) {
    await processToken(tokens[i]);
    
    // Delay between tokens to avoid rate limiting
    if (i < tokens.length - 1) {
      console.log(`${colors.cyan}Waiting ${DELAY_BETWEEN_TOKENS/1000} seconds before next token...${colors.reset}`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_TOKENS));
    }
  }
  
  console.log(`\n${colors.bright}Batch ${batchNumber} complete${colors.reset}`);
}

async function main() {
  console.log(`${colors.bright}${colors.cyan}Token Reprocessing Script${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(40)}${colors.reset}\n`);
  
  // Check for command line arguments
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;
  
  if (limit) {
    console.log(`${colors.yellow}Limiting to first ${limit} tokens${colors.reset}\n`);
  }
  
  // Fetch tokens to process
  const tokens = await fetchTokensToProcess(limit);
  
  if (tokens.length === 0) {
    console.log(`${colors.yellow}No tokens to process${colors.reset}`);
    return;
  }
  
  // Ask for confirmation
  console.log(`\n${colors.yellow}Ready to process ${tokens.length} tokens in batches of ${BATCH_SIZE}${colors.reset}`);
  console.log(`Estimated time: ~${Math.ceil(tokens.length * (DELAY_BETWEEN_TOKENS/1000) / 60)} minutes`);
  console.log(`\n${colors.bright}Press Enter to continue or Ctrl+C to cancel...${colors.reset}`);
  
  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });
  
  // Process in batches
  const batches = [];
  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    batches.push(tokens.slice(i, i + BATCH_SIZE));
  }
  
  console.log(`\n${colors.bright}Starting processing...${colors.reset}`);
  console.log(`Total batches: ${batches.length}\n`);
  
  for (let i = 0; i < batches.length; i++) {
    await processBatch(batches[i], i + 1, batches.length);
    
    // Delay between batches
    if (i < batches.length - 1) {
      console.log(`${colors.cyan}Waiting ${DELAY_BETWEEN_BATCHES/1000} seconds before next batch...${colors.reset}`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }
  
  // Print summary
  console.log(`\n${colors.bright}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}Processing Complete${colors.reset}`);
  console.log(`${'='.repeat(60)}\n`);
  
  console.log(`${colors.green}Successful: ${results.successful.length} tokens${colors.reset}`);
  if (results.successful.length > 0) {
    results.successful.forEach(t => {
      console.log(`  ✓ ${t.symbol} (${t.signals} signals)`);
    });
  }
  
  if (results.failed.length > 0) {
    console.log(`\n${colors.red}Failed: ${results.failed.length} tokens${colors.reset}`);
    results.failed.forEach(t => {
      console.log(`  ✗ ${t.symbol}: ${t.error}`);
    });
  }
  
  console.log(`\n${colors.bright}Note: Phase 2 scoring happens automatically ~2 seconds after Phase 1${colors.reset}`);
  console.log(`${colors.yellow}Check the database in a few minutes to see complete results${colors.reset}`);
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log(`\n\n${colors.yellow}Processing interrupted${colors.reset}`);
  console.log(`Successful: ${results.successful.length}, Failed: ${results.failed.length}`);
  process.exit(0);
});

// Run the script
main().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});