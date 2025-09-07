const { test } = require('@playwright/test');

test('Debug UI structure', async ({ page }) => {
  await page.goto('https://coinairank.com');
  await page.waitForTimeout(3000);
  
  // Take initial screenshot
  await page.screenshot({ path: 'initial-state.png', fullPage: true });
  console.log('Initial screenshot saved');
  
  // Find all buttons
  const buttons = await page.locator('button').all();
  console.log(`\nFound ${buttons.length} buttons:`);
  for (let i = 0; i < Math.min(5, buttons.length); i++) {
    const text = await buttons[i].textContent().catch(() => '');
    const title = await buttons[i].getAttribute('title').catch(() => '');
    const classes = await buttons[i].getAttribute('class').catch(() => '');
    console.log(`  Button ${i}: text="${text?.trim()}", title="${title}", classes="${classes?.substring(0, 50)}..."`);
  }
  
  // Click first button (filter button)
  if (buttons.length > 0) {
    console.log('\nClicking first button...');
    await buttons[0].click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'after-first-click.png', fullPage: true });
    
    // Look for any expandable sections
    const expandables = await page.locator('[class*="cursor-pointer"]').all();
    console.log(`\nFound ${expandables.length} clickable elements`);
    
    // Look for checkboxes
    const checkboxes = await page.locator('input[type="checkbox"]').all();
    console.log(`Found ${checkboxes.length} checkboxes`);
    
    // Look for any text containing "Include" or "Unverified"
    const includeTexts = await page.locator('text=/[Ii]nclude/').all();
    console.log(`\nFound ${includeTexts.length} elements with "Include":`);
    for (let i = 0; i < includeTexts.length; i++) {
      const text = await includeTexts[i].textContent();
      console.log(`  ${i}: "${text?.trim()}"`);
    }
    
    const unverifiedTexts = await page.locator('text=/[Uu]nverified/').all();
    console.log(`\nFound ${unverifiedTexts.length} elements with "Unverified":`);
    for (let i = 0; i < unverifiedTexts.length; i++) {
      const text = await unverifiedTexts[i].textContent();
      console.log(`  ${i}: "${text?.trim()}"`);
    }
  }
  
  // Check what's in the sidebar
  const sidebar = page.locator('aside, [class*="sidebar"], div.w-64, div.w-72');
  if (await sidebar.isVisible().catch(() => false)) {
    console.log('\nSidebar found, getting content...');
    const sidebarText = await sidebar.textContent();
    console.log('Sidebar text (first 500 chars):', sidebarText?.substring(0, 500));
  }
});