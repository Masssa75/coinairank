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
    tier_4_comparison: string | { why: string; result: string; compared_to: string };
    tier_3_comparison: string | { why: string; result: string; compared_to: string };
    tier_2_comparison: string | { why: string; result: string; compared_to: string };
    tier_1_comparison: string | { why: string; result: string; compared_to: string };
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
  isAdmin?: boolean;  // Add admin flag
  tokenId?: string;
  signalFeedback?: Record<string, any>;
  onFeedbackUpdate?: (feedback: Record<string, any>) => void;
  stage2Resources?: Record<string, any>;  // Stage 2 resources for link selection display
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
  isAdmin = false,
  tokenId,
  signalFeedback,
  onFeedbackUpdate,
  stage2Resources,
  tooltip,
  children 
}: SignalBasedTooltipProps) {
  const [showTooltip, setShowTooltip] = React.useState(false);
  const [isPersistent, setIsPersistent] = React.useState(false);  // Track if tooltip is clicked to persist
  const [selectedSignalIdx, setSelectedSignalIdx] = React.useState<number | null>(null);  // Track which signal reasoning to show
  const [tooltipPosition, setTooltipPosition] = React.useState<{ x: number; y: number; placement: 'above' | 'below' } | null>(null);
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);
  const [showSignalDetails, setShowSignalDetails] = React.useState<string | null>(null);
  const [localFeedback, setLocalFeedback] = React.useState<Record<string, any>>(signalFeedback || {});
  const [editingFeedback, setEditingFeedback] = React.useState<Record<string, string>>({});
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [isEditMode, setIsEditMode] = React.useState<Record<string, boolean>>({});
  const [showLinksSection, setShowLinksSection] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    setLocalFeedback(signalFeedback || {});
  }, [signalFeedback]);

  // Handle click outside to close persistent tooltip
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isPersistent && tooltipRef.current && !tooltipRef.current.contains(event.target as Node) && 
          containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsPersistent(false);
        setShowTooltip(false);
        setSelectedSignalIdx(null);
      }
    };

    if (isPersistent) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPersistent]);

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
    if (isPersistent) return;  // Don't show on hover if already persistent
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
    if (!isPersistent) {  // Only hide on mouse leave if not persistent
      setShowTooltip(false);
      setTooltipPosition(null);
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!containerRef.current) return;
    
    if (isPersistent) {
      // If already persistent, close it
      setIsPersistent(false);
      setShowTooltip(false);
      setSelectedSignalIdx(null);
    } else {
      // Make tooltip persistent
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
      setIsPersistent(true);
    }
  };

  const handleSignalFeedback = async (signal: string, issue: string | null) => {
    if (!issue) {
      // Clear feedback for this signal
      const newFeedback = { ...localFeedback };
      delete newFeedback[signal];
      setLocalFeedback(newFeedback);
      // Also clear editing state
      const newEditingFeedback = { ...editingFeedback };
      delete newEditingFeedback[signal];
      setEditingFeedback(newEditingFeedback);
      const newEditMode = { ...isEditMode };
      delete newEditMode[signal];
      setIsEditMode(newEditMode);
      
      // Persist deletion to database
      if (tokenId && onFeedbackUpdate) {
        try {
          const response = await fetch('/api/signal-feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tokenId, feedback: newFeedback })
          });
          
          if (response.ok) {
            onFeedbackUpdate(newFeedback);
          }
        } catch (error) {
          console.error('Failed to delete feedback:', error);
        }
      }
    } else {
      // Set feedback - preserve any note that's being typed
      const existingNote = editingFeedback[signal] || localFeedback[signal]?.note || '';
      const newFeedback = {
        ...localFeedback,
        [signal]: {
          ...localFeedback[signal],
          issue,
          note: existingNote,
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
        // Clear editing state and show success
        setEditingFeedback({});
        setIsEditMode({});
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch (error) {
      console.error('Failed to save feedback:', error);
    }
  };

  const handleSignalClick = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAdmin) {
      setSelectedSignalIdx(selectedSignalIdx === idx ? null : idx);
    }
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

  // Process links for admin section  
  const processLinksData = () => {
    // Try new database fields first, then fall back to old nested structure
    const discoveredLinks = websiteAnalysis?.discovered_links || 
                           websiteAnalysis?.parsed_content?.navigation?.all_links ||
                           websiteAnalysis?.parsed_content?.links_with_context || 
                           [];
                           
    const stage2Links = websiteAnalysis?.stage_2_links || [];
    
    // Create a map of selected URLs with their reasoning
    const selectedUrlsMap = new Map<string, string>();
    stage2Links.forEach((link: {url: string, reasoning: string}) => {
      selectedUrlsMap.set(link.url, link.reasoning);
    });
    
    // Helper function to normalize URLs for comparison
    const normalizeUrl = (url: string, baseUrl = 'https://www.brickken.com') => {
      if (url.startsWith('http')) return url;
      if (url.startsWith('/')) return baseUrl + url;
      return url;
    };
    
    // Group discovered links by type and add selection status with reasoning
    const linksByType: Record<string, Array<{url: string, text: string, selected: boolean, reasoning?: string}>> = {};
    const processedUrls = new Set<string>();
    
    // First, process all discovered links
    discoveredLinks.forEach((link: {url: string, text: string, type: string}) => {
      if (!linksByType[link.type]) {
        linksByType[link.type] = [];
      }
      
      // Check if this discovered link matches any stage 2 link
      const normalizedDiscovered = normalizeUrl(link.url);
      let isSelected = selectedUrlsMap.has(link.url) || selectedUrlsMap.has(normalizedDiscovered);
      let reasoning: string | undefined;
      
      // Find matching stage 2 link for reasoning
      if (!isSelected) {
        // Try reverse matching - check if any stage 2 link would normalize to this discovered link
        for (const [stage2Url, stage2Reasoning] of selectedUrlsMap.entries()) {
          const normalizedStage2 = normalizeUrl(stage2Url);
          if (normalizedStage2 === normalizedDiscovered || 
              stage2Url === normalizedDiscovered ||
              normalizedStage2 === link.url) {
            isSelected = true;
            reasoning = stage2Reasoning;
            processedUrls.add(stage2Url); // Mark this stage 2 URL as processed
            break;
          }
        }
      } else {
        reasoning = selectedUrlsMap.get(link.url) || selectedUrlsMap.get(normalizedDiscovered);
        if (selectedUrlsMap.has(link.url)) processedUrls.add(link.url);
        if (selectedUrlsMap.has(normalizedDiscovered)) processedUrls.add(normalizedDiscovered);
      }
      
      linksByType[link.type].push({
        url: link.url,
        text: link.text,
        selected: isSelected,
        reasoning: reasoning
      });
    });
    
    // Then, add any stage 2 links that weren't found in discovered links
    // These are AI-selected URLs that may not have been linked from the homepage
    stage2Links.forEach((stage2Link: {url: string, reasoning: string}) => {
      if (!processedUrls.has(stage2Link.url)) {
        // This stage 2 link wasn't matched with any discovered link
        // Add it as a new "other" type link
        if (!linksByType['other']) {
          linksByType['other'] = [];
        }
        
        linksByType['other'].push({
          url: stage2Link.url,
          text: 'AI-selected link', // Generic text since we don't have original link text
          selected: true,
          reasoning: stage2Link.reasoning
        });
      }
    });
    
    return linksByType;
  };

  const linksData = processLinksData();

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
            
            {websiteAnalysis?.html_length > 250000 && (
              <div className="text-[#f59e0b] text-sm mb-3 p-2 bg-[#f59e0b]/10 rounded">
                ⚠️ Website too large ({Math.round(websiteAnalysis.html_length / 1000)}K chars) - analysis skipped
              </div>
            )}
            
            {websiteAnalysis && extractionStatus !== 'completed' && (
              <div className="text-[#ef4444] text-sm mb-3 p-2 bg-[#ef4444]/10 rounded">
                ⚠️ Phase 1 extraction missing
              </div>
            )}
            
            {extractionStatus === 'completed' && !benchmarkComparison && !websiteAnalysis?.signal_evaluations && (
              <div className="text-[#ef4444] text-sm mb-3 p-2 bg-[#ef4444]/10 rounded">
                ⚠️ Phase 2 scoring not complete
              </div>
            )}
            
            {benchmarkComparison && !benchmarkComparison.signal_evaluations && !websiteAnalysis?.signal_evaluations && (
              <div className="text-[#ef4444] text-sm mb-3 p-2 bg-[#ef4444]/10 rounded">
                ⚠️ Signal evaluations not available
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
            {((benchmarkComparison?.signal_evaluations && benchmarkComparison.signal_evaluations.length > 0) || 
              (websiteAnalysis?.signal_evaluations && websiteAnalysis.signal_evaluations.length > 0)) ? (
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[#666] text-xs font-bold">KEY SIGNALS</span>
                </div>
                <ul className="space-y-1.5">
                  {(benchmarkComparison?.signal_evaluations || websiteAnalysis?.signal_evaluations || [])
                    .slice(0, 4) // Take top 4 signals
                    .sort((a: SignalEvaluation, b: SignalEvaluation) => a.assigned_tier - b.assigned_tier) // Sort by tier (best first)
                    .map((evalSignal: SignalEvaluation, idx: number) => {
                      const score = tierToScore(evalSignal.assigned_tier);
                      const isExpanded = selectedSignalIdx === idx;
                      return (
                        <li key={idx} className="text-xs">
                          <div className="flex items-start">
                            <span className="text-[#666] mr-2">•</span>
                            <div className="flex-1">
                              <span className="text-[#ddd]">{evalSignal.signal}</span>
                              <span 
                                className={`ml-2 font-bold ${getScoreColor(score)} ${isAdmin ? 'cursor-pointer hover:underline' : ''}`}
                                onClick={(e) => handleSignalClick(idx, e)}
                                title={isAdmin ? 'Click to see reasoning' : ''}
                              >
                                [{score}]
                              </span>
                            </div>
                          </div>
                          {/* Show reasoning if admin and signal is selected */}
                          {isAdmin && isExpanded && evalSignal.reasoning && (
                            <div className="mt-2 ml-4 p-2 bg-[#2a2d31] rounded text-[10px] text-[#999]">
                              <div className="font-semibold text-[#aaa] mb-1">Tier {evalSignal.assigned_tier} Reasoning:</div>
                              <div>{evalSignal.reasoning}</div>
                              {evalSignal.progression && (
                                <div className="mt-2 text-[9px]">
                                  <div>• vs Tier 4: {typeof evalSignal.progression.tier_4_comparison === 'object' ? evalSignal.progression.tier_4_comparison.why : evalSignal.progression.tier_4_comparison}</div>
                                  <div>• vs Tier 3: {typeof evalSignal.progression.tier_3_comparison === 'object' ? evalSignal.progression.tier_3_comparison.why : evalSignal.progression.tier_3_comparison}</div>
                                  <div>• vs Tier 2: {typeof evalSignal.progression.tier_2_comparison === 'object' ? evalSignal.progression.tier_2_comparison.why : evalSignal.progression.tier_2_comparison}</div>
                                  <div>• vs Tier 1: {typeof evalSignal.progression.tier_1_comparison === 'object' ? evalSignal.progression.tier_1_comparison.why : evalSignal.progression.tier_1_comparison}</div>
                                </div>
                              )}
                              
                              {/* Admin Feedback Controls - Only show when reasoning is visible */}
                              {tokenId && (
                                <div className="mt-3 pt-2 border-t border-[#333]">
                                  <div className="text-[#ff9500] text-[9px] font-bold mb-2">ADMIN: Signal Feedback</div>
                                  <div className="flex gap-1">
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSignalFeedback(evalSignal.signal, 'too_high');
                                      }}
                                      className={`px-2 py-0.5 rounded text-[9px] transition-colors ${
                                        localFeedback[evalSignal.signal]?.issue === 'too_high' 
                                          ? 'bg-red-900/50 text-red-400 border border-red-700' 
                                          : 'bg-[#1a1c1f] text-[#888] border border-[#333] hover:bg-[#222]'
                                      }`}
                                    >
                                      Too High
                                    </button>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSignalFeedback(evalSignal.signal, 'too_low');
                                      }}
                                      className={`px-2 py-0.5 rounded text-[9px] transition-colors ${
                                        localFeedback[evalSignal.signal]?.issue === 'too_low' 
                                          ? 'bg-blue-900/50 text-blue-400 border border-blue-700' 
                                          : 'bg-[#1a1c1f] text-[#888] border border-[#333] hover:bg-[#222]'
                                      }`}
                                    >
                                      Too Low
                                    </button>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSignalFeedback(evalSignal.signal, 'incorrect');
                                      }}
                                      className={`px-2 py-0.5 rounded text-[9px] transition-colors ${
                                        localFeedback[evalSignal.signal]?.issue === 'incorrect' 
                                          ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-700' 
                                          : 'bg-[#1a1c1f] text-[#888] border border-[#333] hover:bg-[#222]'
                                      }`}
                                    >
                                      Wrong
                                    </button>
                                    {localFeedback[evalSignal.signal] && (
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleSignalFeedback(evalSignal.signal, null);
                                        }}
                                        className="px-2 py-0.5 rounded text-[9px] bg-[#1a1c1f] text-[#666] border border-[#333] hover:bg-[#222]"
                                      >
                                        Clear
                                      </button>
                                    )}
                                  </div>
                                  
                                  {/* Show saved feedback OR edit mode, not both */}
                                  {localFeedback[evalSignal.signal] && !isEditMode[evalSignal.signal] ? (
                                    <div className="mt-2 p-2 bg-[#1a1c1f]/50 border border-[#333] rounded">
                                      <div className="text-[9px] text-[#999]">
                                        Marked as: <span className="text-[#ff9500]">{localFeedback[evalSignal.signal].issue}</span>
                                      </div>
                                      {localFeedback[evalSignal.signal].note && (
                                        <div className="mt-1 text-[9px] text-[#aaa]">Note: {localFeedback[evalSignal.signal].note}</div>
                                      )}
                                      <div className="mt-2 flex gap-1">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setIsEditMode({ ...isEditMode, [evalSignal.signal]: true });
                                            setEditingFeedback({ ...editingFeedback, [evalSignal.signal]: localFeedback[evalSignal.signal]?.note || '' });
                                          }}
                                          className="px-2 py-0.5 bg-[#222] text-[#888] rounded text-[9px] hover:bg-[#333] transition-colors"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleSignalFeedback(evalSignal.signal, null);
                                          }}
                                          className="px-2 py-0.5 bg-[#222] text-red-400 rounded text-[9px] hover:bg-[#333] transition-colors"
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    /* Text input for new feedback or editing */
                                    <div className="mt-2">
                                      <input
                                        type="text"
                                        placeholder="Add specific feedback note..."
                                        value={editingFeedback[evalSignal.signal] !== undefined ? editingFeedback[evalSignal.signal] : ''}
                                        onChange={(e) => {
                                          const note = e.target.value;
                                          setEditingFeedback({ ...editingFeedback, [evalSignal.signal]: note });
                                          // Only update localFeedback if there's an issue selected
                                          if (localFeedback[evalSignal.signal]?.issue) {
                                            const newFeedback = {
                                              ...localFeedback,
                                              [evalSignal.signal]: {
                                                ...localFeedback[evalSignal.signal],
                                                note,
                                                date: new Date().toISOString().split('T')[0]
                                              }
                                            };
                                            setLocalFeedback(newFeedback);
                                          }
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full px-2 py-1 bg-[#1a1c1f] border border-[#333] rounded text-[9px] text-[#ddd] placeholder-[#555]"
                                      />
                                      {isEditMode[evalSignal.signal] && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setIsEditMode({ ...isEditMode, [evalSignal.signal]: false });
                                            setEditingFeedback({ ...editingFeedback, [evalSignal.signal]: '' });
                                          }}
                                          className="mt-1 px-2 py-0.5 bg-[#222] text-[#666] rounded text-[9px] hover:bg-[#333] transition-colors"
                                        >
                                          Cancel Edit
                                        </button>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* Save button only if there are unsaved changes */}
                                  {Object.keys(editingFeedback).length > 0 && !saveSuccess && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        saveFeedback();
                                      }}
                                      className="mt-2 px-2 py-1 bg-[#ff9500] text-black rounded text-[9px] font-medium hover:bg-[#ffb033] transition-colors"
                                    >
                                      Save All Feedback
                                    </button>
                                  )}
                                  
                                  {/* Success message */}
                                  {saveSuccess && (
                                    <div className="mt-2 px-2 py-1 bg-green-900/30 text-green-400 rounded text-[9px] font-medium">
                                      ✓ Feedback saved successfully
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </div>
            ) : (topSignals && topSignals.length > 0) ? (
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
            ) : (
              // Fallback to simple pros/cons display if no signals
              (tooltip?.pros || tooltip?.cons) && (
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {/* PROS Section */}
                  {tooltip?.pros && (
                    <div>
                      <div className="flex items-center gap-1 mb-2">
                        <span className="text-[#00ff88] text-xs font-bold">✓ PROS</span>
                      </div>
                      <ul className="space-y-1">
                        {tooltip.pros.slice(0, 5).map((pro, idx) => {
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
                  {tooltip?.cons && (
                    <div>
                      <div className="flex items-center gap-1 mb-2">
                        <span className="text-[#ff4444] text-xs font-bold">✗ CONS</span>
                      </div>
                      <ul className="space-y-1">
                        {tooltip.cons.slice(0, 3).map((con, idx) => {
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
              )
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
            {/* Admin Links Section - Expandable */}
            {isAdmin && linksData && Object.keys(linksData).length > 0 && (
              <div className="mt-3 pt-3 border-t border-[#2a2d31]">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowLinksSection(!showLinksSection);
                  }}
                  className="flex items-center gap-2 text-[10px] text-[#ff9500] font-bold hover:text-[#ffb033] transition-colors cursor-pointer"
                >
                  <span>{showLinksSection ? '▼' : '▶'}</span>
                  <span>ADMIN: DISCOVERED LINKS ({Object.values(linksData).flat().length})</span>
                </button>
                
                {showLinksSection && (
                  <div className="mt-2 space-y-3 max-h-[300px] overflow-y-auto">
                    {/* Selected for Stage 2 section at top */}
                    {(() => {
                      const selectedLinks = Object.entries(linksData)
                        .flatMap(([type, links]) => 
                          links.filter(l => l.selected).map(l => ({ ...l, type }))
                        );
                      
                      if (selectedLinks.length > 0) {
                        return (
                          <div className="bg-[#001a0d] p-3 rounded border border-[#00ff88]/30 mb-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#00ff88]">
                                ✓ Selected for Stage 2 ({selectedLinks.length})
                              </span>
                            </div>
                            <div className="space-y-2">
                              {selectedLinks.map((link, idx) => {
                                const displayUrl = link.url.length > 50 ? 
                                  link.url.substring(0, 47) + '...' : 
                                  link.url;
                                const displayText = link.text && link.text !== 'No text' && link.text.length > 30 ?
                                  link.text.substring(0, 27) + '...' :
                                  link.text;
                                const typeColor = link.type === 'github' ? 'text-[#8b5cf6]' : 
                                                 link.type === 'documentation' ? 'text-[#10b981]' :
                                                 link.type === 'social' ? 'text-[#3b82f6]' : 'text-[#6b7280]';
                                
                                return (
                                  <div key={idx} className="text-[9px]">
                                    <div className="flex items-start gap-2">
                                      <div className="flex-shrink-0 mt-0.5">
                                        <span className="text-[#00ff88]">✓</span>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <div className="text-[#aaa] font-mono truncate flex-1">
                                            {displayUrl}
                                          </div>
                                          <span className={`text-[8px] px-1.5 py-0.5 rounded ${typeColor} bg-current/10`}>
                                            {link.type}
                                          </span>
                                        </div>
                                        {displayText && displayText !== 'No text' && (
                                          <div className="text-[#666] italic truncate mt-0.5">
                                            &ldquo;{displayText}&rdquo;
                                          </div>
                                        )}
                                        {/* Show reasoning for why this link was selected */}
                                        {link.reasoning && (
                                          <div className="text-[#888] text-[8px] mt-1 pl-2 border-l border-[#00ff88]/30">
                                            💡 {link.reasoning}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    
                    {/* All discovered links sections */}
                    {Object.entries(linksData).map(([type, links]) => {
                      const selectedCount = links.filter(l => l.selected).length;
                      const typeColor = type === 'github' ? 'text-[#8b5cf6]' : 
                                       type === 'documentation' ? 'text-[#10b981]' :
                                       type === 'social' ? 'text-[#3b82f6]' : 'text-[#6b7280]';
                      
                      return (
                        <div key={type} className="bg-[#0f1011] p-2 rounded border border-[#333]">
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${typeColor}`}>
                              {type.replace('_', ' ')} ({links.length})
                            </span>
                            {selectedCount > 0 && (
                              <span className="text-[9px] text-[#00ff88] bg-[#00ff88]/10 px-1.5 py-0.5 rounded">
                                {selectedCount} chosen
                              </span>
                            )}
                          </div>
                          
                          <div className="space-y-1">
                            {links.map((link, idx) => {
                              // Shorten URL for display
                              const displayUrl = link.url.length > 50 ? 
                                link.url.substring(0, 47) + '...' : 
                                link.url;
                              
                              // Shorten link text
                              const displayText = link.text && link.text !== 'No text' && link.text.length > 30 ?
                                link.text.substring(0, 27) + '...' :
                                link.text;
                              
                              return (
                                <div key={idx} className="flex items-start gap-2 text-[9px]">
                                  <div className="flex-shrink-0 mt-0.5">
                                    {link.selected ? (
                                      <span className="text-[#00ff88]">✓</span>
                                    ) : (
                                      <span className="text-[#444]">○</span>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-[#aaa] font-mono truncate">
                                      {displayUrl}
                                    </div>
                                    {displayText && displayText !== 'No text' && (
                                      <div className="text-[#666] italic truncate mt-0.5">
                                        &ldquo;{displayText}&rdquo;
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    
                    <div className="text-[9px] text-[#666] italic pt-2 border-t border-[#333]">
                      ✓ = Selected for Stage 2 analysis • ○ = Discovered but not used
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Show click hint for admins */}
            {isPersistent && isAdmin && benchmarkComparison?.signal_evaluations && (
              <div className="mt-3 pt-3 border-t border-[#2a2d31] text-[10px] text-[#666]">
                💡 Click on signal scores to see AI reasoning
              </div>
            )}

            {/* Removed standalone admin feedback section - now integrated into signal reasoning */}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}