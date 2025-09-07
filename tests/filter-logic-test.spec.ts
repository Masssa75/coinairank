import { test, expect } from '@playwright/test';

test.describe('Filter Logic Verification', () => {
  test('Verify Include Imposters filter works correctly', async ({ page }) => {
    // Clear localStorage first
    await page.goto('https://coinairank.com');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(2000);
    
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
    
    // Check that Include Imposters is unchecked by default
    const impostersCheckbox = page.locator('span:has-text("Include Imposters")').locator('..').locator('div').first();
    const initialState = await impostersCheckbox.evaluate(el => {
      return window.getComputedStyle(el).backgroundColor.includes('rgb(0, 255, 136)');
    });
    expect(initialState).toBe(false); // Should be unchecked by default
    
    // Count projects before including imposters
    const projectsBefore = await page.locator('.rounded-2xl').count();
    console.log(`Projects without imposters: ${projectsBefore}`);
    
    // Click to include imposters
    await impostersCheckbox.click();
    await page.waitForTimeout(2000);
    
    // Count projects after including imposters
    const projectsAfter = await page.locator('.rounded-2xl').count();
    console.log(`Projects with imposters: ${projectsAfter}`);
    
    // Verify checkbox is now checked
    const afterState = await impostersCheckbox.evaluate(el => {
      return window.getComputedStyle(el).backgroundColor.includes('rgb(0, 255, 136)');
    });
    expect(afterState).toBe(true);
    
    // Check localStorage has correct value
    const filters = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('carProjectsFilters') || '{}');
    });
    expect(filters.includeImposters).toBe(true);
  });
  
  test('Verify KTA visibility with filters', async ({ page }) => {
    // Clear localStorage first
    await page.goto('https://coinairank.com');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(2000);
    
    // Search for KTA
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await searchInput.fill('KTA');
    await page.waitForTimeout(2000);
    
    // Check if KTA is visible (it should be, as it's not an imposter)
    const ktaCard = page.locator('text="KTA"').first();
    const ktaVisible = await ktaCard.isVisible();
    console.log(`KTA visible with default filters: ${ktaVisible}`);
    expect(ktaVisible).toBe(true);
    
    // Now check with Include Imposters checked (shouldn't affect KTA)
    const expandButton = page.locator('button[title="Expand Filters"]');
    if (await expandButton.isVisible()) {
      await expandButton.click();
      await page.waitForTimeout(500);
    }
    
    const safetySection = page.locator('h3:has-text("Safety")').first();
    await safetySection.click();
    await page.waitForTimeout(500);
    
    const impostersCheckbox = page.locator('span:has-text("Include Imposters")').locator('..').locator('div').first();
    await impostersCheckbox.click();
    await page.waitForTimeout(2000);
    
    // KTA should still be visible
    const ktaStillVisible = await ktaCard.isVisible();
    console.log(`KTA visible with imposters included: ${ktaStillVisible}`);
    expect(ktaStillVisible).toBe(true);
  });
});