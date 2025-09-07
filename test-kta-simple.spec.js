const { test, expect } = require('@playwright/test');

test('KTA shows with Include Unverified filter after refresh', async ({ page }) => {
  // Navigate to the site with shorter timeout
  await page.goto('https://coinairank.com', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  // Click the filter icon in the sidebar
  console.log('Step 1: Expanding sidebar...');
  await page.locator('button').first().click();
  await page.waitForTimeout(1000);
  
  // Expand Token Filters section
  console.log('Step 2: Expanding Token Filters...');
  await page.locator('text="Token Filters"').click();
  await page.waitForTimeout(500);
  
  // Check the Include Unverified checkbox
  console.log('Step 3: Checking Include Unverified...');
  const checkbox = page.locator('input[type="checkbox"]').nth(3); // 4th checkbox (0-indexed)
  await checkbox.check();
  await page.waitForTimeout(3000);
  
  // Look for KTA
  console.log('Step 4: Looking for KTA...');
  let ktaFound = false;
  try {
    await page.locator('text="KTA"').waitFor({ timeout: 5000 });
    ktaFound = true;
    console.log('✓ KTA found after checking Include Unverified');
  } catch {
    console.log('✗ KTA not found after checking Include Unverified');
  }
  
  expect(ktaFound).toBe(true);
  
  // Reload page
  console.log('\nStep 5: Reloading page...');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  
  // Check if KTA persists
  console.log('Step 6: Checking if KTA persists...');
  let ktaFoundAfterReload = false;
  try {
    await page.locator('text="KTA"').waitFor({ timeout: 5000 });
    ktaFoundAfterReload = true;
    console.log('✓ KTA still visible after reload - filter persistence working!');
  } catch {
    console.log('✗ KTA not visible after reload - filter persistence issue');
  }
  
  await page.screenshot({ path: 'kta-final-state.png', fullPage: true });
  
  expect(ktaFoundAfterReload).toBe(true);
});