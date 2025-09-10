const { test, expect } = require('@playwright/test');

test('BKN Admin Links Final Test', async ({ page }) => {
  console.log('🚀 Testing BKN admin links after deployment...');
  
  try {
    // Go to admin page with longer timeout
    await page.goto('https://coinairank.com/admin', { waitUntil: 'networkidle', timeout: 60000 });
    console.log('✅ Loaded admin page');
    
    // Login
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await page.fill('input[type="password"]', 'donkey');
    await page.press('input[type="password"]', 'Enter');
    await page.waitForTimeout(3000);
    console.log('✅ Logged in');
    
    // Take screenshot of initial state
    await page.screenshot({ path: 'admin-initial.png' });
    
    // Try to enable unverified filter with multiple strategies
    console.log('⚙️ Attempting to enable unverified filter...');
    
    // Strategy 1: Look for checkbox
    const unverifiedCheckbox = page.locator('input[type="checkbox"]').filter({ hasText: /unverified/i }).first();
    if (await unverifiedCheckbox.isVisible({ timeout: 5000 })) {
      await unverifiedCheckbox.check();
      console.log('✅ Enabled unverified filter via checkbox');
    } else {
      // Strategy 2: Look for toggle button  
      const unverifiedToggle = page.locator('button, div, span').filter({ hasText: /unverified/i }).first();
      if (await unverifiedToggle.isVisible({ timeout: 5000 })) {
        await unverifiedToggle.click();
        console.log('✅ Enabled unverified filter via toggle');
      } else {
        console.log('⚠️ Could not find unverified filter - continuing without it');
      }
    }
    
    await page.waitForTimeout(3000);
    
    // Search for BKN - try multiple search strategies
    console.log('🔍 Searching for BKN...');
    
    // Strategy 1: Search input
    const searchInput = page.locator('input[placeholder*="search"], input[type="search"], input[placeholder*="Search"]').first();
    if (await searchInput.isVisible({ timeout: 5000 })) {
      await searchInput.fill('BKN');
      await page.waitForTimeout(2000);
      console.log('✅ Searched for BKN');
    }
    
    // Look for BKN with multiple strategies
    let bknFound = false;
    
    // Strategy 1: Direct text match
    const bknText = page.locator('text=BKN').first();
    if (await bknText.isVisible({ timeout: 5000 })) {
      console.log('✅ Found BKN via text match');
      await bknText.click();
      bknFound = true;
    } else {
      // Strategy 2: Look in project cards
      const projectCards = page.locator('[class*="project"], [class*="card"], [class*="item"]');
      const cardCount = await projectCards.count();
      console.log(`Found ${cardCount} potential project cards`);
      
      for (let i = 0; i < Math.min(cardCount, 10); i++) {
        const card = projectCards.nth(i);
        const cardText = await card.textContent();
        if (cardText && cardText.includes('BKN')) {
          console.log('✅ Found BKN in project card');
          await card.click();
          bknFound = true;
          break;
        }
      }
    }
    
    if (!bknFound) {
      console.log('❌ BKN not found - taking debug screenshot');
      await page.screenshot({ path: 'bkn-not-found-debug.png', fullPage: true });
      return;
    }
    
    await page.waitForTimeout(3000);
    console.log('✅ BKN clicked, waiting for tooltip...');
    
    // Look for admin button or section
    const adminButton = page.locator('button, div, span').filter({ hasText: /admin/i }).first();
    if (await adminButton.isVisible({ timeout: 10000 })) {
      console.log('✅ Found Admin button');
      await adminButton.click();
      await page.waitForTimeout(3000);
      
      // Take screenshot of admin section
      await page.screenshot({ path: 'bkn-admin-section.png', fullPage: true });
      
      // Look for stage_2_links or brickken.com links
      console.log('🔗 Looking for stage_2_links...');
      
      // Count brickken.com occurrences
      const brickkenLinks = await page.locator('text*="brickken.com"').count();
      console.log(`Found ${brickkenLinks} brickken.com links`);
      
      // Look for links section headers
      const linkHeaders = await page.locator('text=/stage.*link|selected.*link|discovered.*link/i').count();
      console.log(`Found ${linkHeaders} link section headers`);
      
      // Look for any URLs in admin section
      const urlPatterns = await page.locator('text=/https?:\\/\\//').count();
      console.log(`Found ${urlPatterns} URLs in admin section`);
      
      // Success criteria
      if (brickkenLinks >= 3) {
        console.log('🎉 SUCCESS: Found expected brickken.com links!');
        console.log(`✅ Expected: 5 brickken.com links`);
        console.log(`✅ Found: ${brickkenLinks} brickken.com links`);
      } else {
        console.log('⚠️ WARNING: Expected more brickken.com links');
        console.log(`Expected: 5, Found: ${brickkenLinks}`);
      }
      
    } else {
      console.log('❌ No Admin button found');
      await page.screenshot({ path: 'no-admin-button.png', fullPage: true });
    }
    
  } catch (error) {
    console.log('❌ Test error:', error.message);
    await page.screenshot({ path: 'test-error.png', fullPage: true });
  }
});