#!/usr/bin/env node

/**
 * Batch reprocess ALL unprocessed tokens with improved error handling
 * Optimized for maximum throughput with longer timeouts
 */

require('dotenv').config({ path: '/Users/marcschwyn/Desktop/projects/CAR/.env' });
const fetch = require('node-fetch');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Configuration - optimized for reliability
const FETCH_TIMEOUT = 60000; // 60 seconds timeout (Phase 1 + Phase 2)
const DELAY_BETWEEN_TOKENS = 3000; // 3 seconds between tokens
const BATCH_SIZE = 10; // Process 10 at a time
const DELAY_BETWEEN_BATCHES = 10000; // 10 seconds between batches

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m'
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

async function fetchUnprocessedTokens() {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/crypto_projects_rated?select=id,symbol,website_url,contract_address,network,extraction_status,comparison_status&website_url=not.is.null&website_status=neq.dead&or=(extraction_status.neq.completed,comparison_status.neq.completed)&order=symbol.asc`,
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

async function processToken(token, index, total) {
  const progress = `[${index}/${total}]`;
  console.log(`\n${colors.bright}${colors.blue}${progress} Processing ${token.symbol}${colors.reset}`);
  console.log(`  Website: ${token.website_url}`);
  console.log(`  Current: Phase1=${token.extraction_status || 'none'}, Phase2=${token.comparison_status || 'none'}`);
  
  try {
    console.log(`  ${colors.yellow}→ Calling Phase 1 (with auto Phase 2)...${colors.reset}`);
    
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
      console.log(`    Signals: ${result.signals_count || 0}`);
      
      if (result.phase2_triggered) {
        console.log(`  ${colors.green}✓ Phase 2 complete!${colors.reset}`);
        console.log(`    Tier: ${result.phase2_tier}, Score: ${result.phase2_score}`);
      } else {
        console.log(`    ${colors.cyan}Phase 2 will complete shortly${colors.reset}`);
      }
      
      return { success: true, signals: result.signals_count, phase2: result.phase2_triggered };
    } else if (result.message?.includes('not accessible')) {
      console.log(`  ${colors.yellow}⚠ Website not accessible: ${result.message}${colors.reset}`);
      return { success: false, error: 'Website not accessible', skip: true };
    } else {
      throw new Error(result.error || result.message || 'Unknown error');
    }
    
  } catch (error) {
    console.error(`  ${colors.red}✗ Failed: ${error.message}${colors.reset}`);
    return { success: false, error: error.message };
  }
}

async function processBatch(tokens, batchNum, totalBatches, globalIndex, totalTokens) {
  console.log(`\n${colors.bright}${colors.magenta}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}BATCH ${batchNum}/${totalBatches} - Processing ${tokens.length} tokens${colors.reset}`);
  console.log(`${colors.magenta}${'='.repeat(60)}${colors.reset}`);
  
  const results = {
    successful: [],
    failed: [],
    skipped: []
  };
  
  for (let i = 0; i < tokens.length; i++) {
    const currentIndex = globalIndex + i;
    const result = await processToken(tokens[i], currentIndex, totalTokens);
    
    if (result.success) {
      results.successful.push(tokens[i].symbol);
    } else if (result.skip) {
      results.skipped.push({ symbol: tokens[i].symbol, reason: result.error });
    } else {
      results.failed.push({ symbol: tokens[i].symbol, error: result.error });
    }
    
    // Delay between tokens
    if (i < tokens.length - 1) {
      console.log(`${colors.cyan}  Waiting ${DELAY_BETWEEN_TOKENS/1000}s...${colors.reset}`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_TOKENS));
    }
  }
  
  // Batch summary
  console.log(`\n${colors.bright}Batch ${batchNum} Complete:${colors.reset}`);
  console.log(`  ${colors.green}✓ Successful: ${results.successful.length}${colors.reset}`);
  console.log(`  ${colors.yellow}⚠ Skipped: ${results.skipped.length}${colors.reset}`);
  console.log(`  ${colors.red}✗ Failed: ${results.failed.length}${colors.reset}`);
  
  return results;
}

async function main() {
  console.log(`${colors.bright}${colors.magenta}COMPREHENSIVE TOKEN REPROCESSING${colors.reset}`);
  console.log(`${colors.magenta}${'='.repeat(60)}${colors.reset}\n`);
  
  console.log(`${colors.cyan}Configuration:${colors.reset}`);
  console.log(`  - Timeout: ${FETCH_TIMEOUT/1000}s per request`);
  console.log(`  - Delay between tokens: ${DELAY_BETWEEN_TOKENS/1000}s`);
  console.log(`  - Batch size: ${BATCH_SIZE} tokens`);
  console.log(`  - Delay between batches: ${DELAY_BETWEEN_BATCHES/1000}s\n`);
  
  // Fetch all unprocessed tokens
  console.log(`${colors.yellow}Fetching unprocessed tokens...${colors.reset}`);
  const tokens = await fetchUnprocessedTokens();
  
  if (tokens.length === 0) {
    console.log(`${colors.green}All tokens have been processed!${colors.reset}`);
    return;
  }
  
  console.log(`${colors.cyan}Found ${tokens.length} tokens to process${colors.reset}`);
  
  // Calculate batches
  const totalBatches = Math.ceil(tokens.length / BATCH_SIZE);
  const estimatedTime = Math.ceil((tokens.length * (DELAY_BETWEEN_TOKENS + 30000) / 1000 / 60));
  
  console.log(`Will process in ${totalBatches} batches`);
  console.log(`Estimated time: ~${estimatedTime} minutes\n`);
  
  console.log(`${colors.yellow}Starting in 3 seconds...${colors.reset}`);
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Process all batches
  const overallResults = {
    successful: [],
    failed: [],
    skipped: []
  };
  
  for (let i = 0; i < totalBatches; i++) {
    const start = i * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, tokens.length);
    const batch = tokens.slice(start, end);
    
    const batchResults = await processBatch(batch, i + 1, totalBatches, start + 1, tokens.length);
    
    overallResults.successful.push(...batchResults.successful);
    overallResults.failed.push(...batchResults.failed);
    overallResults.skipped.push(...batchResults.skipped);
    
    // Delay between batches
    if (i < totalBatches - 1) {
      console.log(`\n${colors.cyan}Waiting ${DELAY_BETWEEN_BATCHES/1000}s before next batch...${colors.reset}`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }
  
  // Final summary
  console.log(`\n${colors.bright}${colors.magenta}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}FINAL SUMMARY${colors.reset}`);
  console.log(`${colors.magenta}${'='.repeat(60)}${colors.reset}\n`);
  
  console.log(`${colors.green}✓ Successfully processed: ${overallResults.successful.length}/${tokens.length}${colors.reset}`);
  if (overallResults.successful.length > 0 && overallResults.successful.length <= 20) {
    console.log(`  ${overallResults.successful.join(', ')}`);
  }
  
  if (overallResults.skipped.length > 0) {
    console.log(`\n${colors.yellow}⚠ Skipped (dead websites): ${overallResults.skipped.length}${colors.reset}`);
    if (overallResults.skipped.length <= 10) {
      overallResults.skipped.forEach(s => {
        console.log(`  ${s.symbol}: ${s.reason}`);
      });
    }
  }
  
  if (overallResults.failed.length > 0) {
    console.log(`\n${colors.red}✗ Failed: ${overallResults.failed.length}${colors.reset}`);
    if (overallResults.failed.length <= 10) {
      overallResults.failed.forEach(f => {
        console.log(`  ${f.symbol}: ${f.error}`);
      });
    } else {
      console.log(`  Too many to list. First 10:`);
      overallResults.failed.slice(0, 10).forEach(f => {
        console.log(`  ${f.symbol}: ${f.error}`);
      });
    }
  }
  
  console.log(`\n${colors.cyan}Note: Phase 2 will complete automatically for all successful tokens.${colors.reset}`);
  console.log(`${colors.cyan}Use the "Show Only Reprocessed" filter to view completed tokens.${colors.reset}`);
}

main().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});