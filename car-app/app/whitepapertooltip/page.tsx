'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

interface WhitepaperStoryAnalysis {
  vision_story: string;
  innovation_story: string;
  market_story: string;
  team_story: string;
  decentralization_story: string;
  critical_flaw: string;
  risk_story: string;
  likely_outcome: string;
  content_breakdown: string;
  character_assessment: string;
  red_flags: string;
  simple_description: string;
  analysis_version: string;
  created_at: string;
}

interface Project {
  id: number;
  symbol: string;
  name: string;
  whitepaper_story_analysis: WhitepaperStoryAnalysis;
  whitepaper_url: string;
  rank?: number;
}

export default function WhitepaperRanking() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [rankingMode, setRankingMode] = useState<'view' | 'rank'>('view');

  useEffect(() => {
    async function fetchProjects() {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data, error } = await supabase
          .from('crypto_projects_rated')
          .select('id, symbol, name, whitepaper_story_analysis, whitepaper_url')
          .not('whitepaper_story_analysis', 'is', null)
          .order('symbol', { ascending: true });

        if (error) throw error;

        // Initialize with random ranking
        const projectsWithRank = (data || []).map((project, index) => ({
          ...project,
          rank: index + 1
        }));

        setProjects(projectsWithRank);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    fetchProjects();
  }, []);

  const moveProject = (projectId: number, direction: 'up' | 'down') => {
    setProjects(prev => {
      const newProjects = [...prev];
      const currentIndex = newProjects.findIndex(p => p.id === projectId);

      if (direction === 'up' && currentIndex > 0) {
        [newProjects[currentIndex], newProjects[currentIndex - 1]] =
        [newProjects[currentIndex - 1], newProjects[currentIndex]];
      } else if (direction === 'down' && currentIndex < newProjects.length - 1) {
        [newProjects[currentIndex], newProjects[currentIndex + 1]] =
        [newProjects[currentIndex + 1], newProjects[currentIndex]];
      }

      // Update ranks
      return newProjects.map((project, index) => ({
        ...project,
        rank: index + 1
      }));
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600">Loading whitepaper analyses...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl font-semibold mb-2 text-black">Error Loading Data</p>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-black mb-2">
                Whitepaper Ranking Benchmark
              </h1>
              <p className="text-gray-600">
                Rank whitepaper story analyses to create comparison benchmarks
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500">
                <strong className="text-black">{projects.length}</strong> projects
              </div>

              <button
                onClick={() => setRankingMode(rankingMode === 'view' ? 'rank' : 'view')}
                className="px-4 py-2 bg-black text-white text-sm rounded hover:bg-gray-800 transition-colors"
              >
                {rankingMode === 'view' ? 'Start Ranking' : 'View Mode'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Left: Project List */}
          <div className="w-1/2">
            <h2 className="text-lg font-semibold text-black mb-4">Project Rankings</h2>
            <div className="space-y-2">
              {projects.map((project) => (
                <ProjectRankItem
                  key={project.id}
                  project={project}
                  onSelect={() => setSelectedProject(project)}
                  onMove={moveProject}
                  isSelected={selectedProject?.id === project.id}
                  rankingMode={rankingMode}
                />
              ))}
            </div>
          </div>

          {/* Right: Analysis Detail */}
          <div className="w-1/2">
            {selectedProject ? (
              <StoryAnalysisDetail project={selectedProject} />
            ) : (
              <div className="border border-gray-200 rounded-lg p-8 text-center text-gray-500">
                <p>Select a project to view its whitepaper story analysis</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectRankItem({
  project,
  onSelect,
  onMove,
  isSelected,
  rankingMode
}: {
  project: Project;
  onSelect: () => void;
  onMove: (id: number, direction: 'up' | 'down') => void;
  isSelected: boolean;
  rankingMode: 'view' | 'rank';
}) {
  return (
    <div
      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
        isSelected
          ? 'border-black bg-gray-50'
          : 'border-gray-200 hover:border-gray-300'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-sm font-mono text-gray-500 w-6">
            #{project.rank}
          </div>
          <div>
            <div className="font-semibold text-black">
              {project.symbol}
            </div>
            <div className="text-sm text-gray-600">
              {project.name || 'Unknown'}
            </div>
          </div>
        </div>

        {rankingMode === 'rank' && (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMove(project.id, 'up');
              }}
              disabled={project.rank === 1}
              className="p-1 text-gray-400 hover:text-black disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ↑
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMove(project.id, 'down');
              }}
              className="p-1 text-gray-400 hover:text-black"
            >
              ↓
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StoryAnalysisDetail({ project }: { project: Project }) {
  const analysis = project.whitepaper_story_analysis;

  if (!analysis) {
    return (
      <div className="border border-gray-200 rounded-lg p-8 text-center text-gray-500">
        <p>No story analysis available for this project</p>
      </div>
    );
  }

  const sections = [
    { key: 'vision_story', title: 'Vision Story', content: analysis.vision_story },
    { key: 'innovation_story', title: 'Innovation Story', content: analysis.innovation_story },
    { key: 'market_story', title: 'Market Story', content: analysis.market_story },
    { key: 'team_story', title: 'Team Story', content: analysis.team_story },
    { key: 'decentralization_story', title: 'Decentralization Story', content: analysis.decentralization_story },
    { key: 'critical_flaw', title: 'Critical Flaw', content: analysis.critical_flaw },
    { key: 'risk_story', title: 'Risk Story', content: analysis.risk_story },
    { key: 'likely_outcome', title: 'Likely Outcome', content: analysis.likely_outcome },
    { key: 'character_assessment', title: 'Character Assessment', content: analysis.character_assessment },
    { key: 'red_flags', title: 'Red Flags', content: analysis.red_flags },
    { key: 'simple_description', title: 'Simple Description', content: analysis.simple_description }
  ].filter(section => section.content && section.content.trim().length > 0);

  return (
    <div className="border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-black">
              {project.symbol} - {project.name}
            </h3>
            <div className="text-sm text-gray-500">
              Analysis Version: {analysis.analysis_version || 'v4-sse'}
            </div>
          </div>

          {project.whitepaper_url && (
            <a
              href={project.whitepaper_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-600 hover:text-black"
            >
              View Whitepaper →
            </a>
          )}
        </div>
      </div>

      {/* Story Sections */}
      <div className="max-h-96 overflow-y-auto">
        <div className="p-4 space-y-4">
          {sections.map((section) => (
            <div key={section.key}>
              <h4 className="font-medium text-black mb-2 text-sm">
                {section.title}
              </h4>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">
                {section.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}