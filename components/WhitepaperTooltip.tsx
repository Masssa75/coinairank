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
  whitepaperUrl,
  whitepaperTier,
  whitepaperQualityScore,
  whitepaperStoryAnalysis,
  whitepaperPhase2Comparison,
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
    // Check if we have analysis data
    const hasAnalysis = whitepaperStoryAnalysis || whitepaperPhase2Comparison;

    if (!hasAnalysis) {
      return (
        <div className="p-4 w-full">
          <div className="flex items-center gap-2 text-[#999] text-sm">
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
            className="absolute top-2 right-2 text-[#666] hover:text-white transition-colors z-10"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Simple Description */}
        {whitepaperStoryAnalysis?.simple_description && (
          <div className="mb-4">
            <h4 className="text-[#00ff88] text-sm font-semibold mb-2">What it does:</h4>
            <div className="text-sm text-[#ddd] leading-relaxed">
              {whitepaperStoryAnalysis.simple_description}
            </div>
          </div>
        )}

        {/* Phase 2 Summary */}
        {whitepaperPhase2Comparison?.summary && (
          <div>
            <h4 className="text-[#00ff88] text-sm font-semibold mb-2">Quality Assessment:</h4>
            <div className="text-sm text-[#ccc] leading-relaxed">
              {whitepaperPhase2Comparison.summary}
            </div>
          </div>
        )}

        {/* Whitepaper URL Link */}
        {whitepaperUrl && (
          <div className="mt-4 pt-4 border-t border-[#2a2d31]">
            <a
              href={whitepaperUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#00ff88] hover:underline flex items-center gap-1"
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

      {showTooltip && tooltipPosition && createPortal(
        <div
          ref={tooltipRef}
          className="fixed z-[9999] bg-[#111214] border border-[#2a2d31] rounded-lg shadow-2xl max-w-[650px] w-[650px]"
          style={{
            left: tooltipPosition.x - 325, // Center the tooltip
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