'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminSidebar from '@/components/AdminSidebar';
import { LogOut } from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboard() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/admin/auth');
      const data = await response.json();

      if (!data.authenticated) {
        router.push('/admin');
        return;
      }

      setIsAuthenticated(true);
    } catch (err) {
      console.error('Auth check failed:', err);
      router.push('/admin');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0b0d] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#00ff88] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0a0b0d] flex">
      <AdminSidebar activePage="dashboard" />

      <div className="flex-1">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-[#0f0f0f] border-b border-[#2a2d31] px-6 h-14 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-white">Admin Dashboard</h1>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="px-4 py-2 text-[#666] hover:text-white transition-colors text-sm"
            >
              Back to Site
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-[#666] hover:text-red-500 transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="p-6">
          <div className="max-w-4xl mx-auto">
            <div className="bg-[#111214] border border-[#2a2d31] rounded-xl p-8">
              <h2 className="text-2xl font-bold text-white mb-4">Welcome to Admin Panel</h2>
              <p className="text-[#888] mb-6">
                Use the sidebar to navigate to different admin sections.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                <Link
                  href="/admin/prompts"
                  className="p-6 bg-[#1a1c1f] border border-[#2a2d31] rounded-lg hover:border-[#00ff88] transition-colors"
                >
                  <h3 className="text-lg font-semibold text-white mb-2">Analysis Prompts</h3>
                  <p className="text-[#666] text-sm">View and understand the AI analysis prompts</p>
                </Link>

                <Link
                  href="/admin/benchmarks"
                  className="p-6 bg-[#1a1c1f] border border-[#2a2d31] rounded-lg hover:border-[#00ff88] transition-colors"
                >
                  <h3 className="text-lg font-semibold text-white mb-2">Tier Benchmarks</h3>
                  <p className="text-[#666] text-sm">Manage benchmark signals for project tiers</p>
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}