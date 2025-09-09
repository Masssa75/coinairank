import { test, expect } from '@playwright/test';

test.describe('Admin Prompts Page', () => {
  test('should load admin prompts without errors', async ({ page }) => {
    // Navigate to admin prompts page
    await page.goto('https://coinairank.com/admin/prompts');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check for any JavaScript errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Check if the page loaded successfully (not showing error message)
    const errorMessage = page.locator('text=Application error: a client-side exception has occurred');
    const shouldNotHaveError = await errorMessage.count() === 0;
    
    if (!shouldNotHaveError) {
      console.log('❌ Page shows client-side exception error');
      // Try to get more details from browser console
      await page.waitForTimeout(2000);
      console.log('JavaScript errors:', errors);
    }
    
    // Check if prompts loaded successfully 
    const retryButton = page.locator('button:has-text("Retry")');
    const hasRetryButton = await retryButton.count() > 0;
    
    if (hasRetryButton) {
      console.log('❌ Page shows Retry button - prompts failed to load');
      
      // Try clicking retry to see what happens
      await retryButton.click();
      await page.waitForTimeout(3000);
      
      const stillHasRetry = await page.locator('button:has-text("Retry")').count() > 0;
      if (stillHasRetry) {
        console.log('❌ Retry failed - still showing error');
      } else {
        console.log('✅ Retry worked - prompts loaded');
      }
    }
    
    // Check for successful prompts loading indicators
    const promptContent = page.locator('text=EXTRACTION_PROMPT, text=TIER 1 SIGNALS, text=stage_2_resources');
    const hasPromptContent = await promptContent.count() > 0;
    
    if (hasPromptContent) {
      console.log('✅ Prompts content detected on page');
    } else {
      console.log('❌ No prompts content detected');
    }
    
    // Capture a screenshot for debugging
    await page.screenshot({ path: '/tmp/admin-prompts-debug.png', fullPage: true });
    console.log('📸 Screenshot saved to /tmp/admin-prompts-debug.png');
    
    // Final assertion
    expect(shouldNotHaveError).toBe(true);
  });
  
  test('should test API endpoint directly', async ({ request }) => {
    console.log('🔍 Testing API endpoint directly...');
    
    const response = await request.get('https://coinairank.com/api/admin/ai-prompts');
    
    console.log('API Response Status:', response.status());
    
    if (response.ok()) {
      const data = await response.json();
      console.log('✅ API responded successfully');
      console.log('Response keys:', Object.keys(data));
      
      if (data.promptTemplate) {
        console.log('✅ promptTemplate found in response');
        console.log('Prompt length:', data.promptTemplate.length);
        console.log('Prompt preview:', data.promptTemplate.substring(0, 200) + '...');
      } else {
        console.log('❌ No promptTemplate in response');
      }
      
      if (data.error) {
        console.log('❌ API returned error:', data.error);
      }
    } else {
      const errorText = await response.text();
      console.log('❌ API request failed:', response.status(), errorText);
    }
    
    expect(response.ok()).toBe(true);
  });
});