'use client';

import React from 'react';
import { createPortal } from 'react-dom';

interface ContractVerificationTooltipProps {
  verification: {
    found_on_site: boolean;
    confidence: 'high' | 'medium' | 'low';
    note?: string;
  } | null;
  isImposter?: boolean;
  children: React.ReactNode;
}

export function ContractVerificationTooltip({ verification, isImposter, children }: ContractVerificationTooltipProps) {
  const [showTooltip, setShowTooltip] = React.useState(false);
  const [tooltipPosition, setTooltipPosition] = React.useState<{ x: number; y: number; placement: 'above' | 'below' } | null>(null);
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!verification) {
    return <>{children}</>;
  }

  const getStatus = () => {
    // Verified imposter (admin-confirmed) takes priority
    if (isImposter === true) {
      return {
        title: 'Verified Imposter',
        color: 'red',
        bgColor: 'bg-red-500',
        textColor: 'text-red-400',
        borderColor: 'border-red-500/30'
      };
    } else if (verification.found_on_site) {
      return {
        title: 'Contract Verified',
        color: 'green',
        bgColor: 'bg-green-500',
        textColor: 'text-green-400',
        borderColor: 'border-[#2a2d31]'
      };
    } else {
      return {
        title: 'Warning: Possible Imposter',
        color: 'orange',
        bgColor: 'bg-orange-500',
        textColor: 'text-orange-400',
        borderColor: 'border-orange-500/30'
      };
    }
  };

  const status = getStatus();

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const tooltipHeight = 120; // Estimated height for compact tooltip
    const tooltipWidth = 280; // Width for compact tooltip
    
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

  const getIcon = () => {
    // Verified imposter (admin-confirmed) takes priority
    if (isImposter === true) {
      // Red X or ban icon for verified imposter
      return (
        <svg className="w-4 h-4 text-red-500 cursor-help" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path>
        </svg>
      );
    } else if (verification.found_on_site) {
      // Green shield icon
      return (
        <svg className="w-4 h-4 text-green-500 cursor-help" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
        </svg>
      );
    } else {
      // Orange warning triangle for possible imposter
      return (
        <svg className="w-4 h-4 text-orange-500 cursor-help" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path>
        </svg>
      );
    }
  };

  return (
    <>
      <div 
        ref={containerRef}
        className="inline-flex items-center"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
        {getIcon()}
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
          <div className={`bg-[#1a1c1f] rounded-lg shadow-2xl border ${status.borderColor} p-3 w-[280px]`}>
            
            {/* Status Header */}
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-3 h-3 rounded-full ${status.bgColor}`}></div>
              <span className={`font-semibold ${status.textColor} text-sm`}>{status.title}</span>
            </div>
            
            {/* Confidence Level */}
            <p className="text-xs text-[#888] mb-2">
              Confidence: <span className="text-[#ddd] capitalize">{verification.confidence}</span>
            </p>
            
            {/* Note */}
            {isImposter === true ? (
              <p className="text-xs text-[#aaa] leading-relaxed">
                This project has been manually verified as an imposter by an administrator.
              </p>
            ) : (
              verification.note && (
                <p className="text-xs text-[#aaa] leading-relaxed">{verification.note}</p>
              )
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