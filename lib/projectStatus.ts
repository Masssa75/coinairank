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
  dbField?: string;
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
  // Only show REAL database-tracked steps for admin
  const stages: ProjectStage[] = [
    {
      id: 'website_discovery',
      name: 'Website Discovery',
      icon: '🔍',
      status: 'pending',
      estimatedDuration: '30-60s',
      dbField: 'website_url'
    },
    {
      id: 'website_scraping',
      name: 'Website Content Scraping',
      icon: '📄',
      status: 'pending',
      estimatedDuration: '1-2m',
      dbField: 'extraction_status'
    },
    {
      id: 'ai_analysis',
      name: 'AI Content Analysis',
      icon: '🧠',
      status: 'pending',
      estimatedDuration: '30-60s',
      dbField: 'extraction_status:processing'
    },
    {
      id: 'benchmark_scoring',
      name: 'Quality Benchmarking',
      icon: '⚖️',
      status: 'pending',
      estimatedDuration: '20-30s',
      dbField: 'comparison_status'
    },
    {
      id: 'score_finalization',
      name: 'Score & Tier Assignment',
      icon: '🏆',
      status: 'pending',
      estimatedDuration: '5-10s',
      dbField: 'website_stage1_score'
    },
    {
      id: 'complete',
      name: 'Analysis Complete',
      icon: '✅',
      status: 'pending',
      estimatedDuration: '',
      dbField: 'complete'
    }
  ];

  // Set stage status based on ACTUAL database fields
  if (status.hasError) {
    // Handle error states - mark current stage as failed based on actual progress
    if (progress <= 25) {
      stages[0].status = 'failed'; // Website discovery failed
    } else if (progress <= 50) {
      stages[0].status = 'complete';
      stages[1].status = 'failed'; // Scraping failed
    } else if (progress <= 75) {
      stages[0].status = 'complete';
      stages[1].status = 'complete'; 
      stages[2].status = 'failed'; // AI analysis failed
    } else {
      stages[0].status = 'complete';
      stages[1].status = 'complete';
      stages[2].status = 'complete';
      stages[3].status = 'failed'; // Benchmarking failed
    }
  } else {
    // Normal progression based on actual database field values
    
    // Stage 0: Website Discovery
    if (!project.website_url) {
      stages[0].status = 'in_progress';
    } else {
      stages[0].status = 'complete';
      
      // Stage 1: Website Scraping
      if (!project.extraction_status) {
        stages[1].status = 'in_progress';
      } else if (project.extraction_status === 'processing') {
        stages[1].status = 'complete';
        stages[2].status = 'in_progress'; // Stage 2: AI Analysis
      } else if (project.extraction_status === 'completed') {
        stages[1].status = 'complete';
        stages[2].status = 'complete';
        
        // Stage 3: Benchmark Scoring
        if (!project.comparison_status) {
          stages[3].status = 'in_progress';
        } else if (project.comparison_status === 'processing') {
          stages[3].status = 'in_progress';
        } else if (project.comparison_status === 'completed') {
          stages[3].status = 'complete';
          
          // Stage 4: Score Finalization
          if (project.website_stage1_score === null || project.website_stage1_score === undefined) {
            stages[4].status = 'in_progress';
          } else {
            stages[4].status = 'complete';
            stages[5].status = 'complete'; // Stage 5: Complete
          }
        }
      }
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