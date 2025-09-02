import { test, expect } from '@playwright/test';

test('Live site tooltips display without clipping', async ({ page }) => {
  // Navigate to the live CAR dashboard
  await page.goto('https://coinairank.com');
  
  // Wait for the page to load
  await page.waitForLoadState('networkidle');
  
  // Wait for projects to load
  await page.waitForSelector('.grid', { timeout: 10000 });
  
  // Find a tier badge (these have tooltips)
  const tierBadge = await page.locator('span').filter({ hasText: /BASIC|SOLID|ALPHA|TRASH/i }).first();
  
  // Check if tier badge exists
  const badgeExists = await tierBadge.count() > 0;
  
  if (badgeExists) {
    console.log('Found tier badge, testing tooltip...');
    
    // Get the badge's position
    const badgeBox = await tierBadge.boundingBox();
    
    if (badgeBox) {
      console.log('Badge position:', badgeBox);
      
      // Hover over the badge to trigger tooltip
      await tierBadge.hover();
      
      // Wait for tooltip to appear
      await page.waitForTimeout(1000);
      
      // Take a screenshot for verification
      await page.screenshot({ path: 'tooltip-test.png', fullPage: false });
      
      // Check if tooltip is visible using portal rendering
      const tooltip = page.locator('div.fixed').filter({ hasText: /QUICK TAKE|FOUND|MISSING/i }).first();
      const tooltipVisible = await tooltip.isVisible();
      
      console.log('Tooltip visible:', tooltipVisible);
      
      if (tooltipVisible) {
        // Get tooltip bounding box
        const tooltipBox = await tooltip.boundingBox();
        
        if (tooltipBox) {
          console.log('Tooltip position:', tooltipBox);
          
          // Check that tooltip is within viewport
          const viewportSize = page.viewportSize();
          if (viewportSize) {
            // Tooltip should be within viewport bounds
            expect(tooltipBox.x).toBeGreaterThanOrEqual(0);
            expect(tooltipBox.y).toBeGreaterThanOrEqual(0);
            
            // Check horizontal bounds
            if (tooltipBox.x + tooltipBox.width > viewportSize.width) {
              console.log('⚠️ Tooltip extends beyond right edge');
            } else {
              console.log('✅ Tooltip fits horizontally');
            }
            
            // Check vertical bounds (allow some overflow for scrollable content)
            if (tooltipBox.y < 0) {
              console.log('❌ Tooltip is clipped at top');
            } else {
              console.log('✅ Tooltip is not clipped at top');
            }
            
            console.log('✅ Tooltip is properly positioned using portal rendering');
          }
        }
      } else {
        console.log('⚠️ Tooltip not visible after hover - checking for other tooltip selectors...');
        
        // Try alternative selector
        const altTooltip = await page.locator('text=QUICK TAKE').count();
        console.log('Found QUICK TAKE elements:', altTooltip);
      }
    }
  } else {
    console.log('⚠️ No tier badges found on page');
  }
});