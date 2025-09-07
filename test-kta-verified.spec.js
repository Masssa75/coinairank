const { test, expect } = require('@playwright/test');

test('KTA shows with Include Unverified filter after refresh', async ({ page }) => {
  console.log('Starting filter persistence test...\n');
  
  // Navigate to the site
  await page.goto('https://coinairank.com');
  await page.waitForTimeout(3000);
  
  // The sidebar is open by default, let's expand the SAFETY section
  console.log('Step 1: Expanding SAFETY section...');
  const safetySection = page.locator('text="SAFETY"');
  await safetySection.click();
  await page.waitForTimeout(500);
  
  // Look for and click the Include Unverified checkbox
  console.log('Step 2: Looking for Include Unverified checkbox...');
  
  // The checkbox should be in the expanded SAFETY section
  // Try clicking the label or the checkbox directly
  const includeUnverifiedLabel = page.locator('label:has-text("Include Unverified")');
  const includeUnverifiedCheckbox = page.locator('text="Include Unverified"').locator('..').locator('input[type="checkbox"]');
  
  // Try to click the label first
  let clicked = false;
  try {
    await includeUnverifiedLabel.click({ timeout: 3000 });
    clicked = true;
    console.log('✓ Clicked Include Unverified label');
  } catch {
    // If label click fails, try the checkbox directly
    try {
      await includeUnverifiedCheckbox.check({ timeout: 3000 });
      clicked = true;
      console.log('✓ Checked Include Unverified checkbox directly');
    } catch {
      // Last resort: find checkbox by position (usually 2nd or 3rd checkbox)
      const allCheckboxes = await page.locator('input[type="checkbox"]').all();
      console.log(`Found ${allCheckboxes.length} checkboxes total`);
      
      // Check each checkbox's associated text
      for (let i = 0; i < allCheckboxes.length; i++) {
        const parent = page.locator('input[type="checkbox"]').nth(i).locator('..');
        const text = await parent.textContent().catch(() => '');
        console.log(`  Checkbox ${i}: "${text?.trim()}"`);
        
        if (text && text.includes('Unverified')) {
          await allCheckboxes[i].check();
          clicked = true;
          console.log(`✓ Checked checkbox ${i} for Include Unverified`);
          break;
        }
      }
    }
  }
  
  if (!clicked) {
    throw new Error('Could not find or click Include Unverified checkbox');
  }
  
  // Wait for the page to reload with new data
  console.log('\nStep 3: Waiting for data to reload...');
  await page.waitForTimeout(4000);
  
  // Check if KTA appears
  console.log('Step 4: Looking for KTA token...');
  let ktaFound = await page.locator('text="KTA"').isVisible().catch(() => false);
  
  if (!ktaFound) {
    // Try alternative selectors
    ktaFound = await page.locator('h3:has-text("KTA")').isVisible().catch(() => false) ||
               await page.locator('a:has-text("KTA")').isVisible().catch(() => false);
  }
  
  if (ktaFound) {
    console.log('✓ KTA found after enabling Include Unverified');
  } else {
    console.log('✗ KTA not found');
    // Take screenshot for debugging
    await page.screenshot({ path: 'kta-not-found.png', fullPage: true });
    
    // Log visible projects
    const projects = await page.locator('h3').allTextContents();
    console.log('Visible projects:', projects.slice(0, 10));
  }
  
  expect(ktaFound).toBe(true);
  
  // Now reload the page to test persistence
  console.log('\nStep 5: Reloading page to test filter persistence...');
  await page.reload();
  await page.waitForTimeout(5000); // Give time for localStorage to load
  
  // Check if KTA is still visible
  console.log('Step 6: Checking if KTA persists after reload...');
  let ktaFoundAfterReload = await page.locator('text="KTA"').isVisible().catch(() => false);
  
  if (!ktaFoundAfterReload) {
    ktaFoundAfterReload = await page.locator('h3:has-text("KTA")').isVisible().catch(() => false) ||
                          await page.locator('a:has-text("KTA")').isVisible().catch(() => false);
  }
  
  // Take final screenshot
  await page.screenshot({ path: 'final-state.png', fullPage: true });
  
  // Check localStorage
  const savedFilters = await page.evaluate(() => localStorage.getItem('carProjectsFilters'));
  console.log('\nSaved filters:', savedFilters);
  
  if (ktaFoundAfterReload) {
    console.log('✓ SUCCESS: KTA still visible after reload - filter persistence is working!');
  } else {
    console.log('✗ FAILURE: KTA not visible after reload');
    
    // Log visible projects after reload
    const projectsAfterReload = await page.locator('h3').allTextContents();
    console.log('Visible projects after reload:', projectsAfterReload.slice(0, 10));
  }
  
  expect(ktaFoundAfterReload).toBe(true);
});