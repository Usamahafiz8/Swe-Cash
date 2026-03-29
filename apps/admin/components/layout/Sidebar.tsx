'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Users,
  CreditCard,
  AlertTriangle,
  Settings,
  Bell,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/users', label: 'Users', icon: Users },
  { href: '/payouts', label: 'Payouts', icon: CreditCard },
  { href: '/fraud', label: 'Fraud', icon: AlertTriangle },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col bg-slate-900">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-slate-700/50 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
          <Shield className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-semibold text-white">SweCash</span>
        <span className="ml-auto rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-400">
          Admin
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                active
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 flex-shrink-0 transition-colors',
                  active ? 'text-white' : 'text-slate-500 group-hover:text-white'
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-700/50 px-3 py-3">
        <p className="px-3 text-xs text-slate-600">SweCash © 2026</p>
      </div>
    </aside>
  );
}
