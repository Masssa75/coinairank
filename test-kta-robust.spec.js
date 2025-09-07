const { test, expect } = require('@playwright/test');

test('KTA shows with Include Unverified filter after refresh', async ({ page }) => {
  console.log('Starting robust filter persistence test...\n');
  
  // Navigate to the site
  await page.goto('https://coinairank.com');
  await page.waitForTimeout(3000);
  
  // Take initial screenshot
  await page.screenshot({ path: 'test-initial.png', fullPage: true });
  
  // Method 1: Try to find the Safety section header and click it
  console.log('Step 1: Looking for expandable sections...');
  
  // Look for any element with SAFETY text (case insensitive)
  const safetySections = await page.locator('text=/safety/i').all();
  console.log(`Found ${safetySections.length} elements with "SAFETY"`);
  
  if (safetySections.length > 0) {
    try {
      await safetySections[0].click({ timeout: 2000 });
      console.log('Clicked SAFETY section');
      await page.waitForTimeout(500);
    } catch {
      console.log('Could not click SAFETY section, it might already be expanded');
    }
  }
  
  // Method 2: Look directly for checkboxes without expanding
  console.log('\nStep 2: Looking for all checkboxes...');
  await page.waitForTimeout(1000);
  
  // Get all checkbox inputs
  const checkboxes = await page.locator('input[type="checkbox"]').all();
  console.log(`Found ${checkboxes.length} checkboxes`);
  
  // Find the Include Unverified checkbox
  let includeUnverifiedIndex = -1;
  
  for (let i = 0; i < checkboxes.length; i++) {
    // Get the parent element that contains the label text
    const parent = await checkboxes[i].locator('..').locator('..');
    const labelText = await parent.textContent().catch(() => '');
    console.log(`Checkbox ${i}: "${labelText?.trim().substring(0, 50)}"`);
    
    if (labelText && (labelText.includes('Include Unverified') || labelText.includes('Unverified'))) {
      includeUnverifiedIndex = i;
      break;
    }
  }
  
  // If we didn't find it by label, it might be the 2nd checkbox (often Include Imposters is 1st, Include Unverified is 2nd)
  if (includeUnverifiedIndex === -1 && checkboxes.length >= 2) {
    console.log('Could not find by label, trying position-based approach...');
    includeUnverifiedIndex = 1; // Try the second checkbox
  }
  
  if (includeUnverifiedIndex >= 0 && includeUnverifiedIndex < checkboxes.length) {
    const isChecked = await checkboxes[includeUnverifiedIndex].isChecked();
    console.log(`\nCheckbox ${includeUnverifiedIndex} is currently: ${isChecked ? 'checked' : 'unchecked'}`);
    
    if (!isChecked) {
      console.log('Checking the Include Unverified checkbox...');
      await checkboxes[includeUnverifiedIndex].check();
    }
  } else {
    console.log('WARNING: Could not find Include Unverified checkbox');
  }
  
  // Wait for data to reload
  console.log('\nStep 3: Waiting for data to reload...');
  await page.waitForTimeout(4000);
  
  // Look for KTA
  console.log('Step 4: Looking for KTA...');
  
  // Get all project names
  const projectNames = await page.locator('h3').allTextContents();
  console.log(`Found ${projectNames.length} projects visible`);
  console.log('First 10 projects:', projectNames.slice(0, 10));
  
  const ktaFound = projectNames.some(name => name.includes('KTA'));
  
  if (ktaFound) {
    console.log('✓ KTA found!');
  } else {
    console.log('✗ KTA not found');
    await page.screenshot({ path: 'no-kta-found.png', fullPage: true });
  }
  
  expect(ktaFound).toBe(true);
  
  // Reload to test persistence
  console.log('\nStep 5: Reloading page...');
  await page.reload();
  await page.waitForTimeout(5000);
  
  // Check if KTA persists
  console.log('Step 6: Checking if KTA persists...');
  
  const projectNamesAfterReload = await page.locator('h3').allTextContents();
  console.log(`Found ${projectNamesAfterReload.length} projects after reload`);
  console.log('First 10 projects after reload:', projectNamesAfterReload.slice(0, 10));
  
  const ktaFoundAfterReload = projectNamesAfterReload.some(name => name.includes('KTA'));
  
  // Check localStorage
  const savedFilters = await page.evaluate(() => localStorage.getItem('carProjectsFilters'));
  if (savedFilters) {
    const filters = JSON.parse(savedFilters);
    console.log('\nSaved filters in localStorage:');
    console.log('  includeUnverified:', filters.includeUnverified);
    console.log('  includeImposters:', filters.includeImposters);
  }
  
  await page.screenshot({ path: 'test-final.png', fullPage: true });
  
  if (ktaFoundAfterReload) {
    console.log('\n✅ SUCCESS: KTA persists after reload!');
  } else {
    console.log('\n❌ FAILURE: KTA does not persist after reload');
  }
  
  expect(ktaFoundAfterReload).toBe(true);
});