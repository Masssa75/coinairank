#!/usr/bin/env node

/**
 * Quick reprocessing script with timeout and better error handling
 * Usage: node quick-reprocess.js [--limit=N]
 */

require('dotenv').config({ path: '/Users/marcschwyn/Desktop/projects/CAR/.env' });
const fetch = require('node-fetch');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Configuration
const FETCH_TIMEOUT = 30000; // 30 seconds timeout for edge function
const DELAY_BETWEEN_TOKENS = 5000; // 5 seconds between tokens

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

// Fetch with timeout
async function fetchWithTimeout(url, options, timeout = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout/1000} seconds`);
    }
    throw error;
  }
}

async function fetchActiveTokens(limit) {
  try {
    const query = new URLSearchParams({
      select: 'id,symbol,website_url,contract_address,network,extraction_status,comparison_status,website_stage1_score,website_stage1_tier',
      website_url: 'not.is.null',
      website_status: 'neq.dead',
      order: 'symbol.asc'
    });
    
    if (limit) {
      query.append('limit', limit);
    }
    
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/crypto_projects_rated?${query}`,
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
    console.error(`${colors.red}Error fetching tokens:${colors.reset}`, error);
    return [];
  }
}

async function processToken(token) {
  console.log(`\n${colors.bright}${colors.cyan}[${token.symbol}]${colors.reset}`);
  console.log(`  Website: ${token.website_url}`);
  console.log(`  Current: Phase1=${token.extraction_status || 'none'}, Phase2=${token.comparison_status || 'none'}, Score=${token.website_stage1_score || 'N/A'}`);
  
  try {
    console.log(`  ${colors.yellow}→ Calling Phase 1...${colors.reset}`);
    
    const response = await fetchWithTimeout(
      `${SUPABASE_URL}/functions/v1/website-analyzer`,
      {
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
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API ${response.status}: ${errorText.substring(0, 100)}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`  ${colors.green}✓ Phase 1 complete!${colors.reset}`);
      console.log(`    Signals: ${result.signals_count || 0}, Summary: ${result.has_rich_summary ? 'Yes' : 'No'}`);
      console.log(`    ${colors.cyan}Phase 2 will auto-trigger in ~2 seconds${colors.reset}`);
      return { success: true, signals: result.signals_count };
    } else {
      throw new Error(result.error || 'Unknown error');
    }
    
  } catch (error) {
    console.error(`  ${colors.red}✗ Failed: ${error.message}${colors.reset}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log(`${colors.bright}${colors.magenta}Quick Token Reprocessing${colors.reset}`);
  console.log(`${colors.magenta}${'='.repeat(40)}${colors.reset}\n`);
  
  // Parse arguments
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 10;
  
  console.log(`${colors.cyan}Configuration:${colors.reset}`);
  console.log(`  - Limit: ${limit} tokens`);
  console.log(`  - Timeout: ${FETCH_TIMEOUT/1000}s per request`);
  console.log(`  - Delay: ${DELAY_BETWEEN_TOKENS/1000}s between tokens\n`);
  
  // Fetch tokens
  console.log(`${colors.yellow}Fetching active tokens...${colors.reset}`);
  const tokens = await fetchActiveTokens(limit);
  
  if (tokens.length === 0) {
    console.log(`${colors.yellow}No tokens to process${colors.reset}`);
    return;
  }
  
  console.log(`${colors.green}Found ${tokens.length} tokens to process${colors.reset}`);
  
  // Stats
  const needsPhase1 = tokens.filter(t => t.extraction_status !== 'completed').length;
  const needsPhase2 = tokens.filter(t => t.extraction_status === 'completed' && t.comparison_status !== 'completed').length;
  const complete = tokens.filter(t => t.comparison_status === 'completed').length;
  
  console.log(`  - Need Phase 1: ${needsPhase1}`);
  console.log(`  - Need Phase 2: ${needsPhase2}`);
  console.log(`  - Complete (will reprocess): ${complete}\n`);
  
  console.log(`${colors.yellow}Starting in 3 seconds...${colors.reset}`);
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Process tokens
  const results = {
    successful: [],
    failed: []
  };
  
  for (let i = 0; i < tokens.length; i++) {
    console.log(`\n${colors.bright}[${i+1}/${tokens.length}]${colors.reset}`);
    
    const result = await processToken(tokens[i]);
    
    if (result.success) {
      results.successful.push(tokens[i].symbol);
    } else {
      results.failed.push({ symbol: tokens[i].symbol, error: result.error });
    }
    
    // Delay between tokens
    if (i < tokens.length - 1) {
      console.log(`\n${colors.cyan}Waiting ${DELAY_BETWEEN_TOKENS/1000}s...${colors.reset}`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_TOKENS));
    }
  }
  
  // Summary
  console.log(`\n${colors.bright}${colors.magenta}${'='.repeat(40)}${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}SUMMARY${colors.reset}`);
  console.log(`${colors.magenta}${'='.repeat(40)}${colors.reset}\n`);
  
  console.log(`${colors.green}✓ Successful: ${results.successful.length}${colors.reset}`);
  if (results.successful.length > 0) {
    console.log(`  ${results.successful.join(', ')}`);
  }
  
  if (results.failed.length > 0) {
    console.log(`\n${colors.red}✗ Failed: ${results.failed.length}${colors.reset}`);
    results.failed.forEach(f => {
      console.log(`  ${f.symbol}: ${f.error}`);
    });
  }
  
  console.log(`\n${colors.cyan}Note: Phase 2 will complete automatically for each token.${colors.reset}`);
  console.log(`${colors.cyan}Check results in ~30 seconds with: npm run check-results${colors.reset}`);
}

main().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});