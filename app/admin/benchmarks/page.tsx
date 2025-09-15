'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminSidebar from '@/components/AdminSidebar';
import { LogOut, Plus, Save, Trash2, Edit2, X, Check } from 'lucide-react';
import Link from 'next/link';

interface Benchmark {
  id: number;
  tier: number;
  tier_name: string;
  min_score: number;
  max_score: number;
  benchmark_signal: string;
  signal_category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function AdminBenchmarks() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Benchmark>>({});
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newBenchmark, setNewBenchmark] = useState<Partial<Benchmark>>({
    tier: 4,
    tier_name: 'TRASH',
    min_score: 0,
    max_score: 29,
    benchmark_signal: '',
    signal_category: '',
    is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tierOptions = [
    { tier: 1, name: 'ALPHA', minScore: 85, maxScore: 100 },
    { tier: 2, name: 'SOLID', minScore: 60, maxScore: 84 },
    { tier: 3, name: 'BASIC', minScore: 30, maxScore: 59 },
    { tier: 4, name: 'TRASH', minScore: 0, maxScore: 29 },
  ];

  const categoryOptions = [
    'investment',
    'partnership',
    'platform',
    'product',
    'team',
    'social',
    'meme',
    'exchange',
    'tokenomics',
    'presence',
    'security',
    'documentation',
    'innovation',
  ];

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
      fetchBenchmarks();
    } catch (err) {
      console.error('Auth check failed:', err);
      router.push('/admin');
    } finally {
      setLoading(false);
    }
  };

  const fetchBenchmarks = async () => {
    try {
      const response = await fetch('/api/admin/benchmarks');
      if (!response.ok) throw new Error('Failed to fetch benchmarks');
      const data = await response.json();
      setBenchmarks(data);
    } catch (err) {
      console.error('Error fetching benchmarks:', err);
      setError('Failed to load benchmarks');
    }
  };

  const handleEdit = (benchmark: Benchmark) => {
    setEditingId(benchmark.id);
    setEditForm(benchmark);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/benchmarks/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) throw new Error('Failed to update benchmark');

      await fetchBenchmarks();
      setEditingId(null);
      setEditForm({});
    } catch (err) {
      console.error('Error saving benchmark:', err);
      setError('Failed to save benchmark');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this benchmark?')) return;

    try {
      const response = await fetch(`/api/admin/benchmarks/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete benchmark');

      await fetchBenchmarks();
    } catch (err) {
      console.error('Error deleting benchmark:', err);
      setError('Failed to delete benchmark');
    }
  };

  const handleToggleActive = async (benchmark: Benchmark) => {
    try {
      const response = await fetch(`/api/admin/benchmarks/${benchmark.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...benchmark, is_active: !benchmark.is_active }),
      });

      if (!response.ok) throw new Error('Failed to toggle benchmark');

      await fetchBenchmarks();
    } catch (err) {
      console.error('Error toggling benchmark:', err);
      setError('Failed to toggle benchmark');
    }
  };

  const handleAddNew = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/benchmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBenchmark),
      });

      if (!response.ok) throw new Error('Failed to add benchmark');

      await fetchBenchmarks();
      setIsAddingNew(false);
      setNewBenchmark({
        tier: 4,
        tier_name: 'TRASH',
        min_score: 0,
        max_score: 29,
        benchmark_signal: '',
        signal_category: '',
        is_active: true,
      });
    } catch (err) {
      console.error('Error adding benchmark:', err);
      setError('Failed to add benchmark');
    } finally {
      setSaving(false);
    }
  };

  const handleTierChange = (tier: number, isNew = false) => {
    const tierOption = tierOptions.find(t => t.tier === tier);
    if (!tierOption) return;

    if (isNew) {
      setNewBenchmark({
        ...newBenchmark,
        tier,
        tier_name: tierOption.name,
        min_score: tierOption.minScore,
        max_score: tierOption.maxScore,
      });
    } else {
      setEditForm({
        ...editForm,
        tier,
        tier_name: tierOption.name,
        min_score: tierOption.minScore,
        max_score: tierOption.maxScore,
      });
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

  const getTierColor = (tier: number) => {
    switch (tier) {
      case 1: return 'text-[#ffd700]'; // Gold for ALPHA
      case 2: return 'text-[#00ff88]'; // Green for SOLID
      case 3: return 'text-[#00bfff]'; // Blue for BASIC
      case 4: return 'text-[#ff4444]'; // Red for TRASH
      default: return 'text-[#888]';
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b0d] flex">
      <AdminSidebar activePage="benchmarks" />

      <div className="flex-1">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-[#0f0f0f] border-b border-[#2a2d31] px-6 h-14 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-white">Tier Benchmarks Management</h1>
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
          <div className="max-w-7xl mx-auto">
            {error && (
              <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-500">{error}</p>
              </div>
            )}

            <div className="mb-6 flex justify-between items-center">
              <p className="text-[#888]">
                Manage benchmark signals used for tier classification
              </p>
              <button
                onClick={() => setIsAddingNew(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#00ff88] text-black font-semibold rounded-lg hover:bg-[#00cc66] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add New Benchmark
              </button>
            </div>

            {/* Add New Benchmark Form */}
            {isAddingNew && (
              <div className="mb-6 p-4 bg-[#111214] border border-[#2a2d31] rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-4">Add New Benchmark</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-[#888] text-sm mb-2">Tier</label>
                    <select
                      value={newBenchmark.tier}
                      onChange={(e) => handleTierChange(Number(e.target.value), true)}
                      className="w-full px-3 py-2 bg-[#1a1c1f] border border-[#2a2d31] rounded-lg text-white"
                    >
                      {tierOptions.map((option) => (
                        <option key={option.tier} value={option.tier}>
                          {option.tier} - {option.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#888] text-sm mb-2">Category</label>
                    <select
                      value={newBenchmark.signal_category}
                      onChange={(e) => setNewBenchmark({ ...newBenchmark, signal_category: e.target.value })}
                      className="w-full px-3 py-2 bg-[#1a1c1f] border border-[#2a2d31] rounded-lg text-white"
                    >
                      <option value="">Select category</option>
                      {categoryOptions.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-[#888] text-sm mb-2">Benchmark Signal</label>
                  <input
                    type="text"
                    value={newBenchmark.benchmark_signal}
                    onChange={(e) => setNewBenchmark({ ...newBenchmark, benchmark_signal: e.target.value })}
                    className="w-full px-3 py-2 bg-[#1a1c1f] border border-[#2a2d31] rounded-lg text-white"
                    placeholder="Enter benchmark signal description"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddNew}
                    disabled={!newBenchmark.benchmark_signal || !newBenchmark.signal_category || saving}
                    className="flex items-center gap-2 px-4 py-2 bg-[#00ff88] text-black font-semibold rounded-lg hover:bg-[#00cc66] transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => setIsAddingNew(false)}
                    className="px-4 py-2 bg-[#1a1c1f] text-white rounded-lg hover:bg-[#252729] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Benchmarks Table */}
            <div className="bg-[#111214] border border-[#2a2d31] rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-[#1a1c1f] border-b border-[#2a2d31]">
                  <tr>
                    <th className="px-4 py-3 text-left text-[#888] text-sm font-medium">Tier</th>
                    <th className="px-4 py-3 text-left text-[#888] text-sm font-medium">Score Range</th>
                    <th className="px-4 py-3 text-left text-[#888] text-sm font-medium">Category</th>
                    <th className="px-4 py-3 text-left text-[#888] text-sm font-medium">Benchmark Signal</th>
                    <th className="px-4 py-3 text-left text-[#888] text-sm font-medium">Status</th>
                    <th className="px-4 py-3 text-left text-[#888] text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {benchmarks
                    .sort((a, b) => a.tier - b.tier || a.signal_category.localeCompare(b.signal_category))
                    .map((benchmark) => (
                      <tr key={benchmark.id} className="border-b border-[#2a2d31] hover:bg-[#1a1c1f]/50">
                        <td className="px-4 py-3">
                          <span className={`font-semibold ${getTierColor(benchmark.tier)}`}>
                            {benchmark.tier_name}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#888] text-sm">
                          {benchmark.min_score}-{benchmark.max_score}
                        </td>
                        <td className="px-4 py-3">
                          {editingId === benchmark.id ? (
                            <select
                              value={editForm.signal_category}
                              onChange={(e) => setEditForm({ ...editForm, signal_category: e.target.value })}
                              className="w-full px-2 py-1 bg-[#1a1c1f] border border-[#2a2d31] rounded text-white text-sm"
                            >
                              {categoryOptions.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-[#888] text-sm">{benchmark.signal_category}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {editingId === benchmark.id ? (
                            <input
                              type="text"
                              value={editForm.benchmark_signal}
                              onChange={(e) => setEditForm({ ...editForm, benchmark_signal: e.target.value })}
                              className="w-full px-2 py-1 bg-[#1a1c1f] border border-[#2a2d31] rounded text-white text-sm"
                            />
                          ) : (
                            <span className="text-white text-sm">{benchmark.benchmark_signal}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleActive(benchmark)}
                            className={`px-2 py-1 rounded text-xs font-semibold ${
                              benchmark.is_active
                                ? 'bg-[#00ff88]/20 text-[#00ff88]'
                                : 'bg-[#666]/20 text-[#666]'
                            }`}
                          >
                            {benchmark.is_active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {editingId === benchmark.id ? (
                              <>
                                <button
                                  onClick={handleSave}
                                  disabled={saving}
                                  className="p-1 text-[#00ff88] hover:bg-[#00ff88]/10 rounded transition-colors"
                                  title="Save"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingId(null);
                                    setEditForm({});
                                  }}
                                  className="p-1 text-[#ff4444] hover:bg-[#ff4444]/10 rounded transition-colors"
                                  title="Cancel"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleEdit(benchmark)}
                                  className="p-1 text-[#888] hover:text-white hover:bg-[#1a1c1f] rounded transition-colors"
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(benchmark.id)}
                                  className="p-1 text-[#888] hover:text-[#ff4444] hover:bg-[#ff4444]/10 rounded transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}