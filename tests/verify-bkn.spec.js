const { test, expect } = require('@playwright/test');

test('Verify BKN analysis results', async ({ page }) => {
  console.log('Starting BKN verification test...');

  // Navigate to the site
  await page.goto('https://coinairank.com');
  
  // Login as admin
  console.log('Logging in as admin...');
  await page.click('button:has-text("Login"), input[type="submit"]:has-text("Login")');
  await page.fill('input[type="password"]', 'donkey');
  await page.click('button[type="submit"], input[type="submit"]');
  await page.waitForTimeout(3000);

  // Search for BKN
  console.log('Searching for BKN...');
  const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="filter" i]').first();
  await searchInput.fill('BKN');
  await page.waitForTimeout(2000);

  // Find BKN project card
  console.log('Looking for BKN project card...');
  const bknCard = page.locator('text=BKN').first();
  await expect(bknCard).toBeVisible({ timeout: 10000 });

  // Find and verify tier badge
  console.log('Checking tier badge...');
  const tierBadge = page.locator('text=SOLID', { hasText: 'SOLID' }).first();
  await expect(tierBadge).toBeVisible();
  console.log('✅ Tier badge shows SOLID');

  // Click on tier or project to open details
  console.log('Clicking to open project details...');
  await bknCard.click();
  await page.waitForTimeout(2000);

  // Look for tooltip or modal
  console.log('Looking for analysis details...');
  const detailsModal = page.locator('[role="dialog"], .modal, .tooltip').first();
  const isModalVisible = await detailsModal.isVisible().catch(() => false);
  
  if (isModalVisible) {
    console.log('✅ Details modal is visible');
    
    // Look for stage 2 links section
    const linksSection = page.locator('text=chosen links', 'text=Selected Links', 'text=stage 2').first();
    const hasLinksSection = await linksSection.isVisible().catch(() => false);
    
    if (hasLinksSection) {
      console.log('✅ Links section found');
      
      // Try to expand or access links
      await linksSection.click();
      await page.waitForTimeout(1000);
      
      // Count visible links
      const links = page.locator('a[href*="brickken"], a[href*="linkedin"], a[href*="github"]');
      const linkCount = await links.count();
      console.log(`Found ${linkCount} stage 2 links in UI`);
      
      // Log first few links
      for (let i = 0; i < Math.min(3, linkCount); i++) {
        const href = await links.nth(i).getAttribute('href');
        console.log(`Link ${i+1}: ${href}`);
      }
    } else {
      console.log('⚠️  Links section not immediately visible, might need different selector');
    }
  } else {
    console.log('⚠️  Details modal not visible, trying alternative approach...');
  }

  // Keep browser open for manual inspection
  console.log('Test completed. Browser will stay open for manual verification.');
  await page.waitForTimeout(60000);
});