'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// The domains that are hardcoded in the edge function
const DEFAULT_DOMAINS = [
  'pump.fun',
  'youtube.com',
  'instagram.com',
  'tiktok.com',
  'reddit.com',
  'twitter.com',
  'x.com',
  'facebook.com',
  'linkedin.com',
  'line.me',
  'telegram.org',
  't.me',
  'discord.com',
  'discord.gg',
  'web.archive.org',
  'archive.org',
  'github.com',
  'gitlab.com',
  'medium.com'
];

export default function AdminDomains() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [domains, setDomains] = useState<string[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [domainsLoading, setDomainsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDomains();
    }
  }, [isAuthenticated]);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/admin/auth');
      const data = await response.json();
      
      if (!data.authenticated) {
        router.push('/admin');
      } else {
        setIsAuthenticated(true);
      }
    } catch (error) {
      router.push('/admin');
    } finally {
      setLoading(false);
    }
  };

  const fetchDomains = async () => {
    try {
      const response = await fetch('/api/admin/excluded-domains');
      if (response.ok) {
        const data = await response.json();
        setDomains(data.domains || []);
      } else {
        // Fallback to default domains if API fails
        setDomains(DEFAULT_DOMAINS);
        setMessage({ 
          type: 'error', 
          text: 'Could not read domains from edge function, showing defaults' 
        });
      }
    } catch (error) {
      console.error('Error fetching domains:', error);
      setDomains(DEFAULT_DOMAINS);
      setMessage({ 
        type: 'error', 
        text: 'Could not read domains from edge function, showing defaults' 
      });
    } finally {
      setDomainsLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0b0d] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0a0b0d] p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-[#00ff88]" />
            <h1 className="text-3xl font-bold text-white">Domain Exclusions</h1>
          </div>
          <Link 
            href="/admin/prompts"
            className="text-[#666] hover:text-white transition-colors"
          >
            → AI Prompts
          </Link>
        </div>

        {/* Info Box */}
        <div className="bg-[#111214] border border-[#2a2d31] rounded-xl p-6 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#00ff88] mt-1" />
            <div>
              <h3 className="text-white font-semibold mb-2">How Domain Exclusions Work</h3>
              <p className="text-[#999] text-sm leading-relaxed">
                Domains listed below are automatically excluded during website discovery. 
                Tokens with these domains won&apos;t be migrated to the main crypto_projects_rated table.
                This prevents social media links and non-project sites from being analyzed as project websites.
              </p>
              <p className="text-[#00ff88] text-xs mt-3">
                ✓ This page now reads directly from the edge function code
              </p>
            </div>
          </div>
        </div>


        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg border ${
            message.type === 'success' 
              ? 'bg-green-500/10 border-green-500/30 text-green-500'
              : message.type === 'error'
              ? 'bg-red-500/10 border-red-500/30 text-red-500'
              : 'bg-blue-500/10 border-blue-500/30 text-blue-500'
          }`}>
            {message.text}
          </div>
        )}

        {/* Domains List */}
        <div className="bg-[#111214] border border-[#2a2d31] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">
              Excluded Domains ({domainsLoading ? '...' : domains.length})
            </h2>
            {domainsLoading && (
              <span className="text-[#666] text-sm">Reading from edge function...</span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {!domainsLoading && domains.map((domain) => (
              <div
                key={domain}
                className="px-4 py-3 bg-[#1a1c1f] border border-[#2a2d31] rounded-lg hover:border-[#3a3d41] transition-colors"
              >
                <span className="text-white font-mono text-sm">{domain}</span>
              </div>
            ))}
          </div>

          {domainsLoading && (
            <div className="text-center py-8 text-[#666]">
              Loading domains from edge function...
            </div>
          )}
          {!domainsLoading && domains.length === 0 && (
            <div className="text-center py-8 text-[#666]">
              No excluded domains configured
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-6 p-4 bg-[#111214] border border-[#2a2d31] rounded-xl">
          <h3 className="text-white font-semibold mb-2">To Make Changes Permanent:</h3>
          <ol className="text-[#999] text-sm space-y-1 ml-4">
            <li>1. Copy the updated domain list from this page</li>
            <li>2. Update the TRADING_PLATFORM_DOMAINS array in website-discovery/index.ts</li>
            <li>3. Deploy the updated edge function: <code className="text-[#00ff88]">npx supabase functions deploy website-discovery</code></li>
          </ol>
        </div>
      </div>
    </div>
  );
}