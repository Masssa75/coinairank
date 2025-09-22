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
  whitepaperUrl?: string;
  whitepaperTier?: string;
  whitepaperScore?: number;
  whitepaperSignals?: any;
  whitepaperRedFlags?: any;
  whitepaperGreenFlags?: any;
  whitepaperAnalysis?: any;
  whitepaperAnalyzedAt?: string;
  children: React.ReactNode;
}

export function WhitepaperTooltip({
  whitepaperUrl,
  whitepaperTier,
  whitepaperScore,
  whitepaperSignals,
  whitepaperRedFlags,
  whitepaperGreenFlags,
  whitepaperAnalysis,
  whitepaperAnalyzedAt,
  children
}: WhitepaperTooltipProps) {
  const [showTooltip, setShowTooltip] = React.useState(false);
  const [isPersistent, setIsPersistent] = React.useState(false);
  const [tooltipPosition, setTooltipPosition] = React.useState<{ x: number; y: number; placement: 'above' | 'below' } | null>(null);
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);

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
  if (!whitepaperTier && !whitepaperUrl && !whitepaperSignals && !whitepaperAnalysis) {
    return <>{children}</>;
  }

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPersistent) return;
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const tooltipHeight = 400;
    const tooltipWidth = 500;

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
    if (x - halfWidth < 10) {
      x = halfWidth + 10;
    } else if (x + halfWidth > window.innerWidth - 10) {
      x = window.innerWidth - halfWidth - 10;
    }

    setTooltipPosition({ x, y, placement });
    setShowTooltip(true);
  };

  const handleMouseLeave = () => {
    if (!isPersistent) {
      setShowTooltip(false);
    }
  };

  const handleClick = () => {
    setIsPersistent(!isPersistent);
  };

  const getTooltipContent = () => {
    return (
      <div className="p-4 w-full relative">
        {isPersistent && (
          <button
            onClick={() => {
              setIsPersistent(false);
              setShowTooltip(false);
            }}
            className="absolute top-2 right-2 text-[#666] hover:text-white transition-colors z-10"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Key Technical Innovations */}
        {whitepaperSignals?.technical_innovations && whitepaperSignals.technical_innovations.length > 0 && (
          <div className="mb-3">
            <h4 className="text-[#00ff88] text-sm font-medium mb-2 flex items-center gap-1">
              <Radio className="w-3 h-3" />
              Technical Innovations
            </h4>
            <div className="space-y-1">
              {whitepaperSignals.technical_innovations.slice(0, 3).map((innovation: any, idx: number) => {
                // Map strength to score
                const score = innovation.strength === 'HIGH' ? 8 : innovation.strength === 'MEDIUM' ? 5 : 3;
                const getScoreColor = (score: number) => {
                  if (score >= 8) return 'text-[#00ff88]'; // green
                  if (score >= 6) return 'text-[#ffcc00]'; // yellow
                  if (score >= 4) return 'text-[#ff8800]'; // orange
                  return 'text-[#ff4444]'; // red
                };

                return (
                  <div key={idx} className="text-[#ccc] text-sm flex items-start gap-2">
                    <span className="text-[#666] text-xs mt-0.5 flex-shrink-0 min-w-[15px]">
                      •
                    </span>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <span className="block flex-1">{innovation.claim}</span>
                        <span className={`text-xs font-bold ${getScoreColor(score)} ml-2`}>
                          [{score}]
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Academic Rigor */}
        {whitepaperSignals?.academic_rigor && whitepaperSignals.academic_rigor.length > 0 && (
          <div className="mb-3">
            <h4 className="text-[#00ff88] text-sm font-medium mb-2 flex items-center gap-1">
              <Radio className="w-3 h-3" />
              Academic Rigor
            </h4>
            <div className="space-y-1">
              {whitepaperSignals.academic_rigor.slice(0, 2).map((signal: any, idx: number) => {
                // Map strength to score
                const score = signal.strength === 'VERY HIGH' ? 9 : signal.strength === 'HIGH' ? 7 : signal.strength === 'MEDIUM' ? 5 : 3;
                const getScoreColor = (score: number) => {
                  if (score >= 8) return 'text-[#00ff88]';
                  if (score >= 6) return 'text-[#ffcc00]';
                  if (score >= 4) return 'text-[#ff8800]';
                  return 'text-[#ff4444]';
                };

                return (
                  <div key={idx} className="text-[#ccc] text-sm flex items-start gap-2">
                    <span className="text-[#666] text-xs mt-0.5 flex-shrink-0 min-w-[15px]">
                      •
                    </span>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <span className="block flex-1">{signal.signal}</span>
                        <span className={`text-xs font-bold ${getScoreColor(score)} ml-2`}>
                          [{score}]
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Green Flags */}
        {whitepaperGreenFlags && whitepaperGreenFlags.length > 0 && (
          <div className="mb-3">
            <h4 className="text-[#00ff88] text-sm font-medium mb-2 flex items-center gap-1">
              <Radio className="w-3 h-3" />
              Positive Indicators
            </h4>
            <div className="space-y-1">
              {whitepaperGreenFlags.slice(0, 3).map((flag: any, idx: number) => {
                const signal = typeof flag === 'string' ? flag : flag.signal || flag.flag;
                const score = flag.ratio ? Math.min(9, Math.round(flag.ratio)) : 6;
                const getScoreColor = (score: number) => {
                  if (score >= 8) return 'text-[#00ff88]';
                  if (score >= 6) return 'text-[#ffcc00]';
                  if (score >= 4) return 'text-[#ff8800]';
                  return 'text-[#ff4444]';
                };

                return (
                  <div key={idx} className="text-[#ccc] text-sm flex items-start gap-2">
                    <span className="text-[#666] text-xs mt-0.5 flex-shrink-0 min-w-[15px]">
                      •
                    </span>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <span className="block flex-1">{signal}</span>
                        <span className={`text-xs font-bold ${getScoreColor(score)} ml-2`}>
                          [{score}]
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Red Flags */}
        {whitepaperRedFlags && whitepaperRedFlags.length > 0 && (
          <div className="mb-3">
            <h4 className="text-[#ff4444] text-sm font-medium mb-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Red Flags
            </h4>
            <div className="space-y-1">
              {whitepaperRedFlags.slice(0, 3).map((flag: any, idx: number) => {
                const signal = typeof flag === 'string' ? flag : flag.signal || flag.flag;
                const score = 2; // Red flags get low score

                return (
                  <div key={idx} className="text-[#ccc] text-sm flex items-start gap-2">
                    <span className="text-[#666] text-xs mt-0.5 flex-shrink-0 min-w-[15px]">
                      •
                    </span>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <span className="block flex-1">{signal}</span>
                        <span className="text-xs font-bold text-[#ff4444] ml-2">
                          [{score}]
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Scoring Reasoning - Show at bottom */}
        {whitepaperScore !== undefined && (
          <div className="pt-2 mt-2 border-t border-[#2a2d31]">
            <div className="text-[#666] text-xs">
              Score: <span className="text-[#ccc] font-bold">{whitepaperScore}/100</span>
              {whitepaperTier && (
                <>
                  {' • Tier: '}
                  <span className={`font-bold ${
                    whitepaperTier === 'ALPHA' ? 'text-[#00ff88]' :
                    whitepaperTier === 'SOLID' ? 'text-[#ffcc00]' :
                    whitepaperTier === 'BASIC' ? 'text-[#ff8800]' :
                    'text-[#ff4444]'
                  }`}>
                    {whitepaperTier}
                  </span>
                </>
              )}
            </div>
            {whitepaperAnalysis?.benchmark_comparison?.reasoning && (
              <div className="text-[#999] text-xs mt-1">
                {whitepaperAnalysis.benchmark_comparison.reasoning}
              </div>
            )}
          </div>
        )}

        {/* Analysis Date */}
        {whitepaperAnalyzedAt && (
          <div className="pt-2 border-t border-[#2a2d31]">
            <span className="text-[#666] text-xs">
              Analyzed: {new Date(whitepaperAnalyzedAt).toLocaleDateString()}
            </span>
          </div>
        )}

        {/* No analysis available */}
        {!whitepaperTier && (
          <div className="text-center py-4">
            <Info className="w-8 h-8 text-[#666] mx-auto mb-2" />
            <p className="text-[#666] text-sm">No whitepaper analysis available</p>
          </div>
        )}
      </div>
    );
  };

  if (!mounted) {
    return <>{children}</>;
  }

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

      {showTooltip && tooltipPosition && createPortal(
        <div
          ref={tooltipRef}
          className="fixed z-[9999] bg-[#111214] border border-[#2a2d31] rounded-lg shadow-2xl max-w-[500px] w-[500px]"
          style={{
            left: tooltipPosition.x - 250, // Center the tooltip
            top: tooltipPosition.placement === 'below'
              ? tooltipPosition.y + 10
              : tooltipPosition.y - 400 - 10,
            maxHeight: '400px',
            overflowY: 'auto'
          }}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={handleMouseLeave}
        >
          {getTooltipContent()}
        </div>,
        document.body
      )}
    </>
  );
}