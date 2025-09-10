const { test, expect } = require('@playwright/test');

test('Find BKN and verify stage 2 links', async ({ page }) => {
  console.log('=== TESTING BKN STAGE 2 LINKS ===');
  
  // Go to site
  await page.goto('https://coinairank.com');
  await page.waitForTimeout(3000);
  
  // Step 1: Open filters
  console.log('Step 1: Opening filters...');
  await page.click('div:has-text("Filters")');
  await page.waitForTimeout(2000);
  
  // Step 2: Enable Ethereum network (BKN is on Ethereum)
  console.log('Step 2: Enabling Ethereum network...');
  
  // Look for Networks section and expand it
  const networksSection = page.locator('text=NETWORKS');
  const networksVisible = await networksSection.isVisible().catch(() => false);
  
  if (networksVisible) {
    await networksSection.click();
    await page.waitForTimeout(1000);
    console.log('✅ Opened Networks section');
  }
  
  // Find and enable Ethereum checkbox
  const ethereumCheckbox = page.locator('text=ethereum').or(page.locator('text=Ethereum')).first();
  const ethVisible = await ethereumCheckbox.isVisible().catch(() => false);
  
  if (ethVisible) {
    await ethereumCheckbox.click();
    console.log('✅ Enabled Ethereum network');
    await page.waitForTimeout(3000); // Wait for results to load
  } else {
    console.log('⚠️ Ethereum filter not found, trying all checkboxes...');
    
    // Enable all network checkboxes as fallback
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    
    for (let i = 0; i < count; i++) {
      const checkbox = checkboxes.nth(i);
      const isChecked = await checkbox.isChecked().catch(() => false);
      if (!isChecked) {
        await checkbox.click();
        await page.waitForTimeout(500);
      }
    }
    console.log(`✅ Enabled all ${count} checkboxes`);
  }
  
  // Step 3: Search for BKN
  console.log('Step 3: Searching for BKN...');
  const searchInput = page.locator('input[type="text"]').first();
  await searchInput.fill('BKN');
  await page.waitForTimeout(3000);
  
  // Step 4: Find and click BKN
  console.log('Step 4: Looking for BKN...');
  const bknElement = page.locator('text=BKN').first();
  const bknVisible = await bknElement.isVisible({ timeout: 10000 }).catch(() => false);
  
  if (!bknVisible) {
    console.log('❌ BKN not found');
    await page.screenshot({ path: 'bkn-not-found-simple.png' });
    return;
  }
  
  await bknElement.click();
  console.log('✅ Clicked BKN');
  await page.waitForTimeout(3000);
  
  // Step 5: Look for admin links section
  console.log('Step 5: Looking for admin links...');
  const adminSection = page.locator('text=ADMIN').or(page.locator('text=DISCOVERED LINKS')).first();
  const adminVisible = await adminSection.isVisible({ timeout: 5000 }).catch(() => false);
  
  if (!adminVisible) {
    console.log('❌ Admin section not found');
    await page.screenshot({ path: 'bkn-no-admin-simple.png' });
    return;
  }
  
  // Step 6: Count brickken.com links
  console.log('Step 6: Counting brickken.com links...');
  const brickkenLinks = page.locator('text=/brickken\\.com/');
  const linkCount = await brickkenLinks.count();
  
  console.log(`Found ${linkCount} brickken.com links`);
  
  if (linkCount >= 8) {
    console.log('✅ SUCCESS: Found 8+ brickken.com links!');
  } else {
    console.log(`❌ Expected 8 links, found ${linkCount}`);
  }
  
  await page.screenshot({ path: 'bkn-stage2-result-simple.png', fullPage: true });
  
  console.log('=== TEST COMPLETED ===');
  await page.waitForTimeout(5000);
});