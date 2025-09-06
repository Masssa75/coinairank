'use client';

import React from 'react';
import { createPortal } from 'react-dom';

interface Signal {
  signal: string;
  importance?: string;
  rarity_estimate?: string;
  strength_score: number;
  score_reasoning?: string;
  similar_to?: string;
}

interface RedFlag {
  flag: string;
  severity: 'high' | 'medium' | 'low';
  evidence?: string;
}

interface SignalEvaluation {
  signal: string;
  assigned_tier: number;
  reasoning: string;
  progression?: {
    tier_4_comparison: string;
    tier_3_comparison: string;
    tier_2_comparison: string;
    tier_1_comparison: string;
  };
}

interface BenchmarkComparison {
  signal_evaluations?: SignalEvaluation[];
  strongest_signal?: {
    signal: string;
    tier: number;
    benchmark_match: string;
  };
  final_tier?: number;
  final_score?: number;
  tier_name?: string;
  explanation?: string;
}

interface SignalBasedTooltipProps {
  projectDescription?: string;
  signals?: Signal[];
  redFlags?: RedFlag[];
  strongestSignal?: {
    signal: string;
    rarity: string;
    score: number;
  };
  benchmarkComparison?: BenchmarkComparison;
  extractionStatus?: string;
  comparisonStatus?: string;
  websiteAnalysis?: any;
  tooltip?: {
    one_liner: string;
    top_signals?: string[];
    main_concerns?: string[];
    pros?: string[];  // Support old format
    cons?: string[];  // Support old format
  } | null;
  children: React.ReactNode;
}

export function SignalBasedTooltip({ 
  projectDescription, 
  signals = [], 
  redFlags = [], 
  strongestSignal,
  benchmarkComparison,
  extractionStatus,
  comparisonStatus,
  websiteAnalysis,
  tooltip,
  children 
}: SignalBasedTooltipProps) {
  const [showTooltip, setShowTooltip] = React.useState(false);
  const [tooltipPosition, setTooltipPosition] = React.useState<{ x: number; y: number; placement: 'above' | 'below' } | null>(null);
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Convert tier to score for display
  const tierToScore = (tier: number): number => {
    switch(tier) {
      case 1: return 90;
      case 2: return 70;
      case 3: return 45;
      case 4: return 15;
      default: return 0;
    }
  };

  // Don't show tooltip if no data at all
  if (!tooltip && signals.length === 0 && redFlags.length === 0 && !benchmarkComparison && !websiteAnalysis) {
    return <>{children}</>;
  }

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const tooltipHeight = 400; // Estimated height
    const tooltipWidth = 500; // Max width
    
    // Calculate position
    let x = rect.left + rect.width / 2;
    let y: number;
    let placement: 'above' | 'below';
    
    // Check vertical space
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    
    if (spaceAbove >= tooltipHeight || spaceAbove > spaceBelow) {
      // Position above
      y = rect.top;
      placement = 'above';
    } else {
      // Position below
      y = rect.bottom;
      placement = 'below';
    }
    
    // Check horizontal boundaries
    const halfWidth = tooltipWidth / 2;
    if (x - halfWidth < 10) {
      x = halfWidth + 10; // Adjust for left edge
    } else if (x + halfWidth > window.innerWidth - 10) {
      x = window.innerWidth - halfWidth - 10; // Adjust for right edge
    }
    
    setTooltipPosition({ x, y, placement });
    setShowTooltip(true);
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
    setTooltipPosition(null);
  };

  // Get score color based on value - updated colors per spec
  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-[#10b981]'; // Green (Tier 1)
    if (score >= 60) return 'text-[#eab308]'; // Yellow (Tier 2)
    if (score >= 30) return 'text-[#f97316]'; // Orange (Tier 3)
    return 'text-[#ef4444]'; // Red (Tier 4)
  };

  // Get tier badge based on score
  const getTierBadge = (score: number) => {
    if (score >= 85) return { text: 'ALPHA', color: 'bg-[#00ff88]/20 text-[#00ff88]' };
    if (score >= 60) return { text: 'SOLID', color: 'bg-[#88ddff]/20 text-[#88ddff]' };
    if (score >= 30) return { text: 'BASIC', color: 'bg-[#ffaa44]/20 text-[#ffaa44]' };
    return { text: 'TRASH', color: 'bg-[#ff4444]/20 text-[#ff4444]' };
  };

  const tierBadge = strongestSignal ? getTierBadge(strongestSignal.score) : null;
  
  // Support both old and new tooltip formats
  const topSignals = tooltip?.top_signals || 
                     (tooltip?.pros ? tooltip.pros.slice(0, 3) : null) ||
                     signals.slice(0, 3).map(s => s.signal.substring(0, 60));
  const mainConcerns = tooltip?.main_concerns || 
                      (tooltip?.cons ? tooltip.cons.slice(0, 2) : null) ||
                      redFlags.filter(r => r.severity === 'high').slice(0, 2).map(r => r.flag);

  return (
    <>
      <div 
        ref={containerRef}
        className="inline-block"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </div>
      
      {mounted && showTooltip && tooltipPosition && createPortal(
        <div 
          ref={tooltipRef}
          className="fixed z-[999999] pointer-events-none"
          style={{ 
            left: `${tooltipPosition.x}px`,
            top: tooltipPosition.placement === 'above' 
              ? `${tooltipPosition.y}px` 
              : `${tooltipPosition.y}px`,
            transform: tooltipPosition.placement === 'above'
              ? 'translate(-50%, -100%) translateY(-8px)'
              : 'translate(-50%, 8px)',
          }}
        >
          <div className="bg-[#1a1c1f] rounded-lg shadow-2xl border border-[#333] p-4 min-w-[400px] max-w-[500px] max-h-[80vh] overflow-y-auto scrollbar-hide">
            
            {/* Error States for Incomplete Data */}
            {!websiteAnalysis && (
              <div className="text-[#ef4444] text-sm mb-3 p-2 bg-[#ef4444]/10 rounded">
                ⚠️ Website analysis not available
              </div>
            )}
            
            {websiteAnalysis && extractionStatus !== 'completed' && (
              <div className="text-[#ef4444] text-sm mb-3 p-2 bg-[#ef4444]/10 rounded">
                ⚠️ Phase 1 extraction missing
              </div>
            )}
            
            {extractionStatus === 'completed' && !benchmarkComparison && (
              <div className="text-[#ef4444] text-sm mb-3 p-2 bg-[#ef4444]/10 rounded">
                ⚠️ Phase 2 scoring not complete
              </div>
            )}
            
            {benchmarkComparison && !benchmarkComparison.signal_evaluations && (
              <div className="text-[#ef4444] text-sm mb-3 p-2 bg-[#ef4444]/10 rounded">
                ⚠️ Benchmark comparison not available
              </div>
            )}

            {/* Project Description - if available */}
            {(tooltip?.one_liner || projectDescription) && (
              <div className="mb-3 pb-3 border-b border-[#2a2d31]">
                <div className="text-sm text-[#ddd] leading-relaxed">
                  {tooltip?.one_liner || projectDescription}
                </div>
              </div>
            )}


            {/* Key Signals - Use Phase 2 data if available, otherwise Phase 1 */}
            {benchmarkComparison?.signal_evaluations && benchmarkComparison.signal_evaluations.length > 0 ? (
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[#666] text-xs font-bold">KEY SIGNALS</span>
                </div>
                <ul className="space-y-1.5">
                  {benchmarkComparison.signal_evaluations
                    .slice(0, 4) // Take top 4 signals
                    .sort((a, b) => a.assigned_tier - b.assigned_tier) // Sort by tier (best first)
                    .map((evalSignal, idx) => {
                      const score = tierToScore(evalSignal.assigned_tier);
                      return (
                        <li key={idx} className="text-xs flex items-start">
                          <span className="text-[#666] mr-2">•</span>
                          <div className="flex-1">
                            <span className="text-[#ddd]">{evalSignal.signal}</span>
                            <span className={`ml-2 font-bold ${getScoreColor(score)}`}>
                              [{score}]
                            </span>
                          </div>
                        </li>
                      );
                    })}
                </ul>
              </div>
            ) : topSignals.length > 0 && (
              // Fallback to Phase 1 signals if Phase 2 not available
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[#666] text-xs font-bold">KEY SIGNALS</span>
                </div>
                <ul className="space-y-1.5">
                  {topSignals.map((signal, idx) => {
                    const fullSignal = signals[idx];
                    const score = fullSignal?.strength_score;
                    return (
                      <li key={idx} className="text-xs flex items-start">
                        <span className="text-[#666] mr-2">•</span>
                        <div className="flex-1">
                          <span className="text-[#ddd]">{signal}</span>
                          {score && (
                            <span className={`ml-2 font-bold ${getScoreColor(score)}`}>
                              [{score}]
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Concerns - No scores, just list */}
            {mainConcerns.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[#666] text-xs font-bold">CONCERNS</span>
                </div>
                <ul className="space-y-1">
                  {mainConcerns.slice(0, 3).map((concern, idx) => (
                    <li key={idx} className="text-xs flex items-start">
                      <span className="text-[#666] mr-2">•</span>
                      <div className="flex-1">
                        <span className="text-[#ddd]">{concern}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Arrow pointing to element */}
            <div className={`absolute left-1/2 transform -translate-x-1/2 w-0 h-0 ${
              tooltipPosition.placement === 'above'
                ? '-bottom-2 border-l-[8px] border-l-transparent border-t-[8px] border-t-[#1a1c1f] border-r-[8px] border-r-transparent'
                : '-top-2 border-l-[8px] border-l-transparent border-b-[8px] border-b-[#1a1c1f] border-r-[8px] border-r-transparent'
            }`}>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}