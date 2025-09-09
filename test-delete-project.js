const { chromium } = require('playwright');

async function testDeleteProject() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('🎭 Starting delete project test...');
    
    // Navigate to the site
    await page.goto('https://coinairank.com');
    await page.waitForLoadState('networkidle');

    // Check if admin button exists and click it
    console.log('🔍 Looking for admin access...');
    
    // Try multiple selectors for the admin button
    let adminButton = page.locator('text=Admin').first();
    if (!(await adminButton.isVisible({ timeout: 3000 }))) {
      adminButton = page.locator('[class*="admin"]').first();
    }
    if (!(await adminButton.isVisible({ timeout: 3000 }))) {
      adminButton = page.locator('button:has-text("Admin")').first();
    }
    if (!(await adminButton.isVisible({ timeout: 3000 }))) {
      // Look for the green admin badge
      adminButton = page.locator('.bg-green-500, .bg-\\[\\#00ff88\\]').first();
    }
    
    if (await adminButton.isVisible()) {
      console.log('✅ Admin button found, clicking...');
      await adminButton.click();
    } else {
      console.log('❌ Admin button not found, checking page content...');
      const pageContent = await page.content();
      console.log('Page title:', await page.title());
      console.log('URL:', page.url());
      console.log('Looking for admin-related text...');
      
      // Check if already in admin mode
      if (pageContent.includes('Admin') || pageContent.includes('admin')) {
        console.log('✅ Already in admin mode, continuing...');
      } else {
        console.log('❌ No admin access found');
        return;
      }
    }

    // Wait for password prompt and enter password
    console.log('🔍 Looking for password field...');
    try {
      await page.waitForSelector('input[type="password"]', { timeout: 5000 });
      console.log('✅ Password field found, entering password...');
      await page.fill('input[type="password"]', 'donkey');
      await page.press('input[type="password"]', 'Enter');
    } catch (error) {
      console.log('❌ No password field found, checking if already authenticated...');
      
      // Check if we're already in admin mode by looking for admin features
      const has3DotMenu = await page.locator('button:has(svg.lucide-more-vertical)').count() > 0;
      if (has3DotMenu) {
        console.log('✅ Already authenticated - 3-dot menus are visible');
      } else {
        console.log('❌ Not authenticated and no password field - checking page state...');
        console.log('Current URL:', page.url());
        const pageContent = await page.content();
        console.log('Page contains "password":', pageContent.includes('password'));
        console.log('Page contains "Admin":', pageContent.includes('Admin'));
        return;
      }
    }
    
    // Wait for admin authentication
    await page.waitForTimeout(2000);

    // Look for BKN project
    console.log('🔍 Looking for BKN project...');
    const bknProject = page.locator('[data-testid="project-card"]:has-text("BKN")').first();
    
    if (!(await bknProject.isVisible())) {
      console.log('❌ BKN project not found, looking for any project with 3-dot menu...');
      
      // Find any project with a 3-dot menu
      const anyProject = page.locator('button:has(svg.lucide-more-vertical)').first();
      if (await anyProject.isVisible()) {
        console.log('✅ Found project with 3-dot menu, clicking...');
        await anyProject.click();
      } else {
        console.log('❌ No 3-dot menu found');
        return;
      }
    } else {
      console.log('✅ BKN project found, looking for 3-dot menu...');
      // Find the 3-dot menu button within the BKN project
      const moreButton = bknProject.locator('button:has(svg.lucide-more-vertical)');
      await moreButton.click();
    }

    // Wait for dropdown menu to appear
    await page.waitForTimeout(1000);
    console.log('✅ 3-dot menu clicked, looking for Remove Project option...');

    // Look for the Remove Project button
    const removeButton = page.locator('button:has-text("Remove Project")');
    if (await removeButton.isVisible()) {
      console.log('✅ Remove Project button found, clicking...');
      
      // Set up network request monitoring
      let deleteRequest = null;
      let deleteResponse = null;
      
      page.on('request', request => {
        if (request.url().includes('/api/admin/delete-project')) {
          deleteRequest = request;
          console.log('📡 DELETE request intercepted:', request.method(), request.url());
          console.log('📡 Request headers:', request.headers());
          console.log('📡 Request body:', request.postDataJSON());
        }
      });

      page.on('response', response => {
        if (response.url().includes('/api/admin/delete-project')) {
          deleteResponse = response;
          console.log('📡 DELETE response intercepted:', response.status(), response.statusText());
        }
      });

      // Click Remove Project button
      await removeButton.click();

      // Handle the confirmation dialog
      page.on('dialog', async dialog => {
        console.log('✅ Confirmation dialog appeared:', dialog.message());
        await dialog.accept(); // Click OK to confirm deletion
      });

      // Wait for the request to complete
      await page.waitForTimeout(3000);

      // Check for success/error toast messages
      const toast = page.locator('[class*="toast"], [class*="notification"], .fixed.top-4.right-4');
      if (await toast.isVisible()) {
        const toastText = await toast.textContent();
        console.log('📢 Toast message:', toastText);
      }

      // Check the response details
      if (deleteResponse) {
        const responseText = await deleteResponse.text();
        console.log('📡 Response body:', responseText);
        console.log('📡 Response status:', deleteResponse.status());
      }

      if (deleteRequest) {
        console.log('✅ DELETE request was made successfully');
      } else {
        console.log('❌ DELETE request was not made');
      }

    } else {
      console.log('❌ Remove Project button not found');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

testDeleteProject();