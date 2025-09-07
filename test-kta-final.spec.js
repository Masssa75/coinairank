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
  
  // Now look for the Include Unverified checkbox
  console.log('Looking for Include Unverified checkbox...');
  
  // Find all checkboxes and their labels
  const checkboxContainers = await page.locator('label.flex.items-center').all();
  console.log(`Found ${checkboxContainers.length} checkbox containers`);
  
  // Find the Include Unverified checkbox by its text
  for (let i = 0; i < checkboxContainers.length; i++) {
    const text = await checkboxContainers[i].textContent();
    console.log(`Checkbox ${i}: "${text}"`);
    if (text && text.includes('Include Unverified')) {
      console.log('Found Include Unverified checkbox, clicking it...');
      await checkboxContainers[i].click();
      break;
    }
  }
  
  // Wait for data to reload
  await page.waitForTimeout(3000);
  
  // Check if KTA appears
  const ktaVisible1 = await page.locator('text="KTA"').isVisible().catch(() => false);
  console.log(`KTA visible after clicking checkbox: ${ktaVisible1}`);
  
  if (!ktaVisible1) {
    console.log('KTA not found, taking screenshot...');
    await page.screenshot({ path: 'kta-not-found-after-click.png', fullPage: true });
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
  await page.screenshot({ path: 'kta-after-reload-final.png', fullPage: true });
  console.log('Screenshot saved: kta-after-reload-final.png');
  
  // Assert KTA is visible after reload
  expect(ktaVisible2).toBe(true);
  
  console.log('\n✅ Test passed: KTA persists after page reload with Include Unverified filter');
});