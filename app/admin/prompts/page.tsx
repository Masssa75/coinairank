'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileCode2, RefreshCw } from 'lucide-react';
import Link from 'next/link';

interface PromptsData {
  promptTemplate: string;
  scoringInfo: {
    tier1Signals: string[];
    scoringScale: string[];
    tierClassifications: string[];
  };
  config: Record<string, any>;
  lastModified: string;
  filePath: string;
}

export default function AdminPromptsPage() {
  const router = useRouter();
  const [promptsData, setPromptsData] = useState<PromptsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check authentication
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/admin/auth');
      const data = await response.json();
      
      if (!data.authenticated) {
        // Not authenticated, redirect to login
        router.push('/admin');
        return;
      }
      
      setIsAuthenticated(true);
      // Fetch prompts after confirming authentication
      fetchPrompts();
    } catch (err) {
      console.error('Auth check failed:', err);
      router.push('/admin');
    }
  };

  const fetchPrompts = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/ai-prompts');
      if (!response.ok) {
        throw new Error('Failed to fetch prompts');
      }
      const data = await response.json();
      setPromptsData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch prompts');
      console.error('Error fetching prompts:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0b0d] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#00ff88] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0b0d]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0f0f0f] border-b border-[#2a2d31] px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            href="/"
            className="p-2 rounded hover:bg-[#1a1c1f] transition-colors"
            title="Back to dashboard"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </Link>
          <span className="text-xl font-semibold tracking-tight text-white">AI Analysis Prompts</span>
        </div>
        
        <button
          onClick={fetchPrompts}
          disabled={loading}
          className="p-2 rounded hover:bg-[#1a1c1f] transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-5 h-5 text-white ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        {loading && (
          <div className="flex justify-center items-center h-64">
            <div className="w-12 h-12 border-4 border-[#00ff88] border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
            <p className="text-red-500">Error loading prompts: {error}</p>
            <button
              onClick={fetchPrompts}
              className="mt-2 px-4 py-1 bg-red-500/20 text-red-500 rounded hover:bg-red-500/30 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {promptsData && !loading && (
          <div className="space-y-6">
            {/* Configuration Info */}
            <div className="bg-[#111214] border border-[#2a2d31] rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-[#00ff88] rounded-full"></span>
                Configuration
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-[#666] mb-1">AI Model</p>
                  <p className="text-white font-mono text-sm">{promptsData.config.aiModel}</p>
                </div>
                <div>
                  <p className="text-xs text-[#666] mb-1">Temperature</p>
                  <p className="text-white font-mono text-sm">{promptsData.config.temperature}</p>
                </div>
                <div>
                  <p className="text-xs text-[#666] mb-1">Max Tokens</p>
                  <p className="text-white font-mono text-sm">{promptsData.config.maxTokens}</p>
                </div>
                <div>
                  <p className="text-xs text-[#666] mb-1">Render Wait Time</p>
                  <p className="text-white font-mono text-sm">{promptsData.config.renderWaitTime}</p>
                </div>
                <div>
                  <p className="text-xs text-[#666] mb-1">Max Text Content</p>
                  <p className="text-white font-mono text-sm">{promptsData.config.maxTextContent}</p>
                </div>
                <div>
                  <p className="text-xs text-[#666] mb-1">File Path</p>
                  <p className="text-white font-mono text-sm">{promptsData.filePath}</p>
                </div>
              </div>
            </div>

            {/* Main Prompt Template */}
            <div className="bg-[#111214] border border-[#2a2d31] rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-[#00ff88] rounded-full"></span>
                Main Analysis Prompt
              </h2>
              <div className="bg-[#0a0b0d] border border-[#2a2d31] rounded-lg p-4 overflow-x-auto">
                <pre className="text-[#888] text-xs font-mono whitespace-pre-wrap">
                  {promptsData.promptTemplate}
                </pre>
              </div>
            </div>

            {/* Signal-Based Analysis */}
            <div className="bg-[#111214] border border-[#2a2d31] rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-[#ffcc00] rounded-full"></span>
                Signal-Based Analysis Framework
              </h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-[#00ff88] font-semibold mb-2">🎯 Tier 1 Signals (Moon Potential)</h3>
                  <ul className="space-y-1">
                    {promptsData.scoringInfo.tier1Signals.map((signal, i) => (
                      <li key={i} className="text-[#888] text-sm font-mono pl-4">{signal}</li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h3 className="text-[#ff8800] font-semibold mb-2">📊 Success Likelihood Indicators</h3>
                  <ul className="space-y-1">
                    {promptsData.scoringInfo.scoringScale.map((scale, i) => (
                      <li key={i} className="text-[#888] text-sm font-mono pl-4">{scale}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Tier Classifications */}
            <div className="bg-[#111214] border border-[#2a2d31] rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-[#ff8800] rounded-full"></span>
                Tier Classifications
              </h2>
              <ul className="space-y-2">
                {promptsData.scoringInfo.tierClassifications.map((tier, i) => (
                  <li key={i} className="text-[#888] font-mono text-sm pl-4">• {tier}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}