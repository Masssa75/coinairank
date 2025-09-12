'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SignalBasedTooltip } from '@/components/SignalBasedTooltip';
import { ContractVerificationTooltip } from '@/components/ContractVerificationTooltip';
import FilterSidebar from '@/components/FilterSidebar';
import { AddTokenModal } from '@/components/AddTokenModal';
import SearchInput from '@/components/SearchInput';
// Removed useDebounce - using custom implementation for better control
import { cleanupDeprecatedFilters } from '@/lib/cleanupLocalStorage';
import { Settings, Menu, ChevronDown, ChevronUp, Shield, FileCode2, LogOut, MoreVertical, AlertTriangle, CheckCircle, Trash2 } from 'lucide-react';
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
  website_stage1_analysis: any;
  website_stage1_tooltip?: {
    one_liner: string;
    pros: string[];
    cons: string[];
  };
  website_stage2_resources?: Record<string, unknown>;
  website_stage1_analyzed_at: string;
  benchmark_comparison?: any;  // Phase 2 comparison data
  extraction_status?: string;  // Phase 1 extraction status
  comparison_status?: string;  // Phase 2 comparison status
  signal_feedback?: Record<string, any>;  // Admin signal feedback
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
  includeImposters?: boolean
  includeUnverified?: boolean
  minXScore?: number
  minWebsiteScore?: number
  showReprocessedOnly?: boolean
}

export default function ProjectsRatedPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<CryptoProject[]>([]);  
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  // Load saved sort state from localStorage
  const [sortBy, setSortBy] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('carProjectsSort');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return parsed.sortBy || 'created_at';
        } catch (e) {
          console.error('Failed to parse saved sort:', e);
        }
      }
    }
    return 'created_at';
  });
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('carProjectsSort');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return parsed.sortOrder || 'desc';
        } catch (e) {
          console.error('Failed to parse saved sort:', e);
        }
      }
    }
    return 'desc';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAddTokenModalOpen, setIsAddTokenModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [openActionMenu, setOpenActionMenu] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Initialize with default filters, will load from localStorage in useEffect
  const [filters, setFilters] = useState<FilterState>({
    tokenType: 'all',
    networks: ['ethereum', 'solana', 'bsc', 'base', 'pulsechain'],
    includeImposters: false,  // Default: don't show imposters
    includeUnverified: false,  // Default: don't show unverified
    minWebsiteScore: 1
  });
  
  // Track whether filters have been loaded from localStorage
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  
  // Load saved filters from localStorage after mount to avoid hydration issues
  useEffect(() => {
    const saved = localStorage.getItem('carProjectsFilters');
    if (saved) {
      try {
        const parsedFilters = JSON.parse(saved);
        setFilters(parsedFilters);
        // IMPORTANT: Also set debounced filters immediately when loading from localStorage
        setDebouncedFilters(parsedFilters);
      } catch (e) {
        console.error('Error parsing saved filters:', e);
      }
    }
    // Mark filters as loaded even if there were no saved filters
    setFiltersLoaded(true);
  }, []); // Only run once on mount
  
  // Debounced filters state (starts with default filters)
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  
  // Handle filter changes with debouncing (but skip on initial load)
  useEffect(() => {
    // Skip if we're still loading filters from localStorage
    if (!filtersLoaded) return;
    
    // Debounce filter changes by 400ms
    const timer = setTimeout(() => {
      setDebouncedFilters(filters);
    }, 400);
    
    return () => {
      clearTimeout(timer);
    };
  }, [filters, filtersLoaded]);
  
  // Save sort state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('carProjectsSort', JSON.stringify({ sortBy, sortOrder }));
    }
  }, [sortBy, sortOrder]);
  
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
  
  // Check admin authentication on mount and run cleanup
  useEffect(() => {
    checkAdminAuth();
    cleanupDeprecatedFilters();
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

  const handleToggleImposter = async (projectId: number, currentStatus: boolean) => {
    try {
      const response = await fetch('/api/admin/imposter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          isImposter: !currentStatus
        })
      });

      if (response.ok) {
        const data = await response.json();
        // Update local state
        setProjects(prev => prev.map(p => 
          p.id === projectId ? { ...p, is_imposter: !currentStatus } : p
        ));
        // Show success toast
        setToast({
          message: `Project ${!currentStatus ? 'marked as' : 'unmarked as'} imposter`,
          type: 'success'
        });
        setTimeout(() => setToast(null), 3000);
      } else {
        setToast({
          message: 'Failed to update imposter status',
          type: 'error'
        });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (error) {
      console.error('Error toggling imposter status:', error);
      setToast({
        message: 'Error updating imposter status',
        type: 'error'
      });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setOpenActionMenu(null);
    }
  };

  const handleDeleteProject = async (projectId: number, projectName: string) => {
    // Confirmation dialog
    const confirmed = window.confirm(`Are you sure you want to delete "${projectName}"? This action cannot be undone.`);
    if (!confirmed) return;

    try {
      const response = await fetch('/api/admin/delete-project', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId })
      });

      if (response.ok) {
        // Remove project from local state
        setProjects(prev => prev.filter(p => p.id !== projectId));
        // Show success toast
        setToast({
          message: `Project "${projectName}" deleted successfully`,
          type: 'success'
        });
        setTimeout(() => setToast(null), 3000);
      } else {
        setToast({
          message: 'Failed to delete project',
          type: 'error'
        });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      setToast({
        message: 'Error deleting project',
        type: 'error'
      });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setOpenActionMenu(null);
    }
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
      
      
      if (debouncedFilters.includeImposters) {
        params.append('includeImposters', 'true');
      }
      
      if (debouncedFilters.includeUnverified) {
        params.append('includeUnverified', 'true');
      }
      
      if (debouncedFilters.minWebsiteScore && debouncedFilters.minWebsiteScore > 1) {
        // Convert website score from 1-10 scale to 0-100 scale for API
        const apiScore = (debouncedFilters.minWebsiteScore - 1) * 10;
        params.append('minScore', apiScore.toString());
      }
      
      // Add reprocessed filter
      if (debouncedFilters.showReprocessedOnly) {
        params.append('reprocessedOnly', 'true');
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

  // Reset and fetch when filters change (but wait for localStorage to load first)
  useEffect(() => {
    // Don't fetch until filters have been loaded from localStorage
    if (!filtersLoaded) return;
    
    setProjects([]);
    setPage(1);
    setHasMore(true);
    fetchProjects(1, true);
  }, [sortBy, sortOrder, searchQuery, debouncedFilters, filtersLoaded]);

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
      TRASH: { bg: '#ff444422', text: '#ff4444' },  // Red for TRASH
      '-': { bg: '#66666622', text: '#999' },       // Gray for pending/unanalyzed
      '—': { bg: '#66666622', text: '#999' }        // Support both dash types
    };
    return colors[tier.toUpperCase()] || colors[tier] || { bg: '#88888822', text: '#888' };
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
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-[9999] flex items-center gap-2 px-4 py-3 bg-[#1a1c1f] border border-[#2a2d31] rounded-lg shadow-lg animate-in slide-in-from-top-2 duration-300">
          {toast.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-[#00ff88]" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-500" />
          )}
          <span className={toast.type === 'success' ? 'text-[#00ff88]' : 'text-red-500'}>
            {toast.message}
          </span>
        </div>
      )}
      
      {/* Filter Sidebar */}
      <FilterSidebar 
        onFiltersChange={handleFiltersChange}
        onSidebarToggle={(isCollapsed) => setIsSidebarCollapsed(isCollapsed)}
      />
      
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {/* New Header Bar */}
        <header className="sticky top-0 z-50 bg-[#0f0f0f] border-b border-[#2a2d31] px-6 h-14 flex items-center gap-4">
          {/* Logo */}
          <div className="min-w-[140px] flex items-center gap-2">
            <Link href="/" className="text-xl font-semibold tracking-tight text-white hover:text-[#00ff88] transition-colors">
              CoinAiRank
            </Link>
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
              onChange={(e) => {
                setSortBy(e.target.value);
                setProjects([]); // Clear projects to force reload with new sort
                setPage(1); // Reset pagination
              }}
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
              onClick={() => {
                setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                setProjects([]); // Clear projects to force reload with new sort
                setPage(1); // Reset pagination
              }}
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

          {/* Project Grid - Dynamic columns based on sidebar state */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 ${
            isSidebarCollapsed ? 'xl:grid-cols-4' : '2xl:grid-cols-4'
          }`}>
            {projects.map((project, index) => (
              <div
                key={project.id}
                ref={index === projects.length - 1 ? lastProjectRef : null}
              >
                <div className="bg-[#111214] rounded-2xl border border-[#2a2d31] hover:border-[#00ff88] transition-all hover:-translate-y-1 relative overflow-hidden group min-w-0">
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
                        <h3 className={`text-xl font-bold hover:text-[#00ff88] transition-colors cursor-pointer ${
                          project.is_imposter === true ? 'text-red-500' : 'text-white'
                        }`}>
                          {(project.contract_verification || project.is_imposter) ? (
                            <ContractVerificationTooltip
                              verification={project.contract_verification || null}
                              isImposter={project.is_imposter}
                            >
                              <span className="flex items-center gap-2">
                                {project.symbol}
                                {project.name && 
                                 project.name !== project.symbol && 
                                 !project.name.includes('/') && (
                                  <span className="text-sm text-[#666] font-normal">({project.name})</span>
                                )}
                              </span>
                            </ContractVerificationTooltip>
                          ) : (
                            <span className="flex items-center gap-2">
                              {project.symbol}
                              {project.name && 
                               project.name !== project.symbol && 
                               !project.name.includes('/') && (
                                <span className="text-sm text-[#666] font-normal">({project.name})</span>
                              )}
                            </span>
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
                      </div>
                    </div>
                    <div className="text-right relative z-10">
                      {(() => {
                        // Determine if we should show dash tier
                        const htmlLength = project.website_stage1_analysis?.html_length;
                        const hasLargeHtml = htmlLength && htmlLength > 240000;
                        const hasNoAnalysis = !project.website_stage1_analysis || 
                                            (!project.website_stage1_analysis?.signals_found && 
                                             !project.website_stage1_analysis?.technical_assessment);
                        const hasInvalidScore = project.website_stage1_score === 0 || project.website_stage1_score === null;
                        const shouldShowDash = hasLargeHtml || hasNoAnalysis || (!project.website_stage1_tier && hasInvalidScore);
                        
                        // Determine display tier
                        const displayTier = shouldShowDash ? '—' : project.website_stage1_tier;
                        
                        // Determine if CSR with incomplete analysis
                        const isCSR = project.ssr_csr_classification === 'CSR' || 
                                     project.website_stage1_analysis?.ssr_csr_classification === 'CSR';
                        const needsProperScraping = isCSR && htmlLength && htmlLength <= 240000;
                        
                        // Show tooltip for any project with tier or dash
                        if (!displayTier) return null;
                        
                        return (
                          <SignalBasedTooltip
                          projectDescription={project.website_stage1_analysis?.project_description}
                          signals={project.website_stage1_analysis?.signals_found}
                          redFlags={project.website_stage1_analysis?.red_flags}
                          strongestSignal={project.website_stage1_analysis?.strongest_signal || project.website_stage1_analysis?.strongest_signal}
                          benchmarkComparison={project.benchmark_comparison}
                          extractionStatus={project.extraction_status}
                          comparisonStatus={project.comparison_status}
                          websiteAnalysis={{
                            ...project.website_stage1_analysis,
                            discovered_links: (project as any).discovered_links || [],
                            stage_2_links: (project as any).stage_2_links || [],
                            html_length: htmlLength
                          }}
                          hasLargeHtml={hasLargeHtml}
                          needsProperScraping={needsProperScraping}
                          hasNoAnalysis={hasNoAnalysis}
                          isAdmin={isAdmin}
                          tokenId={project.id.toString()}
                          signalFeedback={project.signal_feedback}
                          onFeedbackUpdate={(feedback) => {
                            // Update local state to reflect feedback changes
                            setProjects(prev => prev.map(p => 
                              p.id === project.id ? { ...p, signal_feedback: feedback } : p
                            ));
                          }}
                          stage2Resources={project.website_stage2_resources}
                          tooltip={project.website_stage1_analysis?.tooltip || project.website_stage1_tooltip}
                        >
                            <span 
                              className="px-2 py-0.5 rounded text-xs font-semibold uppercase inline-block cursor-help"
                              style={{ 
                                backgroundColor: getTierColor(displayTier).bg,
                                color: getTierColor(displayTier).text
                              }}
                            >
                              {displayTier}
                            </span>
                          </SignalBasedTooltip>
                        );
                      })()}
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
                    {/* Admin Actions Menu */}
                    {isAdmin && (
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenActionMenu(openActionMenu === project.id ? null : project.id);
                          }}
                          className="p-2 bg-[#1a1c1f] text-[#888] rounded-lg hover:bg-[#252729] hover:text-white transition-colors border border-[#2a2d31] relative z-20"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        
                        {openActionMenu === project.id && (
                          <>
                            {/* Backdrop to close menu */}
                            <div 
                              className="fixed inset-0 z-30" 
                              onClick={() => setOpenActionMenu(null)}
                            />
                            
                            {/* Dropdown Menu */}
                            <div className="absolute right-0 bottom-full mb-2 w-48 bg-[#111214] border border-[#2a2d31] rounded-lg shadow-lg z-40">
                              <button
                                onClick={() => handleToggleImposter(project.id, project.is_imposter || false)}
                                className="w-full px-4 py-2 text-left text-white hover:bg-[#1a1c1f] transition-colors flex items-center gap-2 text-sm rounded-t-lg"
                              >
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                                {project.is_imposter ? 'Unmark as Imposter' : 'Mark as Imposter'}
                              </button>
                              <button
                                onClick={() => handleDeleteProject(project.id, project.symbol)}
                                className="w-full px-4 py-2 text-left text-red-400 hover:bg-[#1a1c1f] hover:text-red-300 transition-colors flex items-center gap-2 text-sm border-t border-[#2a2d31] rounded-b-lg"
                              >
                                <Trash2 className="w-4 h-4" />
                                Remove Project
                              </button>
                            </div>
                          </>
                        )}
                      </div>
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