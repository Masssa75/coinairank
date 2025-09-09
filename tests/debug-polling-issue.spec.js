const { test, expect } = require('@playwright/test');

test('Debug progress tracker polling issue', async ({ page }) => {
  page.on('console', msg => console.log(`CONSOLE: ${msg.text()}`));
  page.on('request', request => {
    if (request.url().includes('/api/crypto-projects-rated')) {
      console.log(`POLLING REQUEST: ${request.url()}`);
    }
  });
  page.on('response', response => {
    if (response.url().includes('/api/crypto-projects-rated')) {
      console.log(`POLLING RESPONSE: ${response.status()} ${response.url()}`);
    }
  });

  await page.goto('https://coinairank.com');
  await page.waitForTimeout(2000);

  // Test BKN token (from your screenshot) to see what's happening
  console.log('Testing BKN token status...');
  
  const bknTestResult = await page.evaluate(async () => {
    try {
      // First get the tokenId for BKN 
      const searchResponse = await fetch('/api/crypto-projects-rated?search=BKN&limit=5');
      const searchData = await searchResponse.json();
      const bknProject = searchData.projects?.find(p => p.symbol === 'BKN');
      
      if (!bknProject) {
        return { error: 'BKN project not found in search' };
      }
      
      console.log('Found BKN project:', bknProject.id, bknProject.symbol);
      
      // Now fetch the specific project by ID
      const projectResponse = await fetch(`/api/crypto-projects-rated?id=${bknProject.id}`);
      const projectData = await projectResponse.json();
      const project = projectData.projects?.[0];
      
      if (!project) {
        return { error: 'BKN project not found by ID', tokenId: bknProject.id };
      }
      
      return {
        tokenId: project.id,
        symbol: project.symbol,
        website_url: project.website_url,
        extraction_status: project.extraction_status,
        comparison_status: project.comparison_status,
        website_stage1_score: project.website_stage1_score,
        website_stage1_tier: project.website_stage1_tier,
        website_status: project.website_status,
        created_at: project.created_at,
        updated_at: project.updated_at
      };
    } catch (error) {
      return { error: error.message };
    }
  });

  console.log('BKN Project Status:', JSON.stringify(bknTestResult, null, 2));
  
  if (bknTestResult.tokenId) {
    // Test the progress status calculation
    const statusCalculation = await page.evaluate((project) => {
      // Inline the getProjectStatus function to test it
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

        // 1. Website Discovery
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

        // 2. Website Scraping Phase
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

        if (project.website_status === 'blocked') {
          return {
            stage: 'failed',
            progress: 25,
            message: 'Website blocks automated analysis',
            isComplete: false,
            hasError: true,
            errorMessage: 'Social media links cannot be analyzed automatically'
          };
        }

        if (project.website_status === 'dead') {
          return {
            stage: 'failed',
            progress: 25,
            message: 'Website is inactive',
            isComplete: false,
            hasError: true,
            errorMessage: 'Website appears to be a parking page or inactive'
          };
        }

        // If no extraction status yet, we're still scraping
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

        // 3. AI Analysis Phase
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

        if (project.extraction_status === 'failed') {
          return {
            stage: 'failed',
            progress: 50,
            message: 'AI analysis failed',
            isComplete: false,
            hasError: true,
            errorMessage: 'Unable to analyze website content'
          };
        }

        // 4. Benchmark Scoring Phase
        if (project.extraction_status === 'completed' && !project.comparison_status) {
          return {
            stage: 'benchmark_scoring',
            progress: 75,
            message: 'Comparing against quality benchmarks...',
            estimatedTimeRemaining: '30 seconds',
            isComplete: false,
            hasError: false
          };
        }

        if (project.comparison_status === 'processing') {
          return {
            stage: 'benchmark_scoring',
            progress: 85,
            message: 'Calculating final score...',
            estimatedTimeRemaining: '15 seconds',
            isComplete: false,
            hasError: false
          };
        }

        if (project.comparison_status === 'failed') {
          return {
            stage: 'failed',
            progress: 75,
            message: 'Scoring failed',
            isComplete: false,
            hasError: true,
            errorMessage: 'Unable to calculate quality score'
          };
        }

        // 5. Complete
        if (project.comparison_status === 'completed' && project.website_stage1_score !== null) {
          return {
            stage: 'complete',
            progress: 100,
            message: `Analysis complete! Score: ${project.website_stage1_score}/100 (${project.website_stage1_tier})`,
            isComplete: true,
            hasError: false
          };
        }

        // Fallback for unknown states
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
    }, bknTestResult);

    console.log('BKN Status Calculation:', JSON.stringify(statusCalculation, null, 2));
    
    // Check if the issue is with the polling or the status calculation
    if (statusCalculation.calculatedStatus.progress === 0) {
      console.log('❌ ISSUE: Progress calculation returning 0 - this would cause empty progress bar');
    } else {
      console.log('✅ Progress calculation looks correct');
    }
  }
});