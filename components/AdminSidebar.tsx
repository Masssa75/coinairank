'use client';

import Link from 'next/link';
import { FileCode2, Target, LayoutDashboard } from 'lucide-react';

interface AdminSidebarProps {
  activePage: 'dashboard' | 'prompts' | 'benchmarks';
}

export default function AdminSidebar({ activePage }: AdminSidebarProps) {
  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      href: '/admin/dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'prompts',
      label: 'Analysis Prompts',
      href: '/admin/prompts',
      icon: FileCode2,
    },
    {
      id: 'benchmarks',
      label: 'Tier Benchmarks',
      href: '/admin/benchmarks',
      icon: Target,
    },
  ];

  return (
    <div className="w-64 bg-[#111214] border-r border-[#2a2d31] min-h-screen">
      <div className="p-6">
        <h2 className="text-xl font-bold text-[#00ff88] mb-8">Admin Panel</h2>

        <nav className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;

            return (
              <Link
                key={item.id}
                href={item.href}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                  ${isActive
                    ? 'bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20'
                    : 'text-[#888] hover:text-white hover:bg-[#1a1c1f]'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}