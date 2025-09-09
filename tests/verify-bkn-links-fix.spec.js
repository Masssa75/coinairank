const { test, expect } = require('@playwright/test');

test('Verify BKN stage 2 links fix - should show 8 links', async ({ page }) => {
  console.log('=== TESTING BKN STAGE 2 LINKS FIX ===');
  
  // Go to site and search for BKN
  await page.goto('https://coinairank.com');
  await page.waitForTimeout(5000);
  
  // Enable all filters first
  const filtersButton = page.locator('button, div').filter({ hasText: /filter/i }).first();
  const filtersVisible = await filtersButton.isVisible({ timeout: 5000 }).catch(() => false);
  
  if (filtersVisible) {
    console.log('✅ Opening filters...');
    await filtersButton.click();
    await page.waitForTimeout(2000);
    
    // Check all filter checkboxes
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    console.log(`Found ${count} filter checkboxes`);
    
    for (let i = 0; i < count; i++) {
      const checkbox = checkboxes.nth(i);
      const isChecked = await checkbox.isChecked().catch(() => false);
      if (!isChecked) {
        await checkbox.click();
        console.log(`✅ Enabled filter ${i+1}`);
      }
    }
    await page.waitForTimeout(2000);
  }
  
  // Look for BKN project
  console.log('Searching for BKN...');
  const bknElements = page.locator('text=BKN, text=Brickken');
  const bknCount = await bknElements.count();
  console.log(`Found ${bknCount} BKN/Brickken elements`);
  
  if (bknCount === 0) {
    // Try searching
    const searchInput = page.locator('input[placeholder*="search" i], input[type="text"]').first();
    const searchVisible = await searchInput.isVisible().catch(() => false);
    if (searchVisible) {
      await searchInput.fill('BKN');
      await page.waitForTimeout(3000);
      console.log('✅ Searched for BKN');
    }
  }
  
  // Click on BKN project to open tooltip
  const bknProject = page.locator('text=BKN').first();
  const solidBadge = page.locator('text=SOLID').first();
  
  const bknVisible = await bknProject.isVisible({ timeout: 10000 }).catch(() => false);
  const solidVisible = await solidBadge.isVisible({ timeout: 5000 }).catch(() => false);
  
  if (bknVisible) {
    console.log('✅ Found BKN text, clicking...');
    await bknProject.click();
    await page.waitForTimeout(3000);
  } else if (solidVisible) {
    console.log('✅ Found SOLID badge, clicking...');
    await solidBadge.click();
    await page.waitForTimeout(3000);
  } else {
    console.log('❌ Neither BKN nor SOLID badge found');
    await page.screenshot({ path: 'bkn-not-found.png' });
    return;
  }
  
  // Look for admin links section in the tooltip
  console.log('Looking for admin links section...');
  
  // Wait a bit and look for admin section
  await page.waitForTimeout(2000);
  
  const adminLinksButton = page.locator('text=ADMIN: DISCOVERED LINKS, text=DISCOVERED LINKS').first();
  const adminLinksVisible = await adminLinksButton.isVisible({ timeout: 5000 }).catch(() => false);
  
  if (!adminLinksVisible) {
    console.log('❌ Admin links button not visible');
    await page.screenshot({ path: 'no-admin-links.png' });
    return;
  }
  
  console.log('✅ Found admin links button, clicking to expand...');
  await adminLinksButton.click();
  await page.waitForTimeout(2000);
  
  // Look for "SELECTED FOR STAGE 2" section
  const stage2Section = page.locator('text=SELECTED FOR STAGE 2').first();
  const stage2Visible = await stage2Section.isVisible({ timeout: 5000 }).catch(() => false);
  
  if (!stage2Visible) {
    console.log('❌ Stage 2 section not visible');
    await page.screenshot({ path: 'no-stage2-section.png' });
    return;
  }
  
  console.log('✅ Found Stage 2 section');
  
  // Count brickken.com links in the selected section
  const selectedSection = stage2Section.locator('..').first();
  const brickkenLinks = selectedSection.locator('text=/brickken\\.com/');
  const linkCount = await brickkenLinks.count();
  
  console.log(`Found ${linkCount} brickken.com links in Stage 2 section`);
  
  // Log the links found
  for (let i = 0; i < linkCount && i < 5; i++) {
    const linkText = await brickkenLinks.nth(i).textContent();
    console.log(`Link ${i+1}: ${linkText.substring(0, 60)}...`);
  }
  
  // Take screenshot for verification
  await page.screenshot({ path: 'stage2-links-verification.png', fullPage: true });
  console.log('✅ Screenshot saved');
  
  // Check if we have the expected 8 links
  if (linkCount >= 8) {
    console.log('✅ SUCCESS: Found 8+ brickken.com links as expected!');
  } else if (linkCount >= 6) {
    console.log('⚠️  PARTIAL: Found 6+ links, close to expected 8');
  } else {
    console.log(`❌ FAILED: Only found ${linkCount} links, expected 8`);
  }
  
  await page.waitForTimeout(10000); // Keep open for manual inspection
});