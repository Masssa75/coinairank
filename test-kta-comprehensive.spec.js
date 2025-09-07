const { test, expect } = require('@playwright/test');

test('KTA shows with Include Unverified filter and persists after refresh', async ({ page }) => {
  console.log('Starting comprehensive KTA filter test...\n');
  
  // Navigate to the site
  await page.goto('https://coinairank.com');
  await page.waitForTimeout(3000);
  
  // Step 1: Verify KTA is NOT visible initially
  console.log('Step 1: Verifying KTA is not visible by default...');
  const initialProjects = await page.locator('h3').allTextContents();
  const ktaInitiallyVisible = initialProjects.some(name => name === 'KTA');
  console.log(`KTA initially visible: ${ktaInitiallyVisible}`);
  expect(ktaInitiallyVisible).toBe(false);
  
  // Step 2: Expand SAFETY section
  console.log('\nStep 2: Expanding SAFETY section...');
  const safetySection = page.locator('text=/safety/i').first();
  await safetySection.click();
  await page.waitForTimeout(500);
  
  // Step 3: Click Include Unverified
  console.log('Step 3: Clicking Include Unverified...');
  const includeUnverified = page.locator('text="Include Unverified"');
  
  // Check if the element has a visual indicator (like a checkmark or color change)
  const initialClass = await includeUnverified.getAttribute('class').catch(() => '');
  console.log(`Initial class: ${initialClass}`);
  
  await includeUnverified.click();
  await page.waitForTimeout(1000);
  
  // Check if class changed (indicating state change)
  const afterClickClass = await includeUnverified.getAttribute('class').catch(() => '');
  console.log(`After click class: ${afterClickClass}`);
  
  // Step 4: Monitor network request to verify the filter is applied
  console.log('\nStep 4: Monitoring API calls...');
  
  // Set up network monitoring
  const apiCalls = [];
  page.on('request', request => {
    if (request.url().includes('/api/crypto-projects-rated')) {
      const url = new URL(request.url());
      apiCalls.push({
        includeUnverified: url.searchParams.get('includeUnverified'),
        includeImposters: url.searchParams.get('includeImposters')
      });
      console.log(`API called with includeUnverified=${url.searchParams.get('includeUnverified')}`);
    }
  });
  
  // Wait for the data to reload
  await page.waitForTimeout(3000);
  
  // Step 5: Check if KTA appears
  console.log('\nStep 5: Checking for KTA...');
  
  // Use a more specific selector for project cards
  const projectCards = page.locator('div.bg-white.rounded-lg');
  const projectCount = await projectCards.count();
  console.log(`Found ${projectCount} project cards`);
  
  // Look for KTA in project titles
  let ktaFound = false;
  for (let i = 0; i < projectCount; i++) {
    const titleElement = projectCards.nth(i).locator('h3');
    const title = await titleElement.textContent().catch(() => '');
    if (title === 'KTA') {
      ktaFound = true;
      console.log(`✓ Found KTA at position ${i + 1}`);
      break;
    }
  }
  
  if (!ktaFound) {
    // Try direct API call to verify
    console.log('\nVerifying via direct API call...');
    const apiResponse = await page.evaluate(async () => {
      const response = await fetch('/api/crypto-projects-rated?includeUnverified=true&includeImposters=false');
      const data = await response.json();
      return data.data?.some(p => p.symbol === 'KTA');
    });
    console.log(`KTA in API response: ${apiResponse}`);
    
    // Take screenshot
    await page.screenshot({ path: 'kta-not-visible-ui.png', fullPage: true });
  }
  
  expect(ktaFound).toBe(true);
  
  // Step 6: Check localStorage
  console.log('\nStep 6: Checking localStorage...');
  const savedFilters = await page.evaluate(() => {
    return localStorage.getItem('carProjectsFilters');
  });
  
  if (savedFilters) {
    const filters = JSON.parse(savedFilters);
    console.log('Saved filters:', filters);
    expect(filters.includeUnverified).toBe(true);
  }
  
  // Step 7: Reload and verify persistence
  console.log('\nStep 7: Reloading page...');
  await page.reload();
  await page.waitForTimeout(5000);
  
  // Check if KTA is still visible
  console.log('Step 8: Checking if KTA persists...');
  const projectCardsAfterReload = page.locator('div.bg-white.rounded-lg');
  const projectCountAfterReload = await projectCardsAfterReload.count();
  
  let ktaFoundAfterReload = false;
  for (let i = 0; i < projectCountAfterReload; i++) {
    const titleElement = projectCardsAfterReload.nth(i).locator('h3');
    const title = await titleElement.textContent().catch(() => '');
    if (title === 'KTA') {
      ktaFoundAfterReload = true;
      console.log(`✓ KTA still visible at position ${i + 1} after reload`);
      break;
    }
  }
  
  // Final screenshot
  await page.screenshot({ path: 'kta-final-test.png', fullPage: true });
  
  if (ktaFoundAfterReload) {
    console.log('\n✅ SUCCESS: Filter persistence is working!');
  } else {
    console.log('\n❌ FAILURE: Filter persistence not working');
    
    // Debug: Check localStorage again
    const filtersAfterReload = await page.evaluate(() => {
      return localStorage.getItem('carProjectsFilters');
    });
    console.log('Filters after reload:', filtersAfterReload);
  }
  
  expect(ktaFoundAfterReload).toBe(true);
});