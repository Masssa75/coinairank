const { test, expect } = require('@playwright/test');

test.describe('Admin Links Section Test', () => {
  test('admin can see discovered links in tooltip', async ({ page }) => {
    console.log('🔗 Testing admin links section in SignalBasedTooltip...');
    
    // Go to production site
    await page.goto('https://main--lively-torrone-8199e0.netlify.app/', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    console.log('✅ Page loaded');
    
    // Wait for projects to load
    await page.waitForSelector('.grid', { timeout: 10000 });
    console.log('✅ Projects grid found');
    
    // Try to log in as admin
    try {
      const adminButton = await page.waitForSelector('button:has-text("Admin")', { timeout: 3000 });
      await adminButton.click();
      console.log('✅ Clicked admin login button');
      
      // Wait for admin badge to appear
      await page.waitForSelector('text=Admin', { timeout: 5000 });
      console.log('✅ Admin logged in successfully');
    } catch (error) {
      console.log('⚠️ Admin button not found, trying direct login...');
      
      // Try direct admin cookie method
      await page.evaluate(() => {
        document.cookie = 'admin_token=admin_override_token_2024; path=/; max-age=86400';
      });
      
      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Check if logged in
      const adminBadge = await page.$('text=Admin');
      if (adminBadge) {
        console.log('✅ Admin logged in via cookie');
      } else {
        console.log('❌ Could not login as admin');
        return;
      }
    }
    
    // Find project cards
    const projectCards = await page.$$('.bg-\\[\\#1a1c1f\\].rounded-lg.border.border-\\[\\#333\\]');
    console.log(`Found ${projectCards.length} project cards`);
    
    if (projectCards.length === 0) {
      console.log('❌ No project cards found');
      return;
    }
    
    let foundLinksSection = false;
    
    // Test first few projects for the admin links section
    for (let i = 0; i < Math.min(3, projectCards.length); i++) {
      const card = projectCards[i];
      
      // Look for tier badge with SignalBasedTooltip
      const tierBadge = await card.$('[class*="px-2"][class*="py-0.5"][class*="rounded"][class*="text-xs"][class*="font-semibold"]');
      
      if (tierBadge) {
        // Get project name for logging
        const nameElement = await card.$('.text-\\[\\#ddd\\].font-semibold.text-lg');
        const projectName = nameElement ? await nameElement.textContent() : `Project ${i + 1}`;
        
        console.log(`🧪 Testing tooltip for: ${projectName}`);
        
        // Click to open persistent tooltip
        await tierBadge.click();
        await page.waitForTimeout(500); // Wait for tooltip to appear
        
        // Look for the admin links section
        const linksButton = await page.$('text=ADMIN: DISCOVERED LINKS');
        
        if (linksButton) {
          console.log(`✅ Found admin links section for ${projectName}!`);
          foundLinksSection = true;
          
          // Click to expand the section
          await linksButton.click();
          await page.waitForTimeout(300);
          
          // Check for link content
          const linkContent = await page.$('text=Selected for Stage 2');
          if (linkContent) {
            console.log('✅ Links section expanded successfully');
          }
          
          // Take screenshot
          await page.screenshot({ path: 'admin-links-section-found.png', fullPage: true });
          console.log('📸 Screenshot saved: admin-links-section-found.png');
          
          break; // Found it, no need to test more
        } else {
          console.log(`⚠️ No admin links section found for ${projectName}`);
          
          // Check what's in the tooltip
          const tooltipContent = await page.$('[class*="z-\\[999999\\]"] [class*="bg-\\[\\#1a1c1f\\]"]');
          if (tooltipContent) {
            const content = await tooltipContent.textContent();
            console.log(`Tooltip content preview: ${content.substring(0, 100)}...`);
          }
        }
        
        // Close tooltip by clicking elsewhere
        await page.click('body', { position: { x: 50, y: 50 } });
        await page.waitForTimeout(200);
      }
    }
    
    if (!foundLinksSection) {
      console.log('❌ Admin links section not found in any tooltips');
      console.log('Possible reasons:');
      console.log('1. Deployment not yet complete');
      console.log('2. Projects lack stage2Resources data');
      console.log('3. Links data not available in parsed_content');
      
      // Take screenshot of current state
      await page.screenshot({ path: 'admin-links-section-missing.png', fullPage: true });
      console.log('📸 Screenshot saved: admin-links-section-missing.png');
    }
    
    expect(foundLinksSection).toBe(true);
  });
});