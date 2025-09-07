const { test } = require('@playwright/test');

test('Debug select options', async ({ page }) => {
  await page.goto('https://coinairank.com', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // Open sidebar
  const expandButton = page.locator('button[title="Expand Filters"]').or(page.locator('button').nth(0));
  if (await expandButton.isVisible()) {
    await expandButton.click();
    await page.waitForTimeout(1000);
  }
  
  // Get select options
  const options = await page.locator('select option').evaluateAll(opts => 
    opts.map(o => ({ value: o.value, text: o.textContent }))
  );
  
  console.log('Select options found:');
  options.forEach(opt => {
    console.log(`  value="${opt.value}" text="${opt.text}"`);
  });
  
  // Try to select AI Score
  const sortDropdown = page.locator('select');
  const currentValue = await sortDropdown.inputValue();
  console.log(`\nCurrent select value: "${currentValue}"`);
  
  // Try different ways to select AI Score
  console.log('\nTrying to select AI Score...');
  
  // Method 1: By value
  try {
    await sortDropdown.selectOption({ value: 'website_stage1_score' });
    console.log('Selected by value: website_stage1_score');
  } catch (e) {
    console.log('Failed with value: website_stage1_score');
  }
  
  // Method 2: By label
  try {
    await sortDropdown.selectOption({ label: 'AI Score' });
    console.log('Selected by label: AI Score');
  } catch (e) {
    console.log('Failed with label: AI Score');
  }
});