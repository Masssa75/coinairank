import { test, expect } from '@playwright/test';

test.describe('Exact Filter Sequence Bug', () => {
  test('Reproduce KTA visibility bug with exact sequence', async ({ page }) => {
    console.log('=== Starting exact sequence test ===');
    
    // Clear localStorage to start fresh
    await page.goto('https://coinairank.com');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(2000);
    
    // Search for KTA
    console.log('1. Searching for KTA...');
    const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();
    await searchInput.fill('KTA');
    await page.waitForTimeout(2000);
    
    // Check initial state - KTA should NOT be visible (it's unverified)
    let ktaVisible = await page.locator('h3:has-text("KTA")').first().isVisible().catch(() => false);
    console.log(`2. Initial state - KTA visible: ${ktaVisible} (should be false since it's unverified)`);
    
    // Open filter sidebar
    const expandButton = page.locator('button[title="Expand Filters"]');
    if (await expandButton.isVisible()) {
      await expandButton.click();
      await page.waitForTimeout(500);
    }
    
    // Open Safety section
    const safetySection = page.locator('h3:has-text("Safety")').first();
    await safetySection.click();
    await page.waitForTimeout(500);
    
    // Check current state of checkboxes
    const unverifiedCheckbox = page.locator('span:has-text("Include Unverified")').locator('..').locator('div').first();
    const impostersCheckbox = page.locator('span:has-text("Include Imposters")').locator('..').locator('div').first();
    
    const unverifiedChecked = await unverifiedCheckbox.evaluate(el => {
      return window.getComputedStyle(el).backgroundColor.includes('rgb(0, 255, 136)');
    });
    const impostersChecked = await impostersCheckbox.evaluate(el => {
      return window.getComputedStyle(el).backgroundColor.includes('rgb(0, 255, 136)');
    });
    
    console.log(`3. Initial checkbox states:`);
    console.log(`   - Include Unverified: ${unverifiedChecked ? 'CHECKED' : 'UNCHECKED'}`);
    console.log(`   - Include Imposters: ${impostersChecked ? 'CHECKED' : 'UNCHECKED'}`);
    
    // Your exact sequence:
    // Step 1: Check "Include Unverified" if not already checked
    if (!unverifiedChecked) {
      console.log('4. Checking "Include Unverified"...');
      await unverifiedCheckbox.click();
      await page.waitForTimeout(2000);
    }
    
    ktaVisible = await page.locator('h3:has-text("KTA")').first().isVisible().catch(() => false);
    console.log(`5. After checking Include Unverified - KTA visible: ${ktaVisible} (should be TRUE)`);
    
    // Step 2: Check "Include Imposters"
    console.log('6. Checking "Include Imposters"...');
    await impostersCheckbox.click();
    await page.waitForTimeout(2000);
    
    ktaVisible = await page.locator('h3:has-text("KTA")').first().isVisible().catch(() => false);
    console.log(`7. After checking Include Imposters - KTA visible: ${ktaVisible}`);
    
    // Step 3: Uncheck "Include Imposters"
    console.log('8. Unchecking "Include Imposters"...');
    await impostersCheckbox.click();
    await page.waitForTimeout(2000);
    
    ktaVisible = await page.locator('h3:has-text("KTA")').first().isVisible().catch(() => false);
    console.log(`9. After unchecking Include Imposters - KTA visible: ${ktaVisible} (ISSUE: still shows!)`);
    
    // Step 4: Refresh the page
    console.log('10. Refreshing page...');
    await page.reload();
    await page.waitForTimeout(2000);
    
    // Search for KTA again
    const searchInputAfter = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();
    await searchInputAfter.fill('KTA');
    await page.waitForTimeout(2000);
    
    ktaVisible = await page.locator('h3:has-text("KTA")').first().isVisible().catch(() => false);
    console.log(`11. After refresh - KTA visible: ${ktaVisible} (ISSUE: doesn't show!)`);
    
    // Check localStorage to see what's saved
    const savedFilters = await page.evaluate(() => {
      return localStorage.getItem('carProjectsFilters');
    });
    console.log('\n12. Saved filters in localStorage:', savedFilters);
    
    // Log API calls to understand what's happening
    const apiCalls: string[] = [];
    page.on('request', request => {
      if (request.url().includes('/api/crypto-projects-rated')) {
        const url = new URL(request.url());
        console.log('API Call params:', Object.fromEntries(url.searchParams));
      }
    });
  });
  
  test('Check filter state management', async ({ page }) => {
    // Monitor all API calls
    const apiCalls: string[] = [];
    page.on('request', request => {
      if (request.url().includes('/api/crypto-projects-rated')) {
        apiCalls.push(request.url());
      }
    });
    
    await page.goto('https://coinairank.com');
    await page.waitForTimeout(2000);
    
    // Clear API calls from initial load
    apiCalls.length = 0;
    
    // Open filters
    const expandButton = page.locator('button[title="Expand Filters"]');
    if (await expandButton.isVisible()) {
      await expandButton.click();
      await page.waitForTimeout(500);
    }
    
    const safetySection = page.locator('h3:has-text("Safety")').first();
    await safetySection.click();
    await page.waitForTimeout(500);
    
    // Test toggling Include Unverified
    const unverifiedCheckbox = page.locator('span:has-text("Include Unverified")').locator('..').locator('div').first();
    
    console.log('\n=== Testing Include Unverified Toggle ===');
    await unverifiedCheckbox.click();
    await page.waitForTimeout(1000);
    
    if (apiCalls.length > 0) {
      const lastCall = apiCalls[apiCalls.length - 1];
      const url = new URL(lastCall);
      console.log('After checking Include Unverified:');
      console.log('  includeUnverified param:', url.searchParams.get('includeUnverified'));
    }
    
    apiCalls.length = 0;
    await unverifiedCheckbox.click();
    await page.waitForTimeout(1000);
    
    if (apiCalls.length > 0) {
      const lastCall = apiCalls[apiCalls.length - 1];
      const url = new URL(lastCall);
      console.log('After unchecking Include Unverified:');
      console.log('  includeUnverified param:', url.searchParams.get('includeUnverified'));
    }
    
    // Check localStorage state
    const filters = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('carProjectsFilters') || '{}');
    });
    console.log('\nFinal localStorage state:', filters);
  });
});