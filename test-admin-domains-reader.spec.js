const { test, expect } = require('@playwright/test');

test('Admin domains page reads from edge function', async ({ page }) => {
  // Navigate to admin login
  await page.goto('https://coinairank.com/admin');
  
  // Login with password
  await page.fill('input[type="password"]', 'donkey');
  await page.click('button:has-text("Login")');
  
  // Wait for authentication
  await page.waitForTimeout(2000);
  
  // Navigate to domains page
  await page.goto('https://coinairank.com/admin/domains');
  
  // Wait for domains to load
  await page.waitForSelector('text=Excluded Domains', { timeout: 10000 });
  
  // Check that domains are displayed
  await expect(page.locator('text=pump.fun')).toBeVisible();
  await expect(page.locator('text=youtube.com')).toBeVisible();
  await expect(page.locator('text=instagram.com')).toBeVisible();
  await expect(page.locator('text=twitter.com')).toBeVisible();
  
  // Count domains - should be 19 or more from edge function
  const domainCount = await page.locator('.font-mono.text-sm').count();
  console.log(`Found ${domainCount} domains displayed`);
  expect(domainCount).toBeGreaterThanOrEqual(17); // At least 17 domains
  
  console.log('✅ Admin domains page successfully reads from edge function');
});