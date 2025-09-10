const { test, expect } = require('@playwright/test');

test('BKN Stage 2 Links via Main Site', async ({ page }) => {
  console.log('🚀 Testing BKN stage 2 links via main site...');
  
  try {
    // Step 1: Go to main coinairank.com site
    await page.goto('https://coinairank.com', { waitUntil: 'networkidle', timeout: 60000 });
    console.log('✅ Loaded coinairank.com');
    
    // Step 2: Look for admin login or admin button
    console.log('🔐 Looking for admin access...');
    
    // Look for admin button or login
    const adminButton = page.locator('button, a, div').filter({ hasText: /admin/i }).first();
    if (await adminButton.isVisible({ timeout: 5000 })) {
      await adminButton.click();
      console.log('✅ Clicked admin button');
      await page.waitForTimeout(2000);
    }
    
    // Look for password input (might be modal or redirect)
    const passwordInput = page.locator('input[type="password"]').first();
    if (await passwordInput.isVisible({ timeout: 5000 })) {
      await passwordInput.fill('donkey');
      await passwordInput.press('Enter');
      console.log('✅ Entered admin password');
      await page.waitForTimeout(3000);
    }
    
    // Step 3: Look for filters section
    console.log('🔧 Looking for filters...');
    
    // Take screenshot to see current state
    await page.screenshot({ path: 'main-site-state.png', fullPage: true });
    
    // Look for filters button or section
    const filtersSection = page.locator('text=/filter|Filter/').first();
    if (await filtersSection.isVisible({ timeout: 5000 })) {
      await filtersSection.click();
      console.log('✅ Found and clicked filters');
      await page.waitForTimeout(1000);
    }
    
    // Step 4: Enable unverified filter
    console.log('🔧 Looking for unverified filter...');
    
    // Try multiple strategies to find unverified filter
    let unverifiedEnabled = false;
    
    // Strategy 1: Look for "Include Unverified" text
    const includeUnverified = page.locator('text=/include.*unverified/i').first();
    if (await includeUnverified.isVisible({ timeout: 3000 })) {
      await includeUnverified.click();
      console.log('✅ Clicked "Include Unverified"');
      unverifiedEnabled = true;
    }
    
    // Strategy 2: Look for just "unverified" 
    if (!unverifiedEnabled) {
      const unverified = page.locator('text=unverified').first();
      if (await unverified.isVisible({ timeout: 3000 })) {
        await unverified.click();
        console.log('✅ Clicked "unverified"');
        unverifiedEnabled = true;
      }
    }
    
    // Strategy 3: Look for checkbox near unverified text
    if (!unverifiedEnabled) {
      const unverifiedCheckbox = page.locator('input[type="checkbox"]').filter({ hasText: /unverified/i }).first();
      if (await unverifiedCheckbox.isVisible({ timeout: 3000 })) {
        await unverifiedCheckbox.check();
        console.log('✅ Checked unverified checkbox');
        unverifiedEnabled = true;
      }
    }
    
    if (!unverifiedEnabled) {
      console.log('⚠️ Could not find unverified filter - continuing anyway');
    }
    
    await page.waitForTimeout(3000);
    
    // Step 5: Search for BKN
    console.log('🔍 Looking for BKN...');
    
    // Try search first
    const searchInput = page.locator('input[placeholder*="search"], input[type="search"], input[placeholder*="Search"]').first();
    if (await searchInput.isVisible({ timeout: 3000 })) {
      await searchInput.fill('BKN');
      await page.waitForTimeout(2000);
      console.log('✅ Searched for BKN');
    }
    
    // Look for BKN project
    let bknFound = false;
    
    // Strategy 1: Look for BKN text
    const bknText = page.locator('text=BKN').first();
    if (await bknText.isVisible({ timeout: 5000 })) {
      console.log('✅ Found BKN text');
      bknFound = true;
      
      // Step 6: Click on BKN to open tooltip
      await bknText.click();
      console.log('✅ Clicked BKN');
      await page.waitForTimeout(3000);
      
      // Take screenshot of tooltip
      await page.screenshot({ path: 'bkn-tooltip-main.png', fullPage: true });
      
      // Step 7: Look for stage 2 links section
      console.log('🔗 Looking for stage 2 links in tooltip...');
      
      // Look for various text patterns
      const linkSectionPatterns = [
        'stage 2 links',
        'stage_2_links', 
        'selected links',
        'stage 2',
        'links',
        'Admin',
        'admin'
      ];
      
      let linksFound = false;
      
      for (const pattern of linkSectionPatterns) {
        const linkSection = page.locator(`text=${pattern}`).first();
        if (await linkSection.isVisible({ timeout: 2000 })) {
          console.log(`✅ Found section: ${pattern}`);
          await linkSection.click();
          await page.waitForTimeout(2000);
          
          // Look for brickken.com links
          const brickkenCount = await page.locator('text*="brickken.com"').count();
          console.log(`Found ${brickkenCount} brickken.com links`);
          
          if (brickkenCount > 0) {
            linksFound = true;
            console.log('🎉 SUCCESS: Found brickken.com links!');
            break;
          }
        }
      }
      
      if (!linksFound) {
        console.log('❌ No stage 2 links found');
        
        // Debug: Show what's in the tooltip
        const tooltipText = await page.locator('[class*="tooltip"], [role="dialog"], [class*="modal"]').first().textContent();
        console.log('Tooltip content:', tooltipText?.substring(0, 200));
      }
      
    } else {
      console.log('❌ BKN not found');
      
      // Debug: List what projects are visible
      const projectTexts = await page.locator('text=/^[A-Z]{2,6}$/').allTextContents();
      console.log('Visible projects:', projectTexts.slice(0, 10));
    }
    
    // Final screenshot
    await page.screenshot({ path: 'final-state-main.png', fullPage: true });
    
  } catch (error) {
    console.log('❌ Test error:', error.message);
    await page.screenshot({ path: 'error-main-site.png', fullPage: true });
  }
});