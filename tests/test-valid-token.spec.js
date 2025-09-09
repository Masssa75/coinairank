const { test, expect } = require('@playwright/test');

test('Test progress tracker with valid token', async ({ page }) => {
  page.on('console', msg => console.log(`CONSOLE: ${msg.text()}`));

  await page.goto('https://coinairank.com');
  await page.waitForTimeout(3000);

  // Test with a popular token that should be on DexScreener
  // Using USDC on Ethereum which should definitely be listed
  const usdcAddress = '0xa0b86991c31cc966748616c36c4416a47b9d2e'; // USDC on Ethereum
  
  console.log('Testing with USDC token...');
  
  const apiTestResult = await page.evaluate(async (contractAddress) => {
    try {
      const response = await fetch('/api/add-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contractAddress: contractAddress,
          network: 'ethereum'
        })
      });

      const data = await response.json();
      
      return {
        status: response.status,
        ok: response.ok,
        data: data,
        hasTokenId: !!data.tokenId,
        hasSymbol: !!data.symbol,
        errorMessage: data.error
      };
    } catch (error) {
      return {
        error: error.message,
        status: 'fetch_failed'
      };
    }
  }, usdcAddress);

  console.log('USDC API Result:', JSON.stringify(apiTestResult, null, 2));

  if (apiTestResult.status === 409) {
    console.log('✅ Token already exists (conflict) - this should still provide tokenId for progress tracking');
  } else if (apiTestResult.hasTokenId) {
    console.log('✅ Token added successfully with tokenId - progress tracker should work');
  } else {
    console.log('❌ Still no tokenId - checking different token...');
  }

  // Also test with a smaller, newer token that might work
  const testToken2 = '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce'; // SHIB
  
  const apiTest2 = await page.evaluate(async (contractAddress) => {
    try {
      const response = await fetch('/api/add-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contractAddress: contractAddress,
          network: 'ethereum'
        })
      });

      const data = await response.json();
      
      return {
        status: response.status,
        ok: response.ok,
        data: data,
        hasTokenId: !!data.tokenId,
        hasSymbol: !!data.symbol,
        errorMessage: data.error
      };
    } catch (error) {
      return {
        error: error.message,
        status: 'fetch_failed'
      };
    }
  }, testToken2);

  console.log('SHIB API Result:', JSON.stringify(apiTest2, null, 2));
});