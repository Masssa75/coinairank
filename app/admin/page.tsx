'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Redirect to home page after successful login
        router.push('/');
      } else {
        setError(data.error || 'Invalid password');
      }
    } catch (err) {
      setError('Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b0d] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-[#111214] border border-[#2a2d31] rounded-xl p-8">
          <div className="flex items-center justify-center mb-6">
            <Lock className="w-12 h-12 text-[#00ff88]" />
          </div>
          <h1 className="text-2xl font-bold text-white text-center mb-2">Admin Access</h1>
          <p className="text-[#666] text-center mb-6">Enter password to unlock admin features</p>
          
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              className="w-full px-4 py-3 bg-[#1a1c1f] border border-[#2a2d31] rounded-lg text-white placeholder-[#666] focus:outline-none focus:border-[#00ff88] mb-4"
              autoFocus
            />
            
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-500 text-sm">{error}</p>
              </div>
            )}
            
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-3 bg-[#00ff88] text-black font-semibold rounded-lg hover:bg-[#00cc66] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Authenticating...' : 'Login'}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <Link href="/" className="text-[#666] hover:text-white transition-colors text-sm">
              ← Back to main site
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}