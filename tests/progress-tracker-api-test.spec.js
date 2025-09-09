const { test, expect } = require('@playwright/test');

test.describe('Progress Tracker API Test', () => {
  test('Test submit token API and progress tracking directly', async ({ page }) => {
    // Enable detailed logging
    page.on('console', msg => console.log(`CONSOLE: ${msg.text()}`));
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        console.log(`API: ${response.status()} ${response.url()}`);
      }
    });

    // Go to the site
    await page.goto('https://coinairank.com');
    await page.waitForTimeout(3000);

    // Test the API directly by executing JavaScript on the page
    console.log('Testing Add Token API directly...');
    
    const apiTestResult = await page.evaluate(async () => {
      try {
        // Test with VIRTUAL token on Ethereum
        const response = await fetch('/api/add-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contractAddress: '0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b',
            network: 'ethereum'
          })
        });

        const data = await response.json();
        
        return {
          status: response.status,
          ok: response.ok,
          data: data,
          hasTokenId: !!data.tokenId,
          hasSymbol: !!data.symbol
        };
      } catch (error) {
        return {
          error: error.message,
          status: 'fetch_failed'
        };
      }
    });

    console.log('API Test Result:', JSON.stringify(apiTestResult, null, 2));

    if (apiTestResult.hasTokenId) {
      console.log('✅ API returned tokenId - testing progress tracker...');
      
      // Test the progress tracker API
      const progressTestResult = await page.evaluate(async (tokenId) => {
        try {
          const response = await fetch(`/api/crypto-projects-rated?id=${tokenId}`);
          const data = await response.json();
          
          return {
            status: response.status,
            project: data.projects?.[0] || null,
            hasProject: !!data.projects?.[0]
          };
        } catch (error) {
          return {
            error: error.message
          };
        }
      }, apiTestResult.data.tokenId);

      console.log('Progress API Result:', JSON.stringify(progressTestResult, null, 2));
      
      if (progressTestResult.hasProject) {
        // Test the progress status logic
        const statusResult = await page.evaluate(async (project) => {
          // Import the project status logic (we'll need to inline it)
          const getProjectStatus = (project) => {
            if (!project) {
              return {
                stage: 'website_discovery',
                progress: 0,
                message: 'Project not found',
                isComplete: false,
                hasError: true,
                errorMessage: 'Project data not available'
              };
            }

            if (!project.website_url) {
              return {
                stage: 'website_discovery',
                progress: 10,
                message: 'Discovering project website...',
                estimatedTimeRemaining: '1-2 minutes',
                isComplete: false,
                hasError: false
              };
            }

            if (project.website_status === 'scrape_error') {
              return {
                stage: 'failed',
                progress: 25,
                message: 'Website scraping failed',
                isComplete: false,
                hasError: true,
                errorMessage: 'Unable to access website for analysis'
              };
            }

            if (!project.extraction_status && project.website_url) {
              return {
                stage: 'scraping',
                progress: 25,
                message: 'Fetching website content...',
                estimatedTimeRemaining: '30-60 seconds',
                isComplete: false,
                hasError: false
              };
            }

            if (project.extraction_status === 'processing') {
              return {
                stage: 'ai_analysis',
                progress: 50,
                message: 'AI analyzing website content...',
                estimatedTimeRemaining: '1-2 minutes',
                isComplete: false,
                hasError: false
              };
            }

            if (project.extraction_status === 'completed' && project.comparison_status === 'completed' && project.website_stage1_score !== null) {
              return {
                stage: 'complete',
                progress: 100,
                message: `Analysis complete! Score: ${project.website_stage1_score}/100 (${project.website_stage1_tier})`,
                isComplete: true,
                hasError: false
              };
            }

            return {
              stage: 'scraping',
              progress: 15,
              message: 'Processing...',
              estimatedTimeRemaining: '2-3 minutes',
              isComplete: false,
              hasError: false
            };
          };

          const status = getProjectStatus(project);
          return {
            projectFields: {
              website_url: project.website_url,
              extraction_status: project.extraction_status,
              comparison_status: project.comparison_status,
              website_stage1_score: project.website_stage1_score,
              website_stage1_tier: project.website_stage1_tier,
              website_status: project.website_status
            },
            calculatedStatus: status
          };
        }, progressTestResult.project);

        console.log('Status Calculation Result:', JSON.stringify(statusResult, null, 2));
      }
      
    } else {
      console.log('❌ API did not return tokenId');
      console.log('Response details:', apiTestResult);
    }

    // Test if the modal would actually appear by simulating the exact flow
    const modalTestResult = await page.evaluate(async () => {
      // Simulate what happens when AddTokenModal gets a successful API response
      const mockApiResponse = {
        success: true,
        tokenId: 123,
        symbol: 'VIRTUAL',
        message: 'Token added successfully!'
      };

      // This simulates the condition in AddTokenModal.tsx line 179-192
      const wouldShowProgressTracker = !!(mockApiResponse.tokenId && mockApiResponse.symbol);
      
      return {
        wouldShowProgressTracker,
        conditionMet: `tokenId: ${!!mockApiResponse.tokenId}, symbol: ${!!mockApiResponse.symbol}`
      };
    });

    console.log('Modal Logic Test:', JSON.stringify(modalTestResult, null, 2));

    // Take a screenshot for reference
    await page.screenshot({ path: 'api-test-result.png', fullPage: true });
  });
});