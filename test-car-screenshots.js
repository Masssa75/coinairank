const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Console error:', msg.text());
    }
  });
  
  // Monitor network requests
  page.on('requestfailed', request => {
    console.log('Request failed:', request.url(), request.failure().errorText);
  });
  
  console.log("Navigating to CoinAIRank...");
  await page.goto("https://coinairank.netlify.app/projects-rated");
  await page.waitForTimeout(3000);
  
  // Check for project cards
  const cards = await page.$$(".bg-\\[\\#111214\\]");
  console.log(`Found ${cards.length} project cards`);
  
  // Check if any capture is happening
  const capturingElements = await page.$$("[class*='Capturing screenshot']");
  console.log(`Found ${capturingElements.length} capturing indicators`);
  
  // Check for camera buttons
  const cameraButtons = await page.$$("button[title='Capture screenshot']");
  console.log(`Found ${cameraButtons.length} camera buttons`);
  
  // Check network calls to screenshot API
  let screenshotApiCalled = false;
  page.on('request', request => {
    if (request.url().includes('capture-screenshot') || request.url().includes('website-screenshot')) {
      console.log('Screenshot API called:', request.url());
      screenshotApiCalled = true;
    }
  });
  
  // Try hovering over first card to see camera button
  if (cards.length > 0) {
    await cards[0].hover();
    await page.waitForTimeout(1000);
    
    // Check if camera button is visible
    const visibleButton = await page.$("button[title='Capture screenshot']:visible");
    if (visibleButton) {
      console.log("Camera button is visible on hover");
      // Click it
      await visibleButton.click();
      console.log("Clicked camera button");
      await page.waitForTimeout(5000);
    } else {
      console.log("Camera button not visible on hover");
    }
  }
  
  // Check for any errors in the browser console
  await page.waitForTimeout(2000);
  
  console.log("Screenshot API was called:", screenshotApiCalled);
  
  await browser.close();
})();