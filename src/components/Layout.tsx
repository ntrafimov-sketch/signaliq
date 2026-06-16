import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Settings, Zap, BarChart2, List, Users, Activity, LogOut, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const sidebarWidth = collapsed ? 'w-14' : 'w-56';
  const mainMargin = collapsed ? 'ml-14' : 'ml-56';

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={cn('bg-white border-r border-gray-100 flex flex-col fixed inset-y-0 left-0 z-30 transition-all duration-200', sidebarWidth)}>
        {/* Logo + collapse toggle */}
        <div className="px-3 py-4 border-b border-gray-100 flex items-center justify-between">
          <Link to="/accounts" className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 bg-violet-700 rounded-lg flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 text-white fill-white" />
            </div>
            {!collapsed && <span className="font-semibold text-gray-900 text-sm tracking-tight truncate">SignalIQ</span>}
          </Link>
          <button
            onClick={() => setCollapsed(c => !c)}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-0.5">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors',
                  collapsed && 'justify-center',
                  isActive ? 'text-violet-700 font-medium bg-violet-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                )}
              >
                <item.icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-violet-700' : 'text-gray-400')} />
                {!collapsed && item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-2 py-3 border-t border-gray-100">
          <Link
            to="/settings"
            title={collapsed ? 'Settings' : undefined}
            className={cn(
              'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors mb-1',
              collapsed && 'justify-center',
              location.pathname === '/settings' ? 'text-violet-700 font-medium bg-violet-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            )}
          >
            <Settings className={cn('w-4 h-4 flex-shrink-0', location.pathname === '/settings' ? 'text-violet-700' : 'text-gray-400')} />
            {!collapsed && 'Settings'}
          </Link>

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              className={cn('w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left', collapsed && 'justify-center')}
              title={collapsed ? currentUser?.name : undefined}
            >
              <div className="w-6 h-6 rounded-full bg-violet-700 text-white text-xs font-semibold flex items-center justify-center flex-shrink-0">
                {initials}
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{currentUser?.name}</p>
                    <p className="text-xs text-gray-400 truncate">{currentUser?.email}</p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                </>
              )}
            </button>

            {dropdownOpen && (
              <div className={cn('absolute bottom-full mb-1 bg-white rounded-xl border border-gray-200 shadow-lg py-1 z-50 w-48', collapsed ? 'left-full ml-2 bottom-0' : 'left-0 right-0')}>
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <LogOut className="w-4 h-4 text-gray-400" />
                  Sign out
                </button>
                <button onClick={handleReset}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-gray-50 transition-colors border-t border-gray-100">
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
        <header className="bg-white border-b border-gray-100 sticky top-0 z-20">
          <div className="px-6 h-14 flex items-center justify-between">
            <h1 className="text-sm font-semibold text-gray-900">{pageTitle}</h1>
            <button className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors relative">
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
