const { test, expect } = require('@playwright/test');

test('Search for brickcoin by contract address', async ({ page }) => {
  // Go to the site
  await page.goto('https://coinairank.com', { waitUntil: 'domcontentloaded', timeout: 20000 });
  
  // Wait a bit for initial load
  await page.waitForTimeout(3000);
  
  // Check "Include Unverified" checkbox - find by label text
  try {
    const unverifiedLabel = page.locator('label:has-text("Include Unverified")');
    const checkbox = unverifiedLabel.locator('input[type="checkbox"]');
    const isChecked = await checkbox.isChecked();
    if (!isChecked) {
      await checkbox.click();
      console.log('✅ Checked "Include Unverified"');
    } else {
      console.log('✔️ "Include Unverified" already checked');
    }
  } catch (e) {
    console.log('⚠️ Could not find "Include Unverified" checkbox');
  }
  
  // Wait a moment for filters to apply
  await page.waitForTimeout(1000);
  
  // Search for the contract address
  const searchInput = page.locator('input[placeholder*="Search"]').first();
  await searchInput.fill('Fv73EXJBRfctJzLVC3P7uQP6er6JU8b4KtDr4LQFpump');
  console.log('🔍 Searching for: Fv73EXJBRfctJzLVC3P7uQP6er6JU8b4KtDr4LQFpump');
  
  // Wait for search results to update
  await page.waitForTimeout(2000);
  
  // Check if brick token appears
  const brickToken = page.locator('text=/brick/i').first();
  const isVisible = await brickToken.isVisible().catch(() => false);
  
  if (isVisible) {
    console.log('✅ FOUND: brickcoin token is visible in search results!');
    
    // Get more info about the token
    const tokenCard = brickToken.locator('xpath=ancestor::div[contains(@class, "border")]').first();
    const info = await tokenCard.innerText().catch(() => 'Could not get info');
    console.log('Token info:', info);
  } else {
    console.log('❌ NOT FOUND: brickcoin token is not visible');
    
    // Check total results
    const resultCount = await page.locator('.text-gray-400').filter({ hasText: /token/i }).first().innerText().catch(() => 'No count found');
    console.log('Results count:', resultCount);
    
    // Get visible tokens for debugging
    const visibleTokens = await page.locator('h3').allInnerTexts().catch(() => []);
    console.log('Visible tokens:', visibleTokens.slice(0, 5));
  }
  
  // Take a screenshot
  await page.screenshot({ path: 'brickcoin-search-result.png', fullPage: false });
  console.log('📸 Screenshot saved as brickcoin-search-result.png');
});