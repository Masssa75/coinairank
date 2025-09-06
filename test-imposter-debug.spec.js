const { test, expect } = require('@playwright/test');

test('Debug imposter display', async ({ page }) => {
  // Go to the site
  await page.goto('https://coinairank.com');
  
  // Wait for projects to load
  await page.waitForSelector('.text-xl', { timeout: 10000 });
  
  // Get all project names
  const projectNames = await page.locator('.text-xl.font-bold').allTextContents();
  console.log('Found projects:', projectNames);
  
  // Check for any red text (text-red-500)
  const redProjects = await page.locator('.text-red-500').allTextContents();
  console.log('Red projects:', redProjects);
  
  // Find specific projects and check their classes
  for (const name of ['Lifestyle', 'KTA', 'Ghibli']) {
    const element = await page.locator(`.text-xl:has-text("${name}")`).first();
    if (await element.count() > 0) {
      const classes = await element.getAttribute('class');
      console.log(`${name} classes:`, classes);
      
      // Check if it has red color
      const hasRed = classes?.includes('text-red-500');
      console.log(`${name} is red:`, hasRed);
    }
  }
  
  // Also check the API directly
  console.log('\nChecking API data:');
  const apiData = await page.evaluate(async () => {
    const res = await fetch('/api/crypto-projects-rated?limit=10');
    const data = await res.json();
    return data.data?.map(p => ({
      symbol: p.symbol,
      is_imposter: p.is_imposter,
      is_imposter_type: typeof p.is_imposter,
      contract_verification: p.contract_verification
    }));
  });
  
  console.log('API Response:');
  apiData?.forEach(p => {
    console.log(`- ${p.symbol}: is_imposter=${p.is_imposter} (type: ${p.is_imposter_type})`);
  });
});