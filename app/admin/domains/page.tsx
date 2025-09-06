'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, AlertCircle, Shield } from 'lucide-react';
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
  const [domains, setDomains] = useState<string[]>(DEFAULT_DOMAINS);
  const [newDomain, setNewDomain] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/admin/check-auth');
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

  const addDomain = () => {
    const domain = newDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
    
    if (!domain) {
      setMessage({ type: 'error', text: 'Please enter a domain' });
      return;
    }

    if (domains.includes(domain)) {
      setMessage({ type: 'error', text: 'Domain already exists' });
      return;
    }

    setDomains([...domains, domain].sort());
    setNewDomain('');
    setMessage({ type: 'success', text: `Added ${domain} to exclusion list` });
  };

  const removeDomain = (domain: string) => {
    setDomains(domains.filter(d => d !== domain));
    setMessage({ type: 'success', text: `Removed ${domain} from exclusion list` });
  };

  const saveChanges = () => {
    setMessage({ 
      type: 'info', 
      text: 'Note: Changes are saved in the UI. To persist, update the edge function code.' 
    });
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
                Domains listed here are automatically excluded during website discovery. 
                Tokens with these domains won't be migrated to the main crypto_projects_rated table.
                This prevents social media links and non-project sites from being analyzed as project websites.
              </p>
              <p className="text-[#666] text-xs mt-3">
                Note: Changes here update the UI. To persist permanently, the edge function code must be updated.
              </p>
            </div>
          </div>
        </div>

        {/* Add Domain */}
        <div className="bg-[#111214] border border-[#2a2d31] rounded-xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">Add Exclusion</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addDomain()}
              placeholder="Enter domain (e.g., example.com)"
              className="flex-1 px-4 py-3 bg-[#1a1c1f] border border-[#2a2d31] rounded-lg text-white placeholder-[#666] focus:outline-none focus:border-[#00ff88]"
            />
            <button
              onClick={addDomain}
              className="px-6 py-3 bg-[#00ff88] text-black font-semibold rounded-lg hover:bg-[#00cc66] transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Domain
            </button>
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
              Excluded Domains ({domains.length})
            </h2>
            <button
              onClick={saveChanges}
              className="px-4 py-2 bg-[#1a1c1f] border border-[#2a2d31] text-white rounded-lg hover:bg-[#2a2d31] transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Configuration
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {domains.map((domain) => (
              <div
                key={domain}
                className="flex items-center justify-between px-4 py-3 bg-[#1a1c1f] border border-[#2a2d31] rounded-lg group hover:border-[#3a3d41] transition-colors"
              >
                <span className="text-white font-mono text-sm">{domain}</span>
                <button
                  onClick={() => removeDomain(domain)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-400"
                  title="Remove domain"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {domains.length === 0 && (
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