'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Info,
  FileText,
  Star,
  Check,
  X,
  Radio
} from 'lucide-react';

interface WhitepaperTooltipProps {
  // New lazy-loading prop
  projectSymbol?: string;

  // Legacy props (for backwards compatibility)
  whitepaperUrl?: string;
  whitepaperTier?: string;
  whitepaperQualityScore?: number;
  whitepaperStoryAnalysis?: {
    simple_description?: string;
    vision_story?: string;
    innovation_story?: string;
    team_story?: string;
  };
  whitepaperPhase2Comparison?: {
    summary?: string;
    reasoning?: string;
    tier_name?: string;
    quality_score?: number;
  };
  whitepaperAnalyzedAt?: string;
  children: React.ReactNode;
}

export function WhitepaperTooltip({
  projectSymbol,
  whitepaperUrl: initialWhitepaperUrl,
  whitepaperTier,
  whitepaperQualityScore,
  whitepaperStoryAnalysis: initialStoryAnalysis,
  whitepaperPhase2Comparison: initialPhase2Comparison,
  whitepaperAnalyzedAt,
  children
}: WhitepaperTooltipProps) {
  const [showTooltip, setShowTooltip] = React.useState(false);
  const [isPersistent, setIsPersistent] = React.useState(false);
  const [tooltipPosition, setTooltipPosition] = React.useState<{ x: number; y: number; placement: 'above' | 'below' } | null>(null);
  const [selectedSignalIdx, setSelectedSignalIdx] = React.useState<string | null>(null);
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);

  // Lazy loading state
  const [isLoadingData, setIsLoadingData] = React.useState(false);
  const [whitepaperUrl, setWhitepaperUrl] = React.useState(initialWhitepaperUrl);
  const [whitepaperStoryAnalysis, setWhitepaperStoryAnalysis] = React.useState(initialStoryAnalysis);
  const [whitepaperPhase2Comparison, setWhitepaperPhase2Comparison] = React.useState(initialPhase2Comparison);

  // Lazy load whitepaper data
  const fetchWhitepaperData = React.useCallback(async () => {
    if (!projectSymbol || whitepaperStoryAnalysis || isLoadingData) return;

    setIsLoadingData(true);
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data, error } = await supabase
        .from('crypto_projects_rated')
        .select('whitepaper_url, whitepaper_story_analysis, whitepaper_phase2_comparison')
        .eq('symbol', projectSymbol.toUpperCase())
        .single();

      if (!error && data) {
        setWhitepaperUrl(data.whitepaper_url);
        setWhitepaperStoryAnalysis(data.whitepaper_story_analysis);
        setWhitepaperPhase2Comparison(data.whitepaper_phase2_comparison);
      }
    } catch (error) {
      console.error('Error fetching whitepaper data:', error);
    } finally {
      setIsLoadingData(false);
    }
  }, [projectSymbol, whitepaperStoryAnalysis, isLoadingData]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Handle click outside to close persistent tooltip
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isPersistent && tooltipRef.current && !tooltipRef.current.contains(event.target as Node) &&
          containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsPersistent(false);
        setShowTooltip(false);
      }
    };

    if (isPersistent) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPersistent]);

  // Don't show tooltip if no whitepaper data
  if (!whitepaperTier && !whitepaperUrl && !whitepaperStoryAnalysis && !whitepaperPhase2Comparison) {
    return <>{children}</>;
  }

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPersistent) return;
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const tooltipHeight = 400;
    // Use responsive width: smaller on mobile, larger on desktop
    const isMobile = window.innerWidth < 768;
    const tooltipWidth = isMobile ? Math.min(window.innerWidth - 20, 500) : 500;

    // Calculate position
    let x = rect.left + rect.width / 2;
    let y: number;
    let placement: 'above' | 'below';

    // Check vertical space
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;

    if (spaceBelow >= tooltipHeight + 20) {
      y = rect.bottom;
      placement = 'below';
    } else {
      y = rect.top;
      placement = 'above';
    }

    // Adjust horizontal position to keep tooltip on screen
    const halfWidth = tooltipWidth / 2;
    const padding = 10;
    if (x - halfWidth < padding) {
      x = halfWidth + padding;
    } else if (x + halfWidth > window.innerWidth - padding) {
      x = window.innerWidth - halfWidth - padding;
    }

    setTooltipPosition({ x, y, placement });
    setShowTooltip(true);

    // Fetch data if using lazy loading
    if (projectSymbol && !whitepaperStoryAnalysis) {
      fetchWhitepaperData();
    }
  };

  const handleMouseLeave = () => {
    if (!isPersistent) {
      setShowTooltip(false);
    }
  };

  const handleClick = () => {
    setIsPersistent(!isPersistent);
  };

  const handleSignalClick = (signalKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPersistent) {
      setSelectedSignalIdx(selectedSignalIdx === signalKey ? null : signalKey);
    }
  };

  const getTooltipContent = () => {
    // Show loading state
    if (isLoadingData) {
      return (
        <div className="p-4 w-full">
          <div className="flex items-center justify-center py-6 text-gray-400 text-sm">
            Loading analysis...
          </div>
        </div>
      );
    }

    // Check if we have analysis data
    const hasAnalysis = whitepaperStoryAnalysis || whitepaperPhase2Comparison;

    if (!hasAnalysis) {
      return (
        <div className="p-4 w-full">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Info className="w-4 h-4" />
            <span>No whitepaper analysis available</span>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 w-full relative">
        {isPersistent && (
          <button
            onClick={() => {
              setIsPersistent(false);
              setShowTooltip(false);
            }}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 transition-colors z-10"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Simple Description */}
        {whitepaperStoryAnalysis?.simple_description && (
          <div className="mb-4">
            <h4 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">What it does:</h4>
            <div className="text-sm text-gray-600 leading-relaxed">
              {whitepaperStoryAnalysis.simple_description}
            </div>
          </div>
        )}

        {/* Phase 2 Summary */}
        {whitepaperPhase2Comparison?.summary && (
          <div>
            <h4 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Quality Assessment:</h4>
            <div className="text-sm text-gray-600 leading-relaxed">
              {whitepaperPhase2Comparison.summary}
            </div>
          </div>
        )}

        {/* Whitepaper URL Link */}
        {whitepaperUrl && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <a
              href={whitepaperUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-emerald-500 hover:underline flex items-center gap-1"
            >
              <FileText className="w-3 h-3" />
              View Whitepaper
            </a>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div
        ref={containerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className="inline-block"
      >
        {children}
      </div>

      {showTooltip && tooltipPosition && mounted && createPortal(
        <div
          ref={tooltipRef}
          className={`fixed z-[999999] ${isPersistent ? 'pointer-events-auto' : 'pointer-events-none'}`}
          style={{
            left: `${tooltipPosition.x}px`,
            top: tooltipPosition.placement === 'above'
              ? `${tooltipPosition.y}px`
              : `${tooltipPosition.y}px`,
            transform: tooltipPosition.placement === 'above'
              ? 'translate(-50%, -100%) translateY(-8px)'
              : 'translate(-50%, 8px)',
          }}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={handleMouseLeave}
        >
          <div className="bg-white rounded-lg shadow-2xl border border-gray-200 p-3 md:p-4
            w-[calc(100vw-20px)] max-w-[500px] min-w-[300px] md:min-w-[400px]
            max-h-[60vh] md:max-h-[80vh] overflow-y-auto scrollbar-hide">
            {getTooltipContent()}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}