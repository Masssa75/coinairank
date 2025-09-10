const { test, expect } = require('@playwright/test');

test('Admin login and verify BKN stage 2 links with filter fallback', async ({ page }) => {
  console.log('=== TESTING BKN ADMIN STAGE 2 LINKS WITH FILTER FALLBACK ===');
  
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
  
  // Step 4: Look for BKN project as admin
  console.log('Step 4: Looking for BKN project as admin...');
  
  // Wait for page to load and look for BKN
  await page.waitForTimeout(5000);
  
  let bknCard = page.locator('text=BKN').first();
  let bknVisible = await bknCard.isVisible({ timeout: 5000 }).catch(() => false);
  
  // Step 5: If BKN not found, try enabling filters
  if (!bknVisible) {
    console.log('⚠️  BKN not found initially, trying to enable filters...');
    
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
      await page.screenshot({ path: 'bkn-no-filters-button.png' });
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
      await page.screenshot({ path: 'bkn-no-safety-section.png' });
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
      await page.screenshot({ path: 'bkn-no-unverified-checkbox.png' });
      return;
    }
    
    // Step 5d: Wait for results to refresh and look for BKN again
    console.log('Step 5d: Waiting for results to refresh and looking for BKN again...');
    await page.waitForTimeout(3000);
    
    bknCard = page.locator('text=BKN').first();
    bknVisible = await bknCard.isVisible({ timeout: 10000 }).catch(() => false);
    
    if (!bknVisible) {
      console.log('❌ BKN still not found after enabling unverified filter');
      await page.screenshot({ path: 'bkn-still-not-found-after-filters.png' });
      return;
    } else {
      console.log('✅ Found BKN after enabling filters!');
    }
  } else {
    console.log('✅ Found BKN project immediately as admin');
  }
  
  // Step 6: Click on BKN's yellow SOLID tier badge
  console.log('Step 6: Looking for BKN yellow SOLID tier badge...');
  
  // Look specifically for the SOLID tier badge near BKN
  const solidBadges = page.locator('text=SOLID');
  const solidCount = await solidBadges.count();
  console.log(`Found ${solidCount} SOLID badges`);
  
  let tierClicked = false;
  
  // Find the SOLID badge that belongs to BKN
  for (let i = 0; i < solidCount; i++) {
    const solidBadge = solidBadges.nth(i);
    
    // Check if this SOLID badge is in the same container as BKN
    const container = solidBadge.locator('xpath=ancestor::*[contains(text(),"BKN") or .//*[contains(text(),"BKN")]]').first();
    const containerExists = await container.count() > 0;
    
    if (containerExists) {
      console.log(`✅ Found BKN's SOLID tier badge (${i+1})`);
      await solidBadge.click();
      console.log('✅ Clicked BKN SOLID tier badge');
      tierClicked = true;
      break;
    }
  }
  
  if (!tierClicked) {
    console.log('⚠️ Could not find BKN SOLID badge, trying alternative approach...');
    
    // Alternative: Look for SOLID badge in same row/card as BKN
    const bknRow = page.locator(':has(text="BKN")');
    const solidInRow = bknRow.locator('text=SOLID').first();
    const solidVisible = await solidInRow.isVisible().catch(() => false);
    
    if (solidVisible) {
      await solidInRow.click();
      console.log('✅ Clicked SOLID badge in BKN row');
      tierClicked = true;
    } else {
      console.log('❌ Could not find BKN SOLID tier badge');
      await bknCard.click();
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
  for (const selector of adminLinksSelectors) {
    const adminElement = page.locator(selector).first();
    const visible = await adminElement.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (visible) {
      console.log(`✅ Found admin links section: ${selector}`);
      adminLinksFound = true;
      break;
    }
  }
  
  if (!adminLinksFound) {
    console.log('❌ ADMIN: DISCOVERED LINKS section not found');
    await page.screenshot({ path: 'bkn-admin-no-discovered-links-with-filters.png' });
    return;
  }
  
  // Step 8: Count brickken.com links in the admin section
  console.log('Step 8: Counting brickken.com links in admin section...');
  
  const brickkenLinks = page.locator('text=/brickken\\.com/');
  const linkCount = await brickkenLinks.count();
  console.log(`Found ${linkCount} brickken.com links`);
  
  // Show the links
  for (let i = 0; i < Math.min(8, linkCount); i++) {
    const linkText = await brickkenLinks.nth(i).textContent();
    console.log(`Link ${i+1}: ${linkText?.substring(0, 80)}...`);
  }
  
  await page.screenshot({ path: 'bkn-admin-stage2-links-success-with-filters.png', fullPage: true });
  
  // Step 9: Verify we have the expected 8 links
  if (linkCount >= 8) {
    console.log('✅ SUCCESS: Found 8+ brickken.com links in admin section!');
  } else if (linkCount >= 6) {
    console.log('⚠️  PARTIAL SUCCESS: Found 6+ links, close to expected 8');
  } else {
    console.log(`❌ FAILED: Only found ${linkCount} links, expected 8`);
  }
  
  console.log('=== ADMIN TEST WITH FILTERS COMPLETED ===');
  await page.waitForTimeout(15000); // Keep open for verification
});