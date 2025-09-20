'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

interface WhitepaperAnalysis {
  content_breakdown: Record<string, number>;
  other_content_explanation?: string;
  character_assessment: string;
  key_insights: string[];
  red_flags: string[];
  green_flags: string[];
  kimi_verdict: string;
}

interface Project {
  symbol: string;
  name: string;
  whitepaper_analysis: WhitepaperAnalysis;
  whitepaper_analyzed_at: string;
  whitepaper_analysis_duration_ms: number;
  whitepaper_url: string;
}

export default function WhitepaperTooltip() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data, error } = await supabase
          .from('crypto_projects_rated')
          .select('symbol, name, whitepaper_analysis, whitepaper_analyzed_at, whitepaper_analysis_duration_ms, whitepaper_url')
          .not('whitepaper_analysis', 'is', null)
          .order('whitepaper_analyzed_at', { ascending: false });

        if (error) throw error;

        setProjects(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    fetchProjects();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading whitepaper analysis results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-red-600">
          <p className="text-xl font-semibold mb-2">Error Loading Data</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            🔍 Whitepaper Analysis Results
          </h1>
          <p className="text-lg text-gray-600 mb-6">
            AI-powered analysis of cryptocurrency whitepapers using Kimi K2
          </p>

          {/* Summary Stats */}
          <div className="flex justify-center gap-8 text-sm text-gray-500">
            <span>
              <strong className="text-gray-900">{projects.length}</strong> Projects Analyzed
            </span>
            <span>
              <strong className="text-gray-900">
                {Math.round(
                  projects
                    .filter(p => p.whitepaper_analysis_duration_ms)
                    .reduce((sum, p) => sum + p.whitepaper_analysis_duration_ms, 0) /
                  projects.filter(p => p.whitepaper_analysis_duration_ms).length / 1000
                )}s
              </strong> Average Duration
            </span>
            <span>
              <strong className="text-gray-900">
                {projects.length > 0 ? new Date(projects[0].whitepaper_analyzed_at).toLocaleDateString() : '-'}
              </strong> Last Updated
            </span>
          </div>
        </div>

        {/* Projects Grid */}
        <div className="space-y-8">
          {projects.map((project) => (
            <ProjectCard key={project.symbol} project={project} />
          ))}
        </div>

        {projects.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-500 text-lg">No whitepaper analysis results found.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const analysis = project.whitepaper_analysis;
  const duration = project.whitepaper_analysis_duration_ms
    ? Math.round(project.whitepaper_analysis_duration_ms / 1000)
    : null;

  // Sort content breakdown by percentage
  const sortedBreakdown = Object.entries(analysis.content_breakdown)
    .filter(([_, percentage]) => percentage > 0)
    .sort(([, a], [, b]) => b - a);

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6">
        <h2 className="text-2xl font-bold mb-2">
          {project.symbol} - {project.name}
        </h2>
        <div className="flex flex-wrap gap-4 text-sm opacity-90">
          <span>
            Analyzed: {new Date(project.whitepaper_analyzed_at).toLocaleString()}
          </span>
          {duration && <span>Duration: {duration}s</span>}
          {project.whitepaper_url && (
            <a
              href={project.whitepaper_url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              📄 View Whitepaper
            </a>
          )}
        </div>
      </div>

      <div className="p-6">
        {/* Content Breakdown */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            📊 Content Breakdown
          </h3>
          <div className="space-y-3">
            {sortedBreakdown.map(([category, percentage]) => (
              <div key={category} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-gray-700">
                      {category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                    <span className="font-bold text-blue-600">{percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {analysis.other_content_explanation && analysis.content_breakdown.other > 0 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Other content includes:</strong> {analysis.other_content_explanation}
              </p>
            </div>
          )}
        </div>

        {/* Character Assessment */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            🎭 Character Assessment
          </h3>
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
            <p className="text-gray-700 italic">{analysis.character_assessment}</p>
          </div>
        </div>

        {/* Insights Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Key Insights */}
          {analysis.key_insights && analysis.key_insights.length > 0 && (
            <div className="md:col-span-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                💡 Key Insights
              </h3>
              <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-lg">
                <ul className="space-y-2">
                  {analysis.key_insights.map((insight, index) => (
                    <li key={index} className="text-gray-700 flex items-start gap-2">
                      <span className="text-orange-500 font-bold mt-1">•</span>
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Red Flags */}
          {analysis.red_flags && analysis.red_flags.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                🚩 Red Flags
              </h3>
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
                <ul className="space-y-2">
                  {analysis.red_flags.map((flag, index) => (
                    <li key={index} className="text-gray-700 flex items-start gap-2">
                      <span className="text-red-500 font-bold mt-1">•</span>
                      <span>{flag}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Green Flags */}
          {analysis.green_flags && analysis.green_flags.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                ✅ Green Flags
              </h3>
              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
                <ul className="space-y-2">
                  {analysis.green_flags.map((flag, index) => (
                    <li key={index} className="text-gray-700 flex items-start gap-2">
                      <span className="text-green-500 font-bold mt-1">•</span>
                      <span>{flag}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Kimi Verdict */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            ⚖️ Kimi K2 Verdict
          </h3>
          <div className="bg-gray-800 text-white p-6 rounded-lg text-center">
            <p className="text-lg font-medium">{analysis.kimi_verdict}</p>
          </div>
        </div>
      </div>
    </div>
  );
}