'use client';

import { useState, useEffect, useCallback } from 'react';
import { NETWORKS, type NetworkKey } from '@/lib/validation';
import { getProjectStatus, getProjectStages, type ProjectStatus, type ProjectStage } from '@/lib/projectStatus';

interface AddTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface TokenResponse {
  success: boolean;
  message: string;
  symbol?: string;
  warning?: boolean;
  needsWebsite?: boolean;
  error?: string;
  tokenId?: number; // This is the projectId from the API
  contractAddress?: string;
  network?: string;
}

export function AddTokenModal({ isOpen, onClose, onSuccess }: AddTokenModalProps) {
  const [contractAddress, setContractAddress] = useState('');
  const [network, setNetwork] = useState<NetworkKey>('ethereum');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [showWebsiteInput, setShowWebsiteInput] = useState(false);
  const [manualWebsiteUrl, setManualWebsiteUrl] = useState('');
  const [pendingTokenData, setPendingTokenData] = useState<{address: string, network: string, symbol?: string} | null>(null);
  
  // Progress tracking states
  const [showProgressTracker, setShowProgressTracker] = useState(false);
  const [submittedProject, setSubmittedProject] = useState<any>(null);
  const [projectStatus, setProjectStatus] = useState<ProjectStatus | null>(null);
  const [projectStages, setProjectStages] = useState<ProjectStage[]>([]);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Fetch project status from database
  const fetchProjectStatus = useCallback(async (projectId: number) => {
    try {
      const response = await fetch(`/api/crypto-projects-rated?id=${projectId}`);
      if (!response.ok) return null;
      
      const data = await response.json();
      const project = data.projects?.[0];
      if (!project) return null;
      
      const status = getProjectStatus(project);
      const stages = getProjectStages(project, isAdmin);
      
      setProjectStatus(status);
      setProjectStages(stages);
      setSubmittedProject(project);
      
      return status;
    } catch (err) {
      console.error('Error fetching project status:', err);
      return null;
    }
  }, []);

  // Start progress tracking polling
  const startProgressTracking = useCallback((projectId: number, symbol: string, contractAddress: string, network: string) => {
    setShowProgressTracker(true);
    setSubmittedProject({ id: projectId, symbol, contract_address: contractAddress, network });
    
    // Initial status fetch
    fetchProjectStatus(projectId);
    
    // Set up polling every 10 seconds
    const interval = setInterval(async () => {
      const status = await fetchProjectStatus(projectId);
      if (status?.isComplete || status?.hasError) {
        // Stop polling when complete or failed
        clearInterval(interval);
        setPollingInterval(null);
      }
    }, 10000);
    
    setPollingInterval(interval);
  }, [fetchProjectStatus, isAdmin]);

  // Check admin status when modal opens
  useEffect(() => {
    if (isOpen) {
      // Check admin status from localStorage or API
      const checkAdminStatus = async () => {
        try {
          const response = await fetch('/api/admin/auth', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}) 
          });
          setIsAdmin(response.ok);
        } catch {
          setIsAdmin(false);
        }
      };
      checkAdminStatus();
    }
  }, [isOpen]);

  // Cleanup polling on unmount or modal close
  useEffect(() => {
    if (!isOpen && pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [isOpen, pollingInterval]);

  // Handle modal close - clean up progress tracking
  const handleClose = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    setShowProgressTracker(false);
    setSubmittedProject(null);
    setProjectStatus(null);
    setProjectStages([]);
    setError(null);
    setSuccessMessage(null);
    setWarningMessage(null);
    setShowWebsiteInput(false);
    setPendingTokenData(null);
    setContractAddress('');
    setManualWebsiteUrl('');
    onClose();
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent, websiteUrl?: string) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setWarningMessage(null);
    setIsSubmitting(true);

    try {
      const payload: any = {
        contractAddress: pendingTokenData?.address || contractAddress.trim(),
        network: pendingTokenData?.network || network
      };
      
      // Include website URL if provided
      if (websiteUrl) {
        payload.websiteUrl = websiteUrl;
      }

      const response = await fetch('/api/add-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const data: TokenResponse = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          // Token already exists - but we can still show progress if analysis is ongoing
          if (data.tokenId && data.symbol) {
            console.log('Token exists but has tokenId - showing progress tracker');
            setError(null);
            setSuccessMessage(null);
            setWarningMessage(null);
            setShowWebsiteInput(false);
            setPendingTokenData(null);
            
            // Start progress tracking for existing token
            startProgressTracking(
              data.tokenId,
              data.symbol,
              contractAddress.trim(),
              network
            );
            setIsSubmitting(false);
            return;
          } else {
            // No tokenId provided, show error
            setError(`Token already exists (${data.symbol || 'Unknown'})`);
          }
        } else if (response.status === 429) {
          // Rate limited
          setError('Too many requests. Please try again later.');
        } else if (response.status === 400 && data.needsWebsite) {
          // Token needs website
          setError(null);
          setWarningMessage(data.error || 'This token does not have a website listed.');
          setShowWebsiteInput(true);
          setPendingTokenData({ 
            address: contractAddress.trim(), 
            network,
            symbol: data.symbol 
          });
          setIsSubmitting(false);
          return;
        } else {
          setError(data.error || 'Failed to add token');
        }
        setIsSubmitting(false);
        return;
      }

      // Success - token was added, start progress tracking
      if (data.tokenId && data.symbol) {
        setError(null);
        setSuccessMessage(null);
        setWarningMessage(null);
        setShowWebsiteInput(false);
        setPendingTokenData(null);
        
        // Start progress tracking instead of closing modal
        startProgressTracking(
          data.tokenId,
          data.symbol,
          contractAddress.trim(),
          network
        );
      } else {
        // Fallback to old behavior if no projectId
        const successMsg = data.message || `Token ${data.symbol} added successfully!`;
        setSuccessMessage(successMsg);
        setContractAddress('');
        setManualWebsiteUrl('');
        setShowWebsiteInput(false);
        setPendingTokenData(null);
        
        setTimeout(() => {
          handleClose();
          if (onSuccess) onSuccess();
        }, 2000);
      }

    } catch (err) {
      console.error('Error submitting token:', err);
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#0d0e10] border border-[#1a1c1f] rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">
            {showProgressTracker ? 'Processing Your Submission' : 'Add Token'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {showProgressTracker ? (
          // Progress Tracker UI
          <div className="space-y-6">
            {/* Project Info Header */}
            {submittedProject && (
              <div className="bg-[#1a1c1f] rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#00ff88] rounded-full flex items-center justify-center">
                    <span className="text-black font-bold text-sm">
                      {submittedProject.symbol?.charAt(0) || '?'}
                    </span>
                  </div>
                  <div>
                    <div className="text-white font-semibold">
                      {submittedProject.symbol || 'Unknown Token'}
                    </div>
                    <div className="text-gray-400 text-sm">
                      {submittedProject.network?.charAt(0).toUpperCase() + submittedProject.network?.slice(1) || 'Unknown Network'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Progress Overview */}
            {projectStatus && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-300">Analysis Progress</span>
                  <span className="text-sm text-[#00ff88]">{projectStatus.progress}%</span>
                </div>
                <div className="w-full bg-[#1a1c1f] rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      projectStatus.hasError ? 'bg-red-500' : 'bg-[#00ff88]'
                    }`}
                    style={{ width: `${projectStatus.progress}%` }}
                  />
                </div>
                <div className={`text-sm ${projectStatus.hasError ? 'text-red-400' : 'text-gray-300'}`}>
                  {projectStatus.message}
                  {projectStatus.estimatedTimeRemaining && !projectStatus.isComplete && !projectStatus.hasError && (
                    <span className="text-gray-500 ml-2">
                      (~{projectStatus.estimatedTimeRemaining} remaining)
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Detailed Stage Progress */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-300">Processing Stages</h3>
                {isAdmin && (
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                    Admin View
                  </span>
                )}
              </div>
              <div className={`space-y-2 ${isAdmin ? 'max-h-64 overflow-y-auto pr-2 scrollbar-hide' : ''}`}>
                {projectStages.map((stage, index) => (
                  <div key={stage.id} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                      stage.status === 'complete' ? 'bg-[#00ff88] text-black' :
                      stage.status === 'in_progress' ? 'bg-blue-500 text-white animate-pulse' :
                      stage.status === 'failed' ? 'bg-red-500 text-white' :
                      'bg-[#2a2d31] text-gray-500'
                    }`}>
                      {stage.status === 'complete' ? '✓' :
                       stage.status === 'in_progress' ? stage.icon :
                       stage.status === 'failed' ? '✗' :
                       index + 1}
                    </div>
                    <div className="flex-1">
                      <div className={`text-sm ${
                        stage.status === 'complete' ? 'text-[#00ff88]' :
                        stage.status === 'in_progress' ? 'text-blue-400' :
                        stage.status === 'failed' ? 'text-red-400' :
                        'text-gray-400'
                      }`}>
                        {stage.name}
                        {stage.status === 'in_progress' && (
                          <span className="ml-2 text-xs text-gray-500">
                            {stage.estimatedDuration}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              {projectStatus?.isComplete ? (
                <button
                  onClick={() => {
                    handleClose();
                    if (onSuccess) onSuccess();
                  }}
                  className="flex-1 py-2 px-4 rounded-lg font-medium bg-[#00ff88] text-black hover:bg-[#00cc66] transition-colors"
                >
                  View Project
                </button>
              ) : projectStatus?.hasError ? (
                <button
                  onClick={() => setShowProgressTracker(false)}
                  className="flex-1 py-2 px-4 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  Try Another Token
                </button>
              ) : (
                <div className="flex-1 text-center text-gray-400 text-sm py-2">
                  Keep this window open to track progress...
                </div>
              )}
              
              <button
                onClick={handleClose}
                className="py-2 px-4 rounded-lg font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            </div>

            {/* Error Details */}
            {projectStatus?.hasError && projectStatus.errorMessage && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                <div className="font-medium mb-1">Analysis Failed</div>
                {projectStatus.errorMessage}
              </div>
            )}
          </div>
        ) : (
          // Original Form UI
          <form onSubmit={handleSubmit} className="space-y-4">
          {/* Network Selection */}
          <div>
            <label htmlFor="network" className="block text-sm font-medium text-gray-300 mb-1">
              Network
            </label>
            <select
              id="network"
              value={network}
              onChange={(e) => setNetwork(e.target.value as NetworkKey)}
              className="w-full bg-[#1a1c1f] border border-[#2a2d31] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              disabled={isSubmitting}
            >
              {Object.entries(NETWORKS).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.display}
                </option>
              ))}
            </select>
          </div>

          {/* Contract Address */}
          <div>
            <label htmlFor="contractAddress" className="block text-sm font-medium text-gray-300 mb-1">
              Contract Address
            </label>
            <input
              id="contractAddress"
              type="text"
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
              placeholder={network === 'solana' ? 'Enter Solana token address...' : '0x...'}
              className="w-full bg-[#1a1c1f] border border-[#2a2d31] rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              disabled={isSubmitting}
              required
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-green-400 text-sm">
              {successMessage}
            </div>
          )}

          {/* Warning Message with Website Input */}
          {warningMessage && (
            <div className="space-y-3">
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-yellow-400 text-sm">
                <div className="font-medium mb-1">Website Required</div>
                {warningMessage}
                {pendingTokenData?.symbol && (
                  <div className="mt-2 text-yellow-300">
                    Token: <span className="font-mono">{pendingTokenData.symbol}</span>
                  </div>
                )}
              </div>
              
              {showWebsiteInput && (
                <div>
                  <label htmlFor="websiteUrl" className="block text-sm font-medium text-gray-300 mb-1">
                    Website URL (optional)
                  </label>
                  <div className="space-y-2">
                    <input
                      id="websiteUrl"
                      type="url"
                      value={manualWebsiteUrl}
                      onChange={(e) => setManualWebsiteUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="w-full bg-[#1a1c1f] border border-[#2a2d31] rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          if (manualWebsiteUrl.trim()) {
                            handleSubmit(e as any, manualWebsiteUrl.trim());
                          }
                        }}
                        disabled={!manualWebsiteUrl.trim() || isSubmitting}
                        className="flex-1 py-2 px-4 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-400"
                      >
                        {isSubmitting ? 'Adding...' : 'Add with Website'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setWarningMessage(null);
                          setShowWebsiteInput(false);
                          setPendingTokenData(null);
                          setContractAddress('');
                          setManualWebsiteUrl('');
                        }}
                        className="flex-1 py-2 px-4 rounded-lg font-medium bg-gray-700 text-gray-300 hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Submit Button - only show if not in website input mode */}
          {!showWebsiteInput && (
            <button
              type="submit"
              disabled={isSubmitting || !contractAddress.trim()}
              className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                isSubmitting || !contractAddress.trim()
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isSubmitting ? 'Checking Token...' : 'Add Token'}
            </button>
          )}
          </form>
        )}

        {!showProgressTracker && (
          <p className="mt-4 text-xs text-gray-500 text-center">
            Token must be listed on a DEX with at least $100 liquidity
          </p>
        )}
      </div>
    </div>
  );
}