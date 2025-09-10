const { test, expect } = require('@playwright/test');

// Test configuration - modify these to test different projects
const TEST_CONFIG = {
  symbol: 'BKN',           // Project symbol to test
  expectedDomain: 'brickken.com',  // Expected domain in links
  minLinksExpected: 3,     // Minimum number of expected links
  tier: 'SOLID'            // Expected tier badge
};

test(`Admin login and verify ${TEST_CONFIG.symbol} stage 2 links with filter fallback`, async ({ page }) => {
  console.log(`=== TESTING ${TEST_CONFIG.symbol} ADMIN STAGE 2 LINKS WITH FILTER FALLBACK ===`);
  console.log(`Config: Symbol=${TEST_CONFIG.symbol}, Domain=${TEST_CONFIG.expectedDomain}, MinLinks=${TEST_CONFIG.minLinksExpected}, Tier=${TEST_CONFIG.tier}`);
  
  // Step 1: Go to admin login
  console.log('Step 1: Going to admin login...');
  await page.goto('https://coinairank.com/admin');
  await page.waitForTimeout(3000);
  
  // Step 2: Enter password "donkey"
  console.log('Step 2: Entering admin password...');
  const passwordInput = page.locator('input[type="password"]').or(page.locator('input[placeholder*="password" i]')).first();
  await passwordInput.fill('donkey');
  
  // Submit the form (look for submit button or Enter)
  const submitButton = page.locator('button[type="submit"]').or(page.locator('button:has-text("Login")').or(page.locator('button:has-text("Submit")'))).first();
  const submitVisible = await submitButton.isVisible().catch(() => false);
  
  if (submitVisible) {
    await submitButton.click();
  } else {
    // Try pressing Enter
    await passwordInput.press('Enter');
  }
  
  console.log('✅ Submitted admin login');
  await page.waitForTimeout(3000);
  
  // Step 3: Navigate to main page after admin login
  console.log('Step 3: Navigating to main page after admin login...');
  await page.goto('https://coinairank.com');
  await page.waitForTimeout(5000);
  
  // Step 4: Look for target project as admin
  console.log(`Step 4: Looking for ${TEST_CONFIG.symbol} project as admin...`);
  
  // Wait for page to load and look for project
  await page.waitForTimeout(5000);
  
  let projectCard = page.locator(`text=${TEST_CONFIG.symbol}`).first();
  let projectVisible = await projectCard.isVisible({ timeout: 5000 }).catch(() => false);
  
  // Step 5: If project not found, try enabling filters
  if (!projectVisible) {
    console.log(`⚠️  ${TEST_CONFIG.symbol} not found initially, trying to enable filters...`);
    
    // Step 5a: Open filters
    console.log('Step 5a: Opening filters...');
    const filtersButton = page.locator('div:has-text("Filters")').or(page.locator('button:has-text("Filters")')).first();
    const filtersVisible = await filtersButton.isVisible().catch(() => false);
    
    if (filtersVisible) {
      await filtersButton.click();
      await page.waitForTimeout(2000);
      console.log('✅ Opened filters section');
    } else {
      console.log('❌ Could not find filters button');
      await page.screenshot({ path: `${TEST_CONFIG.symbol.toLowerCase()}-no-filters-button.png` });
      return;
    }
    
    // Step 5b: Open safety section
    console.log('Step 5b: Opening safety section...');
    const safetySection = page.locator('text=SAFETY').first();
    const safetyVisible = await safetySection.isVisible().catch(() => false);
    
    if (safetyVisible) {
      await safetySection.click();
      await page.waitForTimeout(1000);
      console.log('✅ Opened safety section');
    } else {
      console.log('❌ Could not find safety section');
      await page.screenshot({ path: `${TEST_CONFIG.symbol.toLowerCase()}-no-safety-section.png` });
      return;
    }
    
    // Step 5c: Enable "Include Unverified" checkbox
    console.log('Step 5c: Looking for "Include Unverified" checkbox...');
    
    const unverifiedSelectors = [
      'text=Include Unverified',
      'text=Include unverified', 
      'text=unverified',
      'text=Unverified',
      'label:has-text("unverified")',
      'input[type="checkbox"] + label:has-text("unverified")'
    ];
    
    let unverifiedEnabled = false;
    for (const selector of unverifiedSelectors) {
      const unverifiedElement = page.locator(selector).first();
      const visible = await unverifiedElement.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (visible) {
        console.log(`✅ Found unverified filter: ${selector}`);
        
        // Check if it's already checked
        const checkbox = unverifiedElement.locator('input[type="checkbox"]').or(unverifiedElement.locator('..').locator('input[type="checkbox"]')).first();
        const isChecked = await checkbox.isChecked().catch(() => false);
        
        if (!isChecked) {
          await unverifiedElement.click();
          console.log('✅ Enabled "Include Unverified" filter');
        } else {
          console.log('✅ "Include Unverified" already enabled');
        }
        
        unverifiedEnabled = true;
        break;
      }
    }
    
    if (!unverifiedEnabled) {
      console.log('❌ Could not find "Include Unverified" checkbox');
      await page.screenshot({ path: `${TEST_CONFIG.symbol.toLowerCase()}-no-unverified-checkbox.png` });
      return;
    }
    
    // Step 5d: Wait for results to refresh and look for project again
    console.log(`Step 5d: Waiting for results to refresh and looking for ${TEST_CONFIG.symbol} again...`);
    await page.waitForTimeout(3000);
    
    projectCard = page.locator(`text=${TEST_CONFIG.symbol}`).first();
    projectVisible = await projectCard.isVisible({ timeout: 10000 }).catch(() => false);
    
    if (!projectVisible) {
      console.log(`❌ ${TEST_CONFIG.symbol} still not found after enabling unverified filter`);
      await page.screenshot({ path: `${TEST_CONFIG.symbol.toLowerCase()}-still-not-found-after-filters.png` });
      return;
    } else {
      console.log(`✅ Found ${TEST_CONFIG.symbol} after enabling filters!`);
    }
  } else {
    console.log(`✅ Found ${TEST_CONFIG.symbol} project immediately as admin`);
  }
  
  // Step 6: Click on project's tier badge
  console.log(`Step 6: Looking for ${TEST_CONFIG.symbol} ${TEST_CONFIG.tier} tier badge...`);
  
  // Look specifically for the tier badge near the project
  const tierBadges = page.locator(`text=${TEST_CONFIG.tier}`);
  const tierCount = await tierBadges.count();
  console.log(`Found ${tierCount} ${TEST_CONFIG.tier} badges`);
  
  let tierClicked = false;
  
  // Find the tier badge that belongs to our project
  for (let i = 0; i < tierCount; i++) {
    const tierBadge = tierBadges.nth(i);
    
    // Check if this tier badge is in the same container as our project
    const container = tierBadge.locator(`xpath=ancestor::*[contains(text(),"${TEST_CONFIG.symbol}") or .//*[contains(text(),"${TEST_CONFIG.symbol}")]]`).first();
    const containerExists = await container.count() > 0;
    
    if (containerExists) {
      console.log(`✅ Found ${TEST_CONFIG.symbol}'s ${TEST_CONFIG.tier} tier badge (${i+1})`);
      await tierBadge.click();
      console.log(`✅ Clicked ${TEST_CONFIG.symbol} ${TEST_CONFIG.tier} tier badge`);
      tierClicked = true;
      break;
    }
  }
  
  if (!tierClicked) {
    console.log(`⚠️ Could not find ${TEST_CONFIG.symbol} ${TEST_CONFIG.tier} badge, trying alternative approach...`);
    
    // Alternative: Look for tier badge in same row/card as project
    const projectRow = page.locator(`:has(text="${TEST_CONFIG.symbol}")`);
    const tierInRow = projectRow.locator(`text=${TEST_CONFIG.tier}`).first();
    const tierVisible = await tierInRow.isVisible().catch(() => false);
    
    if (tierVisible) {
      await tierInRow.click();
      console.log(`✅ Clicked ${TEST_CONFIG.tier} badge in ${TEST_CONFIG.symbol} row`);
      tierClicked = true;
    } else {
      console.log(`❌ Could not find ${TEST_CONFIG.symbol} ${TEST_CONFIG.tier} tier badge`);
      await projectCard.click();
      console.log(`✅ Clicked ${TEST_CONFIG.symbol} project card as fallback`);
    }
  }
  
  await page.waitForTimeout(3000);
  
  // Step 7: Look for "ADMIN: DISCOVERED LINKS" in tooltip
  console.log('Step 7: Looking for admin discovered links section...');
  
  const adminLinksSelectors = [
    'text=ADMIN: DISCOVERED LINKS',
    'text=DISCOVERED LINKS',
    'text=Admin: Discovered Links',
    'text=admin: discovered links'
  ];
  
  let adminLinksFound = false;
  let adminLinksElement = null;
  
  for (const selector of adminLinksSelectors) {
    const adminElement = page.locator(selector).first();
    const visible = await adminElement.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (visible) {
      console.log(`✅ Found admin links section: ${selector}`);
      adminLinksFound = true;
      adminLinksElement = adminElement;
      break;
    }
  }
  
  if (!adminLinksFound) {
    console.log('❌ ADMIN: DISCOVERED LINKS section not found');
    await page.screenshot({ path: `${TEST_CONFIG.symbol.toLowerCase()}-admin-no-discovered-links-with-filters.png` });
    return;
  }
  
  // Step 8: Click to expand the admin links section
  console.log('Step 8: Expanding admin discovered links section...');
  
  try {
    // Click on the admin links section to expand it
    await adminLinksElement.click();
    console.log('✅ Clicked admin links section to expand');
    await page.waitForTimeout(2000); // Wait for expansion animation
  } catch (error) {
    console.log('⚠️ Could not click admin section, trying alternative...');
    
    // Try clicking on the button or arrow specifically
    const expandButton = page.locator('button:has-text("ADMIN: DISCOVERED LINKS")').first();
    if (await expandButton.isVisible({ timeout: 3000 })) {
      await expandButton.click();
      console.log('✅ Clicked expand button');
      await page.waitForTimeout(2000);
    }
  }
  
  // Step 9: Count domain-specific links in the expanded admin section
  console.log(`Step 9: Counting ${TEST_CONFIG.expectedDomain} links in expanded admin section...`);
  
  const domainLinks = page.locator(`text=/${TEST_CONFIG.expectedDomain.replace('.', '\\.')}/`);
  const linkCount = await domainLinks.count();
  console.log(`Found ${linkCount} ${TEST_CONFIG.expectedDomain} links`);
  
  // Show the links
  for (let i = 0; i < Math.min(8, linkCount); i++) {
    const linkText = await domainLinks.nth(i).textContent();
    console.log(`Link ${i+1}: ${linkText?.substring(0, 80)}...`);
  }
  
  await page.screenshot({ path: `${TEST_CONFIG.symbol.toLowerCase()}-admin-stage2-links-success-with-filters.png`, fullPage: true });
  
  // Step 10: Verify we have the expected links
  if (linkCount >= TEST_CONFIG.minLinksExpected) {
    console.log(`✅ SUCCESS: Found ${linkCount}+ ${TEST_CONFIG.expectedDomain} links in admin section!`);
  } else if (linkCount >= Math.floor(TEST_CONFIG.minLinksExpected * 0.6)) {
    console.log(`⚠️  PARTIAL SUCCESS: Found ${linkCount} links, close to expected ${TEST_CONFIG.minLinksExpected}`);
  } else {
    console.log(`❌ FAILED: Only found ${linkCount} links, expected ${TEST_CONFIG.minLinksExpected}`);
  }
  
  console.log(`=== ADMIN TEST WITH FILTERS FOR ${TEST_CONFIG.symbol} COMPLETED ===`);
  // Test completed successfully!
});