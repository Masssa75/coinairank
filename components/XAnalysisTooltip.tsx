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
          <div className="bg-[#1a1c1f] border border-[#2a2d31] rounded-lg shadow-2xl text-white relative" style={{ width: '500px' }}>
            <div className="p-4 w-full">
              {isPersistent && (
                <button
                  onClick={handleCloseTooltip}
                  className="absolute top-2 right-2 text-[#666] hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Tier and Score */}
              {(() => {
                const tier = analysisData?.tier_name || analysisData?.final_tier;
                const score = analysisData?.final_score;
                const tierDisplay = typeof tier === 'number' ?
                  (tier === 1 ? 'ALPHA' : tier === 2 ? 'SOLID' : tier === 3 ? 'BASIC' : 'TRASH') : tier;

                return tierDisplay && (
                  <div className="mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[#666] text-sm">Tier:</span>
                      <span className={`px-2 py-1 rounded text-xs font-semibold uppercase ${
                        tierDisplay === 'ALPHA' ? 'bg-[#00ff88] text-black' :
                        tierDisplay === 'SOLID' ? 'bg-[#ffcc00] text-black' :
                        tierDisplay === 'BASIC' ? 'bg-[#ff8800] text-black' :
                        'bg-[#ff4444] text-white'
                      }`}>
                        {tierDisplay}
                      </span>
                      {score && (
                        <span className="text-[#ccc] text-sm">({score}/100)</span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Tweet Breakdown */}
              {(() => {
                // Use x_raw_tweets from props for full tweet breakdown
                const rawTweets = analysisData?.x_raw_tweets || [];
                if (rawTweets.length === 0) return null;

                // Simple categorization based on content
                const categories = rawTweets.reduce((acc: Record<string, number>, tweet: any) => {
                  const text = tweet.text?.toLowerCase() || '';
                  if (text.includes('gm ') || text.includes('gizamorning') || text.includes('happy sunday')) {
                    acc['community'] = (acc['community'] || 0) + 1;
                  } else if (text.includes('introducing') || text.includes('live on') || text.includes('partner')) {
                    acc['announcements'] = (acc['announcements'] || 0) + 1;
                  } else if (text.includes('milestone') || text.includes('crossed') || text.includes('volume')) {
                    acc['milestones'] = (acc['milestones'] || 0) + 1;
                  } else {
                    acc['engagement'] = (acc['engagement'] || 0) + 1;
                  }
                  return acc;
                }, {});

                const total = rawTweets.length;
                const topCategories = Object.entries(categories)
                  .sort(([,a], [,b]) => (b as number) - (a as number))
                  .slice(0, 3);

                return (
                  <div className="mb-3">
                    <h4 className="text-[#00ff88] text-sm font-medium mb-2 flex items-center gap-1">
                      <Radio className="w-3 h-3" />
                      Tweet Breakdown ({total} tweets)
                    </h4>
                    <div className="flex gap-3 text-xs text-[#ccc]">
                      {topCategories.map(([category, count]) => (
                        <span key={category}>
                          {Math.round((count / total) * 100)}% {category}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Key Signals */}
              {signals && signals.length > 0 && (
                <div className="mb-3">
                  <h4 className="text-[#00ff88] text-sm font-medium mb-2 flex items-center gap-1">
                    <Radio className="w-3 h-3" />
                    Key Signals
                  </h4>
                  <div className="space-y-1">
                    {signals.slice(0, 3).map((signal: any, idx: number) => (
                      <div key={idx} className="text-[#ccc] text-sm flex items-start gap-2">
                        <Star className="w-3 h-3 text-[#00ff88] mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <span className="block">{signal.signal}</span>
                          {signal.importance && (
                            <span className="block text-[#999] text-xs mt-1">{signal.importance}</span>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            {signal.date && (
                              <span className="text-[#666] text-xs">{signal.date}</span>
                            )}
                            {(() => {
                              // Add color-coded score at the end
                              const score = signal.success_indicator;
                              if (!score) return null;
                              const numScore = typeof score === 'string' ? parseInt(score) : score;
                              if (isNaN(numScore)) return null;

                              const getScoreColor = (score: number) => {
                                if (score >= 8) return 'text-[#00ff88]'; // green
                                if (score >= 6) return 'text-[#ffcc00]'; // yellow
                                if (score >= 4) return 'text-[#ff8800]'; // orange
                                return 'text-[#ff4444]'; // red
                              };

                              return (
                                <span className={`text-xs font-medium ${getScoreColor(numScore)}`}>
                                  {numScore}/10
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No analysis available */}
              {!signals?.length && (
                <div className="text-center py-4">
                  <Twitter className="w-8 h-8 text-[#666] mx-auto mb-2" />
                  <p className="text-sm text-[#999]">No X analysis data available</p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}