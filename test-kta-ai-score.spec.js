const { test, expect } = require('@playwright/test');

test('KTA shows with Include Unverified filter sorted by AI Score', async ({ page }) => {
  console.log('Starting KTA test with AI Score sorting...\n');
  
  // Navigate to the site
  await page.goto('https://coinairank.com');
  await page.waitForTimeout(3000);
  
  // Step 1: Change sort to AI Score
  console.log('Step 1: Changing sort to AI Score...');
  
  // Click the sort dropdown
  const sortDropdown = page.locator('select').first(); // The sort dropdown
  await sortDropdown.selectOption({ label: 'AI Score' });
  console.log('✓ Selected AI Score sorting');
  await page.waitForTimeout(2000);
  
  // Step 2: Expand SAFETY section
  console.log('\nStep 2: Expanding SAFETY section...');
  await page.locator('text=/safety/i').first().click();
  await page.waitForTimeout(500);
  
  // Step 3: Click Include Unverified
  console.log('Step 3: Clicking Include Unverified...');
  const unverifiedCheckbox = page.locator('span:text("Include Unverified")').locator('..').locator('div').first();
  await unverifiedCheckbox.click();
  console.log('✓ Clicked Include Unverified');
  
  // Wait for data to reload
  console.log('\nStep 4: Waiting for data to reload...');
  await page.waitForTimeout(4000);
  
  // Step 5: Look for KTA
  console.log('Step 5: Looking for KTA...');
  
  // Get all project names
  const projectNames = await page.locator('h3').allTextContents();
  const actualProjects = projectNames.filter(name => 
    !['Token Type', 'Safety', 'Networks', 'Website Score', 'Analysis Status'].includes(name)
  );
  
  console.log('Projects visible (first 10):', actualProjects.slice(0, 10));
  
  const ktaFound = actualProjects.includes('KTA');
  const ktaPosition = ktaFound ? actualProjects.indexOf('KTA') + 1 : -1;
  
  if (ktaFound) {
    console.log(`✓ KTA found at position ${ktaPosition}!`);
  } else {
    console.log('✗ KTA not found');
    await page.screenshot({ path: 'kta-not-found-ai-score.png', fullPage: true });
  }
  
  expect(ktaFound).toBe(true);
  
  // Step 6: Check localStorage
  console.log('\nStep 6: Checking localStorage...');
  const savedFilters = await page.evaluate(() => localStorage.getItem('carProjectsFilters'));
  const savedSort = await page.evaluate(() => localStorage.getItem('carProjectsSortBy'));
  
  if (savedFilters) {
    const filters = JSON.parse(savedFilters);
    console.log('Saved filters:', {
      includeUnverified: filters.includeUnverified,
      includeImposters: filters.includeImposters,
      networks: filters.networks
    });
    expect(filters.includeUnverified).toBe(true);
  }
  
  console.log('Saved sort:', savedSort);
  
  // Step 7: Reload and check persistence
  console.log('\nStep 7: Reloading page...');
  await page.reload();
  await page.waitForTimeout(5000);
  
  // Check if sort persists
  const sortAfterReload = await page.locator('select').first().inputValue();
  console.log('Sort after reload:', sortAfterReload);
  
  // Check if KTA persists
  console.log('Step 8: Checking if KTA persists...');
  const projectsAfterReload = await page.locator('h3').allTextContents();
  const actualProjectsAfterReload = projectsAfterReload.filter(name => 
    !['Token Type', 'Safety', 'Networks', 'Website Score', 'Analysis Status'].includes(name)
  );
  
  const ktaAfterReload = actualProjectsAfterReload.includes('KTA');
  const ktaPositionAfterReload = ktaAfterReload ? actualProjectsAfterReload.indexOf('KTA') + 1 : -1;
  
  console.log('Projects after reload (first 10):', actualProjectsAfterReload.slice(0, 10));
  
  if (ktaAfterReload) {
    console.log(`\n✅ SUCCESS: KTA persists at position ${ktaPositionAfterReload} after reload!`);
    console.log('Filter persistence is working correctly.');
  } else {
    console.log('\n❌ FAILURE: KTA does not persist after reload');
    
    // Debug
    const filtersAfterReload = await page.evaluate(() => localStorage.getItem('carProjectsFilters'));
    console.log('Filters in localStorage after reload:', filtersAfterReload);
    
    await page.screenshot({ path: 'kta-not-persisted.png', fullPage: true });
  }
  
  expect(ktaAfterReload).toBe(true);
});