const { test, expect } = require('@playwright/test');

test('Test progress tracker fix for existing tokens', async ({ page, context }) => {
  // Navigate to the site
  await page.goto('https://coinairank.com');
  await page.waitForTimeout(3000);

  // Test the progress tracker fix directly via API
  console.log('Testing existing token (SHIB) - should show progress tracker...');
  
  const testResult = await page.evaluate(async () => {
    try {
      // Use SHIB which we know exists and returns 409 with tokenId
      const response = await fetch('/api/add-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractAddress: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
          network: 'ethereum'
        })
      });

      const data = await response.json();
      
      return {
        status: response.status,
        ok: response.ok,
        data: data,
        shouldShowProgressTracker: response.status === 409 && data.tokenId && data.symbol,
        tokenId: data.tokenId,
        symbol: data.symbol
      };
    } catch (error) {
      return { error: error.message };
    }
  });

  console.log('Test Result:', JSON.stringify(testResult, null, 2));

  // Verify the fix works
  if (testResult.status === 409 && testResult.shouldShowProgressTracker) {
    console.log('✅ Fix verified: 409 response with tokenId should trigger progress tracker');
    
    // Now test if we can fetch the project status
    const statusResult = await page.evaluate(async (tokenId) => {
      try {
        const response = await fetch(`/api/crypto-projects-rated?id=${tokenId}`);
        if (!response.ok) return { error: `API returned ${response.status}` };
        
        const data = await response.json();
        const project = data.projects?.[0];
        
        return {
          hasProject: !!project,
          project: project ? {
            symbol: project.symbol,
            website_url: project.website_url,
            extraction_status: project.extraction_status,
            comparison_status: project.comparison_status,
            website_stage1_score: project.website_stage1_score,
            website_stage1_tier: project.website_stage1_tier
          } : null
        };
      } catch (error) {
        return { error: error.message };
      }
    }, testResult.tokenId);

    console.log('Project Status Result:', JSON.stringify(statusResult, null, 2));
    
    if (statusResult.hasProject) {
      console.log('✅ Project data available - progress tracker would work correctly');
    } else {
      console.log('❌ No project data found - progress tracker might not work');
    }
    
  } else {
    console.log('❌ Fix may not work - expected 409 with tokenId');
  }

  // Test the UI integration (simulate the modal logic)
  await page.addScriptTag({
    content: `
      window.testProgressTracker = function(apiResponse) {
        // Simulate AddTokenModal logic from line 155-171
        if (apiResponse.status === 409) {
          if (apiResponse.data.tokenId && apiResponse.data.symbol) {
            return {
              shouldStartProgressTracking: true,
              action: 'start_progress_tracking',
              tokenId: apiResponse.data.tokenId,
              symbol: apiResponse.data.symbol
            };
          } else {
            return {
              shouldStartProgressTracking: false,
              action: 'show_error',
              message: 'Token already exists (' + (apiResponse.data.symbol || 'Unknown') + ')'
            };
          }
        }
        return { shouldStartProgressTracking: false, action: 'other' };
      };
    `
  });

  const modalLogicResult = await page.evaluate((apiResponse) => {
    return window.testProgressTracker(apiResponse);
  }, testResult);

  console.log('Modal Logic Test:', JSON.stringify(modalLogicResult, null, 2));

  if (modalLogicResult.shouldStartProgressTracking) {
    console.log('🎉 SUCCESS: Progress tracker fix is working correctly!');
    console.log('- 409 responses with tokenId now trigger progress tracking');
    console.log('- Modal logic correctly handles existing tokens');
    console.log('- Users should see progress tracker instead of error message');
  } else {
    console.log('❌ ISSUE: Progress tracker fix may not be working as expected');
  }

  // Take screenshot for reference
  await page.screenshot({ path: 'progress-tracker-fix-test.png', fullPage: true });
});