const { test, expect } = require('@playwright/test');

test.describe('Admin Signal Feedback System', () => {
  test('admin can view and provide feedback on signal ratings', async ({ page }) => {
    // Enable admin mode
    await page.goto('https://coinairank.com');
    
    // Set admin flag in localStorage
    await page.evaluate(() => {
      localStorage.setItem('isAdmin', 'true');
    });
    
    // Reload to apply admin status
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Wait for projects to load
    await page.waitForSelector('.bg-\\[\\#111214\\]', { timeout: 10000 });
    
    // Find a project with old WebsiteAnalysisTooltip (non-signal based)
    const projectCards = await page.$$('.bg-\\[\\#111214\\]');
    
    for (const card of projectCards) {
      // Look for a tier badge that might use WebsiteAnalysisTooltip
      const tierBadge = await card.$('span.uppercase.font-semibold');
      if (tierBadge) {
        const tierText = await tierBadge.textContent();
        
        // Skip if it's using SignalBasedTooltip (has signal-based tiers)
        if (!tierText.includes('SIGNAL')) {
          // Hover over the tier badge to show tooltip
          await tierBadge.hover();
          
          // Wait for tooltip to appear
          await page.waitForSelector('.fixed.z-\\[999999\\]', { timeout: 5000 }).catch(() => null);
          
          // Check if admin section is visible
          const adminSection = await page.$('text=Admin: Signal Feedback');
          
          if (adminSection) {
            console.log('✅ Admin feedback section found in tooltip');
            
            // Check for feedback buttons
            const tooHighButton = await page.$('button:has-text("Too High")');
            const tooLowButton = await page.$('button:has-text("Too Low")');
            const wrongButton = await page.$('button:has-text("Wrong")');
            
            expect(tooHighButton).toBeTruthy();
            expect(tooLowButton).toBeTruthy();
            expect(wrongButton).toBeTruthy();
            
            console.log('✅ Feedback buttons are present');
            
            // Try clicking a feedback button
            if (tooHighButton) {
              await tooHighButton.click();
              
              // Check if button state changed
              const buttonClasses = await tooHighButton.getAttribute('class');
              expect(buttonClasses).toContain('bg-red-900');
              
              console.log('✅ Feedback button interaction works');
            }
            
            break;
          }
        }
      }
    }
    
    // Test that non-admins don't see the feedback section
    await page.evaluate(() => {
      localStorage.removeItem('isAdmin');
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Wait for projects to load again
    await page.waitForSelector('.bg-\\[\\#111214\\]', { timeout: 10000 });
    
    // Hover over a tier badge
    const tierBadge = await page.$('span.uppercase.font-semibold');
    if (tierBadge) {
      await tierBadge.hover();
      
      // Wait for tooltip
      await page.waitForSelector('.fixed.z-\\[999999\\]', { timeout: 5000 }).catch(() => null);
      
      // Admin section should NOT be visible
      const adminSection = await page.$('text=Admin: Signal Feedback');
      expect(adminSection).toBeFalsy();
      
      console.log('✅ Admin section correctly hidden for non-admin users');
    }
  });
});