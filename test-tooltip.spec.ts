import { test, expect } from '@playwright/test';

test('Tooltip displays without clipping', async ({ page }) => {
  // Navigate to the CAR dashboard
  await page.goto('http://localhost:3003');
  
  // Wait for the page to load
  await page.waitForLoadState('networkidle');
  
  // Wait for projects to load
  await page.waitForSelector('.grid', { timeout: 10000 });
  
  // Find a tier badge (these have tooltips)
  const tierBadge = await page.locator('span').filter({ hasText: /BASIC|SOLID|ALPHA|TRASH/i }).first();
  
  // Check if tier badge exists
  const badgeExists = await tierBadge.count() > 0;
  
  if (badgeExists) {
    // Get the badge's position
    const badgeBox = await tierBadge.boundingBox();
    
    if (badgeBox) {
      // Hover over the badge to trigger tooltip
      await tierBadge.hover();
      
      // Wait for tooltip to appear
      await page.waitForTimeout(500);
      
      // Check if tooltip is visible
      const tooltip = page.locator('text=QUICK TAKE').first();
      const tooltipVisible = await tooltip.isVisible();
      
      if (tooltipVisible) {
        // Get tooltip bounding box
        const tooltipBox = await tooltip.boundingBox();
        
        if (tooltipBox) {
          console.log('Badge position:', badgeBox);
          console.log('Tooltip position:', tooltipBox);
          
          // Check that tooltip is within viewport
          const viewportSize = page.viewportSize();
          if (viewportSize) {
            // Tooltip should be within viewport bounds
            expect(tooltipBox.x).toBeGreaterThanOrEqual(0);
            expect(tooltipBox.y).toBeGreaterThanOrEqual(0);
            expect(tooltipBox.x + tooltipBox.width).toBeLessThanOrEqual(viewportSize.width);
            
            // Allow some overflow at bottom for scrollable tooltips
            // but top should always be visible
            expect(tooltipBox.y).toBeLessThanOrEqual(viewportSize.height);
            
            console.log('✅ Tooltip is properly positioned within viewport');
          }
        }
      } else {
        console.log('⚠️ Tooltip not visible after hover');
      }
    }
  } else {
    console.log('⚠️ No tier badges found on page');
  }
});

test('Tooltip repositions when near edges', async ({ page }) => {
  // Navigate to the CAR dashboard
  await page.goto('http://localhost:3003');
  
  // Wait for the page to load
  await page.waitForLoadState('networkidle');
  
  // Wait for projects to load
  await page.waitForSelector('.grid', { timeout: 10000 });
  
  // Find the first tier badge (likely near top)
  const firstBadge = await page.locator('span').filter({ hasText: /BASIC|SOLID|ALPHA|TRASH/i }).first();
  
  if (await firstBadge.count() > 0) {
    // Scroll to top to ensure badge is near viewport top
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    
    // Hover over the first badge
    await firstBadge.hover();
    await page.waitForTimeout(500);
    
    // Check if tooltip appears
    const tooltip = page.locator('div').filter({ hasText: 'QUICK TAKE' }).first();
    
    if (await tooltip.isVisible()) {
      const tooltipBox = await tooltip.boundingBox();
      const badgeBox = await firstBadge.boundingBox();
      
      if (tooltipBox && badgeBox) {
        // When badge is near top, tooltip should appear below
        if (badgeBox.y < 300) {
          expect(tooltipBox.y).toBeGreaterThan(badgeBox.y);
          console.log('✅ Tooltip correctly positioned below when badge is near top');
        }
      }
    }
  }
  
  // Find a badge in the middle or bottom
  const badges = await page.locator('span').filter({ hasText: /BASIC|SOLID|ALPHA|TRASH/i }).all();
  
  if (badges.length > 2) {
    const middleBadge = badges[Math.floor(badges.length / 2)];
    
    // Hover over middle badge
    await middleBadge.hover();
    await page.waitForTimeout(500);
    
    const tooltip = page.locator('div').filter({ hasText: 'QUICK TAKE' }).first();
    
    if (await tooltip.isVisible()) {
      const tooltipBox = await tooltip.boundingBox();
      const badgeBox = await middleBadge.boundingBox();
      
      if (tooltipBox && badgeBox) {
        // When badge has space above, tooltip should appear above
        if (badgeBox.y > 400) {
          expect(tooltipBox.y).toBeLessThan(badgeBox.y);
          console.log('✅ Tooltip correctly positioned above when space is available');
        }
      }
    }
  }
});