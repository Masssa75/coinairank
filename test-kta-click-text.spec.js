const { test, expect } = require('@playwright/test');

test('KTA shows with Include Unverified filter after refresh', async ({ page }) => {
  console.log('Starting test with text-based filter clicking...\n');
  
  // Navigate to the site
  await page.goto('https://coinairank.com');
  await page.waitForTimeout(3000);
  
  // Step 1: Expand SAFETY section if needed
  console.log('Step 1: Expanding SAFETY section...');
  const safetyHeader = page.locator('text=/safety/i').first();
  try {
    await safetyHeader.click({ timeout: 2000 });
    console.log('Clicked SAFETY header');
  } catch {
    console.log('SAFETY section might already be expanded');
  }
  await page.waitForTimeout(1000);
  
  // Step 2: Click on "Include Unverified" text
  console.log('\nStep 2: Clicking "Include Unverified" text...');
  
  // The filter appears to be a clickable text, not a checkbox
  const includeUnverifiedText = page.locator('text="Include Unverified"');
  
  try {
    await includeUnverifiedText.click({ timeout: 3000 });
    console.log('✓ Clicked "Include Unverified" filter');
  } catch (e) {
    console.log('Could not click Include Unverified, trying parent element...');
    // Try clicking the parent div
    const parent = includeUnverifiedText.locator('..');
    await parent.click();
    console.log('✓ Clicked parent of "Include Unverified"');
  }
  
  // Wait for data to reload
  console.log('\nStep 3: Waiting for data to reload...');
  await page.waitForTimeout(4000);
  
  // Step 4: Look for KTA
  console.log('Step 4: Looking for KTA token...');
  
  // Get all h3 elements (project titles)
  const projectTitles = page.locator('h3');
  const projectNames = await projectTitles.allTextContents();
  
  // Filter out the sidebar section headers
  const actualProjects = projectNames.filter(name => 
    !['Token Type', 'Safety', 'Networks', 'Website Score', 'Analysis Status'].includes(name)
  );
  
  console.log(`Found ${actualProjects.length} actual projects`);
  console.log('Projects visible:', actualProjects);
  
  const ktaFound = actualProjects.some(name => name.includes('KTA'));
  
  if (ktaFound) {
    console.log('✓ KTA found after enabling Include Unverified!');
  } else {
    console.log('✗ KTA not found');
    await page.screenshot({ path: 'kta-not-visible.png', fullPage: true });
  }
  
  expect(ktaFound).toBe(true);
  
  // Step 5: Reload the page
  console.log('\nStep 5: Reloading page to test persistence...');
  await page.reload();
  await page.waitForTimeout(5000); // Give time for localStorage to load
  
  // Step 6: Check if KTA persists
  console.log('Step 6: Checking if KTA persists after reload...');
  
  const projectTitlesAfterReload = page.locator('h3');
  const projectNamesAfterReload = await projectTitlesAfterReload.allTextContents();
  
  const actualProjectsAfterReload = projectNamesAfterReload.filter(name => 
    !['Token Type', 'Safety', 'Networks', 'Website Score', 'Analysis Status'].includes(name)
  );
  
  console.log(`Found ${actualProjectsAfterReload.length} projects after reload`);
  console.log('Projects after reload:', actualProjectsAfterReload);
  
  const ktaFoundAfterReload = actualProjectsAfterReload.some(name => name.includes('KTA'));
  
  // Check localStorage to verify filters were saved
  const savedFilters = await page.evaluate(() => {
    const filters = localStorage.getItem('carProjectsFilters');
    return filters ? JSON.parse(filters) : null;
  });
  
  if (savedFilters) {
    console.log('\nSaved filters in localStorage:');
    console.log('  includeUnverified:', savedFilters.includeUnverified);
    console.log('  includeImposters:', savedFilters.includeImposters);
    console.log('  networks:', savedFilters.networks);
  }
  
  // Take final screenshot
  await page.screenshot({ path: 'test-final-state.png', fullPage: true });
  
  if (ktaFoundAfterReload) {
    console.log('\n✅ SUCCESS: KTA persists after page reload!');
    console.log('Filter persistence is working correctly.');
  } else {
    console.log('\n❌ FAILURE: KTA does not persist after reload');
    console.log('The race condition fix may not be working as expected.');
  }
  
  expect(ktaFoundAfterReload).toBe(true);
});