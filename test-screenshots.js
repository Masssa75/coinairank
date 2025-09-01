const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log("Navigating to CoinAIRank...");
  await page.goto("https://coinairank.netlify.app/projects-rated");
  await page.waitForTimeout(3000);
  
  // Check for project cards
  const cards = await page.$$(".rounded-xl.border");
  console.log(`Found ${cards.length} project cards`);
  
  // Check each card for screenshots
  for (let i = 0; i < Math.min(3, cards.length); i++) {
    const card = cards[i];
    const screenshotDiv = await card.$(".h-48.bg-gray-900");
    
    if (screenshotDiv) {
      const img = await screenshotDiv.$("img");
      if (img) {
        const src = await img.getAttribute("src");
        const alt = await img.getAttribute("alt");
        console.log(`Card ${i + 1} - Image src: ${src}`);
        console.log(`Card ${i + 1} - Image alt: ${alt}`);
        
        // Check if image loads
        const isVisible = await img.isVisible();
        console.log(`Card ${i + 1} - Image visible: ${isVisible}`);
      } else {
        console.log(`Card ${i + 1} - No img tag found`);
        
        // Check for placeholder
        const placeholder = await screenshotDiv.$(".text-\\[\\#666\\]");
        if (placeholder) {
          const text = await placeholder.textContent();
          console.log(`Card ${i + 1} - Placeholder text: ${text}`);
        }
      }
    }
  }
  
  // Check console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Console error:', msg.text());
    }
  });
  
  await page.waitForTimeout(2000);
  await browser.close();
})();