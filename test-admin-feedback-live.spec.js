const { test, expect } = require('@playwright/test');

test.describe('Admin Signal Feedback System - Live Test', () => {
  test('admin can login and see feedback UI in tooltips', async ({ page }) => {
    // Go to the site
    await page.goto('https://coinairank.com');
    await page.waitForLoadState('networkidle');
    
    // Click Admin button to login
    const adminButton = await page.$('button:has-text("Admin")');
    if (adminButton) {
      await adminButton.click();
      console.log('✅ Found Admin button, clicking...');
      
      // Wait for password prompt
      await page.waitForTimeout(1000);
      
      // Fill in the password
      await page.fill('input[type="password"]', 'donkey');
      await page.press('input[type="password"]', 'Enter');
      
      console.log('✅ Entered admin password');
      
      // Wait for login to complete
      await page.waitForTimeout(2000);
      
      // Check if we're logged in as admin
      const adminBadge = await page.$('text=Admin');
      if (adminBadge) {
        console.log('✅ Successfully logged in as admin');
      } else {
        console.log('❌ Admin login may have failed');
      }
    } else {
      console.log('❌ Could not find Admin button');
    }
    
    // Wait for projects to load
    await page.waitForSelector('.bg-\\[\\#111214\\]', { timeout: 10000 });
    console.log('✅ Projects loaded');
    
    // Find a project with the old tooltip (non-signal based)
    const projectCards = await page.$$('.bg-\\[\\#111214\\]');
    console.log(`Found ${projectCards.length} project cards`);
    
    let foundAdminSection = false;
    let cardIndex = 0;
    
    for (const card of projectCards.slice(0, 5)) { // Check first 5 cards
      cardIndex++;
      
      // Look for tier badges
      const tierBadge = await card.$('span.uppercase.font-semibold');
      
      if (tierBadge) {
        const tierText = await tierBadge.textContent();
        console.log(`Card ${cardIndex}: Found tier badge with text: "${tierText}"`);
        
        // Hover over the tier badge
        await tierBadge.hover();
        console.log(`  Hovering over tier badge...`);
        
        // Wait for tooltip to appear
        await page.waitForTimeout(500);
        
        // Check if tooltip appeared
        const tooltip = await page.$('.fixed.z-\\[999999\\]');
        if (tooltip) {
          console.log(`  ✅ Tooltip appeared`);
          
          // Check for admin section
          const adminSection = await page.$('text=Admin: Signal Feedback');
          const adminIcon = await page.$('text=⚙️ Admin');
          
          if (adminSection || adminIcon) {
            console.log(`  ✅ FOUND ADMIN FEEDBACK SECTION!`);
            foundAdminSection = true;
            
            // Check for feedback buttons
            const tooHighButton = await page.$('button:has-text("Too High")');
            const tooLowButton = await page.$('button:has-text("Too Low")');
            const wrongButton = await page.$('button:has-text("Wrong")');
            
            if (tooHighButton && tooLowButton && wrongButton) {
              console.log(`  ✅ All feedback buttons present`);
            } else {
              console.log(`  ⚠️ Some feedback buttons missing`);
            }
            
            // Take a screenshot
            await page.screenshot({ path: 'admin-feedback-tooltip.png' });
            console.log(`  📸 Screenshot saved as admin-feedback-tooltip.png`);
            
            break;
          } else {
            console.log(`  ❌ No admin section in this tooltip`);
            
            // Check what's in the tooltip
            const tooltipContent = await tooltip.textContent();
            if (tooltipContent) {
              console.log(`  Tooltip content preview: ${tooltipContent.substring(0, 100)}...`);
            }
          }
        } else {
          console.log(`  ❌ No tooltip appeared`);
        }
        
        // Move mouse away to close tooltip
        await page.mouse.move(0, 0);
        await page.waitForTimeout(200);
      }
    }
    
    if (!foundAdminSection) {
      console.log('\n❌ Admin feedback section not found in any tooltips');
      console.log('Possible reasons:');
      console.log('1. Not properly logged in as admin');
      console.log('2. All projects are using SignalBasedTooltip (new system)');
      console.log('3. Admin prop not being passed correctly to tooltips');
      
      // Take a screenshot of the page
      await page.screenshot({ path: 'admin-page-state.png', fullPage: true });
      console.log('📸 Full page screenshot saved as admin-page-state.png');
    }
  });
});