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
      <div className="p-4 w-full">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#00ff88]" />
            Whitepaper Analysis
          </h3>
          {isPersistent && (
            <button
              onClick={() => {
                setIsPersistent(false);
                setShowTooltip(false);
              }}
              className="text-[#666] hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Tier and Score */}
        {whitepaperTier && (
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <span className="text-[#666] text-sm">Tier:</span>
              <span className={`px-2 py-1 rounded text-xs font-semibold uppercase ${
                whitepaperTier === 'ALPHA' ? 'bg-[#00ff88] text-black' :
                whitepaperTier === 'SOLID' ? 'bg-[#ffcc00] text-black' :
                whitepaperTier === 'BASIC' ? 'bg-[#ff8800] text-black' :
                'bg-[#ff4444] text-white'
              }`}>
                {whitepaperTier}
              </span>
              {whitepaperScore && (
                <span className="text-[#ccc] text-sm">({whitepaperScore}/100)</span>
              )}
            </div>
          </div>
        )}

        {/* Whitepaper URL */}
        {whitepaperUrl && (
          <div className="mb-3">
            <span className="text-[#666] text-sm">Document: </span>
            <a
              href={whitepaperUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#00ff88] hover:underline text-sm"
            >
              View Whitepaper ↗
            </a>
          </div>
        )}

        {/* Key Signals */}
        {whitepaperSignals && whitepaperSignals.length > 0 && (
          <div className="mb-3">
            <h4 className="text-[#00ff88] text-sm font-medium mb-2 flex items-center gap-1">
              <Radio className="w-3 h-3" />
              Key Signals
            </h4>
            <div className="space-y-1">
              {whitepaperSignals.slice(0, 3).map((signal: any, idx: number) => (
                <div key={idx} className="text-[#ccc] text-sm flex items-start gap-2">
                  <Star className="w-3 h-3 text-[#00ff88] mt-0.5 flex-shrink-0" />
                  <span>{typeof signal === 'string' ? signal : signal.signal || signal.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Red Flags */}
        {whitepaperRedFlags && whitepaperRedFlags.length > 0 && (
          <div className="mb-3">
            <h4 className="text-red-400 text-sm font-medium mb-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Concerns
            </h4>
            <div className="space-y-1">
              {whitepaperRedFlags.slice(0, 2).map((flag: any, idx: number) => (
                <div key={idx} className="text-red-300 text-sm flex items-start gap-2">
                  <AlertTriangle className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
                  <span>{typeof flag === 'string' ? flag : flag.flag || flag.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Green Flags */}
        {whitepaperGreenFlags && whitepaperGreenFlags.length > 0 && (
          <div className="mb-3">
            <h4 className="text-green-400 text-sm font-medium mb-2 flex items-center gap-1">
              <Check className="w-3 h-3" />
              Strengths
            </h4>
            <div className="space-y-1">
              {whitepaperGreenFlags.slice(0, 2).map((flag: any, idx: number) => (
                <div key={idx} className="text-green-300 text-sm flex items-start gap-2">
                  <Check className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
                  <span>{typeof flag === 'string' ? flag : flag.flag || flag.description}</span>
                </div>
              ))}
            </div>
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