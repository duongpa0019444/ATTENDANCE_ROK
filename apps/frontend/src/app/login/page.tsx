'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Terminal, Lock, User, AlertCircle, ShieldAlert } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Vui lòng nhập đầy đủ tài khoản và mật khẩu.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Tài khoản hoặc mật khẩu không chính xác.');
      }

      if (data.user.role !== 'ADMIN' && data.user.role !== 'MANAGER' && data.user.role !== 'STAFF') {
        throw new Error('Tài khoản không được phân quyền truy cập.');
      }

      localStorage.setItem('token', data.accessToken);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Redirect based on role
      if (data.user.role === 'STAFF') {
        router.push('/staff');
      } else {
        router.push('/');
      }
    } catch (err: any) {
      setError(err.message || 'Không thể kết nối đến hệ thống.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 font-mono relative overflow-hidden px-4">
      {/* Background Cyber-grid effects */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#020617_1px,transparent_1px),linear-gradient(to_bottom,#020617_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30"></div>
      
      {/* Ambient glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md z-10 transition-all duration-300">
        {/* Logo / Title Area */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-xl border-2 border-cyan-500/40 bg-slate-900 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(6,182,212,0.15)] animate-pulse">
            <Terminal className="w-8 h-8 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">
            CYBER_ATTENDANCE
          </h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">
            Access Control System // Version 1.0
          </p>
        </div>

        {/* Login Card */}
        <Card className="border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-2xl relative">
          {/* Top colored accent line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500"></div>

          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-sm font-semibold tracking-wider text-slate-400 uppercase text-center flex items-center justify-center gap-2">
              🔒 ĐĂNG NHẬP HỆ THỐNG
            </CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Error Box */}
              {error && (
                <div className="flex gap-2.5 items-start p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs transition-all duration-200">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block uppercase tracking-wider mb-0.5">LỖI XÁC THỰC</span>
                    {error}
                  </div>
                </div>
              )}

              {/* Username field */}
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase flex justify-between">
                  <span>Tài khoản</span>
                  <span className="text-slate-600">INPUT_USER</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <User className="h-4 w-4" />
                  </div>
                  <Input
                    type="text"
                    placeholder="Nhập tên đăng nhập..."
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loading}
                    className="pl-10 bg-slate-950/80 border-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-cyan-500/50 focus-visible:border-cyan-500/50"
                  />
                </div>
              </div>

              {/* Password field */}
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase flex justify-between">
                  <span>Mật khẩu</span>
                  <span className="text-slate-600">INPUT_PASS</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock className="h-4 w-4" />
                  </div>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="pl-10 bg-slate-950/80 border-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-cyan-500/50 focus-visible:border-cyan-500/50"
                  />
                </div>
              </div>

              {/* Submit button */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold font-mono tracking-widest text-xs py-5 mt-2 rounded transition-all duration-300 border border-cyan-400/20 shadow-[0_0_15px_rgba(6,182,212,0.15)] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    LOGGING_IN...
                  </span>
                ) : (
                  'XÁC THỰC TRUY CẬP'
                )}
              </Button>
            </form>

            <div className="mt-6 text-[10px] text-center text-slate-600 border-t border-slate-800/60 pt-4">
              <span>Hệ thống chấm công và phân lịch làm việc ROK.</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
