const { test, expect } = require('@playwright/test');

test('Debug what is in the hamburger menu', async ({ page }) => {
  await page.goto('https://coinairank.com');
  await page.waitForTimeout(3000);
  
  // Take screenshot before opening menu
  await page.screenshot({ path: 'before-menu.png', fullPage: true });
  
  // Open hamburger menu
  console.log('Opening hamburger menu...');
  const menuButton = page.locator('button:has(svg)').first();
  await menuButton.click();
  
  // Wait for menu animation
  await page.waitForTimeout(1000);
  
  // Take screenshot after opening menu
  await page.screenshot({ path: 'after-menu.png', fullPage: true });
  
  // Log all text content visible on page
  const allText = await page.textContent('body');
  console.log('All text on page after menu open:', allText);
  
  // Look for any buttons or links that might contain "Add" or "Token"
  const addElements = await page.locator('*:has-text("Add")').allTextContents();
  console.log('Elements containing "Add":', addElements);
  
  const tokenElements = await page.locator('*:has-text("Token")').allTextContents();
  console.log('Elements containing "Token":', tokenElements);
  
  // Check for submit elements
  const submitElements = await page.locator('*:has-text("Submit")').allTextContents();
  console.log('Elements containing "Submit":', submitElements);
  
  // Check all clickable elements
  const clickableElements = await page.locator('button, a, [role="button"], [onclick]').allTextContents();
  console.log('All clickable elements:', clickableElements);
});