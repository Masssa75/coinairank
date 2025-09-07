const { test, expect } = require('@playwright/test');

test('KTA shows with Include Unverified and Base network', async ({ page }) => {
  console.log('Starting KTA test with Base network check...\n');
  
  // Navigate to the site
  await page.goto('https://coinairank.com');
  await page.waitForTimeout(3000);
  
  // Step 1: Expand NETWORKS section and ensure Base is selected
  console.log('Step 1: Checking Networks section...');
  await page.locator('text=/networks/i').first().click();
  await page.waitForTimeout(500);
  
  // Look for Base network checkbox
  const baseNetworkLabel = page.locator('span:text("Base")').locator('..');
  const baseCheckbox = baseNetworkLabel.locator('div').first();
  
  // Check if Base is already selected (green background)
  const baseClasses = await baseCheckbox.getAttribute('class');
  const baseSelected = baseClasses?.includes('bg-[#00ff88]');
  console.log(`Base network currently selected: ${baseSelected}`);
  
  if (!baseSelected) {
    console.log('Selecting Base network...');
    await baseCheckbox.click();
    await page.waitForTimeout(1000);
  }
  
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
  
  console.log('Projects visible:', actualProjects);
  
  const ktaFound = actualProjects.includes('KTA');
  
  if (ktaFound) {
    console.log('✓ KTA found!');
  } else {
    console.log('✗ KTA not found');
    
    // Debug: Direct API call
    console.log('\nDebug: Checking via direct API...');
    const apiResponse = await page.evaluate(async () => {
      const response = await fetch('/api/crypto-projects-rated?includeUnverified=true&includeImposters=false&networks=ethereum,solana,bsc,base,pulsechain');
      const data = await response.json();
      const kta = data.data?.find(p => p.symbol === 'KTA');
      return {
        totalProjects: data.data?.length,
        ktaFound: !!kta,
        ktaDetails: kta ? { symbol: kta.symbol, network: kta.network, verified: kta.contract_verification?.found_on_site } : null
      };
    });
    console.log('API Response:', apiResponse);
  }
  
  await page.screenshot({ path: 'kta-with-base.png', fullPage: true });
  
  expect(ktaFound).toBe(true);
  
  // Step 6: Reload and check persistence
  console.log('\nStep 6: Reloading page...');
  await page.reload();
  await page.waitForTimeout(5000);
  
  // Check if KTA persists
  console.log('Step 7: Checking persistence...');
  const projectsAfterReload = await page.locator('h3').allTextContents();
  const actualProjectsAfterReload = projectsAfterReload.filter(name => 
    !['Token Type', 'Safety', 'Networks', 'Website Score', 'Analysis Status'].includes(name)
  );
  
  const ktaAfterReload = actualProjectsAfterReload.includes('KTA');
  
  console.log('Projects after reload:', actualProjectsAfterReload);
  
  if (ktaAfterReload) {
    console.log('\n✅ SUCCESS: KTA persists after reload!');
  } else {
    console.log('\n❌ FAILURE: KTA does not persist');
  }
  
  expect(ktaAfterReload).toBe(true);
});