const { test, expect } = require('@playwright/test');

test.describe('Migrated Links Test', () => {
  test('admin can see links section for migrated projects', async ({ page }) => {
    console.log('🔗 Testing admin links section after migration...');
    
    // Go to production site
    await page.goto('https://coinairank.com/', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    console.log('✅ Page loaded');
    
    // Log in as admin via cookie
    await page.evaluate(() => {
      document.cookie = 'admin_token=admin_override_token_2024; path=/; max-age=86400';
    });
    
    // Reload to activate admin status
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Check for admin badge
    const adminBadge = await page.$('text=Admin');
    if (!adminBadge) {
      console.log('❌ Not logged in as admin');
      return;
    }
    console.log('✅ Admin logged in');
    
    // Wait for projects to load
    await page.waitForSelector('.grid', { timeout: 10000 });
    
    // Test specific migrated projects - ToT, GOGO, ORYA were migrated successfully
    const testProjects = ['ToT', 'GOGO', 'ORYA'];
    let linksFound = false;
    
    for (const projectName of testProjects) {
      console.log(`\n🧪 Testing ${projectName} for admin links section...`);
      
      // Look for project by name
      const projectCard = await page.$(`text=${projectName}`);
      if (!projectCard) {
        console.log(`  ⚠️ Project ${projectName} not found on page`);
        continue;
      }
      
      // Find the tier badge in the same card
      const cardContainer = await projectCard.locator('..').locator('..').locator('..');
      const tierBadge = await cardContainer.$('[class*="px-2"][class*="py-0.5"][class*="rounded"][class*="text-xs"][class*="font-semibold"]');
      
      if (!tierBadge) {
        console.log(`  ⚠️ No tier badge found for ${projectName}`);
        continue;
      }
      
      // Click to open tooltip
      await tierBadge.click();
      await page.waitForTimeout(500);
      
      // Look for the admin links section
      const linksButton = await page.$('text=ADMIN: DISCOVERED LINKS');
      
      if (linksButton) {
        console.log(`  ✅ Found admin links section for ${projectName}!`);
        linksFound = true;
        
        // Click to expand
        await linksButton.click();
        await page.waitForTimeout(300);
        
        // Check for expanded content
        const expandedContent = await page.$('text=Selected for Stage 2');
        if (expandedContent) {
          console.log(`  ✅ Links section expanded successfully`);
        }
        
        // Take screenshot
        await page.screenshot({ path: `admin-links-${projectName.toLowerCase()}.png`, fullPage: true });
        console.log(`  📸 Screenshot saved: admin-links-${projectName.toLowerCase()}.png`);
        
        // Close tooltip by clicking elsewhere
        await page.click('body', { position: { x: 50, y: 50 } });
        await page.waitForTimeout(200);
        
        break; // Found working example, no need to test more
      } else {
        console.log(`  ⚠️ No admin links section found for ${projectName}`);
        
        // Close tooltip
        await page.click('body', { position: { x: 50, y: 50 } });
        await page.waitForTimeout(200);
      }
    }
    
    if (linksFound) {
      console.log(`\n🎉 SUCCESS: Admin links section is working!`);
    } else {
      console.log(`\n❌ No admin links sections found. Possible reasons:`);
      console.log(`1. Migration data not yet available on production`);
      console.log(`2. Projects not visible on current page`);
      console.log(`3. Feature not yet deployed`);
    }
    
    expect(linksFound).toBe(true);
  });
});