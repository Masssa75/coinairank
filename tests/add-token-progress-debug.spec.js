const { test, expect } = require('@playwright/test');

test.describe('Add Token Progress Tracker Debug', () => {
  test('Debug progress tracker with virtuals token submission', async ({ page }) => {
    // Enable console logging to catch API responses
    const apiResponses = [];
    const consoleMessages = [];
    
    page.on('console', msg => {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
    });
    
    page.on('response', response => {
      if (response.url().includes('/api/add-token') || response.url().includes('/api/crypto-projects-rated')) {
        apiResponses.push({
          url: response.url(),
          status: response.status(),
          method: response.request().method()
        });
      }
    });

    // Navigate to the site
    await page.goto('https://coinairank.com');
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Open hamburger menu first
    console.log('Opening hamburger menu...');
    await page.click('button[aria-label="Open menu"], button:has([data-icon="menu"]), .hamburger, [class*="menu"]').catch(() => {
      console.log('Trying alternative menu selectors...');
    });
    
    // Try multiple possible menu button selectors
    const menuSelectors = [
      'button[aria-label="Open menu"]',
      'button:has([data-lucide="menu"])',
      'button:has(svg)',
      '[role="button"]:has(svg)',
      '.cursor-pointer:has(svg)'
    ];
    
    let menuOpened = false;
    for (const selector of menuSelectors) {
      try {
        const menuButton = page.locator(selector).first();
        if (await menuButton.isVisible()) {
          await menuButton.click();
          console.log(`Clicked menu button with selector: ${selector}`);
          menuOpened = true;
          break;
        }
      } catch (e) {
        console.log(`Menu selector ${selector} failed:`, e.message);
      }
    }
    
    if (!menuOpened) {
      console.log('Could not open menu, taking screenshot...');
      await page.screenshot({ path: 'menu-debug.png', fullPage: true });
    }
    
    // Wait for menu to open
    await page.waitForTimeout(1000);
    
    // Now click the "Submit Token" button in the menu
    console.log('Looking for Submit Token button in menu...');
    await expect(page.locator('text=Submit Token')).toBeVisible({ timeout: 5000 });
    await page.click('text=Submit Token');
    
    // Wait for modal to appear
    await expect(page.locator('[data-testid="add-token-modal"], .bg-\\[\\#0d0e10\\]')).toBeVisible({ timeout: 5000 });
    
    // Fill in the contract address for "virtuals" token
    // Using a known Ethereum token address for testing
    const virtualsAddress = '0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b'; // VIRTUAL token on Ethereum
    
    console.log('Filling in form with virtuals token...');
    await page.selectOption('select', 'ethereum'); // Select Ethereum network
    await page.fill('input[placeholder*="0x"], input[id="contractAddress"]', virtualsAddress);
    
    // Intercept the add-token API call to inspect the response
    let addTokenResponse = null;
    page.on('response', async response => {
      if (response.url().includes('/api/add-token') && response.request().method() === 'POST') {
        try {
          addTokenResponse = await response.json();
          console.log('ADD TOKEN API RESPONSE:', JSON.stringify(addTokenResponse, null, 2));
        } catch (e) {
          console.log('Failed to parse add-token response:', e.message);
        }
      }
    });
    
    // Submit the form
    console.log('Submitting form...');
    await page.click('button[type="submit"], button:has-text("Add Token")');
    
    // Wait for API response
    await page.waitForTimeout(3000);
    
    // Check if progress tracker appeared
    console.log('Checking for progress tracker...');
    const progressTracker = page.locator('text=Processing Your Submission');
    const isProgressTrackerVisible = await progressTracker.isVisible();
    
    console.log('Progress tracker visible:', isProgressTrackerVisible);
    
    if (isProgressTrackerVisible) {
      console.log('✅ Progress tracker is showing - test passed!');
      
      // Monitor progress updates for 30 seconds
      console.log('Monitoring progress updates...');
      const progressUpdates = [];
      
      for (let i = 0; i < 3; i++) {
        await page.waitForTimeout(10000); // Wait 10 seconds
        
        // Check progress percentage
        const progressText = await page.locator('text=Analysis Progress').locator('..').locator('text=%').textContent().catch(() => 'Not found');
        const progressMessage = await page.locator('.text-gray-300:has-text("Progress"), .text-sm:has-text("Analysis"), .text-gray-300').first().textContent().catch(() => 'Not found');
        
        progressUpdates.push({
          iteration: i + 1,
          progress: progressText,
          message: progressMessage,
          timestamp: new Date().toISOString()
        });
        
        console.log(`Progress update ${i + 1}: ${progressText} - ${progressMessage}`);
      }
      
      console.log('Progress updates captured:', JSON.stringify(progressUpdates, null, 2));
      
    } else {
      console.log('❌ Progress tracker NOT showing - debugging...');
      
      // Check what's displayed instead
      const modalContent = await page.locator('.bg-\\[\\#0d0e10\\]').textContent();
      console.log('Modal content:', modalContent);
      
      // Check for error messages
      const errorElements = await page.locator('.text-red-400, .bg-red-500\\/10').allTextContents();
      if (errorElements.length > 0) {
        console.log('Error messages found:', errorElements);
      }
      
      // Check for success messages
      const successElements = await page.locator('.text-green-400, .bg-green-500\\/10').allTextContents();
      if (successElements.length > 0) {
        console.log('Success messages found:', successElements);
      }
      
      // Check form state
      const submitButton = page.locator('button[type="submit"], button:has-text("Add Token")');
      const isSubmitting = await submitButton.isDisabled();
      console.log('Submit button disabled (submitting):', isSubmitting);
      
      console.log('ADD TOKEN RESPONSE DETAILS:', addTokenResponse);
    }
    
    // Log all API calls made
    console.log('All relevant API responses:', JSON.stringify(apiResponses, null, 2));
    console.log('Console messages:', consoleMessages.slice(-10)); // Last 10 messages
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'add-token-debug.png', fullPage: true });
    console.log('Screenshot saved as add-token-debug.png');
  });
  
  test('Test with a fresh token address', async ({ page }) => {
    // Test with a different token to see if it's token-specific
    page.on('console', msg => console.log(`CONSOLE: ${msg.text()}`));
    
    await page.goto('https://coinairank.com');
    await page.waitForTimeout(2000);
    
    // Open hamburger menu
    const menuButton = page.locator('button:has(svg)').first();
    await menuButton.click();
    await page.waitForTimeout(500);
    
    await page.click('text=Submit Token');
    await expect(page.locator('.bg-\\[\\#0d0e10\\]')).toBeVisible({ timeout: 5000 });
    
    // Try with a different token
    const testAddress = '0xa0b86991c31cc0c4c2f7c4bc7e3b7c9f0c1b6c6e6'; // Different token
    
    await page.selectOption('select', 'ethereum');
    await page.fill('input[id="contractAddress"]', testAddress);
    
    let responseReceived = false;
    page.on('response', async response => {
      if (response.url().includes('/api/add-token')) {
        responseReceived = true;
        try {
          const data = await response.json();
          console.log('API Response Status:', response.status());
          console.log('API Response Data:', JSON.stringify(data, null, 2));
        } catch (e) {
          console.log('Response parse error:', e.message);
        }
      }
    });
    
    await page.click('button:has-text("Add Token")');
    await page.waitForTimeout(5000);
    
    const hasProgressTracker = await page.locator('text=Processing Your Submission').isVisible();
    console.log('Fresh token progress tracker visible:', hasProgressTracker);
    console.log('API response received:', responseReceived);
    
    await page.screenshot({ path: 'fresh-token-test.png', fullPage: true });
  });
  
  test('Inspect network tab for API calls', async ({ page }) => {
    // More detailed network inspection
    const networkEvents = [];
    
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        networkEvents.push({
          type: 'request',
          url: request.url(),
          method: request.method(),
          headers: request.headers() ? Object.fromEntries(Object.entries(request.headers())) : {},
          postData: request.postData()
        });
      }
    });
    
    page.on('response', async response => {
      if (response.url().includes('/api/')) {
        try {
          const responseData = await response.text();
          networkEvents.push({
            type: 'response',
            url: response.url(),
            status: response.status(),
            headers: response.headers() ? Object.fromEntries(Object.entries(response.headers())) : {},
            data: responseData
          });
        } catch (e) {
          networkEvents.push({
            type: 'response_error',
            url: response.url(),
            status: response.status(),
            error: e.message
          });
        }
      }
    });
    
    await page.goto('https://coinairank.com');
    
    // Open hamburger menu
    const menuButton = page.locator('button:has(svg)').first();
    await menuButton.click();
    await page.waitForTimeout(500);
    
    await page.click('text=Submit Token');
    
    // Use the exact same virtuals token
    await page.selectOption('select', 'ethereum');
    await page.fill('input[id="contractAddress"]', '0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b');
    await page.click('button:has-text("Add Token")');
    
    await page.waitForTimeout(8000);
    
    console.log('DETAILED NETWORK EVENTS:');
    networkEvents.forEach((event, index) => {
      console.log(`${index + 1}. ${event.type.toUpperCase()}:`, JSON.stringify(event, null, 2));
    });
  });
});