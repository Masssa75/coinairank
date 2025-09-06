const { test, expect } = require('@playwright/test');

test('Verify github.com and gitlab.com removed from exclusions', async ({ page }) => {
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
  
  // Verify github.com and gitlab.com are NOT in the list
  const githubDomain = await page.locator('text=github.com').count();
  const gitlabDomain = await page.locator('text=gitlab.com').count();
  
  expect(githubDomain).toBe(0);
  expect(gitlabDomain).toBe(0);
  
  // Verify other domains are still there
  await expect(page.locator('text=pump.fun')).toBeVisible();
  await expect(page.locator('text=youtube.com')).toBeVisible();
  await expect(page.locator('text=medium.com')).toBeVisible();
  
  // Count domains - should be 17 now (was 19, removed 2)
  const domainCount = await page.locator('.font-mono.text-sm').count();
  console.log(`Found ${domainCount} domains (should be 17)`);
  expect(domainCount).toBe(17);
  
  console.log('✅ Successfully removed github.com and gitlab.com from exclusions');
});