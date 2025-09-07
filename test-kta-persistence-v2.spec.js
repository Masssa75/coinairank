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
  
  // Find and click the Include Unverified checkbox directly
  // Try multiple selectors
  console.log('Looking for Include Unverified checkbox...');
  
  // Method 1: Click the label containing the text
  const labelMethod = await page.locator('label:has-text("Include Unverified")').click().then(() => true).catch(() => false);
  if (labelMethod) {
    console.log('Clicked using label:has-text method');
  }
  
  // Method 2: If that didn't work, try clicking the checkbox input directly
  if (!labelMethod) {
    const checkboxes = await page.locator('input[type="checkbox"]').all();
    console.log(`Found ${checkboxes.length} checkboxes`);
    
    // The Include Unverified is typically the second checkbox (first is Include Imposters)
    if (checkboxes.length >= 2) {
      await checkboxes[1].click();
      console.log('Clicked second checkbox directly');
    }
  }
  
  // Wait for data to reload
  await page.waitForTimeout(3000);
  
  // Log what we see in the grid
  const projectCards = await page.locator('div.bg-white.rounded-lg').count();
  console.log(`Number of project cards visible: ${projectCards}`);
  
  // Try to find KTA by looking for text in project cards
  const ktaTexts = await page.locator('text=/KTA/i').count();
  console.log(`Elements containing "KTA": ${ktaTexts}`);
  
  // Check if KTA appears (try multiple selectors)
  const ktaVisible1 = await page.locator('h3:text("KTA")').isVisible().catch(() => false) ||
                      await page.locator('a:has-text("KTA")').isVisible().catch(() => false) ||
                      await page.locator('text="KTA"').isVisible().catch(() => false);
  console.log(`KTA visible after clicking checkbox: ${ktaVisible1}`);
  
  if (!ktaVisible1) {
    // Take a screenshot to debug
    await page.screenshot({ path: 'kta-not-found-after-click.png', fullPage: true });
    console.log('Screenshot saved: kta-not-found-after-click.png');
  }
  
  expect(ktaVisible1).toBe(true);
  
  // Reload the page
  console.log('\nReloading page...');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(3000); // Give extra time for localStorage to load
  
  // Check if KTA is still visible
  const ktaVisible2 = await page.locator('h3:text("KTA")').isVisible().catch(() => false) ||
                      await page.locator('a:has-text("KTA")').isVisible().catch(() => false) ||
                      await page.locator('text="KTA"').isVisible().catch(() => false);
  console.log(`KTA visible after page reload: ${ktaVisible2}`);
  
  // Take screenshot for debugging
  await page.screenshot({ path: 'kta-after-reload.png', fullPage: true });
  console.log('Screenshot saved: kta-after-reload.png');
  
  // Verify the checkbox is still checked
  const checkboxes = await page.locator('input[type="checkbox"]').all();
  if (checkboxes.length >= 2) {
    const checkboxChecked = await checkboxes[1].isChecked();
    console.log(`Include Unverified checkbox checked after reload: ${checkboxChecked}`);
  }
  
  // Assert KTA is visible
  expect(ktaVisible2).toBe(true);
});