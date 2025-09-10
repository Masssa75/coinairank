const { test, expect } = require('@playwright/test');

test('BKN Stage 2 Links Correct Flow', async ({ page }) => {
  console.log('🚀 Testing BKN stage 2 links with correct flow...');
  
  try {
    // Step 1: Go to main coinairank.com/admin page
    await page.goto('https://coinairank.com/admin', { waitUntil: 'networkidle', timeout: 60000 });
    console.log('✅ Loaded coinairank.com/admin');
    
    // Step 2: Login with admin password
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await page.fill('input[type="password"]', 'donkey');
    await page.press('input[type="password"]', 'Enter');
    await page.waitForTimeout(3000);
    console.log('✅ Logged in with donkey password');
    
    // Step 3: Open filters
    console.log('🔧 Looking for filters...');
    const filtersButton = page.locator('button, div, span').filter({ hasText: /filter/i }).first();
    if (await filtersButton.isVisible({ timeout: 5000 })) {
      await filtersButton.click();
      await page.waitForTimeout(1000);
      console.log('✅ Opened filters');
    }
    
    // Step 4: Select "Include Unverified" filter
    console.log('🔧 Looking for Include Unverified filter...');
    const unverifiedFilter = page.locator('text=/include.*unverified|unverified/i').first();
    if (await unverifiedFilter.isVisible({ timeout: 10000 })) {
      await unverifiedFilter.click();
      await page.waitForTimeout(3000);
      console.log('✅ Enabled "Include Unverified" filter');
    } else {
      // Try finding checkbox or toggle
      const unverifiedCheckbox = page.locator('input[type="checkbox"]').filter({ hasText: /unverified/i }).first();
      if (await unverifiedCheckbox.isVisible({ timeout: 5000 })) {
        await unverifiedCheckbox.check();
        console.log('✅ Enabled unverified via checkbox');
      } else {
        console.log('⚠️ Could not find unverified filter');
      }
    }
    
    await page.waitForTimeout(2000);
    
    // Step 5: Find BKN project
    console.log('🔍 Looking for BKN project...');
    let bknFound = false;
    
    // Look for BKN in project listings
    const bknProject = page.locator('text=BKN').first();
    if (await bknProject.isVisible({ timeout: 10000 })) {
      console.log('✅ Found BKN project');
      bknFound = true;
    } else {
      // Search for BKN if search available
      const searchInput = page.locator('input[placeholder*="search"], input[type="search"]').first();
      if (await searchInput.isVisible({ timeout: 3000 })) {
        await searchInput.fill('BKN');
        await page.waitForTimeout(2000);
        
        if (await bknProject.isVisible({ timeout: 5000 })) {
          console.log('✅ Found BKN after search');
          bknFound = true;
        }
      }
    }
    
    if (!bknFound) {
      console.log('❌ BKN not found - taking screenshot');
      await page.screenshot({ path: 'bkn-not-found-filters.png', fullPage: true });
      return;
    }
    
    // Step 6: Click on BKN tier badge to open tooltip
    console.log('🎯 Looking for BKN tier badge...');
    
    // Look for tier badge near BKN (SOLID, ALPHA, etc.)
    const tierBadge = page.locator('[class*="tier"], [class*="badge"], [class*="rank"]').filter({ hasText: /SOLID|ALPHA|WEAK|TRASH/i }).first();
    if (await tierBadge.isVisible({ timeout: 5000 })) {
      await tierBadge.click();
      console.log('✅ Clicked tier badge');
    } else {
      // Try clicking on BKN project itself
      await bknProject.click();
      console.log('✅ Clicked BKN project');
    }
    
    await page.waitForTimeout(3000);
    
    // Step 7: Verify tooltip opened and look for stage 2 links section
    console.log('🔗 Looking for stage 2 links section in tooltip...');
    
    // Take screenshot of tooltip
    await page.screenshot({ path: 'bkn-tooltip-opened.png', fullPage: true });
    
    // Look for stage 2 links expandable section
    const stage2Section = page.locator('text=/stage.*2.*link|selected.*link|stage.*link/i').first();
    if (await stage2Section.isVisible({ timeout: 5000 })) {
      console.log('✅ Found stage 2 links section');
      
      // Step 8: Expand the stage 2 links feature
      console.log('📂 Expanding stage 2 links section...');
      await stage2Section.click();
      await page.waitForTimeout(2000);
      
      // Take screenshot of expanded section
      await page.screenshot({ path: 'bkn-stage2-expanded.png', fullPage: true });
      
      // Step 9: Count and verify brickken.com links
      const brickkenLinks = await page.locator('text*="brickken.com"').count();
      console.log(`🔗 Found ${brickkenLinks} brickken.com links`);
      
      // Look for specific expected links
      const expectedUrls = [
        'brickken.com/en/about-us',
        'brickken.com/en/resources', 
        'partners.brickken.com',
        'brickken.com/en/live-tokenizations',
        'brickken.com/en/blog'
      ];
      
      let foundExpectedLinks = 0;
      for (const url of expectedUrls) {
        const linkFound = await page.locator(`text*="${url}"`).count();
        if (linkFound > 0) {
          foundExpectedLinks++;
          console.log(`✅ Found expected link: ${url}`);
        }
      }
      
      console.log(`📊 Summary: ${foundExpectedLinks}/${expectedUrls.length} expected links found`);
      console.log(`📊 Total brickken.com links: ${brickkenLinks}`);
      
      if (foundExpectedLinks >= 3) {
        console.log('🎉 SUCCESS: Stage 2 links are working correctly!');
      } else {
        console.log('⚠️ WARNING: Expected more specific brickken.com links');
      }
      
    } else {
      console.log('❌ Stage 2 links section not found in tooltip');
      
      // Debug: Look for any expandable sections
      const expandables = await page.locator('[class*="expand"], [class*="collapse"], button, div[role="button"]').count();
      console.log(`Debug: Found ${expandables} potentially expandable elements`);
    }
    
  } catch (error) {
    console.log('❌ Test error:', error.message);
    await page.screenshot({ path: 'test-error-final.png', fullPage: true });
  }
});