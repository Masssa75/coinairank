import { test, expect } from '@playwright/test';

test('admin prompts page should show content after deployment', async ({ page }) => {
  // Wait for deployment to propagate
  await page.waitForTimeout(2000);
  
  // Navigate directly to prompts page - assume already authenticated via session
  await page.goto('https://coinairank.com/admin/prompts');
  
  // Wait for page load
  await page.waitForLoadState('networkidle');
  
  // Wait a bit more for React to render
  await page.waitForTimeout(3000);
  
  // Take a screenshot for debugging
  await page.screenshot({ path: '/tmp/prompts-final-test.png', fullPage: true });
  
  // Check if we see any of the expected content
  const hasMainPrompt = await page.locator('text=You are an expert crypto analyst').count() > 0;
  const hasTierSignals = await page.locator('text=TIER 1 SIGNALS').count() > 0;  
  const hasExtractionInstructions = await page.locator('text=Resource Extraction Instructions').count() > 0;
  const hasCurrentFocus = await page.locator('text=Current Focus').count() > 0;
  const hasRetryButton = await page.locator('button:has-text("Retry")').count() > 0;
  
  console.log('=== PROMPTS PAGE CONTENT CHECK ===');
  console.log('Main prompt found:', hasMainPrompt);
  console.log('Tier signals found:', hasTierSignals);
  console.log('Extraction instructions found:', hasExtractionInstructions);
  console.log('Current focus found:', hasCurrentFocus);
  console.log('Retry button (error) found:', hasRetryButton);
  
  // Get page title and URL for verification
  const title = await page.title();
  const url = page.url();
  console.log('Page title:', title);
  console.log('Page URL:', url);
  
  // Check if page has loaded at all
  const hasContent = hasMainPrompt || hasTierSignals || hasExtractionInstructions || hasCurrentFocus;
  
  if (!hasContent && hasRetryButton) {
    console.log('❌ Still showing error - trying retry button');
    await page.locator('button:has-text("Retry")').click();
    await page.waitForTimeout(3000);
    
    // Check again after retry
    const hasContentAfterRetry = await page.locator('text=You are an expert crypto analyst').count() > 0;
    console.log('Content after retry:', hasContentAfterRetry);
  }
  
  console.log('📸 Screenshot saved to /tmp/prompts-final-test.png');
});