'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Github, Twitter, FileText, Shield, AlertCircle, CheckCircle2, DollarSign, Code, TrendingUp } from 'lucide-react';
import { ContractVerificationTooltip } from '@/components/ContractVerificationTooltip';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ProjectData {
  id: number;
  symbol: string;
  name: string;
  network: string;
  contract_address: string;
  website_url: string;
  website_screenshot_url: string | null;
  website_stage1_score: number;
  website_stage1_tier: string;
  website_stage1_analysis: any;
  strongest_signal?: {
    signal: string;
    rarity: string;
    score: number;
  };
  signals_found?: Array<{
    signal: string;
    importance: string;
    similar_to?: string;
    strength_score: number;
    rarity_estimate: string;
    score_reasoning: string;
  }>;
  red_flags?: Array<{
    flag: string;
    severity: string;
    evidence: string;
  }>;
  website_stage1_tooltip?: {
    one_liner: string;
    pros?: string[];
    cons?: string[];
    top_signals?: string[];
    main_concerns?: string[];
  };
  website_stage2_resources?: any;
  website_stage1_token_usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    model: string;
  };
  token_type?: string;
  current_liquidity_usd: number | null;
  current_market_cap: number | null;
  current_price_usd: number | null;
  roi_percent: number | null;
  contract_verification?: {
    found_on_site: boolean;
    confidence: 'high' | 'medium' | 'low';
    note?: string;
  };
  is_imposter?: boolean;
}

export default function ProjectDetailPage({ params }: { params: { symbol: string } }) {
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check admin status
  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch('/api/admin/auth');
        const data = await response.json();
        setIsAdmin(data.authenticated);
      } catch (err) {
        console.error('Auth check failed:', err);
        setIsAdmin(false);
      }
    }
    checkAuth();
  }, []);

  useEffect(() => {
    async function fetchProject() {
      try {
        const { data, error } = await supabase
          .from('crypto_projects_rated')
          .select('*')
          .eq('symbol', params.symbol.toUpperCase())
          .single();

        if (error) throw error;
        setProject(data);
      } catch (error) {
        console.error('Error fetching project:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchProject();
  }, [params.symbol]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0b0d] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#00ff88] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-[#0a0b0d] flex flex-col items-center justify-center">
        <h1 className="text-2xl text-white mb-4">Project not found</h1>
        <Link href="/" className="text-[#00ff88] hover:underline">
          Back to projects
        </Link>
      </div>
    );
  }

  const analysis = project.website_stage1_analysis;
  const fullAnalysis = analysis?.full_analysis || {};
  const stage2Resources = project.website_stage2_resources || analysis?.stage_2_resources || {};

  const getTierColor = (tier: string) => {
    switch(tier?.toUpperCase()) {
      case 'ALPHA': return { bg: '#00ff88', text: '#000' };
      case 'SOLID': return { bg: '#4A9EFF', text: '#fff' };
      case 'BASIC': return { bg: '#FFA500', text: '#000' };
      case 'TRASH': return { bg: '#FF4444', text: '#fff' };
      default: return { bg: '#666', text: '#fff' };
    }
  };

  const formatMarketCap = (value: number | null) => {
    if (!value) return 'N/A';
    if (value >= 1000000000) return `$${(value / 1000000000).toFixed(2)}B`;
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-white">
      {/* Header */}
      <header className="bg-[#111214] border-b border-[#2a2d31] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/" 
              className="text-xl font-semibold tracking-tight text-white hover:text-[#00ff88] transition-colors mr-2"
            >
              CoinAiRank
            </Link>
            <span className="text-[#444]">|</span>
            <Link 
              href="/" 
              className="flex items-center gap-2 text-[#888] hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
              <span>Back to Projects</span>
            </Link>
            <span className="text-[#444]">|</span>
            <h1 className="text-xl font-bold text-white">
              {project.contract_verification ? (
                <ContractVerificationTooltip
                  verification={project.contract_verification}
                  isImposter={project.is_imposter}
                >
                  <span className="flex items-center gap-2">
                    {project.symbol}
                    {project.name && project.name !== project.symbol && (
                      <span className="text-sm text-[#666] font-normal">({project.name})</span>
                    )}
                  </span>
                </ContractVerificationTooltip>
              ) : (
                <span className="flex items-center gap-2">
                  {project.symbol}
                  {project.name && project.name !== project.symbol && (
                    <span className="text-sm text-[#666] font-normal">({project.name})</span>
                  )}
                </span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span 
              className="px-3 py-1 rounded text-sm font-semibold uppercase"
              style={{ 
                backgroundColor: getTierColor(project.website_stage1_tier).bg,
                color: getTierColor(project.website_stage1_tier).text
              }}
            >
              {project.website_stage1_tier} TIER
            </span>
            <span className="text-2xl font-bold text-[#00ff88]">
              {project.website_stage1_score}/100
            </span>
            {/* Token Usage for Admin */}
            {isAdmin && project.website_stage1_token_usage && (
              <div className="ml-4 px-3 py-1 bg-[#1a1b1e] border border-[#2a2d31] rounded">
                <span className="text-xs text-[#666] block">AI Tokens Used</span>
                <span className="text-sm text-[#00ff88] font-mono">
                  {project.website_stage1_token_usage.total_tokens.toLocaleString()}
                </span>
                <span className="text-xs text-[#666] ml-1">
                  ({project.website_stage1_token_usage.prompt_tokens.toLocaleString()} + {project.website_stage1_token_usage.completion_tokens.toLocaleString()})
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column - Main Analysis */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Strongest Signal - New signal-based analysis */}
            {project.strongest_signal && (
              <section className="bg-gradient-to-r from-[#111214] to-[#1a1c1f] rounded-xl border border-[#00ff88] p-6">
                <h2 className="text-lg font-bold text-[#00ff88] mb-4 flex items-center gap-2">
                  <TrendingUp size={20} />
                  Strongest Signal
                </h2>
                <div className="space-y-3">
                  <p className="text-xl text-white font-semibold">{project.strongest_signal.signal}</p>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[#666]">Rarity:</span>
                      <span className="text-[#00ff88] font-bold">{project.strongest_signal.rarity}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[#666]">Score:</span>
                      <span className="text-2xl text-[#00ff88] font-bold">{project.strongest_signal.score}/100</span>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* All Signals Found */}
            {project.signals_found && project.signals_found.length > 0 && (
              <section className="bg-[#111214] rounded-xl border border-[#2a2d31] p-6">
                <h2 className="text-lg font-bold text-white mb-4">Signals Detected</h2>
                <div className="space-y-4">
                  {project.signals_found.map((signal, idx) => (
                    <div key={idx} className="border-l-2 border-[#00ff88] pl-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <h3 className="text-white font-semibold">{signal.signal}</h3>
                        <span className="text-[#00ff88] font-bold">{signal.strength_score}</span>
                      </div>
                      <p className="text-sm text-[#aaa]">{signal.importance}</p>
                      {signal.similar_to && (
                        <p className="text-xs text-[#666]">Similar to: {signal.similar_to}</p>
                      )}
                      <p className="text-xs text-[#666]">Rarity: {signal.rarity_estimate}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Quick Summary */}
            {project.website_stage1_tooltip && (
              <section className="bg-[#111214] rounded-xl border border-[#2a2d31] p-6">
                <h2 className="text-lg font-bold text-white mb-4">Quick Summary</h2>
                <p className="text-[#ddd] mb-4">{project.website_stage1_tooltip.one_liner}</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-semibold text-[#00ff88] mb-2 flex items-center gap-2">
                      <CheckCircle2 size={16} />
                      {project.website_stage1_tooltip.top_signals ? 'Top Signals' : 'Pros'}
                    </h3>
                    <ul className="space-y-1">
                      {(project.website_stage1_tooltip.top_signals || project.website_stage1_tooltip.pros || []).map((item, idx) => (
                        <li key={idx} className="text-sm text-[#aaa] flex items-start">
                          <span className="text-[#00ff88] mr-2">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-semibold text-[#ff4444] mb-2 flex items-center gap-2">
                      <AlertCircle size={16} />
                      {project.website_stage1_tooltip.main_concerns ? 'Main Concerns' : 'Cons'}
                    </h3>
                    <ul className="space-y-1">
                      {(project.website_stage1_tooltip.main_concerns || project.website_stage1_tooltip.cons || []).map((item, idx) => (
                        <li key={idx} className="text-sm text-[#aaa] flex items-start">
                          <span className="text-[#ff4444] mr-2">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
            )}

            {/* Contract Verification */}
            {project.contract_verification && (
              <section className="bg-[#111214] rounded-xl border border-[#2a2d31] p-6">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Shield size={20} />
                  Contract Verification
                </h2>
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full flex-shrink-0 mt-0.5 ${
                    project.contract_verification.found_on_site ? 'bg-green-500' :
                    project.is_imposter ? 'bg-red-500' : 
                    'bg-orange-500'
                  }`} />
                  <div className="flex-1">
                    <p className={`font-semibold mb-1 ${
                      project.contract_verification.found_on_site ? 'text-green-400' :
                      project.is_imposter ? 'text-red-400' : 
                      'text-orange-400'
                    }`}>
                      {project.contract_verification.found_on_site ? 
                        'Contract Verified' :
                        project.is_imposter ? 
                        'Warning: Possible Imposter Token' :
                        'Contract Not Found on Website'}
                    </p>
                    {project.contract_verification.note && (
                      <p className="text-sm text-[#aaa]">{project.contract_verification.note}</p>
                    )}
                    <p className="text-xs text-[#666] mt-2">
                      Confidence: <span className="text-[#888]">{project.contract_verification.confidence}</span>
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* Full Analysis Report */}
            {fullAnalysis.report && (
              <section className="bg-[#111214] rounded-xl border border-[#2a2d31] p-6">
                <h2 className="text-lg font-bold text-white mb-4">Full Analysis Report</h2>
                <div className="prose prose-invert max-w-none">
                  <p className="text-[#ddd] leading-relaxed whitespace-pre-wrap">{fullAnalysis.report}</p>
                </div>
              </section>
            )}

            {/* Hidden Discoveries */}
            {fullAnalysis.hidden_discoveries?.length > 0 && (
              <section className="bg-[#111214] rounded-xl border border-[#2a2d31] p-6">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Code size={20} />
                  Hidden Discoveries
                </h2>
                <ul className="space-y-2">
                  {fullAnalysis.hidden_discoveries.map((discovery: string, idx: number) => (
                    <li key={idx} className="text-sm text-[#aaa] flex items-start">
                      <span className="text-[#00ff88] mr-2 mt-0.5">▸</span>
                      <span>{discovery}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Red and Green Flags */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {fullAnalysis.green_flags?.length > 0 && (
                <section className="bg-[#111214] rounded-xl border border-[#2a2d31] p-6">
                  <h2 className="text-lg font-bold text-[#00ff88] mb-4 flex items-center gap-2">
                    <CheckCircle2 size={20} />
                    Green Flags
                  </h2>
                  <ul className="space-y-2">
                    {fullAnalysis.green_flags.map((flag: string, idx: number) => (
                      <li key={idx} className="text-sm text-[#aaa] flex items-start">
                        <span className="text-[#00ff88] mr-2 mt-0.5">✓</span>
                        <span>{flag}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {((project.red_flags && project.red_flags.length > 0) || (fullAnalysis.red_flags && fullAnalysis.red_flags.length > 0)) && (
                <section className="bg-[#111214] rounded-xl border border-[#2a2d31] p-6">
                  <h2 className="text-lg font-bold text-[#ff4444] mb-4 flex items-center gap-2">
                    <AlertCircle size={20} />
                    Red Flags
                  </h2>
                  <ul className="space-y-3">
                    {(project.red_flags || fullAnalysis.red_flags || []).map((flag: any, idx: number) => (
                      <li key={idx} className="text-sm text-[#aaa]">
                        {typeof flag === 'string' ? (
                          <div className="flex items-start">
                            <span className="text-[#ff4444] mr-2 mt-0.5">✗</span>
                            <span>{flag}</span>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex items-start">
                              <span className="text-[#ff4444] mr-2 mt-0.5">✗</span>
                              <div className="flex-1">
                                <span className="text-white font-semibold">{flag.flag}</span>
                                <span className="ml-2 text-xs px-2 py-0.5 rounded bg-[#ff4444] bg-opacity-20 text-[#ff6666]">
                                  {flag.severity}
                                </span>
                              </div>
                            </div>
                            {flag.evidence && (
                              <p className="ml-6 text-xs text-[#666]">Evidence: {flag.evidence}</p>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {/* Business & Technical Assessment */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {fullAnalysis.revenue_model && (
                <section className="bg-[#111214] rounded-xl border border-[#2a2d31] p-6">
                  <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <DollarSign size={20} />
                    Revenue Model
                  </h2>
                  <p className="text-sm text-[#aaa] leading-relaxed">{fullAnalysis.revenue_model}</p>
                </section>
              )}

              {fullAnalysis.technical_assessment && (
                <section className="bg-[#111214] rounded-xl border border-[#2a2d31] p-6">
                  <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Code size={20} />
                    Technical Assessment
                  </h2>
                  <p className="text-sm text-[#aaa] leading-relaxed">{fullAnalysis.technical_assessment}</p>
                </section>
              )}
            </div>

            {/* Most Revealing Discovery */}
            {fullAnalysis.most_revealing && (
              <section className="bg-gradient-to-r from-[#111214] to-[#1a1c1f] rounded-xl border border-[#00ff88] p-6">
                <h2 className="text-lg font-bold text-[#00ff88] mb-4 flex items-center gap-2">
                  <TrendingUp size={20} />
                  Most Revealing Discovery
                </h2>
                <p className="text-[#ddd] leading-relaxed italic">&ldquo;{fullAnalysis.most_revealing}&rdquo;</p>
              </section>
            )}
          </div>

          {/* Right Column - Resources & Links */}
          <div className="space-y-6">
            
            {/* Key Metrics */}
            <section className="bg-[#111214] rounded-xl border border-[#2a2d31] p-6">
              <h3 className="text-lg font-bold text-white mb-4">Key Metrics</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-[#666]">Type</span>
                  <span className="text-white font-semibold uppercase">{project.token_type || analysis?.token_type || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#666]">Network</span>
                  <span className="text-white font-semibold uppercase">{project.network}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#666]">Market Cap</span>
                  <span className="text-white font-semibold">{formatMarketCap(project.current_market_cap)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#666]">Liquidity</span>
                  <span className="text-white font-semibold">{formatMarketCap(project.current_liquidity_usd)}</span>
                </div>
                {project.roi_percent !== null && (
                  <div className="flex justify-between">
                    <span className="text-[#666]">ROI</span>
                    <span className={`font-semibold ${project.roi_percent > 0 ? 'text-[#00ff88]' : 'text-[#ff4444]'}`}>
                      {project.roi_percent > 0 ? '+' : ''}{project.roi_percent.toFixed(0)}%
                    </span>
                  </div>
                )}
              </div>
            </section>

            {/* Quick Actions */}
            <section className="bg-[#111214] rounded-xl border border-[#2a2d31] p-6">
              <h3 className="text-lg font-bold text-white mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <a
                  href={project.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between bg-[#00ff88] text-black px-4 py-3 rounded-lg hover:bg-[#00cc66] transition-colors font-semibold"
                >
                  <span>Visit Website</span>
                  <ExternalLink size={18} />
                </a>
                
                {project.contract_address && (
                  <a
                    href={`https://dexscreener.com/${project.network}/${project.contract_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between bg-[#1a1c1f] text-white px-4 py-3 rounded-lg hover:bg-[#252729] transition-colors border border-[#2a2d31]"
                  >
                    <span>View Chart</span>
                    <ExternalLink size={18} />
                  </a>
                )}
              </div>
            </section>

            {/* Stage 2 Resources */}
            {stage2Resources && Object.keys(stage2Resources).length > 0 && (
              <section className="bg-[#111214] rounded-xl border border-[#2a2d31] p-6">
                <h3 className="text-lg font-bold text-white mb-4">Stage 2 Resources</h3>
                <div className="space-y-4">
                  
                  {/* Contract Addresses */}
                  {stage2Resources.contract_addresses?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-[#888] mb-2">Smart Contracts</h4>
                      {stage2Resources.contract_addresses.map((contract: any, idx: number) => (
                        <div key={idx} className="text-xs text-[#aaa] mb-1">
                          <span className="text-[#666]">{contract.network}:</span>
                          <span className="ml-2 font-mono">{contract.address?.substring(0, 10)}...</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* GitHub Repos */}
                  {stage2Resources.github_repos?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-[#888] mb-2">GitHub</h4>
                      {stage2Resources.github_repos.map((repo: string, idx: number) => (
                        <a
                          key={idx}
                          href={repo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-[#00ff88] hover:text-[#00cc66] text-sm mb-1"
                        >
                          <Github size={14} />
                          <span className="truncate">{repo.split('/').slice(-2).join('/')}</span>
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Documentation */}
                  {stage2Resources.documentation && Object.keys(stage2Resources.documentation).length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-[#888] mb-2">Documentation</h4>
                      {Object.entries(stage2Resources.documentation).map(([key, url]: [string, any]) => url && (
                        <a
                          key={key}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-[#00ff88] hover:text-[#00cc66] text-sm mb-1"
                        >
                          <FileText size={14} />
                          <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Audits */}
                  {stage2Resources.audits?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-[#888] mb-2">Security Audits</h4>
                      {stage2Resources.audits.map((audit: any, idx: number) => (
                        <a
                          key={idx}
                          href={audit.url || audit.report}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-[#00ff88] hover:text-[#00cc66] text-sm mb-1"
                        >
                          <Shield size={14} />
                          <span>{audit.auditor}</span>
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Social Channels */}
                  {stage2Resources.social_channels && Object.keys(stage2Resources.social_channels).length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-[#888] mb-2">Social Channels</h4>
                      {Object.entries(stage2Resources.social_channels).map(([platform, url]: [string, any]) => url && (
                        <a
                          key={platform}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-[#00ff88] hover:text-[#00cc66] text-sm mb-1"
                        >
                          <Twitter size={14} />
                          <span className="capitalize">{platform}</span>
                        </a>
                      ))}
                    </div>
                  )}

                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}