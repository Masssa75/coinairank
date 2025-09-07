const { test, expect } = require('@playwright/test');

test.describe('KTA Token Filter Bug', () => {
  test('KTA visibility issue with Include Unverified filter', async ({ page }) => {
    console.log('\n=== Testing KTA Filter Bug ===\n');
    
    // Step 1: Navigate to the main page
    await page.goto('https://coinairank.com', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Check if KTA is visible initially (it shouldn't be)
    console.log('1. Initial state - checking if KTA is visible...');
    let ktaVisible = await page.locator('text=KTA').first().isVisible().catch(() => false);
    console.log(`   KTA visible initially: ${ktaVisible}`);
    
    // Step 2: Check "Include Unverified" checkbox
    console.log('\n2. Checking "Include Unverified" checkbox...');
    // The checkbox is within a label, so we need to find it differently
    const unverifiedLabel = page.locator('label:has-text("Include Unverified")');
    const unverifiedCheckbox = unverifiedLabel.locator('input[type="checkbox"]');
    const isUnverifiedChecked = await unverifiedCheckbox.isChecked();
    console.log(`   Unverified checkbox initially checked: ${isUnverifiedChecked}`);
    
    if (!isUnverifiedChecked) {
      await unverifiedCheckbox.click();
      await page.waitForTimeout(1000);
    }
    
    ktaVisible = await page.locator('text=KTA').first().isVisible().catch(() => false);
    console.log(`   KTA visible after checking Unverified: ${ktaVisible}`);
    
    // Step 3: Refresh the page
    console.log('\n3. Refreshing the page...');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Check filter states after refresh
    const unverifiedAfterRefresh = await page.locator('input[type="checkbox"]').filter({ hasText: /Include Unverified/i }).first().isChecked();
    console.log(`   Unverified checkbox after refresh: ${unverifiedAfterRefresh}`);
    
    ktaVisible = await page.locator('text=KTA').first().isVisible().catch(() => false);
    console.log(`   KTA visible after refresh: ${ktaVisible} <-- BUG: Should be true!`);
    
    // Step 4: Test the workaround - uncheck Include Imposters
    console.log('\n4. Testing workaround - unchecking "Include Imposters"...');
    const impostersLabel = page.locator('label:has-text("Include Imposters")');
    const impostersCheckbox = impostersLabel.locator('input[type="checkbox"]');
    const isImpostersChecked = await impostersCheckbox.isChecked();
    console.log(`   Imposters checkbox initially: ${isImpostersChecked}`);
    
    if (isImpostersChecked) {
      await impostersCheckbox.click();
      await page.waitForTimeout(1000);
    }
    
    ktaVisible = await page.locator('text=KTA').first().isVisible().catch(() => false);
    console.log(`   KTA visible after unchecking Imposters: ${ktaVisible}`);
    
    // Step 5: Re-check Include Imposters
    console.log('\n5. Re-checking "Include Imposters"...');
    await impostersCheckbox.click();
    await page.waitForTimeout(1000);
    
    ktaVisible = await page.locator('text=KTA').first().isVisible().catch(() => false);
    console.log(`   KTA visible after re-checking Imposters: ${ktaVisible}`);
    
    // Step 6: Refresh again to confirm bug
    console.log('\n6. Refreshing again to confirm bug...');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    const finalUnverified = await page.locator('input[type="checkbox"]').filter({ hasText: /Include Unverified/i }).first().isChecked();
    const finalImposters = await impostersCheckbox.isChecked();
    ktaVisible = await page.locator('text=KTA').first().isVisible().catch(() => false);
    
    console.log(`   Final state after refresh:`);
    console.log(`   - Include Unverified: ${finalUnverified}`);
    console.log(`   - Include Imposters: ${finalImposters}`);
    console.log(`   - KTA visible: ${ktaVisible} <-- BUG persists!`);
    
    // Additional debugging - check localStorage
    console.log('\n7. Checking localStorage for filter state...');
    const filterState = await page.evaluate(() => {
      return {
        raw: localStorage.getItem('projectFilters'),
        parsed: JSON.parse(localStorage.getItem('projectFilters') || '{}')
      };
    });
    console.log('   localStorage filterState:', JSON.stringify(filterState.parsed, null, 2));
    
    // Check what's actually in the DOM
    console.log('\n8. Checking what tokens are visible in DOM...');
    const visibleTokens = await page.locator('.grid > a').evaluateAll(elements => {
      return elements.slice(0, 5).map(el => {
        const symbol = el.querySelector('h3')?.textContent || '';
        const badges = Array.from(el.querySelectorAll('.text-xs')).map(b => b.textContent);
        return { symbol, badges };
      });
    });
    console.log('   First 5 visible tokens:', visibleTokens);
    
    // Look for KTA specifically in the API response
    console.log('\n9. Checking if KTA exists in the data...');
    const ktaInData = await page.evaluate(async () => {
      const response = await fetch('/api/crypto-projects-rated');
      const data = await response.json();
      const kta = data.projects.find(p => p.symbol === 'KTA');
      return kta ? {
        symbol: kta.symbol,
        tier: kta.website_stage1_tier,
        score: kta.website_stage1_score,
        contract_on_website: kta.contract_verification?.found_on_site,
        is_imposter: kta.is_imposter
      } : null;
    });
    console.log('   KTA data from API:', ktaInData);
  });
});