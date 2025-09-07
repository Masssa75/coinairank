const { test, expect } = require('@playwright/test');

test('KTA shows with Include Unverified filter and persists after refresh', async ({ page }) => {
  console.log('Starting final KTA persistence test...\n');
  
  // Navigate to the site
  await page.goto('https://coinairank.com');
  await page.waitForTimeout(3000);
  
  // Step 1: Verify KTA is NOT visible initially
  console.log('Step 1: Verifying KTA is not visible initially...');
  let ktaInitial = await page.locator('h3:text("KTA")').isVisible().catch(() => false);
  console.log(`KTA initially visible: ${ktaInitial}`);
  expect(ktaInitial).toBe(false);
  
  // Step 2: Expand SAFETY section
  console.log('\nStep 2: Expanding SAFETY section...');
  await page.locator('text=/safety/i').first().click();
  await page.waitForTimeout(500);
  
  // Step 3: Click the Include Unverified checkbox (the custom div)
  console.log('Step 3: Clicking Include Unverified checkbox...');
  
  // Find the custom checkbox div that's next to "Include Unverified" text
  // It's a div with border that becomes green when checked
  const unverifiedCheckbox = page.locator('span:text("Include Unverified")').locator('..').locator('div').first();
  
  // Click the checkbox div
  await unverifiedCheckbox.click();
  console.log('✓ Clicked Include Unverified checkbox');
  
  // Wait for data to reload
  console.log('\nStep 4: Waiting for data to reload...');
  await page.waitForTimeout(4000);
  
  // Step 5: Check if KTA appears
  console.log('Step 5: Looking for KTA...');
  
  // Look for KTA in the project cards
  let ktaFound = false;
  
  // Try multiple selectors
  ktaFound = await page.locator('h3:text("KTA")').isVisible().catch(() => false) ||
             await page.locator('text="KTA"').nth(1).isVisible().catch(() => false); // nth(1) to skip sidebar
  
  if (!ktaFound) {
    // Get all h3 elements
    const allH3 = await page.locator('h3').allTextContents();
    console.log('All H3 elements:', allH3);
    
    // Check if KTA is in the list
    ktaFound = allH3.some(text => text === 'KTA');
  }
  
  if (ktaFound) {
    console.log('✓ KTA found after enabling Include Unverified!');
  } else {
    console.log('✗ KTA not found');
    await page.screenshot({ path: 'kta-not-found-final.png', fullPage: true });
  }
  
  expect(ktaFound).toBe(true);
  
  // Step 6: Check localStorage
  console.log('\nStep 6: Verifying localStorage...');
  const savedFilters = await page.evaluate(() => localStorage.getItem('carProjectsFilters'));
  if (savedFilters) {
    const filters = JSON.parse(savedFilters);
    console.log('Saved filters:', {
      includeUnverified: filters.includeUnverified,
      includeImposters: filters.includeImposters
    });
    expect(filters.includeUnverified).toBe(true);
  }
  
  // Step 7: Reload the page
  console.log('\nStep 7: Reloading page...');
  await page.reload();
  await page.waitForTimeout(5000); // Extra time for localStorage to load
  
  // Step 8: Check if KTA persists
  console.log('Step 8: Checking if KTA persists after reload...');
  
  let ktaAfterReload = await page.locator('h3:text("KTA")').isVisible().catch(() => false);
  
  if (!ktaAfterReload) {
    const allH3AfterReload = await page.locator('h3').allTextContents();
    ktaAfterReload = allH3AfterReload.some(text => text === 'KTA');
    console.log('Projects after reload:', allH3AfterReload.filter(t => !['Token Type', 'Safety', 'Networks', 'Website Score', 'Analysis Status'].includes(t)));
  }
  
  // Final screenshot
  await page.screenshot({ path: 'kta-persistence-final.png', fullPage: true });
  
  if (ktaAfterReload) {
    console.log('\n✅ SUCCESS: KTA persists after reload - filter persistence is working!');
  } else {
    console.log('\n❌ FAILURE: KTA does not persist after reload');
    
    // Debug localStorage again
    const filtersAfterReload = await page.evaluate(() => localStorage.getItem('carProjectsFilters'));
    console.log('Filters after reload:', filtersAfterReload);
  }
  
  expect(ktaAfterReload).toBe(true);
});