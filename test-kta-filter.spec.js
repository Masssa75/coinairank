const { test, expect } = require('@playwright/test');

test('KTA shows with Include Unverified filter after refresh', async ({ page }) => {
  console.log('Starting test for KTA filter persistence...');
  
  // Step 1: Navigate to the site
  console.log('Step 1: Navigating to site...');
  await page.goto('https://coinairank.com');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
  
  // Step 2: Expand the sidebar filters
  console.log('Step 2: Expanding sidebar...');
  const filterButton = page.locator('button').first();
  await filterButton.click();
  await page.waitForTimeout(1000);
  
  // Step 3: Find and expand the collapsible section containing filters
  console.log('Step 3: Looking for collapsible sections...');
  
  // Click on all collapsible headers to expand them
  const collapsibleHeaders = await page.locator('div.px-5.py-5.cursor-pointer').all();
  console.log(`Found ${collapsibleHeaders.length} collapsible sections`);
  
  for (let i = 0; i < collapsibleHeaders.length; i++) {
    const headerText = await collapsibleHeaders[i].textContent();
    console.log(`Expanding section ${i}: ${headerText?.trim()}`);
    await collapsibleHeaders[i].click();
    await page.waitForTimeout(300);
  }
  
  // Step 4: Find and check the Include Unverified checkbox
  console.log('Step 4: Looking for checkboxes...');
  
  // Get all checkboxes and find the Include Unverified one
  const checkboxes = await page.locator('input[type="checkbox"]').all();
  console.log(`Found ${checkboxes.length} checkboxes`);
  
  // Get all labels to identify which checkbox is which
  const labels = await page.locator('label.flex.items-center').all();
  
  let includeUnverifiedIndex = -1;
  for (let i = 0; i < labels.length; i++) {
    const text = await labels[i].textContent();
    console.log(`Checkbox ${i}: ${text?.trim()}`);
    if (text && text.includes('Include Unverified')) {
      includeUnverifiedIndex = i;
      break;
    }
  }
  
  if (includeUnverifiedIndex >= 0 && includeUnverifiedIndex < checkboxes.length) {
    console.log(`Checking Include Unverified checkbox at index ${includeUnverifiedIndex}...`);
    await checkboxes[includeUnverifiedIndex].check();
    await page.waitForTimeout(3000); // Wait for data to reload
  } else {
    throw new Error('Could not find Include Unverified checkbox');
  }
  
  // Step 5: Verify KTA appears
  console.log('Step 5: Checking if KTA appears...');
  
  // Take a screenshot before checking
  await page.screenshot({ path: 'before-reload.png', fullPage: true });
  
  // Look for KTA in multiple ways
  let ktaFound = false;
  const ktaSelectors = [
    'text="KTA"',
    'h3:text("KTA")',
    'a:text("KTA")',
    '[class*="text-"]:text("KTA")'
  ];
  
  for (const selector of ktaSelectors) {
    if (await page.locator(selector).isVisible().catch(() => false)) {
      ktaFound = true;
      console.log(`✓ KTA found with selector: ${selector}`);
      break;
    }
  }
  
  if (!ktaFound) {
    // Log all visible project names to debug
    const projectNames = await page.locator('h3').allTextContents();
    console.log('Visible project names:', projectNames);
  }
  
  expect(ktaFound).toBe(true);
  
  // Step 6: Reload the page
  console.log('\nStep 6: Reloading page to test persistence...');
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(5000); // Extra time for localStorage and data to load
  
  // Step 7: Check if KTA still appears (filters should persist)
  console.log('Step 7: Checking if KTA persists after reload...');
  
  // Take a screenshot after reload
  await page.screenshot({ path: 'after-reload.png', fullPage: true });
  
  let ktaFoundAfterReload = false;
  for (const selector of ktaSelectors) {
    if (await page.locator(selector).isVisible().catch(() => false)) {
      ktaFoundAfterReload = true;
      console.log(`✓ KTA still visible after reload with selector: ${selector}`);
      break;
    }
  }
  
  if (!ktaFoundAfterReload) {
    // Log all visible project names to debug
    const projectNames = await page.locator('h3').allTextContents();
    console.log('Visible project names after reload:', projectNames);
    
    // Check localStorage to see if filters were saved
    const savedFilters = await page.evaluate(() => {
      return localStorage.getItem('carProjectsFilters');
    });
    console.log('Saved filters in localStorage:', savedFilters);
  }
  
  expect(ktaFoundAfterReload).toBe(true);
  
  console.log('\n✅ Test completed successfully! Filter persistence is working.');
});