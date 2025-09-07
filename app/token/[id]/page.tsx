'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { ArrowLeft, ExternalLink, Copy, Check } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Token {
  id: number
  symbol: string
  name: string
  contract_address: string
  website_url: string
  website_stage1_score: number
  website_stage1_tier: string
  contract_verification: any
  signals_found: any[]
  red_flags: any[]
  project_summary_rich: any
  benchmark_comparison: any
  signal_evaluations: any[]
  comparison_explanation: string
  strongest_signal: any
}

export default function TokenDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [token, setToken] = useState<Token | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function fetchToken() {
      try {
        const { data, error } = await supabase
          .from('crypto_projects_rated')
          .select('*')
          .eq('id', params.id)
          .single()

        if (error) throw error
        setToken(data)
      } catch (error) {
        console.error('Error fetching token:', error)
      } finally {
        setLoading(false)
      }
    }

    if (params.id) {
      fetchToken()
    }
  }, [params.id])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getTierColor = (tier: string) => {
    switch (tier?.toUpperCase()) {
      case 'ALPHA': return 'text-purple-400'
      case 'SOLID': return 'text-green-400'
      case 'BASIC': return 'text-blue-400'
      case 'TRASH': return 'text-red-400'
      default: return 'text-gray-400'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-xl">Loading token details...</div>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-xl">Token not found</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>
          
          <div className="flex items-center gap-4">
            <span className={`text-2xl font-bold ${getTierColor(token.website_stage1_tier)}`}>
              {token.website_stage1_score || 0}
            </span>
            <span className="text-lg text-gray-400">
              {token.website_stage1_tier || 'UNRATED'}
            </span>
          </div>
        </div>

        {/* Token Info */}
        <div className="bg-gray-900 rounded-lg p-6 mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">{token.symbol}</h1>
              <p className="text-gray-400">{token.name}</p>
            </div>
            
            {token.website_url && (
              <a
                href={token.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Visit Website
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>

          {/* Contract Address */}
          <div className="flex items-center gap-2 p-3 bg-black/50 rounded-lg">
            <span className="text-gray-400 text-sm">Contract:</span>
            <code className="text-xs flex-1 text-green-400">{token.contract_address}</code>
            <button
              onClick={() => copyToClipboard(token.contract_address)}
              className="p-1 hover:bg-gray-800 rounded transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
            </button>
          </div>

          {/* Contract Verification */}
          {token.contract_verification && (
            <div className="mt-4 p-3 bg-black/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold">Contract Verification:</span>
                <span className={`text-sm ${token.contract_verification.found_on_site ? 'text-green-400' : 'text-red-400'}`}>
                  {token.contract_verification.found_on_site ? '✓ Verified' : '✗ Not Found'}
                </span>
              </div>
              {token.contract_verification.note && (
                <p className="text-xs text-gray-400">{token.contract_verification.note}</p>
              )}
            </div>
          )}
        </div>

        {/* Scoring Explanation */}
        {token.benchmark_comparison && (
          <div className="bg-gray-900 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">Scoring Analysis</h2>
            
            {/* Strongest Signal */}
            {token.strongest_signal && (
              <div className="mb-6 p-4 bg-blue-900/20 rounded-lg border border-blue-800">
                <h3 className="text-lg font-semibold mb-2 text-blue-400">Strongest Signal</h3>
                <p className="text-gray-300 mb-2">{token.strongest_signal.signal}</p>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-400">Tier: {token.strongest_signal.tier}</span>
                  <span className="text-gray-400">Match: {token.strongest_signal.benchmark_match}</span>
                </div>
              </div>
            )}

            {/* Explanation */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Overall Assessment</h3>
              <p className="text-gray-300">{token.comparison_explanation || token.benchmark_comparison.explanation}</p>
            </div>

            {/* Signal Evaluations */}
            {token.benchmark_comparison.signal_evaluations && token.benchmark_comparison.signal_evaluations.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Signal Breakdown</h3>
                <div className="space-y-4">
                  {token.benchmark_comparison.signal_evaluations.map((evaluation: any, index: number) => (
                    <div key={index} className="p-4 bg-black/50 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-medium text-gray-200 flex-1">{evaluation.signal}</p>
                        <span className="text-sm px-2 py-1 bg-gray-800 rounded">Tier {evaluation.assigned_tier}</span>
                      </div>
                      <p className="text-sm text-gray-400">{evaluation.reasoning}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Signals Found */}
        {token.signals_found && token.signals_found.length > 0 && (
          <div className="bg-gray-900 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">Positive Signals ({token.signals_found.length})</h2>
            <div className="space-y-4">
              {token.signals_found.map((signal: any, index: number) => (
                <div key={index} className="p-4 bg-green-900/20 rounded-lg border border-green-800">
                  <p className="font-medium mb-2">{signal.signal}</p>
                  <p className="text-sm text-gray-400 mb-2">{signal.context}</p>
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>📍 {signal.location}</span>
                    <span>🏷️ {signal.category}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Red Flags */}
        {token.red_flags && token.red_flags.length > 0 && (
          <div className="bg-gray-900 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-4 text-red-400">Red Flags ({token.red_flags.length})</h2>
            <div className="space-y-4">
              {token.red_flags.map((flag: any, index: number) => (
                <div key={index} className="p-4 bg-red-900/20 rounded-lg border border-red-800">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-medium">{flag.flag}</p>
                    <span className={`text-xs px-2 py-1 rounded ${
                      flag.severity === 'high' ? 'bg-red-600' : 
                      flag.severity === 'medium' ? 'bg-orange-600' : 'bg-yellow-600'
                    }`}>
                      {flag.severity}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">{flag.evidence}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Project Summary */}
        {token.project_summary_rich && (
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Project Analysis</h2>
            <div className="space-y-4">
              {Object.entries(token.project_summary_rich).map(([key, value]: [string, any]) => (
                <div key={key}>
                  <h3 className="text-sm font-semibold text-gray-400 mb-1">
                    {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </h3>
                  <p className="text-gray-300">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}