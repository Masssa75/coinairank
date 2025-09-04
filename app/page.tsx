'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { WebsiteAnalysisTooltip } from '@/components/WebsiteAnalysisTooltip';
import FilterSidebar from '@/components/FilterSidebar';
import { AddTokenModal } from '@/components/AddTokenModal';
import SearchInput from '@/components/SearchInput';
import { useDebounce } from '@/lib/useDebounce';
import { Settings, Menu, ChevronDown, ChevronUp, Shield, FileCode2, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface CryptoProject {
  id: number;
  symbol: string;
  name: string;
  network: string;
  contract_address: string;
  website_url: string;
  website_screenshot_url: string | null;
  website_stage1_score: number;
  website_stage1_tier: string;
  website_stage1_analysis: Record<string, unknown>;
  website_stage1_tooltip?: {
    one_liner: string;
    pros: string[];
    cons: string[];
  };
  website_stage2_resources?: Record<string, unknown>;
  website_stage1_analyzed_at: string;
  current_liquidity_usd: number | null;
  current_market_cap: number | null;
  current_price_usd: number | null;
  roi_percent: number | null;  // Changed from current_roi_percent
  initial_liquidity_usd?: number | null;  // Added fallback field
  initial_market_cap?: number | null;  // Added fallback field
  is_imposter?: boolean;  // Optional - CAR doesn't have these yet
  is_rugged?: boolean;
  is_dead?: boolean;
  contract_verification?: {
    found_on_site: boolean;
    confidence: 'high' | 'medium' | 'low';
    note?: string;
  };
  twitter_url: string | null;
  telegram_url: string | null;
  created_at: string;
  
  // Add X analysis fields
  x_analysis_score?: number;
  x_analysis_tier?: string;
  analysis_token_type?: string; // For token type filtering
  token_type?: string; // Add token_type field
}

interface FilterState {
  tokenType: 'all' | 'meme' | 'utility'
  networks: string[]
  excludeRugs?: boolean
  excludeImposters?: boolean
  minXScore?: number
  minWebsiteScore?: number
}

export default function ProjectsRatedPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<CryptoProject[]>([]);  
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAddTokenModalOpen, setIsAddTokenModalOpen] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    tokenType: 'all',
    networks: ['ethereum', 'solana', 'bsc', 'base', 'pulsechain'],
    excludeRugs: false,  // CAR doesn't have these columns yet
    excludeImposters: false,
    minWebsiteScore: 1
  });
  
  // Debounce filters with 400ms delay
  const debouncedFilters = useDebounce(filters, 400);
  
  const [capturingScreenshots, setCapturingScreenshots] = useState<Set<number>>(new Set());
  const [attemptedScreenshots, setAttemptedScreenshots] = useState<Set<number>>(() => {
    // Initialize from sessionStorage on mount
    if (typeof window !== 'undefined') {
      const attempted = new Set<number>();
      const now = Date.now();
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('screenshot_attempt_')) {
          const id = parseInt(key.replace('screenshot_attempt_', ''));
          const timestamp = parseInt(sessionStorage.getItem(key) || '0');
          // Only include if attempted within last 5 minutes
          if (now - timestamp < 5 * 60 * 1000) {
            attempted.add(id);
          }
        }
      }
      return attempted;
    }
    return new Set();
  });
  
  const observer = useRef<IntersectionObserver | null>(null);
  
  // Check admin authentication on mount
  useEffect(() => {
    checkAdminAuth();
  }, []);
  
  const checkAdminAuth = async () => {
    try {
      const response = await fetch('/api/admin/auth');
      const data = await response.json();
      setIsAdmin(data.authenticated);
    } catch (err) {
      console.error('Auth check failed:', err);
      setIsAdmin(false);
    } finally {
      setCheckingAuth(false);
    }
  };
  
  const handleLogout = async () => {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    setIsAdmin(false);
    setIsMenuOpen(false);
    router.refresh();
  };
  const lastProjectRef = useCallback((node: HTMLDivElement | null) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  // Fetch projects
  const fetchProjects = useCallback(async (pageNum: number, reset: boolean = false) => {
    if (loading) return;
    setLoading(true);

    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '12',
        sortBy,
        sortOrder,
        search: searchQuery,
      });
      
      // Add filter parameters
      if (debouncedFilters.tokenType && debouncedFilters.tokenType !== 'all') {
        params.append('tokenType', debouncedFilters.tokenType);
      }
      
      if (debouncedFilters.networks && debouncedFilters.networks.length > 0) {
        params.append('networks', debouncedFilters.networks.join(','));
      }
      
      if (debouncedFilters.excludeRugs === false) {
        params.append('includeRugs', 'true');
      }
      
      if (debouncedFilters.excludeImposters === false) {
        params.append('includeImposters', 'true');
      }
      
      if (debouncedFilters.minWebsiteScore && debouncedFilters.minWebsiteScore > 1) {
        // Convert website score from 1-10 scale to 0-100 scale for API
        const apiScore = (debouncedFilters.minWebsiteScore - 1) * 10;
        params.append('minScore', apiScore.toString());
      }

      const response = await fetch(`/api/crypto-projects-rated?${params}`);
      const data = await response.json();

      if (data.data) {
        if (reset) {
          setProjects(data.data);
        } else {
          // Filter out any duplicates when appending
          setProjects(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const newProjects = data.data.filter((p: CryptoProject) => !existingIds.has(p.id));
            return [...prev, ...newProjects];
          });
        }
        setHasMore(data.pagination.hasMore);
        
        // Trigger screenshot capture for projects without screenshots
        data.data.forEach(async (project: CryptoProject) => {
          if (!project.website_screenshot_url && project.website_url) {
            // Skip if already attempted recently
            if (attemptedScreenshots.has(project.id)) {
              return;
            }
            
            const attemptKey = `screenshot_attempt_${project.id}`;
            const now = Date.now();
            
            // Mark as capturing
            setCapturingScreenshots(prev => new Set(prev).add(project.id));
            
            try {
              const captureResponse = await fetch('/api/capture-screenshot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  url: project.website_url,
                  tokenId: project.id,
                  table: 'crypto_projects_rated',
                  forceRefresh: false
                })
              });
              
              if (captureResponse.ok) {
                const result = await captureResponse.json();
                // Update the project with the new screenshot URL
                setProjects(prev => prev.map(p => 
                  p.id === project.id 
                    ? { ...p, website_screenshot_url: result.screenshot_url }
                    : p
                ));
              } else {
                // Store failed attempt timestamp and add to attempted set
                sessionStorage.setItem(attemptKey, now.toString());
                setAttemptedScreenshots(prev => new Set(prev).add(project.id));
                const error = await captureResponse.text();
                console.warn(`Screenshot capture failed for ${project.symbol}:`, error);
              }
            } catch (err) {
              // Store failed attempt timestamp and add to attempted set
              sessionStorage.setItem(attemptKey, now.toString());
              setAttemptedScreenshots(prev => new Set(prev).add(project.id));
              console.error(`Failed to capture screenshot for ${project.symbol}:`, err);
            } finally {
              // Remove from capturing set
              setCapturingScreenshots(prev => {
                const newSet = new Set(prev);
                newSet.delete(project.id);
                return newSet;
              });
            }
          }
        });
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  }, [sortBy, sortOrder, searchQuery, debouncedFilters, loading, attemptedScreenshots]);

  // Reset and fetch when filters change
  useEffect(() => {
    setProjects([]);
    setPage(1);
    setHasMore(true);
    fetchProjects(1, true);
  }, [sortBy, sortOrder, searchQuery, debouncedFilters]);

  // Fetch more when page changes
  useEffect(() => {
    if (page > 1) {
      fetchProjects(page);
    }
  }, [page]);

  // Format functions
  const formatMarketCap = (value: number | null | undefined) => {
    if (!value) return 'N/A';
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  };

  const getTierColor = (tier: string | null | undefined) => {
    if (!tier) return { bg: '#88888822', text: '#888' };
    
    const colors: { [key: string]: { bg: string, text: string } } = {
      ALPHA: { bg: '#00ff8822', text: '#00ff88' },  // Green for ALPHA
      SOLID: { bg: '#ffcc0022', text: '#ffcc00' },  // Yellow for SOLID
      BASIC: { bg: '#ff880022', text: '#ff8800' },  // Orange for BASIC
      TRASH: { bg: '#ff444422', text: '#ff4444' }   // Red for TRASH
    };
    return colors[tier.toUpperCase()] || { bg: '#88888822', text: '#888' };
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 9) return { bg: '#9333ea22', text: '#a855f7' };  // Purple
    if (score >= 7) return { bg: '#00ff8822', text: '#00ff88' };  // Green
    if (score >= 5) return { bg: '#ffcc0022', text: '#ffcc00' };  // Yellow
    return { bg: '#ff444422', text: '#ff4444' };  // Red
  };

  const getNetworkBadge = (network: string) => {
    const colors: { [key: string]: { bg: string, text: string } } = {
      ethereum: { bg: '#627eea22', text: '#627eea' },
      solana: { bg: '#14f19522', text: '#14f195' },
      bsc: { bg: '#f0b90b22', text: '#f0b90b' },
      base: { bg: '#0052ff22', text: '#0052ff' },
      pulsechain: { bg: '#ff00ff22', text: '#ff00ff' }
    };
    return colors[network.toLowerCase()] || { bg: '#88888822', text: '#888' };
  };

  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  return (
    <div className="fixed inset-0 flex bg-[#0a0b0d]">
      {/* Filter Sidebar */}
      <FilterSidebar onFiltersChange={handleFiltersChange} />
      
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {/* New Header Bar */}
        <header className="sticky top-0 z-50 bg-[#0f0f0f] border-b border-[#2a2d31] px-6 h-14 flex items-center gap-4">
          {/* Logo */}
          <div className="min-w-[140px] flex items-center gap-2">
            <span className="text-xl font-semibold tracking-tight text-white">CoinAiRank</span>
            {isAdmin && (
              <span className="px-2 py-0.5 bg-[#00ff88]/20 text-[#00ff88] text-xs font-semibold rounded flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Admin
              </span>
            )}
          </div>

          {/* Icon group */}
          <div className="flex gap-1 ml-4">
            {/* Settings Icon */}
            <button 
              className="p-1.5 rounded hover:bg-[#1a1c1f] transition-colors"
              title="Column Settings"
            >
              <Settings className="w-4 h-4 text-[#666] hover:text-[#00ff88]" />
            </button>
            
            {/* Search Input */}
            <SearchInput onSearch={setSearchQuery} placeholder="Search symbol or name..." />
          </div>

          {/* Spacer */}
          <div className="flex-1"></div>
          
          {/* Admin Badge for smaller screens */}
          {isAdmin && (
            <div className="hidden md:block">
              {/* Admin indicator already shown next to logo */}
            </div>
          )}

          {/* Sort Controls */}
          <div className="flex items-center gap-2">
            <span className="text-[#666] text-[13px] font-medium">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-[180px] px-3 py-1.5 bg-[#1a1c1f] border border-[#2a2d31] text-[#ccc] rounded-md text-sm cursor-pointer appearance-none pr-8"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 8px center',
                backgroundSize: '16px'
              }}
            >
              <option value="created_at">Date Called</option>
              <option value="website_stage1_score">AI Score</option>
              <option value="current_market_cap">Market Cap</option>
              <option value="current_liquidity_usd">Liquidity</option>
              <option value="roi_percent">ROI %</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="p-1.5 bg-[#1a1c1f] border border-[#2a2d31] rounded-md hover:bg-[#222426] transition-colors"
              title={sortOrder === 'desc' ? 'Sort descending' : 'Sort ascending'}
            >
              {sortOrder === 'desc' ? (
                <ChevronDown className="w-4 h-4 text-[#666]" />
              ) : (
                <ChevronUp className="w-4 h-4 text-[#666]" />
              )}
            </button>
          </div>

          {/* Hamburger Menu */}
          <div className="relative">
            <button 
              className="p-1.5 rounded hover:bg-[#1a1c1f] transition-colors"
              title="Menu"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <Menu className="w-4 h-4 text-[#666] hover:text-[#00ff88]" />
            </button>
            
            {/* Dropdown Menu */}
            {isMenuOpen && (
              <>
                {/* Backdrop to close menu when clicking outside */}
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsMenuOpen(false)}
                />
                
                {/* Menu Content */}
                <div className="absolute right-0 mt-2 w-56 bg-[#111214] border border-[#2a2d31] rounded-lg shadow-lg z-50">
                  <div className="py-2">
                    <button 
                      className="w-full px-4 py-2 text-left text-white hover:bg-[#1a1c1f] transition-colors flex items-center gap-3"
                      onClick={() => {
                        setIsMenuOpen(false);
                        setIsAddTokenModalOpen(true);
                      }}
                    >
                      <span className="text-[#00ff88]">+</span>
                      Submit Token
                    </button>
                    
                    <button 
                      className="w-full px-4 py-2 text-left text-white hover:bg-[#1a1c1f] transition-colors flex items-center gap-3"
                      onClick={() => {
                        // Handle Connect Wallet
                        setIsMenuOpen(false);
                      }}
                    >
                      <span className="text-[#f59e0b]">●</span>
                      Connect Wallet
                    </button>
                    
                    <div className="border-t border-[#2a2d31] my-2"></div>
                    
                    {/* Admin-only options */}
                    {isAdmin && (
                      <>
                        <Link 
                          href="/admin/prompts"
                          className="w-full px-4 py-2 text-left text-[#00ff88] hover:bg-[#1a1c1f] transition-colors flex items-center gap-3 text-sm block"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          <FileCode2 className="w-4 h-4" />
                          AI Analysis Prompts
                        </Link>
                        
                        <button 
                          className="w-full px-4 py-2 text-left text-[#ff8844] hover:bg-[#1a1c1f] transition-colors flex items-center gap-3 text-sm"
                          onClick={handleLogout}
                        >
                          <LogOut className="w-4 h-4" />
                          Logout Admin
                        </button>
                        
                        <div className="border-t border-[#2a2d31] my-2"></div>
                      </>
                    )}
                    
                    <button 
                      className="w-full px-4 py-2 text-left text-[#666] hover:bg-[#1a1c1f] hover:text-white transition-colors text-sm"
                      onClick={() => {
                        // Handle About
                        setIsMenuOpen(false);
                      }}
                    >
                      About
                    </button>
                    
                    <button 
                      className="w-full px-4 py-2 text-left text-[#666] hover:bg-[#1a1c1f] hover:text-white transition-colors text-sm"
                      onClick={() => {
                        // Handle Documentation
                        setIsMenuOpen(false);
                      }}
                    >
                      Documentation
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        <div className="p-6">

          {/* Project Grid */}
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {projects.map((project, index) => (
              <div
                key={project.id}
                ref={index === projects.length - 1 ? lastProjectRef : null}
                className="min-w-[280px]"
              >
                <div className="bg-[#111214] rounded-2xl border border-[#2a2d31] hover:border-[#00ff88] transition-all hover:-translate-y-1 relative overflow-hidden group">
                {/* Preview Area */}
                <div className="relative h-[420px] bg-[#0a0b0d] overflow-hidden">
                  {/* Show loading state if capturing screenshot */}
                  {capturingScreenshots.has(project.id) && !project.website_screenshot_url ? (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      <div className="relative">
                        <div className="absolute inset-0 bg-[#00ff88] rounded-full opacity-20 animate-ping"></div>
                        <div className="relative w-16 h-16 border-4 border-[#1a1c1f] border-t-[#00ff88] rounded-full animate-spin"></div>
                      </div>
                      <p className="mt-4 text-[#666] text-sm">Capturing screenshot...</p>
                      <p className="mt-1 text-[#444] text-xs">This may take a few seconds</p>
                    </div>
                  ) : (
                    <div className="w-full h-full overflow-y-auto scrollbar-hide">
                      <img
                        src={
                          project.website_screenshot_url || 
                          `https://placehold.co/400x600/1a1c1f/666666?text=${encodeURIComponent(project.name || project.symbol)}`
                        }
                        alt={`${project.name || project.symbol} screenshot`}
                        className="w-full h-auto object-top"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = `https://placehold.co/400x600/1a1c1f/666666?text=${encodeURIComponent(project.name || project.symbol)}`;
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Project Info */}
                <div className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <Link href={`/project/${project.symbol}`}>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2 hover:text-[#00ff88] transition-colors cursor-pointer">
                          {project.symbol}
                          {project.name && 
                           project.name !== project.symbol && 
                           !project.name.includes('/') && (
                            <span className="text-sm text-[#666] font-normal">({project.name})</span>
                          )}
                        </h3>
                      </Link>
                      {/* Status badges and network */}
                      <div className="flex gap-1 mt-1 items-center">
                        <span 
                          className="px-2 py-0.5 rounded text-xs font-medium uppercase"
                          style={{ 
                            backgroundColor: getNetworkBadge(project.network).bg,
                            color: getNetworkBadge(project.network).text
                          }}
                        >
                          {project.network}
                        </span>
                        {project.is_rugged && (
                          <span className="px-2 py-0.5 rounded text-xs bg-orange-500/20 text-orange-500">RUGGED</span>
                        )}
                        {project.is_dead && (
                          <span className="px-2 py-0.5 rounded text-xs bg-gray-500/20 text-gray-500">DEAD</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right relative z-10">
                      <div className="flex items-center justify-end gap-1.5">
                        {project.website_stage1_tier && (
                          <WebsiteAnalysisTooltip 
                            fullAnalysis={project.website_stage1_analysis}
                            tooltip={project.website_stage1_tooltip}
                          >
                            <span 
                              className="px-2 py-0.5 rounded text-xs font-semibold uppercase inline-block cursor-help"
                              style={{ 
                                backgroundColor: getTierColor(project.website_stage1_tier).bg,
                                color: getTierColor(project.website_stage1_tier).text
                              }}
                            >
                              {project.website_stage1_tier}
                            </span>
                          </WebsiteAnalysisTooltip>
                        )}
                        {project.contract_verification && (
                          <div 
                            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                              project.contract_verification.found_on_site ? 'bg-green-500' :
                              project.is_imposter ? 'bg-red-500' : 
                              'bg-orange-500'
                            } shadow-lg`}
                            title={
                              project.contract_verification.found_on_site ? 'Contract verified on website' :
                              project.is_imposter ? 'Warning: Possible imposter token' :
                              'Contract not found on website'
                            }
                          />
                        )}
                      </div>
                      <p className="text-xs text-[#666] mt-1">{formatDate(project.created_at)}</p>
                    </div>
                  </div>
                  
                  {/* Quick Take from analysis - Support both old and new format */}
                  {(project.website_stage1_tooltip?.one_liner || (project.website_stage1_analysis as any)?.quick_take) && (
                    <p className="text-[#888] text-sm mb-4 line-clamp-2">
                      {project.website_stage1_tooltip?.one_liner || (project.website_stage1_analysis as any).quick_take}
                    </p>
                  )}
                  
                  {/* Metrics */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="text-center p-2 bg-[#1a1c1f] rounded-lg border border-[#2a2d31]">
                      <p className="text-xs text-[#666]">Market Cap</p>
                      <p className="text-sm font-semibold text-white">{formatMarketCap(project.current_market_cap)}</p>
                    </div>
                    <div className="text-center p-2 bg-[#1a1c1f] rounded-lg border border-[#2a2d31]">
                      <p className="text-xs text-[#666]">Liquidity</p>
                      <p className="text-sm font-semibold text-white">
                        {formatMarketCap(project.current_liquidity_usd || project.initial_liquidity_usd)}
                      </p>
                    </div>
                    <div className="text-center p-2 bg-[#1a1c1f] rounded-lg border border-[#2a2d31]">
                      <p className="text-xs text-[#666]">ROI</p>
                      <p className={`text-sm font-semibold ${project.roi_percent && project.roi_percent > 0 ? 'text-[#00ff88]' : project.roi_percent && project.roi_percent < 0 ? 'text-[#ff4444]' : 'text-[#888]'}`}>
                        {project.roi_percent ? `${project.roi_percent > 0 ? '+' : ''}${project.roi_percent.toFixed(0)}%` : 'N/A'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-2">
                    <a
                      href={project.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-[#00ff88] text-black text-center py-2 rounded-lg hover:bg-[#00cc66] transition-colors text-sm font-semibold relative z-20"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Visit Website ↗
                    </a>
                    {project.contract_address && (
                      <a
                        href={`https://dexscreener.com/${project.network}/${project.contract_address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 bg-[#1a1c1f] text-[#888] py-2 rounded-lg hover:bg-[#252729] hover:text-white transition-colors text-center text-sm border border-[#2a2d31] relative z-20"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Chart 📊
                      </a>
                    )}
                  </div>

                </div>
                </div>
              </div>
            ))}
          </div>

          {/* Loading Indicator */}
          {loading && (
            <div className="flex justify-center mt-8">
              <div className="w-12 h-12 border-4 border-[#00ff88] border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          {/* No More Results */}
          {!hasMore && projects.length > 0 && (
            <div className="text-center mt-8 text-[#666]">
              <p>No more projects to load</p>
            </div>
          )}

          {/* No Results */}
          {!loading && projects.length === 0 && (
            <div className="text-center mt-8">
              <p className="text-xl mb-2 text-white">No projects found</p>
              <p className="text-[#666]">Try adjusting your filters</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Add Token Modal */}
      <AddTokenModal
        isOpen={isAddTokenModalOpen}
        onClose={() => setIsAddTokenModalOpen(false)}
        onSuccess={() => {
          setIsAddTokenModalOpen(false);
          // Refresh the projects list
          setPage(1);
          setProjects([]);
          fetchProjects(1, true);
        }}
      />
    </div>
  );
}