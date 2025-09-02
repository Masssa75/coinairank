import { test, expect } from '@playwright/test';

test('CoinAIRank dashboard loads at root path', async ({ page }) => {
  // Navigate to the root path
  await page.goto('https://coinairank.com');
  
  // Wait for the page to load
  await page.waitForLoadState('networkidle');
  
  // Take a screenshot for debugging
  await page.screenshot({ path: 'dashboard-screenshot.png' });
  
  // Check page title
  await expect(page).toHaveTitle(/CoinAIRank/);
  
  // Log the page content for debugging
  const bodyText = await page.locator('body').textContent();
  console.log('Page content preview:', bodyText?.substring(0, 200));
  
  // Check for any loading or error messages
  const hasLoading = await page.locator('text=Loading').count();
  const hasError = await page.locator('text=Error').count();
  
  console.log('Loading elements:', hasLoading);
  console.log('Error elements:', hasError);
  
  // Check for the filter sidebar or main grid
  const hasFilterSidebar = await page.locator('.w-64').count();
  const hasMainGrid = await page.locator('.grid').count();
  
  console.log('Filter sidebar elements:', hasFilterSidebar);
  console.log('Grid elements:', hasMainGrid);
  
  // The page should have either filter sidebar or grid
  expect(hasFilterSidebar + hasMainGrid).toBeGreaterThan(0);
  
  console.log('✅ Page loaded at coinairank.com');
});