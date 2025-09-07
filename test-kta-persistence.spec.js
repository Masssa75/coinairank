const { test, expect } = require('@playwright/test');

test('KTA shows with Include Unverified filter after refresh', async ({ page }) => {
  // Navigate to the site
  await page.goto('https://coinairank.com', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // Open sidebar
  const expandButton = page.locator('button[title="Expand Filters"]').or(page.locator('button').nth(0));
  if (await expandButton.isVisible()) {
    await expandButton.click();
    await page.waitForTimeout(1000);
  }
  
  // Click Include Unverified checkbox (find by span text and click parent)
  const spanUnverified = page.locator('span:text("Include Unverified")');
  if (await spanUnverified.isVisible()) {
    console.log('Found span with "Include Unverified"');
    const parent = spanUnverified.locator('..');
    await parent.click();
    console.log('Clicked parent of span to toggle checkbox');
  }
  
  // Wait for data to reload
  await page.waitForTimeout(2000);
  
  // Check if KTA appears
  const ktaVisible1 = await page.locator('h3:text("KTA")').isVisible().catch(() => false);
  console.log(`KTA visible after clicking checkbox: ${ktaVisible1}`);
  expect(ktaVisible1).toBe(true);
  
  // Reload the page
  console.log('\nReloading page...');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(3000); // Give extra time for localStorage to load
  
  // Check if KTA is still visible
  const ktaVisible2 = await page.locator('h3:text("KTA")').isVisible().catch(() => false);
  console.log(`KTA visible after page reload: ${ktaVisible2}`);
  
  // Take screenshot for debugging
  await page.screenshot({ path: 'kta-after-reload.png', fullPage: true });
  console.log('Screenshot saved: kta-after-reload.png');
  
  // Verify the checkbox is still checked
  const checkboxChecked = await page.locator('input[type="checkbox"]').nth(1).isChecked().catch(() => false);
  console.log(`Include Unverified checkbox checked after reload: ${checkboxChecked}`);
  
  // Assert KTA is visible
  expect(ktaVisible2).toBe(true);
});