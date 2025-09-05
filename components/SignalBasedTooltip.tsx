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

interface SignalBasedTooltipProps {
  projectDescription?: string;
  signals?: Signal[];
  redFlags?: RedFlag[];
  strongestSignal?: {
    signal: string;
    rarity: string;
    score: number;
  };
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

  // Don't show tooltip if no data
  if (!tooltip && signals.length === 0 && redFlags.length === 0) {
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

  // Get score color based on value
  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-[#00ff88]'; // Alpha
    if (score >= 60) return 'text-[#88ddff]'; // Solid
    if (score >= 30) return 'text-[#ffaa44]'; // Basic
    return 'text-[#ff4444]'; // Trash
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
          <div className="bg-[#1a1c1f] rounded-lg shadow-2xl border border-[#333] p-4 min-w-[400px] max-w-[500px] max-h-[80vh] overflow-y-auto">
            
            {/* Header with Tier Badge */}
            {strongestSignal && tierBadge && (
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${tierBadge.color}`}>
                    {tierBadge.text}
                  </span>
                  <span className={`text-lg font-bold ${getScoreColor(strongestSignal.score)}`}>
                    {strongestSignal.score}
                  </span>
                </div>
                <span className="text-[#666] text-xs">
                  Rarity: {strongestSignal.rarity}
                </span>
              </div>
            )}

            {/* Project Description */}
            {(tooltip?.one_liner || projectDescription) && (
              <div className="mb-3 pb-3 border-b border-[#2a2d31]">
                <div className="text-sm text-[#ddd] leading-relaxed">
                  {tooltip?.one_liner || projectDescription}
                </div>
              </div>
            )}

            {/* Strongest Signal */}
            {strongestSignal && (
              <div className="mb-3 pb-3 border-b border-[#2a2d31]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[#00ff88] text-xs font-bold">🚀 STRONGEST SIGNAL</span>
                </div>
                <div className="text-sm text-white">
                  {strongestSignal.signal}
                </div>
                <div className="text-xs text-[#888] mt-1">
                  {strongestSignal.rarity} projects have this
                </div>
              </div>
            )}

            {/* Other Signals */}
            {topSignals.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[#88ddff] text-xs font-bold">📊 KEY SIGNALS</span>
                </div>
                <ul className="space-y-1.5">
                  {topSignals.map((signal, idx) => {
                    const fullSignal = signals[idx];
                    const score = fullSignal?.strength_score;
                    return (
                      <li key={idx} className="text-xs flex items-start">
                        <span className="text-[#88ddff] mr-2">•</span>
                        <div className="flex-1">
                          <span className="text-[#ddd]">{signal}</span>
                          {score && (
                            <span className={`ml-2 ${getScoreColor(score)}`}>
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

            {/* Red Flags */}
            {mainConcerns.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[#ff4444] text-xs font-bold">⚠️ CONCERNS</span>
                </div>
                <ul className="space-y-1">
                  {mainConcerns.map((concern, idx) => {
                    const fullFlag = redFlags[idx];
                    return (
                      <li key={idx} className="text-xs flex items-start">
                        <span className="text-[#ff4444] mr-2">•</span>
                        <div className="flex-1">
                          <span className="text-[#ddd]">{concern}</span>
                          {fullFlag?.severity && (
                            <span className={`ml-2 text-xs ${
                              fullFlag.severity === 'high' ? 'text-[#ff4444]' : 
                              fullFlag.severity === 'medium' ? 'text-[#ffaa44]' : 
                              'text-[#888]'
                            }`}>
                              [{fullFlag.severity}]
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
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