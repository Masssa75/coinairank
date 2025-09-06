const { test, expect } = require('@playwright/test');

test('Admin domains page access flow', async ({ page }) => {
  // Go to admin login
  await page.goto('https://coinairank.com/admin');
  
  // Wait for page to load
  await page.waitForLoadState('networkidle');
  
  // Take screenshot of login page
  await page.screenshot({ path: 'admin-login-page.png' });
  
  // Enter password
  await page.fill('input[type="password"]', 'donkey');
  
  // Click login button
  await page.click('button:has-text("Login")');
  
  // Wait for navigation
  await page.waitForLoadState('networkidle');
  
  // Check where we ended up
  const currentUrl = page.url();
  console.log('Current URL after login:', currentUrl);
  
  // Take screenshot after login
  await page.screenshot({ path: 'after-admin-login.png' });
  
  // Now try to navigate to domains page directly
  await page.goto('https://coinairank.com/admin/domains');
  await page.waitForLoadState('networkidle');
  
  const domainsUrl = page.url();
  console.log('URL when accessing domains page:', domainsUrl);
  
  // Take screenshot of domains page attempt
  await page.screenshot({ path: 'admin-domains-attempt.png' });
  
  // Check if we see the domains page content
  const pageContent = await page.content();
  const hasDomainsContent = pageContent.includes('Domain Exclusions');
  console.log('Has Domain Exclusions content:', hasDomainsContent);
});