const { test, expect } = require('@playwright/test');

test('Admin panel AI Analysis Prompts navigation test', async ({ page }) => {
  console.log('Starting admin panel test...');
  
  // Navigate to the live site
  await page.goto('https://coinairank.com/admin', { 
    waitUntil: 'networkidle',
    timeout: 30000 
  });
  
  console.log('Loaded admin page, looking for password field...');
  
  // Wait for and fill the admin password
  const passwordInput = page.locator('input[type="password"]');
  await expect(passwordInput).toBeVisible({ timeout: 10000 });
  await passwordInput.fill('donkey');
  
  // Click login
  const loginButton = page.locator('button:has-text("Login")');
  await expect(loginButton).toBeVisible();
  await loginButton.click();
  
  console.log('Submitted login, waiting for dashboard...');
  
  // Wait for successful login (should redirect directly to prompts page)
  console.log('Waiting for prompts page to load after login...');
  
  // Wait for either the prompts page to load or an error to appear
  await page.waitForTimeout(3000);
  
  // Listen for console errors before clicking
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Browser console error:', msg.text());
      consoleErrors.push(msg.text());
    }
  });
  
  // Listen for uncaught exceptions
  const pageErrors = [];
  page.on('pageerror', error => {
    console.log('Page error:', error.message);
    pageErrors.push(error.message);
  });
  
  console.log('Login completed, checking current state...');
  
  // Wait a moment for potential errors to surface
  await page.waitForTimeout(3000);
  
  console.log('Checking page state after click...');
  
  // Check if we're on the prompts page or if there's an error
  const currentUrl = page.url();
  console.log('Current URL:', currentUrl);
  
  // Check for error messages on the page
  const errorText = await page.locator('text=Application error').count();
  if (errorText > 0) {
    console.log('Found application error on page');
    
    // Try to get more error details
    const errorDetails = await page.textContent('body');
    console.log('Page content:', errorDetails.substring(0, 500));
  }
  
  // Log any console errors found
  if (consoleErrors.length > 0) {
    console.log('Console errors found:', consoleErrors);
  }
  
  // Log any page errors found
  if (pageErrors.length > 0) {
    console.log('Page errors found:', pageErrors);
  }
  
  // Check if we successfully loaded the prompts page or have an error
  const hasApplicationError = await page.locator('text=Application error').isVisible();
  const isPromptsPageLoaded = currentUrl.includes('/admin/prompts') && !hasApplicationError;
  
  if (hasApplicationError) {
    console.log('❌ Application error found on prompts page');
    
    // Check browser console for network errors
    const response = await page.waitForResponse(response => 
      response.url().includes('/api/admin/ai-prompts') && response.status() !== 200
    ).catch(() => null);
    
    if (response) {
      console.log('API Error:', response.status(), await response.text());
    }
    
  } else if (isPromptsPageLoaded) {
    console.log('✅ Successfully loaded AI Analysis Prompts page');
  } else {
    console.log('❌ Failed to load AI Analysis Prompts page');
    console.log('Page title:', await page.title());
  }
  
  // Take a screenshot for debugging
  await page.screenshot({ 
    path: '/Users/marcschwyn/Desktop/projects/CAR/app/tests/admin-prompts-error.png',
    fullPage: true 
  });
  
  console.log('Screenshot saved. Test completed.');
});