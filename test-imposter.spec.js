const { test, expect } = require('@playwright/test');

test('Check imposter display issue', async ({ page }) => {
  // Go to the site
  await page.goto('https://coinairank.com');
  
  // Wait for projects to load
  await page.waitForSelector('h3', { timeout: 10000 });
  
  // Find Lifestyle project
  const lifestyleCard = await page.locator('h3:has-text("Lifestyle")').first();
  
  if (await lifestyleCard.count() > 0) {
    // Check the color of the text
    const color = await lifestyleCard.evaluate(el => {
      return window.getComputedStyle(el).color;
    });
    console.log('Lifestyle text color:', color);
    
    // Check if there's a tooltip icon
    const tooltipIcon = await lifestyleCard.locator('svg').first();
    if (await tooltipIcon.count() > 0) {
      // Hover to see tooltip
      await tooltipIcon.hover();
      await page.waitForTimeout(500);
      
      // Check for tooltip text
      const tooltipText = await page.locator('text=/Verified Imposter|Warning: Possible Imposter/').first();
      if (await tooltipText.count() > 0) {
        const text = await tooltipText.textContent();
        console.log('Tooltip shows:', text);
      }
    }
    
    // Get the actual data by intercepting API response
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/crypto-projects-rated?search=Lifestyle');
      const data = await res.json();
      return data.data?.[0];
    });
    
    console.log('Lifestyle data from API:');
    console.log('- is_imposter:', response?.is_imposter);
    console.log('- is_imposter type:', typeof response?.is_imposter);
    console.log('- contract_verification:', response?.contract_verification);
  } else {
    console.log('Lifestyle project not found on page');
  }
});