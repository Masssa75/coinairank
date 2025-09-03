import { test, expect } from '@playwright/test';

test('Test main page and Add Token functionality', async ({ page }) => {
  // Go to the main page (not /projects-rated)
  await page.goto('https://coinairank.com');
  
  // Wait for the page to load
  await page.waitForLoadState('networkidle');
  
  // Check if the hamburger menu is visible
  const menuButton = page.locator('button[title="Menu"]');
  await expect(menuButton).toBeVisible();
  console.log('✅ Menu button is visible');
  
  // Click the menu button
  await menuButton.click();
  
  // Check if Submit Token option is visible
  const submitTokenButton = page.getByText('Submit Token');
  await expect(submitTokenButton).toBeVisible();
  console.log('✅ Submit Token option is visible in menu');
  
  // Click Submit Token
  await submitTokenButton.click();
  
  // Check if the Add Token modal appears
  const modalTitle = page.getByRole('heading', { name: 'Add Token' });
  const isModalVisible = await modalTitle.isVisible().catch(() => false);
  console.log(`Add Token modal visible: ${isModalVisible}`);
  
  if (isModalVisible) {
    console.log('✅ Add Token modal opened successfully');
    
    // Check for the network dropdown
    const networkSelect = page.locator('select#network');
    await expect(networkSelect).toBeVisible();
    console.log('✅ Network dropdown is visible');
    
    // Check for the contract address input
    const contractInput = page.locator('input#contractAddress');
    await expect(contractInput).toBeVisible();
    console.log('✅ Contract address input is visible');
    
    // Close the modal
    const closeButton = page.locator('button[aria-label="Close"]');
    await closeButton.click();
  }
  
  // Check if projects are loading
  await page.waitForTimeout(3000);
  
  const projectCards = page.locator('.max-w-7xl.mx-auto.grid > div');
  const count = await projectCards.count();
  console.log(`Found ${count} project cards on main page`);
  
  // Get the first few project titles if they exist
  if (count > 0) {
    console.log('Projects are displaying on main page:');
    for (let i = 0; i < Math.min(3, count); i++) {
      const symbol = await projectCards.nth(i).locator('h3').textContent().catch(() => 'N/A');
      console.log(`  Project ${i + 1}: ${symbol}`);
    }
  }
  
  // Take a screenshot
  await page.screenshot({ path: 'main-page-test.png', fullPage: true });
  console.log('📸 Screenshot saved as main-page-test.png');
  
  // Verify that the page is working
  expect(count).toBeGreaterThan(0);
});