'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

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
      <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 py-4 flex gap-6 items-center sticky top-0 z-50">
        <a href="/" className="text-cyan-400 font-bold tracking-wider hover:text-cyan-300 mr-4">CYBER_APP</a>
        <a href="/" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Dashboard</a>
        <a href="/users" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Nhân Sự</a>
        <a href="/shifts" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Phân Ca</a>
        <div className="ml-auto flex items-center gap-4">
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
      </nav>
      {children}
    </>
  ) : null;
}
