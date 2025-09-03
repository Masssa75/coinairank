'use client';

import { useState, useEffect } from 'react';
import { Menu, X, FileCode2, Plus, Database, Home, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface PromptsData {
  promptTemplate: string;
  scoringInfo: {
    memeTokenCategories: string[];
    utilityTokenCategories: string[];
    tierClassifications: string[];
  };
  config: Record<string, any>;
  lastModified: string;
  filePath: string;
}

export default function AdminDashboard() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'prompts' | 'submit' | 'stats'>('dashboard');
  const [promptsData, setPromptsData] = useState<PromptsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch prompts when viewing prompts section
  useEffect(() => {
    if (currentView === 'prompts') {
      fetchPrompts();
    }
  }, [currentView]);

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

  const handleMenuItemClick = (view: 'dashboard' | 'prompts' | 'submit' | 'stats') => {
    setCurrentView(view);
    setIsMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0b0d]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0f0f0f] border-b border-[#2a2d31] px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <span className="text-xl font-semibold tracking-tight text-white">CoinAiRank Admin</span>
          <span className="px-2 py-0.5 bg-red-500/20 text-red-500 text-xs font-semibold rounded">ADMIN</span>
        </div>

        {/* Hamburger Menu */}
        <div className="relative">
          <button 
            className="p-2 rounded hover:bg-[#1a1c1f] transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? (
              <X className="w-5 h-5 text-white" />
            ) : (
              <Menu className="w-5 h-5 text-white" />
            )}
          </button>
          
          {/* Dropdown Menu */}
          {isMenuOpen && (
            <>
              {/* Backdrop */}
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setIsMenuOpen(false)}
              />
              
              {/* Menu Content */}
              <div className="absolute right-0 mt-2 w-64 bg-[#111214] border border-[#2a2d31] rounded-lg shadow-xl z-50">
                <div className="py-2">
                  <button 
                    className="w-full px-4 py-3 text-left text-white hover:bg-[#1a1c1f] transition-colors flex items-center gap-3"
                    onClick={() => handleMenuItemClick('prompts')}
                  >
                    <FileCode2 className="w-4 h-4 text-[#00ff88]" />
                    <div>
                      <div className="font-medium">AI Analysis Prompts</div>
                      <div className="text-xs text-[#666]">View current prompts</div>
                    </div>
                    {currentView === 'prompts' && <ChevronRight className="w-4 h-4 ml-auto text-[#00ff88]" />}
                  </button>
                  
                  <button 
                    className="w-full px-4 py-3 text-left text-[#666] hover:bg-[#1a1c1f] hover:text-white transition-colors flex items-center gap-3 opacity-50 cursor-not-allowed"
                    onClick={() => {}}
                    disabled
                  >
                    <Plus className="w-4 h-4" />
                    <div>
                      <div className="font-medium">Manual Token Submit</div>
                      <div className="text-xs">Coming soon</div>
                    </div>
                  </button>
                  
                  <button 
                    className="w-full px-4 py-3 text-left text-[#666] hover:bg-[#1a1c1f] hover:text-white transition-colors flex items-center gap-3 opacity-50 cursor-not-allowed"
                    onClick={() => {}}
                    disabled
                  >
                    <Database className="w-4 h-4" />
                    <div>
                      <div className="font-medium">Database Stats</div>
                      <div className="text-xs">Coming soon</div>
                    </div>
                  </button>
                  
                  <div className="border-t border-[#2a2d31] my-2"></div>
                  
                  <Link 
                    href="/"
                    className="w-full px-4 py-3 text-left text-white hover:bg-[#1a1c1f] transition-colors flex items-center gap-3 block"
                  >
                    <Home className="w-4 h-4" />
                    Back to Main Site
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        {currentView === 'dashboard' && (
          <div>
            <h1 className="text-3xl font-bold text-white mb-6">Admin Dashboard</h1>
            <div className="bg-[#111214] border border-[#2a2d31] rounded-xl p-6">
              <p className="text-[#888] mb-4">Welcome to the CoinAiRank admin panel.</p>
              <p className="text-[#888]">Use the menu to access administrative functions.</p>
              
              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => setCurrentView('prompts')}
                  className="p-4 bg-[#1a1c1f] border border-[#2a2d31] rounded-lg hover:border-[#00ff88] transition-all group"
                >
                  <FileCode2 className="w-8 h-8 text-[#00ff88] mb-2" />
                  <h3 className="text-white font-semibold">AI Prompts</h3>
                  <p className="text-xs text-[#666] mt-1">View analysis prompts</p>
                </button>
                
                <div className="p-4 bg-[#1a1c1f] border border-[#2a2d31] rounded-lg opacity-50 cursor-not-allowed">
                  <Plus className="w-8 h-8 text-[#666] mb-2" />
                  <h3 className="text-[#666] font-semibold">Token Submit</h3>
                  <p className="text-xs text-[#444] mt-1">Coming soon</p>
                </div>
                
                <div className="p-4 bg-[#1a1c1f] border border-[#2a2d31] rounded-lg opacity-50 cursor-not-allowed">
                  <Database className="w-8 h-8 text-[#666] mb-2" />
                  <h3 className="text-[#666] font-semibold">Database Stats</h3>
                  <p className="text-xs text-[#444] mt-1">Coming soon</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentView === 'prompts' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold text-white">AI Analysis Prompts</h1>
              <button
                onClick={() => setCurrentView('dashboard')}
                className="px-4 py-2 bg-[#1a1c1f] border border-[#2a2d31] rounded-lg hover:bg-[#252729] text-white transition-colors"
              >
                Back to Dashboard
              </button>
            </div>

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

                {/* Scoring Categories */}
                <div className="bg-[#111214] border border-[#2a2d31] rounded-xl p-6">
                  <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 bg-[#ffcc00] rounded-full"></span>
                    Scoring Categories
                  </h2>
                  
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-[#00ff88] font-semibold mb-2">Meme Token Categories</h3>
                      <ul className="space-y-1">
                        {promptsData.scoringInfo.memeTokenCategories.map((cat, i) => (
                          <li key={i} className="text-[#888] text-sm font-mono pl-4">• {cat}</li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <h3 className="text-[#00ff88] font-semibold mb-2">Utility Token Categories</h3>
                      <ul className="space-y-1">
                        {promptsData.scoringInfo.utilityTokenCategories.map((cat, i) => (
                          <li key={i} className="text-[#888] text-sm font-mono pl-4">• {cat}</li>
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
        )}
      </div>
    </div>
  );
}