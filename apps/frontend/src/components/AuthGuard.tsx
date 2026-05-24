'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X, Sun, Moon } from 'lucide-react';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.add('dark');
      }
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    if (nextTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  };

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
          } else if (user.role === 'STAFF') {
            router.push('/staff');
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
      if (user.role !== 'ADMIN' && user.role !== 'MANAGER' && user.role !== 'STAFF') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/login');
        return;
      }
      
      setUserRole(user.role);

      // Routing restrictions
      const isStaffRoute = pathname.startsWith('/staff');
      const isAdminRoute = pathname !== '/login' && pathname !== '/guide' && !isStaffRoute;

      if (user.role === 'STAFF' && isAdminRoute) {
        router.push('/staff');
        return;
      }

      if ((user.role === 'ADMIN' || user.role === 'MANAGER') && isStaffRoute) {
        router.push('/');
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

  const getUserName = () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user.full_name || 'User';
    } catch {
      return 'User';
    }
  };

  const getMenuClass = (path: string) => {
    return pathname === path
      ? "text-sm font-semibold text-cyan-400 transition-colors border-b-2 border-cyan-400 pb-0.5"
      : "text-sm font-medium text-slate-300 hover:text-white transition-colors";
  };

  const getMobileMenuClass = (path: string) => {
    return pathname === path
      ? "text-sm font-semibold text-cyan-400 bg-slate-800/40 px-3 py-2.5 rounded-lg transition-all border-l-2 border-cyan-400 pl-2"
      : "text-sm font-medium text-slate-300 hover:text-cyan-400 hover:bg-slate-800/40 px-3 py-2.5 rounded-lg transition-all";
  };

  return isAuthenticated ? (
    <>
      <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-4 sm:px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <a href={userRole === 'STAFF' ? "/staff" : "/"} className="text-cyan-400 font-bold tracking-wider hover:text-cyan-300 mr-2 sm:mr-4">
            ROK_SCHEDULE
          </a>
          <div className="hidden md:flex gap-6 items-center">
            {userRole === 'STAFF' ? (
              <>
                <a href="/staff" className={getMenuClass('/staff')}>Lịch & Bảng Lương</a>
              </>
            ) : (
              <>
                <a href="/" className={getMenuClass('/')}>Dashboard</a>
                <a href="/users" className={getMenuClass('/users')}>Nhân Sự</a>
                <a href="/shifts" className={getMenuClass('/shifts')}>Phân Ca</a>
                <a href="/payroll" className={getMenuClass('/payroll')}>Bảng Lương</a>
                <a href="/guide" className={getMenuClass('/guide')}>Hướng Dẫn</a>
              </>
            )}
          </div>
        </div>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-4">
          <button
            onClick={toggleTheme}
            className="p-1.5 text-slate-400 hover:text-white border border-slate-800 bg-slate-950/40 hover:bg-slate-800/50 rounded-lg transition-colors cursor-pointer"
            title={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-cyan-400" />}
          </button>
          <span className="text-xs text-slate-400 font-mono uppercase tracking-wider bg-slate-800/50 border border-slate-700/50 px-2.5 py-1 rounded">
            🟢 {getUserName()}
          </span>
          <button
            onClick={handleLogout}
            className="text-xs text-red-400 hover:text-red-300 font-medium font-mono border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1 rounded transition-colors"
          >
            ĐĂNG XUẤT
          </button>
        </div>

        {/* Mobile menu button */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-1.5 text-slate-400 hover:text-white border border-slate-800 bg-slate-950/40 hover:bg-slate-800/50 rounded-lg transition-colors cursor-pointer"
            title={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-cyan-400" />}
          </button>
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
            {userRole === 'STAFF' ? (
              <>
                <a 
                  href="/staff" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={getMobileMenuClass('/staff')}
                >
                  Lịch & Bảng Lương
                </a>
              </>
            ) : (
              <>
                <a 
                  href="/" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={getMobileMenuClass('/')}
                >
                  Dashboard
                </a>
                <a 
                  href="/users" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={getMobileMenuClass('/users')}
                >
                  Nhân Sự
                </a>
                <a 
                  href="/shifts" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={getMobileMenuClass('/shifts')}
                >
                  Phân Ca
                </a>
                <a 
                  href="/payroll" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={getMobileMenuClass('/payroll')}
                >
                  Bảng Lương
                </a>
                <a 
                  href="/guide" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={getMobileMenuClass('/guide')}
                >
                  Hướng Dẫn
                </a>
              </>
            )}
          </div>
        </div>

        {/* User Actions at the Bottom */}
        <div className="space-y-4 pt-4 border-t border-slate-800">
          <div className="flex flex-col gap-1.5 px-3">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Đăng nhập với vai trò</span>
            <span className="text-xs text-slate-300 font-mono uppercase tracking-wider bg-slate-800/50 border border-slate-700/50 px-2.5 py-1.5 rounded w-full text-center">
              🟢 {getUserName()}
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
