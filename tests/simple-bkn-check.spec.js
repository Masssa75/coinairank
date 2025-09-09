const { test, expect } = require('@playwright/test');

test('Simple BKN verification', async ({ page }) => {
  console.log('Opening coinairank.com...');
  
  await page.goto('https://coinairank.com');
  await page.waitForTimeout(5000);
  
  // Take screenshot for manual verification
  await page.screenshot({ path: 'bkn-homepage.png', fullPage: true });
  console.log('Screenshot saved as bkn-homepage.png');
  
  // Look for BKN anywhere on the page
  const bknText = page.locator('text=BKN');
  const bknVisible = await bknText.isVisible({ timeout: 10000 }).catch(() => false);
  console.log('BKN visible on homepage:', bknVisible);
  
  if (bknVisible) {
    console.log('✅ BKN found on page');
    await bknText.first().click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'bkn-clicked.png', fullPage: true });
    console.log('Screenshot after click saved as bkn-clicked.png');
  }
  
  // Look for SOLID tier badge
  const solidBadge = page.locator('text=SOLID');
  const solidVisible = await solidBadge.isVisible().catch(() => false);
  console.log('SOLID tier badge visible:', solidVisible);
  
  console.log('Manual verification screenshots saved. Check bkn-homepage.png and bkn-clicked.png');
  await page.waitForTimeout(10000);
});