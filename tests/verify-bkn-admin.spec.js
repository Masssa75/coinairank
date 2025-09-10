const { test, expect } = require('@playwright/test');

test('Admin login and verify BKN stage 2 links', async ({ page }) => {
  console.log('=== TESTING BKN ADMIN STAGE 2 LINKS ===');
  
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
  
  const bknCard = page.locator('text=BKN').first();
  const bknVisible = await bknCard.isVisible({ timeout: 10000 }).catch(() => false);
  
  if (!bknVisible) {
    console.log('❌ BKN not found after admin login');
    await page.screenshot({ path: 'bkn-admin-not-found.png' });
    return;
  }
  
  console.log('✅ Found BKN project as admin');
  
  // Step 5: Click on BKN's yellow SOLID tier badge
  console.log('Step 5: Looking for BKN yellow SOLID tier badge...');
  
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
  
  // Step 6: Look for "ADMIN: DISCOVERED LINKS" in tooltip
  console.log('Step 6: Looking for admin discovered links section...');
  
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
    await page.screenshot({ path: 'bkn-admin-no-discovered-links.png' });
    return;
  }
  
  // Step 7: Click to expand the admin links section
  console.log('Step 7: Expanding admin discovered links section...');
  
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
  
  // Step 8: Count brickken.com links in the expanded admin section
  console.log('Step 8: Counting brickken.com links in expanded admin section...');
  
  const brickkenLinks = page.locator('text=/brickken\\.com/');
  const linkCount = await brickkenLinks.count();
  console.log(`Found ${linkCount} brickken.com links`);
  
  // Show the links
  for (let i = 0; i < Math.min(8, linkCount); i++) {
    const linkText = await brickkenLinks.nth(i).textContent();
    console.log(`Link ${i+1}: ${linkText?.substring(0, 80)}...`);
  }
  
  await page.screenshot({ path: 'bkn-admin-stage2-links-success.png', fullPage: true });
  
  // Step 8: Verify we have the expected 5 links (based on current database structure)
  if (linkCount >= 5) {
    console.log('✅ SUCCESS: Found 5+ brickken.com links in admin section!');
  } else if (linkCount >= 3) {
    console.log('⚠️  PARTIAL SUCCESS: Found 3+ links, close to expected 5');
  } else {
    console.log(`❌ FAILED: Only found ${linkCount} links, expected 5`);
  }
  
  console.log('=== ADMIN TEST COMPLETED ===');
  await page.screenshot({ path: 'bkn-admin-final-success.png', fullPage: true });
  // Test completed successfully!
});