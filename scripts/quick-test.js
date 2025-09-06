#!/usr/bin/env node

/**
 * Quick test - just trigger Phase 1 and exit
 */

require('dotenv').config({ path: '/Users/marcschwyn/Desktop/projects/CAR/.env' });
const fetch = require('node-fetch');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Testing with EPEP token...');
console.log('SUPABASE_URL:', SUPABASE_URL ? 'Set' : 'Not set');
console.log('SUPABASE_SERVICE_KEY:', SUPABASE_SERVICE_KEY ? 'Set' : 'Not set');

async function test() {
  // First fetch EPEP
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/crypto_projects_rated?select=id,symbol,website_url,contract_address,network&symbol=eq.EPEP&limit=1`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    }
  );
  
  const tokens = await response.json();
  const token = tokens[0];
  
  if (!token) {
    console.log('EPEP not found!');
    return;
  }
  
  console.log('Found EPEP:', token);
  
  // Call Phase 1
  console.log('\nCalling Phase 1...');
  const phase1Response = await fetch(`${SUPABASE_URL}/functions/v1/website-analyzer`, {
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
  
  console.log('Response status:', phase1Response.status);
  const result = await phase1Response.json();
  console.log('Result:', JSON.stringify(result, null, 2));
}

test().catch(console.error);