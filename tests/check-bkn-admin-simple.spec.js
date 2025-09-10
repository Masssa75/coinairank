const { test, expect } = require('@playwright/test');

test('Simple BKN admin check', async ({ page }) => {
  console.log('🚀 Starting simple BKN admin check...');
  
  // Go to admin page
  await page.goto('https://coinairank.com/admin');
  
  // Login
  await page.fill('input[type="password"]', 'donkey');
  await page.press('input[type="password"]', 'Enter');
  await page.waitForTimeout(2000);
  
  console.log('✅ Logged into admin');
  
  // Enable unverified filter
  try {
    await page.click('text=unverified');
    console.log('✅ Clicked unverified filter');
    await page.waitForTimeout(3000);
  } catch (e) {
    console.log('⚠️ Could not click unverified filter, continuing...');
  }
  
  // Search for BKN
  await page.fill('input[placeholder*="search"], input[type="search"]', 'BKN');
  await page.waitForTimeout(2000);
  
  // Look for BKN project
  const bknElement = await page.locator('text=BKN').first();
  if (await bknElement.isVisible()) {
    console.log('✅ Found BKN project');
    
    // Click on BKN to open tooltip
    await bknElement.click();
    await page.waitForTimeout(2000);
    
    // Look for admin section
    const adminButton = page.locator('button:has-text("Admin")').first();
    if (await adminButton.isVisible()) {
      console.log('✅ Found Admin button');
      await adminButton.click();
      await page.waitForTimeout(2000);
      
      // Look for links section
      const linksText = await page.locator('text=/stage.*link|Link.*stage|Selected.*link|Discovered.*link/i').count();
      console.log(`Found ${linksText} link-related sections`);
      
      // Count brickken.com links
      const brickkenLinks = await page.locator('text*="brickken.com"').count();
      console.log(`✅ Found ${brickkenLinks} brickken.com links in admin section`);
      
      // Take screenshot
      await page.screenshot({ path: 'bkn-admin-links.png', fullPage: true });
      
      if (brickkenLinks >= 3) {
        console.log('🎉 SUCCESS: BKN admin links working correctly!');
      } else {
        console.log('❌ ISSUE: Expected at least 3 brickken.com links, found', brickkenLinks);
      }
    } else {
      console.log('❌ No Admin button found');
    }
  } else {
    console.log('❌ BKN not found');
    await page.screenshot({ path: 'bkn-not-found.png' });
  }
});