const { test, expect } = require('@playwright/test');

test('Visual check with screenshot', async ({ page }) => {
  // Go to the site with headed mode to see what's happening
  await page.goto('https://coinairank.com');
  
  // Wait for content to load
  await page.waitForTimeout(3000);
  
  // Take a screenshot
  await page.screenshot({ path: 'coinairank-current.png', fullPage: false });
  
  // Check what's in the DOM
  const hasRedText = await page.locator('.text-red-500').count();
  console.log('Elements with red text (text-red-500):', hasRedText);
  
  // Check for "Verified Imposter" text
  const verifiedImposter = await page.locator('text="Verified Imposter"').count();
  console.log('Elements with "Verified Imposter" text:', verifiedImposter);
  
  // Check project titles specifically
  const titles = await page.locator('h3.text-xl').count();
  console.log('Number of project titles found:', titles);
  
  // Get the first few project cards HTML to inspect
  const firstCard = await page.locator('[class*="bg-"][class*="rounded-2xl"]').first();
  if (await firstCard.count() > 0) {
    const html = await firstCard.innerHTML();
    console.log('\nFirst card HTML (truncated):');
    console.log(html.substring(0, 500) + '...');
  }
});