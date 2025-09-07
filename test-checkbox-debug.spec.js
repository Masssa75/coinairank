const { test } = require('@playwright/test');

test('Debug checkbox structure', async ({ page }) => {
  await page.goto('https://coinairank.com', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // Open sidebar
  const expandButton = page.locator('button[title="Expand Filters"]').or(page.locator('button').nth(0));
  if (await expandButton.isVisible()) {
    await expandButton.click();
    await page.waitForTimeout(1000);
  }
  
  // Take screenshot of open sidebar
  await page.screenshot({ path: 'sidebar-open.png', fullPage: true });
  console.log('Screenshot saved: sidebar-open.png');
  
  // Look for all labels
  const labels = await page.locator('label').evaluateAll(els => 
    els.map(el => ({ text: el.textContent?.trim(), className: el.className }))
  );
  
  console.log('\nAll labels found:');
  labels.forEach((label, i) => {
    console.log(`  ${i}: "${label.text}" (class: ${label.className})`);
  });
  
  // Look for text containing "Unverified"
  const unverifiedTexts = await page.locator('text=/.*[Uu]nverified.*/').count();
  console.log(`\nTexts containing "Unverified": ${unverifiedTexts}`);
  
  // Try to find and click the actual element
  console.log('\nTrying different selectors...');
  
  // Method 1: Span with text
  const spanUnverified = page.locator('span:text("Include Unverified")');
  if (await spanUnverified.isVisible()) {
    console.log('Found span with "Include Unverified"');
    const parent = spanUnverified.locator('..');
    await parent.click();
    console.log('Clicked parent of span');
  }
  
  // Check if KTA appears
  await page.waitForTimeout(2000);
  const ktaVisible = await page.locator('h3:text("KTA")').isVisible().catch(() => false);
  console.log(`\nKTA visible after clicking: ${ktaVisible}`);
});