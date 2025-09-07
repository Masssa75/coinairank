import { test, expect } from '@playwright/test';

test.describe('Rugs Filter Removal Verification', () => {
  test('Verify rugs filter is removed and imposters filter remains', async ({ page }) => {
    // Go to the main page
    await page.goto('https://coinairank.com');
    
    // Wait for initial load
    await page.waitForTimeout(2000);
    
    // Open filter sidebar if collapsed
    const expandButton = page.locator('button[title="Expand Filters"]');
    if (await expandButton.isVisible()) {
      await expandButton.click();
      await page.waitForTimeout(500);
    }
    
    // Open Safety section
    const safetySection = page.locator('h3:has-text("Safety")').first();
    await safetySection.click();
    await page.waitForTimeout(500);
    
    // Verify "Include Rugs" is NOT present
    const includeRugs = page.locator('text="Include Rugs"');
    await expect(includeRugs).not.toBeVisible();
    
    // Verify "Include Imposters" IS present
    const includeImposters = page.locator('text="Include Imposters"');
    await expect(includeImposters).toBeVisible();
    
    // Verify "Include Unverified" IS present  
    const includeUnverified = page.locator('text="Include Unverified"');
    await expect(includeUnverified).toBeVisible();
    
    console.log('✅ Rugs filter successfully removed');
    console.log('✅ Imposters filter still present');
    console.log('✅ Unverified filter still present');
  });
  
  test('Verify RUGGED and DEAD badges are removed', async ({ page }) => {
    // Go to the main page
    await page.goto('https://coinairank.com');
    
    // Wait for projects to load
    await page.waitForTimeout(3000);
    
    // Check that no RUGGED badges exist
    const ruggedBadges = page.locator('text="RUGGED"');
    const ruggedCount = await ruggedBadges.count();
    expect(ruggedCount).toBe(0);
    
    // Check that no DEAD badges exist
    const deadBadges = page.locator('text="DEAD"');
    const deadCount = await deadBadges.count();
    expect(deadCount).toBe(0);
    
    console.log('✅ No RUGGED badges found');
    console.log('✅ No DEAD badges found');
  });
  
  test('Verify localStorage cleanup works', async ({ page }) => {
    // Set old localStorage values with excludeRugs
    await page.goto('https://coinairank.com');
    await page.evaluate(() => {
      localStorage.setItem('carProjectsFilters', JSON.stringify({
        tokenType: 'all',
        networks: ['ethereum'],
        excludeRugs: true,  // Old deprecated field
        excludeImposters: true,
        minWebsiteScore: 5
      }));
      localStorage.setItem('carProjectsFilterSections', JSON.stringify({
        tokenType: false,
        rugs: true,  // Old section name
        networks: true
      }));
    });
    
    // Reload page to trigger cleanup
    await page.reload();
    await page.waitForTimeout(2000);
    
    // Check that excludeRugs was removed and rugs renamed to safety
    const filters = await page.evaluate(() => {
      return {
        filters: JSON.parse(localStorage.getItem('carProjectsFilters') || '{}'),
        sections: JSON.parse(localStorage.getItem('carProjectsFilterSections') || '{}')
      };
    });
    
    expect(filters.filters.excludeRugs).toBeUndefined();
    expect(filters.filters.excludeImposters).toBeDefined();
    // minWebsiteScore gets reset to default by FilterSidebar initialization
    expect(filters.filters.minWebsiteScore).toBeDefined();
    
    expect(filters.sections.rugs).toBeUndefined();
    expect(filters.sections.safety).toBe(true);
    
    console.log('✅ localStorage cleanup successful');
    console.log('✅ excludeRugs removed from filters');
    console.log('✅ rugs section renamed to safety');
  });
});