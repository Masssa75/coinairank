'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { X } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface WhitepaperStoryAnalysis {
  simple_description?: string;
  vision_story?: string;
  innovation_story?: string;
  market_story?: string;
  team_story?: string;
  decentralization_story?: string;
  critical_flaw?: string;
  risk_story?: string;
  likely_outcome?: string;
  content_breakdown?: string;
  character_assessment?: string;
  red_flags?: string;
}

interface Project {
  symbol: string;
  name: string;
  whitepaper_story_analysis?: WhitepaperStoryAnalysis;
}

export default function ProjectDetailPage({ params }: { params: Promise<{ symbol: string }> }) {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [symbol, setSymbol] = useState<string>('');

  useEffect(() => {
    params.then(p => {
      setSymbol(p.symbol);
    });
  }, [params]);

  useEffect(() => {
    if (symbol) {
      fetchProject();
    }
  }, [symbol]);

  async function fetchProject() {
    try {
      const { data, error } = await supabase
        .from('crypto_projects_rated')
        .select('symbol, name, whitepaper_story_analysis')
        .eq('symbol', symbol.toUpperCase())
        .single();

      if (error) throw error;
      setProject(data);
    } catch (error) {
      console.error('Error fetching project:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-400">Loading project details...</div>
      </div>
    );
  }

  if (!project || !project.whitepaper_story_analysis) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-600 text-lg mb-4">No whitepaper analysis available</div>
          <button
            onClick={() => router.push('/rank')}
            className="text-emerald-500 hover:underline"
          >
            ← Back to rankings
          </button>
        </div>
      </div>
    );
  }

  const analysis = project.whitepaper_story_analysis;

  const sections = [
    { title: 'Simple Description', content: analysis.simple_description },
    { title: 'Vision', content: analysis.vision_story },
    { title: 'Innovation', content: analysis.innovation_story },
    { title: 'Market', content: analysis.market_story },
    { title: 'Team', content: analysis.team_story },
    { title: 'Decentralization', content: analysis.decentralization_story },
    { title: 'Critical Flaw', content: analysis.critical_flaw },
    { title: 'Risk', content: analysis.risk_story },
    { title: 'Likely Outcome', content: analysis.likely_outcome },
    { title: 'Content Breakdown', content: analysis.content_breakdown },
    { title: 'Character Assessment', content: analysis.character_assessment },
    { title: 'Red Flags', content: analysis.red_flags },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
        <div className="flex justify-between items-center px-5 py-4">
          <div>
            <div className="text-xl font-extrabold">{project.symbol}</div>
            <div className="text-sm text-gray-400">{project.name}</div>
          </div>
          <button
            onClick={() => router.push('/rank')}
            className="w-9 h-9 flex items-center justify-center bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-5 py-8">
        {sections.map((section, index) => (
          section.content && (
            <div key={index} className="mb-8">
              <h2 className="text-lg font-bold text-gray-900 mb-3">{section.title}</h2>
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                {section.content}
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
