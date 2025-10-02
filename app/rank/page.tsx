'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Zap, Filter, Menu, Plus } from 'lucide-react';
import ProgressRing from '@/components/rank/ProgressRing';
import { SignalBasedTooltip } from '@/components/SignalBasedTooltip';
import { WhitepaperTooltip } from '@/components/WhitepaperTooltip';
import { RankAddTokenModal } from '@/components/RankAddTokenModal';
import RankSearchInput from '@/components/rank/RankSearchInput';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Project {
  symbol: string;
  name: string;
  project_age_years: number | null;
  current_market_cap: number | null;
  website_stage1_tier: 'ALPHA' | 'SOLID' | 'BASIC' | 'TRASH' | null;
  whitepaper_tier: 'ALPHA' | 'SOLID' | 'BASIC' | 'TRASH' | null;
}

type SortColumn = 'name' | 'project_age_years' | 'current_market_cap' | 'website_stage1_tier' | 'whitepaper_tier';
type SortDirection = 'asc' | 'desc';

export default function RankPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortColumn, setSortColumn] = useState<SortColumn>('current_market_cap');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [hotPicksActive, setHotPicksActive] = useState(false);
  const [showAddTokenModal, setShowAddTokenModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    try {
      const { data, error } = await supabase
        .from('crypto_projects_rated')
        .select('symbol, name, project_age_years, current_market_cap, website_stage1_tier, whitepaper_tier')
        .order('current_market_cap', { ascending: false, nullsFirst: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
    setHotPicksActive(false);
  }

  function calculateHotPicksScore(project: Project): number {
    const tierScores: Record<string, number> = {
      ALPHA: 100,
      SOLID: 70,
      BASIC: 40,
      TRASH: 0,
    };

    const webScore = tierScores[project.website_stage1_tier || 'TRASH'] * 0.35;
    const wpScore = tierScores[project.whitepaper_tier || 'TRASH'] * 0.35;

    // Age score (younger is better)
    const ageYears = project.project_age_years || 10;
    let ageScore = 0;
    if (ageYears < 0.5) ageScore = 100;
    else if (ageYears < 1) ageScore = 80;
    else if (ageYears < 2) ageScore = 60;
    else if (ageYears < 3) ageScore = 40;
    else if (ageYears < 4) ageScore = 20;
    ageScore *= 0.15;

    // MCap score (lower is better)
    const mcap = project.current_market_cap || 10000000000;
    let mcapScore = 0;
    if (mcap < 1000000) mcapScore = 100;
    else if (mcap < 10000000) mcapScore = 85;
    else if (mcap < 50000000) mcapScore = 70;
    else if (mcap < 100000000) mcapScore = 55;
    else if (mcap < 500000000) mcapScore = 40;
    else if (mcap < 1000000000) mcapScore = 25;
    else if (mcap < 5000000000) mcapScore = 10;
    mcapScore *= 0.15;

    return webScore + wpScore + ageScore + mcapScore;
  }

  function toggleHotPicks() {
    setHotPicksActive(!hotPicksActive);
  }

  const filteredProjects = projects.filter((project) => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    const symbol = project.symbol?.toLowerCase() || '';
    const name = project.name?.toLowerCase() || '';

    return symbol.includes(query) || name.includes(query);
  });

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    if (hotPicksActive) {
      return calculateHotPicksScore(b) - calculateHotPicksScore(a);
    }

    const aValue = a[sortColumn];
    const bValue = b[sortColumn];

    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;

    if (sortDirection === 'asc') {
      return aValue < bValue ? -1 : 1;
    } else {
      return aValue > bValue ? -1 : 1;
    }
  });

  function formatAge(years: number | null): string {
    if (!years) return '—';
    return `${years.toFixed(1)}y`;
  }

  function formatMcap(mcap: number | null): string {
    if (!mcap) return '—';
    if (mcap >= 1000000000) return `$${(mcap / 1000000000).toFixed(1)}B`;
    if (mcap >= 1000000) return `$${(mcap / 1000000).toFixed(0)}M`;
    return `$${(mcap / 1000).toFixed(0)}K`;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
        <div className="flex justify-between items-center px-5 py-4">
          <div className="text-xl font-extrabold">
            Coin<span className="text-emerald-500">Ai</span>Rank
          </div>
          <div className="flex gap-3">
            <RankSearchInput onSearch={setSearchQuery} placeholder="Search symbol or name..." />
            <button
              onClick={toggleHotPicks}
              className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${
                hotPicksActive
                  ? 'bg-gradient-to-br from-yellow-300 to-orange-500'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <Zap
                className={`w-5 h-5 ${hotPicksActive ? 'text-white' : 'text-gray-600'}`}
                strokeWidth={hotPicksActive ? 2.5 : 2}
              />
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="w-9 h-9 flex items-center justify-center bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              <Filter className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="w-9 h-9 flex items-center justify-center bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              <Menu className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Menu Dropdown */}
        {showMenu && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
            <div className="absolute top-16 right-5 z-40 bg-white border border-gray-200 rounded-lg shadow-lg w-48">
              <button
                onClick={() => {
                  setShowMenu(false);
                  setShowAddTokenModal(true);
                }}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-2 text-gray-900"
              >
                <Plus className="w-4 h-4" />
                Submit Project
              </button>
            </div>
          </>
        )}
      </div>

      {/* List Header */}
      <div className="sticky top-14 z-10 grid grid-cols-[2fr_0.8fr_1fr_0.7fr_0.7fr] gap-2 px-5 py-3.5 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-400 uppercase tracking-wider">
        <div onClick={() => handleSort('name')} className="cursor-pointer flex items-center gap-1">
          Project {sortColumn === 'name' && <span className="text-emerald-500">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
        </div>
        <div onClick={() => handleSort('project_age_years')} className="cursor-pointer flex items-center gap-1">
          Age {sortColumn === 'project_age_years' && <span className="text-emerald-500">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
        </div>
        <div onClick={() => handleSort('current_market_cap')} className="cursor-pointer flex items-center gap-1">
          MCap {!hotPicksActive && sortColumn === 'current_market_cap' && <span className="text-emerald-500">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
        </div>
        <div className="text-center">Web</div>
        <div className="text-center">WP</div>
      </div>

      {/* Projects List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400">Loading projects...</div>
        </div>
      ) : (
        <div>
          {sortedProjects.map((project) => (
            <div
              key={project.symbol}
              className="grid grid-cols-[2fr_0.8fr_1fr_0.7fr_0.7fr] gap-2 px-5 py-5 border-b border-gray-100 items-center hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => router.push(`/rank/${project.symbol}`)}
            >
              <div>
                <div className="font-bold text-base">{project.symbol}</div>
                <div className="text-sm text-gray-400">{project.name}</div>
              </div>
              <div className="text-sm text-gray-600 font-medium">{formatAge(project.project_age_years)}</div>
              <div className="text-sm text-gray-600 font-medium">{formatMcap(project.current_market_cap)}</div>
              <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                {project.website_stage1_tier && (
                  <SignalBasedTooltip
                    projectSymbol={project.symbol}
                    isAdmin={false}
                  >
                    <ProgressRing tier={project.website_stage1_tier} />
                  </SignalBasedTooltip>
                )}
              </div>
              <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                {project.whitepaper_tier && (
                  <WhitepaperTooltip
                    projectSymbol={project.symbol}
                    whitepaperTier={project.whitepaper_tier}
                  >
                    <ProgressRing tier={project.whitepaper_tier} />
                  </WhitepaperTooltip>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Token Modal */}
      <RankAddTokenModal
        isOpen={showAddTokenModal}
        onClose={() => setShowAddTokenModal(false)}
        onSuccess={() => {
          fetchProjects();
        }}
      />
    </div>
  );
}
