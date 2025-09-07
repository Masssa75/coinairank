const { test, expect } = require('@playwright/test');

test('Debug KTA persistence - monitor API calls', async ({ page }) => {
  console.log('Starting detailed API monitoring test...\n');
  
  // Monitor all API calls
  const apiCalls = [];
  page.on('request', request => {
    if (request.url().includes('/api/crypto-projects-rated')) {
      const url = new URL(request.url());
      const params = {
        includeUnverified: url.searchParams.get('includeUnverified'),
        includeImposters: url.searchParams.get('includeImposters'),
        sortBy: url.searchParams.get('sortBy'),
        sortOrder: url.searchParams.get('sortOrder'),
        networks: url.searchParams.get('networks'),
      };
      apiCalls.push({ time: new Date().toISOString(), params });
      console.log(`API Call #${apiCalls.length}:`, params);
    }
  });
  
  // Navigate to the site
  await page.goto('https://coinairank.com');
  await page.waitForTimeout(3000);
  
  console.log('\n=== Initial Load ===');
  console.log('API calls made on initial load:', apiCalls.length);
  
  // Change sort to AI Score
  console.log('\n=== Changing to AI Score ===');
  const sortDropdown = page.locator('select').first();
  await sortDropdown.selectOption({ label: 'AI Score' });
  await page.waitForTimeout(2000);
  
  // Expand SAFETY and click Include Unverified
  console.log('\n=== Enabling Include Unverified ===');
  await page.locator('text=/safety/i').first().click();
  await page.waitForTimeout(500);
  
  const unverifiedCheckbox = page.locator('span:text("Include Unverified")').locator('..').locator('div').first();
  await unverifiedCheckbox.click();
  await page.waitForTimeout(3000);
  
  // Check what's in localStorage before reload
  console.log('\n=== Before Reload ===');
  const beforeReload = await page.evaluate(() => {
    return {
      filters: localStorage.getItem('carProjectsFilters'),
      sort: localStorage.getItem('carProjectsSort')
    };
  });
  console.log('localStorage before reload:', beforeReload);
  
  // Get projects before reload
  const projectsBefore = await page.locator('h3').allTextContents();
  const filteredBefore = projectsBefore.filter(name => 
    !['Token Type', 'Safety', 'Networks', 'Website Score', 'Analysis Status'].includes(name)
  );
  console.log('Projects before reload:', filteredBefore.slice(0, 5));
  console.log('KTA visible before reload:', filteredBefore.includes('KTA'));
  
  // Clear API calls for reload
  apiCalls.length = 0;
  
  // Reload the page
  console.log('\n=== Reloading Page ===');
  await page.reload();
  
  // Wait a bit for initial render
  await page.waitForTimeout(1000);
  
  // Check localStorage after reload
  const afterReload = await page.evaluate(() => {
    return {
      filters: localStorage.getItem('carProjectsFilters'),
      sort: localStorage.getItem('carProjectsSort')
    };
  });
  console.log('localStorage after reload:', afterReload);
  
  // Wait for API calls to complete
  await page.waitForTimeout(4000);
  
  console.log('\n=== After Reload ===');
  console.log('API calls made after reload:', apiCalls.length);
  apiCalls.forEach((call, i) => {
    console.log(`  Call ${i + 1}:`, call.params);
  });
  
  // Get projects after reload
  const projectsAfter = await page.locator('h3').allTextContents();
  const filteredAfter = projectsAfter.filter(name => 
    !['Token Type', 'Safety', 'Networks', 'Website Score', 'Analysis Status'].includes(name)
  );
  console.log('\nProjects after reload:', filteredAfter.slice(0, 10));
  console.log('KTA visible after reload:', filteredAfter.includes('KTA'));
  
  // Direct API test
  console.log('\n=== Direct API Test ===');
  const apiTest = await page.evaluate(async () => {
    const response = await fetch('/api/crypto-projects-rated?includeUnverified=true&sortBy=website_stage1_score&sortOrder=desc');
    const data = await response.json();
    return {
      total: data.data?.length,
      first5: data.data?.slice(0, 5).map(p => p.symbol),
      hasKTA: data.data?.some(p => p.symbol === 'KTA')
    };
  });
  console.log('Direct API response:', apiTest);
  
  // Check if filters are visually applied
  console.log('\n=== Visual State Check ===');
  const safetyExpanded = await page.locator('text=/safety/i').first().click().then(() => true).catch(() => false);
  if (safetyExpanded) {
    await page.waitForTimeout(500);
    const checkboxDiv = page.locator('span:text("Include Unverified")').locator('..').locator('div').first();
    const classes = await checkboxDiv.getAttribute('class');
    const isChecked = classes?.includes('bg-[#00ff88]');
    console.log('Include Unverified checkbox visually checked:', isChecked);
  }
  
  await page.screenshot({ path: 'debug-final-state.png', fullPage: true });
  
  expect(filteredAfter.includes('KTA')).toBe(true);
});