'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userJson = localStorage.getItem('user');

    if (pathname === '/login') {
      if (token && userJson) {
        try {
          const user = JSON.parse(userJson);
          if (user.role === 'ADMIN' || user.role === 'MANAGER') {
            router.push('/');
            return;
          }
        } catch (e) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
      setLoading(false);
      return;
    }

    if (!token || !userJson) {
      router.push('/login');
      return;
    }

    try {
      const user = JSON.parse(userJson);
      if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/login');
        return;
      }
      setIsAuthenticated(true);
    } catch (e) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }, [pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-cyan-400 font-mono">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="tracking-widest text-xs">CYBER_AUTH_CHECKING...</span>
        </div>
      </div>
    );
  }

  if (pathname === '/login') {
    return <>{children}</>;
  }

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const getAdminName = () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user.full_name || 'Admin';
    } catch {
      return 'Admin';
    }
  };

  return isAuthenticated ? (
    <>
      <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-4 sm:px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <a href="/" className="text-cyan-400 font-bold tracking-wider hover:text-cyan-300 mr-2 sm:mr-4">
            ROK_SCHEDULE
          </a>
          <div className="hidden md:flex gap-6 items-center">
            <a href="/" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Dashboard</a>
            <a href="/users" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Nhân Sự</a>
            <a href="/shifts" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Phân Ca</a>
          </div>
        </div>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-4">
          <span className="text-xs text-slate-400 font-mono uppercase tracking-wider bg-slate-800/50 border border-slate-700/50 px-2.5 py-1 rounded">
            🟢 {getAdminName()}
          </span>
          <button
            onClick={handleLogout}
            className="text-xs text-red-400 hover:text-red-300 font-medium font-mono border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1 rounded transition-colors"
          >
            ĐĂNG XUẤT
          </button>
        </div>

        {/* Mobile menu button */}
        <div className="flex md:hidden">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="text-slate-400 hover:text-white focus:outline-none p-1.5 rounded-lg border border-slate-800 bg-slate-950/40"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </nav>

      {/* Mobile menu backdrop */}
      <div 
        className={`fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${
          isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      {/* Mobile menu sidebar drawer (Slides in from left) */}
      <div 
        className={`fixed top-0 left-0 bottom-0 w-[70%] max-w-[300px] bg-slate-900/95 backdrop-blur-md border-r border-slate-800 p-6 z-50 md:hidden flex flex-col justify-between shadow-2xl transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="space-y-6">
          {/* Drawer Header */}
          <div className="flex justify-between items-center pb-4 border-b border-slate-800">
            <span className="text-cyan-400 font-bold tracking-wider">
              ROK_SCHEDULE
            </span>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg border border-slate-800 bg-slate-950/40"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <div className="flex flex-col gap-2">
            <a 
              href="/" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-sm font-medium text-slate-300 hover:text-cyan-400 hover:bg-slate-800/40 px-3 py-2.5 rounded-lg transition-all"
            >
              Dashboard
            </a>
            <a 
              href="/users" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-sm font-medium text-slate-300 hover:text-cyan-400 hover:bg-slate-800/40 px-3 py-2.5 rounded-lg transition-all"
            >
              Nhân Sự
            </a>
            <a 
              href="/shifts" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-sm font-medium text-slate-300 hover:text-cyan-400 hover:bg-slate-800/40 px-3 py-2.5 rounded-lg transition-all"
            >
              Phân Ca
            </a>
          </div>
        </div>

        {/* User Actions at the Bottom */}
        <div className="space-y-4 pt-4 border-t border-slate-800">
          <div className="flex flex-col gap-1.5 px-3">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Đăng nhập với vai trò</span>
            <span className="text-xs text-slate-300 font-mono uppercase tracking-wider bg-slate-800/50 border border-slate-700/50 px-2.5 py-1.5 rounded w-full text-center">
              🟢 {getAdminName()}
            </span>
          </div>
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              handleLogout();
            }}
            className="w-full text-xs text-red-400 hover:text-red-300 font-medium font-mono border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 py-2.5 rounded transition-colors text-center"
          >
            ĐĂNG XUẤT
          </button>
        </div>
      </div>

      {children}
    </>
  ) : null;
}
