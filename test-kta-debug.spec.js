const { test, expect } = require('@playwright/test');

test('Debug KTA filter structure', async ({ page }) => {
  console.log('\n=== Debugging Page Structure ===\n');
  
  await page.goto('https://coinairank.com', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // Take a screenshot
  await page.screenshot({ path: 'debug-filters.png' });
  
  // First check if there's a filter button to open the sidebar
  console.log('Looking for filter button...');
  const filterButton = await page.locator('button:has-text("Filters")').count();
  console.log(`Found filter button: ${filterButton}`);
  
  if (filterButton > 0) {
    console.log('Clicking filter button to open sidebar...');
    await page.locator('button:has-text("Filters")').first().click();
    await page.waitForTimeout(1000);
  }
  
  // Try different selectors
  console.log('Looking for filter checkboxes...');
  
  // Method 1: Direct text search
  const hasUnverifiedText = await page.locator('text="Include Unverified"').count();
  console.log(`Found "Include Unverified" text: ${hasUnverifiedText} times`);
  
  // Method 2: Look for all checkboxes
  const allCheckboxes = await page.locator('input[type="checkbox"]').count();
  console.log(`Total checkboxes on page: ${allCheckboxes}`);
  
  // Method 3: Get all checkbox labels
  const checkboxLabels = await page.locator('label').evaluateAll(labels => {
    return labels.map(label => {
      const checkbox = label.querySelector('input[type="checkbox"]');
      if (checkbox) {
        return {
          text: label.textContent?.trim(),
          checked: checkbox.checked,
          id: checkbox.id
        };
      }
      return null;
    }).filter(Boolean);
  });
  
  console.log('Checkbox labels found:');
  checkboxLabels.forEach(cb => {
    console.log(`  - "${cb.text}" (checked: ${cb.checked})`);
  });
  
  // Try to check if KTA exists in the data
  console.log('\nChecking for KTA in the API...');
  const apiData = await page.evaluate(async () => {
    try {
      const response = await fetch('/api/crypto-projects-rated');
      const data = await response.json();
      const projects = data.projects || data || [];
      const kta = projects.find(p => p.symbol === 'KTA');
      return {
        found: !!kta,
        details: kta ? {
          symbol: kta.symbol,
          tier: kta.website_stage1_tier,
          score: kta.website_stage1_score,
          is_imposter: kta.is_imposter,
          contract_on_website: kta.contract_verification?.found_on_site
        } : null,
        totalProjects: projects.length,
        responseStructure: data.projects ? 'has projects key' : 'direct array'
      };
    } catch (error) {
      return { error: error.message };
    }
  });
  
  console.log('API Data:');
  console.log(`  Total projects: ${apiData.totalProjects}`);
  console.log(`  KTA found: ${apiData.found}`);
  if (apiData.details) {
    console.log('  KTA details:', JSON.stringify(apiData.details, null, 2));
  }
  
  // Check visible tokens
  const visibleTokens = await page.locator('.grid > a h3').evaluateAll(elements => {
    return elements.slice(0, 10).map(el => el.textContent);
  });
  console.log('\nFirst 10 visible tokens:', visibleTokens);
});