const { test, expect } = require('@playwright/test');

test('Enable unverified filter and verify BKN stage 2 links', async ({ page }) => {
  console.log('=== ENABLING UNVERIFIED FILTER FOR BKN ===');
  
  // Go to site
  await page.goto('https://coinairank.com');
  await page.waitForTimeout(5000);
  
  // Step 1: Find and expand the filters section
  console.log('Step 1: Looking for filters section...');
  
  const filterSelectors = [
    'button:has-text("Filters")',
    'button:has-text("Filter")', 
    'div:has-text("Filters")',
    '.filters',
    '[data-testid*="filter"]',
    'text=filter'
  ];
  
  let filtersExpanded = false;
  for (const selector of filterSelectors) {
    const filterElement = page.locator(selector).first();
    const visible = await filterElement.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (visible) {
      console.log(`✅ Found filter element: ${selector}`);
      await filterElement.click();
      await page.waitForTimeout(2000);
      filtersExpanded = true;
      break;
    }
  }
  
  if (!filtersExpanded) {
    console.log('❌ Could not find filters section');
    await page.screenshot({ path: 'no-filters-section.png' });
    return;
  }
  
  // Step 2: Look for "unverified" checkbox/toggle
  console.log('Step 2: Looking for unverified filter...');
  
  const unverifiedSelectors = [
    'text=unverified',
    'text=Unverified',
    'text=Include unverified',
    'text=Show unverified',
    '[data-testid*="unverified"]',
    'input[type="checkbox"] + label:has-text("unverified")',
    'label:has-text("unverified")'
  ];
  
  let unverifiedFound = false;
  for (const selector of unverifiedSelectors) {
    const unverifiedElement = page.locator(selector).first();
    const visible = await unverifiedElement.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (visible) {
      console.log(`✅ Found unverified filter: ${selector}`);
      
      // Try to click it (might be label or checkbox)
      try {
        await unverifiedElement.click();
        console.log('✅ Clicked unverified filter');
        await page.waitForTimeout(2000);
        unverifiedFound = true;
        break;
      } catch (e) {
        console.log('⚠️ Could not click unverified element, trying parent...');
        
        // Try clicking parent element
        const parent = unverifiedElement.locator('..').first();
        await parent.click();
        console.log('✅ Clicked unverified filter parent');
        await page.waitForTimeout(2000);
        unverifiedFound = true;
        break;
      }
    }
  }
  
  if (!unverifiedFound) {
    console.log('❌ Could not find unverified filter option');
    
    // Debug: Look for all checkboxes
    const allCheckboxes = page.locator('input[type="checkbox"]');
    const checkboxCount = await allCheckboxes.count();
    console.log(`Debug: Found ${checkboxCount} checkboxes total`);
    
    // Try enabling all checkboxes as fallback
    for (let i = 0; i < checkboxCount; i++) {
      const checkbox = allCheckboxes.nth(i);
      const isChecked = await checkbox.isChecked().catch(() => false);
      if (!isChecked) {
        await checkbox.click();
        console.log(`✅ Enabled checkbox ${i+1}`);
        await page.waitForTimeout(500);
      }
    }
    
    await page.screenshot({ path: 'all-filters-enabled.png' });
  }
  
  // Step 3: Wait for results to refresh and search for BKN
  console.log('Step 3: Searching for BKN after enabling filters...');
  await page.waitForTimeout(3000);
  
  // Try searching for BKN
  const searchInput = page.locator('input[placeholder*="search" i], input[type="text"]').first();
  const searchVisible = await searchInput.isVisible({ timeout: 5000 }).catch(() => false);
  
  if (searchVisible) {
    await searchInput.clear();
    await searchInput.fill('BKN');
    await page.waitForTimeout(3000);
    console.log('✅ Searched for BKN');
  }
  
  // Step 4: Look for BKN in results
  console.log('Step 4: Looking for BKN in results...');
  
  const bknSelectors = [
    'text=BKN',
    'text=Brickken',
    'text=brickken'
  ];
  
  let bknFound = false;
  for (const selector of bknSelectors) {
    const bknElements = page.locator(selector);
    const count = await bknElements.count();
    
    if (count > 0) {
      console.log(`✅ Found ${count} BKN elements with selector: ${selector}`);
      
      // Click on first BKN element
      await bknElements.first().click();
      console.log('✅ Clicked on BKN project');
      await page.waitForTimeout(3000);
      bknFound = true;
      break;
    }
  }
  
  if (!bknFound) {
    console.log('❌ Still no BKN found after enabling unverified filter');
    
    // Debug: Show all visible project symbols
    const projectElements = page.locator('[data-testid*="symbol"], .symbol');
    const projectCount = await projectElements.count();
    console.log(`Debug: Found ${projectCount} potential project symbols`);
    
    for (let i = 0; i < Math.min(10, projectCount); i++) {
      const symbol = await projectElements.nth(i).textContent();
      console.log(`Project ${i+1}: ${symbol}`);
    }
    
    await page.screenshot({ path: 'bkn-still-not-found.png' });
    return;
  }
  
  // Step 5: Look for admin section with stage 2 links
  console.log('Step 5: Looking for admin links section...');
  
  const adminLinksSections = [
    'text=ADMIN: DISCOVERED LINKS',
    'text=DISCOVERED LINKS',
    'text=SELECTED FOR STAGE 2',
    'text=stage 2',
    'text=Stage 2'
  ];
  
  let adminFound = false;
  for (const selector of adminLinksSections) {
    const adminElement = page.locator(selector).first();
    const visible = await adminElement.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (visible) {
      console.log(`✅ Found admin section: ${selector}`);
      
      // Try to click/expand if it's clickable
      try {
        await adminElement.click();
        await page.waitForTimeout(2000);
        console.log('✅ Clicked admin section to expand');
      } catch (e) {
        console.log('Note: Admin section not clickable');
      }
      
      adminFound = true;
      break;
    }
  }
  
  if (!adminFound) {
    console.log('❌ Admin links section not found');
    await page.screenshot({ path: 'no-admin-after-bkn-click.png' });
    return;
  }
  
  // Step 6: Count brickken.com links
  console.log('Step 6: Counting brickken.com links...');
  
  const brickkenLinks = page.locator('text=/brickken\\.com/');
  const linkCount = await brickkenLinks.count();
  console.log(`Found ${linkCount} brickken.com links in admin section`);
  
  // Show first few links
  for (let i = 0; i < Math.min(5, linkCount); i++) {
    const linkText = await brickkenLinks.nth(i).textContent();
    console.log(`Link ${i+1}: ${linkText?.substring(0, 80)}...`);
  }
  
  await page.screenshot({ path: 'stage2-links-final-verification.png', fullPage: true });
  
  // Verify we have the expected 8 links
  if (linkCount >= 8) {
    console.log('✅ SUCCESS: Found 8+ brickken.com links as expected!');
  } else if (linkCount >= 6) {
    console.log('⚠️  PARTIAL SUCCESS: Found 6+ links, close to expected 8');
  } else {
    console.log(`❌ FAILED: Only found ${linkCount} links, expected 8`);
  }
  
  console.log('=== TEST COMPLETED ===');
  await page.waitForTimeout(15000); // Keep open for manual verification
});