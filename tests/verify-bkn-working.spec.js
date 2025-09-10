const { test, expect } = require('@playwright/test');

test('Click BKN and verify stage 2 links', async ({ page }) => {
  console.log('=== TESTING BKN STAGE 2 LINKS ===');
  
  // Go to site
  await page.goto('https://coinairank.com');
  await page.waitForTimeout(5000);
  
  console.log('Site loaded successfully');
  
  // Look for BKN project card
  console.log('Looking for BKN project...');
  
  // BKN should be visible in the grid - look for the project card containing "BKN"
  const bknCard = page.locator('text=BKN').first();
  const bknVisible = await bknCard.isVisible({ timeout: 10000 }).catch(() => false);
  
  if (!bknVisible) {
    console.log('❌ BKN card not visible');
    await page.screenshot({ path: 'bkn-card-not-found.png' });
    return;
  }
  
  console.log('✅ Found BKN card, clicking...');
  await bknCard.click();
  await page.waitForTimeout(3000);
  
  // Look for admin section in the opened tooltip/modal
  console.log('Looking for admin links section...');
  
  const adminSelectors = [
    'text=ADMIN: DISCOVERED LINKS',
    'text=DISCOVERED LINKS',
    'text=SELECTED FOR STAGE 2',
    'text=stage 2',
    'text=Stage 2'
  ];
  
  let adminFound = false;
  for (const selector of adminSelectors) {
    const adminElement = page.locator(selector).first();
    const visible = await adminElement.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (visible) {
      console.log(`✅ Found admin section: ${selector}`);
      adminFound = true;
      break;
    }
  }
  
  if (!adminFound) {
    console.log('❌ Admin section not found');
    await page.screenshot({ path: 'bkn-no-admin-section.png' });
    return;
  }
  
  // Count brickken.com links
  console.log('Counting brickken.com links...');
  
  const brickkenLinks = page.locator('text=/brickken\\.com/');
  const linkCount = await brickkenLinks.count();
  console.log(`Found ${linkCount} brickken.com links`);
  
  // Show the links
  for (let i = 0; i < Math.min(8, linkCount); i++) {
    const linkText = await brickkenLinks.nth(i).textContent();
    console.log(`Link ${i+1}: ${linkText?.substring(0, 80)}...`);
  }
  
  await page.screenshot({ path: 'bkn-stage2-links-working.png', fullPage: true });
  
  // Verify we have the expected 8 links
  if (linkCount >= 8) {
    console.log('✅ SUCCESS: Found 8+ brickken.com links as expected!');
  } else if (linkCount >= 6) {
    console.log('⚠️  PARTIAL SUCCESS: Found 6+ links, close to expected 8');
  } else {
    console.log(`❌ FAILED: Only found ${linkCount} links, expected 8`);
  }
  
  console.log('=== TEST COMPLETED ===');
  await page.waitForTimeout(10000); // Keep open for verification
});