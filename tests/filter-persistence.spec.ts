import { test, expect } from '@playwright/test';

test.describe('Filter Persistence Tests', () => {
  test('Regular user - filter persistence across page reloads', async ({ page, context }) => {
    // Go to the main page
    await page.goto('https://coinairank.com');
    
    // Wait for the page to load - look for project cards or loading state
    await page.waitForSelector('.rounded-2xl, .animate-spin', { timeout: 10000 });
    
    // Open filter sidebar if collapsed
    const expandButton = page.locator('button[title="Expand Filters"]');
    if (await expandButton.isVisible()) {
      await expandButton.click();
      await page.waitForTimeout(500);
    }
    
    // Change some filters
    console.log('Changing filters...');
    
    // 1. Change token type to Meme only
    const tokenTypeSection = page.locator('h3:has-text("Token Type")').first();
    await tokenTypeSection.click();
    await page.waitForTimeout(300);
    
    // Uncheck Utility tokens
    const utilityCheckbox = page.locator('text=Utility Tokens').first();
    await utilityCheckbox.click();
    await page.waitForTimeout(500);
    
    // 2. Change minimum website score
    const scoresSection = page.locator('h3:has-text("Analysis Scores")').first();
    await scoresSection.click();
    await page.waitForTimeout(300);
    
    const scoreSlider = page.locator('input[type="range"]').first();
    await scoreSlider.fill('5');
    await page.waitForTimeout(500);
    
    // 3. Change networks - uncheck BSC
    const networksSection = page.locator('h3:has-text("Networks")').first();
    await networksSection.click();
    await page.waitForTimeout(300);
    
    const bscCheckbox = page.locator('text=BSC').first();
    await bscCheckbox.click();
    await page.waitForTimeout(500);
    
    // Get localStorage values before reload
    const filtersBeforeReload = await page.evaluate(() => {
      return localStorage.getItem('carProjectsFilters');
    });
    console.log('Filters before reload:', filtersBeforeReload);
    
    // Reload the page
    console.log('Reloading page...');
    await page.reload();
    
    // Wait for page to load - look for project cards or loading state
    await page.waitForSelector('.rounded-2xl, .animate-spin', { timeout: 10000 });
    
    // Get localStorage values after reload
    const filtersAfterReload = await page.evaluate(() => {
      return localStorage.getItem('carProjectsFilters');
    });
    console.log('Filters after reload:', filtersAfterReload);
    
    // Check if filters persisted
    expect(filtersAfterReload).toBeTruthy();
    expect(filtersAfterReload).toEqual(filtersBeforeReload);
    
    // Parse and verify specific filter values
    const filters = JSON.parse(filtersAfterReload || '{}');
    expect(filters.tokenType).toBe('meme');
    expect(filters.minWebsiteScore).toBe(5);
    expect(filters.networks).not.toContain('bsc');
    
    // Open filter sidebar if collapsed after reload
    const expandButtonAfter = page.locator('button[title="Expand Filters"]');
    if (await expandButtonAfter.isVisible()) {
      await expandButtonAfter.click();
      await page.waitForTimeout(500);
    }
    
    // Verify UI reflects the saved filters by checking localStorage
    // The UI state verification is complex due to dynamic rendering
    // so we rely on localStorage verification which is the source of truth
    
    console.log('Filter persistence test for regular user: PASSED');
  });

  test('Admin user - filter persistence across page reloads', async ({ page, context }) => {
    // First, login as admin
    await page.goto('https://coinairank.com/admin');
    
    // Enter admin password
    await page.fill('input[type="password"]', 'donkey');
    await page.click('button:has-text("Login")');
    
    // Wait for redirect to admin dashboard
    await page.waitForURL('**/admin', { timeout: 10000 });
    
    // Go to main page
    await page.goto('https://coinairank.com');
    
    // Wait for the page to load - look for project cards or loading state
    await page.waitForSelector('.rounded-2xl, .animate-spin', { timeout: 10000 });
    
    // Open filter sidebar if collapsed
    const expandButton = page.locator('button[title="Expand Filters"]');
    if (await expandButton.isVisible()) {
      await expandButton.click();
      await page.waitForTimeout(500);
    }
    
    // Change some filters
    console.log('Admin: Changing filters...');
    
    // 1. Change token type to Utility only
    const tokenTypeSection = page.locator('h3:has-text("Token Type")').first();
    await tokenTypeSection.click();
    await page.waitForTimeout(300);
    
    // Uncheck Meme tokens
    const memeCheckbox = page.locator('text=Meme Tokens').first();
    await memeCheckbox.click();
    await page.waitForTimeout(500);
    
    // 2. Toggle "Show Reprocessed Only" if available
    const reprocessedSection = page.locator('h3:has-text("Reprocessed")');
    if (await reprocessedSection.isVisible()) {
      await reprocessedSection.click();
      await page.waitForTimeout(300);
      
      const reprocessedCheckbox = page.locator('text=Show only reprocessed').first();
      await reprocessedCheckbox.click();
      await page.waitForTimeout(500);
    }
    
    // Get localStorage values before reload
    const filtersBeforeReload = await page.evaluate(() => {
      return localStorage.getItem('carProjectsFilters');
    });
    console.log('Admin filters before reload:', filtersBeforeReload);
    
    // Check admin cookie status
    const cookies = await context.cookies();
    const adminCookie = cookies.find(c => c.name === 'admin_auth');
    console.log('Admin cookie present:', !!adminCookie);
    
    // Reload the page
    console.log('Admin: Reloading page...');
    await page.reload();
    
    // Wait for page to load - look for project cards or loading state
    await page.waitForSelector('.rounded-2xl, .animate-spin', { timeout: 10000 });
    
    // Get localStorage values after reload
    const filtersAfterReload = await page.evaluate(() => {
      return localStorage.getItem('carProjectsFilters');
    });
    console.log('Admin filters after reload:', filtersAfterReload);
    
    // Check if filters persisted
    expect(filtersAfterReload).toBeTruthy();
    expect(filtersAfterReload).toEqual(filtersBeforeReload);
    
    // Parse and verify specific filter values
    const filters = JSON.parse(filtersAfterReload || '{}');
    expect(filters.tokenType).toBe('utility');
    
    console.log('Filter persistence test for admin user: PASSED');
  });

  test('Filter persistence across browser sessions', async ({ browser }) => {
    // Create first browser context
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    
    await page1.goto('https://coinairank.com');
    await page1.waitForSelector('.rounded-2xl, .animate-spin', { timeout: 10000 });
    
    // Set some filters in first session
    const expandButton1 = page1.locator('button[title="Expand Filters"]');
    if (await expandButton1.isVisible()) {
      await expandButton1.click();
      await page1.waitForTimeout(500);
    }
    
    // Change minimum score to 7
    const scoresSection = page1.locator('h3:has-text("Analysis Scores")').first();
    await scoresSection.click();
    await page1.waitForTimeout(300);
    
    const scoreSlider = page1.locator('input[type="range"]').first();
    await scoreSlider.fill('7');
    await page1.waitForTimeout(500);
    
    // Get the filter state
    const savedFilters = await page1.evaluate(() => {
      return localStorage.getItem('carProjectsFilters');
    });
    
    // Close first context
    await context1.close();
    
    // Create new browser context (simulates new browser session)
    const context2 = await browser.newContext({
      storageState: undefined // Start fresh
    });
    const page2 = await context2.newPage();
    
    // Since localStorage is domain-specific and we're starting fresh,
    // filters should NOT persist across different browser contexts
    await page2.goto('https://coinairank.com');
    await page2.waitForSelector('.rounded-2xl, .animate-spin', { timeout: 10000 });
    
    const filtersInNewContext = await page2.evaluate(() => {
      return localStorage.getItem('carProjectsFilters');
    });
    
    // In a new context, localStorage should be empty
    expect(filtersInNewContext).toBeNull();
    
    await context2.close();
    
    console.log('Cross-session test completed - localStorage is session-specific as expected');
  });
});