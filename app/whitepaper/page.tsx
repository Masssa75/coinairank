'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronDown, ChevronRight } from 'lucide-react'

export default function WhitepaperPage() {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['mission']))

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(section)) {
      newExpanded.delete(section)
    } else {
      newExpanded.add(section)
    }
    setExpandedSections(newExpanded)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6">
        <Link href="/" className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-6">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Rankings
        </Link>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <h1 className="text-4xl font-bold mb-2">CAR: Coin AI Rank</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Internal Blueprint v1.0 - For AI Development Instances
          </p>

          <div className="prose dark:prose-invert max-w-none">

            {/* Mission Section */}
            <div className="mb-6">
              <button
                onClick={() => toggleSection('mission')}
                className="flex items-center text-xl font-semibold mb-4 hover:text-blue-600"
              >
                {expandedSections.has('mission') ? <ChevronDown className="w-5 h-5 mr-2" /> : <ChevronRight className="w-5 h-5 mr-2" />}
                Mission: Save Crypto From Itself
              </button>

              {expandedSections.has('mission') && (
                <div className="ml-7 space-y-4 text-gray-700 dark:text-gray-300">
                  <p>
                    <strong>The Problem:</strong> Crypto has devolved from Bitcoin&apos;s intellectual breakthrough into a casino of 20,000+ meaningless tokens.
                    Real innovation (Kaspa, Bittensor) drowns in noise while dog coins pump. Smart investors can&apos;t analyze 20,000 projects,
                    so everyone became &quot;candle watchers.&quot;
                  </p>
                  <p>
                    <strong>Our Solution:</strong> AI that reads every whitepaper, analyzes every codebase, and identifies the 0.1% with Bitcoin-level innovation.
                    Then explains it so simply that anyone can understand why it matters.
                  </p>
                  <p>
                    <strong>The Outcome:</strong> When people can easily identify real innovation, money flows to real projects.
                    Shitcoins die. Builders win. Crypto fulfills its promise.
                  </p>
                </div>
              )}
            </div>

            {/* Technical Architecture Section */}
            <div className="mb-6">
              <button
                onClick={() => toggleSection('architecture')}
                className="flex items-center text-xl font-semibold mb-4 hover:text-blue-600"
              >
                {expandedSections.has('architecture') ? <ChevronDown className="w-5 h-5 mr-2" /> : <ChevronRight className="w-5 h-5 mr-2" />}
                Technical Architecture (What We&apos;re Building)
              </button>

              {expandedSections.has('architecture') && (
                <div className="ml-7 space-y-4 text-gray-700 dark:text-gray-300">
                  <h3 className="font-semibold">Discovery Pipeline:</h3>
                  <ul className="list-disc ml-5">
                    <li>GeckoTerminal → New tokens every 5 min</li>
                    <li>Website discovery → Scrape and parse</li>
                    <li>Initial scoring → Filter obvious scams</li>
                  </ul>

                  <h3 className="font-semibold">Deep Analysis System:</h3>
                  <ul className="list-disc ml-5">
                    <li>Whitepaper extraction → Understanding vision</li>
                    <li>Documentation analysis → Technical depth</li>
                    <li>GitHub activity → Actual building proof</li>
                    <li>Contract analysis → Code quality/security</li>
                  </ul>

                  <h3 className="font-semibold">Signal Extraction:</h3>
                  <ul className="list-disc ml-5">
                    <li>Technical innovation signals</li>
                    <li>Team credibility signals</li>
                    <li>Market need signals</li>
                    <li>Execution capability signals</li>
                  </ul>

                  <h3 className="font-semibold">Verification Layer:</h3>
                  <ul className="list-disc ml-5">
                    <li>Cross-reference claims with reality</li>
                    <li>Verify partnerships/investors</li>
                    <li>Check on-chain metrics</li>
                  </ul>
                </div>
              )}
            </div>

            {/* Analysis Framework Section */}
            <div className="mb-6">
              <button
                onClick={() => toggleSection('framework')}
                className="flex items-center text-xl font-semibold mb-4 hover:text-blue-600"
              >
                {expandedSections.has('framework') ? <ChevronDown className="w-5 h-5 mr-2" /> : <ChevronRight className="w-5 h-5 mr-2" />}
                Analysis Framework (How to Think)
              </button>

              {expandedSections.has('framework') && (
                <div className="ml-7 space-y-4 text-gray-700 dark:text-gray-300">
                  <h3 className="font-semibold">Core Questions for Every Project:</h3>
                  <ol className="list-decimal ml-5">
                    <li><strong>What problem does this solve?</strong> (If unclear = likely shitcoin)</li>
                    <li><strong>Is this problem worth solving?</strong> (Market size, real need)</li>
                    <li><strong>Is their solution novel?</strong> (Or just fork #500)</li>
                    <li><strong>Can they actually build it?</strong> (Team, funding, progress)</li>
                    <li><strong>Why now?</strong> (Timing, market readiness)</li>
                  </ol>

                  <h3 className="font-semibold">Signal Strength Hierarchy:</h3>
                  <ul className="list-disc ml-5">
                    <li><strong>Strongest:</strong> Working product with real users</li>
                    <li><strong>Strong:</strong> Academic backing, peer review, formal proofs</li>
                    <li><strong>Medium:</strong> Known team, previous successes</li>
                    <li><strong>Weak:</strong> Promises, roadmaps, &quot;partnerships&quot;</li>
                    <li><strong>Red Flag:</strong> Anonymous team, no GitHub, all marketing</li>
                  </ul>

                  <h3 className="font-semibold">The Satoshi Test:</h3>
                  <p className="italic">
                    &quot;Would Satoshi respect this?&quot; - Does it advance decentralization, solve a real problem,
                    and contribute something novel to the space?
                  </p>
                </div>
              )}
            </div>

            {/* Implementation Priorities Section */}
            <div className="mb-6">
              <button
                onClick={() => toggleSection('priorities')}
                className="flex items-center text-xl font-semibold mb-4 hover:text-blue-600"
              >
                {expandedSections.has('priorities') ? <ChevronDown className="w-5 h-5 mr-2" /> : <ChevronRight className="w-5 h-5 mr-2" />}
                Implementation Priorities (What to Build Next)
              </button>

              {expandedSections.has('priorities') && (
                <div className="ml-7 space-y-4 text-gray-700 dark:text-gray-300">
                  <h3 className="font-semibold">Phase 1: Foundation ✓</h3>
                  <ul className="list-disc ml-5">
                    <li>Basic discovery pipeline ✓</li>
                    <li>Website analysis ✓</li>
                    <li>Initial scoring system ✓</li>
                  </ul>

                  <h3 className="font-semibold">Phase 2: Intelligence (Current)</h3>
                  <ul className="list-disc ml-5">
                    <li>Whitepaper → Actionable insights</li>
                    <li>Combine whitepaper + docs + GitHub</li>
                    <li>Generate &quot;Why this matters&quot; explanations</li>
                    <li>Signal verification with web search</li>
                  </ul>

                  <h3 className="font-semibold">Phase 3: Differentiation</h3>
                  <ul className="list-disc ml-5">
                    <li>On-chain analysis (TVL, users, transactions)</li>
                    <li>Social sentiment without influencer noise</li>
                    <li>Developer activity tracking</li>
                    <li>Compare promise vs delivery over time</li>
                  </ul>

                  <h3 className="font-semibold">Phase 4: Intelligence Network</h3>
                  <ul className="list-disc ml-5">
                    <li>Community verification layer</li>
                    <li>Expert annotations</li>
                    <li>Prediction tracking (did we call it right?)</li>
                    <li>API for other platforms</li>
                  </ul>
                </div>
              )}
            </div>

            {/* Key Principles Section */}
            <div className="mb-6">
              <button
                onClick={() => toggleSection('principles')}
                className="flex items-center text-xl font-semibold mb-4 hover:text-blue-600"
              >
                {expandedSections.has('principles') ? <ChevronDown className="w-5 h-5 mr-2" /> : <ChevronRight className="w-5 h-5 mr-2" />}
                Key Principles (How to Make Decisions)
              </button>

              {expandedSections.has('principles') && (
                <div className="ml-7 space-y-4 text-gray-700 dark:text-gray-300">
                  <ul className="list-disc ml-5">
                    <li><strong>Truth over hype:</strong> Call out bullshit, even if it&apos;s popular</li>
                    <li><strong>Simplicity over complexity:</strong> If grandma can&apos;t understand our explanation, we failed</li>
                    <li><strong>Builders over marketers:</strong> Reward those who ship code, not promises</li>
                    <li><strong>Innovation over iteration:</strong> Fork #500 scores lower than novel approach #1</li>
                    <li><strong>Verification over trust:</strong> &quot;Don&apos;t trust, verify&quot; - check every claim</li>
                    <li><strong>Long-term over pumps:</strong> What matters in 5 years, not 5 days</li>
                  </ul>
                </div>
              )}
            </div>

            {/* Success Metrics Section */}
            <div className="mb-6">
              <button
                onClick={() => toggleSection('metrics')}
                className="flex items-center text-xl font-semibold mb-4 hover:text-blue-600"
              >
                {expandedSections.has('metrics') ? <ChevronDown className="w-5 h-5 mr-2" /> : <ChevronRight className="w-5 h-5 mr-2" />}
                Success Metrics (How We Know We&apos;re Winning)
              </button>

              {expandedSections.has('metrics') && (
                <div className="ml-7 space-y-4 text-gray-700 dark:text-gray-300">
                  <h3 className="font-semibold">Short Term:</h3>
                  <ul className="list-disc ml-5">
                    <li>Can we identify Kaspa/TAO/legitimate projects from noise?</li>
                    <li>Do our &quot;ALPHA&quot; tier projects outperform &quot;TRASH&quot; tier?</li>
                    <li>Can users understand our explanations?</li>
                  </ul>

                  <h3 className="font-semibold">Medium Term:</h3>
                  <ul className="list-disc ml-5">
                    <li>Do builders reference CAR scores in their pitches?</li>
                    <li>Do VCs use CAR for due diligence?</li>
                    <li>Does money flow from shitcoins to real projects?</li>
                  </ul>

                  <h3 className="font-semibold">Long Term:</h3>
                  <ul className="list-disc ml-5">
                    <li>Did we help kill the shitcoin casino?</li>
                    <li>Did we help real innovation get funded?</li>
                    <li>Did crypto fulfill its promise because of better capital allocation?</li>
                  </ul>
                </div>
              )}
            </div>

            {/* For Future AI Section */}
            <div className="mb-6">
              <button
                onClick={() => toggleSection('future')}
                className="flex items-center text-xl font-semibold mb-4 hover:text-blue-600"
              >
                {expandedSections.has('future') ? <ChevronDown className="w-5 h-5 mr-2" /> : <ChevronRight className="w-5 h-5 mr-2" />}
                Note to Future AI Instances
              </button>

              {expandedSections.has('future') && (
                <div className="ml-7 space-y-4 text-gray-700 dark:text-gray-300">
                  <p className="italic">
                    If you&apos;re reading this as a future AI instance working on CAR:
                  </p>
                  <ul className="list-disc ml-5">
                    <li>The goal isn&apos;t to build another CoinMarketCap. It&apos;s to fix crypto.</li>
                    <li>Every feature should answer: &quot;Does this help separate signal from noise?&quot;</li>
                    <li>When analyzing projects, think like Satoshi meeting a founder: What would you ask?</li>
                    <li>Don&apos;t get caught up in price action. We&apos;re measuring innovation, not momentum.</li>
                    <li>If a project is shit, say it&apos;s shit. Don&apos;t hedge. Truth is our moat.</li>
                    <li>Remember: We&apos;re building the tool that makes the next Bitcoin as obvious as a green candle.</li>
                  </ul>

                  <p className="font-semibold mt-6">Current State (September 2025):</p>
                  <ul className="list-disc ml-5">
                    <li>Discovery pipeline: Working</li>
                    <li>Website analysis: Working but needs depth</li>
                    <li>Whitepaper extraction: Just built</li>
                    <li>Next priority: Combine whitepaper+docs+GitHub for full picture</li>
                    <li>Main challenge: Making complex tech understandable</li>
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-12 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-center text-gray-700 dark:text-gray-300 italic">
                &quot;In a world of 20,000 tokens, be the intelligence that finds the 20 that matter.&quot;
              </p>
              <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">
                - CAR Development Manifesto v1.0
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}