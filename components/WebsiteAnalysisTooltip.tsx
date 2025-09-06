'use client';

import React from 'react';
import { createPortal } from 'react-dom';

interface WebsiteAnalysisTooltipProps {
  fullAnalysis: {
    exceptional_signals?: string[];
    missing_elements?: string[];
    quick_take?: string;
    quick_assessment?: string;
    category_scores?: Record<string, number>;
    proceed_to_stage_2?: boolean;
    type_reasoning?: string;
    parsed_content?: {
      text_content?: string;
      links_with_context?: Array<{url: string, text: string, type: string}>;
      headers?: Array<{level: number, text: string}>;
    };
    full_analysis?: {
      report?: string;
      hidden_discoveries?: string[];
      red_flags?: string[];
      green_flags?: string[];
    };
  } | null;
  tooltip?: {
    one_liner: string;
    pros: string[];
    cons: string[];
  } | null;
  children: React.ReactNode;
  tokenId?: string;
  signalFeedback?: Record<string, any>;
  onFeedbackUpdate?: (feedback: Record<string, any>) => void;
  isAdmin?: boolean;
}

export function WebsiteAnalysisTooltip({ 
  fullAnalysis, 
  tooltip, 
  children,
  tokenId,
  signalFeedback,
  onFeedbackUpdate,
  isAdmin = false
}: WebsiteAnalysisTooltipProps) {
  const [showTooltip, setShowTooltip] = React.useState(false);
  const [tooltipPosition, setTooltipPosition] = React.useState<{ x: number; y: number; placement: 'above' | 'below' } | null>(null);
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);
  const [showSignalDetails, setShowSignalDetails] = React.useState<string | null>(null);
  const [localFeedback, setLocalFeedback] = React.useState<Record<string, any>>(signalFeedback || {});

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    setLocalFeedback(signalFeedback || {});
  }, [signalFeedback]);

  // Use new tooltip data if available, fallback to fullAnalysis
  if (!tooltip && !fullAnalysis) {
    return <>{children}</>;
  }

  // Extract data from new tooltip structure or fallback to old
  const pros = tooltip?.pros || fullAnalysis?.exceptional_signals || fullAnalysis?.full_analysis?.green_flags || [];
  const cons = tooltip?.cons || fullAnalysis?.missing_elements || fullAnalysis?.full_analysis?.red_flags || [];
  const oneLiner = tooltip?.one_liner || fullAnalysis?.quick_take || '';
  
  const { 
    quick_assessment,
    type_reasoning
  } = fullAnalysis || {};

  // Don't show tooltip if no data
  if (!oneLiner && !quick_assessment && pros.length === 0 && cons.length === 0) {
    return <>{children}</>;
  }

  // Use AI-generated one_liner or quick_take if available, otherwise fall back to pattern matching
  const getQuickTake = () => {
    // First, use the new one_liner if available
    if (oneLiner) {
      return `<span class="text-[#ddd]">${oneLiner}</span>`;
    }
    // Fallback to old quick_take format
    if (fullAnalysis?.quick_take) {
      const quick_take = fullAnalysis.quick_take;
      // Format the quick_take with colored spans
      const parts = quick_take.split(', but ');
      if (parts.length === 2) {
        return `<span class="text-[#00ff88]">${parts[0]}</span>, but <span class="text-[#ff4444]">${parts[1]}</span>`;
      } else if (quick_take.toLowerCase().includes('no real content') || quick_take.toLowerCase().includes('placeholder')) {
        return `<span class="text-[#ff4444]">${quick_take}</span>`;
      } else {
        return `<span class="text-[#00ff88]">${quick_take}</span>`;
      }
    }
    
    // Fallback to pattern matching for old data without quick_take
    if (!quick_assessment) return null;
    
    // Extract key positive and negative points to create a concise summary
    const extractKeyPoints = (text: string) => {
      // Common patterns to extract
      const hasInstitutional = text.match(/\$[\d.,]+[MKB]?\s*(institutional|trade|volume|usage)/i);
      const hasRealProduct = text.match(/(real|working|functional|live)\s*(platform|product|trading|usage|infrastructure)/i);
      const hasUsers = text.match(/(\d+[MK]?)\s*(users?|holders?|trades?)/i);
      const hasRevenue = text.match(/\$[\d.,]+[MKB]?\s*(revenue|earnings|volume)/i);
      
      // Negative patterns
      const noTeam = text.match(/(no team|anonymous|team\s*(info|information)\s*missing|lacks?\s*team)/i);
      const noAudit = text.match(/(no audit|unaudited|lacks?\s*audit|no security)/i);
      const noDocs = text.match(/(no docs|no documentation|lacks?\s*documentation)/i);
      const noGithub = text.match(/(no github|no code|lacks?\s*github)/i);
      const noSocial = text.match(/(no social|no community|lacks?\s*community)/i);
      
      // Build concise summary
      let positive = '';
      let negative = '';
      
      // Prioritize most important positives
      if (hasInstitutional) {
        positive = hasInstitutional[0];
      } else if (hasRevenue) {
        positive = hasRevenue[0];
      } else if (hasRealProduct) {
        positive = hasRealProduct[0];
      } else if (hasUsers) {
        positive = hasUsers[0];
      } else if (text.includes('DeFi')) {
        positive = 'DeFi platform';
      } else if (text.includes('payment')) {
        positive = 'Payment system';
      } else if (text.includes('NFT')) {
        positive = 'NFT platform';
      } else {
        // Fallback: extract first few words that seem positive
        const match = text.match(/([\w\s]+ (platform|token|protocol|ecosystem|project))/i);
        positive = match ? match[1] : 'Project';
      }
      
      // Collect key negatives (max 2-3)
      const negatives = [];
      if (noTeam) negatives.push('no team info');
      if (noAudit) negatives.push('no audits');
      if (noDocs && negatives.length < 2) negatives.push('no docs');
      if (noGithub && negatives.length < 2) negatives.push('no GitHub');
      if (noSocial && negatives.length < 2) negatives.push('no community');
      
      if (negatives.length > 0) {
        negative = negatives.slice(0, 2).join(' or ');
      } else if (text.includes('lacks')) {
        const lacksMatch = text.match(/lacks?\s+([^,\.]+)/i);
        negative = lacksMatch ? `lacks ${lacksMatch[1]}` : '';
      }
      
      // Format the final quick take
      if (positive && negative) {
        return `<span class="text-[#00ff88]">${positive}</span>, but <span class="text-[#ff4444]">${negative}</span>`;
      } else if (positive) {
        return `<span class="text-[#00ff88]">${positive}</span>`;
      } else if (negative) {
        return `<span class="text-[#ff4444]">${negative}</span>`;
      }
      
      // Fallback to shortened first sentence
      const firstSentence = text.split('.')[0].trim();
      if (firstSentence.length > 80) {
        return firstSentence.substring(0, 77) + '...';
      }
      return firstSentence;
    };
    
    return extractKeyPoints(quick_assessment);
  };

  const quickTakeDisplay = getQuickTake();

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const tooltipHeight = 350; // Estimated height
    const tooltipWidth = 450; // Max width
    
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

  const handleSignalFeedback = (signal: string, issue: string | null) => {
    if (!issue) {
      // Clear feedback for this signal
      const newFeedback = { ...localFeedback };
      delete newFeedback[signal];
      setLocalFeedback(newFeedback);
    } else {
      // Set feedback
      const newFeedback = {
        ...localFeedback,
        [signal]: {
          ...localFeedback[signal],
          issue,
          date: new Date().toISOString().split('T')[0],
          suggested_adjustment: issue === 'too_high' ? -2 : issue === 'too_low' ? 2 : 0
        }
      };
      setLocalFeedback(newFeedback);
    }
  };

  const handleSignalNote = (signal: string, note: string) => {
    if (!note.trim()) return;
    
    const newFeedback = {
      ...localFeedback,
      [signal]: {
        ...localFeedback[signal],
        note,
        date: new Date().toISOString().split('T')[0]
      }
    };
    setLocalFeedback(newFeedback);
  };

  const saveFeedback = async () => {
    if (!tokenId || !onFeedbackUpdate) return;
    
    try {
      const response = await fetch('/api/signal-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId, feedback: localFeedback })
      });
      
      if (response.ok) {
        onFeedbackUpdate(localFeedback);
        // Show success indicator (tooltip stays open)
        const button = document.querySelector('button:has-text("Save Feedback")');
        if (button) {
          button.textContent = '✓ Saved!';
          setTimeout(() => {
            button.textContent = 'Save Feedback';
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Failed to save feedback:', error);
    }
  };

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
          <div className="bg-[#1a1c1f] rounded-lg shadow-2xl border border-[#333] p-4 min-w-[350px] max-w-[450px] max-h-[80vh] overflow-y-auto scrollbar-hide">
            
            {/* Quick Take Section */}
            {quickTakeDisplay && (
              <div className="mb-3 pb-3 border-b border-[#2a2d31]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[#888] font-bold text-xs uppercase tracking-wider">Summary</span>
                </div>
                <div className="text-xs text-[#ddd] leading-relaxed" dangerouslySetInnerHTML={{ __html: quickTakeDisplay }} />
              </div>
            )}

            {/* Pros and Cons Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* PROS Section */}
              {pros.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 mb-2">
                    <span className="text-[#00ff88] text-xs font-bold">✓ PROS</span>
                  </div>
                  <ul className="space-y-1">
                    {pros.slice(0, 5).map((pro, idx) => {
                      // Shorten if too long
                      const shortPro = pro.length > 50 ? pro.substring(0, 47) + '...' : pro;
                      return (
                        <li key={idx} className="text-[11px] text-[#aaa] flex items-start">
                          <span className="text-[#00ff88] mr-1.5">•</span>
                          <span>{shortPro}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* CONS Section */}
              {cons.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 mb-2">
                    <span className="text-[#ff4444] text-xs font-bold">✗ CONS</span>
                  </div>
                  <ul className="space-y-1">
                    {cons.slice(0, 3).map((con, idx) => {
                      // Clean up and shorten
                      let cleanCon = con;
                      if (cleanCon.toLowerCase().startsWith('no ')) {
                        cleanCon = cleanCon.substring(3);
                      }
                      const shortCon = cleanCon.length > 50 ? cleanCon.substring(0, 47) + '...' : cleanCon;
                      
                      return (
                        <li key={idx} className="text-[11px] text-[#aaa] flex items-start">
                          <span className="text-[#ff4444] mr-1.5">•</span>
                          <span>{shortCon}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>

            {/* Why This Tier Section */}
            {type_reasoning && (
              <div className="mt-3 pt-3 border-t border-[#2a2d31]">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[#888] font-bold text-xs uppercase tracking-wider">🎯 Why This Tier?</span>
                </div>
                <div className="text-[11px] text-[#999] leading-relaxed italic">
                  &ldquo;{type_reasoning.split('.')[0].trim()}&rdquo;
                </div>
              </div>
            )}

            {/* Admin Signal Feedback Section */}
            {isAdmin && tokenId && (
              <div className="mt-3 pt-3 border-t border-[#2a2d31] bg-[#0f1011] -mx-4 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[#ff9500] font-bold text-xs uppercase tracking-wider">⚙️ Admin: Signal Feedback</span>
                </div>
                
                {/* Category Scores with Feedback */}
                {fullAnalysis?.category_scores && (
                  <div className="space-y-2">
                    {Object.entries(fullAnalysis.category_scores).map(([signal, score]) => {
                      const feedback = localFeedback[signal];
                      return (
                        <div key={signal} className="text-[11px]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[#888] capitalize">{signal.replace(/_/g, ' ')}</span>
                            <span className="text-[#ddd]">{score}/10</span>
                          </div>
                          
                          {/* Quick Feedback Buttons */}
                          <div className="flex gap-1 mb-1">
                            <button 
                              onClick={() => handleSignalFeedback(signal, 'too_high')}
                              className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                                feedback?.issue === 'too_high' 
                                  ? 'bg-red-900/50 text-red-400 border border-red-700' 
                                  : 'bg-[#1a1c1f] text-[#888] border border-[#333] hover:bg-[#222]'
                              }`}
                            >
                              Too High
                            </button>
                            <button 
                              onClick={() => handleSignalFeedback(signal, 'too_low')}
                              className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                                feedback?.issue === 'too_low' 
                                  ? 'bg-blue-900/50 text-blue-400 border border-blue-700' 
                                  : 'bg-[#1a1c1f] text-[#888] border border-[#333] hover:bg-[#222]'
                              }`}
                            >
                              Too Low
                            </button>
                            <button 
                              onClick={() => handleSignalFeedback(signal, 'incorrect')}
                              className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                                feedback?.issue === 'incorrect' 
                                  ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-700' 
                                  : 'bg-[#1a1c1f] text-[#888] border border-[#333] hover:bg-[#222]'
                              }`}
                            >
                              Wrong
                            </button>
                            {feedback && (
                              <button 
                                onClick={() => handleSignalFeedback(signal, null)}
                                className="px-2 py-0.5 rounded text-[10px] bg-[#1a1c1f] text-[#666] border border-[#333] hover:bg-[#222]"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                          
                          {/* Show feedback if exists */}
                          {feedback && (
                            <div className="mt-1 p-1 bg-[#1a1c1f] rounded border border-[#333]">
                              <div className="text-[10px] text-[#999]">
                                {feedback.issue && <span className="text-[#ff9500]">Issue: {feedback.issue}</span>}
                                {feedback.suggested_adjustment && (
                                  <span className="ml-2">Suggested: {feedback.suggested_adjustment > 0 ? '+' : ''}{feedback.suggested_adjustment}</span>
                                )}
                              </div>
                              {feedback.note && (
                                <div className="text-[10px] text-[#777] mt-0.5">{feedback.note}</div>
                              )}
                            </div>
                          )}
                          
                          {/* Expandable note input */}
                          {showSignalDetails === signal && (
                            <div className="mt-1">
                              <input
                                type="text"
                                placeholder="Add specific note..."
                                className="w-full px-2 py-1 bg-[#1a1c1f] border border-[#333] rounded text-[10px] text-[#ddd] placeholder-[#555]"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const target = e.target as HTMLInputElement;
                                    handleSignalNote(signal, target.value);
                                    setShowSignalDetails(null);
                                  }
                                }}
                                autoFocus
                              />
                            </div>
                          )}
                          
                          {!showSignalDetails && (
                            <button
                              onClick={() => setShowSignalDetails(signal)}
                              className="text-[10px] text-[#666] hover:text-[#888] mt-0.5"
                            >
                              + Add note
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* Save Button */}
                {Object.keys(localFeedback).length > 0 && (
                  <button
                    onClick={saveFeedback}
                    className="mt-3 w-full px-3 py-1.5 bg-[#ff9500] text-black rounded text-xs font-medium hover:bg-[#ffb033] transition-colors"
                  >
                    Save Feedback
                  </button>
                )}
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