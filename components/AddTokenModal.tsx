'use client';

import { useState } from 'react';
import { NETWORKS, type NetworkKey } from '@/lib/validation';

interface AddTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddTokenModal({ isOpen, onClose, onSuccess }: AddTokenModalProps) {
  const [contractAddress, setContractAddress] = useState('');
  const [network, setNetwork] = useState<NetworkKey>('ethereum');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/add-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contractAddress: contractAddress.trim(),
          network
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          // Token already exists
          setError(`Token already exists (${data.symbol || 'Unknown'})`);
        } else if (response.status === 429) {
          // Rate limited
          setError('Too many requests. Please try again later.');
        } else {
          setError(data.error || 'Failed to add token');
        }
        return;
      }

      // Success!
      const successMsg = data.hasWebsite 
        ? `✅ ${data.symbol} added successfully! Market Cap: $${(data.marketCap || 0).toLocaleString()}`
        : `✅ ${data.symbol} added successfully! Website discovery in progress...`;
      
      setSuccessMessage(successMsg);
      setContractAddress('');
      
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !contractAddress.trim()}
            className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
              isSubmitting || !contractAddress.trim()
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isSubmitting ? 'Adding Token...' : 'Add Token'}
          </button>
        </form>

        <p className="mt-4 text-xs text-gray-500 text-center">
          Token must be listed on a DEX with at least $100 liquidity
        </p>
      </div>
    </div>
  );
}