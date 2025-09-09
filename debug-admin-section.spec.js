const { test, expect } = require('@playwright/test');

test.describe('Debug Admin Section', () => {
  test('check current deployment and admin features', async ({ page }) => {
    console.log('🔍 Debugging current deployment...');
    
    // Go to production site
    await page.goto('https://coinairank.com/', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    console.log('✅ Page loaded');
    
    // Check for admin button
    const adminButton = await page.$('button:has-text("Admin")');
    console.log(`Admin button found: ${adminButton ? 'YES' : 'NO'}`);
    
    if (adminButton) {
      await adminButton.click();
      console.log('✅ Clicked admin button');
      
      // Wait for login
      await page.waitForTimeout(2000);
    } else {
      console.log('⚠️ Trying cookie-based admin login...');
      await page.evaluate(() => {
        document.cookie = 'admin_token=admin_override_token_2024; path=/; max-age=86400';
      });
      await page.reload();
      await page.waitForLoadState('networkidle');
    }
    
    // Check if admin badge exists
    const adminBadge = await page.$('text=Admin');
    console.log(`Admin badge found: ${adminBadge ? 'YES' : 'NO'}`);
    
    // Wait for projects to load
    await page.waitForSelector('.grid', { timeout: 10000 });
    
    // Get the first project card
    const projectCard = await page.$('.bg-\\[\\#1a1c1f\\].rounded-lg.border.border-\\[\\#333\\]');
    
    if (projectCard) {
      // Find tier badge
      const tierBadge = await projectCard.$('[class*="px-2"][class*="py-0.5"][class*="rounded"][class*="text-xs"][class*="font-semibold"]');
      
      if (tierBadge) {
        console.log('✅ Found tier badge, clicking to open tooltip...');
        await tierBadge.click();
        await page.waitForTimeout(1000);
        
        // Check tooltip content
        const tooltip = await page.$('[class*="z-\\[999999\\]"] [class*="bg-\\[\\#1a1c1f\\]"]');
        if (tooltip) {
          const content = await tooltip.textContent();
          console.log('📋 Tooltip content:');
          console.log(content.substring(0, 500));
          
          // Specifically look for admin links section
          const hasAdminLinks = content.includes('ADMIN: DISCOVERED LINKS');
          const hasLinksSection = content.includes('Selected for Stage 2');
          const hasExpandButton = await page.$('text=ADMIN: DISCOVERED LINKS');
          
          console.log(`\n🔍 Admin Links Section Check:`);
          console.log(`- Contains "ADMIN: DISCOVERED LINKS": ${hasAdminLinks}`);
          console.log(`- Contains "Selected for Stage 2": ${hasLinksSection}`);
          console.log(`- Expand button found: ${hasExpandButton ? 'YES' : 'NO'}`);
          
          if (hasExpandButton) {
            console.log('✅ Found admin links section! Clicking to expand...');
            await hasExpandButton.click();
            await page.waitForTimeout(500);
            
            const expandedContent = await tooltip.textContent();
            console.log('\n📋 Expanded content:');
            console.log(expandedContent.substring(expandedContent.indexOf('ADMIN: DISCOVERED LINKS')));
          }
        } else {
          console.log('❌ No tooltip found');
        }
      } else {
        console.log('❌ No tier badge found');
      }
    } else {
      console.log('❌ No project cards found');
    }
    
    // Take screenshot
    await page.screenshot({ path: 'debug-admin-section.png', fullPage: true });
    console.log('📸 Screenshot saved: debug-admin-section.png');
  });
});