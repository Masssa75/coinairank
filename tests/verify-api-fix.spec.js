const { test } = require('@playwright/test');

test('Verify API ID parameter fix is working', async ({ page }) => {
  page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));
  
  await page.goto('https://coinairank.com');
  await page.waitForTimeout(2000);

  // Test the API fix directly
  console.log('Testing API ID parameter support...');
  
  const apiTest = await page.evaluate(async () => {
    try {
      // First get a token that exists (should return from main listing)
      console.log('1. Getting token list...');
      const listResponse = await fetch('/api/crypto-projects-rated?page=1&limit=1');
      const listData = await listResponse.json();
      
      if (!listData.projects || listData.projects.length === 0) {
        return { error: 'No tokens found in listing' };
      }
      
      const firstToken = listData.projects[0];
      console.log('Found token:', firstToken.id, firstToken.symbol);
      
      // Now test the ID-specific endpoint (this was broken before)
      console.log('2. Testing ID-specific query...');
      const idResponse = await fetch(`/api/crypto-projects-rated?id=${firstToken.id}`);
      const idData = await idResponse.json();
      
      return {
        success: true,
        listResponse: {
          status: listResponse.status,
          tokenCount: listData.projects.length,
          firstTokenId: firstToken.id,
          firstTokenSymbol: firstToken.symbol
        },
        idResponse: {
          status: idResponse.status,
          tokenCount: idData.projects?.length || 0,
          returnedTokenId: idData.projects?.[0]?.id,
          returnedTokenSymbol: idData.projects?.[0]?.symbol,
          matches: idData.projects?.[0]?.id === firstToken.id
        }
      };
    } catch (error) {
      return { error: error.message };
    }
  });

  console.log('API Test Results:', JSON.stringify(apiTest, null, 2));

  if (apiTest.success) {
    if (apiTest.idResponse.matches) {
      console.log('🎉 SUCCESS: API ID parameter fix is working!');
      console.log('- General listing works correctly');
      console.log('- ID-specific queries now return the correct token');
      console.log('- Progress tracker polling should now work properly');
    } else {
      console.log('❌ ISSUE: ID query returned different token than expected');
    }
  } else {
    console.log('❌ ERROR:', apiTest.error);
  }

  // Test the progress tracker workflow end-to-end
  console.log('\n=== Testing Progress Tracker Workflow ===');
  
  const workflowTest = await page.evaluate(async () => {
    try {
      // Step 1: Submit an existing token (should get 409 with tokenId)
      const submitResponse = await fetch('/api/add-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractAddress: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce', // SHIB
          network: 'ethereum'
        })
      });
      const submitData = await submitResponse.json();
      
      if (submitResponse.status !== 409 || !submitData.tokenId) {
        return { error: 'Expected 409 response with tokenId', submitResponse: submitData };
      }
      
      // Step 2: Test progress tracking API call (this should now work)
      const progressResponse = await fetch(`/api/crypto-projects-rated?id=${submitData.tokenId}`);
      const progressData = await progressResponse.json();
      
      return {
        success: true,
        step1: {
          status: submitResponse.status,
          hasTokenId: !!submitData.tokenId,
          tokenId: submitData.tokenId,
          symbol: submitData.symbol
        },
        step2: {
          status: progressResponse.status,
          hasProject: progressData.projects?.length > 0,
          projectSymbol: progressData.projects?.[0]?.symbol,
          projectMatches: progressData.projects?.[0]?.symbol === submitData.symbol
        }
      };
    } catch (error) {
      return { error: error.message };
    }
  });

  console.log('Workflow Test Results:', JSON.stringify(workflowTest, null, 2));

  if (workflowTest.success && workflowTest.step2.projectMatches) {
    console.log('🚀 COMPLETE SUCCESS: Full progress tracker workflow is working!');
    console.log('✅ Token submission returns tokenId');
    console.log('✅ Progress tracking API fetches correct project');
    console.log('✅ Modal should show progress bars and stages correctly');
  } else {
    console.log('⚠️ Workflow test had issues - check the results above');
  }
});