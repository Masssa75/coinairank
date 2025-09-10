const { test, expect } = require('@playwright/test');

test('Debug site state', async ({ page }) => {
  console.log('=== DEBUGGING SITE STATE ===');
  
  // Go to site
  await page.goto('https://coinairank.com');
  await page.waitForTimeout(5000);
  
  console.log('Site loaded, taking screenshot...');
  await page.screenshot({ path: 'debug-site-state.png', fullPage: true });
  
  // Check if we can see any projects
  const projectElements = page.locator('[data-testid*="project"], .project-card, .token-card');
  const projectCount = await projectElements.count();
  console.log(`Found ${projectCount} project elements`);
  
  // Look for search input
  const searchInputs = page.locator('input');
  const inputCount = await searchInputs.count();
  console.log(`Found ${inputCount} input elements`);
  
  for (let i = 0; i < inputCount; i++) {
    const placeholder = await searchInputs.nth(i).getAttribute('placeholder');
    const type = await searchInputs.nth(i).getAttribute('type');
    console.log(`Input ${i+1}: type="${type}", placeholder="${placeholder}"`);
  }
  
  console.log('=== DEBUG COMPLETED ===');
  await page.waitForTimeout(10000);
});