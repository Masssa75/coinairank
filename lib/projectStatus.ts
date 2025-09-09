export interface ProjectStatus {
  stage: 'website_discovery' | 'scraping' | 'ai_analysis' | 'benchmark_scoring' | 'complete' | 'failed';
  progress: number; // 0-100
  message: string;
  estimatedTimeRemaining?: string;
  isComplete: boolean;
  hasError: boolean;
  errorMessage?: string;
}

export interface ProjectStage {
  id: string;
  name: string;
  icon: string;
  status: 'complete' | 'in_progress' | 'pending' | 'failed';
  estimatedDuration?: string;
}

export function getProjectStatus(project: any): ProjectStatus {
  // Handle case where project doesn't exist or is missing data
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

  // 1. Website Discovery (should be complete when tracker starts)
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
}

function getAdminProjectStages(project: any, status: ProjectStatus): ProjectStage[] {
  const stages: ProjectStage[] = [
    // Phase 1: Website Discovery & Validation (5-15%)
    {
      id: 'website_discovery',
      name: 'Website Discovery',
      icon: '🔍',
      status: 'pending',
      estimatedDuration: '10-30s'
    },
    {
      id: 'website_validation',
      name: 'Website Validation',
      icon: '✓',
      status: 'pending', 
      estimatedDuration: '5-10s'
    },
    
    // Phase 2: Content Scraping (15-40%) - Most time consuming
    {
      id: 'scraping_main_page',
      name: 'Scraping Main Page',
      icon: '📄',
      status: 'pending',
      estimatedDuration: '20-40s'
    },
    {
      id: 'scraping_docs',
      name: 'Scraping Documentation',
      icon: '📚',
      status: 'pending',
      estimatedDuration: '30-60s'
    },
    {
      id: 'scraping_social',
      name: 'Social Media Analysis',
      icon: '🔗',
      status: 'pending',
      estimatedDuration: '15-30s'
    },
    {
      id: 'content_extraction',
      name: 'Content Extraction & Cleaning',
      icon: '🧹',
      status: 'pending',
      estimatedDuration: '10-20s'
    },
    
    // Phase 3: AI Analysis (40-75%)
    {
      id: 'ai_preprocessing',
      name: 'AI Data Preprocessing',
      icon: '⚙️',
      status: 'pending',
      estimatedDuration: '10-15s'
    },
    {
      id: 'ai_technical_analysis',
      name: 'Technical Analysis',
      icon: '🔬',
      status: 'pending',
      estimatedDuration: '30-45s'
    },
    {
      id: 'ai_sentiment_analysis',
      name: 'Sentiment Analysis',
      icon: '💭',
      status: 'pending',
      estimatedDuration: '20-30s'
    },
    {
      id: 'ai_quality_assessment',
      name: 'Quality Assessment',
      icon: '📊',
      status: 'pending',
      estimatedDuration: '25-35s'
    },
    
    // Phase 4: Benchmarking & Scoring (75-95%)
    {
      id: 'benchmark_comparison',
      name: 'Benchmark Comparison',
      icon: '⚖️',
      status: 'pending',
      estimatedDuration: '15-20s'
    },
    {
      id: 'score_calculation',
      name: 'Score Calculation',
      icon: '🧮',
      status: 'pending',
      estimatedDuration: '5-10s'
    },
    {
      id: 'tier_assignment',
      name: 'Tier Assignment',
      icon: '🏆',
      status: 'pending',
      estimatedDuration: '3-5s'
    },
    
    // Phase 5: Finalization (95-100%)
    {
      id: 'data_validation',
      name: 'Data Validation',
      icon: '✅',
      status: 'pending',
      estimatedDuration: '5s'
    },
    {
      id: 'database_update',
      name: 'Database Update',
      icon: '💾',
      status: 'pending',
      estimatedDuration: '3-5s'
    },
    {
      id: 'complete',
      name: 'Analysis Complete',
      icon: '🎉',
      status: 'pending',
      estimatedDuration: ''
    }
  ];

  // Map the current status to detailed admin stages
  const progress = status.progress;
  let activeStageIndex = 0;

  if (progress >= 100) {
    // All complete
    stages.forEach(stage => stage.status = 'complete');
  } else if (status.hasError) {
    // Mark failed based on progress
    const failureIndex = Math.floor((progress / 100) * stages.length);
    stages.forEach((stage, index) => {
      if (index < failureIndex) stage.status = 'complete';
      else if (index === failureIndex) stage.status = 'failed';
      else stage.status = 'pending';
    });
  } else {
    // Normal progression
    activeStageIndex = Math.min(Math.floor((progress / 100) * stages.length), stages.length - 1);
    
    // Mark stages based on progress
    stages.forEach((stage, index) => {
      if (index < activeStageIndex) {
        stage.status = 'complete';
      } else if (index === activeStageIndex) {
        stage.status = 'in_progress';
      } else {
        stage.status = 'pending';
      }
    });
  }

  // Fine-tune based on known database fields
  if (!project.website_url && progress < 15) {
    // Still discovering website
    stages[0].status = 'in_progress';
  } else if (project.website_url && !project.extraction_status) {
    // In scraping phase 
    const scrapingStages = stages.slice(2, 6); // Main page through content extraction
    const scrapingProgress = Math.min(Math.max(progress - 15, 0) / 25, 1); // 15-40% range
    const activeScrapingIndex = Math.floor(scrapingProgress * scrapingStages.length);
    
    stages[0].status = 'complete'; // Website discovery done
    stages[1].status = 'complete'; // Website validation done
    
    scrapingStages.forEach((stage, index) => {
      if (index < activeScrapingIndex) stage.status = 'complete';
      else if (index === activeScrapingIndex) stage.status = 'in_progress';
      else stage.status = 'pending';
    });
  } else if (project.extraction_status === 'processing') {
    // AI analysis phase
    const aiStart = 6;
    const aiEnd = 10;
    const aiProgress = Math.min(Math.max(progress - 40, 0) / 35, 1); // 40-75% range
    const activeAiIndex = Math.floor(aiProgress * (aiEnd - aiStart)) + aiStart;
    
    // Mark previous stages complete
    for (let i = 0; i < aiStart; i++) {
      stages[i].status = 'complete';
    }
    
    // Mark AI stages
    for (let i = aiStart; i < aiEnd; i++) {
      if (i < activeAiIndex) stages[i].status = 'complete';
      else if (i === activeAiIndex) stages[i].status = 'in_progress';
      else stages[i].status = 'pending';
    }
  }

  return stages;
}

export function getProjectStages(project: any, isAdmin: boolean = false): ProjectStage[] {
  const status = getProjectStatus(project);
  
  // Admin gets much more granular stages
  if (isAdmin) {
    return getAdminProjectStages(project, status);
  }
  
  const stages: ProjectStage[] = [
    {
      id: 'scraping',
      name: 'Website Scraping',
      icon: '🌐',
      status: 'pending',
      estimatedDuration: '30-60s'
    },
    {
      id: 'ai_analysis',
      name: 'AI Analysis',
      icon: '🧠',
      status: 'pending',
      estimatedDuration: '1-2m'
    },
    {
      id: 'benchmark_scoring',
      name: 'Quality Scoring',
      icon: '⚖️',
      status: 'pending',
      estimatedDuration: '30s'
    },
    {
      id: 'complete',
      name: 'Ready for Viewing',
      icon: '✅',
      status: 'pending',
      estimatedDuration: ''
    }
  ];

  // Update stage statuses based on current progress
  switch (status.stage) {
    case 'scraping':
      stages[0].status = 'in_progress';
      break;
    case 'ai_analysis':
      stages[0].status = 'complete';
      stages[1].status = 'in_progress';
      break;
    case 'benchmark_scoring':
      stages[0].status = 'complete';
      stages[1].status = 'complete';
      stages[2].status = 'in_progress';
      break;
    case 'complete':
      stages.forEach(stage => stage.status = 'complete');
      break;
    case 'failed':
      // Mark current and future stages as failed/pending
      const currentIndex = stages.findIndex(s => 
        s.id === (status.progress <= 25 ? 'scraping' : 
                 status.progress <= 50 ? 'ai_analysis' : 'benchmark_scoring')
      );
      stages.forEach((stage, index) => {
        if (index < currentIndex) stage.status = 'complete';
        else if (index === currentIndex) stage.status = 'failed';
        else stage.status = 'pending';
      });
      break;
  }

  return stages;
}