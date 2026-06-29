import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Settings, BarChart2, List, Users, Activity, LogOut, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import logoSvg from '../assets/logo.svg';
import { cn } from '../lib/utils';
import { useAuthStore } from '../store/useAuthStore';
import { useStore } from '../store/useStore';

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
  const { profile, setProfile } = useStore((s) => ({ profile: s.profile, setProfile: s.setProfile }));

  // Keep profile in sync with logged-in user
  useEffect(() => {
    if (currentUser && (profile.email !== currentUser.email || profile.name !== currentUser.name)) {
      setProfile({ name: currentUser.name, email: currentUser.email });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const [collapsed, setCollapsed] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  function handleReset() {
    localStorage.clear();
    window.location.href = '/login';
  }

  const initials = currentUser
    ? currentUser.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const pageTitle = navItems.find(item => location.pathname.startsWith(item.path))?.label ?? 'SignalIQ';
  const sidebarWidth = collapsed ? 'w-16' : 'w-60';
  const mainMargin = collapsed ? 'ml-16' : 'ml-60';

  return (
    <div className="min-h-screen bg-[#F5F3FF] flex">
      {/* Sidebar */}
      <aside className={cn(
        'bg-white flex flex-col fixed inset-y-0 left-0 z-30 transition-all duration-200',
        'border-r border-violet-100',
        sidebarWidth
      )}>
        {/* Logo */}
        <div className="px-4 py-5 flex items-center justify-between">
          <Link to="/accounts" className="flex items-center gap-2.5 min-w-0">
            <img src={logoSvg} className="w-8 h-8 flex-shrink-0" alt="SignalIQ" />
            {!collapsed && (
              <span className="font-extrabold text-gray-900 text-[15px] tracking-tight truncate">SignalIQ</span>
            )}
          </Link>
          <button
            onClick={() => setCollapsed(c => !c)}
            className="p-1 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors flex-shrink-0"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all',
                  collapsed && 'justify-center px-2',
                  isActive
                    ? 'bg-gradient-to-r from-violet-600 to-violet-700 text-white shadow-sm shadow-violet-200'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-violet-50'
                )}
              >
                <item.icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-white' : 'text-gray-400')} />
                {!collapsed && item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-3 py-3 border-t border-violet-50 space-y-1">
          <Link
            to="/settings"
            title={collapsed ? 'Settings' : undefined}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all',
              collapsed && 'justify-center px-2',
              location.pathname === '/settings'
                ? 'bg-gradient-to-r from-violet-600 to-violet-700 text-white shadow-sm shadow-violet-200'
                : 'text-gray-500 hover:text-gray-900 hover:bg-violet-50'
            )}
          >
            <Settings className={cn('w-4 h-4 flex-shrink-0', location.pathname === '/settings' ? 'text-white' : 'text-gray-400')} />
            {!collapsed && 'Settings'}
          </Link>

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-violet-50 transition-colors text-left',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? currentUser?.name : undefined}
            >
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.name}
                  className="w-7 h-7 rounded-xl object-cover flex-shrink-0" />
              ) : (
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-violet-600 to-violet-800 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {initials}
                </div>
              )}
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">{currentUser?.name}</p>
                    <p className="text-xs text-gray-400 truncate">{currentUser?.email}</p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                </>
              )}
            </button>

            {dropdownOpen && (
              <div className={cn(
                'absolute bottom-full mb-1 bg-white rounded-2xl border border-violet-100 shadow-xl shadow-violet-100 py-1.5 z-50 w-52',
                collapsed ? 'left-full ml-2 bottom-0' : 'left-0 right-0'
              )}>
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-violet-50 transition-colors">
                  <LogOut className="w-4 h-4 text-gray-400" />
                  Sign out
                </button>
                <button onClick={handleReset}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors border-t border-gray-100">
                  <LogOut className="w-4 h-4" />
                  Reset all data
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className={cn('flex-1 flex flex-col min-h-screen transition-all duration-200', mainMargin)}>
        {/* Top header */}
        <header className="bg-white/80 backdrop-blur-sm border-b border-violet-100 sticky top-0 z-20">
          <div className="px-6 h-14 flex items-center justify-between">
            <h1 className="text-[15px] font-bold text-gray-900 tracking-tight">{pageTitle}</h1>
            <button className="p-2 rounded-xl text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors relative">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
            </button>
          </div>
        </header>

        <main className="flex-1 px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
