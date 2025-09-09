const { test } = require('@playwright/test');

test('Debug actual tokens and polling', async ({ page }) => {
  page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));
  
  await page.goto('https://coinairank.com');
  await page.waitForTimeout(2000);

  // First, let's see what tokens actually exist
  const existingTokens = await page.evaluate(async () => {
    try {
      const response = await fetch('/api/crypto-projects-rated?page=1&limit=10&sortBy=created_at&sortOrder=desc');
      const data = await response.json();
      
      return {
        success: true,
        tokens: data.projects?.slice(0, 5).map(p => ({
          id: p.id,
          symbol: p.symbol,
          network: p.network,
          website_url: p.website_url,
          extraction_status: p.extraction_status,
          comparison_status: p.comparison_status,
          website_stage1_score: p.website_stage1_score
        })) || []
      };
    } catch (error) {
      return { error: error.message };
    }
  });

  console.log('EXISTING TOKENS:', JSON.stringify(existingTokens, null, 2));

  if (existingTokens.tokens && existingTokens.tokens.length > 0) {
    const testToken = existingTokens.tokens[0];
    console.log(`\nTesting polling for token: ${testToken.symbol} (ID: ${testToken.id})`);
    
    // Test the exact polling mechanism the modal uses
    const pollingTest = await page.evaluate(async (tokenId) => {
      try {
        console.log(`Fetching project with ID: ${tokenId}`);
        const response = await fetch(`/api/crypto-projects-rated?id=${tokenId}`);
        console.log(`Response status: ${response.status}`);
        
        if (!response.ok) {
          return { error: `API returned ${response.status}` };
        }
        
        const data = await response.json();
        console.log('API response:', JSON.stringify(data, null, 2));
        
        const project = data.projects?.[0];
        
        if (!project) {
          return { 
            error: 'No project in response', 
            responseData: data,
            projectsLength: data.projects?.length || 0
          };
        }

        // Test the getProjectStatus logic inline
        const getStatus = (proj) => {
          if (!proj.website_url) {
            return { stage: 'website_discovery', progress: 10, message: 'Discovering project website...' };
          }
          if (!proj.extraction_status) {
            return { stage: 'scraping', progress: 25, message: 'Fetching website content...' };
          }
          if (proj.extraction_status === 'processing') {
            return { stage: 'ai_analysis', progress: 50, message: 'AI analyzing website content...' };
          }
          if (proj.extraction_status === 'completed' && proj.comparison_status === 'completed' && proj.website_stage1_score !== null) {
            return { stage: 'complete', progress: 100, message: `Analysis complete! Score: ${proj.website_stage1_score}/100` };
          }
          return { stage: 'processing', progress: 15, message: 'Processing...' };
        };

        const status = getStatus(project);
        
        return {
          success: true,
          project: {
            id: project.id,
            symbol: project.symbol,
            website_url: project.website_url,
            extraction_status: project.extraction_status,
            comparison_status: project.comparison_status,
            website_stage1_score: project.website_stage1_score
          },
          status: status
        };
      } catch (error) {
        return { error: error.message };
      }
    }, testToken.id);

    console.log('POLLING TEST RESULT:', JSON.stringify(pollingTest, null, 2));
    
    // Now let's simulate what happens in the AddTokenModal when BKN is submitted
    console.log('\n=== SIMULATING BKN SUBMISSION ===');
    const bknSimulation = await page.evaluate(async () => {
      try {
        // Simulate API call for BKN token
        const response = await fetch('/api/add-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contractAddress: '0x0000000000000000000000000000000000000000', // Placeholder
            network: 'ethereum'
          })
        });
        
        const data = await response.json();
        
        // This is what the modal receives
        return {
          apiResponse: {
            status: response.status,
            ok: response.ok,
            data: data
          },
          wouldShowProgressTracker: !response.ok && response.status === 409 && data.tokenId && data.symbol
        };
      } catch (error) {
        return { error: error.message };
      }
    });

    console.log('BKN SIMULATION:', JSON.stringify(bknSimulation, null, 2));
  }
});