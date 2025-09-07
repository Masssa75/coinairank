const { test, expect } = require('@playwright/test');

test('KTA visibility bug with AI Score sort and Include Unverified', async ({ page }) => {
  console.log('\n=== Testing Exact KTA Bug Progression ===\n');
  
  // Step 1: Navigate and open filters
  await page.goto('https://coinairank.com', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // Open filter sidebar
  console.log('1. Opening filter sidebar...');
  const filterButton = page.locator('button:has-text("Filters")');
  if (await filterButton.isVisible()) {
    await filterButton.click();
    await page.waitForTimeout(1000);
  }
  
  // Step 2: Set Sort by to AI Score
  console.log('\n2. Setting Sort by to AI Score...');
  const sortDropdown = page.locator('select').filter({ hasText: /Sort/i }).or(page.locator('select').first());
  await sortDropdown.selectOption({ label: 'AI Score' });
  await page.waitForTimeout(1000);
  
  // Check if KTA is visible
  let ktaVisible = await page.locator('h3:text("KTA")').isVisible().catch(() => false);
  console.log(`   KTA visible with AI Score sort: ${ktaVisible}`);
  
  // Step 3: Check "Include Unverified" checkbox
  console.log('\n3. Checking "Include Unverified"...');
  const unverifiedCheckbox = page.locator('label:has-text("Include Unverified") input[type="checkbox"]');
  const isUnverifiedChecked = await unverifiedCheckbox.isChecked();
  console.log(`   Include Unverified initially: ${isUnverifiedChecked}`);
  
  if (!isUnverifiedChecked) {
    await unverifiedCheckbox.click();
    await page.waitForTimeout(1000);
  }
  
  ktaVisible = await page.locator('h3:text("KTA")').isVisible().catch(() => false);
  console.log(`   KTA visible after checking Unverified: ${ktaVisible} <-- Should be true!`);
  
  // Step 4: Check "Include Imposters"
  console.log('\n4. Checking "Include Imposters"...');
  const impostersCheckbox = page.locator('label:has-text("Include Imposters") input[type="checkbox"]');
  const isImpostersChecked = await impostersCheckbox.isChecked();
  console.log(`   Include Imposters initially: ${isImpostersChecked}`);
  
  if (!isImpostersChecked) {
    await impostersCheckbox.click();
    await page.waitForTimeout(1000);
  }
  
  ktaVisible = await page.locator('h3:text("KTA")').isVisible().catch(() => false);
  console.log(`   KTA visible after checking Imposters: ${ktaVisible}`);
  
  // Step 5: Uncheck "Include Imposters"
  console.log('\n5. Unchecking "Include Imposters"...');
  await impostersCheckbox.click();
  await page.waitForTimeout(1000);
  
  ktaVisible = await page.locator('h3:text("KTA")').isVisible().catch(() => false);
  console.log(`   KTA visible after unchecking Imposters: ${ktaVisible} <-- Should still be true!`);
  
  // Step 6: Refresh the page
  console.log('\n6. Refreshing the page...');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // Open filter sidebar again to check states
  if (await filterButton.isVisible()) {
    await filterButton.click();
    await page.waitForTimeout(1000);
  }
  
  // Check filter states after refresh
  const sortValueAfter = await sortDropdown.inputValue();
  const unverifiedAfter = await unverifiedCheckbox.isChecked();
  const impostersAfter = await impostersCheckbox.isChecked();
  
  console.log('\n7. Filter states after refresh:');
  console.log(`   Sort by: ${sortValueAfter === 'score' ? 'AI Score' : sortValueAfter}`);
  console.log(`   Include Unverified: ${unverifiedAfter}`);
  console.log(`   Include Imposters: ${impostersAfter}`);
  
  ktaVisible = await page.locator('h3:text("KTA")').isVisible().catch(() => false);
  console.log(`   KTA visible after refresh: ${ktaVisible} <-- BUG! Should be true!`);
  
  // Step 8: Check localStorage
  console.log('\n8. Checking localStorage...');
  const localStorage = await page.evaluate(() => {
    const filters = localStorage.getItem('projectFilters');
    const sort = localStorage.getItem('projectSort');
    return {
      filters: filters ? JSON.parse(filters) : null,
      sort: sort
    };
  });
  console.log('   localStorage:', JSON.stringify(localStorage, null, 2));
  
  // Step 9: Check what the API returns
  console.log('\n9. Checking API response...');
  const apiResponse = await page.evaluate(async () => {
    const response = await fetch('/api/crypto-projects-rated');
    const data = await response.json();
    const projects = Array.isArray(data) ? data : (data.projects || []);
    const kta = projects.find(p => p.symbol === 'KTA');
    
    return {
      totalProjects: projects.length,
      ktaFound: !!kta,
      ktaDetails: kta ? {
        symbol: kta.symbol,
        tier: kta.website_stage1_tier,
        score: kta.website_stage1_score,
        is_imposter: kta.is_imposter,
        contract_on_website: kta.contract_verification?.found_on_site
      } : null
    };
  });
  
  console.log('   API Response:');
  console.log(`     Total projects: ${apiResponse.totalProjects}`);
  console.log(`     KTA in API: ${apiResponse.ktaFound}`);
  if (apiResponse.ktaDetails) {
    console.log(`     KTA details:`, apiResponse.ktaDetails);
  }
  
  // Step 10: Manually check the first few visible tokens
  console.log('\n10. First 5 visible tokens:');
  const visibleTokens = await page.locator('.grid > a h3').evaluateAll(elements => {
    return elements.slice(0, 5).map(el => el.textContent);
  });
  visibleTokens.forEach((token, i) => {
    console.log(`     ${i + 1}. ${token}`);
  });
  
  // Take final screenshot
  await page.screenshot({ path: 'kta-bug-final-state.png' });
  console.log('\nScreenshot saved as kta-bug-final-state.png');
});