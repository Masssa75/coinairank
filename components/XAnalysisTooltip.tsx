'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Info,
  Twitter,
  MessageCircle,
  TrendingUp,
  Users,
  Star,
  Check,
  X,
  Radio
} from 'lucide-react';

interface XSignal {
  signal: string;
  tweet_ref?: string;
  date?: string;
  category?: string;
  details?: {
    type?: string;
    metrics?: string;
    names?: string;
    urls?: string;
  };
  importance?: string;
  success_indicator?: number;
  verifiable?: boolean;
  similar_to?: string;
}

interface XRedFlag {
  flag: string;
  severity?: 'high' | 'medium' | 'low';
  evidence?: string;
}

interface XAnalysisTooltipProps {
  analysisData?: any;
  signals?: XSignal[];
  redFlags?: XRedFlag[];
  analysisSummary?: string;
  strongestSignal?: string;
  analyzedAt?: string;
  twitterHandle?: string;
  children: React.ReactNode;
}

export function XAnalysisTooltip({
  analysisData,
  signals = [],
  redFlags = [],
  analysisSummary,
  strongestSignal,
  analyzedAt,
  twitterHandle,
  children
}: XAnalysisTooltipProps) {
  const [showTooltip, setShowTooltip] = React.useState(false);
  const [isPersistent, setIsPersistent] = React.useState(false);
  const [tooltipPosition, setTooltipPosition] = React.useState<{ x: number; y: number; placement: 'above' | 'below' } | null>(null);
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const calculateTooltipPosition = React.useCallback((element: HTMLElement): { x: number; y: number; placement: 'above' | 'below' } => {
    const rect = element.getBoundingClientRect();
    const tooltipHeight = 400;
    const tooltipWidth = 500;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const spaceAbove = rect.top;
    const spaceBelow = viewportHeight - rect.bottom;
    const placement: 'above' | 'below' = spaceBelow >= tooltipHeight || spaceBelow > spaceAbove ? 'below' : 'above';

    let x = rect.left + rect.width / 2 - tooltipWidth / 2;
    let y = placement === 'below' ? rect.bottom + 8 : rect.top - tooltipHeight - 8;

    if (x < 8) x = 8;
    if (x + tooltipWidth > viewportWidth - 8) x = viewportWidth - tooltipWidth - 8;
    if (y < 8) y = 8;
    if (y + tooltipHeight > viewportHeight - 8) y = viewportHeight - tooltipHeight - 8;

    return { x, y, placement };
  }, []);

  const handleMouseEnter = React.useCallback(() => {
    if (isPersistent) return;
    if (containerRef.current) {
      const position = calculateTooltipPosition(containerRef.current);
      setTooltipPosition(position);
      setShowTooltip(true);
    }
  }, [isPersistent, calculateTooltipPosition]);

  const handleMouseLeave = React.useCallback(() => {
    if (isPersistent) return;
    setShowTooltip(false);
    setTooltipPosition(null);
  }, [isPersistent]);

  const handleClick = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (containerRef.current) {
      const position = calculateTooltipPosition(containerRef.current);
      setTooltipPosition(position);
      setShowTooltip(true);
      setIsPersistent(true);
    }
  }, [calculateTooltipPosition]);

  const handleCloseTooltip = React.useCallback(() => {
    setShowTooltip(false);
    setIsPersistent(false);
    setTooltipPosition(null);
  }, []);

  React.useEffect(() => {
    if (!isPersistent) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node) &&
          containerRef.current && !containerRef.current.contains(event.target as Node)) {
        handleCloseTooltip();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPersistent, handleCloseTooltip]);

  const getCategoryIcon = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'partnership': return <Users className="w-4 h-4" />;
      case 'product_launch': return <Star className="w-4 h-4" />;
      case 'technical_achievement': return <TrendingUp className="w-4 h-4" />;
      case 'community': return <MessageCircle className="w-4 h-4" />;
      default: return <Twitter className="w-4 h-4" />;
    }
  };

  return (
    <>
      <div
        ref={containerRef}
        className="inline-block"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        style={{ cursor: 'pointer' }}
      >
        {children}
      </div>

      {mounted && showTooltip && tooltipPosition && createPortal(
        <div
          ref={tooltipRef}
          className={`fixed z-[999999] ${isPersistent ? 'pointer-events-auto' : 'pointer-events-none'}`}
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            maxWidth: '500px',
            width: '500px'
          }}
        >
          <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-4 text-white relative">
            {isPersistent && (
              <button
                onClick={handleCloseTooltip}
                className="absolute top-2 right-2 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {strongestSignal && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm font-medium text-gray-300">Strongest Signal</span>
                </div>
                <p className="text-sm text-gray-200 leading-relaxed">{strongestSignal}</p>
              </div>
            )}

            {signals && signals.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-medium text-gray-300">
                    Signals Found ({signals.length})
                  </span>
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {signals.slice(0, 5).map((signal, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-2 bg-gray-800 rounded">
                      {getCategoryIcon(signal.category || '')}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-200 leading-relaxed line-clamp-2">
                          {signal.signal}
                        </p>
                        {signal.category && (
                          <span className="inline-block mt-1 px-1.5 py-0.5 bg-gray-700 text-xs rounded text-gray-300">
                            {signal.category.replace('_', ' ')}
                          </span>
                        )}
                        {signal.success_indicator && (
                          <span className="inline-block mt-1 ml-1 px-1.5 py-0.5 bg-blue-600 text-xs rounded text-white">
                            Score: {signal.success_indicator}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {signals.length > 5 && (
                    <p className="text-xs text-gray-400 text-center py-1">
                      And {signals.length - 5} more signals...
                    </p>
                  )}
                </div>
              </div>
            )}

            {redFlags && redFlags.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-sm font-medium text-gray-300">
                    Red Flags ({redFlags.length})
                  </span>
                </div>
                <div className="space-y-2 max-h-24 overflow-y-auto">
                  {redFlags.map((flag, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-2 bg-red-900/20 border border-red-800 rounded">
                      <AlertTriangle className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-red-200 leading-relaxed">
                        {typeof flag === 'string' ? flag : flag.flag}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analyzedAt && (
              <div className="text-xs text-gray-500 border-t border-gray-700 pt-2 mt-3">
                Analyzed: {new Date(analyzedAt).toLocaleDateString()}
              </div>
            )}

            {!signals?.length && !redFlags?.length && !analysisSummary && (
              <div className="text-center py-4">
                <Twitter className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No X analysis data available</p>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}