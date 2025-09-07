const { test, expect } = require('@playwright/test');

test('KTA visibility bug - correct reproduction', async ({ page }) => {
  console.log('\n=== Testing KTA Bug with Correct Selectors ===\n');
  
  // Step 1: Navigate to the page
  await page.goto('https://coinairank.com', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // Step 2: Open filter sidebar (click the expand button)
  console.log('1. Opening filter sidebar...');
  const expandButton = page.locator('button[title="Expand Filters"]').or(page.locator('button').filter({ has: page.locator('svg') }).first());
  if (await expandButton.isVisible()) {
    await expandButton.click();
    await page.waitForTimeout(1000);
  }
  
  // Step 3: Set Sort to AI Score
  console.log('\n2. Setting Sort by to AI Score...');
  const sortDropdown = page.locator('select');
  await sortDropdown.selectOption('website_stage1_score'); // The correct value for AI Score
  await page.waitForTimeout(1000);
  
  // Check if KTA is visible
  let ktaVisible = await page.locator('h3:text("KTA")').isVisible().catch(() => false);
  console.log(`   KTA visible with AI Score sort: ${ktaVisible}`);
  
  // Step 4: Click "Include Unverified" (it's a label with custom checkbox)
  console.log('\n3. Checking "Include Unverified"...');
  const unverifiedLabel = page.locator('label:has-text("Include Unverified")');
  
  // Check if it's already checked by looking for the checkmark
  const unverifiedChecked = await unverifiedLabel.locator('.text-black:has-text("✓")').isVisible().catch(() => false);
  console.log(`   Include Unverified initially checked: ${unverifiedChecked}`);
  
  if (!unverifiedChecked) {
    await unverifiedLabel.click();
    await page.waitForTimeout(1500);
  }
  
  ktaVisible = await page.locator('h3:text("KTA")').isVisible().catch(() => false);
  console.log(`   KTA visible after checking Unverified: ${ktaVisible} <-- Should be true!`);
  
  // Step 5: Click "Include Imposters"
  console.log('\n4. Checking "Include Imposters"...');
  const impostersLabel = page.locator('label:has-text("Include Imposters")');
  
  const impostersChecked = await impostersLabel.locator('.text-black:has-text("✓")').isVisible().catch(() => false);
  console.log(`   Include Imposters initially checked: ${impostersChecked}`);
  
  if (!impostersChecked) {
    await impostersLabel.click();
    await page.waitForTimeout(1500);
  }
  
  ktaVisible = await page.locator('h3:text("KTA")').isVisible().catch(() => false);
  console.log(`   KTA visible after checking Imposters: ${ktaVisible}`);
  
  // Step 6: Uncheck "Include Imposters"
  console.log('\n5. Unchecking "Include Imposters"...');
  await impostersLabel.click();
  await page.waitForTimeout(1500);
  
  ktaVisible = await page.locator('h3:text("KTA")').isVisible().catch(() => false);
  console.log(`   KTA visible after unchecking Imposters: ${ktaVisible} <-- Should still be true!`);
  
  // Step 7: Get localStorage before refresh
  console.log('\n6. Checking localStorage before refresh...');
  const localStorageBefore = await page.evaluate(() => {
    return {
      filters: JSON.parse(localStorage.getItem('projectFilters') || '{}'),
      sort: localStorage.getItem('projectSort')
    };
  });
  console.log('   localStorage before refresh:', JSON.stringify(localStorageBefore, null, 2));
  
  // Step 8: Refresh the page
  console.log('\n7. Refreshing the page...');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // Check localStorage after refresh
  const localStorageAfter = await page.evaluate(() => {
    return {
      filters: JSON.parse(localStorage.getItem('projectFilters') || '{}'),
      sort: localStorage.getItem('projectSort')
    };
  });
  console.log('   localStorage after refresh:', JSON.stringify(localStorageAfter, null, 2));
  
  // Open filter sidebar again
  if (await expandButton.isVisible()) {
    await expandButton.click();
    await page.waitForTimeout(1000);
  }
  
  // Check filter states after refresh
  const sortValue = await sortDropdown.inputValue();
  const unverifiedAfter = await unverifiedLabel.locator('.text-black:has-text("✓")').isVisible().catch(() => false);
  const impostersAfter = await impostersLabel.locator('.text-black:has-text("✓")').isVisible().catch(() => false);
  
  console.log('\n8. Filter states after refresh:');
  console.log(`   Sort by: ${sortValue === 'score' ? 'AI Score' : sortValue}`);
  console.log(`   Include Unverified: ${unverifiedAfter}`);
  console.log(`   Include Imposters: ${impostersAfter}`);
  
  ktaVisible = await page.locator('h3:text("KTA")').isVisible().catch(() => false);
  console.log(`   KTA visible after refresh: ${ktaVisible} <-- BUG! Should be true!`);
  
  // Step 9: Debug - Check what's in the API response
  console.log('\n9. Checking what API returns...');
  const apiData = await page.evaluate(async () => {
    const response = await fetch('/api/crypto-projects-rated');
    const data = await response.json();
    const projects = Array.isArray(data) ? data : data.projects || [];
    const kta = projects.find(p => p.symbol === 'KTA');
    
    // Also check what filters are being applied
    const url = new URL(window.location.href);
    
    return {
      ktaExists: !!kta,
      ktaData: kta ? {
        symbol: kta.symbol,
        tier: kta.website_stage1_tier,
        score: kta.website_stage1_score,
        is_imposter: kta.is_imposter,
        contract_on_website: kta.contract_verification?.found_on_site
      } : null,
      totalProjects: projects.length,
      urlParams: url.search
    };
  });
  
  console.log('   API Response:');
  console.log(`     KTA exists in API: ${apiData.ktaExists}`);
  if (apiData.ktaData) {
    console.log(`     KTA data:`, apiData.ktaData);
  }
  console.log(`     Total projects in API: ${apiData.totalProjects}`);
  console.log(`     URL params: ${apiData.urlParams || 'none'}`);
  
  // Step 10: Check visible tokens
  console.log('\n10. First 10 visible tokens on page:');
  const visibleTokens = await page.locator('.grid > a').evaluateAll(elements => {
    return elements.slice(0, 10).map(el => {
      const symbol = el.querySelector('h3')?.textContent || '';
      const tier = el.querySelector('.text-xs')?.textContent || '';
      return `${symbol} (${tier})`;
    });
  });
  visibleTokens.forEach((token, i) => {
    console.log(`     ${i + 1}. ${token}`);
  });
  
  // Take screenshot
  await page.screenshot({ path: 'kta-bug-state.png', fullPage: true });
  console.log('\nFull page screenshot saved as kta-bug-state.png');
});