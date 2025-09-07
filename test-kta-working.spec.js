const { test, expect } = require('@playwright/test');

test('KTA shows with Include Unverified filter after refresh', async ({ page }) => {
  // Navigate to the site
  await page.goto('https://coinairank.com', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // Click the filter icon in the sidebar to expand filters
  console.log('Looking for filter button...');
  const filterButton = await page.locator('button.text-gray-400').first();
  if (await filterButton.isVisible()) {
    console.log('Clicking filter button to expand sidebar...');
    await filterButton.click();
    await page.waitForTimeout(1500);
  }
  
  // Expand the "Token Filters" section if it's collapsed
  console.log('Expanding Token Filters section...');
  const tokenFiltersHeader = await page.locator('div:has-text("Token Filters")').first();
  if (await tokenFiltersHeader.isVisible()) {
    await tokenFiltersHeader.click();
    await page.waitForTimeout(500);
  }
  
  // Now look for the Include Unverified checkbox input directly
  console.log('Looking for Include Unverified checkbox...');
  
  // Find the checkbox by looking for the input element next to "Include Unverified" text
  const includeUnverifiedCheckbox = await page.locator('label:has-text("Include Unverified") input[type="checkbox"]');
  
  if (await includeUnverifiedCheckbox.isVisible()) {
    const isChecked = await includeUnverifiedCheckbox.isChecked();
    console.log(`Include Unverified checkbox current state: ${isChecked ? 'checked' : 'unchecked'}`);
    
    if (!isChecked) {
      console.log('Clicking to check Include Unverified...');
      await includeUnverifiedCheckbox.check();
    }
  }
  
  // Wait for data to reload
  await page.waitForTimeout(3000);
  
  // Check if KTA appears
  const ktaVisible1 = await page.locator('text="KTA"').isVisible().catch(() => false);
  console.log(`KTA visible after clicking checkbox: ${ktaVisible1}`);
  
  if (!ktaVisible1) {
    console.log('KTA not found, taking screenshot...');
    await page.screenshot({ path: 'kta-not-found-working.png', fullPage: true });
  } else {
    console.log('KTA found successfully!');
  }
  
  expect(ktaVisible1).toBe(true);
  
  // Reload the page
  console.log('\nReloading page to test persistence...');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(4000); // Give extra time for localStorage to load
  
  // Check if KTA is still visible
  const ktaVisible2 = await page.locator('text="KTA"').isVisible().catch(() => false);
  console.log(`KTA visible after page reload: ${ktaVisible2}`);
  
  // Take screenshot for debugging
  await page.screenshot({ path: 'kta-after-reload-working.png', fullPage: true });
  console.log('Screenshot saved: kta-after-reload-working.png');
  
  // Assert KTA is visible after reload
  expect(ktaVisible2).toBe(true);
  
  console.log('\n✅ Test passed: KTA persists after page reload with Include Unverified filter');
});