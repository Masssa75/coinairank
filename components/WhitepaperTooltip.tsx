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
  whitepaperSimpleDescription?: string;
  // V2 Evidence-based fields
  whitepaperMainClaim?: string;
  whitepaperEvidenceClaims?: any[];
  whitepaperEvidenceEvaluations?: any;
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
  whitepaperSimpleDescription,
  whitepaperMainClaim,
  whitepaperEvidenceClaims,
  whitepaperEvidenceEvaluations,
  children
}: WhitepaperTooltipProps) {
  const [showTooltip, setShowTooltip] = React.useState(false);
  const [isPersistent, setIsPersistent] = React.useState(false);
  const [tooltipPosition, setTooltipPosition] = React.useState<{ x: number; y: number; placement: 'above' | 'below' } | null>(null);
  const [selectedSignalIdx, setSelectedSignalIdx] = React.useState<string | null>(null);
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

  const handleSignalClick = (signalKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPersistent) {
      setSelectedSignalIdx(selectedSignalIdx === signalKey ? null : signalKey);
    }
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

        {/* Simple Description - Show at top if available */}
        {(whitepaperSimpleDescription || whitepaperAnalysis?.simple_description) && (
          <div className="mb-3 pb-3 border-b border-[#2a2d31]">
            <div className="text-sm text-[#ddd] leading-relaxed">
              {whitepaperSimpleDescription || whitepaperAnalysis.simple_description}
            </div>
          </div>
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
                const signalKey = `tech-${idx}`;
                const isExpanded = selectedSignalIdx === signalKey;

                return (
                  <div key={idx}>
                    <div className="text-[#ccc] text-sm flex items-start gap-2">
                      <span className="text-[#666] text-xs mt-0.5 flex-shrink-0 min-w-[15px]">
                        •
                      </span>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <span className="block flex-1">{innovation.claim}</span>
                          <span
                            className={`text-xs font-bold ${getScoreColor(score)} ml-2 ${isPersistent ? 'cursor-pointer hover:underline' : ''}`}
                            onClick={(e) => handleSignalClick(signalKey, e)}
                            title={isPersistent ? 'Click to see reasoning' : ''}
                          >
                            [{score}]
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Show reasoning if expanded */}
                    {isPersistent && isExpanded && (
                      <div className="mt-2 ml-6 p-2 bg-[#2a2d31] rounded text-[10px] text-[#999]">
                        <div className="font-semibold text-[#aaa] mb-1">Score Reasoning:</div>
                        <div>{innovation.strength === 'HIGH' ? 'High strength technical innovation with significant impact' :
                              innovation.strength === 'MEDIUM' ? 'Medium strength innovation with moderate impact' :
                              'Low strength innovation with limited impact'}</div>
                      </div>
                    )}
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
                const signalKey = `academic-${idx}`;
                const isExpanded = selectedSignalIdx === signalKey;

                return (
                  <div key={idx}>
                    <div className="text-[#ccc] text-sm flex items-start gap-2">
                      <span className="text-[#666] text-xs mt-0.5 flex-shrink-0 min-w-[15px]">
                        •
                      </span>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <span className="block flex-1">{signal.signal}</span>
                          <span
                            className={`text-xs font-bold ${getScoreColor(score)} ml-2 ${isPersistent ? 'cursor-pointer hover:underline' : ''}`}
                            onClick={(e) => handleSignalClick(signalKey, e)}
                            title={isPersistent ? 'Click to see reasoning' : ''}
                          >
                            [{score}]
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Show reasoning if expanded */}
                    {isPersistent && isExpanded && (
                      <div className="mt-2 ml-6 p-2 bg-[#2a2d31] rounded text-[10px] text-[#999]">
                        <div className="font-semibold text-[#aaa] mb-1">Score Reasoning:</div>
                        <div>{signal.strength === 'VERY HIGH' ? 'Very high academic rigor with exceptional research quality' :
                              signal.strength === 'HIGH' ? 'High academic rigor with strong research foundation' :
                              signal.strength === 'MEDIUM' ? 'Medium academic rigor with decent research' :
                              'Basic academic rigor with limited research'}</div>
                      </div>
                    )}
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
                const signalKey = `green-${idx}`;
                const isExpanded = selectedSignalIdx === signalKey;

                return (
                  <div key={idx}>
                    <div className="text-[#ccc] text-sm flex items-start gap-2">
                      <span className="text-[#666] text-xs mt-0.5 flex-shrink-0 min-w-[15px]">
                        •
                      </span>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <span className="block flex-1">{signal}</span>
                          <span
                            className={`text-xs font-bold ${getScoreColor(score)} ml-2 ${isPersistent ? 'cursor-pointer hover:underline' : ''}`}
                            onClick={(e) => handleSignalClick(signalKey, e)}
                            title={isPersistent ? 'Click to see reasoning' : ''}
                          >
                            [{score}]
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Show reasoning if expanded */}
                    {isPersistent && isExpanded && (
                      <div className="mt-2 ml-6 p-2 bg-[#2a2d31] rounded text-[10px] text-[#999]">
                        <div className="font-semibold text-[#aaa] mb-1">Score Reasoning:</div>
                        <div>
                          {flag.source === 'Character assessment' ?
                            'Positive indicator from document character assessment' :
                          flag.ratio ?
                            `Strong technical-to-marketing ratio (${flag.ratio.toFixed(1)}:1)` :
                          score >= 8 ? 'Exceptionally positive indicator for project quality' :
                          score >= 6 ? 'Strong positive indicator for project quality' :
                          'Moderate positive indicator for project quality'}
                        </div>
                      </div>
                    )}
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
                const signalKey = `red-${idx}`;
                const isExpanded = selectedSignalIdx === signalKey;

                return (
                  <div key={idx}>
                    <div className="text-[#ccc] text-sm flex items-start gap-2">
                      <span className="text-[#666] text-xs mt-0.5 flex-shrink-0 min-w-[15px]">
                        •
                      </span>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <span className="block flex-1">{signal}</span>
                          <span
                            className={`text-xs font-bold text-[#ff4444] ml-2 ${isPersistent ? 'cursor-pointer hover:underline' : ''}`}
                            onClick={(e) => handleSignalClick(signalKey, e)}
                            title={isPersistent ? 'Click to see reasoning' : ''}
                          >
                            [{score}]
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Show reasoning if expanded */}
                    {isPersistent && isExpanded && (
                      <div className="mt-2 ml-6 p-2 bg-[#2a2d31] rounded text-[10px] text-[#999]">
                        <div className="font-semibold text-[#aaa] mb-1">Score Reasoning:</div>
                        <div>
                          {flag.source === 'Character assessment' ?
                            'Concerning indicator from document character assessment' :
                          signal.includes('marketing') || signal.toLowerCase().includes('marketing') ?
                            'Heavy marketing language indicates lack of technical substance' :
                          signal.includes('proof') || signal.includes('mathematical') ?
                            'Lack of mathematical rigor or formal proofs is a major concern' :
                          'Critical weakness that significantly impacts project credibility'}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* V2 Evidence Claims */}
        {whitepaperEvidenceClaims && whitepaperEvidenceClaims.length > 0 && (
          <div className="mb-3">
            <h4 className="text-[#00ff88] text-sm font-medium mb-2 flex items-center gap-1">
              <FileText className="w-3 h-3" />
              Evidence Claims (V2)
            </h4>
            {whitepaperMainClaim && (
              <div className="mb-3 p-2 bg-[#1a1c1f] rounded border-l-2 border-[#00ff88]">
                <div className="text-[#00ff88] text-xs font-medium mb-1">Main Claim:</div>
                <div className="text-[#ccc] text-xs">{whitepaperMainClaim}</div>
              </div>
            )}
            <div className="space-y-2">
              {whitepaperEvidenceClaims.slice(0, 3).map((evidenceClaim: any, idx: number) => {
                const signalKey = `evidence-${idx}`;
                const isExpanded = selectedSignalIdx === signalKey;

                return (
                  <div key={idx}>
                    <div className="text-[#ccc] text-sm">
                      <div className="flex items-start gap-2">
                        <span className="text-[#666] text-xs mt-0.5 flex-shrink-0 min-w-[15px]">
                          {idx + 1}.
                        </span>
                        <div className="flex-1">
                          <div className="mb-2">
                            <span className="font-medium text-[#fff]">Claim:</span>
                            <div className="text-[#ccc] text-xs mt-1">{evidenceClaim.claim}</div>
                          </div>
                          {isPersistent && (
                            <button
                              onClick={(e) => handleSignalClick(signalKey, e)}
                              className="text-[#00ff88] text-xs hover:underline"
                            >
                              {isExpanded ? 'Hide Evaluation' : 'Show Detailed Evaluation'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Show detailed evaluation if expanded */}
                    {isPersistent && isExpanded && (
                      <div className="mt-2 ml-6 p-3 bg-[#1a1c1f] rounded border border-[#3a3d41] text-[11px]">
                        <div className="text-[#e5e5e5] leading-relaxed">
                          <div dangerouslySetInnerHTML={{ __html: evidenceClaim.evaluation.replace(/\*\*(.*?)\*\*/g, '<strong class="text-[#ffffff] font-semibold">$1</strong>').replace(/\n/g, '<br/>') }} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Character Assessment */}
        {whitepaperAnalysis?.character_assessment && (
          <div className="pt-2 mt-2 border-t border-[#2a2d31]">
            <h4 className="text-[#00ff88] text-xs font-medium mb-1">Character Assessment</h4>
            <div className="text-[#999] text-xs italic">
              {whitepaperAnalysis.character_assessment}
            </div>
          </div>
        )}

        {/* Verdict */}
        {whitepaperAnalysis?.kimi_verdict && (
          <div className="mt-2">
            <h4 className="text-[#00ff88] text-xs font-medium mb-1">Verdict</h4>
            <div className="text-[#ccc] text-xs">
              {whitepaperAnalysis.kimi_verdict}
            </div>
          </div>
        )}

        {/* Scoring Reasoning - Show at bottom */}
        {whitepaperScore !== undefined && (
          <div className="pt-2 mt-2 border-t border-[#2a2d31]">
            <div className="text-[#666] text-xs">
              Score: <span
                className={`text-[#ccc] font-bold ${isPersistent ? 'cursor-pointer hover:underline' : ''}`}
                onClick={(e) => handleSignalClick('overall-score', e)}
                title={isPersistent ? 'Click for scoring details' : ''}
              >
                {whitepaperScore}/100
              </span>
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
            {/* Show full reasoning when clicked */}
            {isPersistent && selectedSignalIdx === 'overall-score' && (
              <div className="mt-2 p-2 bg-[#2a2d31] rounded text-[10px] text-[#999]">
                <div className="font-semibold text-[#aaa] mb-1">Tier Assignment Reasoning:</div>
                <div>{whitepaperAnalysis?.signals_extracted?.benchmark_comparison?.reasoning ||
                      whitepaperAnalysis?.benchmark_comparison?.reasoning ||
                      'Score based on technical innovations, academic rigor, and documentation quality'}</div>
              </div>
            )}
            {/* Show brief reasoning by default */}
            {(!isPersistent || selectedSignalIdx !== 'overall-score') &&
             (whitepaperAnalysis?.signals_extracted?.benchmark_comparison?.reasoning || whitepaperAnalysis?.benchmark_comparison?.reasoning) && (
              <div className="text-[#999] text-xs mt-1">
                {whitepaperAnalysis?.signals_extracted?.benchmark_comparison?.reasoning || whitepaperAnalysis?.benchmark_comparison?.reasoning}
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