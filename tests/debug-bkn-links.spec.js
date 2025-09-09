const { test, expect } = require('@playwright/test');

test('Debug BKN Stage 2 links display', async ({ page }) => {
  console.log('=== DEBUGGING BKN STAGE 2 LINKS DISPLAY ===');
  
  // Navigate to site
  await page.goto('https://coinairank.com');
  await page.waitForTimeout(3000);
  
  // Search for BKN to bring it up
  const searchInput = page.locator('input[placeholder*="search" i], input[type="text"]').first();
  const searchVisible = await searchInput.isVisible({ timeout: 5000 }).catch(() => false);
  
  if (searchVisible) {
    await searchInput.fill('BKN');
    await page.waitForTimeout(2000);
    console.log('✅ Searched for BKN');
  }
  
  // Find BKN card and click on it
  const bknCard = page.locator('text=BKN').first();
  const bknVisible = await bknCard.isVisible({ timeout: 10000 }).catch(() => false);
  
  if (!bknVisible) {
    console.log('❌ BKN not visible, looking for SOLID badges instead');
    const solidBadge = page.locator('text=SOLID').first();
    await solidBadge.click();
    await page.waitForTimeout(2000);
  } else {
    console.log('✅ Found BKN, clicking on it');
    await bknCard.click();
    await page.waitForTimeout(2000);
  }
  
  // Look for the modal/tooltip that shows links
  console.log('Looking for links modal...');
  
  // Check various selectors for the links section
  const linksSections = [
    'text=SELECTED FOR STAGE 2',
    'text=stage 2',
    'text=chosen',
    '[data-testid*="stage2"], [data-testid*="links"]',
    '.stage2-links, .selected-links',
  ];
  
  let linksSection = null;
  for (const selector of linksSections) {
    const section = page.locator(selector).first();
    const visible = await section.isVisible({ timeout: 2000 }).catch(() => false);
    if (visible) {
      linksSection = section;
      console.log(`✅ Found links section with selector: ${selector}`);
      break;
    }
  }
  
  if (!linksSection) {
    console.log('❌ No links section found, taking screenshot for debugging');
    await page.screenshot({ path: 'no-links-section.png', fullPage: true });
    return;
  }
  
  // Find the parent container of the links
  const linksContainer = linksSection.locator('..').first();
  
  // Count all link elements in the container
  const allLinks = linksContainer.locator('a[href], [class*="link"]').all();
  const linkElements = await allLinks;
  console.log(`Found ${linkElements.length} link elements in UI`);
  
  // Extract link URLs and details
  console.log('\n=== LINKS FOUND IN UI ===');
  for (let i = 0; i < linkElements.length; i++) {
    const link = linkElements[i];
    try {
      const href = await link.getAttribute('href').catch(() => null);
      const text = await link.textContent().catch(() => '');
      const innerHTML = await link.innerHTML().catch(() => '');
      
      console.log(`Link ${i+1}:`);
      console.log(`  href: ${href}`);
      console.log(`  text: ${text?.substring(0, 100)}...`);
      console.log(`  html: ${innerHTML?.substring(0, 100)}...`);
      console.log('---');
    } catch (e) {
      console.log(`Link ${i+1}: Error extracting - ${e.message}`);
    }
  }
  
  // Look specifically for brickken.com URLs
  const brickkenLinks = page.locator('text=/brickken\\.com/').all();
  const brickkenElements = await brickkenLinks;
  console.log(`\n=== BRICKKEN.COM LINKS ===`);
  console.log(`Found ${brickkenElements.length} brickken.com links`);
  
  for (let i = 0; i < brickkenElements.length; i++) {
    const link = brickkenElements[i];
    const text = await link.textContent().catch(() => '');
    console.log(`Brickken Link ${i+1}: ${text}`);
  }
  
  // Take screenshot for manual verification
  await page.screenshot({ path: 'bkn-stage2-links-debug.png', fullPage: true });
  console.log('\n✅ Screenshot saved as bkn-stage2-links-debug.png');
  
  // Get the raw HTML of the links section for inspection
  const linksHTML = await linksContainer.innerHTML().catch(() => 'Failed to get HTML');
  console.log('\n=== RAW HTML OF LINKS SECTION ===');
  console.log(linksHTML.substring(0, 1000) + '...');
  
  await page.waitForTimeout(15000); // Keep open for manual inspection
});