const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('Navigating to coinairank.com...');
  await page.goto('https://coinairank.com');
  
  // Wait for content to load
  await page.waitForTimeout(3000);
  
  // Check if scrollbars are hidden
  const scrollbarVisible = await page.evaluate(() => {
    // Check main container scrollbar visibility
    const mainContainer = document.querySelector('[class*="overflow-y-auto"]');
    if (mainContainer) {
      const styles = window.getComputedStyle(mainContainer);
      console.log('Scrollbar styles:', {
        overflow: styles.overflow,
        overflowY: styles.overflowY,
        scrollbarWidth: styles.scrollbarWidth,
        msOverflowStyle: styles.msOverflowStyle
      });
      
      // Check webkit scrollbar styles
      const scrollbarWidth = styles.getPropertyValue('-webkit-scrollbar-width');
      const scrollbarDisplay = styles.getPropertyValue('-webkit-scrollbar');
      
      return {
        element: mainContainer.className,
        overflow: styles.overflow,
        overflowY: styles.overflowY,
        scrollbarWidth,
        scrollbarDisplay,
        hasScrollbarHide: mainContainer.classList.contains('scrollbar-hide')
      };
    }
    return null;
  });
  
  console.log('Scrollbar check result:', scrollbarVisible);
  
  // Take a screenshot to verify
  await page.screenshot({ path: 'scrollbar-test.png', fullPage: true });
  console.log('Screenshot saved as scrollbar-test.png');
  
  // Keep browser open for manual inspection
  console.log('Browser will close in 10 seconds...');
  await page.waitForTimeout(10000);
  
  await browser.close();
})();