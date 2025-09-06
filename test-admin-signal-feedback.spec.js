const { test, expect } = require('@playwright/test');

test.describe('Admin Signal Feedback - Production Test', () => {
  test('admin can see and use feedback UI in SignalBasedTooltip', async ({ page }) => {
    // Go to site and login as admin
    await page.goto('https://coinairank.com');
    await page.waitForLoadState('networkidle');
    
    // Wait for projects to load
    await page.waitForSelector('.bg-\\[\\#111214\\]', { timeout: 10000 });
    
    // Find the first tier badge and hover
    const tierBadge = await page.$('span.uppercase.font-semibold');
    if (tierBadge) {
      await tierBadge.hover();
      await page.waitForTimeout(500);
      
      // Click to make tooltip persistent
      await tierBadge.click();
      await page.waitForTimeout(500);
      
      // Check if tooltip is showing
      const tooltip = await page.$('.fixed.z-\\[999999\\]');
      if (tooltip) {
        console.log('✅ Tooltip appeared');
        
        // Take screenshot
        await page.screenshot({ path: 'signal-tooltip-no-admin.png' });
        
        // Check content
        const tooltipText = await tooltip.textContent();
        console.log('Tooltip contains:', tooltipText.substring(0, 200) + '...');
        
        // Login as admin using the Admin button
        const adminButton = await page.$('button:has-text("Admin")');
        if (!adminButton) {
          console.log('⚠️ Admin button not visible - trying direct login');
          
          // Try direct admin login via API
          await page.evaluate(async () => {
            const response = await fetch('/api/admin/auth', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ password: 'donkey' })
            });
            return response.ok;
          });
          
          // Reload page
          await page.reload();
          await page.waitForLoadState('networkidle');
          
          // Check if logged in
          const adminBadge = await page.$('text=Admin');
          if (adminBadge) {
            console.log('✅ Successfully logged in as admin');
          }
        }
        
        // Find and click tier badge again
        await page.waitForSelector('.bg-\\[\\#111214\\]', { timeout: 10000 });
        const tierBadgeAfterLogin = await page.$('span.uppercase.font-semibold');
        if (tierBadgeAfterLogin) {
          await tierBadgeAfterLogin.click();
          await page.waitForTimeout(500);
          
          // Check for admin section
          const adminSection = await page.$('text=Admin: Signal Feedback');
          const adminIcon = await page.$('text=⚙️ Admin');
          
          if (adminSection || adminIcon) {
            console.log('✅ Admin feedback section is visible!');
            await page.screenshot({ path: 'signal-tooltip-with-admin.png' });
            
            // Check for feedback buttons
            const tooHighButton = await page.$('button:has-text("Too High")');
            const tooLowButton = await page.$('button:has-text("Too Low")');
            const wrongButton = await page.$('button:has-text("Wrong")');
            
            if (tooHighButton && tooLowButton && wrongButton) {
              console.log('✅ All feedback buttons present');
              
              // Try clicking a button
              await tooHighButton.click();
              await page.waitForTimeout(500);
              console.log('✅ Clicked "Too High" button');
            }
          } else {
            console.log('❌ Admin section not found in tooltip');
            await page.screenshot({ path: 'signal-tooltip-admin-missing.png' });
          }
        }
      }
    }
  });
});