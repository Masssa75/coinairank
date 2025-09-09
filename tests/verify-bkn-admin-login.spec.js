const { test, expect } = require('@playwright/test');

test('Verify BKN stage 2 links with admin login', async ({ page }) => {
  console.log('=== TESTING BKN STAGE 2 LINKS WITH ADMIN LOGIN ===');
  
  // Go to site
  await page.goto('https://coinairank.com');
  await page.waitForTimeout(5000);
  
  // Login as admin first
  console.log('Looking for admin login...');
  
  // Look for login elements in various forms
  const loginSelectors = [
    'input[type="password"]',
    'button:has-text("Login")',
    'form input[type="password"]',
    '[placeholder*="password" i]',
    '.login input[type="password"]'
  ];
  
  let loginFound = false;
  for (const selector of loginSelectors) {
    const element = page.locator(selector).first();
    const visible = await element.isVisible({ timeout: 2000 }).catch(() => false);
    if (visible) {
      console.log(`✅ Found login element: ${selector}`);
      
      if (selector.includes('password')) {
        await element.fill('donkey');
        console.log('✅ Filled password');
        
        // Look for submit button near password field
        const submitButton = page.locator('button[type="submit"], input[type="submit"], button:has-text("Login")').first();
        const submitVisible = await submitButton.isVisible({ timeout: 2000 }).catch(() => false);
        if (submitVisible) {
          await submitButton.click();
          console.log('✅ Clicked login button');
          await page.waitForTimeout(3000);
          loginFound = true;
          break;
        }
      }
    }
  }
  
  if (!loginFound) {
    console.log('❌ Could not find admin login, continuing without admin privileges...');
  }
  
  // Enable all filters
  const filtersButton = page.locator('button, div').filter({ hasText: /filter/i }).first();
  const filtersVisible = await filtersButton.isVisible({ timeout: 5000 }).catch(() => false);
  
  if (filtersVisible) {
    console.log('✅ Opening filters...');
    await filtersButton.click();
    await page.waitForTimeout(2000);
    
    // Check all filter checkboxes
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    console.log(`Found ${count} filter checkboxes`);
    
    for (let i = 0; i < count; i++) {
      const checkbox = checkboxes.nth(i);
      const isChecked = await checkbox.isChecked().catch(() => false);
      if (!isChecked) {
        await checkbox.click();
        console.log(`✅ Enabled filter ${i+1}`);
        await page.waitForTimeout(500);
      }
    }
    await page.waitForTimeout(3000);
  }
  
  // Search for BKN
  console.log('Searching for BKN...');
  const searchInput = page.locator('input[placeholder*="search" i], input[type="text"]').first();
  const searchVisible = await searchInput.isVisible({ timeout: 5000 }).catch(() => false);
  
  if (searchVisible) {
    await searchInput.fill('BKN');
    await page.waitForTimeout(3000);
    console.log('✅ Searched for BKN');
  }
  
  // Look for BKN in results
  const bknElements = page.locator('text=BKN, text=Brickken');
  const bknCount = await bknElements.count();
  console.log(`Found ${bknCount} BKN/Brickken elements after search`);
  
  if (bknCount > 0) {
    console.log('✅ Found BKN, clicking...');
    await bknElements.first().click();
    await page.waitForTimeout(3000);
  } else {
    // Try clicking on any SOLID badge
    const solidBadge = page.locator('text=SOLID').first();
    const solidVisible = await solidBadge.isVisible().catch(() => false);
    if (solidVisible) {
      console.log('✅ Clicking SOLID badge as fallback...');
      await solidBadge.click();
      await page.waitForTimeout(3000);
    }
  }
  
  // Now look for admin links section
  console.log('Looking for admin section...');
  
  const adminSelectors = [
    'text=ADMIN: DISCOVERED LINKS',
    'text=DISCOVERED LINKS',
    'text=admin',
    '[class*="admin"]',
    'text=SELECTED FOR STAGE 2'
  ];
  
  let adminSectionFound = false;
  for (const selector of adminSelectors) {
    const element = page.locator(selector).first();
    const visible = await element.isVisible({ timeout: 3000 }).catch(() => false);
    if (visible) {
      console.log(`✅ Found admin section: ${selector}`);
      
      // If it's clickable, click it
      try {
        await element.click();
        await page.waitForTimeout(2000);
        console.log('✅ Clicked admin section');
      } catch (e) {
        console.log('Note: Admin section not clickable');
      }
      
      adminSectionFound = true;
      break;
    }
  }
  
  if (!adminSectionFound) {
    console.log('❌ No admin section found');
    await page.screenshot({ path: 'no-admin-section.png', fullPage: true });
    
    // Debug: Look for any text containing "stage" or "links"
    const debugElements = page.locator('text=/stage|links/i');
    const debugCount = await debugElements.count();
    console.log(`Debug: Found ${debugCount} elements containing "stage" or "links"`);
    
    for (let i = 0; i < Math.min(5, debugCount); i++) {
      const text = await debugElements.nth(i).textContent();
      console.log(`Debug element ${i+1}: ${text?.substring(0, 50)}...`);
    }
  } else {
    // Look for brickken links in the admin section
    const brickkenLinks = page.locator('text=/brickken\\.com/');
    const linkCount = await brickkenLinks.count();
    console.log(`Found ${linkCount} brickken.com links in admin section`);
    
    // Show first few links
    for (let i = 0; i < Math.min(5, linkCount); i++) {
      const linkText = await brickkenLinks.nth(i).textContent();
      console.log(`Link ${i+1}: ${linkText?.substring(0, 60)}...`);
    }
    
    await page.screenshot({ path: 'admin-section-found.png', fullPage: true });
    
    if (linkCount >= 8) {
      console.log('✅ SUCCESS: Found 8+ brickken.com links!');
    } else if (linkCount >= 6) {
      console.log('⚠️  PARTIAL: Found 6+ links');
    } else {
      console.log(`❌ ISSUE: Only ${linkCount} links found`);
    }
  }
  
  await page.waitForTimeout(15000); // Keep browser open for manual inspection
});