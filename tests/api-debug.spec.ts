import { test, expect } from '@playwright/test';

test.describe('API Debug', () => {
  test('Check API calls with different filter states', async ({ page }) => {
    // Monitor API calls
    const apiCalls: string[] = [];
    
    page.on('request', request => {
      if (request.url().includes('/api/crypto-projects-rated')) {
        apiCalls.push(request.url());
        console.log('API Call:', request.url());
      }
    });
    
    // Go to the main page
    await page.goto('https://coinairank.com');
    await page.waitForTimeout(2000);
    
    // Clear the array after initial load
    apiCalls.length = 0;
    
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
    
    // Click "Include Unverified" checkbox
    console.log('\n=== Clicking Include Unverified ===');
    const unverifiedCheckbox = page.locator('span:has-text("Include Unverified")').locator('..').locator('div').first();
    await unverifiedCheckbox.click();
    await page.waitForTimeout(2000);
    
    // Check the last API call
    if (apiCalls.length > 0) {
      const lastCall = apiCalls[apiCalls.length - 1];
      console.log('Last API call after checking Include Unverified:');
      console.log(lastCall);
      
      // Parse the URL to see parameters
      const url = new URL(lastCall);
      console.log('Parameters:', Object.fromEntries(url.searchParams));
    }
    
    // Count visible projects
    const projectCount = await page.locator('.rounded-2xl').count();
    console.log(`Projects visible with Include Unverified checked: ${projectCount}`);
    
    // Now uncheck it
    console.log('\n=== Unchecking Include Unverified ===');
    apiCalls.length = 0;
    await unverifiedCheckbox.click();
    await page.waitForTimeout(2000);
    
    if (apiCalls.length > 0) {
      const lastCall = apiCalls[apiCalls.length - 1];
      console.log('Last API call after unchecking Include Unverified:');
      console.log(lastCall);
      
      const url = new URL(lastCall);
      console.log('Parameters:', Object.fromEntries(url.searchParams));
    }
    
    const projectCountAfter = await page.locator('.rounded-2xl').count();
    console.log(`Projects visible with Include Unverified unchecked: ${projectCountAfter}`);
  });
});