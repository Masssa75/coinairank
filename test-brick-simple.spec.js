const { test, expect } = require('@playwright/test');

test('Search for brick token', async ({ page }) => {
  // Navigate to the main page
  await page.goto('https://coinairank.com');
  
  // Wait for page to load
  await page.waitForLoadState('networkidle');
  
  // Search for the contract address  
  const searchInput = page.locator('input[placeholder*="Search"]').first();
  await searchInput.fill('Fv73EXJBRfctJzLVC3P7uQP6er6JU8b4KtDr4LQFpump');
  
  // Wait a moment for search to apply
  await page.waitForTimeout(2000);
  
  // Take a screenshot
  await page.screenshot({ path: 'brick-search-result.png', fullPage: true });
  
  // Check if any results show
  const projectCards = page.locator('[class*="ProjectCard"]');
  const count = await projectCards.count();
  
  console.log(`Found ${count} projects matching search`);
  
  // Look for brick specifically
  const brickCard = page.locator('text=/brick/i').first();
  const isVisible = await brickCard.isVisible().catch(() => false);
  
  if (isVisible) {
    console.log('✅ Brick token found in search results!');
    
    // Get the score if visible
    const scoreElement = brickCard.locator('xpath=ancestor::div[contains(@class, "ProjectCard")]//span[contains(@class, "score")]');
    const score = await scoreElement.textContent().catch(() => 'Score not visible');
    console.log(`Score: ${score}`);
  } else {
    console.log('❌ Brick token not found in search results');
  }
  
  // Also try searching by symbol
  await searchInput.clear();
  await searchInput.fill('brick');
  await page.waitForTimeout(2000);
  
  const brickBySymbol = page.locator('text=/brick/i').first();
  const symbolVisible = await brickBySymbol.isVisible().catch(() => false);
  
  if (symbolVisible) {
    console.log('✅ Brick token found when searching by symbol');
  } else {
    console.log('❌ Brick token not found when searching by symbol');
  }
});