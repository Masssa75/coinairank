'use client';

import { useState } from 'react';
import { NETWORKS, type NetworkKey } from '@/lib/validation';

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
          // Token already exists
          setError(`Token already exists (${data.symbol || 'Unknown'})`);
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

      // Success - token was added
      const successMsg = data.message || `Token ${data.symbol} added successfully!`;
      setSuccessMessage(successMsg);
      setContractAddress('');
      setManualWebsiteUrl('');
      setShowWebsiteInput(false);
      setPendingTokenData(null);
      
      // Close modal after 2 seconds
      setTimeout(() => {
        onClose();
        if (onSuccess) onSuccess();
      }, 2000);

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
          <h2 className="text-xl font-bold text-white">Add Token</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

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

        <p className="mt-4 text-xs text-gray-500 text-center">
          Token must be listed on a DEX with at least $100 liquidity
        </p>
      </div>
    </div>
  );
}