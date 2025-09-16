const { test, expect } = require('@playwright/test');

test('Verify TAO shows Critical Resources in tooltip', async ({ page }) => {
  console.log('=== TESTING TAO CRITICAL RESOURCES ===');

  // Step 1: Admin login
  console.log('Step 1: Admin login...');
  await page.goto('https://coinairank.com/admin');
  await page.waitForTimeout(2000);

  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.fill('donkey');
  await passwordInput.press('Enter');
  console.log('✅ Submitted admin login');

  // Step 2: Navigate to main page
  console.log('Step 2: Navigate to main page...');
  await page.waitForTimeout(3000);
  await page.goto('https://coinairank.com');
  await page.waitForTimeout(3000);

  // Step 3: Find TAO
  console.log('Step 3: Looking for TAO...');
  const taoProject = page.locator('a:has-text("TAO")').first();
  const taoVisible = await taoProject.isVisible();

  if (!taoVisible) {
    console.log('TAO not immediately visible, trying with filters...');

    // Try Include Unverified filter
    const unverifiedCheckbox = page.locator('label:has-text("Include Unverified")').locator('input[type="checkbox"]');
    const isUnverifiedVisible = await unverifiedCheckbox.isVisible().catch(() => false);

    if (isUnverifiedVisible) {
      await unverifiedCheckbox.check();
      console.log('✅ Checked Include Unverified filter');
      await page.waitForTimeout(2000);
    }
  }

  // Step 4: Click TAO tier badge to open tooltip
  console.log('Step 4: Click TAO tier badge...');
  const taoBadge = page.locator('span:has-text("SOLID")').first();
  await taoBadge.hover();
  await page.waitForTimeout(500);
  await taoBadge.click();
  console.log('✅ Clicked TAO badge');
  await page.waitForTimeout(2000);

  // Step 5: Look for Critical Resources section
  console.log('Step 5: Looking for Critical Resources section...');
  const criticalResourcesButton = page.locator('button:has-text("CRITICAL RESOURCES")').first();
  const resourcesVisible = await criticalResourcesButton.isVisible().catch(() => false);

  if (resourcesVisible) {
    console.log('✅ Found Critical Resources section!');

    // Click to expand
    await criticalResourcesButton.click();
    console.log('✅ Expanded Critical Resources');
    await page.waitForTimeout(1000);

    // Check for specific resources
    const whitepaperText = await page.locator('text=/.*Whitepaper.*/').isVisible().catch(() => false);
    const githubText = await page.locator('text=/.*GitHub.*/').isVisible().catch(() => false);
    const docsText = await page.locator('text=/.*Docs.*/').isVisible().catch(() => false);

    console.log(`Resources found:`);
    console.log(`  - Whitepaper: ${whitepaperText ? '✅' : '❌'}`);
    console.log(`  - GitHub: ${githubText ? '✅' : '❌'}`);
    console.log(`  - Docs: ${docsText ? '✅' : '❌'}`);

    // Try to get actual URLs
    const pageContent = await page.content();
    if (pageContent.includes('bittensor.com')) {
      console.log('✅ Found bittensor.com URLs');
    }
    if (pageContent.includes('github.com/opentensor')) {
      console.log('✅ Found GitHub URL');
    }
    if (pageContent.includes('docs.learnbittensor')) {
      console.log('✅ Found docs URL');
    }

  } else {
    console.log('❌ Critical Resources section NOT found');

    // Check if old Discovered Links section exists
    const discoveredLinks = await page.locator('button:has-text("ADMIN: DISCOVERED LINKS")').isVisible().catch(() => false);
    if (discoveredLinks) {
      console.log('⚠️ Old "Discovered Links" section still exists');
    }
  }

  // Take screenshot for debugging
  await page.screenshot({ path: 'tests/tao-tooltip-debug.png', fullPage: false });
  console.log('📸 Screenshot saved to tests/tao-tooltip-debug.png');

  console.log('=== TEST COMPLETED ===');

  // Verify Critical Resources exists
  expect(resourcesVisible).toBe(true);
});