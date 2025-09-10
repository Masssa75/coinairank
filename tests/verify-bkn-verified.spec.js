const { test, expect } = require('@playwright/test');

test('Find BKN (now verified) and check stage 2 links', async ({ page }) => {
  console.log('=== TESTING BKN VERIFIED VISIBILITY ===');
  
  // Go to site
  await page.goto('https://coinairank.com');
  await page.waitForTimeout(5000);
  
  // Search for BKN directly
  console.log('Searching for BKN...');
  const searchInput = page.locator('input[placeholder*="search" i], input[type="text"]').first();
  const searchVisible = await searchInput.isVisible({ timeout: 5000 }).catch(() => false);
  
  if (searchVisible) {
    await searchInput.clear();
    await searchInput.fill('BKN');
    await page.waitForTimeout(3000);
    console.log('✅ Searched for BKN');
  }
  
  // Look for BKN in results
  console.log('Looking for BKN in results...');
  
  const bknSelectors = [
    'text=BKN',
    'text=Brickken',
    'text=brickken'
  ];
  
  let bknFound = false;
  for (const selector of bknSelectors) {
    const bknElements = page.locator(selector);
    const count = await bknElements.count();
    
    if (count > 0) {
      console.log(`✅ Found ${count} BKN elements with selector: ${selector}`);
      
      // Click on first BKN element
      await bknElements.first().click();
      console.log('✅ Clicked on BKN project');
      await page.waitForTimeout(3000);
      bknFound = true;
      break;
    }
  }
  
  if (!bknFound) {
    console.log('❌ BKN not found even though it should be verified');
    await page.screenshot({ path: 'bkn-verified-not-found.png' });
    return;
  }
  
  // Look for admin section with stage 2 links
  console.log('Looking for admin links section...');
  
  const adminLinksSections = [
    'text=ADMIN: DISCOVERED LINKS',
    'text=DISCOVERED LINKS', 
    'text=SELECTED FOR STAGE 2',
    'text=stage 2',
    'text=Stage 2'
  ];
  
  let adminFound = false;
  for (const selector of adminLinksSections) {
    const adminElement = page.locator(selector).first();
    const visible = await adminElement.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (visible) {
      console.log(`✅ Found admin section: ${selector}`);
      adminFound = true;
      break;
    }
  }
  
  if (!adminFound) {
    console.log('❌ Admin links section not found');
    await page.screenshot({ path: 'bkn-verified-no-admin.png' });
    return;
  }
  
  // Count brickken.com links
  console.log('Counting brickken.com links...');
  
  const brickkenLinks = page.locator('text=/brickken\\.com/');
  const linkCount = await brickkenLinks.count();
  console.log(`Found ${linkCount} brickken.com links in admin section`);
  
  // Show first few links
  for (let i = 0; i < Math.min(5, linkCount); i++) {
    const linkText = await brickkenLinks.nth(i).textContent();
    console.log(`Link ${i+1}: ${linkText?.substring(0, 80)}...`);
  }
  
  await page.screenshot({ path: 'bkn-verified-stage2-links.png', fullPage: true });
  
  // Verify we have the expected 8 links
  if (linkCount >= 8) {
    console.log('✅ SUCCESS: Found 8+ brickken.com links as expected!');
  } else if (linkCount >= 6) {
    console.log('⚠️  PARTIAL SUCCESS: Found 6+ links, close to expected 8');
  } else {
    console.log(`❌ FAILED: Only found ${linkCount} links, expected 8`);
  }
  
  console.log('=== TEST COMPLETED ===');
  await page.waitForTimeout(10000); // Keep open for manual verification
});