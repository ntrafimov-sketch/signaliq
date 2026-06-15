import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Settings, Search, Zap, BarChart2, List, Users, Activity, LogOut, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuthStore } from '../store/useAuthStore';

const navItems = [
  { label: 'Accounts', path: '/accounts', icon: Users },
  { label: 'Signals', path: '/signals', icon: Activity },
  { label: 'Lists', path: '/lists', icon: List },
  { label: 'Reports', path: '/reports', icon: BarChart2 },
];

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const initials = currentUser
    ? currentUser.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Nav */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center gap-6">
          {/* Logo */}
          <Link to="/accounts" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white fill-white" />
            </div>
            <span className="font-semibold text-slate-900 text-sm tracking-tight">SignalIQ</span>
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5',
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Search */}
          <div className="flex-1 max-w-xs ml-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search accounts..."
                className="w-full pl-9 pr-4 py-1.5 text-sm rounded-lg border border-slate-200 bg-slate-50 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors"
              />
            </div>
          </div>

          {/* Right actions */}
          <div className="ml-auto flex items-center gap-1">
            <button className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors relative">
              <Bell className="w-4.5 h-4.5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <Link to="/settings" className={cn(
              'p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors',
              location.pathname === '/settings' && 'bg-indigo-50 text-indigo-700'
            )}>
              <Settings className="w-4.5 h-4.5" />
            </Link>

            {/* User avatar + dropdown */}
            <div className="relative ml-1" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((o) => !o)}
                className="flex items-center gap-1.5 rounded-full pl-1 pr-2 py-1 hover:bg-slate-100 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-semibold flex items-center justify-center">
                  {initials}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-xl border border-slate-200 shadow-lg py-1 z-50">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <p className="text-sm font-medium text-slate-900 truncate">{currentUser?.name}</p>
                    <p className="text-xs text-slate-500 truncate">{currentUser?.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4 text-slate-400" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 py-6">
        {children}
      </main>
    </div>
  );
}
