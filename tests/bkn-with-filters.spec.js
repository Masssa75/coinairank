const { test, expect } = require('@playwright/test');

test('Verify BKN with all filters enabled', async ({ page }) => {
  console.log('Opening coinairank.com with all filters...');
  
  await page.goto('https://coinairank.com');
  await page.waitForTimeout(5000);
  
  // Look for and enable filter options
  console.log('Enabling all filter options...');
  
  // Look for filter checkboxes or toggles
  const unverifiedFilter = page.locator('input[type="checkbox"], button, label').filter({ hasText: /unverified/i });
  const impostersFilter = page.locator('input[type="checkbox"], button, label').filter({ hasText: /imposters?/i });
  const allTokensFilter = page.locator('input[type="checkbox"], button, label').filter({ hasText: /all/i });
  
  // Try to enable unverified filter
  const unverifiedVisible = await unverifiedFilter.first().isVisible({ timeout: 5000 }).catch(() => false);
  if (unverifiedVisible) {
    await unverifiedFilter.first().click();
    console.log('✅ Enabled unverified filter');
    await page.waitForTimeout(1000);
  } else {
    console.log('❌ Unverified filter not found');
  }
  
  // Try to enable imposters filter
  const impostersVisible = await impostersFilter.first().isVisible({ timeout: 5000 }).catch(() => false);
  if (impostersVisible) {
    await impostersFilter.first().click();
    console.log('✅ Enabled imposters filter');
    await page.waitForTimeout(1000);
  } else {
    console.log('❌ Imposters filter not found');
  }
  
  // Try to enable "show all" filter
  const allVisible = await allTokensFilter.first().isVisible({ timeout: 5000 }).catch(() => false);
  if (allVisible) {
    await allTokensFilter.first().click();
    console.log('✅ Enabled show all filter');
    await page.waitForTimeout(1000);
  } else {
    console.log('❌ Show all filter not found');
  }
  
  // Look for any filter sidebar or dropdown
  const filterButton = page.locator('button, div').filter({ hasText: /filter/i }).first();
  const filterVisible = await filterButton.isVisible({ timeout: 5000 }).catch(() => false);
  if (filterVisible) {
    await filterButton.click();
    console.log('✅ Opened filters');
    await page.waitForTimeout(2000);
    
    // Look for checkboxes in the filter area
    const checkboxes = page.locator('input[type="checkbox"]');
    const checkboxCount = await checkboxes.count();
    console.log(`Found ${checkboxCount} filter checkboxes`);
    
    // Enable all checkboxes
    for (let i = 0; i < checkboxCount; i++) {
      const checkbox = checkboxes.nth(i);
      const isChecked = await checkbox.isChecked();
      if (!isChecked) {
        await checkbox.click();
        console.log(`✅ Enabled checkbox ${i+1}`);
      }
    }
    await page.waitForTimeout(2000);
  }
  
  // Now look for BKN
  console.log('Searching for BKN after enabling filters...');
  const bknText = page.locator('text=BKN');
  const bknVisible = await bknText.isVisible({ timeout: 10000 }).catch(() => false);
  console.log('BKN visible after filters:', bknVisible);
  
  if (bknVisible) {
    console.log('✅ BKN found! Clicking to see details...');
    
    // Click on BKN
    await bknText.first().click();
    await page.waitForTimeout(3000);
    
    // Look for SOLID tier and score
    const solidBadge = page.locator('text=SOLID');
    const score75 = page.locator('text=75');
    const brickkenText = page.locator('text=brickken', 'text=Brickken');
    
    const solidVisible = await solidBadge.isVisible().catch(() => false);
    const scoreVisible = await score75.isVisible().catch(() => false);
    const brickkenVisible = await brickkenText.isVisible().catch(() => false);
    
    console.log('SOLID tier visible:', solidVisible);
    console.log('Score 75 visible:', scoreVisible);
    console.log('Brickken text visible:', brickkenVisible);
    
    // Look for stage 2 links in tooltip/modal
    const detailsArea = page.locator('[role="dialog"], .modal, .tooltip, .details');
    const detailsVisible = await detailsArea.first().isVisible({ timeout: 5000 }).catch(() => false);
    
    if (detailsVisible) {
      console.log('✅ Details area found');
      
      // Look for brickken.com links
      const brickkenLinks = page.locator('a[href*="brickken.com"]');
      const linkCount = await brickkenLinks.count();
      console.log(`Found ${linkCount} brickken.com links`);
      
      // Show first few links
      for (let i = 0; i < Math.min(3, linkCount); i++) {
        const href = await brickkenLinks.nth(i).getAttribute('href');
        console.log(`Link ${i+1}: ${href}`);
      }
    }
    
    await page.screenshot({ path: 'bkn-details.png', fullPage: true });
    console.log('Screenshot saved as bkn-details.png');
  } else {
    console.log('❌ BKN still not visible after enabling filters');
    await page.screenshot({ path: 'bkn-not-found.png', fullPage: true });
  }
  
  await page.waitForTimeout(10000);
});